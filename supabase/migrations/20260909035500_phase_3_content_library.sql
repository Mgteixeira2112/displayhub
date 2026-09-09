create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null check (type in ('image', 'youtube')),
  title text not null check (char_length(trim(title)) between 2 and 160),
  category text check (category is null or char_length(trim(category)) between 1 and 80),
  storage_path text,
  mime_type text,
  file_size bigint check (file_size is null or file_size > 0),
  provider text,
  external_url text,
  external_id text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_items_shape_check check (
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
  )
);

create unique index content_items_storage_path_uidx
  on public.content_items(storage_path)
  where storage_path is not null;

create unique index content_items_youtube_uidx
  on public.content_items(company_id, provider, external_id)
  where type = 'youtube';

create index content_items_company_created_idx
  on public.content_items(company_id, created_at desc);

create index content_items_created_by_idx
  on public.content_items(created_by);

create trigger content_items_set_updated_at
before update on public.content_items
for each row execute function private.set_updated_at();

alter table public.content_items enable row level security;

create policy content_items_select_own_company
on public.content_items
for select
to authenticated
using (company_id = private.current_company_id());

create policy content_items_insert_manager
on public.content_items
for insert
to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

create policy content_items_update_manager
on public.content_items
for update
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
)
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

create policy content_items_delete_manager
on public.content_items
for delete
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

revoke all on public.content_items from anon, authenticated;
grant select, delete on public.content_items to authenticated;
grant insert (company_id, type, title, category, storage_path, mime_type, file_size, provider, external_url, external_id, is_active) on public.content_items to authenticated;
grant update (title, category, is_active) on public.content_items to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-library',
  'content-library',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy content_library_select_own_company
on storage.objects
for select
to authenticated
using (
  bucket_id = 'content-library'
  and (storage.foldername(name))[1] = private.current_company_id()::text
);

create policy content_library_insert_manager
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'content-library'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and private.current_user_role() in ('admin', 'manager')
);

create policy content_library_update_manager
on storage.objects
for update
to authenticated
using (
  bucket_id = 'content-library'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and private.current_user_role() in ('admin', 'manager')
)
with check (
  bucket_id = 'content-library'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and private.current_user_role() in ('admin', 'manager')
);

create policy content_library_delete_manager
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'content-library'
  and (storage.foldername(name))[1] = private.current_company_id()::text
  and private.current_user_role() in ('admin', 'manager')
);