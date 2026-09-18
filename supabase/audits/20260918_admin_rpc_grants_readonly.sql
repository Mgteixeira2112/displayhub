-- Auditoria segura e repetível para executar ANTES e DEPOIS da migration da PR #331.
-- Exclusivamente SELECT sobre metadados: sem chamadas RPC, DDL ou leitura de dados de clientes.
-- Esperado ANTES: cinco funções existentes, SECURITY DEFINER, anon=true,
-- authenticated=true, service_role=true, concessão PUBLIC=0.
-- Esperado DEPOIS: tudo igual, exceto anon=false; concessão PUBLIC=0.
WITH target(signature) AS (
  VALUES
    ('public.assign_registered_device_playlist(uuid,uuid)'),
    ('public.claim_windows_player_pairing(text,jsonb)'),
    ('public.create_device_installation()'),
    ('public.preview_windows_player_pairing(text)'),
    ('public.queue_windows_player_command(uuid,text)')
), rpc AS (
  SELECT signature, to_regprocedure(signature) AS function_oid FROM target
)
SELECT
  r.signature,
  p.oid IS NOT NULL AS function_exists,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  (SELECT count(*) FROM aclexplode(p.proacl) acl
   WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE') AS execute_grants_to_public,
  (SELECT count(*) FROM aclexplode(p.proacl) acl
   WHERE acl.grantee = (SELECT oid FROM pg_roles WHERE rolname='anon')
     AND acl.privilege_type = 'EXECUTE') AS direct_anon_execute_grants
FROM rpc r
LEFT JOIN pg_proc p ON p.oid = r.function_oid
ORDER BY r.signature;
