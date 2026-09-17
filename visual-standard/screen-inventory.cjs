// Inventário único: 13 áreas internas + 2 telas públicas, em três tamanhos.
const projects = ['desktop', 'tablet', 'mobile']
const publicStates = ['entrar', 'cadastro-vazio']
const views = [
  ['overview', 'Início'],
  ['displays', 'Telas'],
  ['library', 'Conteúdo'],
  ['posters', 'Criar'],
  ['smart-scenes', 'Smart Scenes'],
  ['campaigns', 'Campanhas'],
  ['devices', 'Players Windows'],
  ['groups', 'Video Wall e Grupos'],
  ['playlists', 'Playlists avançadas'],
  ['schedule', 'Programação avançada'],
  ['technical-templates', 'Templates técnicos'],
  ['history', 'Histórico técnico'],
  ['settings', 'Configurações'],
]
const screenshots = projects.flatMap((project) => [
  ...publicStates.map((state) => `${project}-${state}.png`),
  ...views.map(([view]) => `${project}-interno-${view}.png`),
])
module.exports = { projects, publicStates, views, screenshots }
