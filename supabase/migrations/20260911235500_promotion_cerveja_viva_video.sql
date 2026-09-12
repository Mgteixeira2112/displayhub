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
    'animated_flash'::text,
    'animated_beer'::text,
    'animated_beer_offer'::text,
    'animated_beer_video'::text
  ]));

insert into public.promotion_templates (key, name, description, theme, aspect_ratio, is_active)
values (
  'cerveja_viva_video',
  'Cerveja Viva — Vídeo',
  'Template horizontal experimental com vídeo externo real no fundo, overlay para leitura e conteúdo promocional fixo.',
  'animated_beer_video',
  'landscape',
  true
)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    theme = excluded.theme,
    aspect_ratio = excluded.aspect_ratio,
    is_active = excluded.is_active;
