# Referências visuais — aprovação obrigatória

**Estado atual: `pending`.** O CI captura e anexa 45 imagens sintéticas, mas NÃO compara pixels até que imagens-base sejam examinadas e aprovadas em PR própria. CI verde neste estado não significa comparação visual aprovada. As 13 telas internas representam componentes reais em estados vazios; não testam dados preenchidos, permissões, QR, player ou Supabase de produção.

## Como preparar imagens candidatas (somente em uma branch nova)

1. Inspecione as 45 capturas do CI em desktop, tablet e celular, confirme que não há dados privados e que representam a aparência desejada. Não aprove automaticamente os artefatos do CI.
2. Em checkout da **branch de candidatos**, execute `npm ci`, instale Playwright 1.55.0 temporariamente como no CI, `npx playwright install chromium`, `npx playwright test --config visual-standard/playwright.config.cjs` e `node visual-standard/stage-baseline-candidates.cjs`. O script exige 45 PNGs distintos e prepara `baselines/images/*.png` e `manifest.json` no estado `candidate`; não cria commit e não altera `main`.
3. Abra uma PR **separada e identificada** contendo somente o manifesto e as 45 imagens candidatas. Compare visualmente as imagens da PR (ou o artefato). Solicite aprovação humana explícita do conjunto e registre a confirmação na conversa da PR.
4. **Somente após confirmação**, atualize `manifest.json` para `status: "approved"` e preencha `approval: { "pr": <número da PR>, "confirmation": "<referência inequívoca à aprovação expressa>" }`. Os 45 nomes de arquivo devem corresponder exatamente ao inventário. O CI da mesma PR agora exige que todas as 45 imagens PNG existam e compara cada screenshot do navegador com o baseline versionado.
5. Se uma comparação falhar, examine as imagens *expected/actual/diff* no relatório, corrija instabilidade legítima ou solicite novo aceite para mudanças visuais. **Nunca atualize o baseline automaticamente para deixar o CI verde.** Só fazer merge após CI aprovado e nova autorização específica para aquela PR.

## Critérios implementados

- Capturas `fullPage` com animações desativadas e cursor de texto oculto; Chromium/viewport fixados na configuração.
- Playwright `toMatchSnapshot` com `threshold: 0.2` e `maxDiffPixelRatio: 0.005` (até 0,5% dos pixels alterados), sujeito à revisão por projeto. Alteração de dimensão falha. Os diffs são anexados ao relatório HTML em caso de divergência.
- `updateSnapshots: 'none'` no teste e verificação do CI contra mudanças nas imagens de referência. O manifesto em `candidate` jamais é considerado aprovado.
- O registro de aprovação é metadado para auditoria; sua autenticidade é confirmada por revisão humana da conversa da PR, não por um campo de texto isolado.
- A pasta `artifacts/` não deve ser commitada. Testes são sintéticos, sem acesso à produção; o kit deve ser adaptado à arquitetura de cada novo projeto, não copiado cegamente.
