alter table public.promotion_posters
  add column layout_positions jsonb not null default '{}'::jsonb
  check (jsonb_typeof(layout_positions) = 'object');

grant insert (layout_positions) on public.promotion_posters to authenticated;
grant update (layout_positions) on public.promotion_posters to authenticated;
