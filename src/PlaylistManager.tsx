import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { templateLabels } from './TemplateManager'

type Props = { companyId: string; role: string }
type SourceType = 'content_item' | 'structured_content' | 'promotion_poster'
type TransitionType = 'none' | 'fade' | 'slide_left' | 'slide_up' | 'zoom'
type Playlist = { id: string; name: string; description: string | null; is_active: boolean; transition_type: TransitionType; transition_duration_ms: number }
type Source = { id: string; label: string; sourceType: SourceType }
type TemplateType = keyof typeof templateLabels
type DisplayTemplate = { id: string; name: string; template_type: TemplateType; is_active: boolean }
type PlaylistItem = { id: string; playlist_id: string; source_type: SourceType; content_item_id: string | null; structured_content_id: string | null; promotion_poster_id: string | null; template_id: string | null; position: number; duration_seconds: number }
type Display = { id: string; name: string; is_active: boolean; revoked_at: string | null }
type Publication = { id: string; display_id: string; playlist_id: string; starts_at: string | null; ends_at: string | null; repeat_mode: 'always' | 'daily'; daily_start: string | null; daily_end: string | null; weekdays: number[]; is_active: boolean }

const week = [[0,'Dom'],[1,'Seg'],[2,'Ter'],[3,'Qua'],[4,'Qui'],[5,'Sex'],[6,'Sáb']] as const
const transitionOptions: Array<{ value: TransitionType; label: string }> = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide_left', label: 'Deslizar à esquerda' },
  { value: 'slide_up', label: 'Deslizar para cima' },
  { value: 'zoom', label: 'Zoom suave' },
]
const transitionDurations = [200, 400, 600, 800, 1000, 1500, 2000]

