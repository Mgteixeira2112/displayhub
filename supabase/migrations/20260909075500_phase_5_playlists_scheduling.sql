alter table public.displays
  add constraint displays_id_company_unique unique (id, company_id);

alter table public.content_items
  add constraint content_items_id_company_unique unique (id, company_id);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);

create table public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  source_type text not null check (source_type in ('content_item', 'structured_content')),
  content_item_id uuid,
  structured_content_id uuid,
  position integer not null default 0 check (position >= 0),
  duration_seconds integer not null default 10 check (duration_seconds between 1 and 3600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint playlist_items_parent_fk
    foreign key (playlist_id, company_id)
    references public.playlists(id, company_id)
    on delete cascade,
  constraint playlist_items_content_fk
    foreign key (content_item_id, company_id)
    references public.content_items(id, company_id)
    on delete cascade,
  constraint playlist_items_structured_fk
    foreign key (structured_content_id, company_id)
    references public.structured_contents(id, company_id)
    on delete cascade,
  constraint playlist_items_source_shape check (
    (source_type = 'content_item' and content_item_id is not null and structured_content_id is null)
    or
    (source_type = 'structured_content' and structured_content_id is not null and content_item_id is null)
  )
);

create table public.display_publications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  display_id uuid not null,
  playlist_id uuid not null,
  starts_at timestamptz,
  ends_at timestamptz,
  repeat_mode text not null default 'always' check (repeat_mode in ('always', 'daily')),
  daily_start time,
  daily_end time,
  weekdays smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint display_publications_display_fk
    foreign key (display_id, company_id)
    references public.displays(id, company_id)
    on delete cascade,
  constraint display_publications_playlist_fk
    foreign key (playlist_id, company_id)
    references public.playlists(id, company_id)
    on delete cascade,
  constraint display_publications_window_check check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint display_publications_repeat_shape check (
    (repeat_mode = 'always' and daily_start is null and daily_end is null)
    or
    (repeat_mode = 'daily' and daily_start is not null and daily_end is not null and daily_end > daily_start)
  ),
  constraint display_publications_weekdays_check check (
    cardinality(weekdays) between 1 and 7
    and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);

create index playlists_company_created_idx on public.playlists(company_id, created_at desc);
create index playlists_created_by_idx on public.playlists(created_by);
create index playlist_items_playlist_position_idx on public.playlist_items(playlist_id, company_id, position, created_at);
create index playlist_items_content_company_idx on public.playlist_items(content_item_id, company_id) where content_item_id is not null;
create index playlist_items_structured_company_idx on public.playlist_items(structured_content_id, company_id) where structured_content_id is not null;
create index display_publications_display_company_idx on public.display_publications(display_id, company_id, is_active);
create index display_publications_playlist_company_idx on public.display_publications(playlist_id, company_id);
create index display_publications_created_by_idx on public.display_publications(created_by);

create trigger playlists_set_updated_at before update on public.playlists for each row execute function private.set_updated_at();
create trigger playlist_items_set_updated_at before update on public.playlist_items for each row execute function private.set_updated_at();
create trigger display_publications_set_updated_at before update on public.display_publications for each row execute function private.set_updated_at();

alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.display_publications enable row level security;

create policy playlists_select_own_company on public.playlists for select to authenticated
using (company_id = private.current_company_id());
create policy playlists_insert_manager on public.playlists for insert to authenticated
with check (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));
create policy playlists_update_manager on public.playlists for update to authenticated
using (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'))
with check (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));
create policy playlists_delete_manager on public.playlists for delete to authenticated
using (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));

create policy playlist_items_select_own_company on public.playlist_items for select to authenticated
using (company_id = private.current_company_id());
create policy playlist_items_insert_manager on public.playlist_items for insert to authenticated
with check (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));
create policy playlist_items_update_manager on public.playlist_items for update to authenticated
using (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'))
with check (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));
create policy playlist_items_delete_manager on public.playlist_items for delete to authenticated
using (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));

create policy display_publications_select_own_company on public.display_publications for select to authenticated
using (company_id = private.current_company_id());
create policy display_publications_insert_manager on public.display_publications for insert to authenticated
with check (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));
create policy display_publications_update_manager on public.display_publications for update to authenticated
using (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'))
with check (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));
create policy display_publications_delete_manager on public.display_publications for delete to authenticated
using (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));

revoke all on public.playlists, public.playlist_items, public.display_publications from anon, authenticated;
grant select, delete on public.playlists, public.playlist_items, public.display_publications to authenticated;
grant insert (company_id, name, description, is_active) on public.playlists to authenticated;
grant update (name, description, is_active) on public.playlists to authenticated;
grant insert (playlist_id, company_id, source_type, content_item_id, structured_content_id, position, duration_seconds) on public.playlist_items to authenticated;
grant update (position, duration_seconds) on public.playlist_items to authenticated;
grant insert (company_id, display_id, playlist_id, starts_at, ends_at, repeat_mode, daily_start, daily_end, weekdays, is_active) on public.display_publications to authenticated;
grant update (starts_at, ends_at, repeat_mode, daily_start, daily_end, weekdays, is_active) on public.display_publications to authenticated;
