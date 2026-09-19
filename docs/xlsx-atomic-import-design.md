# Proteção transacional da importação CSV/XLSX — projeto de implementação

Estado: especificação técnica, **não implementada no banco**. Não fazer merge da PR #334 somente porque a CI da interface está verde.

## Evidência do banco real (somente leitura, 18/09/2026)

`structured_contents(id, company_id, kind)` tem chave única `(id, company_id)`; `structured_content_rows(content_id, company_id)` tem FK composta para essa tabela; `playlist_items(structured_content_id, company_id)` também tem FK composta. `structured_content_rows` utiliza campos `title`, `category`, `description`, `price`, `promo_price`, `position` e `is_active`; `price` é obrigatório. RLS da inserção exige a mesma empresa, papel admin/manager e pai menu/price_table. Não há constraint ou trigger atual que proíba importar em pai já preenchido ou vinculado a playlist.

## Contrato de implementação

1. Criar migration pelo Supabase CLI, em branch; validar no banco de desenvolvimento antes de aplicar ao projeto real. Sem novos módulos.
2. Criar RPC para importação por lote em **uma transação**: usuário autenticado; empresa e papel resolvidos em `profiles` pelos helpers privados existentes; `p_content_id` pertence à empresa e tipo menu/price_table; payload JSON é array de 1 a 200 elementos; validar formatos, campos e limites no servidor. Nunca confiar em `company_id`, papel ou `content_id` fornecidos em cada linha pelo cliente.
3. Serializar todas as operações concorrentes na **mesma linha pai**: travar `structured_contents` com `SELECT ... FOR UPDATE` antes de verificar `NOT EXISTS` em `structured_content_rows` e `playlist_items` e antes de inserir o lote. A transação aborta completamente em qualquer erro. Não usar `SKIP LOCKED` nem truncar payload.
4. Só o bloqueio no RPC não basta: toda operação que vincule essa estrutura a `playlist_items` deve adquirir o mesmo bloqueio de linha pai *antes* da inserção. Proteger por trigger de banco no vínculo, ou migrar todas as rotas de publicação para uma operação transacional comum. Validar a ordem dos bloqueios para evitar deadlocks. Um vínculo anterior ao import impede importação; um vínculo posterior deve aguardar a importação e ser avaliado no estado resultante.
5. Impedir uma inserção concorrente comum em `structured_content_rows` de violar a checagem de vazio: adotar trigger ou restringir/centralizar a escrita por caminho transacional com bloqueio pai. Revisar todos os editores existentes antes de revogar `INSERT` direto; não quebrar edição manual.
6. Revogar EXECUTE da RPC de `PUBLIC`/`anon`, conceder somente a `authenticated`, realizar checagem explícita de `auth.uid()` e empresa no corpo. Revisar `SECURITY DEFINER`, `search_path`, proprietário, privilégios, RLS e as políticas existentes; não criar bypass genérico.
7. Alterar exclusivamente a confirmação em `UniversalTableCsvImport.tsx` para chamar RPC, preservar prévia e compatibilidade CSV; retorno só declara sucesso após commit confirmado no banco.

## Critérios de aceite

- Dois imports paralelos no mesmo pai vazio: exatamente um lote completo gravado; outro recusado, sem linhas parciais.
- Import versus publicação simultâneos: sem janela entre consulta e insert; comportamento definido e verificado.
- Pai com linhas ou playlist: rejeição sem escrita.
- Usuário operador, anônimo, empresa diferente e payload adulterado: rejeição no banco, não apenas na interface.
- CSV e XLSX válidos: prévia sem gravação, confirmação única, contagem/valores corretos após recarregar; erros de lote não deixam itens parciais.
- Rodar CI da PR e testes de integração reais isolados sem modificar dados comerciais de produção. Conferir migrations, segurança e CI/main somente após merge autorizado.
