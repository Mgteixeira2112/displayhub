alter table public.playlists
  add column if not exists transition_type text not null default 'fade',
  add column if not exists transition_duration_ms integer not null default 600;

alter table public.playlists
  drop constraint if exists playlists_transition_type_check;

alter table public.playlists
  add constraint playlists_transition_type_check
  check (transition_type = any (array['none'::text, 'fade'::text, 'slide_left'::text, 'slide_up'::text, 'zoom'::text]));

alter table public.playlists
  drop constraint if exists playlists_transition_duration_ms_check;

alter table public.playlists
  add constraint playlists_transition_duration_ms_check
  check (transition_duration_ms between 0 and 2000);

grant update (transition_type, transition_duration_ms) on public.playlists to authenticated;
