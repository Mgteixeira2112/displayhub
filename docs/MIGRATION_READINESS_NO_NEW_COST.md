# DisplayHub — continuidade sem novo Supabase e preparação para migração futura

Estado em 18/09/2026. Fonte da verdade atual: projeto `meqeluddtwthqmrtbhbr`. **Não criar projetos/branches pagos nem executar migração, exportação de dados ou alteração no banco por este documento.** Este arquivo é um roteiro verificável, não uma declaração de que a portabilidade foi homologada.

## Decisão atual: um único projeto, custo adicional de infraestrutura zero

- Permanecer no Supabase atual. O código e as migrations ficam versionados no GitHub e toda alteração de banco exige aprovação específica.
- Os dados de empresas diferentes já são organizados com `company_id` e policies RLS nas tabelas inspecionadas. Auditoria de metadados: 26/26 tabelas `public` com RLS habilitado; não foi executado teste real entre sessões e empresas. A segurança depende de conferir todas as policies, RPCs `SECURITY DEFINER`, Storage e funções públicas, e não apenas da presença de RLS.
- Se futuramente precisarmos de ensaios funcionais de isolamento dentro deste mesmo projeto, criar apenas dados e contas sintéticos, com empresa própria, após autorizar gravação; manter todos os testes em escopo e limpar com rastreabilidade. Isso separa registros pela política RLS, **não cria ambiente de homologação independente**. Não usar clientes, displays ou tokens reais nos testes.
- Não criar schema `teste` como solução para a PR #331: `REVOKE EXECUTE` nas cinco funções do schema `public` altera as permissões dessas próprias funções em todo o projeto, inclusive para outras empresas; Auth, Storage, configurações e capacidade também são compartilhados.

## Validação da PR #331 sem contratar outro projeto

1. Revisar diff e assinatura exata de cada uma das cinco RPCs, `pg_proc`, grants e `has_function_privilege`, tudo com consultas de metadados de leitura. Comparar ao estado atual e registrar resultado sem consultar registros de clientes.
2. Revisar SQL da migration, restrito a `REVOKE EXECUTE ... FROM anon` e assertivas que exigem: `anon = false`, `authenticated = true`, `service_role = true`. Rever dependências do app (`supabase` autenticado) e não alterar RPCs de players que dependem de token/secret.
3. Caso exista Docker e Supabase CLI local, reproduzir a sequência de migrations com **dados fictícios** em ambiente local independente. Primeiro conferir se a sequência corresponde ao esquema remoto; não afirmar equivalência sem checagem de drift. Usar comandos explícitos `--local` quando disponíveis. `supabase db reset --linked` e qualquer reset no projeto remoto são proibidos.
4. Se ambiente local não estiver disponível, registrar que apenas validação estática foi possível. Não fingir teste isolado usando `BEGIN/ROLLBACK` no banco de produção: DDL pode bloquear operações e chamadas RPC podem provocar efeitos externos não revertidos por rollback.
5. Antes de executar no mesmo banco real: autorização explícita, horário de baixo impacto, captura dos grants atuais, revisão de dependências e rollback preparado. Executar somente a migration aprovada, verificar grants efetivos imediatamente e depois homologar funções administrativas com usuários legítimos de teste; nunca enviar reboot ou comandos reais por engano. Merge da PR requer autorização separada. CI frontend/visual não testa essa migration.

## Inventário necessário para tornar a transferência reproduzível

| Camada | O que versionar ou mapear agora | Etapa futura que exige autorização |
| --- | --- | --- |
| Banco | Ordenação e cobertura de `supabase/migrations`, extensões, tabelas, indexes, triggers, policies RLS, funções/grants, schemas `public`/`private` e histórico de migrations; comparar com metadados reais para identificar drift | Exportar/importar esquema e dados por mecanismo adequado; validar integridade e relações entre empresas |
| Auth | Modelo `profiles`, gatilhos de cadastro, provedores e configurações de login/redirecionamento; estratégia para IDs de usuários e sessões | Transferência de usuários/identidades conforme métodos suportados; credenciais e sessões podem precisar de procedimento específico |
| Storage | Inventário de buckets, visibilidade, policies, padrões de caminho e referências no banco | Transferir arquivos/objetos separadamente e verificar referências/URLs; SQL de tabelas não copia arquivos |
| Edge Functions e Realtime | Listar funções deployadas, configurações, triggers, broadcasts, eventuais cron/webhooks e papéis | Reimplantar funções, configurar eventos e validar autenticação com credenciais novas |
| Frontend e players | Identificar `VITE_SUPABASE_URL`, chave publicável, GitHub Actions/Pages e URLs de função ou domínios embutidos nos players/SQL; mapear links públicos e QR Codes | Atualizar configurações e integrações com cautela; validar Windows, Android, dispositivos registrados, links e revogações |
| Segredos e domínio | Somente **nomes** das variáveis, onde são provisionadas e responsáveis; jamais copiar valores ao GitHub | Provisionar/rotacionar segredos, URLs de callback, SMTP/provedores e DNS conforme necessidade |
| Operação | Plano de backup, janela, verificações, inventário de dispositivos, critério de sucesso e reversão | Congelar novas gravações quando necessário, sincronização final, troca de endpoint, monitoramento e retorno se falhar |

O repositório conter migrations e o build passar **não garantem** recuperação integral de Auth, Storage, dados, segredos e URLs. Antes de prometer uma migração pronta, auditar diferenças entre o Supabase real e os arquivos versionados e ensaiar a reconstrução. Não exportar dados pessoais nem publicar dumps no repositório.

## Sequência de futura migração, somente se houver motivo e aprovação

1. Inventariar dependências, custos, restrições, backup e ponto de retorno. Confirmar que novo projeto é necessário.
2. Recriar infraestrutura separada apenas após autorização e verificar migrações/histórico. Configurar extensões, Auth, Storage, policies, functions, Realtime e segredos, sem dados reais inicialmente.
3. Validar dados sintéticos, permissões entre empresas, mídias, players, programação e URLs. Separar testes técnicos de dados de clientes.
4. Definir estratégia e autorização para copiar dados/usuários/objetos e consistência de gravações. Verificar contagens, IDs, integridade referencial, buckets e permissões antes da troca.
5. Planejar cutover de URL/chaves/players, período de observação, revogação/rotação e rollback. Somente declarar homologação depois dos testes reais.

## Referências oficiais

- Desenvolvimento local e migrações: https://supabase.com/docs/guides/local-development/cli-workflows
- Testes locais: https://supabase.com/docs/guides/local-development/cli/testing-and-linting
- Custo de branches cloud (não criar nesta fase): https://supabase.com/docs/guides/platform/manage-your-usage/branching
