create table public.display_group_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  group_id uuid not null,
  playlist_id uuid not null,
  playback_state text not null default 'playing' check (playback_state in ('playing','paused','stopped')),
  started_at timestamptz not null default now(),
  paused_position_ms bigint not null default 0 check (paused_position_ms >= 0),
  sequence bigint not null default 1 check (sequence > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint display_group_sessions_group_fk
    foreign key (group_id, company_id)
    references public.display_groups(id, company_id)
    on delete cascade,
  constraint display_group_sessions_playlist_fk
    foreign key (playlist_id, company_id)
    references public.playlists(id, company_id)
    on delete cascade,
  constraint display_group_sessions_group_unique unique (group_id)
);

create index display_group_sessions_company_idx on public.display_group_sessions(company_id);
create index display_group_sessions_playlist_idx on public.display_group_sessions(playlist_id, company_id);

create trigger display_group_sessions_set_updated_at
before update on public.display_group_sessions
for each row execute function private.set_updated_at();

alter table public.display_group_sessions enable row level security;

create policy display_group_sessions_select_own_company
on public.display_group_sessions
for select
to authenticated
using (company_id = private.current_company_id());

revoke all on public.display_group_sessions from anon, authenticated;
grant select on public.display_group_sessions to authenticated;
