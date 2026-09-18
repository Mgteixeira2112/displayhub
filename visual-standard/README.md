# Padrão Visual Universal — v1.2 (referência: DisplayHub)

**Finalidade:** repetir o processo de inspeção, implementação, testes visuais e homologação em produtos diferentes, sem copiar a identidade gráfica, a arquitetura ou os dados do DisplayHub. Este repositório é o **piloto de referência**; o kit não está instalado nos demais projetos nem é um instalador universal pronto para executar sem adaptação.

## Estado confirmado em 17/09/2026

- PR #319: piloto de navegador público e deploy Pages condicionado ao CI verde da `main`; proprietário confirmou acesso e navegação após a publicação.
- PR #320: 13 áreas internas reais com autenticação e HTTP **fictícios**, além de duas telas públicas, em três dimensões; total de **45 capturas**. A navegação é exercitada em estados vazios.
- PR #323: mecanismo de comparação com snapshots e bloqueio de atualização automática, inicialmente sem referências aprovadas.
- PR #326: proprietário aprovou expressamente o conjunto de 45 PNGs; arquivos originais e hashes versionados; `manifest.json` passou para `approved` e as **45 comparações estão ativas**. CI da PR e da `main`, além do deploy Pages, concluídos com sucesso. O aceite dessas imagens não equivale a homologar todas as operações do produto.
- PR #328: kit portátil v1.2 documentado, CI da `main` e deploy validados. O kit continua exigindo inspeção e adaptação por projeto.

A fonte efetiva do estado das imagens é [`baselines/manifest.json`](baselines/manifest.json), não a data do texto. O fluxo de produção está em `.github/workflows/deploy-pages.yml` e publica exclusivamente o SHA aprovado por CI integral da `main`.

## Procedimento de uso obrigatório

1. **Inspecionar estado real:** stack, CI, publicação, identidade gráfica, componentes, telas/estados, autenticação, RBAC, API e banco. Registrar itens não cobertos e não inventar recursos.
2. **Definir escopo e referência:** aprovar a aparência pretendida de cada produto e delimitar um lote visual. Funcionalidades, banco, segurança e players exigem PRs distintas. Não reutilizar CSS de outro produto automaticamente.
3. **Preparar testes isolados:** inventariar estados/tamanhos; simular usuários, respostas e conteúdos sem acesso a produção; bloquear endereços e escritas não previstos. Estado inacessível de forma segura deve constar como não coberto.
4. **Implementar em branch:** usar componentes existentes e alterações pequenas e reversíveis, nunca escrever diretamente na `main`.
5. **Validar e coletar evidências:** executar lint/build, verificações específicas e Playwright com navegação, erros, overflow, screenshots e artefatos sem dados pessoais. Captura não substitui verificação funcional.
6. **Aprovar baselines:** apresentar candidatas ao proprietário, registrar aprovação expressa do conjunto identificado, versionar imagens e hashes em PR específica, ativar comparação sem atualização automática. Diferenças demandam análise, não aceite automático.
7. **Publicar com autorização:** comparar diff e SHA, exigir CI da PR verde e permissão específica para **aquela PR**; após merge, conferir CI integral da `main`, build/deploy do **mesmo SHA** e URL publicada.
8. **Homologar operação real:** proprietário testa a área combinada na aplicação publicada; registrar aceite ou pendências, sem chamar CI ou screenshots de homologação funcional.

## Implementação disponível no DisplayHub

