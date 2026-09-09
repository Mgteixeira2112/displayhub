alter table public.promotion_posters
  add column orientation text not null default 'portrait'
  check (orientation in ('portrait', 'landscape'));

grant insert (company_id, template_key, product_name, price, unit, headline, footer, orientation, is_active)
  on public.promotion_posters to authenticated;

grant update (template_key, product_name, price, unit, headline, footer, orientation, is_active)
  on public.promotion_posters to authenticated;
