import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const imports = readFileSync('src/campaigns-create-panel-compact.css', 'utf8')
if (!imports.includes("@import './campaigns-cockpit.css';")) {
  throw new Error('O CSS Cockpit de Campanhas não está importado.')
}

const source = readFileSync('src/campaigns-cockpit.css', 'utf8')
if (/grid-template-columns\s*:|display\s*:\s*none|pointer-events\s*:|!important/.test(source)) {
  throw new Error('O acabamento Cockpit não pode reordenar, ocultar ou desativar a operação de Campanhas.')
}
const rules = source.match(/[^{}]+\{/g) || []
for (const rule of rules) {
  if (rule.trim().startsWith('@')) continue
  const selectors = rule.slice(0, -1).split(',')
  if (selectors.some((selector) => !selector.trim().startsWith('.modern-software-shell .view-campaigns '))) {
    throw new Error(`Seletor fora do escopo Campanhas: ${rule.trim()}`)
  }
}

const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.css'))
if (!assets.length) throw new Error('O build não gerou CSS.')
const compiled = assets.map((name) => readFileSync(join('dist/assets', name), 'utf8')).join('\n')
const selectors = [
  '.modern-software-shell .view-campaigns .playlist-create-panel',
  '.modern-software-shell .view-campaigns .campaign-toolbar-search',
  '.modern-software-shell .view-campaigns .playlist-card.is-expanded',
  '.modern-software-shell .view-campaigns .campaign-toolbar-filters',
]
for (const selector of selectors) {
  if (!compiled.includes(selector)) throw new Error(`CSS Campanhas ausente do build: ${selector}`)
}
console.log(`Cockpit Campanhas: ${selectors.length} seletores no build; escopo e layout preservados.`)
