import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import './windows-devices.css'

type Device = {
  id: string
  hostname: string | null
  app_version: string
  os_release: string | null
  monitor_count: number
  kiosk_mode: boolean
  auto_start: boolean
  last_seen_at: string
}

type DeviceCommand = {
  id: string
  device_id: string
  command: string
  status: 'queued' | 'claimed' | 'completed' | 'failed' | 'expired'
  result: string | null
  created_at: string
  completed_at: string | null
}

type DisplayOption = {
  id: string
  name: string
  location: string | null
}

type PairingMonitor = {
  id: string
  label?: string
  primary?: boolean
  width?: number
  height?: number
  x?: number
  y?: number
}

type PairingPreview = {
  pairing_id: string
  hostname: string | null
  monitors: PairingMonitor[]
  expires_at: string
}

type RemoteCommand = 'reload_displays' | 'restart_player' | 'enter_kiosk' | 'exit_kiosk' | 'reboot_device'

const commandLabels: Record<RemoteCommand, string> = {
  reload_displays: 'Recarregar telas',
  restart_player: 'Reiniciar Player',
  enter_kiosk: 'Entrar em quiosque',
  exit_kiosk: 'Sair do quiosque',
  reboot_device: 'Reiniciar computador',
}

function isOnline(lastSeenAt: string) {
  return Date.now() - new Date(lastSeenAt).getTime() < 120_000
}

