# Referências visuais do DisplayHub — estado `approved` na branch da PR #327

O estado efetivo é definido exclusivamente por [`manifest.json`](manifest.json). Na `main`, a PR [#326](https://github.com/Mgteixeira2112/displayhub/pull/326) integrou 45 PNGs originais (13 áreas internas e duas telas públicas em desktop/tablet/mobile), inventário e hashes SHA-256 auditados, com [aprovação específica](https://github.com/Mgteixeira2112/displayhub/pull/326#issuecomment-5722598687); CI/main e GitHub Pages daquela integração foram confirmados. Na **branch da PR #327**, o novo conjunto de 48 PNGs (14 áreas internas e duas telas públicas × três tamanhos) foi aprovado especificamente e está identificado em [`../approval-record-327.md`](../approval-record-327.md) e no manifesto. **Aprovar as imagens não autoriza o merge da PR #327.** Nenhuma homologação operacional decorre apenas dessas capturas.

## Estados e comportamento

- `pending`: não há imagens aprovadas nem comparação de pixels.
- `candidate`: inventário com exatamente 48 PNGs versionados/auditados, sem comparação de pixels.
- `approved`: exige os 48 PNGs, aprovação humana documentada, hashes íntegros e comparação Playwright de todas as 48 capturas; ausência, dimensões incompatíveis ou diferenças acima do limite bloqueiam o CI.
- `updateSnapshots: 'none'` no Playwright: nunca aceitar nem substituir PNGs automaticamente. `stage-baseline-candidates.cjs` recusa modificar referências já aprovadas.

A comparação real usa `toMatchSnapshot`, `threshold: 0.2` e `maxDiffPixelRatio: 0.005` (0,5%), screenshots de página inteira, animações desativadas, cursor de texto oculto, Chromium e viewports fixos. Examinar as imagens `expected/actual/diff` e relatórios de falhas; não aumentar tolerâncias para ocultar regressões.

## Alteração intencional futura

1. Inspecionar aplicativo e telas afetadas; testar só com login e respostas HTTP fictícios, bloqueando endpoints externos, sockets e escrita real.
2. Preparar candidatas em branch/PR separada, preservando imagens aprovadas. Não rodar staging sobre manifesto `approved`: a proteção contra sobrescrita é intencional.
3. Apresentar o conjunto identificado ao usuário, recolher aprovação explícita **daquelas imagens** e registrar na PR; aprovação anterior ou CI verde não substituem esse aceite.
4. Após a aprovação, versionar apenas o conjunto aceito, verificar nomes, hashes, manifesto e comparações reais no CI, sem ampliar limites artificialmente.
5. Obter autorização específica para o merge da PR; após integração, confirmar CI/main, deploy GitHub Pages do mesmo SHA e teste real do usuário.

## Cobertura e portabilidade

As 48 imagens cobrem somente estados vazios com respostas fictícias; não comprovam estados preenchidos, RBAC real, QR, vídeos, players, Supabase ou operação completa. O teste separado de estados preenchidos e papéis introduzido na `main` cria 27 evidências fictícias, mas não adiciona 27 referências visuais aprovadas nem homologa banco/RLS. Capturas temporárias permanecem em `visual-standard/artifacts/` e não devem ser versionadas. Não copiar PNGs, manifesto, identidade visual ou fixtures do DisplayHub para outros projetos: elaborar inventário e aceite próprios conforme [`../ADOPTION_RUNBOOK.md`](../ADOPTION_RUNBOOK.md).
