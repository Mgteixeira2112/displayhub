import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const imports = readFileSync('src/module-navigation.css', 'utf8')
if (!imports.includes("@import './display-groups-cockpit.css';")) {
  throw new Error('O CSS Cockpit de Video Wall e Grupos não está importado.')
}

const source = readFileSync('src/display-groups-cockpit.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
if (/grid-template-columns\s*:|display\s*:\s*none|pointer-events\s*:|!important|supabase|display_group_launch|\.public-player|\.promo-poster/.test(source)) {
  throw new Error('O acabamento não pode mudar a grade, ocultar controles nem alterar dados, sincronização ou player.')
}
const rules = source.match(/[^{}]+\{/g) || []
for (const rule of rules) {
  if (rule.trim().startsWith('@')) continue
  const selectors = rule.slice(0, -1).split(',')
  if (selectors.some((selector) => !selector.trim().startsWith('.modern-software-shell .view-groups '))) {
    throw new Error(`Seletor fora do escopo Video Wall e Grupos: ${rule.trim()}`)
  }
}

const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.css'))
if (!assets.length) throw new Error('O build não gerou CSS.')
const compiled = assets.map((name) => readFileSync(join('dist/assets', name), 'utf8')).join('\n')
const selectors = [
  '.modern-software-shell .view-groups .display-group-create',
  '.modern-software-shell .view-groups .display-group-card.selected',
  '.modern-software-shell .view-groups .display-group-editor',
  '.modern-software-shell .view-groups .display-wall-slot',
]
for (const selector of selectors) {
  if (!compiled.includes(selector)) throw new Error(`CSS de Video Wall e Grupos ausente no build: ${selector}`)
}
console.log(`Cockpit Video Wall e Grupos: ${selectors.length} seletores compilados; grade, sincronização e player preservados.`)
