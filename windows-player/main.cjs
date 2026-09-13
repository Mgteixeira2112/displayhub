const { app, BrowserWindow, ipcMain, safeStorage, shell, screen, session } = require('electron')
const fs = require('fs')
const path = require('path')

const DISPLAYHUB_ORIGIN = 'https://mgteixeira2112.github.io'
const DISPLAYHUB_BASE = '/displayhub/'
const RETRY_MS = 5000
const PLAYER_PARTITION = 'persist:displayhub-player'
const DISK_CACHE_BYTES = 1024 * 1024 * 1024
const MEDIA_CACHE_BYTES = 512 * 1024 * 1024
const STARTUP_STAGGER_MS = 700

app.commandLine.appendSwitch('disk-cache-size', String(DISK_CACHE_BYTES))
app.commandLine.appendSwitch('media-cache-size', String(MEDIA_CACHE_BYTES))
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')

let setupWindow = null
const playerWindows = new Map()
const retryTimers = new Map()
let playerSession = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getPlayerSession() {
  if (!playerSession) playerSession = session.fromPartition(PLAYER_PARTITION, { cache: true })
  return playerSession
}

function configPath() {
  return path.join(app.getPath('userData'), 'player-config.json')
}

function validateDisplayUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    if (url.origin !== DISPLAYHUB_ORIGIN) return null
    if (!url.pathname.startsWith(`${DISPLAYHUB_BASE}display/`)) return null
    if (!url.pathname.slice(`${DISPLAYHUB_BASE}display/`.length)) return null
    return url.toString()
  } catch {
    return null
  }
}

function encryptConfig(config) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('A proteção de credenciais do Windows não está disponível neste computador.')
  }
  return safeStorage.encryptString(JSON.stringify(config)).toString('base64')
}

function decryptConfig(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return null
  try {
    return JSON.parse(safeStorage.decryptString(Buffer.from(value, 'base64')))
  } catch {
    return null
  }
}

function normalizeConfig(raw) {
  if (!raw) return null

  if (Array.isArray(raw.mappings)) {
    const mappings = raw.mappings
      .map((mapping) => ({
        displayId: String(mapping.displayId || ''),
        displayUrl: validateDisplayUrl(mapping.displayUrl),
      }))
      .filter((mapping) => mapping.displayId && mapping.displayUrl)

    return mappings.length ? { version: 2, mappings } : null
  }

  if (raw.displayUrl) {
    const displayUrl = validateDisplayUrl(raw.displayUrl)
    if (!displayUrl) return null
    const primaryDisplay = screen.getPrimaryDisplay()
    return { version: 2, mappings: [{ displayId: String(primaryDisplay.id), displayUrl }] }
  }

  return null
}

function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8'))

    if (raw.encryptedConfig) return normalizeConfig(decryptConfig(raw.encryptedConfig))

    if (raw.encryptedDisplayUrl) {
      const displayUrl = safeStorage.decryptString(Buffer.from(raw.encryptedDisplayUrl, 'base64'))
      return normalizeConfig({ displayUrl })
    }

    return null
  } catch {
    return null
  }
}

function writeConfig(mappings) {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw new Error('Configure pelo menos um monitor.')
  }

  const seenDisplays = new Set()
  const normalized = mappings.map((mapping) => {
    const displayId = String(mapping.displayId || '')
    const displayUrl = validateDisplayUrl(mapping.displayUrl)
    if (!displayId || !displayUrl) throw new Error('Todos os monitores selecionados precisam de um link público válido.')
    if (seenDisplays.has(displayId)) throw new Error('O mesmo monitor foi configurado mais de uma vez.')
    seenDisplays.add(displayId)
    return { displayId, displayUrl }
  })

  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  const encryptedConfig = encryptConfig({ version: 2, mappings: normalized })
  fs.writeFileSync(configPath(), JSON.stringify({ encryptedConfig }, null, 2), 'utf8')
  return { version: 2, mappings: normalized }
}

function clearConfig() {
  try {
    fs.rmSync(configPath(), { force: true })
  } catch {
    // Nothing to clear.
  }
}

function setupLoginLaunch() {
  if (process.platform !== 'win32' || !app.isPackaged) return
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false,
    path: process.execPath,
  })
}

function clearRetry(displayId) {
  const timer = retryTimers.get(displayId)
  if (timer) {
    clearTimeout(timer)
    retryTimers.delete(displayId)
  }
}

function scheduleRetry(displayId, displayUrl) {
  clearRetry(displayId)
  retryTimers.set(displayId, setTimeout(() => {
    const playerWindow = playerWindows.get(displayId)
    if (!playerWindow || playerWindow.isDestroyed()) return
    void loadDisplay(playerWindow, displayId, displayUrl)
  }, RETRY_MS))
}

async function loadDisplay(playerWindow, displayId, displayUrl) {
  clearRetry(displayId)
  try {
    await playerWindow.loadURL(displayUrl)
  } catch {
    scheduleRetry(displayId, displayUrl)
  }
}

