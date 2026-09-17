import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const navigation = readFileSync('src/module-navigation.css', 'utf8')
if (!navigation.includes("@import './cockpit-remaining-pages.css';")) {
  throw new Error('Acabamento final não importado na navegação.')
}

const source = readFileSync('src/cockpit-remaining-pages.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
if (/grid-template-(?:columns|rows)\s*:|display\s*:\s*none|pointer-events\s*:|position\s*:\s*(?:fixed|absolute)|!important|supabase|display_group_launch|\.public-player|\.promo-poster/i.test(source)) {
  throw new Error('CSS final não pode alterar grade, ocultação, interação, dados ou player.')
}

const views = ['playlists', 'schedule', 'technical-templates', 'history', 'settings']
const selectorPattern = /^\.modern-software-shell \.view-(?:playlists|schedule|technical-templates|history|settings)\s+/
for (const rule of source.match(/[^{}]+\{/g) || []) {
  if (rule.trim().startsWith('@')) continue
  for (const selector of rule.slice(0, -1).split(',')) {
    if (!selectorPattern.test(selector.trim())) {
      throw new Error(`Seletor fora das cinco páginas restantes: ${selector.trim()}`)
    }
  }
}

const layout = readFileSync('src/AppLayout.tsx', 'utf8')
const compiledFiles = readdirSync('dist/assets').filter((file) => file.endsWith('.css'))
if (!compiledFiles.length) throw new Error('Build sem CSS.')
const compiled = compiledFiles.map((file) => readFileSync(join('dist/assets', file), 'utf8')).join('\n')
const selectors = {
  playlists: '.modern-software-shell .view-playlists .playlist-card',
  schedule: '.modern-software-shell .view-schedule .publication-card',
  'technical-templates': '.modern-software-shell .view-technical-templates .template-card',
  history: '.modern-software-shell .view-history .history-list article',
  settings: '.modern-software-shell .view-settings .account-grid article',
}
for (const view of views) {
  if (!layout.includes(`'${view}'`)) throw new Error(`Página não encontrada na navegação: ${view}`)
  if (!compiled.includes(selectors[view])) throw new Error(`Acabamento ausente do build: ${view}`)
}
console.log(`Cockpit final: ${views.length} páginas com estilos compilados e limitados ao próprio módulo.`)
