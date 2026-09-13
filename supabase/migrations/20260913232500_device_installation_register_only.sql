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
    'web-activation-2',
    v_platform,
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
  set company_id = excluded.company_id,
      hostname = excluded.hostname,
      app_version = excluded.app_version,
      platform = excluded.platform,
      monitor_count = excluded.monitor_count,
      monitors = excluded.monitors,
      mappings = case when public.player_devices.platform = 'windows' then public.player_devices.mappings else '[]'::jsonb end,
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

revoke all on function public.activate_device_installation(text,uuid,text,text,text,integer,integer) from public;
grant execute on function public.activate_device_installation(text,uuid,text,text,text,integer,integer) to anon, authenticated;

-- Corrige somente as telas provisórias geradas pelo fluxo QR anterior.
update public.player_devices pd
set mappings = '[]'::jsonb, updated_at = now()
where pd.id in (
  select r.device_id
  from public.device_installation_requests r
  join public.displays d on d.id = r.display_id
  where r.device_id is not null
    and d.location = 'Configuração pendente'
);

update public.displays d
set is_active = false, revoked_at = coalesce(revoked_at, now()), updated_at = now()
where d.id in (
  select r.display_id
  from public.device_installation_requests r
  where r.display_id is not null
)
and d.location = 'Configuração pendente';

update public.device_installation_requests r
set display_id = null, updated_at = now()
where r.display_id in (
  select d.id from public.displays d
  where d.location = 'Configuração pendente' and d.is_active = false
);
