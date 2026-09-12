alter table public.playlist_items
  add column if not exists duration_mode text not null default 'fixed';

alter table public.playlist_items
  drop constraint if exists playlist_items_duration_mode_check;

alter table public.playlist_items
  add constraint playlist_items_duration_mode_check
  check (duration_mode in ('fixed', 'media'));

grant insert (duration_mode) on public.playlist_items to authenticated;
grant update (duration_mode) on public.playlist_items to authenticated;
