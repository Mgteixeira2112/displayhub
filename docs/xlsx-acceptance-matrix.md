# Matriz de aceite — PR #334 (XLSX)

Este documento define testes exigidos **antes** da implementação ser considerada pronta. Não é evidência de que os testes foram executados.

| Caso | Entrada | Resultado exigido |
|---|---|---|
| XLSX simples | Uma aba, título/preço, itens válidos | Detectar cabeçalhos, apresentar prévia editável e permitir conferência antes de salvar. |
| CSV regressão | Mesmo CSV aceito pela PR #330 | Mesmos campos, valores, limites, mapeamentos e gravação; XLSX não altera parser CSV. |
| Múltiplas abas | Duas abas com linhas úteis | Solicitar escolha explícita; nenhuma seleção silenciosa ou gravação. |
| Sem conteúdo | Pasta sem aba tabular ou somente cabeçalho | Mensagem clara; botão de importação bloqueado. |
| Arquivo inválido | `.xlsx` contendo texto, ZIP malformado ou extensão falsa | Rejeitar com mensagem, sem gravar e sem executar conteúdo. |
| Limite de tamanho | Arquivo maior que 2 MiB | Rejeitar antes da leitura. |
| Limite de registros | Mais de 200 itens úteis | Rejeitar sem truncamento silencioso. |
| Fórmulas | Célula com fórmula e sem valor em cache | Não executar fórmula; exigir correção/valor válido antes de gravar. |
| Preço e desconto | Valores BRL, campos promocionais inválidos | Reutilizar `validateImport` e impedir envio quando houver problemas. |
| Zeros à esquerda | Códigos/números formatados como texto | Preservar representação textual quando fornecida na planilha; não prometer recuperar zeros inexistentes no conteúdo. |
| Destino ocupado | Tabela já com registros | Bloquear escrita, como no fluxo CSV. |
| Destino publicado | Tabela vinculada a playlist | Bloquear escrita, como no fluxo CSV. |
| Permissões | Usuário sem função admin/manager | Não disponibilizar importação e validar restrições no backend/RLS antes da homologação. |
| Prévia somente leitura do banco | Upload e seleção de aba sem confirmar | Nenhuma inserção/atualização no Supabase. |
| Imagens visuais | Mudança em tablet ou celular | Apresentar capturas reais e obter aprovação específica, sem atualizar baseline automaticamente. |

## Critérios de saída

1. Biblioteca XLSX escolhida e versão exata fixada em `package.json` e `package-lock.json`; verificar manutenção, dependências e alertas de segurança; importar código sob demanda.
2. Testes automatizados positivos, negativos e de regressão CSV executados na PR, com lint, build e CI visual verdes.
3. Nunca publicar ou fazer merge sem autorização específica após CI verde; não modificar `main` diretamente.
4. Após merge autorizado: CI/main, confirmação de GitHub Pages no mesmo commit, teste funcional real e conferência Supabase/RLS antes da homologação.
