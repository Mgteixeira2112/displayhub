# Guia de execução — piloto visual DisplayHub

## Antes de abrir o AI Studio

Esta branch contém apenas o contrato do piloto. A tela real está em `src/HomeDashboard.tsx`, e a moldura de navegação em `src/AppLayout.tsx`. A criação do protótipo é uma etapa externa; não foi executada por este repositório.

1. Leia `DESIGN_BRIEF.md` e `AI_STUDIO_PROMPT.md` nesta pasta.
2. Abra um projeto novo e isolado no Google AI Studio; não conecte a branch `main` para edição e não forneça credenciais, `.env`, dados reais ou chave privilegiada do Supabase.
3. Cole o conteúdo integral do `AI_STUDIO_PROMPT.md` e, logo abaixo, o conteúdo integral de `DESIGN_BRIEF.md`.
4. Solicite um protótipo da tela Início somente, com dados demonstrativos, sem rede, backend, autenticação ou comandos aos players. Caso precise de contexto, forneça apenas trechos não sensíveis dos componentes de apresentação, jamais o projeto integral com secrets.
5. Revise a tela em desktop, tablet e celular e verifique estados de carregamento, erro, vazio e offline. Nenhuma operação simulada pode aparentar ter sido salva de verdade.
6. Após aprovação visual, exporte o código-fonte do protótipo como ZIP ou publique em um repositório/branch **isolado**, sem sobrescrever esta branch ou a `main`.
7. Entregue também os `DESIGN_TOKENS.json`, `DESIGN_HANDOFF.md` preenchidos e capturas de tela aprovadas. Não coloque imagens em `DESIGN_REFERENCE/` antes da aprovação.

## Retorno ao ChatGPT

Informe o link da branch/repositório isolado ou anexe o ZIP e as imagens aprovadas. Solicite: 'Inspecione a entrega do AI Studio, compare com `src/HomeDashboard.tsx` e `src/AppLayout.tsx`, produza uma matriz de integração e implemente exclusivamente o visual em uma nova branch e PR. Preserve consultas, permissões, eventos, navegação, status e regras do Supabase. Rode build/lint, verifique CI, deploy e teste real antes de homologar.'

## Critérios de segurança e conclusão

- Esta PR documental não aprova nem publica o protótipo.
- Não mesclar código visual gerado automaticamente sem revisão.
- A integração posterior precisa ser outra PR, com comparação visual e testes de regressão funcionais.
- O status 'online' atual tem regra de sinal recente; presença de playlist atribuída não comprova reprodução de vídeo.
