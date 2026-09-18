# Roteiro de adoção por projeto — Padrão Visual Universal v1.2

**Uso:** executar este roteiro separadamente para cada repositório. O DisplayHub é uma implementação demonstrada, não uma dependência, biblioteca instalável ou identidade visual compartilhada. A primeira implantação em outro projeto ainda NÃO foi realizada. Preencha [`PROJECT_SETUP_TEMPLATE.md`](PROJECT_SETUP_TEMPLATE.md), salve uma cópia versionada no repositório de destino em uma branch e faça uma PR dedicada.

## Portabilidade: o que levar e o que reescrever

| Item do piloto DisplayHub | Decisão no novo projeto |
| --- | --- |
| `README.md` (processo e gates), este roteiro e `PROJECT_SETUP_TEMPLATE.md` | Reutilizar como documentação e adaptar nomes, hospedagem e comandos. |
| `screen-inventory.cjs` | **Reescrever** a partir das páginas/estados reais. Não assumir 13 áreas, 2 públicas ou 45 imagens. |
| `playwright.config.cjs` | **Adaptar** framework, URL/base path, portas, comando de servidor, Chromium/viewports, diretório de snapshots e variáveis de ambiente fictícias. Não usar URL de banco real. |
| `tests/public-auth.spec.cjs`, `tests/internal-auth.spec.cjs` | **Reescrever seletores, rotas, navegação, HTTP simulado e usuários falsos**. Preservar isolamento, bloqueio de escrita, overflow, erros e screenshots. |
| `visual-baseline.cjs`, `check-candidate-review.cjs`, `stage-baseline-candidates.cjs` | Usar somente como exemplos **após** adaptar inventário, diretórios, contagem, formatos, estados e critérios de integridade. Não copiar PNGs. |
| `.github/workflows/ci.yml` e `deploy-pages.yml` | Adaptar aos workflows e hospedagem já existentes. Adicionar checks sem remover os anteriores; deploy condicionado ao CI integral da branch principal, mesmo SHA aprovado. Não substituir pipeline funcional sem inspeção. |
| `baselines/images/*.png`, `baselines/manifest.json`, `candidate-review-20260917.json`, CSS Cockpit, fixtures e URLs de produção | **Não transportar.** Cada projeto precisa de imagens e aceite próprios; não reaproveitar usuários, endpoints nem estilo visual. |

## Etapa A — Descoberta, sem escrever código

1. Identificar branch padrão e HEAD, PRs em andamento, frameworks, scripts de lint/build, CI, deploy, origem de dados, autenticação/RBAC, CSS/tokens, rotas e componentes.
2. Preencher a ficha com **cada página e estado importante** (vazio, preenchido, erro, loading, permissões) e dispositivos; distinguir estados atualmente implementados daqueles apenas planejados.
3. Classificar fluxos e integrações de risco (pagamento, dados pessoais, reservas, player, TV, câmera, mensagens, armazenamento, exclusão). Para cada um, declarar modo de teste seguro ou **não coberto**.
4. Definir restrições imutáveis e identidade específica; acordar lote visual antes de propor mudanças.

**Gate A:** ficha preenchida, páginas inventariadas e limites de teste claros. Sem isso, não copiar scripts do DisplayHub.

## Etapa B — Adaptação dos testes, PR própria

1. Criar branch baseada no HEAD recente da principal; não editar a principal diretamente. Conservar pipeline já existente e usar dependências/lockfile do projeto quando possível.
2. Construir ambiente local/efêmero: dados e contas inventados; interceptar e rejeitar explicitamente chamadas externas inesperadas, sockets e operações mutáveis. Confirmar que nenhum navegador/runner usa segredos ou o banco real.
3. Adaptar Playwright e inventário às rotas reais. Capturar tela completa nos tamanhos acordados; aguardar fontes/carregamento determinístico; desabilitar animações e caret. Verificar erros de página, overflow e elementos relevantes. **Não classificar conteúdo apenas por screenshot**: verificar também acessibilidade e navegação quando pertinente.
4. Exigir no CI inventário exato, screenshots esperadas, relatórios e upload de evidências sem dados pessoais. Não exigir o número 45 em outro produto sem justificativa; registrar contagem calculada pelo inventário específico.
5. Criar teste controlado de regressão em branch efêmera ou alteração reversível local: verificar que um desvio acima dos limites faz a checagem falhar. Reverter o desvio antes de concluir.

**Gate B:** lint/build/testes verdes, bloqueio real de externas/escritas demonstrado, inventário e evidências verificáveis. CI verde sem imagens aprovadas significa **somente captura**, não comparação homologada.

## Etapa C — Referências visuais e ativação

1. Gerar imagens candidatas **do próprio produto** e criar pacote de revisão por página/dispositivo; validar inventário, ausência de informações privadas e integridade/hash.
2. Entregar ao proprietário e pedir **aprovação expressa do conjunto identificado**; registrar referência na PR. Não inferir aprovação de build verde, silêncio ou aceite de outro projeto.
3. Versionar somente imagens aprovadas, ligar `approved` no manifesto específico e rodar comparações reais em CI (`updateSnapshots: 'none'`). Manter limiares documentados e evidências `expected/actual/diff` nas falhas.
4. Se houver divergência, investigar fonte (fontes, dados, tempo, viewport, mudança desejada); corrigir instabilidade ou obter nova aprovação. Nunca aumentar tolerância nem autoatualizar baseline para apenas deixar CI verde.

**Gate C:** conjunto aprovado, arquivos íntegros, testes da PR aprovados; merge só após consentimento específico para aquela PR.

## Etapa D — Publicação, homologação e repetição

1. Confirmar HEAD e diff, CI da PR e ausência de mudanças operacionais indevidas; obter autorização explícita **da PR concreta**.
2. Após merge, confirmar CI completo na principal. Deploy deve publicar o **mesmo SHA aprovado** e terminar com sucesso; verificar URL/site. Não declarar sucesso antes dos jobs finalizarem.
3. Solicitar teste visual/funcional real ao proprietário nas páginas e estados combinados; registrar aprovado, ajustes ou não coberto. Screenshots sintéticas e build não equivalem a homologação operacional.
4. Para mudança futura intencional, propor PR visual e nova revisão de snapshots; manter outros módulos e projetos isolados.

**Gate D:** CI/main + deploy confirmados, homologação real documentada ou explicitamente pendente.

## Estratégia de automação incremental

- **Já demonstrada no DisplayHub:** CI lint/build/CSS, navegador isolado, 45 PNGs e hashes, comparação Playwright em três viewports e deploy dependente de CI/main.
- **A instalar em cada produto mediante inspeção/PR:** descoberta de páginas e fixtures próprias, testes de estado preenchido/erro/permissão, inventário real, comparação aprovada e gates de hospedagem compatíveis.
- **Nunca automatizar:** aprovar identidade visual, aprovar snapshots, autorizar merge ou declarar homologação humana.
- **Fora do escopo desta versão documental:** um instalador que edite outros repositórios, pipeline compartilhado entre contas, fixture universal, cobertura completa de fluxos reais.

## Critérios de aceite da adoção

Uma adoção é considerada concluída apenas quando a ficha indica a cobertura real, PR de adaptação específica está integrada com autorização, CI principal e publicação verificados e proprietário concluiu homologação combinada. O título “Padrão Visual Universal” descreve o **procedimento replicável**, não a portabilidade direta dos seletores, imagens ou integrações.
