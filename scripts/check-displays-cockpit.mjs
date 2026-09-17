import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const imports = readFileSync('src/module-navigation.css', 'utf8')
if (!imports.includes("@import './displays-cockpit.css';")) {
  throw new Error('O acabamento Cockpit de Telas não está importado.')
}

const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.css'))
if (!assets.length) throw new Error('O build não gerou CSS.')
const css = assets.map((name) => readFileSync(join('dist/assets', name), 'utf8')).join('\n')
const selectors = [
  '.modern-software-shell .view-displays .create-panel-display',
  '.modern-software-shell .view-displays .display-form',
  '.modern-software-shell .view-displays .display-list',
  '.modern-software-shell .view-displays .display-card',
]
for (const selector of selectors) {
  if (!css.includes(selector)) throw new Error(`Estilo de Telas ausente no build: ${selector}`)
}
console.log(`Cockpit Telas: CSS compilado validado (${selectors.length} seletores).`)
