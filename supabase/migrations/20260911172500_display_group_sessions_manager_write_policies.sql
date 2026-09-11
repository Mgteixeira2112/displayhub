create policy display_group_sessions_insert_manager
on public.display_group_sessions
for insert
to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() = any (array['admin'::text, 'manager'::text])
);

create policy display_group_sessions_update_manager
on public.display_group_sessions
for update
to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() = any (array['admin'::text, 'manager'::text])
)
with check (
  company_id = private.current_company_id()
  and private.current_user_role() = any (array['admin'::text, 'manager'::text])
);

grant insert, update on public.display_group_sessions to authenticated;
