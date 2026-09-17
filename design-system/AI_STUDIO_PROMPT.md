# Prompt de execução — Google AI Studio

OBJETIVO: criar somente um protótipo visual isolado da tela Início/Visão Geral do DisplayHub. Leia `design-system/DESIGN_BRIEF.md` e `design-system/PREVIEW_STABILITY.md` antes de escrever código.

## Pré-voo obrigatório — antes de redesenhar
1. Confirme qual commit/branch foi importado e se todos os arquivos do projeto estão presentes. Compare importações locais com arquivos reais e confira `index.html`, `src/main.tsx`, `src/App.tsx` e o grafo de imports.
2. O arquivo original `src/lib/dataRefresh.ts` EXISTE na branch main do DisplayHub (implementa subscribeDataChanged e notifyDataChanged). Se ele faltar no workspace importado, a importação está incompleta ou a cópia divergiu: reimporte/restaure o arquivo original da mesma revisão, não invente um barramento alternativo. Inspecione qualquer outro arquivo ausente da mesma maneira.
3. Rode os scripts reais de `package.json` (instalação conforme lockfile, `npm run build`, `npm run lint`, se disponíveis). Registre erros; não diga que passou sem logs. Cheque também a renderização efetiva do Preview. Um build verde sozinho não comprova Preview funcional.
4. Se o ambiente importar somente main ou não permitir selecionar uma branch, NÃO sincronize de volta ao repositório; desenvolva em projeto/cópia isolada e entregue ZIP. Jamais publique, faça merge ou envie código à main.
5. Se a aplicação completa depender de sessão, rede, Supabase ou outros módulos para montar, NÃO altere nem simule silenciosamente o backend para fazê-la aparecer: crie uma entrada de demonstração autocontida e isolada usando fixtures locais e componentes de apresentação, sem importar App.tsx, autenticação ou managers operacionais.

## Desenvolvimento visual
Contexto: React 19, TypeScript 5, Vite 8. O Supabase é a fonte da verdade do software real, mas o protótipo não pode usá-lo nem conter chaves, APIs, credenciais, dados reais ou comandos a players. Preserve navegação e informações descritas no briefing como referência, sem inventar módulos. Dashboard com hierarquia visual forte, responsivo desktop/tablet/mobile; estados carregando, erro, vazio, online e offline. Interações somente demonstrativas e identificadas. Playlist atribuída não significa mídia efetivamente tocando.

## Verificação obrigatória após cada alteração
- Identifique arquivos tocados e confirme todos os imports locais e assets referenciados (inclusive index.html, CSS e módulos tipados).
- Execute `npm run build` e `npm run lint` quando disponíveis; corrija a causa real de falhas sem criar stubs, apagar importações funcionais ou alterar as regras do produto.
- Abra o Preview e confira se a tela nova é a que está efetivamente montada; se não conseguir verificar o Preview, declare explicitamente a limitação e mostre erros/logs.
- Congele visual e código depois da aprovação; não sincronize mudanças técnicas feitas apenas para rodar a cópia sem revisão específica.

## Entregáveis
Código visual e fixtures separados; `DESIGN_TOKENS.json` com valores concretos após aprovação; `DESIGN_HANDOFF.md` com mapa de componentes e interações simuladas, arquivos alterados e lista explícita de quaisquer reparos técnicos; capturas desktop/tablet/mobile e ZIP ou branch segura. Pare antes de integrar o produto real. A integração funcional será feita pelo ChatGPT em PR separada após inspeção, testes, CI e validação do usuário.
