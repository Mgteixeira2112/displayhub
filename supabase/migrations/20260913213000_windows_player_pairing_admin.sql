create or replace function public.preview_windows_player_pairing(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_company_id uuid := private.current_company_id();
  v_role text := private.current_user_role();
  v_request public.player_pairing_requests%rowtype;
begin
  if auth.uid() is null or v_company_id is null or v_role not in ('admin','manager') then
    raise exception 'forbidden';
  end if;

  select * into v_request
  from public.player_pairing_requests
  where code = upper(trim(coalesce(p_code, '')))
    and status = 'pending'
  order by created_at desc
  limit 1;

  if not found then raise exception 'pairing_not_found'; end if;

  if v_request.expires_at <= now() then
    update public.player_pairing_requests
    set status = 'expired', updated_at = now()
    where id = v_request.id and status = 'pending';
    raise exception 'pairing_expired';
  end if;

  return jsonb_build_object(
    'ok', true,
    'pairing_id', v_request.id,
    'hostname', v_request.hostname,
    'monitors', v_request.monitors,
    'expires_at', v_request.expires_at
  );
end;
$$;

revoke all on function public.preview_windows_player_pairing(text) from public;
grant execute on function public.preview_windows_player_pairing(text) to authenticated;
