alter table public.promotion_templates
  drop constraint if exists promotion_templates_theme_check;

alter table public.promotion_templates
  add constraint promotion_templates_theme_check
  check (theme = any (array[
    'hot_red'::text,
    'burst_yellow'::text,
    'price_blast'::text,
    'animated_hot'::text,
    'animated_burst'::text,
    'animated_bands'::text,
    'animated_pulse'::text,
    'animated_neon'::text,
    'animated_confetti'::text,
    'animated_chevron'::text,
    'animated_glow'::text,
    'animated_flash'::text
  ]));

insert into public.promotion_templates (key, name, description, theme, aspect_ratio, is_active)
values
  ('confete_de_oferta', 'Confete de Oferta', 'Fundo promocional colorido com confetes em queda suave.', 'animated_confetti', 'portrait', true),
  ('chevron_em_movimento', 'Chevron em Movimento', 'Faixas direcionais em movimento com área central estável.', 'animated_chevron', 'portrait', true),
  ('glow_premium', 'Glow Premium', 'Fundo escuro com brilhos suaves e sofisticados.', 'animated_glow', 'portrait', true),
  ('flash_de_liquidacao', 'Flash de Liquidação', 'Fundo vermelho com feixe de luz promocional atravessando a tela.', 'animated_flash', 'portrait', true)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    theme = excluded.theme,
    aspect_ratio = excluded.aspect_ratio,
    is_active = excluded.is_active;
