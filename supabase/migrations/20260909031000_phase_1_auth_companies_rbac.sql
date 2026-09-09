create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name),
  unique (id, company_id)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_id uuid,
  role text not null check (role in ('admin', 'manager', 'operator')),
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_unit_company_fk
    foreign key (unit_id, company_id)
    references public.units(id, company_id)
    on delete set null
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create trigger companies_set_updated_at
before update on public.companies
for each row execute function private.set_updated_at();

create trigger units_set_updated_at
before update on public.units
for each row execute function private.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create or replace function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id
  from public.profiles p
  where p.user_id = (select auth.uid())
  limit 1
$$;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.user_id = (select auth.uid())
  limit 1
$$;

revoke all on function private.current_company_id() from public;
revoke all on function private.current_user_role() from public;
grant execute on function private.current_company_id() to authenticated;
grant execute on function private.current_user_role() to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_company_id uuid;
  new_unit_id uuid;
  requested_company_name text;
  requested_full_name text;
begin
  requested_company_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');
  requested_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');

  if requested_company_name is null then
    requested_company_name := 'Minha empresa';
  end if;

  insert into public.companies (name)
  values (requested_company_name)
  returning id into new_company_id;

  insert into public.units (company_id, name)
  values (new_company_id, 'Matriz')
  returning id into new_unit_id;

  insert into public.profiles (user_id, company_id, unit_id, role, full_name)
  values (new.id, new_company_id, new_unit_id, 'admin', requested_full_name);

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.handle_new_user() from anon;
revoke all on function private.handle_new_user() from authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.companies enable row level security;
alter table public.units enable row level security;
alter table public.profiles enable row level security;

create policy companies_select_own
on public.companies
for select
to authenticated
using (id = private.current_company_id());

create policy companies_update_admin
on public.companies
for update
to authenticated
using (
  id = private.current_company_id()
  and private.current_user_role() = 'admin'
)
with check (
  id = private.current_company_id()
  and private.current_user_role() = 'admin'
);

create policy units_select_own_company
on public.units
for select
to authenticated
using (company_id = private.current_company_id());

create policy units_insert_manager
on public.units
for insert
to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

create policy units_update_manager
on public.units
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

create policy units_delete_admin
on public.units
for delete
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() = 'admin'
);

create policy profiles_select_own_company
on public.profiles
for select
to authenticated
using (company_id = private.current_company_id());

create policy profiles_update_admin
on public.profiles
for update
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() = 'admin'
)
with check (
  company_id = private.current_company_id()
  and private.current_user_role() = 'admin'
  and role in ('admin', 'manager', 'operator')
);

grant select, update on public.companies to authenticated;
grant select, insert, update, delete on public.units to authenticated;
grant select, update on public.profiles to authenticated;
