import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'

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
  if (platform === 'windows-web') return 'Windows (navegador)'
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
      width: 176,
      height: 176,
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
    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '196px minmax(0, 1fr)', gap: 16, alignItems: 'center' }}>
      <div ref={qrRef} style={{ width: 196, minHeight: 196, padding: 10, borderRadius: 16, background: '#fff', display: 'grid', placeItems: 'center' }} />
      <div>
        <strong>QR da tela associada</strong>
        <p style={{ margin: '6px 0 12px' }}>Este QR fica disponível junto ao cadastro do dispositivo e sempre abre a tela <strong>{display.name}</strong>.</p>
        <div className="windows-device-actions">
          <button type="button" onClick={() => void copyLink()}>Copiar link da tela</button>
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

  const assign = async (device: RegisteredDevice) => {
    const displayId = selectionByDevice[device.id] || ''
    if (!displayId) {
      setFeedbackByDevice((current) => ({ ...current, [device.id]: 'Escolha uma tela antes de associar.' }))
      return
    }

    setBusyDeviceId(device.id)
    setFeedbackByDevice((current) => ({ ...current, [device.id]: 'Associando tela ao dispositivo...' }))
    try {
      const { data, error: rpcError } = await supabase.rpc('assign_registered_device_display', {
        p_device_id: device.id,
        p_display_id: displayId,
      })
      if (rpcError) throw rpcError
      const result = data as { display_name?: string }
      setFeedbackByDevice((current) => ({
        ...current,
        [device.id]: `${result?.display_name || 'Tela'} associada. O QR permanente desta tela já está disponível abaixo.`,
      }))
      await load()
    } catch (nextError) {
      setFeedbackByDevice((current) => ({
        ...current,
        [device.id]: nextError instanceof Error ? nextError.message : 'Não foi possível associar a tela.',
      }))
    } finally {
      setBusyDeviceId(null)
    }
  }

  if (loading) return <section className="windows-pairing-card"><p>Carregando dispositivos registrados…</p></section>

  return (
    <section className="windows-pairing-card">
      <div className="windows-pairing-copy">
        <p className="eyebrow">Dispositivos registrados</p>
        <h2>Associar uma tela ao dispositivo</h2>
        <p>O QR inicial registra somente o aparelho. Depois da associação, o QR da tela fica guardado visualmente junto ao cadastro do dispositivo para poder ser lido novamente a qualquer momento.</p>
      </div>

      {error && <div className="windows-devices-feedback">{error}</div>}

      {devices.length === 0 ? (
        <div className="windows-device-empty">Nenhum dispositivo registrado por QR.</div>
      ) : (
        <div className="windows-device-grid">
          {devices.map((device) => {
            const mapping = Array.isArray(device.mappings)
              ? device.mappings.find((item) => item.physical_display_id === 'browser' && item.display_id)
              : null
            const assignedDisplay = mapping?.display_id ? displayById.get(mapping.display_id) : null
            const busy = busyDeviceId === device.id
            const feedback = feedbackByDevice[device.id]

            return (
              <article className="windows-device-card" key={device.id}>
                <div className="windows-device-card-head">
                  <div>
                    <span className="windows-device-status online">Registrado</span>
                    <h2>{device.hostname || 'Dispositivo sem nome'}</h2>
                  </div>
                  <span className="windows-device-version">{formatPlatform(device.platform)}</span>
                </div>

                <div className="windows-device-facts">
                  <span><strong>{assignedDisplay ? 'Associada' : 'Pendente'}</strong> tela</span>
                  <span><strong>{device.app_version}</strong> origem</span>
                </div>

                <p className="windows-device-last-seen">Último contato {formatLastSeen(device.last_seen_at)}</p>

                {assignedDisplay && (
                  <div className="windows-device-command-status status-completed">
                    Tela atual: {assignedDisplay.name}{assignedDisplay.location ? ` · ${assignedDisplay.location}` : ''}
                  </div>
                )}

                <div className="windows-pairing-code-row">
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

                {assignedDisplay && (
                  <StoredDisplayQr
                    display={assignedDisplay}
                    onFeedback={(message) => setFeedbackByDevice((current) => ({ ...current, [device.id]: message }))}
                  />
                )}

                {feedback && <div className="windows-devices-feedback">{feedback}</div>}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
