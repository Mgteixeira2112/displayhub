update public.player_devices pd
set mappings = '[]'::jsonb,
    hostname = case
      when pd.hostname like 'Nova tela - Android %' then replace(pd.hostname, 'Nova tela - Android ', 'Android ')
      when pd.hostname like 'Nova tela - iOS %' then replace(pd.hostname, 'Nova tela - iOS ', 'iOS ')
      when pd.hostname like 'Nova tela - Windows %' then replace(pd.hostname, 'Nova tela - Windows ', 'Windows Web ')
      when pd.hostname like 'Nova tela - Web %' then replace(pd.hostname, 'Nova tela - Web ', 'Dispositivo Web ')
      else pd.hostname
    end,
    updated_at = now()
where pd.id in (
  select r.device_id
  from public.device_installation_requests r
  join public.displays d on d.id = r.display_id
  where r.device_id is not null
    and d.location = 'Configuração pendente'
);

update public.displays d
set is_active = false,
    revoked_at = coalesce(revoked_at, now()),
    updated_at = now()
where d.id in (
  select r.display_id
  from public.device_installation_requests r
  where r.display_id is not null
)
and d.location = 'Configuração pendente';

update public.device_installation_requests r
set display_id = null,
    updated_at = now()
where r.display_id in (
  select d.id
  from public.displays d
  where d.location = 'Configuração pendente'
    and d.is_active = false
);
