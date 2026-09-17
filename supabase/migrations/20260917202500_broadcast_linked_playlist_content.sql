-- Existing display_program_changed only covered publication and playlist-item changes.
-- Keep an active standalone display current when a referenced item's data changes,
-- so recovery polling can be reduced without delaying poster/content edits.
create or replace function private.broadcast_linked_playlist_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := array[]::uuid[];
  v_template_keys text[] := array[]::text[];
  v_token text;
begin
  if tg_table_name = 'promotion_templates' then
    if tg_op <> 'INSERT' then v_template_keys := array_append(v_template_keys, old.key); end if;
    if tg_op <> 'DELETE' then v_template_keys := array_append(v_template_keys, new.key); end if;
  elsif tg_table_name = 'structured_content_rows' then
    if tg_op <> 'INSERT' then v_ids := array_append(v_ids, old.content_id); end if;
    if tg_op <> 'DELETE' then v_ids := array_append(v_ids, new.content_id); end if;
  else
    if tg_op <> 'INSERT' then v_ids := array_append(v_ids, old.id); end if;
    if tg_op <> 'DELETE' then v_ids := array_append(v_ids, new.id); end if;
  end if;

  for v_token in
    select distinct d.public_token
    from public.playlist_items pi
    join public.display_publications dp on dp.playlist_id = pi.playlist_id
    join public.displays d on d.id = dp.display_id
    where dp.is_active = true
      and d.is_active = true
      and d.revoked_at is null
      and (
        (tg_table_name = 'playlists' and pi.playlist_id = any(v_ids))
        or (tg_table_name = 'promotion_posters' and pi.promotion_poster_id = any(v_ids))
        or (tg_table_name = 'content_items' and pi.content_item_id = any(v_ids))
        or (tg_table_name = 'structured_contents' and pi.structured_content_id = any(v_ids))
        or (tg_table_name = 'structured_content_rows' and pi.structured_content_id = any(v_ids))
        or (tg_table_name = 'smart_scenes' and pi.smart_scene_id = any(v_ids))
        or (tg_table_name = 'display_templates' and pi.template_id = any(v_ids))
        or (tg_table_name = 'promotion_templates' and exists (
          select 1 from public.promotion_posters poster
          where poster.id = pi.promotion_poster_id and poster.template_key = any(v_template_keys)
        ))
      )
  loop
    perform realtime.send(jsonb_build_object('changed', true), 'display_program_changed', 'display:' || v_token, false);
  end loop;

  return coalesce(new, old);
end;
$$;

revoke all on function private.broadcast_linked_playlist_content() from public, anon, authenticated;

drop trigger if exists playlists_broadcast_linked_content on public.playlists;
create trigger playlists_broadcast_linked_content
after insert or update or delete on public.playlists
for each row execute function private.broadcast_linked_playlist_content();

drop trigger if exists promotion_posters_broadcast_linked_content on public.promotion_posters;
create trigger promotion_posters_broadcast_linked_content
after insert or update or delete on public.promotion_posters
for each row execute function private.broadcast_linked_playlist_content();

drop trigger if exists promotion_templates_broadcast_linked_content on public.promotion_templates;
create trigger promotion_templates_broadcast_linked_content
after insert or update or delete on public.promotion_templates
for each row execute function private.broadcast_linked_playlist_content();

drop trigger if exists content_items_broadcast_linked_content on public.content_items;
create trigger content_items_broadcast_linked_content
after insert or update or delete on public.content_items
for each row execute function private.broadcast_linked_playlist_content();

drop trigger if exists structured_contents_broadcast_linked_content on public.structured_contents;
create trigger structured_contents_broadcast_linked_content
after insert or update or delete on public.structured_contents
for each row execute function private.broadcast_linked_playlist_content();

drop trigger if exists structured_content_rows_broadcast_linked_content on public.structured_content_rows;
create trigger structured_content_rows_broadcast_linked_content
after insert or update or delete on public.structured_content_rows
for each row execute function private.broadcast_linked_playlist_content();

drop trigger if exists smart_scenes_broadcast_linked_content on public.smart_scenes;
create trigger smart_scenes_broadcast_linked_content
after insert or update or delete on public.smart_scenes
for each row execute function private.broadcast_linked_playlist_content();

drop trigger if exists display_templates_broadcast_linked_content on public.display_templates;
create trigger display_templates_broadcast_linked_content
after insert or update or delete on public.display_templates
for each row execute function private.broadcast_linked_playlist_content();
