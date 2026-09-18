# DESIGN BRIEF — DisplayHub / piloto AI Studio

Status: briefing técnico preparado; protótipo e aprovação visual pendentes.

## Objetivo
Produzir SOMENTE um protótipo de apresentação visual da tela inicial `Início` (Visão Geral) do DisplayHub. O trabalho não substitui o sistema real e não pode chegar à `main` como aplicação alternativa.

## Fonte técnica inspecionada
- `package.json`: React 19, React DOM 19, TypeScript 5, Vite 8, Supabase JS 2, Konva/react-konva já presentes. Não trocar stack, nem instalar biblioteca sem justificativa.
- `src/HomeDashboard.tsx`: componente real da Visão Geral; recebe `companyId`, consulta Supabase e atualiza periodicamente.
- `src/AppLayout.tsx`: shell existente, navegação e evento `displayhub:navigate`.
- Supabase é fonte da verdade; acesso real, autenticação, RLS e integrações não fazem parte do protótipo.

## Inventário do que a tela real apresenta
1. Cabeçalho de boas-vindas com botão `Atualizar dados`.
2. Ações rápidas: `Criar oferta` → posters; `Galeria` → templates; `Campanhas` → campaigns; `Telas` → displays. Preservar destinos; `templates` tem de ser conferido na integração com as rotas do AppLayout, pois não consta em `View` neste arquivo.
3. Resumo: `Telas ativas`, `Online`, `Requer atenção` (offline), `Em exibição` (telas com playlist associada), `Programações ativas`.
4. Card `Campanhas ativas`: nome da playlist/campanha e tela vinculada, botão `Ver campanhas`.
5. Card `Telas que precisam de atenção`: nome, localização e estado offline, botão `Ver telas`.
6. Seção `Ofertas salvas` para peças recentes; confirmar todos os detalhes antes da integração.
7. Estados reais: carregamento na atualização, mensagem de erro de consulta, listas vazias e dados presentes.

## Semântica operacional obrigatória
- Contagem de telas ativas: `is_active && !revoked_at`.
- Online: tela ativa com `last_seen_at` há menos de 90 segundos; offline: demais telas ativas.
- `Em exibição` hoje mede existência de `active_playlist_id`; NÃO afirmar que vídeo está efetivamente reproduzindo.
- Programação ativa considera `is_active` e janela `starts_at`/`ends_at`.
- A carga de dados do dashboard ocorre aproximadamente a cada 15 segundos. NÃO alterar isso no protótipo ou fingir atualização real.
- Dados de demonstração devem ser explícitos. Não usar clientes, credenciais ou Supabase real no AI Studio.

## Layout global existente a respeitar
`AppLayout.tsx` tem sidebar DisplayHub e navegação: Início, Criar, Smart Scenes, Campanhas, Telas, Conteúdo; grupo Avançado inclui Players Windows, Video Wall e Grupos, Playlists, Programação, Templates técnicos, Histórico técnico; Configurações. A topbar mostra título, descrição, empresa e botão Criar em determinadas telas. O piloto deve redesenhar APENAS a Visão Geral dentro desse shell, com opção de proposta visual do shell somente como referência, sem eliminar menus, renomear rotas ou alterar navegação.

## Direção criativa
Interface marcante, profissional e operacional, legível em telas grandes e pequenas; informação prioritária acima da dobra quando viável; status distinguíveis por texto/ícone além da cor; composição consistente com sidebar e topbar existentes. Evitar textos supérfluos e não introduzir módulos.

## Contrato técnico de entrega ao AI Studio
1. Criar protótipo isolado: NÃO conectar ao repositório principal para gravação, não escrever na main e não fazer deploy.
2. Usar React + TypeScript e estilos organizados, compatíveis com Vite. Criar componentes de apresentação separados de dados demonstrativos (`fixtures` ou equivalente).
3. Não implementar nem simular autenticação real, Supabase, endpoints, comandos a displays, edição real ou operações persistentes.
4. Botões simulados devem ser identificados como demonstração e os destinos existentes documentados.
5. Entregar código-fonte completo, capturas desktop/tablet/mobile, `DESIGN_TOKENS.json` com valores efetivamente usados e `DESIGN_HANDOFF.md` com mapa arquivo/componente, ações mockadas e riscos de integração.
6. Não alegar sucesso funcional por aparência, build ou navegação mockada.

## Critérios de aceite visual
- Presença das áreas do inventário sem esconder informação operacional essencial.
- Layout desktop/tablet/mobile, estados de carregamento, erro, vazio, online e offline.
- Hierarquia, tipografia, contraste, alinhamento e estados de botões consistentes.
- Aprovação humana das capturas ANTES de integração ao sistema real.

## Etapa posterior — ChatGPT
Inspecionar protótipo e código real, mapear cada ação e dado, corrigir eventuais inconsistências de navegação em PR própria se necessário, integrar apresentação à lógica existente em branch pequena, rodar lint/build, verificar CI/deploy, comparar capturas e executar homologação funcional real. Esta PR de documentação não autoriza integração ou merge automático.