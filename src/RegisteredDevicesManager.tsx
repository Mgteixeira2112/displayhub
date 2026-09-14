import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import './device-lists-compact.css'

type RegisteredDevice = {
  id: string
  hostname: string | null
  platform: string
  app_version: string
  last_seen_at: string
  mappings: Array<{ physical_display_id?: string; display_id?: string }> | null
}

type DisplayOption = {
  id: string
  name: string
  location: string | null
  public_token: string
}

type QrConstructor = new (
  element: HTMLElement,
  options: { text: string; width: number; height: number; colorDark: string; colorLight: string },
) => unknown

function formatPlatform(platform: string) {
  if (platform === 'android') return 'Android'
  if (platform === 'ios') return 'iOS'
  if (platform === 'windows-web') return 'Windows Web'
  return platform || 'Web'
}

function formatLastSeen(lastSeenAt: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(lastSeenAt).getTime()) / 1000))
  if (seconds < 60) return `há ${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `há ${minutes} min`
  return new Date(lastSeenAt).toLocaleString('pt-BR')
}

function displayPlayerUrl(publicToken: string) {
  const route = `display/${publicToken}`
  return `${window.location.origin}${import.meta.env.BASE_URL}?p=${encodeURIComponent(route)}`
}

function StoredDisplayQr({ display, onFeedback }: { display: DisplayOption; onFeedback: (message: string) => void }) {
  const qrRef = useRef<HTMLDivElement | null>(null)
  const url = useMemo(() => displayPlayerUrl(display.public_token), [display.public_token])

  useEffect(() => {
    const container = qrRef.current
    if (!container) return
    container.innerHTML = ''
    const QRCode = (window as Window & { QRCode?: QrConstructor }).QRCode
    if (!QRCode) return
    new QRCode(container, {
      text: url,
      width: 148,
      height: 148,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
    })
  }, [url])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      onFeedback('Link da tela copiado.')
    } catch {
      onFeedback('Não foi possível copiar o link automaticamente.')
    }
  }

  return (
    <div className="registered-device-qr">
      <div ref={qrRef} className="registered-device-qr-image" />
      <div className="registered-device-qr-copy">
        <strong>QR de recuperação da tela</strong>
        <span>{display.name}{display.location ? ` · ${display.location}` : ''}</span>
        <div className="registered-device-inline-actions">
          <button type="button" onClick={() => void copyLink()}>Copiar link</button>
          <a href={url} target="_blank" rel="noreferrer">Abrir tela</a>
        </div>
      </div>
    </div>
  )
}

export default function RegisteredDevicesManager() {
  const [devices, setDevices] = useState<RegisteredDevice[]>([])
  const [displays, setDisplays] = useState<DisplayOption[]>([])
  const [selectionByDevice, setSelectionByDevice] = useState<Record<string, string>>({})
  const [feedbackByDevice, setFeedbackByDevice] = useState<Record<string, string>>({})
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    const [{ data: deviceRows, error: deviceError }, { data: displayRows, error: displayError }] = await Promise.all([
      supabase
        .from('player_devices')
        .select('id,hostname,platform,app_version,last_seen_at,mappings')
        .neq('platform', 'windows')
        .order('created_at', { ascending: false }),
      supabase
        .from('displays')
        .select('id,name,location,public_token')
        .eq('is_active', true)
        .is('revoked_at', null)
        .order('name', { ascending: true }),
    ])

    if (deviceError) throw deviceError
    if (displayError) throw displayError
    setDevices((deviceRows || []) as RegisteredDevice[])
    setDisplays((displayRows || []) as DisplayOption[])
  }, [])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        await load()
        if (active) setError('')
      } catch (nextError) {
        if (active) setError(nextError instanceof Error ? nextError.message : 'Não foi possível carregar os dispositivos registrados.')
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

  const displayById = useMemo(() => new Map(displays.map((display) => [display.id, display])), [displays])
  const visibleDevices = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return devices
    return devices.filter((device) => {
      const mapping = Array.isArray(device.mappings)
        ? device.mappings.find((item) => item.physical_display_id === 'browser' && item.display_id)
        : null
      const display = mapping?.display_id ? displayById.get(mapping.display_id) : null
      return [device.hostname, formatPlatform(device.platform), device.app_version, display?.name, display?.location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [devices, displayById, filter])

  const assign = async (device: RegisteredDevice) => {
    const displayId = selectionByDevice[device.id] || ''
    if (!displayId) {
      setFeedbackByDevice((current) => ({ ...current, [device.id]: 'Escolha uma tela antes de associar.' }))
      return
    }

    setBusyDeviceId(device.id)
    setFeedbackByDevice((current) => ({ ...current, [device.id]: 'Alterando associação...' }))
    try {
      const { data, error: rpcError } = await supabase.rpc('assign_registered_device_display', {
        p_device_id: device.id,
        p_display_id: displayId,
      })
      if (rpcError) throw rpcError
      const result = data as { display_name?: string }
      setFeedbackByDevice((current) => ({
        ...current,
        [device.id]: `${result?.display_name || 'Tela'} associada. O dispositivo mudará automaticamente em alguns segundos.`,
      }))
      await load()
    } catch (nextError) {
      setFeedbackByDevice((current) => ({
        ...current,
        [device.id]: nextError instanceof Error ? nextError.message : 'Não foi possível alterar a associação.',
      }))
    } finally {
      setBusyDeviceId(null)
    }
  }

  if (loading) return <section className="windows-pairing-card"><p>Carregando dispositivos registrados…</p></section>

  return (
    <section className="windows-pairing-card registered-devices-panel">
      <div className="registered-devices-toolbar">
        <div>
          <p className="eyebrow">Dispositivos registrados</p>
          <h2>{devices.length} {devices.length === 1 ? 'dispositivo' : 'dispositivos'}</h2>
        </div>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Buscar dispositivo ou tela"
          aria-label="Buscar dispositivo"
        />
      </div>

      {error && <div className="windows-devices-feedback">{error}</div>}

      {devices.length === 0 ? (
        <div className="windows-device-empty">Nenhum dispositivo registrado por QR.</div>
      ) : visibleDevices.length === 0 ? (
        <div className="windows-device-empty">Nenhum dispositivo corresponde à busca.</div>
      ) : (
        <div className="registered-device-list">
          {visibleDevices.map((device) => {
            const mapping = Array.isArray(device.mappings)
              ? device.mappings.find((item) => item.physical_display_id === 'browser' && item.display_id)
              : null
            const assignedDisplay = mapping?.display_id ? displayById.get(mapping.display_id) : null
            const busy = busyDeviceId === device.id
            const feedback = feedbackByDevice[device.id]

            return (
              <details className="registered-device-row" key={device.id}>
                <summary className="registered-device-summary">
                  <span className="windows-device-status online">Registrado</span>
                  <strong>{device.hostname || 'Dispositivo sem nome'}</strong>
                  <span className="registered-device-platform">{formatPlatform(device.platform)}</span>
                  <span className={assignedDisplay ? 'registered-device-assigned' : 'registered-device-pending'}>
                    {assignedDisplay ? assignedDisplay.name : 'Sem tela'}
                  </span>
                  <span className="registered-device-last-seen">{formatLastSeen(device.last_seen_at)}</span>
                  <span className="registered-device-expand">Detalhes</span>
                </summary>

                <div className="registered-device-details">
                  <div className="registered-device-assignment">
                    <select
                      value={selectionByDevice[device.id] || mapping?.display_id || ''}
                      onChange={(event) => setSelectionByDevice((current) => ({ ...current, [device.id]: event.target.value }))}
                    >
                      <option value="">Escolha uma tela</option>
                      {displays.map((display) => (
                        <option key={display.id} value={display.id}>
                          {display.name}{display.location ? ` · ${display.location}` : ''}
                        </option>
                      ))}
                    </select>
                    <button type="button" disabled={busy || displays.length === 0} onClick={() => void assign(device)}>
                      {assignedDisplay ? 'Alterar associação' : 'Associar tela'}
                    </button>
                  </div>

                  <div className="windows-device-command-status status-completed">
                    {assignedDisplay
                      ? `Tela atual: ${assignedDisplay.name}${assignedDisplay.location ? ` · ${assignedDisplay.location}` : ''}. Alterações são recebidas automaticamente pelo dispositivo.`
                      : 'Sem tela associada. Assim que uma tela for escolhida, o dispositivo receberá a configuração automaticamente.'}
                  </div>

                  {assignedDisplay && (
                    <StoredDisplayQr
                      display={assignedDisplay}
                      onFeedback={(message) => setFeedbackByDevice((current) => ({ ...current, [device.id]: message }))}
                    />
                  )}

                  {feedback && <div className="windows-devices-feedback">{feedback}</div>}
                </div>
              </details>
            )
          })}
        </div>
      )}
    </section>
  )
}
