import { FormEvent, useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type ContentItem = {
  id: string
  type: 'image' | 'youtube'
  title: string
  category: string | null
  storage_path: string | null
  mime_type: string | null
  file_size: number | null
  provider: string | null
  external_url: string | null
  external_id: string | null
  created_at: string
}

type Props = {
  companyId: string
  role: string
}

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function extractYouTubeId(value: string) {
  try {
    const url = new URL(value.trim())
    if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || null
    if (!url.hostname.endsWith('youtube.com')) return null
    if (url.pathname === '/watch') return url.searchParams.get('v')
    const parts = url.pathname.split('/').filter(Boolean)
    if (['shorts', 'embed', 'live'].includes(parts[0])) return parts[1] || null
    return null
  } catch {
    return null
  }
}

export default function ContentLibraryCore({ companyId, role }: Props) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [imageTitle, setImageTitle] = useState('')
  const [imageCategory, setImageCategory] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoTitle, setVideoTitle] = useState('')
  const [videoCategory, setVideoCategory] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const canManage = role === 'admin' || role === 'manager'

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('content_items')
      .select('id, type, title, category, storage_path, mime_type, file_size, provider, external_url, external_id, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error

    const nextItems = (data || []) as ContentItem[]
    setItems(nextItems)

    const imageItems = nextItems.filter((item) => item.type === 'image' && item.storage_path)
    const signedEntries = await Promise.all(imageItems.map(async (item) => {
      const { data: signed } = await supabase.storage.from('content-library').createSignedUrl(item.storage_path as string, 3600)
      return [item.id, signed?.signedUrl || ''] as const
    }))
    setPreviewUrls(Object.fromEntries(signedEntries))
  }, [])

  useEffect(() => {
    void loadItems().catch(() => setMessage('Não foi possível carregar a biblioteca.'))
  }, [loadItems])

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!imageFile || !canManage) return
    setMessage('')

    if (!allowedImageTypes.has(imageFile.type)) {
      setMessage('Use uma imagem JPG, PNG ou WebP.')
      return
    }
    if (imageFile.size > 10 * 1024 * 1024) {
      setMessage('A imagem deve ter no máximo 10 MB.')
      return
    }

    setBusy(true)
    const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'img'
    const storagePath = `${companyId}/${crypto.randomUUID()}.${extension}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('content-library')
        .upload(storagePath, imageFile, { contentType: imageFile.type, upsert: false })
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('content_items').insert({
        company_id: companyId,
        type: 'image',
        title: imageTitle.trim(),
        category: imageCategory.trim() || null,
        storage_path: storagePath,
        mime_type: imageFile.type,
        file_size: imageFile.size,
      })

      if (insertError) {
        await supabase.storage.from('content-library').remove([storagePath])
        throw insertError
      }

      setImageTitle('')
      setImageCategory('')
      setImageFile(null)
      const input = document.getElementById('content-image-file') as HTMLInputElement | null
      if (input) input.value = ''
      await loadItems()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.')
    } finally {
      setBusy(false)
    }
  }

  async function addYouTube(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) return
    setMessage('')
    const youtubeId = extractYouTubeId(videoUrl)
    if (!youtubeId) {
      setMessage('Informe um link válido do YouTube.')
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.from('content_items').insert({
        company_id: companyId,
        type: 'youtube',
        title: videoTitle.trim(),
        category: videoCategory.trim() || null,
        provider: 'youtube',
        external_url: videoUrl.trim(),
        external_id: youtubeId,
      })
      if (error) throw error
      setVideoTitle('')
      setVideoCategory('')
      setVideoUrl('')
      await loadItems()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar o vídeo.')
    } finally {
      setBusy(false)
    }
  }

  async function removeItem(item: ContentItem) {
    if (!canManage) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.from('content_items').delete().eq('id', item.id)
      if (error) throw error

      if (item.type === 'image' && item.storage_path) {
        const { error: storageError } = await supabase.storage.from('content-library').remove([item.storage_path])
        if (storageError) throw storageError
      }
      await loadItems()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir o conteúdo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="workspace-section">
      <div className="section-heading">
        <div><p className="eyebrow">Mídia</p><h2>Biblioteca de conteúdo</h2></div>
        <button className="secondary-button compact" type="button" onClick={() => void loadItems()} disabled={busy}>Atualizar</button>
      </div>

      {canManage && (
        <div className="create-actions-grid">
          <details className="create-panel">
            <summary>+ Nova imagem</summary>
            <form className="content-form" onSubmit={uploadImage}>
              <h3>Enviar imagem</h3>
              <label>Título<input value={imageTitle} onChange={(event) => setImageTitle(event.target.value)} required minLength={2} placeholder="Promoção de verão" /></label>
              <label>Categoria<input value={imageCategory} onChange={(event) => setImageCategory(event.target.value)} placeholder="Promoções" /></label>
              <label>Arquivo<input id="content-image-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] || null)} required /></label>
              <button className="primary-button" type="submit" disabled={busy}>Enviar imagem</button>
            </form>
          </details>

          <details className="create-panel">
            <summary>+ Novo vídeo</summary>
            <form className="content-form" onSubmit={addYouTube}>
              <h3>Adicionar YouTube</h3>
              <label>Título<input value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} required minLength={2} placeholder="Vídeo institucional" /></label>
              <label>Categoria<input value={videoCategory} onChange={(event) => setVideoCategory(event.target.value)} placeholder="Institucional" /></label>
              <label>Link do YouTube<input type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} required placeholder="https://www.youtube.com/watch?v=..." /></label>
              <button className="primary-button" type="submit" disabled={busy}>Cadastrar vídeo</button>
            </form>
          </details>
        </div>
      )}

      {message && <p className="form-message content-message">{message}</p>}

      <div className="content-list">
        {items.length === 0 && <p className="empty-state">Nenhum conteúdo cadastrado.</p>}
        {items.map((item) => (
          <article className="content-card" key={item.id}>
            <div className="content-preview">
              {item.type === 'image' && previewUrls[item.id] && <img src={previewUrls[item.id]} alt={item.title} />}
              {item.type === 'youtube' && item.external_id && (
                <img src={`https://i.ytimg.com/vi/${item.external_id}/hqdefault.jpg`} alt={item.title} />
              )}
            </div>
            <div className="content-meta">
              <span>{item.type === 'image' ? 'Imagem' : 'YouTube'}{item.category ? ` · ${item.category}` : ''}</span>
              <strong>{item.title}</strong>
              {item.type === 'image' && item.file_size && <small>{(item.file_size / 1024 / 1024).toFixed(2)} MB</small>}
              {item.type === 'youtube' && item.external_url && <a href={item.external_url} target="_blank" rel="noreferrer">Abrir no YouTube</a>}
              {canManage && <button className="danger-button" type="button" onClick={() => void removeItem(item)} disabled={busy}>Excluir</button>}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
