# Referências visuais do DisplayHub — estado atual `approved`

O estado efetivo deve ser lido em [`manifest.json`](manifest.json). A PR [#326](https://github.com/Mgteixeira2112/displayhub/pull/326) foi integrada com autorização específica: contém 45 PNGs originais (13 áreas internas + 2 telas públicas × desktop/tablet/mobile), inventário e hashes SHA-256 conferidos no CI. A aprovação expressa do conjunto está registrada no [comentário de aceite](https://github.com/Mgteixeira2112/displayhub/pull/326#issuecomment-5722598687). O CI da `main` e a publicação Pages dessa PR terminaram com sucesso. Essa aprovação diz respeito às imagens sintéticas, não a todos os fluxos operacionais reais.

## Estados e comportamento implementado

- `pending`: sem imagens aprovadas, sem comparação de pixels.
- `candidate`: inventário com exatamente 45 PNGs versionados e auditados, mas ainda sem comparação de pixels.
- `approved`: exige 45 PNGs, referência de aprovação humana no manifesto e executa comparação Playwright de **todas as 45 capturas**. Imagem ausente, hash diferente, dimensão diferente ou diferença acima do limite bloqueia o CI.
- `updateSnapshots: 'none'` no Playwright: nunca substituir ou aprovar diferenças automaticamente. `stage-baseline-candidates.cjs` recusa modificar referências no estado `approved`.

A execução real usa `toMatchSnapshot` com `threshold: 0.2` e `maxDiffPixelRatio: 0.005` (máximo de 0,5% de pixels distintos, conforme semântica do Playwright), screenshots de página completa, animações desativadas, caret oculto e Chromium/viewports fixos. Falhas devem ser investigadas pelo relatório e pelas imagens `expected/actual/diff`; tolerâncias não devem ser aumentadas para mascarar regressão.

## Atualização intencional das referências

1. Inspecionar o aplicativo e identificar quais telas mudarão. Usar somente ambiente, login e respostas sintéticas; bloquear serviços externos e escrita real.
2. Criar branch/PR específica; preservar o conjunto atual. Gerar candidatas **separadamente** e comparar `expected`, `actual` e `diff`. **Não executar o script de staging sobre o manifesto `approved`: ele bloqueia essa operação intencionalmente.** Preparação de novas candidatas requer um fluxo separado que preserve integralmente as imagens originais até aprovação.
3. Apresentar as imagens propostas ao proprietário, identificar exatamente o conjunto e registrar o aceite explícito na PR. CI verde ou aprovação anterior não substituem esse consentimento.
4. Após a aprovação, versionar apenas o conjunto aceito e atualizar manifesto/inventário/hash sem aceitar novas diferenças automaticamente; executar novamente CI com comparação real ativa. Resolver divergências sem afrouxar limiares.
5. Solicitar **nova autorização específica para merge da PR**; confirmar CI `main` e publicação do mesmo SHA; pedir homologação das telas reais após deploy.

## Abrangência e portabilidade

As 45 capturas cobrem **estados vazios com respostas HTTP fictícias**. Não comprovam dados preenchidos, diferenças por papel/RBAC, QR, vídeos, players, Supabase real ou operação funcional completa. Artefatos temporários ficam em `visual-standard/artifacts/` e não devem ser versionados. Nos demais projetos não copiar estas imagens nem o manifesto: criar inventário, baselines e aceite próprios conforme [`../ADOPTION_RUNBOOK.md`](../ADOPTION_RUNBOOK.md).
