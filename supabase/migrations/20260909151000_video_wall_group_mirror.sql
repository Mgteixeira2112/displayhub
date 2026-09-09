create table public.display_group_publications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  group_id uuid not null,
  playlist_id uuid not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint display_group_publications_group_fk
    foreign key (group_id, company_id)
    references public.display_groups(id, company_id)
    on delete cascade,
  constraint display_group_publications_playlist_fk
    foreign key (playlist_id, company_id)
    references public.playlists(id, company_id)
    on delete cascade,
  constraint display_group_publications_group_unique unique (group_id)
);

create index display_group_publications_company_idx on public.display_group_publications(company_id);
create index display_group_publications_playlist_idx on public.display_group_publications(playlist_id, company_id);

create trigger display_group_publications_set_updated_at
before update on public.display_group_publications
for each row execute function private.set_updated_at();

alter table public.display_group_publications enable row level security;

create policy display_group_publications_select_own_company
on public.display_group_publications
for select
to authenticated
using (company_id = private.current_company_id());

create policy display_group_publications_insert_manager
on public.display_group_publications
for insert
to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

create policy display_group_publications_update_manager
on public.display_group_publications
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

create policy display_group_publications_delete_manager
on public.display_group_publications
for delete
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

revoke all on public.display_group_publications from anon, authenticated;
grant select, delete on public.display_group_publications to authenticated;
grant insert (company_id, group_id, playlist_id, is_active) on public.display_group_publications to authenticated;
grant update (playlist_id, is_active) on public.display_group_publications to authenticated;
