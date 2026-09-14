create table public.smart_scenes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  scene_type text not null check (scene_type in ('hero','split','spotlight','data','countdown','panorama')),
  orientation text not null default 'auto' check (orientation in ('auto','landscape','portrait','ultrawide')),
  intensity text not null default 'impact' check (intensity in ('minimal','commercial','impact','immersive')),
  motion text not null default 'balanced' check (motion in ('soft','balanced','strong')),
  headline text not null default '' check (char_length(headline) <= 120),
  primary_text text not null default '' check (char_length(primary_text) <= 160),
  secondary_text text not null default '' check (char_length(secondary_text) <= 240),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);

create index smart_scenes_company_created_idx on public.smart_scenes(company_id, created_at desc);

create trigger smart_scenes_set_updated_at
before update on public.smart_scenes
for each row execute function private.set_updated_at();

alter table public.smart_scenes enable row level security;

create policy smart_scenes_select_own_company
on public.smart_scenes for select to authenticated
using (company_id = private.current_company_id());

create policy smart_scenes_insert_manager
on public.smart_scenes for insert to authenticated
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

create policy smart_scenes_update_manager
on public.smart_scenes for update to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
)
with check (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

create policy smart_scenes_delete_manager
on public.smart_scenes for delete to authenticated
using (
  company_id = private.current_company_id()
  and private.current_user_role() in ('admin', 'manager')
);

revoke all on public.smart_scenes from anon, authenticated;
grant select, delete on public.smart_scenes to authenticated;
grant insert (company_id, name, scene_type, orientation, intensity, motion, headline, primary_text, secondary_text, config, is_active)
  on public.smart_scenes to authenticated;
grant update (name, orientation, intensity, motion, headline, primary_text, secondary_text, config, is_active)
  on public.smart_scenes to authenticated;
