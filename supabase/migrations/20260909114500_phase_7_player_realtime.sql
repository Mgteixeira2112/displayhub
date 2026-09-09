create or replace function private.broadcast_display_program_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_playlist_id uuid;
  v_display_id uuid;
  v_token text;
  v_pub record;
begin
  if tg_table_name = 'display_publications' then
    v_display_id := coalesce(new.display_id, old.display_id);
    select d.public_token into v_token from public.displays d where d.id = v_display_id;
    if v_token is not null then
      perform realtime.send(jsonb_build_object('changed', true), 'display_program_changed', 'display:' || v_token, false);
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'playlist_items' then
    v_playlist_id := coalesce(new.playlist_id, old.playlist_id);
    for v_pub in
      select distinct d.public_token
      from public.display_publications dp
      join public.displays d on d.id = dp.display_id
      where dp.playlist_id = v_playlist_id and dp.is_active = true and d.is_active = true and d.revoked_at is null
    loop
      perform realtime.send(jsonb_build_object('changed', true), 'display_program_changed', 'display:' || v_pub.public_token, false);
    end loop;
    return coalesce(new, old);
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.broadcast_display_program_changed() from public, anon, authenticated;

drop trigger if exists display_publications_broadcast_program on public.display_publications;
create trigger display_publications_broadcast_program
after insert or update or delete on public.display_publications
for each row execute function private.broadcast_display_program_changed();

drop trigger if exists playlist_items_broadcast_program on public.playlist_items;
create trigger playlist_items_broadcast_program
after insert or update or delete on public.playlist_items
for each row execute function private.broadcast_display_program_changed();
