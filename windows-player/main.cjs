const { app, BrowserWindow, ipcMain, safeStorage, shell, screen, session } = require('electron')
const crypto = require('crypto')
const { execFile } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DISPLAYHUB_ORIGIN = 'https://mgteixeira2112.github.io'
const DISPLAYHUB_BASE = '/displayhub/'
const SUPABASE_URL = 'https://meqeluddtwthqmrtbhbr.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yjnvIPUmi8-Kt7yTFibw3w_DQlawViE'
const RETRY_MS = 5000
const HEARTBEAT_MS = 60000
const COMMAND_POLL_MS = 5000
const PLAYER_PARTITION = 'persist:displayhub-player'
const DISK_CACHE_BYTES = 1024 * 1024 * 1024
const MEDIA_CACHE_BYTES = 512 * 1024 * 1024
const STARTUP_STAGGER_MS = 700
const DEFAULT_SETTINGS = { autoStart: true, kioskMode: true }

app.commandLine.appendSwitch('disk-cache-size', String(DISK_CACHE_BYTES))
app.commandLine.appendSwitch('media-cache-size', String(MEDIA_CACHE_BYTES))
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')

let setupWindow = null
const playerWindows = new Map()
const retryTimers = new Map()
let playerSession = null
let heartbeatTimer = null
let commandPollTimer = null
let commandPollInFlight = false

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

