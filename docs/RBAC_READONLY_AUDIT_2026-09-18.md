# Auditoria de RBAC e RPC — DisplayHub — 18/09/2026

Escopo: inspeção **somente de metadados** do projeto Supabase `meqeluddtwthqmrtbhbr`, comparada às chamadas do frontend na `main` em `9cba427eadcb577fbc77cdeb4daca0f41317a4e6`. Não foram lidas linhas de clientes nem realizados login, alteração de dados, DDL ou chamadas RPC. Isto **não é homologação real de RLS**.

## Evidências

- As 26 tabelas do schema `public` inspecionadas estão com RLS ativo. As policies de tabelas por empresa inspecionadas usam `private.current_company_id()`; gravações administrativas usam `private.current_user_role()` conforme política. `promotion_templates` expõe leitura de modelos globais ativos aos autenticados, de modo intencional, sem filtro por empresa.
- As funções `private.current_company_id()` e `private.current_user_role()` buscam dados do perfil de `auth.uid()`, são `SECURITY DEFINER` e usam `search_path` vazio.
- Cinco RPCs administrativas que exigem `auth.uid()` e papel `admin`/`manager` no próprio corpo ainda têm `EXECUTE` efetivo concedido a `anon`: `assign_registered_device_playlist(uuid,uuid)`, `claim_windows_player_pairing(text,jsonb)`, `create_device_installation()` e `preview_windows_player_pairing(text)` e `queue_windows_player_command(uuid,text)`. As chamadas de interface encontradas utilizam o cliente `supabase` autenticado. Embora o controle interno de papel já negue anônimos, a concessão é desnecessária e gera avisos no Advisor.
- O Advisor sinalizou 17 RPCs `SECURITY DEFINER` acessíveis a `anon` e a proteção contra senhas vazadas desativada. **Não** revogar todas automaticamente: RPCs de link público, heartbeat, ativação, recuperação e pareamento do dispositivo utilizam credenciais por token/secret e exigem uma auditoria funcional separada. Aviso do Advisor não comprova, por si só, exploração.

## Mudança proposta nesta PR

A migration `20260918030000_restrict_anon_admin_rpc_execute.sql` remove exclusivamente o `EXECUTE` do papel `anon` nas cinco RPCs administrativas listadas. Não altera corpos das funções, RLS, permissões dos outros papéis, dados ou endpoints dos players. Ela termina conferindo que `anon` perdeu acesso efetivo e que `authenticated` e `service_role` o conservaram; se falhar, a migration deve abortar.

## Diretriz de custo e isolamento

- **Não criar projeto, branch Supabase paga ou infraestrutura adicional.** Continuar no mesmo projeto por ora. Registrar migration, diff, checagens e rollback em GitHub, sem execução em produção sem autorização.
- Isolamento por `company_id` + RLS separa dados das empresas, não permissões de funções já existentes. Criar um schema `teste` no mesmo Postgres **não** isola o `EXECUTE` das cinco funções `public` nem separa Auth, Storage ou recursos do projeto. Não é equivalente a banco de homologação.
- Etapa gratuita sem efeitos colaterais: conferir código, lista de funções, definições e grants via metadados/consultas SELECT; verificar se o SQL tem apenas as cinco assinaturas permitidas e pós-condições. CI frontend/visual é apenas regressão de UI, não validação do SQL.
- Se estiver disponível um computador com Docker e Supabase CLI, reproduzir migrations localmente com dados **exclusivamente sintéticos** e testar grants/RLS lá, sem instanciar projeto cloud. Verificar histórico e drift antes de presumir que as migrations reproduzem o Supabase real; `db reset` deve apontar explicitamente ao local. Nenhum passo local foi executado nesta auditoria.
- Se não houver Docker, manter a migration pendente, fazer revisão estática e decidir posteriormente sobre aplicação controlada no único banco real, com autorização específica, horário adequado, registro prévio dos grants, pós-verificação e plano de reversão. Não chamar isso de teste isolado. Não executar DDL de ensaio no projeto real nem invocar funções com efeitos colaterais só para testar.

## Gate de implantação no banco existente

1. CI verde do HEAD e diff limitado. Revisar as cinco assinaturas e grants efetivos atuais, sem ler dados de clientes.
2. Se possível, reproduzir o estado em Supabase local com dados inventados. Não exigir nem criar branch cloud. Caso impossível, documentar explicitamente que a validação dinâmica prévia está pendente.
3. Obter autorização específica para aplicar a migration no projeto real; registrar grants antes, executar apenas a migration aprovada, conferir `has_function_privilege` após, testar com sessões legítimas admin/manager e tentativa anônima sem emitir comandos destrutivos nem manipular dispositivos de clientes. Preparar janela/rollback.
4. Somente com autorização distinta para merge, integrar esta PR; verificar CI da `main`, GitHub Pages e homologação real. Merge GitHub **não** aplica esta migration automaticamente.

## Rollback de emergência — somente mediante autorização

Caso alguma integração inesperada dependa de `anon`, interromper a implantação e investigar primeiro; não reabrir permissões automaticamente. Após autorização expressa para rollback, restaurar as permissões anteriores com `GRANT EXECUTE ON FUNCTION` para `anon` nas cinco assinaturas exatas acima e verificar as concessões com `has_function_privilege`. Registrar o motivo e preparar uma migration de rollback separada; esta reversão reabre a exposição que motivou a correção.

## Preparação para migração futura

Ver `docs/MIGRATION_READINESS_NO_NEW_COST.md`. Exportação de dados de clientes, Auth, Storage, mudança de URLs/segredos e cutover exigem etapas e aprovações próprias; migrations SQL não garantem migração integral sozinhas.

Pendências fora desta PR: testar de fato perfis `admin`, `manager`, `operator` e isolamento entre duas empresas com dados inventados; analisar individualmente as demais RPCs de dispositivo com `SECURITY DEFINER`; avaliar proteção de senhas vazadas na configuração de Auth. Não descrever a auditoria de metadados como homologação de produção.
