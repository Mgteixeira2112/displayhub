const { app, ipcMain, safeStorage, screen } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const QRCode = require('qrcode')

const SUPABASE_URL = 'https://meqeluddtwthqmrtbhbr.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yjnvIPUmi8-Kt7yTFibw3w_DQlawViE'
const DISPLAYHUB_DISPLAY_BASE = 'https://mgteixeira2112.github.io/displayhub/display/'
const DISPLAYHUB_PAIRING_BASE = 'https://mgteixeira2112.github.io/displayhub/'
const DEFAULT_SETTINGS = { autoStart: true, kioskMode: true }

function configPath() {
  return path.join(app.getPath('userData'), 'player-config.json')
}

function deviceIdentityPath() {
  return path.join(app.getPath('userData'), 'device-identity.json')
}

function encryptJson(value) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('windows_credential_protection_unavailable')
  return safeStorage.encryptString(JSON.stringify(value)).toString('base64')
}

function decryptJson(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return null
  try {
    return JSON.parse(safeStorage.decryptString(Buffer.from(value, 'base64')))
  } catch {
    return null
  }
}

function readOrCreateDeviceIdentity() {
  try {
    const raw = JSON.parse(fs.readFileSync(deviceIdentityPath(), 'utf8'))
    const identity = decryptJson(raw.encryptedIdentity)
    if (identity?.deviceId && identity?.deviceSecret) return identity
  } catch {
    // Create a new identity below.
  }

  const identity = {
    deviceId: crypto.randomUUID(),
    deviceSecret: crypto.randomBytes(32).toString('hex'),
  }
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(deviceIdentityPath(), JSON.stringify({ encryptedIdentity: encryptJson(identity) }, null, 2), 'utf8')
  return identity
}

function pairingMonitors() {
  const primaryId = String(screen.getPrimaryDisplay().id)
  return screen.getAllDisplays()
    .sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
    .map((display, index) => ({
      id: String(display.id),
      label: `Monitor ${index + 1}`,
      primary: String(display.id) === primaryId,
      width: display.size.width,
      height: display.size.height,
      x: display.bounds.x,
      y: display.bounds.y,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
    }))
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

async function ensureDeviceRegistered(identity) {
  await callSupabaseRpc('heartbeat_windows_player', {
    p_device_id: identity.deviceId,
    p_device_secret: identity.deviceSecret,
    p_hostname: os.hostname(),
    p_app_version: app.getVersion(),
    p_os_release: os.release(),
    p_monitors: pairingMonitors(),
    p_mappings: [],
    p_kiosk_mode: true,
    p_auto_start: true,
  })
}

function writePairedConfig(remoteMappings) {
  if (!Array.isArray(remoteMappings) || remoteMappings.length === 0) throw new Error('pairing_without_mappings')

  const mappings = remoteMappings.map((mapping) => {
    const displayId = String(mapping?.physical_display_id || '')
    const displayUrl = String(mapping?.display_url || '')
    if (!displayId || !displayUrl.startsWith(DISPLAYHUB_DISPLAY_BASE)) throw new Error('invalid_pairing_mapping')
    return { displayId, displayUrl }
  })

  const config = { version: 3, mappings, settings: { ...DEFAULT_SETTINGS } }
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify({ encryptedConfig: encryptJson(config) }, null, 2), 'utf8')
  return config
}

ipcMain.handle('player:start-pairing', async () => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('windows_credential_protection_unavailable')
  const identity = readOrCreateDeviceIdentity()
  await ensureDeviceRegistered(identity)
  const result = await callSupabaseRpc('create_windows_player_pairing', {
    p_device_id: identity.deviceId,
    p_device_secret: identity.deviceSecret,
    p_hostname: os.hostname(),
    p_monitors: pairingMonitors(),
  })
  const code = result?.code || null
  const activationUrl = code ? `${DISPLAYHUB_PAIRING_BASE}?pairing=${encodeURIComponent(code)}` : null
  const qrDataUrl = activationUrl
    ? await QRCode.toDataURL(activationUrl, { errorCorrectionLevel: 'M', margin: 1, width: 280 })
    : null

  return {
    ok: Boolean(result?.ok),
    pairingId: result?.pairing_id || null,
    code,
    expiresAt: result?.expires_at || null,
    activationUrl,
    qrDataUrl,
  }
})

ipcMain.handle('player:poll-pairing', async (_event, pairingId) => {
  if (!pairingId) throw new Error('pairing_id_required')
  const identity = readOrCreateDeviceIdentity()
  const result = await callSupabaseRpc('poll_windows_player_pairing', {
    p_pairing_id: pairingId,
    p_device_id: identity.deviceId,
    p_device_secret: identity.deviceSecret,
  })

  if (result?.status === 'claimed' && Array.isArray(result?.mappings) && result.mappings.length > 0) {
    writePairedConfig(result.mappings)
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 900)
    return { ok: true, status: 'configured' }
  }

  return {
    ok: Boolean(result?.ok),
    status: result?.status || 'pending',
    expiresAt: result?.expires_at || null,
  }
})

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
