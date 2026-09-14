import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import './device-lists-compact.css'

type RegisteredDevice = {
  id: string
  hostname: string | null
  platform: string
  app_version: string
  last_seen_at: string
  mappings: Array<{ physical_display_id?: string; display_id?: string; playlist_id?: string; player_token?: string; recovery_token?: string }> | null
}

type PlaylistOption = {
  id: string
  name: string
  description: string | null
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

function deviceRecoveryUrl(deviceId: string, recoveryToken: string) {
  const params = new URLSearchParams({ device: deviceId, recover: recoveryToken })
  return `${window.location.origin}${import.meta.env.BASE_URL}device-registered.html?${params.toString()}`
}

function DeviceRecoveryQr({ device, onFeedback }: { device: RegisteredDevice; onFeedback: (message: string) => void }) {
  const qrRef = useRef<HTMLDivElement | null>(null)
  const recoveryToken = useMemo(() => {
    if (!Array.isArray(device.mappings)) return ''
    return device.mappings.find((item) => item.physical_display_id === 'browser')?.recovery_token || ''
  }, [device.mappings])
  const url = useMemo(() => recoveryToken ? deviceRecoveryUrl(device.id, recoveryToken) : '', [device.id, recoveryToken])

  useEffect(() => {
    const container = qrRef.current
    if (!container) return
    container.innerHTML = ''
    if (!url) return
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
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      onFeedback('Link de recuperação do dispositivo copiado.')
    } catch {
      onFeedback('Não foi possível copiar o link automaticamente.')
    }
  }

  if (!recoveryToken) {
    return <div className="windows-device-command-status">Preparando QR de recuperação deste dispositivo…</div>
  }

  return (
    <div className="registered-device-qr">
      <div ref={qrRef} className="registered-device-qr-image" />
      <div className="registered-device-qr-copy">
        <strong>QR de recuperação do dispositivo</strong>
        <span>{device.hostname || 'Dispositivo sem nome'} · {formatPlatform(device.platform)}</span>
        <span>Este QR restaura a identidade deste mesmo dispositivo no aparelho. Ele não muda quando a playlist é alterada.</span>
        <div className="registered-device-inline-actions">
          <button type="button" onClick={() => void copyLink()}>Copiar link</button>
          <a href={url} target="_blank" rel="noreferrer">Abrir recuperação</a>
        </div>
      </div>
    </div>
  )
}

export default function RegisteredDevicesManager() {
  const [devices, setDevices] = useState<RegisteredDevice[]>([])
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([])
  const [selectionByDevice, setSelectionByDevice] = useState<Record<string, string>>({})
  const [feedbackByDevice, setFeedbackByDevice] = useState<Record<string, string>>({})
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    const [{ data: deviceRows, error: deviceError }, { data: playlistRows, error: playlistError }] = await Promise.all([
      supabase
        .from('player_devices')
        .select('id,hostname,platform,app_version,last_seen_at,mappings')
        .neq('platform', 'windows')
        .order('created_at', { ascending: false }),
      supabase
        .from('playlists')
        .select('id,name,description')
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ])

    if (deviceError) throw deviceError
    if (playlistError) throw playlistError
    setDevices((deviceRows || []) as RegisteredDevice[])
    setPlaylists((playlistRows || []) as PlaylistOption[])
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

  const playlistById = useMemo(() => new Map(playlists.map((playlist) => [playlist.id, playlist])), [playlists])
  const visibleDevices = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return devices
    return devices.filter((device) => {
      const mapping = Array.isArray(device.mappings)
        ? device.mappings.find((item) => item.physical_display_id === 'browser' && item.playlist_id)
        : null
      const playlist = mapping?.playlist_id ? playlistById.get(mapping.playlist_id) : null
      return [device.hostname, formatPlatform(device.platform), device.app_version, playlist?.name, playlist?.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [devices, playlistById, filter])

  const assign = async (device: RegisteredDevice) => {
    const playlistId = selectionByDevice[device.id] || ''
    if (!playlistId) {
      setFeedbackByDevice((current) => ({ ...current, [device.id]: 'Escolha uma playlist antes de associar.' }))
      return
    }

    setBusyDeviceId(device.id)
    setFeedbackByDevice((current) => ({ ...current, [device.id]: 'Alterando playlist...' }))
    try {
      const { data, error: rpcError } = await supabase.rpc('assign_registered_device_playlist', {
        p_device_id: device.id,
        p_playlist_id: playlistId,
      })
      if (rpcError) throw rpcError
      const result = data as { playlist_name?: string }
      setFeedbackByDevice((current) => ({
        ...current,
        [device.id]: `${result?.playlist_name || 'Playlist'} associada. O dispositivo mudará automaticamente em alguns segundos.`,
      }))
      await load()
    } catch (nextError) {
      setFeedbackByDevice((current) => ({
        ...current,
        [device.id]: nextError instanceof Error ? nextError.message : 'Não foi possível alterar a playlist.',
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
          placeholder="Buscar dispositivo ou playlist"
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
              ? device.mappings.find((item) => item.physical_display_id === 'browser' && item.playlist_id)
              : null
            const assignedPlaylist = mapping?.playlist_id ? playlistById.get(mapping.playlist_id) : null
            const busy = busyDeviceId === device.id
            const feedback = feedbackByDevice[device.id]

            return (
              <details className="registered-device-row" key={device.id}>
                <summary className="registered-device-summary">
                  <span className="windows-device-status online">Registrado</span>
                  <strong>{device.hostname || 'Dispositivo sem nome'}</strong>
                  <span className="registered-device-platform">{formatPlatform(device.platform)}</span>
                  <span className={assignedPlaylist ? 'registered-device-assigned' : 'registered-device-pending'}>
                    {assignedPlaylist ? assignedPlaylist.name : 'Sem playlist'}
                  </span>
                  <span className="registered-device-last-seen">{formatLastSeen(device.last_seen_at)}</span>
                  <span className="registered-device-expand">Detalhes</span>
                </summary>

                <div className="registered-device-details">
                  <div className="registered-device-assignment">
                    <select
                      value={selectionByDevice[device.id] || mapping?.playlist_id || ''}
                      onChange={(event) => setSelectionByDevice((current) => ({ ...current, [device.id]: event.target.value }))}
                    >
                      <option value="">Escolha uma playlist</option>
                      {playlists.map((playlist) => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" disabled={busy || playlists.length === 0} onClick={() => void assign(device)}>
                      {assignedPlaylist ? 'Alterar playlist' : 'Associar playlist'}
                    </button>
                  </div>

                  <div className="windows-device-command-status status-completed">
                    {assignedPlaylist
                      ? `Playlist atual: ${assignedPlaylist.name}. Alterações são recebidas automaticamente pelo dispositivo.`
                      : 'Sem playlist associada. Assim que uma playlist for escolhida, o dispositivo receberá a configuração automaticamente.'}
                  </div>

                  <DeviceRecoveryQr
                    device={device}
                    onFeedback={(message) => setFeedbackByDevice((current) => ({ ...current, [device.id]: message }))}
                  />

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
