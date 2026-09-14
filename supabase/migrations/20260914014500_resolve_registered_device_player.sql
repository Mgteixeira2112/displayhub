create or replace function public.resolve_registered_device_player(
  p_player_token text
)
returns table (
  id uuid,
  company_id uuid,
  hostname text,
  platform text,
  monitors jsonb,
  mappings jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player_token is null or p_player_token !~ '^[a-f0-9]{64}$' then
    return;
  end if;

  return query
  select
    pd.id,
    pd.company_id,
    pd.hostname,
    pd.platform,
    pd.monitors,
    pd.mappings,
    pd.updated_at
  from public.player_devices pd
  where pd.platform <> 'windows'
    and exists (
      select 1
      from jsonb_array_elements(coalesce(pd.mappings, '[]'::jsonb)) mapping
      where mapping->>'physical_display_id' = 'browser'
        and mapping->>'player_token' = p_player_token
        and nullif(mapping->>'playlist_id', '') is not null
    )
  limit 1;
end;
$$;

revoke all on function public.resolve_registered_device_player(text) from public;
revoke all on function public.resolve_registered_device_player(text) from anon, authenticated;
grant execute on function public.resolve_registered_device_player(text) to service_role;
