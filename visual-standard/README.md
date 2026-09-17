# Padrão Visual Universal — v1.0

**Objetivo:** reduzir trabalho repetitivo de revisão visual nos projetos sem copiar a identidade gráfica nem a arquitetura do DisplayHub. Esta pasta é um **kit portátil de referência**, criado inicialmente no DisplayHub; não é um repositório central separado, nem está automaticamente instalado em outros projetos.

## Acordo de trabalho para cada projeto

1. **Inspecionar o estado real**: identificar stack, rotas, menu, design system, CSS, telas desktop/tablet/mobile, fluxos críticos, autenticação, banco, testes, CI e deploy. Registrar páginas encontradas e excluir rotas públicas/player de mudanças administrativas.
2. **Definir a referência**: aprovar uma direção visual própria do produto antes de expandi-la. Preservar cores, identidade, nomenclatura, funcionalidades e componentes já existentes. Não clonar a aparência do DisplayHub em sistemas de hotel, seguro ou salão.
3. **Inventariar e estabelecer evidência anterior**: para cada página, viewport e estado importante, obter captura sem dados pessoais, anotar comportamento e detectar elementos cortados, sobrepostos ou desalinhados. Se não for possível acessar tela autenticada com segurança, marcar como **não coberta**, jamais como aprovada.
4. **Implementar em branch**: uma PR para o lote visual explicitamente solicitado, arquivos pequenos e CSS limitado à área correta. Alterações de lógica, banco, player, segurança, deploy ou performance são outras PRs; só entram quando indispensáveis, justificadas e revisadas separadamente. Nunca gravar diretamente na `main`.
5. **Executar gates automáticos**: dependências reprodutíveis, lint, build, testes existentes, smoke visual no navegador, três tamanhos de tela, ausência de rolagem horizontal indevida, erros de página, controles com nomes acessíveis e capturas anexadas à execução. Testes de CSS isolado complementam, mas não substituem teste renderizado.
6. **Revisar diferenças**: confrontar capturas anterior/posterior. Referências oficiais de screenshot só podem ser atualizadas por PR revisada; nunca sobrescrevê-las automaticamente após uma mudança. Se não houver baseline, disponibilizar capturas para aprovação e registrar que comparação pixel a pixel ainda não existe.
7. **Publicar com aprovação específica**: confirmar escopo, arquivos, SHA do head e CI verde, pedir autorização **para a PR identificada**. Só após autorização executar merge; a publicação deve aguardar o CI verde da `main` e usar o commit exato que passou. Conferir sucesso real do deploy.
8. **Homologar no produto real**: proprietário acessa a versão autenticada, revisa navegação e o lote combinado em desktop/celular e confirma ou descreve ajustes. CI verde e screenshots de login não são homologação de todo o produto. Registrar aprovação na PR.

### Preferência de organização

**Lotes visuais são permitidos e preferidos quando o usuário solicitar revisão final de uma só vez.** O lote consiste de várias páginas do **mesmo assunto visual**, não de múltiplas mudanças funcionais. Em situações de risco, criar PRs pequenas mesmo durante o lote. Se o usuário não especificar, combinar previamente a forma de revisão.

### Regras de isolamento

- Nunca usar credenciais pessoais, dados de clientes, banco de produção ou tokens de TV para gerar screenshots.
- Testar áreas autenticadas somente com conta sintética, banco/fixtures isolados, política explícita de descarte e mascaramento; sem esse ambiente, o teste fica pendente.
- Não colocar chaves secretas, arquivos de sessão, tokens, screenshots privados ou dados pessoais em commits/artefatos públicos.
- Não mexer no Supabase, schema, RLS ou integrações só para mudar a aparência.
- Não automatizar merge, aprovação, atualização de snapshots oficiais ou publicação sem autorização concreta para a PR em questão.
- Ajustar paths, seletor e servidor por projeto; nunca presumir que todos usam Vite, GitHub Pages, Supabase ou a mesma versão do React.

## Piloto executável neste repositório

`visual-standard/playwright.config.cjs` e `visual-standard/tests/public-auth.spec.cjs` executam Chromium sem conta real, com URL/ chave pública **fictícias**, testam apenas o login público no desktop, tablet e celular, verificam overflow, erros de página, campos identificados e fluxo visual de alternância entre entrar/cadastrar, gerando capturas para download na execução do Actions. **Não testam as áreas logadas.** O job `visual-public` no CI instala Playwright em ambiente efêmero, sem atualizar `package.json` ou lockfile. Para testar localmente, rode `npm ci`, instale `@playwright/test@1.55.0` com `npm install --no-save --package-lock=false @playwright/test@1.55.0`, execute `npx playwright install chromium` e `npx playwright test --config visual-standard/playwright.config.cjs` com variáveis fictícias `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` presentes no ambiente.

As capturas são **evidência inicial**, não comparação automatizada com imagem aprovada. Depois de aprovação das imagens-base, adicionar `toHaveScreenshot` com snapshots versionados e limites de variação documentados; nunca aceitar diferenças automaticamente.

## Portar para outro projeto

Copiar este documento, o teste e a configuração como referência. Adaptar a rota pública, `webServer`, seletores, variáveis fictícias e CI à stack real; criar páginas sintéticas representativas ou fixtures isoladas para cobrir o login e a navegação autenticada. Não copiar arquivos de CSS de um negócio para outro. Garantir que deploy depende do CI na branch principal; para outro provedor, usar o mecanismo equivalente. Registrar em cada PR as páginas efetivamente cobertas e as pendências.

## Estado inicial (DisplayHub)

- Antes: CI já tinha lint/build e smokes específicos de CSS; deploy GitHub Pages era disparado pelo push em `main` independentemente do resultado do CI.
- Este piloto propõe: job de navegador público com artefatos + deploy disparado apenas após conclusão bem-sucedida do fluxo `CI` para push em `main`, com checkout do SHA testado.
- Continuam pendentes: fixtures seguras da área logada, baseline aprovada, comparação visual automatizada de todas as páginas e homologação humana. **Não declarar cobertura total antes de implementar esses itens.**

## Checklist de aceitação da PR

- [ ] Somente arquivos esperados, sem funcionalidades/dados novos.
- [ ] Testes existentes e teste visual público verdes.
- [ ] Capturas desktop/tablet/mobile disponíveis; sem segredos ou dados de cliente.
- [ ] O CI é condição necessária para deploy da `main` e usa o mesmo commit.
- [ ] Diferenças visuais autenticadas ainda não cobertas são declaradas explicitamente.
- [ ] Merge somente após autorização específica; deploy confirmado; homologação real registrada depois.
