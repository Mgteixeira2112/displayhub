import { useEffect, useMemo, useRef, useState } from 'react'
import RegisteredDevicesManager from './RegisteredDevicesManager'
import { supabase } from './lib/supabase'

type Installation = {
  request_id: string
  token: string
  expires_at: string
}

type QrConstructor = new (
  element: HTMLElement,
  options: { text: string; width: number; height: number; colorDark: string; colorLight: string },
) => unknown

export default function DeviceInstallationQr() {
  const [installation, setInstallation] = useState<Installation | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [now, setNow] = useState(Date.now())
  const qrRef = useRef<HTMLDivElement | null>(null)
  const activationDetectedRef = useRef(false)

  const activationUrl = useMemo(() => {
    if (!installation?.token) return ''
    return `${window.location.origin}${import.meta.env.BASE_URL}activate.html?install=${encodeURIComponent(installation.token)}`
  }, [installation])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const container = qrRef.current
    if (!container || !activationUrl) return
    container.innerHTML = ''
    const QRCode = (window as Window & { QRCode?: QrConstructor }).QRCode
    if (!QRCode) {
      setFeedback('Não foi possível carregar o QR Code.')
      return
    }
    new QRCode(container, {
      text: activationUrl,
      width: 210,
      height: 210,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
    })
  }, [activationUrl])

  useEffect(() => {
    if (!installation?.request_id) return
    activationDetectedRef.current = false
    let active = true

    const checkInstallation = async () => {
      const { data, error } = await supabase
        .from('device_installation_requests')
        .select('status,device_id')
        .eq('id', installation.request_id)
        .maybeSingle()

      if (!active || error || !data) return

      if (data.status === 'consumed' && data.device_id && !activationDetectedRef.current) {
        activationDetectedRef.current = true
        setFeedback('Dispositivo registrado.')
      }
    }

    void checkInstallation()
    const timer = window.setInterval(() => void checkInstallation(), 1500)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [installation?.request_id])

  const remainingSeconds = installation
    ? Math.max(0, Math.ceil((new Date(installation.expires_at).getTime() - now) / 1000))
    : 0
  const remainingLabel = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`

  const generate = async () => {
    setBusy(true)
    setFeedback('Gerando instalação...')
    try {
      const { data, error } = await supabase.rpc('create_device_installation')
      if (error) throw error
      const next = data as Installation
      if (!next?.token || !next?.expires_at) throw new Error('Não foi possível criar a instalação.')
      activationDetectedRef.current = false
      setInstallation(next)
      setNow(Date.now())
      setFeedback('Instalação pronta.')
    } catch (error) {
      setInstallation(null)
      setFeedback(error instanceof Error ? error.message : 'Não foi possível gerar a instalação.')
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    if (!activationUrl) return
    try {
      await navigator.clipboard.writeText(activationUrl)
      setFeedback('Link copiado.')
    } catch {
      setFeedback('Não foi possível copiar o link.')
    }
  }

  const copyToken = async () => {
    if (!installation?.token) return
    try {
      await navigator.clipboard.writeText(installation.token)
      setFeedback('Token Android copiado.')
    } catch {
      setFeedback('Não foi possível copiar o token.')
    }
  }

  return (
    <>
      <section className="windows-pairing-card">
        <div className="windows-pairing-copy">
          <p className="eyebrow">Nova instalação</p>
          <h2>Gerar instalação de dispositivo</h2>
          <span>Use o QR no navegador ou digite o token no DisplayHub Android Player.</span>
        </div>

        {!installation ? (
          <button className="windows-pairing-activate" type="button" disabled={busy} onClick={() => void generate()}>
            {busy ? 'Gerando...' : 'Gerar instalação'}
          </button>
        ) : (
          <div className="windows-pairing-preview">
            <div className="windows-pairing-preview-head">
              <div>
                <strong>Instalação de dispositivo</strong>
                <span>Uso único · 1 dispositivo</span>
              </div>
              <span>{remainingSeconds > 0 ? `Expira em ${remainingLabel}` : 'Instalação expirada'}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)', gap: 22, alignItems: 'center' }}>
              <div ref={qrRef} style={{ width: 230, minHeight: 230, padding: 10, borderRadius: 16, background: '#fff', display: 'grid', placeItems: 'center' }} />
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <small style={{ display: 'block', marginBottom: 6 }}>Token para Android Player</small>
                  <code style={{ display: 'block', overflowWrap: 'anywhere', padding: 12, borderRadius: 10, background: '#0f172a', color: '#f8fafc', fontSize: 15 }}>
                    {installation.token}
                  </code>
                </div>
                <div className="windows-device-actions">
                  <button type="button" disabled={remainingSeconds === 0} onClick={() => void copyToken()}>Copiar token Android</button>
                  <button type="button" disabled={remainingSeconds === 0} onClick={() => void copyLink()}>Copiar link</button>
                  <button type="button" disabled={busy} onClick={() => void generate()}>Gerar nova instalação</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {feedback && <div className="windows-devices-feedback">{feedback}</div>}
      </section>

      <RegisteredDevicesManager />
    </>
  )
}
