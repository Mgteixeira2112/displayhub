-- Garante um token de recuperação estável por dispositivo genérico.
update public.player_devices pd
set mappings = case
  when exists (
    select 1
    from jsonb_array_elements(coalesce(pd.mappings, '[]'::jsonb)) item
    where item->>'physical_display_id' = 'browser'
  ) then (
    select jsonb_agg(
      case
        when item->>'physical_display_id' = 'browser' then
          item || jsonb_build_object(
            'recovery_token', coalesce(nullif(item->>'recovery_token', ''), encode(gen_random_bytes(32), 'hex'))
          )
        else item
      end
    )
    from jsonb_array_elements(coalesce(pd.mappings, '[]'::jsonb)) item
  )
  else coalesce(pd.mappings, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'physical_display_id', 'browser',
      'recovery_token', encode(gen_random_bytes(32), 'hex')
    )
  )
end,
updated_at = now()
where pd.platform <> 'windows';

create or replace function public.assign_registered_device_playlist(
  p_device_id uuid,
  p_playlist_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_company_id uuid := private.current_company_id();
  v_role text := private.current_user_role();
  v_device public.player_devices%rowtype;
  v_playlist public.playlists%rowtype;
  v_player_token text;
  v_recovery_token text;
begin
  if auth.uid() is null or v_company_id is null or v_role not in ('admin','manager') then
    raise exception 'forbidden';
  end if;

  select * into v_device
  from public.player_devices
  where id = p_device_id
    and company_id = v_company_id;

  if not found then raise exception 'device_not_found'; end if;
  if v_device.platform = 'windows' then raise exception 'windows_device_not_supported'; end if;

  select * into v_playlist
  from public.playlists
  where id = p_playlist_id
    and company_id = v_company_id
    and is_active = true;

  if not found then raise exception 'playlist_not_found'; end if;

  select mapping->>'player_token', mapping->>'recovery_token'
  into v_player_token, v_recovery_token
  from jsonb_array_elements(coalesce(v_device.mappings, '[]'::jsonb)) mapping
  where mapping->>'physical_display_id' = 'browser'
  limit 1;

  if v_player_token is null or v_player_token !~ '^[a-f0-9]{64}$' then
    v_player_token := encode(gen_random_bytes(32), 'hex');
  end if;

  if v_recovery_token is null or v_recovery_token !~ '^[a-f0-9]{64}$' then
    v_recovery_token := encode(gen_random_bytes(32), 'hex');
  end if;

  update public.player_devices
  set mappings = jsonb_build_array(
        jsonb_build_object(
          'physical_display_id', 'browser',
          'playlist_id', v_playlist.id,
          'player_token', v_player_token,
          'recovery_token', v_recovery_token
        )
      ),
      updated_at = now()
  where id = v_device.id;

  return jsonb_build_object(
    'ok', true,
    'device_id', v_device.id,
    'playlist_id', v_playlist.id,
    'playlist_name', v_playlist.name,
    'player_token', v_player_token
  );
end;
$$;

-- Sem fallback para display antigo: dispositivo genérico só reproduz playlist associada.
create or replace function public.poll_registered_device_assignment(
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
  v_device public.player_devices%rowtype;
  v_playlist_id uuid;
  v_player_token text;
  v_playlist public.playlists%rowtype;
begin
  if p_device_id is null or coalesce(length(p_device_secret), 0) < 32 then
    raise exception 'invalid_device_credentials';
  end if;

  v_secret_hash := encode(digest(p_device_secret, 'sha256'), 'hex');

  select * into v_device
  from public.player_devices
  where id = p_device_id;

  if not found or v_device.secret_hash <> v_secret_hash then
    raise exception 'invalid_device_credentials';
  end if;

  update public.player_devices
  set last_seen_at = now(), updated_at = now()
  where id = p_device_id;

  select nullif(mapping->>'playlist_id', '')::uuid, mapping->>'player_token'
  into v_playlist_id, v_player_token
  from jsonb_array_elements(coalesce(v_device.mappings, '[]'::jsonb)) mapping
  where mapping->>'physical_display_id' = 'browser'
  limit 1;

  if v_playlist_id is null or v_player_token is null or v_player_token !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object(
      'ok', true,
      'status', 'waiting',
      'device_id', p_device_id
    );
  end if;

  select * into v_playlist
  from public.playlists
  where id = v_playlist_id
    and company_id = v_device.company_id
    and is_active = true;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'status', 'waiting',
      'device_id', p_device_id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'assigned',
    'assignment_type', 'playlist',
    'device_id', p_device_id,
    'playlist_id', v_playlist.id,
    'playlist_name', v_playlist.name,
    'player_url', 'https://mgteixeira2112.github.io/displayhub/?p=display%2F' || v_player_token
  );
end;
$$;

create or replace function public.recover_registered_device_identity(
  p_device_id uuid,
  p_recovery_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device public.player_devices%rowtype;
  v_saved_recovery_token text;
  v_new_device_secret text;
begin
  if p_device_id is null or p_recovery_token is null or p_recovery_token !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_recovery_credentials';
  end if;

  select * into v_device
  from public.player_devices
  where id = p_device_id
    and platform <> 'windows';

  if not found then raise exception 'device_not_found'; end if;

  select mapping->>'recovery_token'
  into v_saved_recovery_token
  from jsonb_array_elements(coalesce(v_device.mappings, '[]'::jsonb)) mapping
  where mapping->>'physical_display_id' = 'browser'
  limit 1;

  if v_saved_recovery_token is null or v_saved_recovery_token <> lower(p_recovery_token) then
    raise exception 'invalid_recovery_credentials';
  end if;

  v_new_device_secret := encode(gen_random_bytes(32), 'hex');

  update public.player_devices
  set secret_hash = encode(digest(v_new_device_secret, 'sha256'), 'hex'),
      last_seen_at = now(),
      updated_at = now()
  where id = p_device_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'recovered',
    'device_id', p_device_id,
    'device_secret', v_new_device_secret
  );
end;
$$;

-- Novos dispositivos já nascem com QR de recuperação próprio.
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
  v_platform text;
  v_width integer;
  v_height integer;
  v_device_label text;
  v_recovery_token text := encode(gen_random_bytes(32), 'hex');
  v_registered_url constant text := 'https://mgteixeira2112.github.io/displayhub/device-registered.html';
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
    if v_request.device_id = p_device_id then
      select * into v_existing from public.player_devices where id = p_device_id;
      return jsonb_build_object(
        'ok', true,
        'status', 'registered',
        'device_id', p_device_id,
        'device_label', v_existing.hostname,
        'display_name', 'Dispositivo registrado',
        'platform', v_existing.platform,
        'display_url', v_registered_url
      );
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

    select mapping->>'recovery_token'
    into v_recovery_token
    from jsonb_array_elements(coalesce(v_existing.mappings, '[]'::jsonb)) mapping
    where mapping->>'physical_display_id' = 'browser'
    limit 1;

    if v_recovery_token is null or v_recovery_token !~ '^[a-f0-9]{64}$' then
      v_recovery_token := encode(gen_random_bytes(32), 'hex');
    end if;
  end if;

  v_platform := lower(regexp_replace(coalesce(nullif(trim(p_platform), ''), 'web'), '[^a-z0-9_-]', '', 'g'));
  if v_platform = '' then v_platform := 'web'; end if;
  v_platform := left(v_platform, 40);
  v_width := greatest(320, least(coalesce(p_screen_width, 1920), 16384));
  v_height := greatest(320, least(coalesce(p_screen_height, 1080), 16384));
  v_device_label := left(coalesce(nullif(trim(p_device_label), ''), 'Dispositivo ' || upper(substr(replace(p_device_id::text, '-', ''), 1, 6))), 160);

  insert into public.player_devices(
    id, company_id, secret_hash, hostname, app_version, platform, os_release,
    monitor_count, monitors, mappings, kiosk_mode, auto_start, last_seen_at, updated_at
  ) values (
    p_device_id,
    v_request.company_id,
    v_secret_hash,
    v_device_label,
    'web-activation-3',
    v_platform,
    null,
    1,
    jsonb_build_array(jsonb_build_object('id', 'browser', 'width', v_width, 'height', v_height, 'primary', true)),
    jsonb_build_array(jsonb_build_object('physical_display_id', 'browser', 'recovery_token', v_recovery_token)),
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
      mappings = case
        when public.player_devices.platform = 'windows' then public.player_devices.mappings
        when jsonb_array_length(coalesce(public.player_devices.mappings, '[]'::jsonb)) > 0 then public.player_devices.mappings
        else excluded.mappings
      end,
      last_seen_at = now(),
      updated_at = now();

  update public.device_installation_requests
  set status = 'consumed',
      consumed_at = now(),
      device_id = p_device_id,
      display_id = null,
      updated_at = now()
  where id = v_request.id and status = 'pending';

  return jsonb_build_object(
    'ok', true,
    'status', 'registered',
    'device_id', p_device_id,
    'device_label', v_device_label,
    'display_name', 'Dispositivo registrado',
    'platform', v_platform,
    'display_url', v_registered_url
  );
end;
$$;

revoke all on function public.assign_registered_device_playlist(uuid,uuid) from public;
revoke all on function public.poll_registered_device_assignment(uuid,text) from public;
revoke all on function public.recover_registered_device_identity(uuid,text) from public;
revoke all on function public.activate_device_installation(text,uuid,text,text,text,integer,integer) from public;

grant execute on function public.assign_registered_device_playlist(uuid,uuid) to authenticated;
grant execute on function public.poll_registered_device_assignment(uuid,text) to anon, authenticated;
grant execute on function public.recover_registered_device_identity(uuid,text) to anon, authenticated;
grant execute on function public.activate_device_installation(text,uuid,text,text,text,integer,integer) to anon, authenticated;
