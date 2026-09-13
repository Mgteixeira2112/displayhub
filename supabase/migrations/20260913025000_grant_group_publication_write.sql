-- Permite que gestores salvem a playlist de grupos via frontend; o RLS continua limitando empresa e papel.
grant insert, update on public.display_group_publications to authenticated;
