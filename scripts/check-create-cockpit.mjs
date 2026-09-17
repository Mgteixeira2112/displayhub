import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const imports = readFileSync('src/promotion-creator-header-compact.css', 'utf8')
if (!imports.includes("@import './promotion-creator-cockpit.css';")) {
  throw new Error('O acabamento Cockpit de Criar não está importado.')
}

const source = readFileSync('src/promotion-creator-cockpit.css', 'utf8')
if (source.includes('grid-template-columns:') || source.includes('.promo-poster {') || source.includes('.promo-poster-content')) {
  throw new Error('O acabamento não pode modificar as grades ou o conteúdo do cartaz.')
}
const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.css'))
if (!assets.length) throw new Error('O build não gerou CSS.')
const css = assets.map((name) => readFileSync(join('dist/assets', name), 'utf8')).join('\n')
const selectors = [
  '.modern-software-shell .view-posters .promotion-workspace .promotion-form',
  '.modern-software-shell .view-posters .promotion-workspace .promotion-preview-panel',
  '.modern-software-shell .view-posters .promotion-workspace .promotion-poster-card',
]
for (const selector of selectors) {
  if (!css.includes(selector)) throw new Error(`Estilo Cockpit de Criar ausente no build: ${selector}`)
}
console.log(`Cockpit Criar: CSS compilado validado (${selectors.length} seletores), grades e cartaz preservados.`)
