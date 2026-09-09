create table public.display_sync_states (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  group_id uuid not null,
  display_id uuid not null,
  session_id uuid references public.display_group_sessions(id) on delete cascade,
  playlist_id uuid references public.playlists(id) on delete set null,
  item_id uuid references public.playlist_items(id) on delete set null,
  expected_position_ms bigint not null default 0 check (expected_position_ms >= 0),
  actual_position_ms bigint check (actual_position_ms is null or actual_position_ms >= 0),
  drift_ms bigint,
  buffering boolean not null default false,
  measurement_kind text not null default 'clock' check (measurement_kind in ('clock','media')),
  sequence bigint not null default 0 check (sequence >= 0),
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint display_sync_states_group_fk foreign key (group_id, company_id) references public.display_groups(id, company_id) on delete cascade,
  constraint display_sync_states_display_fk foreign key (display_id, company_id) references public.displays(id, company_id) on delete cascade,
  constraint display_sync_states_display_unique unique (display_id)
);

create index display_sync_states_group_idx on public.display_sync_states(group_id, reported_at desc);
create index display_sync_states_company_idx on public.display_sync_states(company_id, reported_at desc);

create trigger display_sync_states_set_updated_at
before update on public.display_sync_states
for each row execute function private.set_updated_at();

alter table public.display_sync_states enable row level security;

create policy display_sync_states_select_own_company
on public.display_sync_states
for select
to authenticated
using (company_id = private.current_company_id());

revoke all on public.display_sync_states from anon, authenticated;
grant select on public.display_sync_states to authenticated;
