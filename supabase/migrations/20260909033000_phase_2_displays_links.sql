create table public.displays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_id uuid,
  name text not null check (char_length(trim(name)) between 2 and 120),
  location text,
  orientation text not null default 'landscape' check (orientation in ('landscape', 'portrait')),
  resolution_width integer not null default 1920 check (resolution_width between 320 and 16384),
  resolution_height integer not null default 1080 check (resolution_height between 320 and 16384),
  public_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  is_active boolean not null default true,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint displays_unit_company_fk
    foreign key (unit_id, company_id)
    references public.units(id, company_id)
    on delete set null (unit_id)
);

create index displays_company_id_idx on public.displays(company_id);
create index displays_unit_company_idx on public.displays(unit_id, company_id) where unit_id is not null;
create index displays_last_seen_at_idx on public.displays(last_seen_at);

create trigger displays_set_updated_at
before update on public.displays
for each row execute function private.set_updated_at();

alter table public.displays enable row level security;

create policy displays_select_own_company
on public.displays
for select
to authenticated
using (company_id = private.current_company_id());

create policy displays_insert_manager
on public.displays
for insert
to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
  and created_by = (select auth.uid())
);

create policy displays_update_manager
on public.displays
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

create policy displays_delete_admin
on public.displays
for delete
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() = 'admin'
);

revoke all on public.displays from anon, authenticated;
grant select on public.displays to authenticated;
grant insert (company_id, unit_id, name, location, orientation, resolution_width, resolution_height) on public.displays to authenticated;
grant update (unit_id, name, location, orientation, resolution_width, resolution_height, is_active, revoked_at) on public.displays to authenticated;
grant delete on public.displays to authenticated;

create or replace function public.get_public_display(p_token text)
returns table (
  id uuid,
  name text,
  location text,
  orientation text,
  resolution_width integer,
  resolution_height integer,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.name, d.location, d.orientation, d.resolution_width, d.resolution_height, d.last_seen_at
  from public.displays d
  where d.public_token = p_token
    and d.is_active = true
    and d.revoked_at is null
  limit 1
$$;

create or replace function public.heartbeat_display(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched boolean;
begin
  update public.displays
  set last_seen_at = now()
  where public_token = p_token
    and is_active = true
    and revoked_at is null;

  get diagnostics touched = row_count;
  return touched;
end;
$$;

revoke all on function public.get_public_display(text) from public, anon, authenticated;
revoke all on function public.heartbeat_display(text) from public, anon, authenticated;
grant execute on function public.get_public_display(text) to anon, authenticated;
grant execute on function public.heartbeat_display(text) to anon, authenticated;