function attachPlayerGuards(playerWindow, displayId, displayUrl) {
  playerWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(DISPLAYHUB_ORIGIN)) return { action: 'allow' }
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  playerWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(DISPLAYHUB_ORIGIN)) event.preventDefault()
  })

  playerWindow.webContents.on('did-fail-load', (_event, errorCode, _description, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return
    if (validatedUrl && validatedUrl.startsWith(DISPLAYHUB_ORIGIN)) scheduleRetry(displayId, displayUrl)
  })

  playerWindow.webContents.on('render-process-gone', () => scheduleRetry(displayId, displayUrl))

  playerWindow.webContents.on('before-input-event', (event, input) => {
    const maintenanceShortcut = input.control && input.shift && input.key.toLowerCase() === 'q'
    if (maintenanceShortcut) {
      event.preventDefault()
      void showSetup()
    }
  })

  playerWindow.on('closed', () => {
    clearRetry(displayId)
    playerWindows.delete(displayId)
  })
}

function closePlayerWindows() {
  for (const [displayId, playerWindow] of playerWindows) {
    clearRetry(displayId)
    if (!playerWindow.isDestroyed()) playerWindow.destroy()
  }
  playerWindows.clear()
}

function getPhysicalDisplays() {
  const primaryId = String(screen.getPrimaryDisplay().id)
  return screen.getAllDisplays()
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
    .map((display, index) => ({
      id: String(display.id),
      label: `Monitor ${index + 1}`,
      primary: String(display.id) === primaryId,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      size: display.size,
    }))
}

function resolvePhysicalDisplay(displayId) {
  const displays = screen.getAllDisplays()
  return displays.find((display) => String(display.id) === String(displayId)) || null
}

function createPlayerWindow(mapping) {
  const physicalDisplay = resolvePhysicalDisplay(mapping.displayId)
  if (!physicalDisplay) return null

  const playerWindow = new BrowserWindow({
    x: physicalDisplay.bounds.x,
    y: physicalDisplay.bounds.y,
    width: physicalDisplay.bounds.width,
    height: physicalDisplay.bounds.height,
    frame: false,
    kiosk: true,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#050811',
    show: false,
    webPreferences: {
      session: getPlayerSession(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      devTools: !app.isPackaged,
    },
  })

  attachPlayerGuards(playerWindow, mapping.displayId, mapping.displayUrl)
  playerWindow.once('ready-to-show', () => playerWindow.show())
  playerWindows.set(mapping.displayId, playerWindow)
  void loadDisplay(playerWindow, mapping.displayId, mapping.displayUrl)
  return playerWindow
}

async function launchConfiguredDisplays(config = readConfig()) {
  if (!config?.mappings?.length) {
    await showSetup()
    return
  }

  closePlayerWindows()
  let launched = 0
  for (const mapping of config.mappings) {
    if (createPlayerWindow(mapping)) {
      launched += 1
      if (config.mappings.length > 1) await sleep(STARTUP_STAGGER_MS)
    }
  }

  if (launched === 0) {
    await showSetup()
    return
  }

  if (setupWindow && !setupWindow.isDestroyed()) setupWindow.hide()
}

async function showSetup() {
  closePlayerWindows()
  if (!setupWindow || setupWindow.isDestroyed()) createSetupWindow()
  setupWindow.setKiosk(false)
  setupWindow.show()
  setupWindow.focus()
  await setupWindow.loadFile(path.join(__dirname, 'setup.html'))
}

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 820,
    minHeight: 560,
    autoHideMenuBar: true,
    backgroundColor: '#0b1220',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  })

  setupWindow.on('closed', () => {
    setupWindow = null
  })
}

ipcMain.handle('player:get-status', () => {
  const config = readConfig()
  return {
    configured: Boolean(config?.mappings?.length),
    mappings: config?.mappings || [],
    monitors: getPhysicalDisplays(),
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    packaged: app.isPackaged,
    sharedCache: true,
  }
})

ipcMain.handle('player:refresh-monitors', () => getPhysicalDisplays())

ipcMain.handle('player:save-mappings', async (_event, mappings) => {
  const config = writeConfig(mappings)
  await launchConfiguredDisplays(config)
  return { ok: true }
})

ipcMain.handle('player:reset', async () => {
  clearConfig()
  await showSetup()
  return { ok: true }
})

app.whenReady().then(() => {
  setupLoginLaunch()
  getPlayerSession()
  createSetupWindow()

  screen.on('display-added', () => {
    if (setupWindow && setupWindow.isVisible()) setupWindow.webContents.send('player:monitors-changed')
  })
  screen.on('display-removed', () => {
    if (setupWindow && setupWindow.isVisible()) setupWindow.webContents.send('player:monitors-changed')
  })
  screen.on('display-metrics-changed', () => {
    if (setupWindow && setupWindow.isVisible()) setupWindow.webContents.send('player:monitors-changed')
  })

  const config = readConfig()
  if (config) void launchConfiguredDisplays(config)
  else void showSetup()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSetupWindow()
      const nextConfig = readConfig()
      if (nextConfig) void launchConfiguredDisplays(nextConfig)
      else void showSetup()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
