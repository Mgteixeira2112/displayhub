create or replace function private.broadcast_display_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.revoked_at is not null or new.is_active = false)
    and (old.revoked_at is null and old.is_active = true) then
    perform realtime.send(
      jsonb_build_object('invalid', true),
      'display_invalidated',
      'display:' || new.public_token,
      false
    );
  end if;

  return null;
end;
$$;

create trigger displays_broadcast_invalidation
after update of revoked_at, is_active on public.displays
for each row
execute function private.broadcast_display_invalidation();
