create or replace function private.touch_display_group_on_prepare()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status = 'preparing' and (tg_op = 'INSERT' or old.status is distinct from new.status or old.sequence is distinct from new.sequence) then
    update public.display_groups
      set updated_at = now()
      where id = new.group_id;
  end if;
  return new;
end;
$$;

drop trigger if exists display_group_launches_activate_group on public.display_group_launches;
create trigger display_group_launches_activate_group
after insert or update of status, sequence on public.display_group_launches
for each row
execute function private.touch_display_group_on_prepare();
