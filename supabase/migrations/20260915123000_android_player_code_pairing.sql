create or replace function public.create_android_player_pairing(
  p_device_id uuid,
  p_device_secret text,
  p_device_label text default null,
  p_screen_width integer default 1920,
  p_screen_height integer default 1080
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret_hash text;
  v_existing public.player_devices%rowtype;
  v_code text;
  v_pairing_id uuid;
  v_expires_at timestamptz := now() + interval '10 minutes';
  v_attempt integer := 0;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_width integer;
  v_height integer;
  v_label text;
begin
  if p_device_id is null or coalesce(length(p_device_secret), 0) < 32 then
    raise exception 'invalid_device_credentials';
  end if;

  v_secret_hash := encode(digest(p_device_secret, 'sha256'), 'hex');
  v_width := greatest(320, least(coalesce(p_screen_width, 1920), 16384));
  v_height := greatest(320, least(coalesce(p_screen_height, 1080), 16384));
  v_label := left(coalesce(nullif(trim(p_device_label), ''), 'DisplayHub Android'), 160);

  select * into v_existing from public.player_devices where id = p_device_id;
  if found and v_existing.secret_hash <> v_secret_hash then
    raise exception 'invalid_device_credentials';
  end if;

  insert into public.player_devices(
    id, company_id, secret_hash, hostname, app_version, platform, os_release,
    monitor_count, monitors, mappings, kiosk_mode, auto_start, last_seen_at, updated_at
  ) values (
    p_device_id,
    null,
    v_secret_hash,
    v_label,
    'android-pairing-1',
    'android',
    null,
    1,
    jsonb_build_array(jsonb_build_object('id', 'browser', 'width', v_width, 'height', v_height, 'primary', true)),
    '[]'::jsonb,
    true,
    false,
    now(),
    now()
  )
  on conflict (id) do update
  set hostname = excluded.hostname,
      app_version = excluded.app_version,
      platform = 'android',
      monitor_count = 1,
      monitors = excluded.monitors,
      last_seen_at = now(),
      updated_at = now();

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
        v_label,
        jsonb_build_array(jsonb_build_object('id', 'browser', 'width', v_width, 'height', v_height, 'primary', true)),
        v_expires_at
      ) returning id into v_pairing_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 20 then raise exception 'pairing_code_generation_failed'; end if;
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'pairing_id', v_pairing_id,
    'code', v_code,
    'expires_at', v_expires_at,
    'device_id', p_device_id
  );
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
  v_device_platform text;
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

  select platform into v_device_platform
  from public.player_devices
  where id = v_request.device_id;

  if v_device_platform = 'android' then
    update public.player_devices
    set company_id = v_company_id,
        mappings = jsonb_build_array(
          jsonb_build_object(
            'physical_display_id', 'browser',
            'display_id', (v_safe_mappings->0->>'display_id')::uuid
          )
        ),
        last_seen_at = now(),
        updated_at = now()
    where id = v_request.device_id;
  end if;

  return jsonb_build_object('ok', true, 'pairing_id', v_request.id, 'device_id', v_request.device_id);
end;
$$;

revoke all on function public.create_android_player_pairing(uuid,text,text,integer,integer) from public;
grant execute on function public.create_android_player_pairing(uuid,text,text,integer,integer) to anon, authenticated;
