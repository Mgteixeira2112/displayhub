# Ficha de adoção — Padrão Visual Universal v1.2

> Salvar uma cópia **por projeto** em uma branch específica depois de inspecionar código/CI/deploy reais. Esta ficha é um modelo; campos vazios significam **não verificado**, nunca aprovado. Consultar `ADOPTION_RUNBOOK.md` na referência DisplayHub. Não copiar CSS, snapshots, credenciais ou conexões de outros produtos.

## Identificação e estado inspecionado

**Projeto e repositório:** [nome / owner/repo]  
**Branch principal e SHA da inspeção:** [nome / SHA]  
**PRs concorrentes que podem interferir:** [links ou nenhum verificado]  
**Stack, gerenciador/lockfile, comandos lint/build/test:** [inspecionar]  
**CI atual e hospedagem/deploy:** [links e workflow real]  
**Origem dos dados, APIs, autenticação e papéis/RBAC:** [descrever sem credenciais]  
**Identidade visual EXISTENTE (tokens, CSS, componentes):** [caminhos]  
**Referência visual pretendida/quem aprova:** [identificador ou pendente]  
**Limites imutáveis:** [funções, menus, banco, integração, player, dados etc.]  
**Viewport(s):** [desktop/tablet/mobile; TV se aplicável; dimensões aprovadas]  
**Ambiente inteiramente fictício e isolamento comprovável:** [configuração, endpoints bloqueados, sem URL/segredo real]  
**Artefatos e retenção sem dados pessoais:** [caminho/nome/prazo]  

## Inventário de páginas e estados

| Área/rota | Estado (vazio/preenchido/erro/permissão etc.) | Dimensão | Fixture sintética | Navegação/erro/overflow | Captura | Baseline aprovada | Teste real | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [página real] | [estado] | [dimensão] | [sim/não] | pendente | pendente | pendente | pendente | [por quê] |

**Total esperado de capturas = número real de combinações página × estado × dimensão inventariadas:** [N após inspeção]. Não herdar 45 do DisplayHub sem inventário correspondente.  
**Fluxos não cobertos ou inseguros para fixture (ex.: escrita, dados pessoais, QR, players, RLS):** [listar expressamente].  
**Lote visual autorizado e critérios de aceite:** [páginas e referência]  
**O que exige outra PR (lógica, permissões, banco, deploy etc.):** [listar]  

## Adaptação técnica do kit

| Peça | Evidência/configuração neste projeto | Situação |
| --- | --- | --- |
| Inventário de telas e estados | [arquivo] | pendente |
| Testes públicos e internos | [arquivos] | pendente |
| Interceptação e bloqueio de externas, escrita e sockets | [teste/arquivo; nunca usar produção] | pendente |
| Configuração Playwright/servidor/viewports | [arquivo] | pendente |
| Snapshots do próprio produto, aprovação e hashes | [manifesto/PR do aceite] | pendente |
| CI: lint, build, testes, imagens exatas, relatório | [workflow/run] | pendente |
| Deploy condicionado a CI completo e SHA idêntico | [workflow/run] | pendente |
| Teste de regressão controlada (falha esperada) | [evidência] | pendente |

**Não importar do DisplayHub:** PNGs, manifesto, CSS Cockpit, dados/URLs de produção, fixtures de autenticação, caminhos e seletores específicos.  
**Critério de comparação do produto:** [versão do navegador, fontes, tamanhos, thresholds aprovados ou NÃO COBERTO].  
**Política de atualização de imagens:** `updateSnapshots: 'none'` no CI; nova PR e novo aceite expresso.  
**Permissão de merge:** autorização explícita para a PR específica, mesmo após aprovar imagens.  

## Gates para cada PR e publicação

- [ ] A — Inspeção e inventário reais concluídos; pendências explícitas.
- [ ] B — Ambiente sintético sem externos/escrita real; testes, lint/build e evidências aprovados.
- [ ] C — Imagens do próprio produto aprovadas expressamente, versionadas com integridade e comparação ativa (ou registrar `não coberto`).
- [ ] D — Diff/SHA verificados, CI da PR verde, merge da PR **especificamente autorizado**.
- [ ] E — CI integral da principal e deploy do **mesmo SHA** concluídos com sucesso.
- [ ] F — Proprietário homologou no sistema real ou pendência claramente registrada.

## Registro de encerramento

**PR e escopo exato:** [URL]  
**SHA da PR / SHA do merge:** [SHAs]  
**CI PR / CI principal:** [links + conclusões]  
**Inventário/capturas/artefatos:** [contagem e links]  
**Aprovação de imagens:** [quem, quando, identificador, PR; ou pendente]  
**Deploy:** [URL, SHA, job, conclusão]  
**Homologação real:** [aprovada/ajustes/pendente + data]  
**Cobertura NÃO alcançada e próxima PR:** [lista/links]