- [`playwright.config.cjs`](playwright.config.cjs): Chromium, desktop 1440×900, tablet 768×1024, mobile 390×844; `updateSnapshots: 'none'`; base local Vite com variável de Supabase fictícia.
- [`screen-inventory.cjs`](screen-inventory.cjs): inventário **específico deste produto** (13 áreas internas + 2 telas públicas × 3). Não transportá-lo para outro projeto sem reescrever.
- [`tests/public-auth.spec.cjs`](tests/public-auth.spec.cjs): login e cadastro público vazios, rótulos, overflow e exceções; seis capturas.
- [`tests/internal-auth.spec.cjs`](tests/internal-auth.spec.cjs): monta o aplicativo real com autenticação/HTTP interceptados e sintéticos, bloqueia requisições externas não previstas, gravações, RPC e WebSocket fictício; verifica 13 áreas vazias, overflow, títulos e exceções; 39 capturas. Script de QR neutralizado exclusivamente no teste.
- [`tests/filled-roles.spec.cjs`](tests/filled-roles.spec.cjs): cobertura adicional com dois displays fictícios, uma playlist/publicação, uma oferta e um conteúdo HLS de exemplo. Nos perfis `admin`, `manager` e `operator`, confere métricas, cartões e visibilidade dos controles de criação/exclusão de telas e mídia em Início/Telas/Conteúdo, nos três tamanhos. Gera **27 capturas adicionais apenas como evidência**, sem compará-las com snapshots oficiais: a aprovação das imagens-base continua restrita às 45 imagens originais. Não testa o backend/RLS nem executa escritas ou mídias.
- [`visual-baseline.cjs`](visual-baseline.cjs): para manifesto `approved`, `toMatchSnapshot` compara cada PNG oficial com `threshold: 0.2` e `maxDiffPixelRatio: 0.005`; não modifica referências.
- [`check-candidate-review.cjs`](check-candidate-review.cjs): confere nomes, origem e hashes SHA-256 das 45 imagens. O inventário e quantidade são propositalmente fixos para o DisplayHub.
- [CI](../.github/workflows/ci.yml): `validate` exige lint, build e smokes Cockpit; `visual-public` valida manifesto/hashes, executa Playwright, exige 45 capturas comparadas e 27 capturas adicionais preenchidas e anexa relatório HTML e imagens por 7 dias.
- [Deploy Pages](../.github/workflows/deploy-pages.yml): só inicia após CI da `main` concluído com sucesso e publica o SHA testado.

**Execução local deste piloto:** `npm ci`; `npm install --no-save --package-lock=false @playwright/test@1.55.0`; `npx playwright install chromium`; `npx playwright test --config visual-standard/playwright.config.cjs`. A aplicação local de teste usa dados fictícios; nunca aponte esse fluxo para produção.

## O que está e não está coberto

**Coberto pelos testes existentes:** comparação de 45 imagens aprovadas em estados vazios; navegação das 13 áreas, duas telas públicas, três dimensões, overflow, campos públicos sem rótulo, erros JS, build/lint/smokes e gate do deploy. O teste complementar verifica dados preenchidos **somente** em Início/Telas/Conteúdo e presença/ausência dos controles de criação/exclusão de telas e mídia para três perfis de interface, com 27 screenshots adicionais não aprovados como baseline.

**Não coberto:** todos os estados preenchidos de todas as áreas, formulários de gravação, autenticação/autorização real, RLS e permissões efetivas do Supabase, QR/pareamento, playlists em execução, player/TV/Android/Windows, bancos de produção, diferenças em outros navegadores e teste funcional de ponta a ponta. A ausência de botões para operador não demonstra segurança do backend. Não afirmar cobertura integral do produto.

## Como reutilizar em outro projeto

Leia [`ADOPTION_RUNBOOK.md`](ADOPTION_RUNBOOK.md) e preencha [`PROJECT_SETUP_TEMPLATE.md`](PROJECT_SETUP_TEMPLATE.md) após inspecionar o repositório de destino. **Portáveis:** procedimento, inventário por estado, regras de isolamento, gate CI/merge/deploy e processo de aceite. **Adaptáveis, nunca copiar cegamente:** `playwright.config.cjs`, `tests/`, `screen-inventory.cjs`, `visual-baseline.cjs`, checagem de hashes, seletores, rotas, fixtures e workflows. **Não transportar:** imagens aprovadas do DisplayHub, CSS Cockpit, URLs/credenciais ou dados do projeto, autenticação e dados de produção.

O roteiro apresenta checkpoints executáveis e critérios de parada; a migração e o código automatizado do novo projeto exigem PR própria, CI verde e autorização de merge. Cada sistema mantém sua própria identidade visual e conjunto de snapshots aprovados.

## Próximas etapas separadas

1. Ampliar os estados sintéticos com formulários e dados complexos, e testar permissões reais em ambiente de teste isolado apropriado, sem expor produção.
2. Aplicar o roteiro a um segundo repositório, medir quais partes são realmente reaproveitadas e aprimorar o kit com o resultado.
3. Se desejar comparar as 27 capturas preenchidas por pixels, submetê-las primeiro à revisão humana e criar baselines em outra PR; nunca aprovar automaticamente.

**Checklist de fechamento de toda PR:** escopo/diff verificados, dados protegidos, CI do SHA verde, comparações e evidências presentes, merge especificamente autorizado, CI `main` e deploy conferidos, homologação real registrada ou indicada como pendente.
