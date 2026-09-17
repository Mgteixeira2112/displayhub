# Histórico de aprovação das 45 referências — PR #326

## Origem auditável

- Capturas geradas no CI de origem: https://github.com/Mgteixeira2112/displayhub/actions/runs/35270739738, commit `18d952128b99c5843225cf8d681acc93f44829f5`.
- Artefato `visual-public-and-internal-fixtures`, ID `10518640238`, ZIP SHA-256 `e32ba71dd9bac7e59fa9dc7d6b68da393ec13d976ed61ae911d29210f722fc5a`.
- As 45 imagens exatas, 15 por dispositivo (desktop, tablet, mobile), foram entregues ao usuário em pacote com galeria HTML e três panoramas. Seus hashes individuais constam de `candidate-review-20260917.json` (registro da etapa original de revisão, cujo `review_state` é histórico, anterior ao aceite).
- O usuário respondeu literalmente **“tudo correto”** após a apresentação do conjunto. Registro explícito na conversa da PR: https://github.com/Mgteixeira2112/displayhub/pull/326#issuecomment-5722598687.

## Execução técnica após aprovação

1. Um job TEMPORÁRIO, restrito à PR #326 e à branch `docs/visual-baseline-candidate-review-20260917`, baixou o artefato identificado, verificou o SHA-256 do ZIP, extraiu e versionou os 45 PNGs e o manifesto no estado `candidate`. O CI desse job passou. O job temporário foi removido antes da proposta de merge e não faz parte da configuração final.
2. A auditoria conferiu os 45 hashes individuais, a quantidade de arquivos e os nomes contra o inventário. O CI com 45 imagens ainda no estado `candidate` passou: https://github.com/Mgteixeira2112/displayhub/actions/runs/35287173568.
3. O manifesto mudou para `approved` **somente na branch desta PR**, vinculando a aprovação acima. A primeira execução revelou um erro técnico no template de caminho do Playwright (procurava arquivos sem `.png`); corrigiu-se apenas a extensão, sem alterar imagens nem tolerâncias.
4. CI com comparação ativa e 45 PNGs exatos: https://github.com/Mgteixeira2112/displayhub/actions/runs/35287544123 — jobs `validate` e `visual-public` concluídos com sucesso.

## Limites e publicação

Nenhuma imagem foi alterada para satisfazer o teste, e a comparação usa `threshold: 0.2`, `maxDiffPixelRatio: 0.005` e `updateSnapshots: 'none'`. As 13 telas internas mostram estados vazios com login e respostas fictícios; as duas públicas cobrem login e cadastro vazio. Este aceite não homologa vídeos, operação do player, permissões específicas, dados reais ou Supabase. **A PR permanece sem merge até autorização específica do usuário**, independente da aprovação das imagens ou do CI.
