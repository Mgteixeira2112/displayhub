# PR #331 — estado anterior preservado e plano de reversão

Registro em 18/09/2026. **Documento de preparação: nenhuma instrução SQL desta página foi executada.** Projeto Supabase de origem: `meqeluddtwthqmrtbhbr` (organização no plano Free). Nenhum dado de clientes, usuário, dispositivo, token ou segredo foi extraído.

## 1. Referência do código já preservada

- A `main` foi conferida no commit `9cba427eadcb577fbc77cdeb4daca0f41317a4e6`.
- Branch separada `safety/pre-rbac-331-20260918` criada **exatamente** nesse SHA e conferida pela API do GitHub: https://github.com/Mgteixeira2112/displayhub/tree/safety/pre-rbac-331-20260918.
- Preservar essa branch sem novos commits, merges ou exclusões. Ela é um ponto de referência do **código versionado**, não um backup do banco, Storage, Auth, configurações ou dados.

## 2. Fotografia de metadados do banco, somente leitura

Consulta ao catálogo `pg_proc`, `aclexplode(proacl)` e `has_function_privilege` feita antes de qualquer mudança na PR #331. Cada função abaixo existe e apresenta exatamente o mesmo estado:

| Função pública (assinatura exata) | `anon` EXECUTE efetivo | concessão direta `anon` | concessão a `PUBLIC` | `authenticated` EXECUTE | `service_role` EXECUTE |
| --- | --- | --- | --- | --- | --- |
| `public.assign_registered_device_playlist(uuid,uuid)` | sim | sim | não | sim | sim |
| `public.claim_windows_player_pairing(text,jsonb)` | sim | sim | não | sim | sim |
| `public.create_device_installation()` | sim | sim | não | sim | sim |
| `public.preview_windows_player_pairing(text)` | sim | sim | não | sim | sim |
| `public.queue_windows_player_command(uuid,text)` | sim | sim | não | sim | sim |

A migration proposta apenas remove a concessão direta de `anon` nessas cinco assinaturas. As funções já verificam autenticação/papel internamente. Nenhuma RPC pública de player/token é alterada. Esse snapshot não comprova comportamento real de usuários nem cobre todos os objetos do banco.

## 3. Portas obrigatórias antes de alterar a produção

1. Revalidar se a `main`, a PR, as cinco assinaturas, os grants e as dependências não mudaram desde este registro. Se mudaram, interromper e atualizar o plano.
2. Verificar um **backup recuperável e privado** antes de qualquer DDL. O plano Free não garante os backups diários disponíveis nos planos pagos: https://supabase.com/docs/guides/platform/backups recomenda `supabase db dump` periódico e cópia fora do provedor. Esta ferramenta de chat não disponibiliza um backup íntegro/restaurável do banco. Não foi produzido dump nesta etapa, não se deve afirmar que há backup completo. Os objetos de Storage requerem cópia separada; um dump SQL não copia seus bytes. Nunca armazenar dumps, credenciais ou dados de clientes no repositório público.
3. Não criar novo projeto, branch Supabase ou serviço com custo. Se backup privado não puder ser obtido/verificado, **não executar a migration** até resolver a recuperação ou até nova decisão explícita de risco.
4. Revalidar CI, combinar janela de menor impacto e autorização específica do usuário para aplicar exatamente a migration da PR #331. Merge da PR é outra autorização, independente.
5. Registrar as cinco linhas acima antes e depois; resultado esperado depois: `anon=false`, `authenticated=true`, `service_role=true`, `PUBLIC=false` para todas. Validar operações administrativas somente em sessão de teste legítima e sem acionar dispositivos de clientes.

## 4. Reversão limitada de permissões — SOMENTE com autorização adicional

Este SQL fica **dentro da documentação**, não em `supabase/migrations/`: portanto não entra automaticamente no deploy. Usar apenas caso a migration seja aplicada e seja necessário desfazê-la; primeiro confirmar a origem do problema. Não reverter toda a base nem retornar `main` à força. A reversão restaura a permissão anônima original e reabre a exposição identificada; registrar a ocorrência e revisar posteriormente.

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';

DO $$
DECLARE
  signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.assign_registered_device_playlist(uuid,uuid)',
    'public.claim_windows_player_pairing(text,jsonb)',
    'public.create_device_installation()',
    'public.preview_windows_player_pairing(text)',
    'public.queue_windows_player_command(uuid,text)'
  ] LOOP
    IF to_regprocedure(signature) IS NULL
      OR has_function_privilege('anon', signature, 'EXECUTE')
      OR NOT has_function_privilege('authenticated', signature, 'EXECUTE')
      OR NOT has_function_privilege('service_role', signature, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'Estado diferente do esperado antes do rollback: %', signature;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_registered_device_playlist(uuid,uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.claim_windows_player_pairing(text,jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.create_device_installation() TO anon;
GRANT EXECUTE ON FUNCTION public.preview_windows_player_pairing(text) TO anon;
GRANT EXECUTE ON FUNCTION public.queue_windows_player_command(uuid,text) TO anon;

DO $$
DECLARE
  signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.assign_registered_device_playlist(uuid,uuid)',
    'public.claim_windows_player_pairing(text,jsonb)',
    'public.create_device_installation()',
    'public.preview_windows_player_pairing(text)',
    'public.queue_windows_player_command(uuid,text)'
  ] LOOP
    IF NOT has_function_privilege('anon', signature, 'EXECUTE')
      OR NOT has_function_privilege('authenticated', signature, 'EXECUTE')
      OR NOT has_function_privilege('service_role', signature, 'EXECUTE')
    THEN
      RAISE EXCEPTION 'Falha em restaurar grants: %', signature;
    END IF;
  END LOOP;
END;
$$;
COMMIT;
```

Se uma assertiva falhar, interromper, executar `ROLLBACK` quando necessário e investigar; **não forçar execução**. A reversão é das cinco permissões apenas: não restaura dados apagados, arquivos, sessões, comandos já enviados ou efeitos externos. Antes de qualquer rollout, assegurar backup privado abrangente e plano de recuperação adequado ao risco.