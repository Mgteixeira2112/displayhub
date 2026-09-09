alter table public.playlist_items
  add constraint playlist_items_id_company_unique unique (id, company_id);

alter table public.displays
  add column active_playlist_id uuid,
  add column active_item_id uuid,
  add column active_state_at timestamptz;

alter table public.displays
  add constraint displays_active_playlist_fk
    foreign key (active_playlist_id, company_id)
    references public.playlists(id, company_id)
    on delete set null (active_playlist_id),
  add constraint displays_active_item_fk
    foreign key (active_item_id, company_id)
    references public.playlist_items(id, company_id)
    on delete set null (active_item_id);

create index displays_active_playlist_company_idx on public.displays(active_playlist_id, company_id) where active_playlist_id is not null;
create index displays_active_item_company_idx on public.displays(active_item_id, company_id) where active_item_id is not null;

create table public.display_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  display_id uuid not null,
  event_type text not null check (event_type in ('publication_created','publication_updated','publication_deleted','playlist_changed')),
  playlist_id uuid,
  playlist_item_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint display_events_display_fk
    foreign key (display_id, company_id)
    references public.displays(id, company_id)
    on delete cascade,
  constraint display_events_playlist_fk
    foreign key (playlist_id, company_id)
    references public.playlists(id, company_id)
    on delete set null (playlist_id),
  constraint display_events_playlist_item_fk
    foreign key (playlist_item_id, company_id)
    references public.playlist_items(id, company_id)
    on delete set null (playlist_item_id)
);

create index display_events_company_created_idx on public.display_events(company_id, created_at desc);
create index display_events_display_created_idx on public.display_events(display_id, company_id, created_at desc);
create index display_events_playlist_company_idx on public.display_events(playlist_id, company_id) where playlist_id is not null;

alter table public.display_events enable row level security;

create policy display_events_select_own_company on public.display_events
for select to authenticated
using (company_id = private.current_company_id());

revoke all on public.display_events from anon, authenticated;
grant select on public.display_events to authenticated;

create or replace function public.report_display_state(
  p_token text,
  p_playlist_id uuid default null,
  p_item_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display public.displays%rowtype;
begin
  if (p_playlist_id is null) <> (p_item_id is null) then
    return false;
  end if;

  select * into v_display
  from public.displays
  where public_token = p_token
    and is_active = true
    and revoked_at is null;

  if not found then
    return false;
  end if;

  if p_playlist_id is not null then
    if not exists (
      select 1
      from public.display_publications dp
      join public.playlists p on p.id = dp.playlist_id and p.company_id = dp.company_id
      join public.playlist_items pi on pi.id = p_item_id and pi.playlist_id = p.id and pi.company_id = p.company_id
      where dp.display_id = v_display.id
        and dp.company_id = v_display.company_id
        and dp.playlist_id = p_playlist_id
        and dp.is_active = true
        and p.is_active = true
    ) then
      return false;
    end if;
  end if;

  update public.displays
  set active_playlist_id = p_playlist_id,
      active_item_id = p_item_id,
      active_state_at = now(),
      last_seen_at = now()
  where id = v_display.id;

  return true;
end;
$$;

revoke all on function public.report_display_state(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.report_display_state(text, uuid, uuid) to anon;

create or replace function private.log_display_publication_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.display_publications%rowtype;
  v_event text;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  v_event := case tg_op
    when 'INSERT' then 'publication_created'
    when 'UPDATE' then 'publication_updated'
    else 'publication_deleted'
  end;

  insert into public.display_events(company_id, display_id, event_type, playlist_id, actor_id, metadata)
  values (
    v_row.company_id,
    v_row.display_id,
    v_event,
    v_row.playlist_id,
    auth.uid(),
    jsonb_build_object('publication_id', v_row.id, 'repeat_mode', v_row.repeat_mode)
  );

  return coalesce(new, old);
end;
$$;

create trigger display_publications_log_event
  after insert or update or delete on public.display_publications
  for each row execute function private.log_display_publication_event();

create or replace function private.log_playlist_item_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.playlist_items%rowtype;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;

  insert into public.display_events(company_id, display_id, event_type, playlist_id, playlist_item_id, actor_id, metadata)
  select dp.company_id,
         dp.display_id,
         'playlist_changed',
         dp.playlist_id,
         case when tg_op = 'DELETE' then null else v_row.id end,
         auth.uid(),
         jsonb_build_object('operation', lower(tg_op), 'position', v_row.position)
  from public.display_publications dp
  where dp.playlist_id = v_row.playlist_id
    and dp.company_id = v_row.company_id
    and dp.is_active = true;

  return coalesce(new, old);
end;
$$;

create trigger playlist_items_log_event
  after insert or update or delete on public.playlist_items
  for each row execute function private.log_playlist_item_event();
