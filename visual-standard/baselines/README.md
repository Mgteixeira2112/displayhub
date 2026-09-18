# Referências visuais — aprovação obrigatória

O estado efetivo é definido exclusivamente por `manifest.json`. Conjunto aprovado especificamente na PR #327: `approved`: 48 capturas sintéticas (14 áreas internas e duas telas públicas em desktop, tablet e celular). A aprovação visual específica está documentada em `visual-standard/approval-record-327.md`; a aprovação histórica das 45 referências anteriores permanece registrada na PR #326. A existência da aprovação **não** autoriza merge sem consentimento para a PR.

## Estados e segurança

- `pending`: sem imagens aprovadas, não compara pixels.
- `candidate`: exatamente 48 PNGs versionados e auditados, ainda não compara pixels.
- `approved`: exige 48 PNGs, aprovação humana documentada e comparação Playwright de todas as imagens. Imagem ausente ou diferença além dos limites bloqueia o CI.
- `updateSnapshots: 'none'`: jamais aceitar diferenças ou substituir PNGs automaticamente. O script de preparação também recusa alterar referências já aprovadas.

## Como atualizar uma referência no futuro

1. Inspecionar o estado real do aplicativo e executar os testes com respostas/login fictícios. Nunca usar contas, dados reais ou produção para capturas do padrão.
2. Em branch separada, gerar novas candidatas e comparar imagens originais, `actual` e `diff` onde necessário; não aceitar imagens apenas para obter CI verde.
3. Solicitar aprovação humana do **novo conjunto específico** e registrar a referência da aprovação na PR.
4. Versionar somente os PNGs expressamente aprovados, conferir inventário e hashes, executar CI com comparação ativa e corrigir falhas legítimas sem afrouxar limiares para mascarar divergências.
5. Obter autorização específica para merge; validar CI de `main` e GitHub Pages depois da integração.

## Escopo e critérios

- Imagens de página inteira, animações desativadas, cursor de texto oculto, Chromium e viewports padronizados.
- `toMatchSnapshot`: `threshold: 0.2` e `maxDiffPixelRatio: 0.005` (0,5%). Diferenças e dimensões incompatíveis devem gerar falha e evidências.
- O teste de 48 imagens cobre estados vazios com respostas HTTP fictícias; não homologa dados preenchidos, permissões específicas, QR, vídeos, player, Supabase real ou comportamento operacional.
- Capturas temporárias ficam em `artifacts/` (não versionar). Adaptar o kit à arquitetura de cada novo projeto, sem copiar cegamente layout ou autenticação.