function posterPrice(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

export default function PlaylistManager({ companyId, role }: Props) {
  const canManage = role === 'admin' || role === 'manager'
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [templates, setTemplates] = useState<DisplayTemplate[]>([])
  const [displays, setDisplays] = useState<Display[]>([])
  const [publications, setPublications] = useState<Publication[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [playlistId, setPlaylistId] = useState('')
  const [sourceKey, setSourceKey] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [duration, setDuration] = useState(10)
  const [position, setPosition] = useState(0)
  const [publicationPlaylist, setPublicationPlaylist] = useState('')
  const [displayId, setDisplayId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [repeatMode, setRepeatMode] = useState<'always' | 'daily'>('always')
  const [dailyStart, setDailyStart] = useState('08:00')
  const [dailyEnd, setDailyEnd] = useState('22:00')
  const [weekdays, setWeekdays] = useState<number[]>([0,1,2,3,4,5,6])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const sourceMap = useMemo(() => new Map(sources.map((s) => [`${s.sourceType}:${s.id}`, s.label])), [sources])
  const templateMap = useMemo(() => new Map(templates.map((t) => [t.id, `${t.name} · ${templateLabels[t.template_type]}`])), [templates])
  const playlistMap = useMemo(() => new Map(playlists.map((p) => [p.id, p.name])), [playlists])
  const displayMap = useMemo(() => new Map(displays.map((d) => [d.id, d.name])), [displays])
  const activeDisplays = displays.filter((d) => d.is_active && !d.revoked_at)
  const selectedSourceType = sourceKey.split(':')[0] as SourceType | ''

  const loadAll = useCallback(async () => {
    const [playlistRes,itemRes,contentRes,structuredRes,posterRes,templateRes,displayRes,publicationRes] = await Promise.all([
      supabase.from('playlists').select('id,name,description,is_active,transition_type,transition_duration_ms').order('created_at'),
      supabase.from('playlist_items').select('id,playlist_id,source_type,content_item_id,structured_content_id,promotion_poster_id,template_id,position,duration_seconds').order('position'),
      supabase.from('content_items').select('id,title,type').eq('is_active', true).order('title'),
      supabase.from('structured_contents').select('id,title,kind').eq('is_active', true).order('title'),
      supabase.from('promotion_posters').select('id,product_name,price,orientation,template_key').eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('display_templates').select('id,name,template_type,is_active').eq('is_active', true).order('name'),
      supabase.from('displays').select('id,name,is_active,revoked_at').order('name'),
      supabase.from('display_publications').select('id,display_id,playlist_id,starts_at,ends_at,repeat_mode,daily_start,daily_end,weekdays,is_active').order('created_at',{ascending:false}),
    ])
    for (const response of [playlistRes,itemRes,contentRes,structuredRes,posterRes,templateRes,displayRes,publicationRes]) if (response.error) throw response.error
    setPlaylists((playlistRes.data || []).map((row) => ({ ...row, transition_type: row.transition_type || 'fade', transition_duration_ms: Number(row.transition_duration_ms ?? 600) })) as Playlist[])
    setItems((itemRes.data || []) as PlaylistItem[])
    setSources([
      ...(contentRes.data || []).map((row) => ({ id: row.id, label: `${row.type === 'image' ? 'Imagem' : row.type === 'hls' ? 'HLS' : 'YouTube'} · ${row.title}`, sourceType: 'content_item' as const })),
      ...(structuredRes.data || []).map((row) => ({ id: row.id, label: `${row.kind} · ${row.title}`, sourceType: 'structured_content' as const })),
      ...(posterRes.data || []).map((row) => ({ id: row.id, label: `Cartaz · ${row.product_name} · ${posterPrice(Number(row.price))} · ${row.orientation === 'landscape' ? 'Horizontal' : 'Vertical'}`, sourceType: 'promotion_poster' as const })),
    ])
    setTemplates((templateRes.data || []) as DisplayTemplate[])
    setDisplays((displayRes.data || []) as Display[])
    setPublications((publicationRes.data || []) as Publication[])
  }, [])

  useEffect(() => { void loadAll().catch(() => setMessage('Não foi possível carregar playlists e programação.')) }, [loadAll])

  async function createPlaylist(event: FormEvent) {
    event.preventDefault(); if (!canManage) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from('playlists').insert({ company_id: companyId, name: name.trim(), description: description.trim() || null })
    if (error) setMessage(error.message); else { setName(''); setDescription(''); await loadAll() }
    setBusy(false)
  }

  async function addItem(event: FormEvent) {
    event.preventDefault(); if (!canManage || !playlistId || !sourceKey) return
    const [sourceType,id] = sourceKey.split(':') as [SourceType,string]
    setBusy(true); setMessage('')
    const { error } = await supabase.from('playlist_items').insert({
      playlist_id: playlistId,
      company_id: companyId,
      source_type: sourceType,
      content_item_id: sourceType === 'content_item' ? id : null,
      structured_content_id: sourceType === 'structured_content' ? id : null,
      promotion_poster_id: sourceType === 'promotion_poster' ? id : null,
      template_id: sourceType === 'promotion_poster' ? null : templateId || null,
      position,
      duration_seconds: duration,
    })
    if (error) setMessage(error.message); else { await loadAll(); setPosition(position + 1); setSourceKey(''); setTemplateId('') }
    setBusy(false)
  }

  async function setItemTemplate(itemId: string, nextTemplateId: string) {
    if (!canManage) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from('playlist_items').update({ template_id: nextTemplateId || null }).eq('id', itemId)
    if (error) setMessage(error.message); else await loadAll()
    setBusy(false)
  }

  async function setItemDuration(itemId: string, seconds: number) {
    if (!canManage) return
    const nextDuration = Math.max(1, Math.min(3600, Math.round(seconds || 1)))
    setBusy(true); setMessage('')
    const { error } = await supabase.from('playlist_items').update({ duration_seconds: nextDuration }).eq('id', itemId)
    if (error) setMessage(error.message)
    else { setMessage('Duração do item atualizada.'); await loadAll() }
    setBusy(false)
  }

  async function moveItem(item: PlaylistItem, direction: -1 | 1) {
    if (!canManage) return
    const ordered = items.filter((row) => row.playlist_id === item.playlist_id).sort((a,b) => a.position - b.position)
    const index = ordered.findIndex((row) => row.id === item.id)
    const target = ordered[index + direction]
    if (!target) return
    setBusy(true); setMessage('')
    const [first, second] = await Promise.all([
      supabase.from('playlist_items').update({ position: target.position }).eq('id', item.id),
      supabase.from('playlist_items').update({ position: item.position }).eq('id', target.id),
    ])
    if (first.error || second.error) setMessage(first.error?.message || second.error?.message || 'Não foi possível reordenar a playlist.')
    else { setMessage('Ordem da playlist atualizada.'); await loadAll() }
    setBusy(false)
  }

  async function removePlaylistItem(item: PlaylistItem) {
    if (!canManage) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from('playlist_items').delete().eq('id', item.id)
    if (error) { setMessage(error.message); setBusy(false); return }
    const remaining = items.filter((row) => row.playlist_id === item.playlist_id && row.id !== item.id).sort((a,b) => a.position - b.position)
    const updates = remaining.map((row, index) => row.position === index ? Promise.resolve({ error: null }) : supabase.from('playlist_items').update({ position: index }).eq('id', row.id))
    const results = await Promise.all(updates)
    const reorderError = results.find((result) => result.error)?.error
    if (reorderError) setMessage(reorderError.message)
    else setMessage('Item removido da playlist.')
    await loadAll()
    setBusy(false)
  }

  async function setPlaylistTransition(playlistIdToUpdate: string, changes: Partial<Pick<Playlist, 'transition_type' | 'transition_duration_ms'>>) {
    if (!canManage) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from('playlists').update(changes).eq('id', playlistIdToUpdate)
    if (error) setMessage(error.message)
    else { setMessage('Transição da playlist atualizada.'); await loadAll() }
    setBusy(false)
  }

  async function createPublication(event: FormEvent) {
    event.preventDefault(); if (!canManage || !publicationPlaylist || !displayId) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from('display_publications').insert({
      company_id: companyId, playlist_id: publicationPlaylist, display_id: displayId,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      repeat_mode: repeatMode,
      daily_start: repeatMode === 'daily' ? dailyStart : null,
      daily_end: repeatMode === 'daily' ? dailyEnd : null,
      weekdays,
    })
    if (error) setMessage(error.message); else { setMessage('Programação criada.'); await loadAll() }
    setBusy(false)
  }

  async function remove(table: 'playlists'|'display_publications', id: string) {
    if (!canManage) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) setMessage(error.message); else await loadAll()
    setBusy(false)
  }

  return <section className="workspace-section playlist-workspace">
    <div className="section-heading"><div><p className="eyebrow">Conteúdo</p><h2>Playlists e agendamento</h2></div><button className="secondary-button compact" type="button" onClick={() => void loadAll()} disabled={busy}>Atualizar</button></div>
    {message && <p className="form-message playlist-message">{message}</p>}

    {canManage && <details className="create-panel playlist-create-panel"><summary>+ Nova playlist / adicionar conteúdo</summary><div className="playlist-create-grid">
      <form className="content-form" onSubmit={createPlaylist}><h3>Nova playlist</h3><label>Nome<input value={name} onChange={(e)=>setName(e.target.value)} required minLength={2} /></label><label>Descrição<input value={description} onChange={(e)=>setDescription(e.target.value)} /></label><button className="primary-button" disabled={busy}>Criar playlist</button></form>
      <form className="content-form" onSubmit={addItem}><h3>Adicionar conteúdo</h3>
        <label>Playlist<select value={playlistId} onChange={(e)=>setPlaylistId(e.target.value)} required><option value="">Selecione</option>{playlists.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Conteúdo<select value={sourceKey} onChange={(e)=>{setSourceKey(e.target.value); if (e.target.value.startsWith('promotion_poster:')) setTemplateId('')}} required><option value="">Selecione</option>{sources.map((s)=><option key={`${s.sourceType}:${s.id}`} value={`${s.sourceType}:${s.id}`}>{s.label}</option>)}</select></label>
        <label>Template opcional<select value={templateId} onChange={(e)=>setTemplateId(e.target.value)} disabled={selectedSourceType === 'promotion_poster'}><option value="">{selectedSourceType === 'promotion_poster' ? 'O cartaz já possui template' : 'Sem template'}</option>{templates.map((t)=><option key={t.id} value={t.id}>{t.name} · {templateLabels[t.template_type]}</option>)}</select></label>
        <div className="playlist-inline"><label>Ordem<input type="number" min="0" value={position} onChange={(e)=>setPosition(Number(e.target.value))}/></label><label>Duração (s)<input type="number" min="1" max="3600" value={duration} onChange={(e)=>setDuration(Number(e.target.value))}/></label></div>
        <button className="primary-button" disabled={busy}>Adicionar</button>
      </form>
    </div></details>}

    <div className="playlist-list">{playlists.length===0 && <p className="empty-state">Nenhuma playlist cadastrada.</p>}{playlists.map((playlist)=>{const playlistItems=items.filter((item)=>item.playlist_id===playlist.id).sort((a,b)=>a.position-b.position);return <article className="playlist-card" key={playlist.id}>
      <div className="playlist-card-head"><div><strong>{playlist.name}</strong>{playlist.description&&<p>{playlist.description}</p>}</div>{canManage&&<button className="danger-button" type="button" onClick={()=>void remove('playlists',playlist.id)} disabled={busy}>Excluir playlist</button>}</div>
      <div className="playlist-transition-controls"><div><strong>Transição entre cartazes</strong><small>Aplicada apenas quando dois cartazes aparecem em sequência.</small></div><label>Efeito<select value={playlist.transition_type} onChange={(e)=>void setPlaylistTransition(playlist.id,{transition_type:e.target.value as TransitionType})} disabled={busy}>{transitionOptions.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Duração<select value={playlist.transition_duration_ms} onChange={(e)=>void setPlaylistTransition(playlist.id,{transition_duration_ms:Number(e.target.value)})} disabled={busy||playlist.transition_type==='none'}>{transitionDurations.map((value)=><option key={value} value={value}>{value} ms</option>)}</select></label></div>
      <div className="playlist-items">{playlistItems.map((item,index)=>{const sourceId=item.content_item_id||item.structured_content_id||item.promotion_poster_id||'';const label=sourceMap.get(`${item.source_type}:${sourceId}`)||'Conteúdo';return <div className="playlist-item playlist-item-editable" key={item.id}>
        <div className="playlist-item-main"><strong>{index+1}. {label}</strong><small>{item.source_type === 'promotion_poster' ? 'Template do próprio cartaz' : item.template_id ? templateMap.get(item.template_id) || 'Template' : 'Sem template'}</small></div>
        {canManage&&<div className="playlist-item-duration"><label>Duração <input type="number" min="1" max="3600" defaultValue={item.duration_seconds} onBlur={(e)=>{const next=Number(e.target.value); if(next!==item.duration_seconds) void setItemDuration(item.id,next)}} disabled={busy}/><span>s</span></label></div>}
        {canManage&&item.source_type!=='promotion_poster'&&<select className="playlist-item-template" value={item.template_id || ''} onChange={(e)=>void setItemTemplate(item.id,e.target.value)} disabled={busy}><option value="">Sem template</option>{templates.map((t)=><option key={t.id} value={t.id}>{t.name}</option>)}</select>}
        {canManage&&<div className="playlist-item-actions"><button type="button" title="Subir item" onClick={()=>void moveItem(item,-1)} disabled={busy||index===0}>↑</button><button type="button" title="Descer item" onClick={()=>void moveItem(item,1)} disabled={busy||index===playlistItems.length-1}>↓</button><button className="playlist-remove-button" type="button" onClick={()=>void removePlaylistItem(item)} disabled={busy}>Excluir</button></div>}
      </div>})}{playlistItems.length===0&&<small className="empty-state">Playlist vazia.</small>}</div>
    </article>})}</div>

    {canManage && <details className="create-panel schedule-create-panel"><summary>+ Nova programação</summary><form className="content-form publication-form" onSubmit={createPublication}><h3>Publicar / agendar em display</h3><div className="publication-grid"><label>Playlist<select value={publicationPlaylist} onChange={(e)=>setPublicationPlaylist(e.target.value)} required><option value="">Selecione</option>{playlists.filter((p)=>p.is_active).map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Display<select value={displayId} onChange={(e)=>setDisplayId(e.target.value)} required disabled={activeDisplays.length===0}><option value="">{activeDisplays.length===0 ? 'Nenhum display ativo disponível' : 'Selecione'}</option>{activeDisplays.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Início opcional<input type="datetime-local" value={startsAt} onChange={(e)=>setStartsAt(e.target.value)}/></label><label>Fim opcional<input type="datetime-local" value={endsAt} onChange={(e)=>setEndsAt(e.target.value)}/></label><label>Repetição<select value={repeatMode} onChange={(e)=>setRepeatMode(e.target.value as 'always'|'daily')}><option value="always">Contínua</option><option value="daily">Horário diário</option></select></label>{repeatMode==='daily'&&<><label>De<input type="time" value={dailyStart} onChange={(e)=>setDailyStart(e.target.value)} required/></label><label>Até<input type="time" value={dailyEnd} onChange={(e)=>setDailyEnd(e.target.value)} required/></label></>}</div>{repeatMode==='daily'&&<div className="weekday-row">{week.map(([value,label])=><label key={value}><input type="checkbox" checked={weekdays.includes(value)} onChange={(e)=>setWeekdays(e.target.checked?[...weekdays,value].sort():weekdays.filter((day)=>day!==value))}/>{label}</label>)}</div>}<button className="primary-button" disabled={busy||activeDisplays.length===0||(repeatMode==='daily'&&weekdays.length===0)}>Criar programação</button></form></details>}

    <div className="publication-list"><h3>Programações</h3>{publications.length===0&&<p className="empty-state">Nenhuma programação criada.</p>}{publications.map((publication)=><article className="publication-card" key={publication.id}><strong>{playlistMap.get(publication.playlist_id)||'Playlist'} → {displayMap.get(publication.display_id)||'Display'}</strong><span>{publication.repeat_mode==='daily'?`Diária ${publication.daily_start?.slice(0,5)}–${publication.daily_end?.slice(0,5)}`:'Contínua'}</span>{publication.starts_at&&<small>Início: {new Date(publication.starts_at).toLocaleString('pt-BR')}</small>}{publication.ends_at&&<small>Fim: {new Date(publication.ends_at).toLocaleString('pt-BR')}</small>}{canManage&&<button className="danger-button" type="button" onClick={()=>void remove('display_publications',publication.id)} disabled={busy}>Remover programação</button>}</article>)}</div>
  </section>
}