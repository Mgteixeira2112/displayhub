create table if not exists public.player_devices (
  id uuid primary key,
  company_id uuid references public.companies(id) on delete set null,
  secret_hash text not null,
  hostname text,
  app_version text not null,
  platform text not null default 'windows',
  os_release text,
  monitor_count integer not null default 0,
  monitors jsonb not null default '[]'::jsonb,
  mappings jsonb not null default '[]'::jsonb,
  kiosk_mode boolean not null default true,
  auto_start boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_devices_company_id_idx on public.player_devices(company_id);
create index if not exists player_devices_last_seen_at_idx on public.player_devices(last_seen_at desc);

alter table public.player_devices enable row level security;
revoke all on table public.player_devices from anon, authenticated;

create or replace function public.heartbeat_windows_player(
  p_device_id uuid,
  p_device_secret text,
  p_hostname text,
  p_app_version text,
  p_os_release text,
  p_monitors jsonb,
  p_mappings jsonb,
  p_kiosk_mode boolean,
  p_auto_start boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret_hash text;
  v_existing_hash text;
  v_safe_mappings jsonb := '[]'::jsonb;
  v_company_id uuid;
  v_company_count integer := 0;
  v_resolved_count integer := 0;
  v_mapping jsonb;
  v_token text;
  v_display_id uuid;
  v_display_company_id uuid;
begin
  if p_device_id is null or coalesce(length(p_device_secret), 0) < 32 then
    raise exception 'invalid_device_credentials';
  end if;

  v_secret_hash := encode(digest(p_device_secret, 'sha256'), 'hex');
  select secret_hash into v_existing_hash from public.player_devices where id = p_device_id;

  if v_existing_hash is not null and v_existing_hash <> v_secret_hash then
    raise exception 'invalid_device_credentials';
  end if;

  if jsonb_typeof(coalesce(p_mappings, '[]'::jsonb)) = 'array' then
    for v_mapping in select value from jsonb_array_elements(coalesce(p_mappings, '[]'::jsonb))
    loop
      v_token := nullif(v_mapping->>'public_token', '');
      v_display_id := null;
      v_display_company_id := null;

      if v_token is not null then
        select d.id, d.company_id
          into v_display_id, v_display_company_id
        from public.displays d
        where d.public_token = v_token
          and d.is_active = true
          and d.revoked_at is null
        limit 1;
      end if;

      if v_display_id is not null then
        v_resolved_count := v_resolved_count + 1;
        v_safe_mappings := v_safe_mappings || jsonb_build_array(
          jsonb_build_object(
            'physical_display_id', coalesce(v_mapping->>'physical_display_id', ''),
            'display_id', v_display_id
          )
        );

        if v_company_id is null then
          v_company_id := v_display_company_id;
          v_company_count := 1;
        elsif v_company_id <> v_display_company_id then
          v_company_count := v_company_count + 1;
        end if;
      end if;
    end loop;
  end if;

  if v_company_count > 1 then
    v_company_id := null;
  end if;

  insert into public.player_devices (
    id,
    company_id,
    secret_hash,
    hostname,
    app_version,
    platform,
    os_release,
    monitor_count,
    monitors,
    mappings,
    kiosk_mode,
    auto_start,
    last_seen_at,
    updated_at
  )
  values (
    p_device_id,
    v_company_id,
    v_secret_hash,
    nullif(left(coalesce(p_hostname, ''), 160), ''),
    left(coalesce(p_app_version, 'unknown'), 32),
    'windows',
    nullif(left(coalesce(p_os_release, ''), 120), ''),
    case when jsonb_typeof(coalesce(p_monitors, '[]'::jsonb)) = 'array' then jsonb_array_length(coalesce(p_monitors, '[]'::jsonb)) else 0 end,
    case when jsonb_typeof(coalesce(p_monitors, '[]'::jsonb)) = 'array' then coalesce(p_monitors, '[]'::jsonb) else '[]'::jsonb end,
    v_safe_mappings,
    coalesce(p_kiosk_mode, true),
    coalesce(p_auto_start, true),
    now(),
    now()
  )
  on conflict (id) do update set
    company_id = excluded.company_id,
    hostname = excluded.hostname,
    app_version = excluded.app_version,
    os_release = excluded.os_release,
    monitor_count = excluded.monitor_count,
    monitors = excluded.monitors,
    mappings = excluded.mappings,
    kiosk_mode = excluded.kiosk_mode,
    auto_start = excluded.auto_start,
    last_seen_at = now(),
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'device_id', p_device_id,
    'resolved_displays', v_resolved_count,
    'last_seen_at', now()
  );
end;
$$;

revoke all on function public.heartbeat_windows_player(uuid, text, text, text, text, jsonb, jsonb, boolean, boolean) from public;
grant execute on function public.heartbeat_windows_player(uuid, text, text, text, text, jsonb, jsonb, boolean, boolean) to anon, authenticated;
