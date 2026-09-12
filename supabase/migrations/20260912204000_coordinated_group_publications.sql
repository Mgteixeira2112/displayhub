alter table public.display_publications
  add column group_id uuid;

alter table public.display_publications
  add constraint display_publications_group_company_fk
    foreign key (group_id, company_id)
    references public.display_groups(id, company_id)
    on delete cascade;

create index display_publications_group_display_idx
  on public.display_publications(group_id, display_id, is_active)
  where group_id is not null;

grant insert (group_id) on public.display_publications to authenticated;
