create unique index if not exists display_publications_single_direct_base_idx
  on public.display_publications(display_id)
  where is_active = true
    and group_id is null
    and starts_at is null
    and ends_at is null
    and repeat_mode = 'always';