function formatLastSeen(lastSeenAt: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(lastSeenAt).getTime()) / 1000))
  if (seconds < 60) return `há ${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `há ${minutes} min`
  return new Date(lastSeenAt).toLocaleString('pt-BR')
}

export default function WindowsDevicesManager() {
  const [devices, setDevices] = useState<Device[]>([])
  const [commands, setCommands] = useState<DeviceCommand[]>([])
  const [displays, setDisplays] = useState<DisplayOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState('')
  const [feedbackByDevice, setFeedbackByDevice] = useState<Record<string, string>>({})
  const [pairingCode, setPairingCode] = useState('')
  const [pairingPreview, setPairingPreview] = useState<PairingPreview | null>(null)
  const [pairingSelections, setPairingSelections] = useState<Record<string, string>>({})
  const [pairingFeedback, setPairingFeedback] = useState('')
  const [pairingBusy, setPairingBusy] = useState(false)

  const load = useCallback(async () => {
    const [
      { data: deviceRows, error: deviceError },
      { data: commandRows, error: commandError },
      { data: displayRows, error: displayError },
    ] = await Promise.all([
      supabase
        .from('player_devices')
        .select('id,hostname,app_version,os_release,monitor_count,kiosk_mode,auto_start,last_seen_at')
        .order('hostname', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true }),
      supabase
        .from('player_device_commands')
        .select('id,device_id,command,status,result,created_at,completed_at')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('displays')
        .select('id,name,location')
        .eq('is_active', true)
        .is('revoked_at', null)
        .order('name', { ascending: true }),
    ])

    if (deviceError) throw deviceError
    if (commandError) throw commandError
    if (displayError) throw displayError
    setDevices((deviceRows || []) as Device[])
    setCommands((commandRows || []) as DeviceCommand[])
    setDisplays((displayRows || []) as DisplayOption[])
  }, [])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        await load()
        if (active) setGlobalError('')
      } catch (error) {
        if (active) setGlobalError(error instanceof Error ? error.message : 'Não foi possível carregar os Players Windows.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), 10_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [load])

  const latestCommandByDevice = useMemo(() => {
    const map = new Map<string, DeviceCommand>()
    for (const command of commands) {
      if (!map.has(command.device_id)) map.set(command.device_id, command)
    }
    return map
  }, [commands])

  const lookupPairingCode = async () => {
    const normalizedCode = pairingCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setPairingCode(normalizedCode)
    setPairingFeedback('')
    setPairingPreview(null)
    setPairingSelections({})

    if (normalizedCode.length !== 6) {
      setPairingFeedback('Informe os 6 caracteres exibidos no Player Windows.')
      return
    }

    setPairingBusy(true)
    try {
      const { data, error } = await supabase.rpc('preview_windows_player_pairing', { p_code: normalizedCode })
      if (error) throw error
      const preview = data as PairingPreview
      const monitors = Array.isArray(preview?.monitors) ? preview.monitors : []
      if (!preview?.pairing_id || monitors.length === 0) throw new Error('O código não possui monitores disponíveis para ativação.')
      setPairingPreview({ ...preview, monitors })
      setPairingSelections(Object.fromEntries(monitors.map((monitor) => [String(monitor.id), ''])))
    } catch (error) {
      setPairingFeedback(error instanceof Error ? error.message : 'Código de ativação não encontrado ou expirado.')
    } finally {
      setPairingBusy(false)
    }
  }

  const activatePairing = async () => {
    if (!pairingPreview) return
    const mappings = pairingPreview.monitors
      .map((monitor) => ({
        physical_display_id: String(monitor.id),
        display_id: pairingSelections[String(monitor.id)] || '',
      }))
      .filter((mapping) => mapping.display_id)

    if (mappings.length !== pairingPreview.monitors.length) {
      setPairingFeedback('Escolha uma tela do DisplayHub para cada monitor detectado.')
      return
    }

    setPairingBusy(true)
    setPairingFeedback('Ativando o Player...')
    try {
      const { error } = await supabase.rpc('claim_windows_player_pairing', {
        p_code: pairingCode,
        p_mappings: mappings,
      })
      if (error) throw error
      setPairingFeedback('Ativação autorizada. O Player receberá a configuração e iniciará automaticamente em alguns segundos.')
      setPairingPreview(null)
      setPairingSelections({})
      setPairingCode('')
      window.setTimeout(() => void load(), 4000)
    } catch (error) {
      setPairingFeedback(error instanceof Error ? error.message : 'Não foi possível concluir a ativação.')
    } finally {
      setPairingBusy(false)
    }
  }

  const sendCommand = async (device: Device, command: RemoteCommand) => {
    if (command === 'reboot_device') {
      const confirmed = window.confirm(`Reiniciar o computador ${device.hostname || 'selecionado'}? O Windows será reiniciado remotamente.`)
      if (!confirmed) return
    }

    setBusyDeviceId(device.id)
    setFeedbackByDevice((current) => ({ ...current, [device.id]: '' }))
    try {
      const { error } = await supabase.rpc('queue_windows_player_command', {
        p_device_id: device.id,
        p_command: command,
      })
      if (error) throw error
      setFeedbackByDevice((current) => ({
        ...current,
        [device.id]: `${commandLabels[command]} enviado para ${device.hostname || 'o Player'}.`,
      }))
      await load()
    } catch (error) {
      setFeedbackByDevice((current) => ({
        ...current,
        [device.id]: error instanceof Error ? error.message : 'Não foi possível enviar o comando.',
      }))
    } finally {
      setBusyDeviceId(null)
    }
  }

  if (loading) return <section className="windows-devices-panel"><p>Carregando Players Windows…</p></section>

  return (
    <section className="windows-devices-panel">
      <div className="windows-devices-heading">
        <div>
          <p className="eyebrow">Operação remota</p>
          <h1>Players Windows</h1>
          <p>Veja quais computadores estão online, ative novos Players e envie comandos seguros para instalações existentes.</p>
        </div>
        <button className="secondary-button compact" type="button" onClick={() => void load()}>Atualizar</button>
      </div>

      {globalError && <div className="windows-devices-feedback">{globalError}</div>}

      <section className="windows-pairing-card">
        <div className="windows-pairing-copy">
          <p className="eyebrow">Nova instalação</p>
          <h2>Ativar Player por código</h2>
          <p>Digite o código de 6 caracteres exibido no computador. Depois escolha qual tela do DisplayHub cada monitor deve abrir.</p>
        </div>
        <div className="windows-pairing-code-row">
          <input
            value={pairingCode}
            onChange={(event) => setPairingCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            onKeyDown={(event) => { if (event.key === 'Enter') void lookupPairingCode() }}
            placeholder="A7K2P9"
            maxLength={6}
            aria-label="Código de ativação"
          />
          <button type="button" disabled={pairingBusy} onClick={() => void lookupPairingCode()}>Localizar Player</button>
        </div>

        {pairingPreview && (
          <div className="windows-pairing-preview">
            <div className="windows-pairing-preview-head">
              <div>
                <strong>{pairingPreview.hostname || 'Computador Windows'}</strong>
                <span>{pairingPreview.monitors.length} {pairingPreview.monitors.length === 1 ? 'monitor detectado' : 'monitores detectados'}</span>
              </div>
              <span>Código válido até {new Date(pairingPreview.expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div className="windows-pairing-monitor-list">
              {pairingPreview.monitors.map((monitor, index) => (
                <label className="windows-pairing-monitor" key={String(monitor.id)}>
                  <span>
                    <strong>{monitor.label || `Monitor ${index + 1}`}{monitor.primary ? ' · Principal' : ''}</strong>
                    <small>{monitor.width && monitor.height ? `${monitor.width} × ${monitor.height}` : `ID ${monitor.id}`}</small>
                  </span>
                  <select
                    value={pairingSelections[String(monitor.id)] || ''}
                    onChange={(event) => setPairingSelections((current) => ({ ...current, [String(monitor.id)]: event.target.value }))}
                  >
                    <option value="">Escolha a tela DisplayHub</option>
                    {displays.map((display) => (
                      <option key={display.id} value={display.id}>{display.name}{display.location ? ` · ${display.location}` : ''}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <button className="windows-pairing-activate" type="button" disabled={pairingBusy || displays.length === 0} onClick={() => void activatePairing()}>
              Ativar e enviar configuração
            </button>
          </div>
        )}

        {pairingFeedback && <div className="windows-devices-feedback">{pairingFeedback}</div>}
      </section>

      {devices.length === 0 ? (
        <div className="windows-device-empty">Nenhum Player Windows registrado ainda.</div>
      ) : (
        <div className="windows-device-grid">
          {devices.map((device) => {
            const online = isOnline(device.last_seen_at)
            const latest = latestCommandByDevice.get(device.id)
            const busy = busyDeviceId === device.id
            const kioskCommand: RemoteCommand = device.kiosk_mode ? 'exit_kiosk' : 'enter_kiosk'
            const deviceFeedback = feedbackByDevice[device.id]

            return (
              <article className="windows-device-card" key={device.id}>
                <div className="windows-device-card-head">
                  <div>
                    <span className={`windows-device-status ${online ? 'online' : 'offline'}`}>{online ? 'Online' : 'Offline'}</span>
                    <h2>{device.hostname || 'Computador Windows'}</h2>
                  </div>
                  <span className="windows-device-version">v{device.app_version}</span>
                </div>

                <div className="windows-device-facts">
                  <span><strong>{device.monitor_count}</strong> {device.monitor_count === 1 ? 'monitor' : 'monitores'}</span>
                  <span><strong>{device.kiosk_mode ? 'Quiosque' : 'Janela'}</strong> modo atual</span>
                  <span><strong>{device.auto_start ? 'Ligado' : 'Desligado'}</strong> iniciar com Windows</span>
                  <span><strong>{device.os_release || 'Windows'}</strong> sistema</span>
                </div>

                <p className="windows-device-last-seen">Último contato {formatLastSeen(device.last_seen_at)}</p>

                {deviceFeedback && <div className="windows-devices-feedback">{deviceFeedback}</div>}

                {latest && (
                  <div className={`windows-device-command-status status-${latest.status}`}>
                    Último comando: {latest.command.replaceAll('_', ' ')} · {latest.status}
                    {latest.result ? ` · ${latest.result}` : ''}
                  </div>
                )}

                <div className="windows-device-actions">
                  <button type="button" disabled={!online || busy} onClick={() => void sendCommand(device, 'reload_displays')}>Recarregar telas</button>
                  <button type="button" disabled={!online || busy} onClick={() => void sendCommand(device, 'restart_player')}>Reiniciar Player</button>
                  <button type="button" disabled={!online || busy} onClick={() => void sendCommand(device, kioskCommand)}>{device.kiosk_mode ? 'Sair do quiosque' : 'Entrar em quiosque'}</button>
                  <button className="danger" type="button" disabled={!online || busy} onClick={() => void sendCommand(device, 'reboot_device')}>Reiniciar PC</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
