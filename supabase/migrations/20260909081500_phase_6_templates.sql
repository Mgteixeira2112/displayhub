create table public.display_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  template_type text not null check (template_type in (
    'fullscreen_video',
    'promo_image',
    'menu',
    'price_table',
    'split_screen',
    'notice_board'
  )),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);

alter table public.playlist_items
  add column template_id uuid;

alter table public.playlist_items
  add constraint playlist_items_template_fk
  foreign key (template_id, company_id)
  references public.display_templates(id, company_id)
  on delete set null (template_id);

create index display_templates_company_created_idx
  on public.display_templates(company_id, created_at desc);
create index display_templates_created_by_idx
  on public.display_templates(created_by);
create index playlist_items_template_company_idx
  on public.playlist_items(template_id, company_id)
  where template_id is not null;

create trigger display_templates_set_updated_at
before update on public.display_templates
for each row execute function private.set_updated_at();

alter table public.display_templates enable row level security;

create policy display_templates_select_own_company
on public.display_templates
for select
to authenticated
using (company_id = private.current_company_id());

create policy display_templates_insert_manager
on public.display_templates
for insert
to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

create policy display_templates_update_manager
on public.display_templates
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

create policy display_templates_delete_manager
on public.display_templates
for delete
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

revoke all on public.display_templates from anon, authenticated;
grant select, delete on public.display_templates to authenticated;
grant insert (company_id, name, template_type, is_active)
  on public.display_templates to authenticated;
grant update (name, template_type, is_active)
  on public.display_templates to authenticated;

grant update (template_id) on public.playlist_items to authenticated;
grant insert (playlist_id, company_id, source_type, content_item_id, structured_content_id, template_id, position, duration_seconds)
  on public.playlist_items to authenticated;
