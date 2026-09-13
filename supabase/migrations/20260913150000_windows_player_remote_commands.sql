create table if not exists public.player_device_commands (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  device_id uuid not null references public.player_devices(id) on delete cascade,
  command text not null check (command in ('reload_displays', 'restart_player', 'enter_kiosk', 'exit_kiosk', 'reboot_device')),
  status text not null default 'queued' check (status in ('queued', 'claimed', 'completed', 'failed', 'expired')),
  result text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index if not exists player_device_commands_device_status_idx
  on public.player_device_commands(device_id, status, created_at);
create index if not exists player_device_commands_company_created_idx
  on public.player_device_commands(company_id, created_at desc);

alter table public.player_device_commands enable row level security;

create policy player_devices_select_own_company
on public.player_devices
for select
to authenticated
using (company_id = private.current_company_id());

create policy player_device_commands_select_own_company
on public.player_device_commands
for select
to authenticated
using (company_id = private.current_company_id());

revoke all on public.player_devices, public.player_device_commands from anon, authenticated;
grant select on public.player_devices to authenticated;
grant select on public.player_device_commands to authenticated;

create or replace function public.queue_windows_player_command(
  p_device_id uuid,
  p_command text
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_company_id uuid;
  v_role text;
  v_command_id uuid;
begin
  v_company_id := private.current_company_id();
  v_role := private.current_user_role();

  if v_company_id is null or v_role not in ('admin', 'manager') then
    raise exception 'not_authorized';
  end if;

  if p_command not in ('reload_displays', 'restart_player', 'enter_kiosk', 'exit_kiosk', 'reboot_device') then
    raise exception 'invalid_command';
  end if;

  if not exists (
    select 1
    from public.player_devices d
    where d.id = p_device_id
      and d.company_id = v_company_id
  ) then
    raise exception 'device_not_found';
  end if;

  insert into public.player_device_commands (company_id, device_id, command, created_by)
  values (v_company_id, p_device_id, p_command, auth.uid())
  returning id into v_command_id;

  return v_command_id;
end;
$$;

revoke all on function public.queue_windows_player_command(uuid, text) from public;
grant execute on function public.queue_windows_player_command(uuid, text) to authenticated;

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
  where id = v_command.id;

  return jsonb_build_object(
    'id', v_command.id,
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
  set status = case when coalesce(p_success, false) then 'completed' else 'failed' end,
      completed_at = now(),
      result = left(coalesce(p_result, ''), 500)
  where id = p_command_id
    and device_id = p_device_id
    and status = 'claimed';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.complete_windows_player_command(uuid, text, uuid, boolean, text) from public;
grant execute on function public.complete_windows_player_command(uuid, text, uuid, boolean, text) to anon, authenticated;
