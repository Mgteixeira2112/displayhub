create index display_events_actor_id_idx on public.display_events(actor_id) where actor_id is not null;
create index display_events_playlist_item_company_idx on public.display_events(playlist_item_id, company_id) where playlist_item_id is not null;
