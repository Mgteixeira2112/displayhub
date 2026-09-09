create table public.display_group_launches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  group_id uuid not null references public.display_groups(id) on delete cascade,
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  status text not null default 'preparing' check (status in ('preparing','armed','started','cancelled')),
  sequence bigint not null default 1 check (sequence >= 1),
  requested_at timestamptz not null default now(),
  start_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id)
);

create table public.display_group_ready_states (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  launch_id uuid not null references public.display_group_launches(id) on delete cascade,
  group_id uuid not null references public.display_groups(id) on delete cascade,
  display_id uuid not null references public.displays(id) on delete cascade,
  ready boolean not null default false,
  provider text,
  detail text,
  ready_at timestamptz,
  reported_at timestamptz not null default now(),
  unique (launch_id, display_id)
);

create index display_group_launches_company_idx on public.display_group_launches(company_id);
create index display_group_ready_states_group_idx on public.display_group_ready_states(group_id, reported_at desc);

create trigger display_group_launches_set_updated_at before update on public.display_group_launches for each row execute function private.set_updated_at();

alter table public.display_group_launches enable row level security;
alter table public.display_group_ready_states enable row level security;

create policy display_group_launches_select_own_company on public.display_group_launches for select to authenticated using (company_id = private.current_company_id());
create policy display_group_launches_insert_manager on public.display_group_launches for insert to authenticated with check (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));
create policy display_group_launches_update_manager on public.display_group_launches for update to authenticated using (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager')) with check (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));
create policy display_group_launches_delete_manager on public.display_group_launches for delete to authenticated using (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));

create policy display_group_ready_states_select_own_company on public.display_group_ready_states for select to authenticated using (company_id = private.current_company_id());
create policy display_group_ready_states_manage_manager on public.display_group_ready_states for all to authenticated using (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager')) with check (company_id = private.current_company_id() and private.current_user_role() in ('admin','manager'));

grant select, insert, update, delete on public.display_group_launches to authenticated;
grant select, insert, update, delete on public.display_group_ready_states to authenticated;
