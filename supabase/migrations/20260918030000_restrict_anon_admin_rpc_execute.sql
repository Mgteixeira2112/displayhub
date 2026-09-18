-- Estas RPCs requerem sessao e papel admin/manager em seu corpo.
-- A chave anon nao deve poder invoca-las. Nao alterar as RPCs publicas
-- de player, heartbeat, ativacao e recuperacao baseadas em tokens de dispositivo.
-- Idempotente; nao toca em dados, definicoes de funcoes ou permissoes authenticated/service_role.

revoke execute on function public.assign_registered_device_playlist(uuid, uuid) from anon;
revoke execute on function public.claim_windows_player_pairing(text, jsonb) from anon;
revoke execute on function public.create_device_installation() from anon;
revoke execute on function public.preview_windows_player_pairing(text) from anon;
revoke execute on function public.queue_windows_player_command(uuid, text) from anon;

-- Falhar a migration caso as permissoes resultantes nao sejam as esperadas.
-- has_function_privilege confere permissao efetiva, inclusive via PUBLIC.
do $$
declare
  function_signature text;
begin
  foreach function_signature in array array[
    'public.assign_registered_device_playlist(uuid,uuid)',
    'public.claim_windows_player_pairing(text,jsonb)',
    'public.create_device_installation()',
    'public.preview_windows_player_pairing(text)',
    'public.queue_windows_player_command(uuid,text)'
  ] loop
    if has_function_privilege('anon', function_signature, 'EXECUTE') then
      raise exception 'anon ainda tem EXECUTE em %', function_signature;
    end if;
    if not has_function_privilege('authenticated', function_signature, 'EXECUTE') then
      raise exception 'authenticated perdeu EXECUTE em %', function_signature;
    end if;
    if not has_function_privilege('service_role', function_signature, 'EXECUTE') then
      raise exception 'service_role perdeu EXECUTE em %', function_signature;
    end if;
  end loop;
end;
$$;