function deviceIdentityPath() {
  return path.join(app.getPath('userData'), 'device-identity.json')
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

function displayTokenFromUrl(value) {
  const displayUrl = validateDisplayUrl(value)
  if (!displayUrl) return null
  try {
    const url = new URL(displayUrl)
    return url.pathname.slice(`${DISPLAYHUB_BASE}display/`.length).split('/')[0] || null
  } catch {
    return null
  }
}

function normalizeSettings(value) {
  return {
    autoStart: value?.autoStart !== false,
    kioskMode: value?.kioskMode !== false,
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

    return mappings.length ? { version: 3, mappings, settings: normalizeSettings(raw.settings) } : null
  }

  if (raw.displayUrl) {
    const displayUrl = validateDisplayUrl(raw.displayUrl)
    if (!displayUrl) return null
    const primaryDisplay = screen.getPrimaryDisplay()
    return {
      version: 3,
      mappings: [{ displayId: String(primaryDisplay.id), displayUrl }],
      settings: { ...DEFAULT_SETTINGS },
    }
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

function writeConfig(mappings, settings) {
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

  const normalizedSettings = normalizeSettings(settings)
  const config = { version: 3, mappings: normalized, settings: normalizedSettings }
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  const encryptedConfig = encryptConfig(config)
  fs.writeFileSync(configPath(), JSON.stringify({ encryptedConfig }, null, 2), 'utf8')
  return config
}

function clearConfig() {
  try {
    fs.rmSync(configPath(), { force: true })
  } catch {
    // Nothing to clear.
  }
}

function readOrCreateDeviceIdentity() {
  try {
    const raw = JSON.parse(fs.readFileSync(deviceIdentityPath(), 'utf8'))
    const identity = decryptConfig(raw.encryptedIdentity)
    if (identity?.deviceId && identity?.deviceSecret) return identity
  } catch {
    // Create a new identity below.
  }

  const identity = {
    deviceId: crypto.randomUUID(),
    deviceSecret: crypto.randomBytes(32).toString('hex'),
  }
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(deviceIdentityPath(), JSON.stringify({ encryptedIdentity: encryptConfig(identity) }, null, 2), 'utf8')
  return identity
}

function applyLoginLaunch(settings = DEFAULT_SETTINGS) {
  if (process.platform !== 'win32' || !app.isPackaged) return
  app.setLoginItemSettings({
    openAtLogin: Boolean(settings.autoStart),
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

function heartbeatMonitors() {
  return getPhysicalDisplays().map((monitor) => ({
    id: monitor.id,
    primary: monitor.primary,
    width: monitor.size.width,
    height: monitor.size.height,
    x: monitor.bounds.x,
    y: monitor.bounds.y,
    scaleFactor: monitor.scaleFactor,
    rotation: monitor.rotation,
  }))
}

function heartbeatMappings(config) {
  return (config?.mappings || [])
    .map((mapping) => ({
      physical_display_id: String(mapping.displayId || ''),
      public_token: displayTokenFromUrl(mapping.displayUrl),
    }))
    .filter((mapping) => mapping.physical_display_id && mapping.public_token)
}

async function callSupabaseRpc(functionName, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`${functionName}_http_${response.status}`)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function sendHeartbeat() {
  if (!safeStorage.isEncryptionAvailable()) return false

  try {
    const identity = readOrCreateDeviceIdentity()
    const config = readConfig()
    const settings = config?.settings || { ...DEFAULT_SETTINGS }
    await callSupabaseRpc('heartbeat_windows_player', {
      p_device_id: identity.deviceId,
      p_device_secret: identity.deviceSecret,
      p_hostname: os.hostname(),
      p_app_version: app.getVersion(),
      p_os_release: os.release(),
      p_monitors: heartbeatMonitors(),
      p_mappings: heartbeatMappings(config),
      p_kiosk_mode: settings.kioskMode,
      p_auto_start: settings.autoStart,
    })
    return true
  } catch (error) {
    console.warn('[DisplayHub] heartbeat não enviado:', error?.message || error)
    return false
  }
}

function startHeartbeatLoop() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  void sendHeartbeat()
  heartbeatTimer = setInterval(() => void sendHeartbeat(), HEARTBEAT_MS)
}

async function completeRemoteCommand(identity, commandId, success, result) {
  try {
    await callSupabaseRpc('complete_windows_player_command', {
      p_device_id: identity.deviceId,
      p_device_secret: identity.deviceSecret,
      p_command_id: commandId,
      p_success: success,
      p_result: String(result || '').slice(0, 500),
    })
  } catch (error) {
    console.warn('[DisplayHub] não foi possível confirmar comando remoto:', error?.message || error)
  }
}

async function setRemoteKioskMode(enabled) {
  const config = readConfig()
  if (!config?.mappings?.length) throw new Error('player_not_configured')
  const nextConfig = writeConfig(config.mappings, { ...config.settings, kioskMode: Boolean(enabled) })
  applyLoginLaunch(nextConfig.settings)
  await launchConfiguredDisplays(nextConfig)
  void sendHeartbeat()
}

async function executeRemoteCommand(identity, command) {
  const commandId = command?.id
  const commandName = command?.command
  if (!commandId || !commandName) return

  try {
    if (commandName === 'reload_displays') {
      for (const playerWindow of playerWindows.values()) {
        if (!playerWindow.isDestroyed()) playerWindow.webContents.reloadIgnoringCache()
      }
      await completeRemoteCommand(identity, commandId, true, `reloaded_${playerWindows.size}_windows`)
      return
    }

    if (commandName === 'enter_kiosk') {
      await setRemoteKioskMode(true)
      await completeRemoteCommand(identity, commandId, true, 'kiosk_enabled')
      return
    }

    if (commandName === 'exit_kiosk') {
      await setRemoteKioskMode(false)
      await completeRemoteCommand(identity, commandId, true, 'kiosk_disabled')
      return
    }

    if (commandName === 'restart_player') {
      await completeRemoteCommand(identity, commandId, true, 'player_restarting')
      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 500)
      return
    }

    if (commandName === 'reboot_device') {
      if (process.platform !== 'win32') throw new Error('reboot_supported_only_on_windows')
      await completeRemoteCommand(identity, commandId, true, 'windows_reboot_scheduled')
      execFile('shutdown.exe', ['/r', '/t', '5', '/f'], (error) => {
        if (error) console.warn('[DisplayHub] reinício do Windows falhou:', error.message)
      })
      return
    }

    throw new Error('unsupported_command')
  } catch (error) {
    await completeRemoteCommand(identity, commandId, false, error?.message || String(error))
  }
}

async function pollRemoteCommand() {
  if (commandPollInFlight || !safeStorage.isEncryptionAvailable()) return
  commandPollInFlight = true
  try {
    const identity = readOrCreateDeviceIdentity()
    const command = await callSupabaseRpc('poll_windows_player_command', {
      p_device_id: identity.deviceId,
      p_device_secret: identity.deviceSecret,
    })
    if (command?.id) await executeRemoteCommand(identity, command)
  } catch (error) {
    console.warn('[DisplayHub] consulta de comandos remotos falhou:', error?.message || error)
  } finally {
    commandPollInFlight = false
  }
}

function startRemoteCommandLoop() {
  if (commandPollTimer) clearInterval(commandPollTimer)
  void pollRemoteCommand()
  commandPollTimer = setInterval(() => void pollRemoteCommand(), COMMAND_POLL_MS)
}

function resolvePhysicalDisplay(displayId) {
  const displays = screen.getAllDisplays()
  return displays.find((display) => String(display.id) === String(displayId)) || null
}

function normalWindowBounds(physicalDisplay) {
  const margin = 48
  const width = Math.max(720, Math.min(1280, physicalDisplay.workArea.width - margin * 2))
  const height = Math.max(480, Math.min(720, physicalDisplay.workArea.height - margin * 2))
  return {
    x: physicalDisplay.workArea.x + Math.round((physicalDisplay.workArea.width - width) / 2),
    y: physicalDisplay.workArea.y + Math.round((physicalDisplay.workArea.height - height) / 2),
    width,
    height,
  }
}

function createPlayerWindow(mapping, settings) {
  const physicalDisplay = resolvePhysicalDisplay(mapping.displayId)
  if (!physicalDisplay) return null

  const kioskMode = settings?.kioskMode !== false
  const bounds = kioskMode ? physicalDisplay.bounds : normalWindowBounds(physicalDisplay)
  const playerWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: !kioskMode,
    kiosk: kioskMode,
    fullscreen: kioskMode,
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
    if (createPlayerWindow(mapping, config.settings)) {
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
    height: 820,
    minWidth: 820,
    minHeight: 620,
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
    settings: config?.settings || { ...DEFAULT_SETTINGS },
    monitors: getPhysicalDisplays(),
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    packaged: app.isPackaged,
    sharedCache: true,
  }
})

ipcMain.handle('player:refresh-monitors', () => getPhysicalDisplays())

ipcMain.handle('player:save-mappings', async (_event, mappings, settings) => {
  const config = writeConfig(mappings, settings)
  applyLoginLaunch(config.settings)
  void sendHeartbeat()
  await launchConfiguredDisplays(config)
  return { ok: true, settings: config.settings }
})

ipcMain.handle('player:reset', async () => {
  clearConfig()
  applyLoginLaunch({ autoStart: false, kioskMode: false })
  void sendHeartbeat()
  await showSetup()
  return { ok: true }
})

app.whenReady().then(() => {
  const config = readConfig()
  applyLoginLaunch(config?.settings || DEFAULT_SETTINGS)
  getPlayerSession()
  createSetupWindow()
  startHeartbeatLoop()
  startRemoteCommandLoop()

  screen.on('display-added', () => {
    void sendHeartbeat()
    if (setupWindow && setupWindow.isVisible()) setupWindow.webContents.send('player:monitors-changed')
  })
  screen.on('display-removed', () => {
    void sendHeartbeat()
    if (setupWindow && setupWindow.isVisible()) setupWindow.webContents.send('player:monitors-changed')
  })
  screen.on('display-metrics-changed', () => {
    void sendHeartbeat()
    if (setupWindow && setupWindow.isVisible()) setupWindow.webContents.send('player:monitors-changed')
  })

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

app.on('before-quit', () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (commandPollTimer) clearInterval(commandPollTimer)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
