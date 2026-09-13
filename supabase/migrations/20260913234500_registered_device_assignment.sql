create or replace function public.assign_registered_device_display(
  p_device_id uuid,
  p_display_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_company_id uuid := private.current_company_id();
  v_role text := private.current_user_role();
  v_device public.player_devices%rowtype;
  v_display public.displays%rowtype;
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

  select * into v_display
  from public.displays
  where id = p_display_id
    and company_id = v_company_id
    and is_active = true
    and revoked_at is null;

  if not found then raise exception 'display_not_found'; end if;

  update public.player_devices
  set mappings = jsonb_build_array(
        jsonb_build_object(
          'physical_display_id', 'browser',
          'display_id', v_display.id
        )
      ),
      updated_at = now()
  where id = v_device.id;

  return jsonb_build_object(
    'ok', true,
    'device_id', v_device.id,
    'display_id', v_display.id,
    'display_name', v_display.name
  );
end;
$$;

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

  select (mapping->>'display_id')::uuid into v_display_id
  from jsonb_array_elements(coalesce(v_device.mappings, '[]'::jsonb)) mapping
  where mapping->>'physical_display_id' = 'browser'
  limit 1;

  if v_display_id is null then
    return jsonb_build_object(
      'ok', true,
      'status', 'waiting',
      'device_id', p_device_id
    );
  end if;

  select * into v_display
  from public.displays
  where id = v_display_id
    and company_id = v_device.company_id
    and is_active = true
    and revoked_at is null;

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
    'device_id', p_device_id,
    'display_id', v_display.id,
    'display_name', v_display.name,
    'display_url', 'https://mgteixeira2112.github.io/displayhub/display/' || v_display.public_token
  );
end;
$$;

revoke all on function public.assign_registered_device_display(uuid,uuid) from public;
revoke all on function public.poll_registered_device_assignment(uuid,text) from public;
grant execute on function public.assign_registered_device_display(uuid,uuid) to authenticated;
grant execute on function public.poll_registered_device_assignment(uuid,text) to anon, authenticated;
