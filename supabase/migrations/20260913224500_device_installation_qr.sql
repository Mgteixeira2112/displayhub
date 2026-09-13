create table if not exists public.device_installation_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','consumed','expired')),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  consumed_at timestamptz,
  device_id uuid references public.player_devices(id) on delete set null,
  display_id uuid references public.displays(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_installation_requests_company_idx
  on public.device_installation_requests(company_id, created_at desc);
create index if not exists device_installation_requests_expiry_idx
  on public.device_installation_requests(expires_at) where status = 'pending';

alter table public.device_installation_requests enable row level security;
revoke all on table public.device_installation_requests from anon, authenticated;

drop policy if exists device_installation_requests_select_own_company on public.device_installation_requests;
create policy device_installation_requests_select_own_company
on public.device_installation_requests for select to authenticated
using (company_id = private.current_company_id());

create or replace function public.create_device_installation()
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_company_id uuid := private.current_company_id();
  v_role text := private.current_user_role();
  v_token text;
  v_token_hash text;
  v_request_id uuid;
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  if auth.uid() is null or v_company_id is null or v_role not in ('admin','manager') then
    raise exception 'forbidden';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.device_installation_requests(company_id, token_hash, expires_at, created_by)
  values (v_company_id, v_token_hash, v_expires_at, auth.uid())
  returning id into v_request_id;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'token', v_token,
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.activate_device_installation(
  p_token text,
  p_device_id uuid,
  p_device_secret text,
  p_device_label text default null,
  p_platform text default 'web',
  p_screen_width integer default 1920,
  p_screen_height integer default 1080
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token_hash text;
  v_secret_hash text;
  v_request public.device_installation_requests%rowtype;
  v_existing public.player_devices%rowtype;
  v_display_id uuid;
  v_public_token text;
  v_display_name text;
  v_platform text;
  v_width integer;
  v_height integer;
  v_device_suffix text;
begin
  if coalesce(length(trim(p_token)), 0) < 32 or p_device_id is null or coalesce(length(p_device_secret), 0) < 32 then
    raise exception 'invalid_activation_credentials';
  end if;

  v_token_hash := encode(digest(trim(p_token), 'sha256'), 'hex');
  v_secret_hash := encode(digest(p_device_secret, 'sha256'), 'hex');

  select * into v_request
  from public.device_installation_requests
  where token_hash = v_token_hash
  for update;

  if not found then raise exception 'installation_not_found'; end if;

  if v_request.status = 'consumed' then
    if v_request.device_id = p_device_id and v_request.display_id is not null then
      select public_token, name into v_public_token, v_display_name
      from public.displays
      where id = v_request.display_id and is_active = true and revoked_at is null;

      if v_public_token is not null then
        return jsonb_build_object(
          'ok', true,
          'status', 'configured',
          'device_id', v_request.device_id,
          'display_id', v_request.display_id,
          'display_name', v_display_name,
          'display_url', 'https://mgteixeira2112.github.io/displayhub/display/' || v_public_token
        );
      end if;
    end if;
    raise exception 'installation_already_consumed';
  end if;

  if v_request.status <> 'pending' then raise exception 'installation_unavailable'; end if;

  if v_request.expires_at <= now() then
    update public.device_installation_requests
    set status = 'expired', updated_at = now()
    where id = v_request.id;
    raise exception 'installation_expired';
  end if;

  select * into v_existing from public.player_devices where id = p_device_id;
  if found then
    if v_existing.secret_hash <> v_secret_hash then raise exception 'invalid_device_credentials'; end if;
    if v_existing.company_id is not null and v_existing.company_id <> v_request.company_id then
      raise exception 'device_already_assigned';
    end if;
  end if;

  v_platform := lower(regexp_replace(coalesce(nullif(trim(p_platform), ''), 'web'), '[^a-z0-9_-]', '', 'g'));
  if v_platform = '' then v_platform := 'web'; end if;
  v_platform := left(v_platform, 40);
  v_width := greatest(320, least(coalesce(p_screen_width, 1920), 16384));
  v_height := greatest(320, least(coalesce(p_screen_height, 1080), 16384));
  v_device_suffix := upper(substr(replace(p_device_id::text, '-', ''), 1, 6));
  v_display_name := left(coalesce(nullif(trim(p_device_label), ''), 'Nova tela - ' || v_device_suffix), 120);
  if char_length(v_display_name) < 2 then v_display_name := 'Nova tela - ' || v_device_suffix; end if;

  insert into public.displays(
    company_id, name, location, orientation, resolution_width, resolution_height, created_by
  ) values (
    v_request.company_id,
    v_display_name,
    'Configuração pendente',
    case when v_height > v_width then 'portrait' else 'landscape' end,
    v_width,
    v_height,
    v_request.created_by
  ) returning id, public_token into v_display_id, v_public_token;

  insert into public.player_devices(
    id, company_id, secret_hash, hostname, app_version, platform, os_release,
    monitor_count, monitors, mappings, kiosk_mode, auto_start, last_seen_at, updated_at
  ) values (
    p_device_id,
    v_request.company_id,
    v_secret_hash,
    nullif(left(coalesce(p_device_label, ''), 160), ''),
    'web-activation-1',
    v_platform,
    null,
    1,
    jsonb_build_array(jsonb_build_object('id', 'browser', 'width', v_width, 'height', v_height, 'primary', true)),
    jsonb_build_array(jsonb_build_object('physical_display_id', 'browser', 'display_id', v_display_id)),
    true,
    false,
    now(),
    now()
  )
  on conflict (id) do update
  set company_id = excluded.company_id,
      hostname = excluded.hostname,
      app_version = excluded.app_version,
      platform = excluded.platform,
      monitor_count = excluded.monitor_count,
      monitors = excluded.monitors,
      mappings = excluded.mappings,
      kiosk_mode = excluded.kiosk_mode,
      auto_start = excluded.auto_start,
      last_seen_at = now(),
      updated_at = now();

  update public.device_installation_requests
  set status = 'consumed',
      consumed_at = now(),
      device_id = p_device_id,
      display_id = v_display_id,
      updated_at = now()
  where id = v_request.id and status = 'pending';

  return jsonb_build_object(
    'ok', true,
    'status', 'configured',
    'device_id', p_device_id,
    'display_id', v_display_id,
    'display_name', v_display_name,
    'display_url', 'https://mgteixeira2112.github.io/displayhub/display/' || v_public_token
  );
end;
$$;

revoke all on function public.create_device_installation() from public;
revoke all on function public.activate_device_installation(text,uuid,text,text,text,integer,integer) from public;
grant execute on function public.create_device_installation() to authenticated;
grant execute on function public.activate_device_installation(text,uuid,text,text,text,integer,integer) to anon, authenticated;
