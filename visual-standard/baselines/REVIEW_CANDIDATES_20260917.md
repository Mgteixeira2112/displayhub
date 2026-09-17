# Revisão das 45 capturas candidatas — NÃO APROVADAS

Esta é uma PR **exclusivamente de preparação e auditoria da revisão**, não a PR final que versiona as 45 imagens. O manifesto ativo `manifest.json` continua em `pending`; não ativar comparação e não fazer merge desta PR como se as imagens tivessem sido aprovadas.

## Evidências e integridade

- Execução CI de origem (aprovada): https://github.com/Mgteixeira2112/displayhub/actions/runs/35270739738
- Commit exato de origem: `18d952128b99c5843225cf8d681acc93f44829f5` (merge da PR #323).
- Artefato GitHub Actions: `visual-public-and-internal-fixtures`, ID `10518640238`, SHA-256 do ZIP `e32ba71dd9bac7e59fa9dc7d6b68da393ec13d976ed61ae911d29210f722fc5a` (retenção até 2026-09-24, segundo a API do GitHub).
- Inventário com os 45 nomes e hashes SHA-256 individuais: `candidate-review-20260917.json`. O CI confere nomes, hashes e qualquer PNG que venha a ser efetivamente versionado; ele não finge conferir bytes ausentes.
- Organização: 15 capturas por dispositivo, nos modos `desktop`, `tablet` e `mobile`. Cada dispositivo contém `entrar`, `cadastro-vazio` e 13 módulos internos com dados sintéticos.
- O pacote de revisão com galeria HTML, três panoramas e 45 originais foi preparado separadamente e entregue ao solicitante no chat. Este pacote **não está anexado nem versionado nesta PR**. Para obter os originais no GitHub, abra o CI acima e baixe o artefato indicado enquanto estiver disponível.

## Aprovação humana necessária

1. Abrir a galeria `ABRIR_REVISAO.html` do pacote, examinar as visões gerais e, quando necessário, ampliar as 45 imagens originais. Conferir corte, botões, leitura, alinhamento, aparência e responsividade.
2. Confirmar expressamente **o conjunto específico destas 45 capturas**, ou indicar as telas que precisam de ajustes. Não interpretar aprovação anterior da interface geral como aprovação de PNGs de referência.
3. Apenas após isso, transferir os **45 arquivos binários exatos** do artefato para `visual-standard/baselines/images/` nesta branch; confirmar hashes contra `candidate-review-20260917.json`. O CI rejeita PNGs incompletos ou modificados. Em seguida, mudar o manifesto para `candidate` para auditoria e só então para `approved`, com referência inequívoca à aprovação humana na PR e CI verde.
4. Solicitar nova autorização específica para o merge. Não usar atualização automática de screenshots, não editar `main` diretamente e não publicar imagens sem consentimento.

## Limitações

Capturas são da aplicação real renderizada **apenas com login e respostas HTTP fictícios, em estados vazios**. Não há acesso ao Supabase real, dados de clientes, players ou operações de escrita. As imagens de origem foram capturadas no commit indicado; após isso a `main` recebeu alterações separadas em `src/PublicPlayer.tsx` e migration do Supabase. Não usar este conjunto para afirmar homologação de vídeos ou backend. A PR não modifica `src/`, banco, autenticação, players nem o deploy.
