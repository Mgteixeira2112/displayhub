create table public.structured_contents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('product', 'menu', 'price_table', 'notice', 'text', 'qr')),
  title text not null check (char_length(trim(title)) between 2 and 160),
  category text check (category is null or char_length(trim(category)) between 1 and 80),
  description text check (description is null or char_length(description) <= 4000),
  price numeric(12,2) check (price is null or price >= 0),
  promo_price numeric(12,2) check (promo_price is null or promo_price >= 0),
  qr_value text check (qr_value is null or char_length(trim(qr_value)) between 1 and 2048),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  constraint structured_contents_shape_check check (
    (
      kind = 'product'
      and price is not null
      and qr_value is null
      and (promo_price is null or promo_price <= price)
    )
    or
    (
      kind in ('menu', 'price_table')
      and price is null
      and promo_price is null
      and qr_value is null
    )
    or
    (
      kind in ('notice', 'text')
      and description is not null
      and price is null
      and promo_price is null
      and qr_value is null
    )
    or
    (
      kind = 'qr'
      and qr_value is not null
      and price is null
      and promo_price is null
    )
  )
);

create table public.structured_content_rows (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 160),
  category text check (category is null or char_length(trim(category)) between 1 and 80),
  description text check (description is null or char_length(description) <= 2000),
  price numeric(12,2) not null check (price >= 0),
  promo_price numeric(12,2) check (promo_price is null or (promo_price >= 0 and promo_price <= price)),
  position integer not null default 0 check (position >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint structured_content_rows_parent_fk
    foreign key (content_id, company_id)
    references public.structured_contents(id, company_id)
    on delete cascade
);

create index structured_contents_company_created_idx
  on public.structured_contents(company_id, created_at desc);

create index structured_contents_created_by_idx
  on public.structured_contents(created_by);

create index structured_content_rows_parent_position_idx
  on public.structured_content_rows(content_id, position, created_at);

create index structured_content_rows_company_idx
  on public.structured_content_rows(company_id);

create trigger structured_contents_set_updated_at
before update on public.structured_contents
for each row execute function private.set_updated_at();

create trigger structured_content_rows_set_updated_at
before update on public.structured_content_rows
for each row execute function private.set_updated_at();

alter table public.structured_contents enable row level security;
alter table public.structured_content_rows enable row level security;

create policy structured_contents_select_own_company
on public.structured_contents
for select
to authenticated
using (company_id = private.current_company_id());

create policy structured_contents_insert_manager
on public.structured_contents
for insert
to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

create policy structured_contents_update_manager
on public.structured_contents
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

create policy structured_contents_delete_manager
on public.structured_contents
for delete
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

create policy structured_content_rows_select_own_company
on public.structured_content_rows
for select
to authenticated
using (company_id = private.current_company_id());

create policy structured_content_rows_insert_manager
on public.structured_content_rows
for insert
to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
  and exists (
    select 1
    from public.structured_contents sc
    where sc.id = content_id
      and sc.company_id = company_id
      and sc.kind in ('menu', 'price_table')
  )
);

create policy structured_content_rows_update_manager
on public.structured_content_rows
for update
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
)
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
  and exists (
    select 1
    from public.structured_contents sc
    where sc.id = content_id
      and sc.company_id = company_id
      and sc.kind in ('menu', 'price_table')
  )
);

create policy structured_content_rows_delete_manager
on public.structured_content_rows
for delete
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

revoke all on public.structured_contents, public.structured_content_rows from anon, authenticated;

grant select, delete on public.structured_contents to authenticated;
grant insert (company_id, kind, title, category, description, price, promo_price, qr_value, is_active)
  on public.structured_contents to authenticated;
grant update (title, category, description, price, promo_price, qr_value, is_active)
  on public.structured_contents to authenticated;

grant select, delete on public.structured_content_rows to authenticated;
grant insert (content_id, company_id, title, category, description, price, promo_price, position, is_active)
  on public.structured_content_rows to authenticated;
grant update (title, category, description, price, promo_price, position, is_active)
  on public.structured_content_rows to authenticated;
