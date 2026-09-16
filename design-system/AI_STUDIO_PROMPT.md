# Prompt de execução — Google AI Studio

Crie um protótipo visual isolado e navegável, NÃO um novo sistema de produção, para a tela `Início` / Visão Geral do DisplayHub. Leia integralmente o arquivo `design-system/DESIGN_BRIEF.md` fornecido junto a este prompt e trate o documento como contrato obrigatório.

Contexto de tecnologia: React 19 + TypeScript 5 + Vite 8. O projeto real usa Supabase, mas este protótipo NÃO deve ter qualquer conexão com Supabase, autenticação, APIs, credenciais, dados reais, comandos aos players nem deploy do produto. Não altere a main ou arquivos do sistema real; produza os arquivos em projeto isolado ou branch exclusiva de protótipo.

Preserve no protótipo todas as informações e destinos já documentados no briefing, sem criar módulos novos. Foque no design do conteúdo do dashboard; a sidebar/topbar existentes devem ser consideradas como contexto, não reescritas em produção. Use dados de demonstração explicitamente marcados e separe fixtures da apresentação. Não afirme que a presença de uma playlist prova que a mídia está tocando.

Crie uma experiência de alta qualidade com hierarquia forte e layout desktop/tablet/mobile. Incluir estados: carregando, erro, vazio, online, offline e listas preenchidas. Não depender apenas de cores para status. Não adicionar textos explicativos desnecessários. Todos os controles são SOMENTE demonstrações e devem estar marcados como tal; documente a ação real correspondente, quando existir.

Entregue obrigatoriamente: (1) código-fonte completo e organizado; (2) arquivos de apresentação e fixtures separados; (3) valores concretos das variáveis visuais usadas em `DESIGN_TOKENS.json`; (4) `DESIGN_HANDOFF.md` preenchido com mapa de componentes, arquivos, ações simuladas e riscos; (5) capturas desktop/tablet/mobile para aprovação visual; (6) instruções simples para exportar ZIP ou disponibilizar o protótipo em repositório/branch isolada.

Pare após a entrega do protótipo. Não integre código ao produto, não realize merge e não declare funcionalidades homologadas. A integração será feita posteriormente pelo ChatGPT, por PR separada e validação funcional.