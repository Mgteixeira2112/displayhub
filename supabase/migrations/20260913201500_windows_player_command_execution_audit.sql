alter table public.player_device_commands
  add column if not exists executor_device_id uuid references public.player_devices(id) on delete set null,
  add column if not exists executor_hostname text;

create or replace function public.poll_windows_player_command(
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
  v_command public.player_device_commands%rowtype;
begin
  if p_device_id is null or coalesce(length(p_device_secret), 0) < 32 then
    raise exception 'invalid_device_credentials';
  end if;

  v_secret_hash := encode(digest(p_device_secret, 'sha256'), 'hex');

  if not exists (
    select 1
    from public.player_devices d
    where d.id = p_device_id
      and d.secret_hash = v_secret_hash
  ) then
    raise exception 'invalid_device_credentials';
  end if;

  update public.player_device_commands
  set status = 'expired', completed_at = now(), result = 'expired_before_claim'
  where device_id = p_device_id
    and status = 'queued'
    and expires_at <= now();

  select c.*
    into v_command
  from public.player_device_commands c
  where c.device_id = p_device_id
    and c.status = 'queued'
    and c.expires_at > now()
  order by c.created_at
  for update skip locked
  limit 1;

  if v_command.id is null then
    return null;
  end if;

  update public.player_device_commands
  set status = 'claimed', claimed_at = now()
  where id = v_command.id
    and device_id = p_device_id;

  return jsonb_build_object(
    'id', v_command.id,
    'device_id', v_command.device_id,
    'command', v_command.command,
    'created_at', v_command.created_at
  );
end;
$$;

revoke all on function public.poll_windows_player_command(uuid, text) from public;
grant execute on function public.poll_windows_player_command(uuid, text) to anon, authenticated;

create or replace function public.complete_windows_player_command(
  p_device_id uuid,
  p_device_secret text,
  p_command_id uuid,
  p_success boolean,
  p_result text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret_hash text;
  v_updated integer;
  v_hostname text;
begin
  if p_device_id is null or coalesce(length(p_device_secret), 0) < 32 then
    raise exception 'invalid_device_credentials';
  end if;

  v_secret_hash := encode(digest(p_device_secret, 'sha256'), 'hex');

  select d.hostname
    into v_hostname
  from public.player_devices d
  where d.id = p_device_id
    and d.secret_hash = v_secret_hash;

  if not found then
    raise exception 'invalid_device_credentials';
  end if;

  update public.player_device_commands
  set status = case when coalesce(p_success, false) then 'completed' else 'failed' end,
      completed_at = now(),
      result = left(coalesce(p_result, ''), 500),
      executor_device_id = p_device_id,
      executor_hostname = v_hostname
  where id = p_command_id
    and device_id = p_device_id
    and status = 'claimed';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.complete_windows_player_command(uuid, text, uuid, boolean, text) from public;
grant execute on function public.complete_windows_player_command(uuid, text, uuid, boolean, text) to anon, authenticated;
