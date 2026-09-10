alter table public.playlist_items
  add column if not exists promotion_poster_id uuid;

alter table public.playlist_items
  drop constraint if exists playlist_items_source_shape;

alter table public.playlist_items
  drop constraint if exists playlist_items_source_type_check;

alter table public.playlist_items
  add constraint playlist_items_source_type_check
  check (source_type = any (array['content_item'::text, 'structured_content'::text, 'promotion_poster'::text]));

alter table public.playlist_items
  add constraint playlist_items_source_shape
  check (
    (source_type = 'content_item' and content_item_id is not null and structured_content_id is null and promotion_poster_id is null)
    or
    (source_type = 'structured_content' and structured_content_id is not null and content_item_id is null and promotion_poster_id is null)
    or
    (source_type = 'promotion_poster' and promotion_poster_id is not null and content_item_id is null and structured_content_id is null)
  );

alter table public.playlist_items
  drop constraint if exists playlist_items_promotion_poster_fk;

alter table public.playlist_items
  add constraint playlist_items_promotion_poster_fk
  foreign key (promotion_poster_id, company_id)
  references public.promotion_posters(id, company_id)
  on delete cascade;

create index if not exists playlist_items_promotion_poster_idx
  on public.playlist_items(promotion_poster_id)
  where promotion_poster_id is not null;
