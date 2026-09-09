alter table public.display_groups
  add column if not exists media_fit text not null default 'cover';

alter table public.display_groups
  drop constraint if exists display_groups_media_fit_check;

alter table public.display_groups
  add constraint display_groups_media_fit_check
  check (media_fit in ('contain', 'cover', 'native'));

comment on column public.display_groups.media_fit is
  'Video Wall media fitting: contain preserves the whole source, cover fills the wall with cropping, native uses the virtual wall surface directly for wall-prepared content.';
