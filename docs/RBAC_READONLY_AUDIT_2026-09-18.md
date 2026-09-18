# Auditoria de RBAC e RPC — DisplayHub — 18/09/2026

Escopo: inspeção **somente de metadados** do projeto Supabase `meqeluddtwthqmrtbhbr`, comparada às chamadas do frontend na `main` em `9cba427eadcb577fbc77cdeb4daca0f41317a4e6`. Não foram lidas linhas de clientes nem realizados login, alteração de dados, DDL ou chamadas RPC. Isto **não é homologação real de RLS**.

## Evidências

- As 26 tabelas do schema `public` inspecionadas estão com RLS ativo. As policies de tabelas por empresa inspecionadas usam `private.current_company_id()`; gravações administrativas usam `private.current_user_role()` conforme política. `promotion_templates` expõe leitura de modelos globais ativos aos autenticados, de modo intencional, sem filtro por empresa.
- As funções `private.current_company_id()` e `private.current_user_role()` buscam dados do perfil de `auth.uid()`, são `SECURITY DEFINER` e usam `search_path` vazio.
- Cinco RPCs administrativas que exigem `auth.uid()` e papel `admin`/`manager` no próprio corpo ainda têm `EXECUTE` efetivo concedido a `anon`: `assign_registered_device_playlist(uuid,uuid)`, `claim_windows_player_pairing(text,jsonb)`, `create_device_installation()`, `preview_windows_player_pairing(text)` e `queue_windows_player_command(uuid,text)`. As chamadas de interface encontradas utilizam o cliente `supabase` autenticado. Embora o controle interno de papel já negue anônimos, a concessão é desnecessária e gera avisos no Advisor.
- O Advisor sinalizou 17 RPCs `SECURITY DEFINER` acessíveis a `anon` e a proteção contra senhas vazadas desativada. **Não** revogar todas automaticamente: RPCs de link público, heartbeat, ativação, recuperação e pareamento do dispositivo utilizam credenciais por token/secret e exigem uma auditoria funcional separada. Aviso do Advisor não comprova, por si só, exploração.

## Mudança proposta nesta PR

A migration `20260918030000_restrict_anon_admin_rpc_execute.sql` remove exclusivamente o `EXECUTE` da função `anon` nas cinco RPCs administrativas listadas. Não altera corpos das funções, RLS, permissões dos outros papéis, dados ou endpoints dos players. Ela termina conferindo que `anon` perdeu acesso efetivo e que `authenticated` e `service_role` o conservaram; se falhar, a migration deve abortar.

## Gate de implantação

1. CI verde e revisão do diff desta PR. A CI atual valida o frontend, mas **não executa migrations** e não comprova esta mudança de grants.
2. Validar a migration primeiro em banco de desenvolvimento isolado. Não há branch de desenvolvimento do Supabase atualmente; a criação de uma branch pode ter custo e exige autorização específica.
3. Solicitar autorização explícita para executar a migration no Supabase real, verificar as cinco permissões com `has_function_privilege`, testar geração de QR, associação de playlists, prévia/aceite do pareamento Windows e fila de comandos usando sessão real admin/manager e tentativa negada a anônimo.
4. Somente após confirmação da CI, auditoria do banco e autorização separada de merge, integrar a PR; conferir CI `main`, deploy Pages e teste real do usuário.

Pendências fora desta PR: testar de fato perfis `admin`, `manager`, `operator` e isolamento entre duas empresas em ambiente separado; analisar individualmente as demais RPCs de dispositivo com `SECURITY DEFINER`; avaliar proteção de senhas vazadas na configuração de Auth. Não descrever a auditoria de metadados como homologação de produção.
