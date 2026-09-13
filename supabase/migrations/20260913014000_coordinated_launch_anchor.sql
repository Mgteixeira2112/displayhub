-- Conteúdo coordenado usa display_group_launches como relógio comum sem playlist única.
alter table public.display_group_launches
  alter column playlist_id drop not null;
