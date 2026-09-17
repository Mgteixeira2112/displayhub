import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const imports = readFileSync('src/module-navigation.css', 'utf8')
if (!imports.includes("@import './content-library-cockpit.css';")) {
  throw new Error('O CSS Cockpit de Conteúdo não está importado.')
}

const source = readFileSync('src/content-library-cockpit.css', 'utf8')
if (source.includes('grid-template-columns:')) {
  throw new Error('A expansão visual não pode alterar a grade densa da biblioteca.')
}

const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.css'))
if (!assets.length) throw new Error('O build não gerou CSS.')
const css = assets.map((name) => readFileSync(join('dist/assets', name), 'utf8')).join('\n')

const selectors = [
  '.modern-software-shell .view-library .content-create-choice',
  '.modern-software-shell .view-library .content-create-workspace',
  '.modern-software-shell .view-library .content-gallery-heading',
  '.modern-software-shell .view-library .content-card',
  '.modern-software-shell .view-library .structured-card',
]
for (const selector of selectors) {
  if (!css.includes(selector)) throw new Error(`Estilo Cockpit de Conteúdo ausente no build: ${selector}`)
}
console.log(`Cockpit Conteúdo: CSS compilado validado (${selectors.length} seletores), grade preservada.`)
