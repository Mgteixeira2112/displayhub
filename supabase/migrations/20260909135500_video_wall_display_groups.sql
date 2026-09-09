create table public.display_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  mode text not null default 'mirror' check (mode in ('mirror', 'coordinated', 'video_wall')),
  rows integer not null default 1 check (rows between 1 and 16),
  columns integer not null default 1 check (columns between 1 and 16),
  virtual_width integer check (virtual_width is null or virtual_width between 320 and 65536),
  virtual_height integer check (virtual_height is null or virtual_height between 320 and 65536),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint display_groups_id_company_unique unique (id, company_id)
);

create index display_groups_company_id_idx on public.display_groups(company_id);
create index display_groups_mode_idx on public.display_groups(company_id, mode);

create trigger display_groups_set_updated_at
before update on public.display_groups
for each row execute function private.set_updated_at();

alter table public.display_groups enable row level security;

create policy display_groups_select_own_company
on public.display_groups
for select
to authenticated
using (company_id = private.current_company_id());

create policy display_groups_insert_manager
on public.display_groups
for insert
to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
  and created_by = (select auth.uid())
);

create policy display_groups_update_manager
on public.display_groups
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

create policy display_groups_delete_admin
on public.display_groups
for delete
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() = 'admin'
);

revoke all on public.display_groups from anon, authenticated;
grant select on public.display_groups to authenticated;
grant insert (company_id, name, mode, rows, columns, virtual_width, virtual_height) on public.display_groups to authenticated;
grant update (name, mode, rows, columns, virtual_width, virtual_height, is_active) on public.display_groups to authenticated;
grant delete on public.display_groups to authenticated;

create table public.display_group_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  group_id uuid not null,
  display_id uuid not null,
  row_index integer not null default 0 check (row_index between 0 and 15),
  column_index integer not null default 0 check (column_index between 0 and 15),
  order_index integer not null default 0 check (order_index between 0 and 255),
  crop_x numeric(7,6) check (crop_x is null or crop_x between 0 and 1),
  crop_y numeric(7,6) check (crop_y is null or crop_y between 0 and 1),
  crop_width numeric(7,6) check (crop_width is null or (crop_width > 0 and crop_width <= 1)),
  crop_height numeric(7,6) check (crop_height is null or (crop_height > 0 and crop_height <= 1)),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint display_group_members_group_company_fk
    foreign key (group_id, company_id)
    references public.display_groups(id, company_id)
    on delete cascade,
  constraint display_group_members_display_company_fk
    foreign key (display_id, company_id)
    references public.displays(id, company_id)
    on delete cascade,
  constraint display_group_members_group_display_unique unique (group_id, display_id),
  constraint display_group_members_group_position_unique unique (group_id, row_index, column_index),
  constraint display_group_members_crop_bounds check (
    (crop_x is null and crop_y is null and crop_width is null and crop_height is null)
    or
    (crop_x is not null and crop_y is not null and crop_width is not null and crop_height is not null
      and crop_x + crop_width <= 1
      and crop_y + crop_height <= 1)
  )
);

create index display_group_members_company_id_idx on public.display_group_members(company_id);
create index display_group_members_group_id_idx on public.display_group_members(group_id);
create index display_group_members_display_id_idx on public.display_group_members(display_id);

create trigger display_group_members_set_updated_at
before update on public.display_group_members
for each row execute function private.set_updated_at();

alter table public.display_group_members enable row level security;

create policy display_group_members_select_own_company
on public.display_group_members
for select
to authenticated
using (company_id = private.current_company_id());

create policy display_group_members_insert_manager
on public.display_group_members
for insert
to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
  and created_by = (select auth.uid())
);

create policy display_group_members_update_manager
on public.display_group_members
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

create policy display_group_members_delete_manager
on public.display_group_members
for delete
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

revoke all on public.display_group_members from anon, authenticated;
grant select on public.display_group_members to authenticated;
grant insert (company_id, group_id, display_id, row_index, column_index, order_index, crop_x, crop_y, crop_width, crop_height) on public.display_group_members to authenticated;
grant update (row_index, column_index, order_index, crop_x, crop_y, crop_width, crop_height) on public.display_group_members to authenticated;
grant delete on public.display_group_members to authenticated;
