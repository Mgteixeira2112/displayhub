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
  const [loading, setLoading] = useState(true)
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    const [{ data: deviceRows, error: deviceError }, { data: commandRows, error: commandError }] = await Promise.all([
      supabase
        .from('player_devices')
        .select('id,hostname,app_version,os_release,monitor_count,kiosk_mode,auto_start,last_seen_at')
        .order('last_seen_at', { ascending: false }),
      supabase
        .from('player_device_commands')
        .select('id,device_id,command,status,result,created_at,completed_at')
        .order('created_at', { ascending: false })
        .limit(40),
    ])

    if (deviceError) throw deviceError
    if (commandError) throw commandError
    setDevices((deviceRows || []) as Device[])
    setCommands((commandRows || []) as DeviceCommand[])
  }, [])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        await load()
      } catch (error) {
        if (active) setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar os Players Windows.')
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

  const sendCommand = async (device: Device, command: RemoteCommand) => {
    if (command === 'reboot_device') {
      const confirmed = window.confirm(`Reiniciar o computador ${device.hostname || 'selecionado'}? O Windows será reiniciado remotamente.`)
      if (!confirmed) return
    }

    setBusyDeviceId(device.id)
    setFeedback('')
    try {
      const { error } = await supabase.rpc('queue_windows_player_command', {
        p_device_id: device.id,
        p_command: command,
      })
      if (error) throw error
      setFeedback(`${commandLabels[command]} enviado para ${device.hostname || 'o Player'}.`)
      await load()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível enviar o comando.')
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
          <p>Veja quais computadores estão online e envie comandos seguros para o Player instalado.</p>
        </div>
        <button className="secondary-button compact" type="button" onClick={() => void load()}>Atualizar</button>
      </div>

      {feedback && <div className="windows-devices-feedback">{feedback}</div>}

      {devices.length === 0 ? (
        <div className="windows-device-empty">Nenhum Player Windows registrado ainda.</div>
      ) : (
        <div className="windows-device-grid">
          {devices.map((device) => {
            const online = isOnline(device.last_seen_at)
            const latest = latestCommandByDevice.get(device.id)
            const busy = busyDeviceId === device.id
            const kioskCommand: RemoteCommand = device.kiosk_mode ? 'exit_kiosk' : 'enter_kiosk'

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
