alter table public.content_items drop constraint if exists content_items_type_check;
alter table public.content_items drop constraint if exists content_items_shape_check;

alter table public.content_items
  add constraint content_items_type_check
  check (type in ('image', 'youtube', 'hls'));

alter table public.content_items
  add constraint content_items_shape_check check (
    (
      type = 'image'
      and storage_path is not null
      and mime_type in ('image/jpeg', 'image/png', 'image/webp')
      and file_size is not null
      and provider is null
      and external_url is null
      and external_id is null
    )
    or
    (
      type = 'youtube'
      and storage_path is null
      and mime_type is null
      and file_size is null
      and provider = 'youtube'
      and external_url is not null
      and external_id is not null
    )
    or
    (
      type = 'hls'
      and storage_path is null
      and mime_type is null
      and file_size is null
      and provider = 'hls'
      and external_url is not null
      and external_id is null
    )
  );

create unique index if not exists content_items_hls_url_uidx
  on public.content_items(company_id, provider, external_url)
  where type = 'hls';
