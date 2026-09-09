create table public.promotion_templates (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  theme text not null check (theme in ('hot_red', 'burst_yellow', 'price_blast')),
  aspect_ratio text not null default 'portrait' check (aspect_ratio in ('portrait', 'landscape', 'square')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.promotion_templates (key, name, description, theme, aspect_ratio) values
  ('oferta_quente', 'Oferta Quente', 'Fundo vermelho com área amarela central para preço em destaque.', 'hot_red', 'portrait'),
  ('explosao_preco', 'Explosão de Preço', 'Cartaz amarelo de alto contraste com explosão visual e preço gigante.', 'burst_yellow', 'portrait'),
  ('preco_gigante', 'Preço Gigante', 'Cartaz direto para leitura rápida a distância, com preço dominante.', 'price_blast', 'portrait');

create table public.promotion_posters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_key text not null references public.promotion_templates(key) on delete restrict,
  product_name text not null check (char_length(trim(product_name)) between 2 and 120),
  price numeric(12,2) not null check (price >= 0),
  unit text check (unit is null or char_length(trim(unit)) between 1 and 30),
  headline text not null default 'OFERTA' check (char_length(trim(headline)) between 1 and 60),
  footer text check (footer is null or char_length(trim(footer)) between 1 and 80),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);

create index promotion_posters_company_created_idx on public.promotion_posters(company_id, created_at desc);
create index promotion_posters_created_by_idx on public.promotion_posters(created_by);

create trigger promotion_posters_set_updated_at
before update on public.promotion_posters
for each row execute function private.set_updated_at();

alter table public.promotion_templates enable row level security;
alter table public.promotion_posters enable row level security;

create policy promotion_templates_select_authenticated
on public.promotion_templates for select to authenticated
using (is_active = true);

create policy promotion_posters_select_own_company
on public.promotion_posters for select to authenticated
using (company_id = private.current_company_id());

create policy promotion_posters_insert_manager
on public.promotion_posters for insert to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

create policy promotion_posters_update_manager
on public.promotion_posters for update to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
)
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

create policy promotion_posters_delete_manager
on public.promotion_posters for delete to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

revoke all on public.promotion_templates from anon, authenticated;
grant select on public.promotion_templates to authenticated;

revoke all on public.promotion_posters from anon, authenticated;
grant select, delete on public.promotion_posters to authenticated;
grant insert (company_id, template_key, product_name, price, unit, headline, footer, is_active)
  on public.promotion_posters to authenticated;
grant update (template_key, product_name, price, unit, headline, footer, is_active)
  on public.promotion_posters to authenticated;
