# Protocolo de estabilidade do Preview — AI Studio

## Diagnóstico confirmado
Em uma importação/protótipo AI Studio, o Vite não encontrou `./lib/dataRefresh` importado por `src/ContentLibrary.tsx`. O arquivo ORIGINAL `src/lib/dataRefresh.ts` existe na `main` do repositório e exporta `subscribeDataChanged` e `notifyDataChanged`. Portanto, ausência no workspace de design NÃO comprova defeito na aplicação original: pode indicar importação incompleta, cópia divergente ou alterações geradas. Não copiar automaticamente reparos do AI Studio para produção.

O AI Studio também relatou remoção de referência a `hero-video-buffering.ts`, inclusão de `vite-env.d.ts`, módulo de cenas, CSS auxiliares e tratamento de exceção de rede. Esses relatos ainda não foram auditados contra o código original, e não equivalem a correções homologadas. Não recriar arquivos técnicos por suposição nem remover scripts sem verificar o projeto original e seu histórico.

## Fluxo obrigatório em cada nova execução
1. Identificar repositório, branch e revisão realmente importados. Se a ferramenta usar apenas a branch default, não permitir sync de volta; usar cópia independente/ZIP. Nunca escrever na main.
2. Antes de pedir design, verificar imports, arquivos reais referenciados no index.html, entrada da aplicação, assets CSS e declarações TS. Para arquivo ausente, comparar a mesma revisão do GitHub, restaurando o original apenas quando comprovado. Não criar implementações fictícias para passar o build.
3. Rodar instalação reproduzível conforme package-lock, `npm run build` e `npm run lint`; registrar resultados reais. `tsc --noEmit` isoladamente não substitui `npm run build` definido pelo projeto.
4. Executar Preview e verificar que a tela modificada é realmente a tela montada, em vez de somente confiar no relato de que o código foi alterado. Se a aplicação exigir backend/sessão, produzir demo separada sem importar managers ou serviços reais.
5. Depois de cada lote pequeno, repetir build, lint, Preview e inspeção de erros. Se houver falha, parar mudanças visuais até diagnosticar. Nunca desligar o overlay do Vite como substituto para corrigir a falha.
6. Na entrega, listar arquivos modificados, diferenças em módulos não visuais, logs dos checks, prints do Preview e pendências. Não sincronizar, publicar ou fazer merge antes da revisão técnica e aprovação visual.

## Critério de saída
Preview renderiza o layout aprovado sem erro conhecido; build e lint verificados; qualquer alteração técnica fora do escopo visual é explicitamente destacada para revisão antes da integração. Isso reduz reincidência, mas não garante ausência absoluta de novos erros de geração/importação.
