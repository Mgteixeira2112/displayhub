import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const imports = readFileSync('src/module-navigation.css', 'utf8')
if (!imports.includes("@import './windows-devices-cockpit.css';")) {
  throw new Error('O CSS Cockpit de dispositivos não está importado.')
}

const source = readFileSync('src/windows-devices-cockpit.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
if (/grid-template-columns\s*:|display\s*:\s*none|pointer-events\s*:|!important|\.registered-device-qr|\.windows-device-status/.test(source)) {
  throw new Error('O acabamento não pode mudar grades, ocultar interações, QR ou estados de dispositivos.')
}
const rules = source.match(/[^{}]+\{/g) || []
for (const rule of rules) {
  if (rule.trim().startsWith('@')) continue
  const selectors = rule.slice(0, -1).split(',')
  if (selectors.some((selector) => !selector.trim().startsWith('.modern-software-shell .view-devices '))) {
    throw new Error(`Seletor fora do escopo da página de dispositivos: ${rule.trim()}`)
  }
}

const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.css'))
if (!assets.length) throw new Error('O build não gerou CSS.')
const compiled = assets.map((name) => readFileSync(join('dist/assets', name), 'utf8')).join('\n')
const selectors = [
  '.modern-software-shell .view-devices .windows-pairing-card',
  '.modern-software-shell .view-devices .windows-player-row[open]',
  '.modern-software-shell .view-devices .registered-device-row[open]',
  '.modern-software-shell .view-devices .registered-devices-toolbar input',
  '.modern-software-shell .view-devices .windows-device-actions button:focus-visible',
]
for (const selector of selectors) {
  if (!compiled.includes(selector)) throw new Error(`CSS de dispositivos ausente no build: ${selector}`)
}
console.log(`Cockpit Dispositivos: ${selectors.length} seletores compilados; escopo e comandos preservados.`)
