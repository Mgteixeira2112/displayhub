const { app, safeStorage, screen } = require('electron')
const fs = require('fs')
const path = require('path')

function configPath() {
  return path.join(app.getPath('userData'), 'player-config.json')
}

function repairSingleMonitorMapping() {
  if (!safeStorage.isEncryptionAvailable()) return

  try {
    const filePath = configPath()
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!raw?.encryptedConfig) return

    const config = JSON.parse(
      safeStorage.decryptString(Buffer.from(raw.encryptedConfig, 'base64')),
    )
    if (!Array.isArray(config?.mappings) || config.mappings.length !== 1) return

    const displays = screen.getAllDisplays()
    if (displays.length !== 1) return

    const currentDisplayId = String(displays[0].id)
    const savedDisplayId = String(config.mappings[0]?.displayId || '')
    const displayUrl = config.mappings[0]?.displayUrl
    if (!displayUrl || !savedDisplayId || savedDisplayId === currentDisplayId) return

    const repairedConfig = {
      ...config,
      mappings: [{ ...config.mappings[0], displayId: currentDisplayId }],
    }
    const encryptedConfig = safeStorage
      .encryptString(JSON.stringify(repairedConfig))
      .toString('base64')

    fs.writeFileSync(filePath, JSON.stringify({ encryptedConfig }, null, 2), 'utf8')
    console.info(`[DisplayHub] monitor remapeado automaticamente: ${savedDisplayId} -> ${currentDisplayId}`)
  } catch (error) {
    console.warn('[DisplayHub] não foi possível reparar o mapeamento na inicialização:', error?.message || error)
  }
}

app.whenReady().then(() => {
  repairSingleMonitorMapping()
})

require('./main.cjs')
