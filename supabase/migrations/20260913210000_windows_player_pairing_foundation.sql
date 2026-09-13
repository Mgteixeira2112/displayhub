create table if not exists public.player_pairing_requests (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.player_devices(id) on delete cascade,
  code text not null,
  secret_hash text not null,
  hostname text,
  monitors jsonb not null default '[]'::jsonb,
  company_id uuid references public.companies(id) on delete set null,
  assigned_mappings jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','claimed','consumed','expired')),
  expires_at timestamptz not null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists player_pairing_requests_active_code_uidx
  on public.player_pairing_requests(code) where status = 'pending';
create index if not exists player_pairing_requests_device_idx
  on public.player_pairing_requests(device_id, created_at desc);
create index if not exists player_pairing_requests_expiry_idx
  on public.player_pairing_requests(expires_at) where status = 'pending';

alter table public.player_pairing_requests enable row level security;
revoke all on table public.player_pairing_requests from anon, authenticated;

drop policy if exists player_pairing_requests_select_own_company on public.player_pairing_requests;
create policy player_pairing_requests_select_own_company
on public.player_pairing_requests for select to authenticated
using (company_id = private.current_company_id());

create or replace function public.create_windows_player_pairing(
  p_device_id uuid,
  p_device_secret text,
  p_hostname text,
  p_monitors jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret_hash text;
  v_existing_hash text;
  v_code text;
  v_pairing_id uuid;
  v_expires_at timestamptz := now() + interval '10 minutes';
  v_attempt integer := 0;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if p_device_id is null or coalesce(length(p_device_secret), 0) < 32 then
    raise exception 'invalid_device_credentials';
  end if;

  v_secret_hash := encode(digest(p_device_secret, 'sha256'), 'hex');
  select secret_hash into v_existing_hash from public.player_devices where id = p_device_id;
  if v_existing_hash is null or v_existing_hash <> v_secret_hash then
    raise exception 'invalid_device_credentials';
  end if;

  update public.player_pairing_requests
  set status = 'expired', updated_at = now()
  where device_id = p_device_id and status = 'pending';

  loop
    v_attempt := v_attempt + 1;
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;
    begin
      insert into public.player_pairing_requests(device_id, code, secret_hash, hostname, monitors, expires_at)
      values (
        p_device_id,
        v_code,
        v_secret_hash,
        nullif(left(coalesce(p_hostname, ''), 160), ''),
        case when jsonb_typeof(coalesce(p_monitors, '[]'::jsonb)) = 'array' then coalesce(p_monitors, '[]'::jsonb) else '[]'::jsonb end,
        v_expires_at
      ) returning id into v_pairing_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 20 then raise exception 'pairing_code_generation_failed'; end if;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'pairing_id', v_pairing_id, 'code', v_code, 'expires_at', v_expires_at);
end;
$$;

create or replace function public.claim_windows_player_pairing(
  p_code text,
  p_mappings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  v_company_id uuid := private.current_company_id();
  v_role text := private.current_user_role();
  v_request public.player_pairing_requests%rowtype;
  v_mapping jsonb;
  v_display_id uuid;
  v_physical_display_id text;
  v_safe_mappings jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or v_company_id is null or v_role not in ('admin','manager') then
    raise exception 'forbidden';
  end if;

  select * into v_request
  from public.player_pairing_requests
  where code = upper(trim(coalesce(p_code, ''))) and status = 'pending'
  for update;

  if not found then raise exception 'pairing_not_found'; end if;
  if v_request.expires_at <= now() then
    update public.player_pairing_requests set status='expired', updated_at=now() where id=v_request.id;
    raise exception 'pairing_expired';
  end if;

  if jsonb_typeof(coalesce(p_mappings, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_mappings, '[]'::jsonb)) = 0 then
    raise exception 'pairing_requires_mapping';
  end if;

  for v_mapping in select value from jsonb_array_elements(p_mappings)
  loop
    v_physical_display_id := nullif(v_mapping->>'physical_display_id', '');
    begin
      v_display_id := nullif(v_mapping->>'display_id', '')::uuid;
    exception when others then
      raise exception 'invalid_display_id';
    end;

    if v_physical_display_id is null or v_display_id is null then raise exception 'invalid_pairing_mapping'; end if;
    if not exists (
      select 1 from public.displays d
      where d.id = v_display_id and d.company_id = v_company_id and d.is_active = true and d.revoked_at is null
    ) then raise exception 'display_not_available'; end if;
    if exists (
      select 1 from jsonb_array_elements(v_safe_mappings) x
      where x->>'physical_display_id' = v_physical_display_id
    ) then raise exception 'duplicate_physical_display'; end if;

    v_safe_mappings := v_safe_mappings || jsonb_build_array(
      jsonb_build_object('physical_display_id', v_physical_display_id, 'display_id', v_display_id)
    );
  end loop;

  update public.player_pairing_requests
  set company_id=v_company_id, assigned_mappings=v_safe_mappings, status='claimed',
      claimed_by=auth.uid(), claimed_at=now(), updated_at=now()
  where id=v_request.id;

  return jsonb_build_object('ok', true, 'pairing_id', v_request.id, 'device_id', v_request.device_id);
end;
$$;

create or replace function public.poll_windows_player_pairing(
  p_pairing_id uuid,
  p_device_id uuid,
  p_device_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret_hash text;
  v_request public.player_pairing_requests%rowtype;
  v_mapping jsonb;
  v_display_token text;
  v_result_mappings jsonb := '[]'::jsonb;
begin
  if p_pairing_id is null or p_device_id is null or coalesce(length(p_device_secret), 0) < 32 then
    raise exception 'invalid_device_credentials';
  end if;

  v_secret_hash := encode(digest(p_device_secret, 'sha256'), 'hex');
  select * into v_request from public.player_pairing_requests where id=p_pairing_id and device_id=p_device_id;
  if not found or v_request.secret_hash <> v_secret_hash then raise exception 'invalid_device_credentials'; end if;

  if v_request.status='pending' and v_request.expires_at <= now() then
    update public.player_pairing_requests set status='expired', updated_at=now() where id=v_request.id;
    return jsonb_build_object('ok', true, 'status', 'expired');
  end if;

  if v_request.status <> 'claimed' then
    return jsonb_build_object('ok', true, 'status', v_request.status, 'expires_at', v_request.expires_at);
  end if;

  for v_mapping in select value from jsonb_array_elements(v_request.assigned_mappings)
  loop
    select d.public_token into v_display_token
    from public.displays d
    where d.id=(v_mapping->>'display_id')::uuid and d.company_id=v_request.company_id and d.is_active=true and d.revoked_at is null;
    if v_display_token is null then raise exception 'assigned_display_unavailable'; end if;
    v_result_mappings := v_result_mappings || jsonb_build_array(
      jsonb_build_object(
        'physical_display_id', v_mapping->>'physical_display_id',
        'display_url', 'https://mgteixeira2112.github.io/displayhub/display/' || v_display_token
      )
    );
  end loop;

  update public.player_pairing_requests set status='consumed', consumed_at=now(), updated_at=now()
  where id=v_request.id and status='claimed';

  return jsonb_build_object('ok', true, 'status', 'claimed', 'mappings', v_result_mappings, 'company_id', v_request.company_id);
end;
$$;

revoke all on function public.create_windows_player_pairing(uuid,text,text,jsonb) from public;
revoke all on function public.claim_windows_player_pairing(text,jsonb) from public;
revoke all on function public.poll_windows_player_pairing(uuid,uuid,text) from public;
grant execute on function public.create_windows_player_pairing(uuid,text,text,jsonb) to anon, authenticated;
grant execute on function public.poll_windows_player_pairing(uuid,uuid,text) to anon, authenticated;
grant execute on function public.claim_windows_player_pairing(text,jsonb) to authenticated;
