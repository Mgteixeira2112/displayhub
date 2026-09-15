revoke all on public.smart_scenes from anon, authenticated;
grant select, delete on public.smart_scenes to authenticated;
grant insert (company_id, name, scene_type, orientation, intensity, motion, headline, primary_text, secondary_text, config, is_active)
  on public.smart_scenes to authenticated;
grant update (name, orientation, intensity, motion, headline, primary_text, secondary_text, config, is_active)
  on public.smart_scenes to authenticated;
