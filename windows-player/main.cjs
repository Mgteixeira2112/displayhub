const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron')
const fs = require('fs')
const path = require('path')

const DISPLAYHUB_ORIGIN = 'https://mgteixeira2112.github.io'
const DISPLAYHUB_BASE = '/displayhub/'
const RETRY_MS = 5000

let mainWindow = null
let retryTimer = null

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

function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8'))
    if (!raw.encryptedDisplayUrl || !safeStorage.isEncryptionAvailable()) return null
    const decrypted = safeStorage.decryptString(Buffer.from(raw.encryptedDisplayUrl, 'base64'))
    const displayUrl = validateDisplayUrl(decrypted)
    if (!displayUrl) return null
    return { displayUrl }
  } catch {
    return null
  }
}

function writeConfig(displayUrl) {
  const validUrl = validateDisplayUrl(displayUrl)
  if (!validUrl) throw new Error('Use um link público válido do DisplayHub.')
  if (!safeStorage.isEncryptionAvailable()) throw new Error('A proteção de credenciais do Windows não está disponível neste computador.')

  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  const encrypted = safeStorage.encryptString(validUrl).toString('base64')
  fs.writeFileSync(configPath(), JSON.stringify({ encryptedDisplayUrl: encrypted }, null, 2), 'utf8')
  return validUrl
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

function clearRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

function scheduleRetry() {
  clearRetry()
  retryTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const config = readConfig()
    if (config) void loadDisplay(config.displayUrl)
  }, RETRY_MS)
}

async function loadDisplay(displayUrl) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  clearRetry()
  mainWindow.setKiosk(true)
  try {
    await mainWindow.loadURL(displayUrl)
  } catch {
    scheduleRetry()
  }
}

async function loadSetup() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  clearRetry()
  mainWindow.setKiosk(false)
  await mainWindow.loadFile(path.join(__dirname, 'setup.html'))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    autoHideMenuBar: true,
    backgroundColor: '#0b1220',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(DISPLAYHUB_ORIGIN)) return { action: 'allow' }
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isSetup = url.startsWith('file://')
    const isDisplayHub = url.startsWith(DISPLAYHUB_ORIGIN)
    if (!isSetup && !isDisplayHub) event.preventDefault()
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _description, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return
    if (validatedUrl && validatedUrl.startsWith(DISPLAYHUB_ORIGIN)) scheduleRetry()
  })

  mainWindow.webContents.on('render-process-gone', () => scheduleRetry())

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const maintenanceShortcut = input.control && input.shift && input.key.toLowerCase() === 'q'
    if (maintenanceShortcut) {
      event.preventDefault()
      void loadSetup()
    }
  })

  mainWindow.on('closed', () => {
    clearRetry()
    mainWindow = null
  })

  const config = readConfig()
  if (config) void loadDisplay(config.displayUrl)
  else void loadSetup()
}

ipcMain.handle('player:get-status', () => {
  const config = readConfig()
  return {
    configured: Boolean(config),
    displayUrl: config?.displayUrl || null,
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    packaged: app.isPackaged,
  }
})

ipcMain.handle('player:save-display-url', async (_event, displayUrl) => {
  const validUrl = writeConfig(displayUrl)
  await loadDisplay(validUrl)
  return { ok: true }
})

ipcMain.handle('player:reset', async () => {
  clearConfig()
  await loadSetup()
  return { ok: true }
})

app.whenReady().then(() => {
  setupLoginLaunch()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
