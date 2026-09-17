// Executar somente em uma branch de candidatos, APÓS revisar as imagens fictícias.
// Não aprova referências, não cria commit e nunca modifica a main automaticamente.
const fs = require('node:fs')
const path = require('node:path')
const { screenshots } = require('./screen-inventory.cjs')

const root = __dirname
const manifestFile = path.join(root, 'baselines', 'manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
if (manifest.status === 'approved') throw new Error('Referências aprovadas não podem ser substituídas por este comando')
if (manifest.status !== 'pending' && manifest.status !== 'candidate') throw new Error('Estado de baseline desconhecido')

const found = new Map()
function visit(folder) {
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, item.name)
    if (item.isDirectory()) visit(file)
    else if (item.name.endsWith('.png')) {
      if (found.has(item.name)) throw new Error(`Captura duplicada: ${item.name}`)
      found.set(item.name, file)
    }
  }
}
visit(path.join(root, 'artifacts', 'test-results'))
const expected = new Set(screenshots)
if (expected.size !== 45 || found.size !== 45 || [...found.keys()].some((name) => !expected.has(name))) {
  throw new Error(`Esperadas 45 capturas sintéticas e distintas; recebidas ${found.size}`)
}
const destination = path.join(root, 'baselines', 'images')
fs.mkdirSync(destination, { recursive: true })
for (const name of screenshots) {
  const source = found.get(name)
  if (!source) throw new Error(`Captura não encontrada: ${name}`)
  const data = fs.readFileSync(source)
  if (!data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new Error(`Captura não é PNG: ${name}`)
  }
  fs.writeFileSync(path.join(destination, name), data)
}
fs.writeFileSync(manifestFile, JSON.stringify({
  version: 1,
  status: 'candidate',
  screenshots,
  approval: null,
}, null, 2) + '\n')
console.log('45 imagens candidatas preparadas SOMENTE neste checkout. Revisar PR e aprovar expressamente antes de alterar status para approved.')
