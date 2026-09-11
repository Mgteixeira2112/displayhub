with affected_playlists as (
  select distinct playlist_id
  from (
    select playlist_id, position
    from public.playlist_items
    group by playlist_id, position
    having count(*) > 1
  ) duplicates
), ranked as (
  select
    pi.id,
    row_number() over (
      partition by pi.playlist_id
      order by pi.position, pi.created_at, pi.id
    ) - 1 as new_position
  from public.playlist_items pi
  join affected_playlists ap on ap.playlist_id = pi.playlist_id
)
update public.playlist_items pi
set position = ranked.new_position
from ranked
where pi.id = ranked.id
  and pi.position is distinct from ranked.new_position;
