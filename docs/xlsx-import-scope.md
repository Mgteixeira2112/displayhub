# Importação XLSX — escopo isolado

Branch `feat/universal-table-xlsx-import`, criada a partir do merge da PR #330 (`9aeddaf9ca1303b8b5dc53071e2dc5236539029e`).

## Estado inspecionado

`src/UniversalTableCsvImport.tsx` aceita exclusivamente `.csv` no seletor, rejeita outras extensões e lê o arquivo como texto com UTF-8/windows-1252. `src/lib/commercialCsv.ts` fornece mapeamento/validação compartilháveis. `package.json` não contém dependência para leitura de XLSX. A PR #330 já integrou o CSV; não modificar sua semântica nem as regras de escrita no Supabase.

## Alteração mínima prevista

- Adotar biblioteca de leitura XLSX mantida, com versão fixa e lockfile auditado; carregar sob demanda somente na escolha de XLSX. Não interpretar XLSX por `TextDecoder`, não executar fórmulas ou macros, não avaliar links externos.
- Para XLSX, identificar planilhas; rejeitar pasta sem conteúdo tabular ou solicitar seleção explícita caso várias abas tenham dados, sem escolher aba silenciosamente. Converter células em matriz de strings, preservando exibição de preço e zeros significativos quando possível; limitar 2 MB e 200 itens antes de expor a prévia.
- Entregar matriz de cabeçalhos e linhas para a mesma prévia, remapeamento de colunas, edição, confirmação de colunas descartadas e `validateImport` usados por CSV.
- Manter a restrição de destino vazio, desvinculado de playlist, o único `insert` por lote, controle por `company_id` e papéis admin/manager; nunca salvar no momento do upload.
- Testar XLSX válido, várias abas, vazio, extensão falsa/corrompido, tamanho, linhas excedentes, fórmulas sem execução, preços e regressão de CSV. Recolher aprovação se capturas visuais mudarem; CI verde antes de pedir merge.

**Estado:** documento de escopo apenas. Leitura XLSX ainda não implementada nem homologada; nenhum merge ou migration autorizados por este documento.
