import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { templateLabels } from './TemplateManager'

type Props = { companyId: string; role: string }
type Playlist = { id: string; name: string; description: string | null; is_active: boolean }
type Source = { id: string; label: string; sourceType: 'content_item' | 'structured_content' }
type TemplateType = keyof typeof templateLabels
type DisplayTemplate = { id: string; name: string; template_type: TemplateType; is_active: boolean }
type PlaylistItem = { id: string; playlist_id: string; source_type: 'content_item' | 'structured_content'; content_item_id: string | null; structured_content_id: string | null; template_id: string | null; position: number; duration_seconds: number }
type Display = { id: string; name: string; is_active: boolean; revoked_at: string | null }
type Publication = { id: string; display_id: string; playlist_id: string; starts_at: string | null; ends_at: string | null; repeat_mode: 'always' | 'daily'; daily_start: string | null; daily_end: string | null; weekdays: number[]; is_active: boolean }

const week = [[0,'Dom'],[1,'Seg'],[2,'Ter'],[3,'Qua'],[4,'Qui'],[5,'Sex'],[6,'Sáb']] as const

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

  const loadAll = useCallback(async () => {
    const [playlistRes,itemRes,contentRes,structuredRes,templateRes,displayRes,publicationRes] = await Promise.all([
      supabase.from('playlists').select('id,name,description,is_active').order('created_at'),
      supabase.from('playlist_items').select('id,playlist_id,source_type,content_item_id,structured_content_id,template_id,position,duration_seconds').order('position'),
      supabase.from('content_items').select('id,title,type').eq('is_active', true).order('title'),
      supabase.from('structured_contents').select('id,title,kind').eq('is_active', true).order('title'),
      supabase.from('display_templates').select('id,name,template_type,is_active').eq('is_active', true).order('name'),
      supabase.from('displays').select('id,name,is_active,revoked_at').order('name'),
      supabase.from('display_publications').select('id,display_id,playlist_id,starts_at,ends_at,repeat_mode,daily_start,daily_end,weekdays,is_active').order('created_at',{ascending:false}),
    ])
    for (const response of [playlistRes,itemRes,contentRes,structuredRes,templateRes,displayRes,publicationRes]) if (response.error) throw response.error
    setPlaylists((playlistRes.data || []) as Playlist[])
    setItems((itemRes.data || []) as PlaylistItem[])
    setSources([
      ...(contentRes.data || []).map((row) => ({ id: row.id, label: `${row.type === 'image' ? 'Imagem' : 'YouTube'} · ${row.title}`, sourceType: 'content_item' as const })),
      ...(structuredRes.data || []).map((row) => ({ id: row.id, label: `${row.kind} · ${row.title}`, sourceType: 'structured_content' as const })),
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
    const [sourceType,id] = sourceKey.split(':') as ['content_item'|'structured_content',string]
    setBusy(true); setMessage('')
    const { error } = await supabase.from('playlist_items').insert({
      playlist_id: playlistId,
      company_id: companyId,
      source_type: sourceType,
      content_item_id: sourceType === 'content_item' ? id : null,
      structured_content_id: sourceType === 'structured_content' ? id : null,
      template_id: templateId || null,
      position,
      duration_seconds: duration,
    })
    if (error) setMessage(error.message); else { await loadAll(); setPosition(position + 1) }
    setBusy(false)
  }

  async function setItemTemplate(itemId: string, nextTemplateId: string) {
    if (!canManage) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from('playlist_items').update({ template_id: nextTemplateId || null }).eq('id', itemId)
    if (error) setMessage(error.message); else await loadAll()
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

  async function remove(table: 'playlists'|'playlist_items'|'display_publications', id: string) {
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
        <label>Conteúdo<select value={sourceKey} onChange={(e)=>setSourceKey(e.target.value)} required><option value="">Selecione</option>{sources.map((s)=><option key={`${s.sourceType}:${s.id}`} value={`${s.sourceType}:${s.id}`}>{s.label}</option>)}</select></label>
        <label>Template opcional<select value={templateId} onChange={(e)=>setTemplateId(e.target.value)}><option value="">Sem template</option>{templates.map((t)=><option key={t.id} value={t.id}>{t.name} · {templateLabels[t.template_type]}</option>)}</select></label>
        <div className="playlist-inline"><label>Ordem<input type="number" min="0" value={position} onChange={(e)=>setPosition(Number(e.target.value))}/></label><label>Duração (s)<input type="number" min="1" max="3600" value={duration} onChange={(e)=>setDuration(Number(e.target.value))}/></label></div>
        <button className="primary-button" disabled={busy}>Adicionar</button>
      </form>
    </div></details>}

    <div className="playlist-list">{playlists.length===0 && <p className="empty-state">Nenhuma playlist cadastrada.</p>}{playlists.map((playlist)=><article className="playlist-card" key={playlist.id}><div className="playlist-card-head"><div><strong>{playlist.name}</strong>{playlist.description&&<p>{playlist.description}</p>}</div>{canManage&&<button className="danger-button" type="button" onClick={()=>void remove('playlists',playlist.id)} disabled={busy}>Excluir playlist</button>}</div><div className="playlist-items">{items.filter((item)=>item.playlist_id===playlist.id).map((item)=>{const sourceId=item.content_item_id||item.structured_content_id||'';const label=sourceMap.get(`${item.source_type}:${sourceId}`)||'Conteúdo';return <div className="playlist-item" key={item.id}><span>#{item.position} · {label}</span><small>{item.duration_seconds}s</small><small>{item.template_id ? templateMap.get(item.template_id) || 'Template' : 'Sem template'}</small>{canManage&&<select value={item.template_id || ''} onChange={(e)=>void setItemTemplate(item.id,e.target.value)} disabled={busy}><option value="">Sem template</option>{templates.map((t)=><option key={t.id} value={t.id}>{t.name}</option>)}</select>}{canManage&&<button type="button" onClick={()=>void remove('playlist_items',item.id)}>Remover</button>}</div>})}{items.every((item)=>item.playlist_id!==playlist.id)&&<small className="empty-state">Playlist vazia.</small>}</div></article>)}</div>

    {canManage && <details className="create-panel schedule-create-panel"><summary>+ Nova programação</summary><form className="content-form publication-form" onSubmit={createPublication}><h3>Publicar / agendar em display</h3><div className="publication-grid"><label>Playlist<select value={publicationPlaylist} onChange={(e)=>setPublicationPlaylist(e.target.value)} required><option value="">Selecione</option>{playlists.filter((p)=>p.is_active).map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Display<select value={displayId} onChange={(e)=>setDisplayId(e.target.value)} required disabled={activeDisplays.length===0}><option value="">{activeDisplays.length===0 ? 'Nenhum display ativo disponível' : 'Selecione'}</option>{activeDisplays.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Início opcional<input type="datetime-local" value={startsAt} onChange={(e)=>setStartsAt(e.target.value)}/></label><label>Fim opcional<input type="datetime-local" value={endsAt} onChange={(e)=>setEndsAt(e.target.value)}/></label><label>Repetição<select value={repeatMode} onChange={(e)=>setRepeatMode(e.target.value as 'always'|'daily')}><option value="always">Contínua</option><option value="daily">Horário diário</option></select></label>{repeatMode==='daily'&&<><label>De<input type="time" value={dailyStart} onChange={(e)=>setDailyStart(e.target.value)} required/></label><label>Até<input type="time" value={dailyEnd} onChange={(e)=>setDailyEnd(e.target.value)} required/></label></>}</div>{repeatMode==='daily'&&<div className="weekday-row">{week.map(([value,label])=><label key={value}><input type="checkbox" checked={weekdays.includes(value)} onChange={(e)=>setWeekdays(e.target.checked?[...weekdays,value].sort():weekdays.filter((day)=>day!==value))}/>{label}</label>)}</div>}<button className="primary-button" disabled={busy||activeDisplays.length===0||(repeatMode==='daily'&&weekdays.length===0)}>Criar programação</button></form></details>}

    <div className="publication-list"><h3>Programações</h3>{publications.length===0&&<p className="empty-state">Nenhuma programação criada.</p>}{publications.map((publication)=><article className="publication-card" key={publication.id}><strong>{playlistMap.get(publication.playlist_id)||'Playlist'} → {displayMap.get(publication.display_id)||'Display'}</strong><span>{publication.repeat_mode==='daily'?`Diária ${publication.daily_start?.slice(0,5)}–${publication.daily_end?.slice(0,5)}`:'Contínua'}</span>{publication.starts_at&&<small>Início: {new Date(publication.starts_at).toLocaleString('pt-BR')}</small>}{publication.ends_at&&<small>Fim: {new Date(publication.ends_at).toLocaleString('pt-BR')}</small>}{canManage&&<button className="danger-button" type="button" onClick={()=>void remove('display_publications',publication.id)} disabled={busy}>Remover programação</button>}</article>)}</div>
  </section>
}
