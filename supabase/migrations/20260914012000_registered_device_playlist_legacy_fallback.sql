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
  v_display_id uuid;
  v_display public.displays%rowtype;
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

  if v_playlist_id is not null and v_player_token is not null and v_player_token ~ '^[a-f0-9]{64}$' then
    select * into v_playlist
    from public.playlists
    where id = v_playlist_id
      and company_id = v_device.company_id
      and is_active = true;

    if found then
      return jsonb_build_object(
        'ok', true,
        'status', 'assigned',
        'assignment_type', 'playlist',
        'device_id', p_device_id,
        'playlist_id', v_playlist.id,
        'playlist_name', v_playlist.name,
        'player_url', 'https://mgteixeira2112.github.io/displayhub/?p=display%2F' || v_player_token
      );
    end if;
  end if;

  select nullif(mapping->>'display_id', '')::uuid
  into v_display_id
  from jsonb_array_elements(coalesce(v_device.mappings, '[]'::jsonb)) mapping
  where mapping->>'physical_display_id' = 'browser'
  limit 1;

  if v_display_id is not null then
    select * into v_display
    from public.displays
    where id = v_display_id
      and company_id = v_device.company_id
      and is_active = true
      and revoked_at is null;

    if found then
      return jsonb_build_object(
        'ok', true,
        'status', 'assigned',
        'assignment_type', 'legacy_display',
        'device_id', p_device_id,
        'display_id', v_display.id,
        'display_name', v_display.name,
        'player_url', 'https://mgteixeira2112.github.io/displayhub/?p=display%2F' || v_display.public_token
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'waiting',
    'device_id', p_device_id
  );
end;
$$;

revoke all on function public.poll_registered_device_assignment(uuid,text) from public;
grant execute on function public.poll_registered_device_assignment(uuid,text) to anon, authenticated;
