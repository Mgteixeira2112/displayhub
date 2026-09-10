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
    'animated_neon'::text
  ]));

insert into public.promotion_templates (key, name, description, theme, aspect_ratio, is_active)
values
  ('oferta_quente_animado', 'Oferta Quente Animado', 'Fundo vermelho e amarelo com onda e aro em movimento.', 'animated_hot', 'portrait', true),
  ('preco_explosivo_animado', 'Preço Explosivo Animado', 'Explosão radial promocional com pulso central.', 'animated_burst', 'portrait', true),
  ('faixa_deslizante_animada', 'Faixa Deslizante Animada', 'Faixas diagonais em movimento contínuo.', 'animated_bands', 'portrait', true),
  ('liquidacao_pulsante', 'Liquidação Pulsante', 'Fundo promocional com halo e faixa pulsantes.', 'animated_pulse', 'portrait', true),
  ('neon_promocional', 'Neon Promocional', 'Moldura neon com brilho e linhas em movimento.', 'animated_neon', 'portrait', true)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    theme = excluded.theme,
    aspect_ratio = excluded.aspect_ratio,
    is_active = excluded.is_active;
