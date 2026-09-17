# Padrão Visual Universal — v1.1 (piloto DisplayHub)

**Objetivo:** reduzir trabalho repetitivo de revisão visual em projetos diferentes, sem copiar identidade gráfica ou arquitetura do DisplayHub. Este é um kit portátil de referência, não um repositório central e não está instalado automaticamente nos outros projetos.

## Procedimento obrigatório

1. Inspecionar arquitetura, telas, componentes, identidade existente, autenticação, permissões, dados, CI e publicação antes de modificar.
2. Aprovar uma referência visual específica do produto; preservar cores, nomes, operações e componentes úteis. Nunca copiar cegamente o CSS do DisplayHub para hotéis, seguros ou salões.
3. Registrar páginas e estados desktop/tablet/mobile, com capturas **sem dados reais**. Se um estado não puder ser reproduzido de forma isolada, declarar **não coberto**.
4. Implementar em branch, com PR limitada ao lote visual autorizado. Corrigir lógica, banco, segurança, deploy e players em PRs distintas quando necessário. Nunca escrever na `main`.
5. Executar lint, build, testes de CSS e testes renderizados de navegador com checagem de navegação, overflow, erros e capturas. Screenshots são evidência, não homologação.
6. Comparar capturas anteriores e posteriores com referência aprovada. Baselines oficiais só mudam em PR revisada, nunca automaticamente.
7. Confirmar arquivos, SHA e CI verde, pedir autorização **específica para a PR** e só então fazer merge. Deploy deve aguardar CI da `main`, publicar o SHA testado e ter sucesso confirmado.
8. Proprietário homologa a aplicação real após deploy. Registrar aprovação na PR. Lote com várias páginas é permitido quando solicitado, sem misturar mudanças funcionais.

## Regras de segurança

- Nunca usar credenciais pessoais, registros de clientes, banco de produção, tokens de TV ou sessões reais nas capturas. Testar ambientes autenticados somente com respostas/contas sintéticas e isolamento verificável.
- Não gravar tokens, screenshots privados ou dados pessoais em repositórios e artefatos públicos. Não escrever no Supabase, alterar schema ou contornar RBAC para mudar aparência.
- Nunca automatizar o merge, a aprovação do usuário, o aceite de snapshots nem publicar antes de autorização concreta.
- Ajustar caminhos, seletores, servidor, dados falsos, autenticação e CI à arquitetura inspecionada de cada projeto. Não presumir Vite, React, Supabase ou GitHub Pages.

## Testes executáveis neste repositório

`visual-standard/playwright.config.cjs` roda Chromium em desktop (1440×900), tablet (768×1024) e celular (390×844). O job `visual-public` instala Playwright temporariamente e roda os dois arquivos abaixo sem alterar o lockfile:

- `tests/public-auth.spec.cjs`: tela pública de entrada e cadastro vazio; valida visibilidade, labels, ausência de overflow e erros e salva **seis capturas**.
- `tests/internal-auth.spec.cjs`: monta o **App real**, simula login somente com HTTP interceptado, usa empresa/usuário artificiais e respostas vazias para listas, percorre **13 áreas internas** pelo evento de navegação existente, verifica título, contêiner visível, overflow e erros e gera **39 capturas**. O teste aborta solicitações externas não autorizadas, encerra WebSockets para o host fictício e bloqueia operações de gravação/RPC. O script remoto estático de QR Code é substituído por resposta vazia **somente no teste**: QR e pareamento não são cobertos.

Todos os acessos Supabase do navegador são interceptados para `https://example.supabase.co` com chave de ambiente fictícia; nenhuma chamada alcança o banco real. O job exige pelo menos **45 capturas e relatório HTML** como condição do CI. Execução local: `npm ci`; `npm install --no-save --package-lock=false @playwright/test@1.55.0`; `npx playwright install chromium`; `npx playwright test --config visual-standard/playwright.config.cjs` (Vite iniciado pelo Playwright com variáveis fictícias).

**Limites:** os testes internos cobrem componentes e navegação em estados **vazios**, mas não verificam operações de escrita, dados preenchidos, QR Codes, player/TV, Supabase real, RLS ou permissões de acesso. Capturas ainda não são comparadas automaticamente com imagens-base aprovadas; para isso, aprovar snapshots e adicionar `toHaveScreenshot` em outra PR com limites definidos. Uma captura bem-sucedida não significa aprovação estética ou funcional em produção.

## Reutilização em outros projetos

Usar `PROJECT_SETUP_TEMPLATE.md` para inventariar cada projeto. Adaptar o teste, a fixture isolada, endpoints e páginas reais; descartar tudo que for específico do DisplayHub. Nunca copiar credenciais, URLs de produção ou CSS do DisplayHub. Separar evidência de tela pública, navegação interna vazia, telas com dados sintéticos e homologação no sistema real; não marcar como concluída uma categoria que não foi testada.

## Histórico e próximos passos

- PR #319, piloto aprovado: CI de navegador público com artefatos e deploy Pages condicionado a CI/main verde; usuário homologou tela de entrada e navegação real.
- Esta etapa propõe navegação interna com respostas sintéticas e 45 capturas, ainda sujeita a merge e homologação da PR própria.
- Pendentes: fixtures ricas para estados internos, baselines oficiais aprovados, comparação visual automatizada, testes por permissões, e homologação funcional real. Nunca declarar cobertura completa antes desses itens.

## Checklist para cada PR

- [ ] Escopo e estado real inspecionados; nenhuma modificação funcional fora da PR.
- [ ] CI do commit exato verde, evidências e relatórios presentes, sem segredos.
- [ ] Cobertura e pendências explicitadas; screenshots-base não atualizados automaticamente.
- [ ] Merge autorizado especificamente; CI/main e publicação verificados; homologação real registrada depois.
