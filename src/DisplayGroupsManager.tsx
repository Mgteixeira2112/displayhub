import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

type Mode = 'mirror' | 'coordinated' | 'video_wall'
type MediaFit = 'contain' | 'cover' | 'native'
type Profile = { company_id: string; role: string }
type Display = { id: string; name: string; location: string | null; resolution_width: number; resolution_height: number; revoked_at: string | null; is_active: boolean }
type Group = { id: string; name: string; mode: Mode; rows: number; columns: number; virtual_width: number | null; virtual_height: number | null; media_fit: MediaFit; is_active: boolean }
type Member = { id: string; group_id: string; display_id: string; row_index: number; column_index: number }
type Playlist = { id: string; name: string }
type GroupPublication = { id: string; group_id: string; playlist_id: string; is_active: boolean }
type CoordinatedPublication = { id: string; group_id: string; display_id: string; playlist_id: string; is_active: boolean }
type Launch = { id: string; group_id: string; playlist_id: string | null; status: 'preparing' | 'armed' | 'started' | 'cancelled'; sequence: number; start_at: string | null }
type ReadyState = { launch_id: string; display_id: string; ready: boolean; provider: string | null; reported_at: string }

const modeLabels: Record<Mode, string> = { mirror: 'Espelhamento', coordinated: 'Conteúdo coordenado', video_wall: 'Video Wall' }
const fitLabels: Record<MediaFit, string> = { contain: 'Vídeo inteiro', cover: 'Preencher telas', native: 'Conteúdo preparado' }
const launchStatusLabels: Record<Launch['status'], string> = { preparing: 'Preparando', armed: 'Início programado', started: 'Em exibição', cancelled: 'Cancelado' }

export default function DisplayGroupsManager() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displays, setDisplays] = useState<Display[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [groupPublications, setGroupPublications] = useState<GroupPublication[]>([])
  const [coordinatedPublications, setCoordinatedPublications] = useState<CoordinatedPublication[]>([])
  const [launches, setLaunches] = useState<Launch[]>([])
  const [readyStates, setReadyStates] = useState<ReadyState[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<Mode>('video_wall')
  const [rows, setRows] = useState(2)
  const [columns, setColumns] = useState(2)
  const [virtualWidth, setVirtualWidth] = useState('')
  const [virtualHeight, setVirtualHeight] = useState('')
  const [draftSlots, setDraftSlots] = useState<Record<string, string>>({})
  const [groupPlaylistId, setGroupPlaylistId] = useState('')
  const [coordinatedPlaylistDraft, setCoordinatedPlaylistDraft] = useState<Record<string, string>>({})
  const [mediaFitDraft, setMediaFitDraft] = useState<MediaFit>('cover')
  const [draftDirty, setDraftDirty] = useState(false)
  const [playlistDirty, setPlaylistDirty] = useState(false)
  const [coordinatedDirty, setCoordinatedDirty] = useState(false)
  const [mediaFitDirty, setMediaFitDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const canManage = profile?.role === 'admin' || profile?.role === 'manager'
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return
    const { data: nextProfile, error: profileError } = await supabase.from('profiles').select('company_id, role').eq('user_id', auth.user.id).single()
    if (profileError) throw profileError
    setProfile(nextProfile as Profile)

    const results = await Promise.all([
      supabase.from('displays').select('id, name, location, resolution_width, resolution_height, revoked_at, is_active').order('name'),
      supabase.from('display_groups').select('id, name, mode, rows, columns, virtual_width, virtual_height, media_fit, is_active').order('created_at', { ascending: false }),
      supabase.from('display_group_members').select('id, group_id, display_id, row_index, column_index'),
      supabase.from('playlists').select('id, name').eq('is_active', true).order('name'),
      supabase.from('display_group_publications').select('id, group_id, playlist_id, is_active'),
      supabase.from('display_publications').select('id, group_id, display_id, playlist_id, is_active').not('group_id', 'is', null),
      supabase.from('display_group_launches').select('id, group_id, playlist_id, status, sequence, start_at'),
      supabase.from('display_group_ready_states').select('launch_id, display_id, ready, provider, reported_at'),
    ])
    for (const result of results) if (result.error) throw result.error
    setDisplays((results[0].data || []) as Display[])
    setGroups((results[1].data || []) as Group[])
    setMembers((results[2].data || []) as Member[])
    setPlaylists((results[3].data || []) as Playlist[])
    setGroupPublications((results[4].data || []) as GroupPublication[])
    setCoordinatedPublications((results[5].data || []) as CoordinatedPublication[])
    setLaunches((results[6].data || []) as Launch[])
    setReadyStates((results[7].data || []) as ReadyState[])
  }, [])

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os grupos.')) }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => void load().catch(() => undefined), 3000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    setDraftDirty(false)
    setPlaylistDirty(false)
    setCoordinatedDirty(false)
    setMediaFitDirty(false)
  }, [selectedGroupId])

  useEffect(() => {
    if (!selectedGroup) {
      if (!draftDirty) setDraftSlots({})
      if (!playlistDirty) setGroupPlaylistId('')
      if (!coordinatedDirty) setCoordinatedPlaylistDraft({})
      if (!mediaFitDirty) setMediaFitDraft('cover')
      return
    }
    if (!draftDirty) {
      const next: Record<string, string> = {}
      members.filter((member) => member.group_id === selectedGroup.id).forEach((member) => { next[`${member.row_index}:${member.column_index}`] = member.display_id })
      setDraftSlots(next)
    }
    if (!playlistDirty) setGroupPlaylistId(groupPublications.find((publication) => publication.group_id === selectedGroup.id && publication.is_active)?.playlist_id || '')
    if (!coordinatedDirty) {
      const next: Record<string, string> = {}
      coordinatedPublications.filter((publication) => publication.group_id === selectedGroup.id && publication.is_active).forEach((publication) => { next[publication.display_id] = publication.playlist_id })
      setCoordinatedPlaylistDraft(next)
    }
    if (!mediaFitDirty) setMediaFitDraft(selectedGroup.media_fit || 'cover')
  }, [selectedGroup, members, groupPublications, coordinatedPublications, draftDirty, playlistDirty, coordinatedDirty, mediaFitDirty])

  const activeDisplays = useMemo(() => displays.filter((display) => display.is_active && !display.revoked_at), [displays])
  const selectedLaunch = selectedGroup ? launches.find((launch) => launch.group_id === selectedGroup.id) || null : null
  const selectedMemberIds = selectedGroup ? members.filter((member) => member.group_id === selectedGroup.id).map((member) => member.display_id).filter((id) => activeDisplays.some((display) => display.id === id)) : []
  const selectedReady = selectedLaunch ? readyStates.filter((row) => row.launch_id === selectedLaunch.id && row.ready && selectedMemberIds.includes(row.display_id)) : []
  const selectedCoordinatedPublicationIds = selectedGroup ? coordinatedPublications.filter((publication) => publication.group_id === selectedGroup.id && publication.is_active).map((publication) => publication.display_id) : []
  const coordinatedContentComplete = selectedGroup?.mode === 'coordinated' && selectedMemberIds.length > 0 && selectedMemberIds.every((displayId) => selectedCoordinatedPublicationIds.includes(displayId))

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!profile || !canManage) return
    setBusy(true); setMessage('')
    try {
      const { data, error } = await supabase.from('display_groups').insert({ company_id: profile.company_id, name: name.trim(), mode, rows, columns, virtual_width: virtualWidth ? Number(virtualWidth) : null, virtual_height: virtualHeight ? Number(virtualHeight) : null }).select('id').single()
      if (error) throw error
      setName(''); await load(); setSelectedGroupId(data.id); setMessage('Grupo criado. Agora posicione as TVs na grade.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível criar o grupo.') } finally { setBusy(false) }
  }

  async function deleteGroup() {
    if (!selectedGroup || profile?.role !== 'admin' || busy) return
    if (!window.confirm(`Excluir o grupo "${selectedGroup.name}"? Essa ação removerá o layout e as publicações vinculadas a ele.`)) return
    setBusy(true); setMessage('')
    try {
      const { error } = await supabase.from('display_groups').delete().eq('id', selectedGroup.id)
      if (error) throw error
      setSelectedGroupId('')
      await load()
      setMessage('Grupo excluído com sucesso.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível excluir o grupo.') } finally { setBusy(false) }
  }

  async function saveLayout() {
    if (!profile || !selectedGroup || !canManage) return
    setBusy(true); setMessage('')
    try {
      const selected = Object.entries(draftSlots).filter(([, displayId]) => displayId)
      if (new Set(selected.map(([, displayId]) => displayId)).size !== selected.length) throw new Error('A mesma TV não pode ocupar duas posições no mesmo grupo.')
      const { error: deleteError } = await supabase.from('display_group_members').delete().eq('group_id', selectedGroup.id)
      if (deleteError) throw deleteError
      if (selected.length) {
        const rowsToInsert = selected.map(([slot, displayId], index) => { const [rowIndex, columnIndex] = slot.split(':').map(Number); return { company_id: profile.company_id, group_id: selectedGroup.id, display_id: displayId, row_index: rowIndex, column_index: columnIndex, order_index: index } })
        const { error } = await supabase.from('display_group_members').insert(rowsToInsert); if (error) throw error
      }
      await load(); setDraftDirty(false); setMessage('Layout salvo com sucesso.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o layout.') } finally { setBusy(false) }
  }

  async function saveGroupPlaylist() {
    if (!profile || !selectedGroup || !['mirror', 'video_wall'].includes(selectedGroup.mode) || !canManage) return
    setBusy(true); setMessage('')
    try {
      if (!groupPlaylistId) {
        const { error } = await supabase.from('display_group_publications').delete().eq('group_id', selectedGroup.id)
        if (error) throw error
        await load(); setPlaylistDirty(false); setMessage('Grupo sem playlist ativa.')
        return
      }

      const { data: saved, error } = await supabase
        .from('display_group_publications')
        .upsert({ company_id: profile.company_id, group_id: selectedGroup.id, playlist_id: groupPlaylistId, is_active: true }, { onConflict: 'group_id' })
        .select('id, group_id, playlist_id, is_active')
        .single()
      if (error) throw error
      if (!saved || saved.group_id !== selectedGroup.id || saved.playlist_id !== groupPlaylistId || !saved.is_active) throw new Error('O banco não confirmou a playlist selecionada.')

      await load(); setPlaylistDirty(false); setMessage('Playlist do grupo salva e confirmada.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a playlist do grupo.') } finally { setBusy(false) }
  }

  async function saveCoordinatedContent() {
    if (!profile || !selectedGroup || selectedGroup.mode !== 'coordinated' || !canManage || draftDirty) return
    setBusy(true); setMessage('')
    try {
      const displayIds = Object.values(draftSlots).filter((displayId) => displayId && activeDisplays.some((display) => display.id === displayId))
      const rowsToInsert = displayIds
        .map((displayId) => ({ displayId, playlistId: coordinatedPlaylistDraft[displayId] || '' }))
        .filter((row) => row.playlistId)
        .map((row) => ({ company_id: profile.company_id, group_id: selectedGroup.id, display_id: row.displayId, playlist_id: row.playlistId, repeat_mode: 'always', weekdays: [0, 1, 2, 3, 4, 5, 6], is_active: true }))
      if (!rowsToInsert.length) throw new Error('Selecione pelo menos uma playlist antes de salvar o conteúdo.')

      const { error: deleteError } = await supabase.from('display_publications').delete().eq('group_id', selectedGroup.id)
      if (deleteError) throw deleteError

      const { data: inserted, error: insertError } = await supabase
        .from('display_publications')
        .insert(rowsToInsert)
        .select('id, group_id, display_id, playlist_id, is_active')
      if (insertError) throw insertError
      if (!inserted || inserted.length !== rowsToInsert.length) throw new Error('O banco não confirmou todas as publicações do grupo.')

      await load(); setCoordinatedDirty(false); setMessage(`Conteúdo coordenado salvo em ${inserted.length} tela(s).`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o conteúdo coordenado.') } finally { setBusy(false) }
  }

  async function saveMediaFit(mediaFit: MediaFit) {
    if (!selectedGroup || selectedGroup.mode !== 'video_wall' || !canManage) return
    setMediaFitDraft(mediaFit)
    setMediaFitDirty(true)
    setBusy(true); setMessage('')
    try {
      const { data, error } = await supabase.from('display_groups').update({ media_fit: mediaFit }).eq('id', selectedGroup.id).select('media_fit').single()
      if (error) throw error
      if (data?.media_fit !== mediaFit) throw new Error('O banco não confirmou o modo de encaixe selecionado.')
      await load(); setMediaFitDirty(false); setMessage(`Encaixe salvo: ${fitLabels[mediaFit]}.`)
    } catch (error) {
      setMediaFitDraft(selectedGroup.media_fit || 'cover'); setMediaFitDirty(false); setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o modo de encaixe.')
    } finally { setBusy(false) }
  }

  async function prepareVideoWall() {
    if (!profile || !selectedGroup || selectedGroup.mode !== 'video_wall' || !groupPlaylistId || !canManage) return
    setBusy(true); setMessage('')
    try {
      const nextSequence = (selectedLaunch?.sequence || 0) + 1
      const { data: launch, error } = await supabase.from('display_group_launches').upsert({ company_id: profile.company_id, group_id: selectedGroup.id, playlist_id: groupPlaylistId, status: 'preparing', sequence: nextSequence, requested_at: new Date().toISOString(), start_at: null }, { onConflict: 'group_id' }).select('id').single()
      if (error) throw error
      const { error: clearError } = await supabase.from('display_group_ready_states').delete().eq('launch_id', launch.id); if (clearError) throw clearError
      await load(); setMessage(`Preparação iniciada. Aguardando ${selectedMemberIds.length} tela(s).`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível preparar o Video Wall.') } finally { setBusy(false) }
  }

  async function startVideoWall() {
    if (!profile || !selectedGroup || !selectedLaunch || !canManage || !selectedLaunch.playlist_id) return
    if (!selectedMemberIds.length || selectedReady.length !== selectedMemberIds.length) { setMessage(`Aguarde: ${selectedReady.length}/${selectedMemberIds.length} telas prontas.`); return }
    setBusy(true); setMessage('')
    try {
      const startAt = new Date(Date.now() + 8000).toISOString()
      const { error: launchError } = await supabase.from('display_group_launches').update({ status: 'armed', start_at: startAt }).eq('id', selectedLaunch.id); if (launchError) throw launchError
      const { data: currentSession, error: sessionReadError } = await supabase.from('display_group_sessions').select('sequence').eq('group_id', selectedGroup.id).maybeSingle(); if (sessionReadError) throw sessionReadError
      const { error: sessionError } = await supabase.from('display_group_sessions').upsert({ company_id: profile.company_id, group_id: selectedGroup.id, playlist_id: selectedLaunch.playlist_id, playback_state: 'playing', started_at: startAt, paused_position_ms: 0, sequence: Number(currentSession?.sequence || 0) + 1 }, { onConflict: 'group_id' }); if (sessionError) throw sessionError
      await load(); setMessage(`Exibição programada para ${new Date(startAt).toLocaleTimeString('pt-BR')}.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível iniciar o Video Wall.') } finally { setBusy(false) }
  }

  async function prepareCoordinated() {
    if (!profile || !selectedGroup || selectedGroup.mode !== 'coordinated' || !canManage) return
    if (!coordinatedContentComplete) { setMessage('Salve uma playlist para cada TV antes de preparar a exibição.'); return }
    setBusy(true); setMessage('')
    try {
      const nextSequence = (selectedLaunch?.sequence || 0) + 1
      const { data: launch, error } = await supabase.from('display_group_launches').upsert({ company_id: profile.company_id, group_id: selectedGroup.id, playlist_id: null, status: 'preparing', sequence: nextSequence, requested_at: new Date().toISOString(), start_at: null }, { onConflict: 'group_id' }).select('id').single()
      if (error) throw error
      const { error: clearError } = await supabase.from('display_group_ready_states').delete().eq('launch_id', launch.id); if (clearError) throw clearError
      await load(); setMessage(`Preparação coordenada iniciada. Aguardando ${selectedMemberIds.length} tela(s).`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível preparar o conteúdo coordenado.') } finally { setBusy(false) }
  }

  async function startCoordinated() {
    if (!selectedGroup || selectedGroup.mode !== 'coordinated' || !selectedLaunch || !canManage) return
    if (!selectedMemberIds.length || selectedReady.length !== selectedMemberIds.length) { setMessage(`Aguarde: ${selectedReady.length}/${selectedMemberIds.length} telas prontas.`); return }
    setBusy(true); setMessage('')
    try {
      const startAt = new Date(Date.now() + 8000).toISOString()
      const { error } = await supabase.from('display_group_launches').update({ status: 'armed', start_at: startAt }).eq('id', selectedLaunch.id)
      if (error) throw error
      await load(); setMessage(`Conteúdo coordenado programado para ${new Date(startAt).toLocaleTimeString('pt-BR')}.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível iniciar o conteúdo coordenado.') } finally { setBusy(false) }
  }

  return <section className="display-groups-module">
    {message && <p className="form-message" role="status">{message}</p>}
    {canManage && <section className="create-panel display-group-create"><div className="display-group-create-title">Novo grupo</div><form className="display-group-form" onSubmit={createGroup}><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} required placeholder="Painel Principal" /></label><label>Modo<select value={mode} onChange={(event) => setMode(event.target.value as Mode)}><option value="video_wall">Video Wall</option><option value="coordinated">Conteúdo coordenado</option><option value="mirror">Espelhamento</option></select></label><label>Linhas<input type="number" min="1" max="16" value={rows} onChange={(event) => setRows(Number(event.target.value))} /></label><label>Colunas<input type="number" min="1" max="16" value={columns} onChange={(event) => setColumns(Number(event.target.value))} /></label><label>Largura virtual<input type="number" min="320" max="65536" value={virtualWidth} onChange={(event) => setVirtualWidth(event.target.value)} placeholder="Automática" /></label><label>Altura virtual<input type="number" min="320" max="65536" value={virtualHeight} onChange={(event) => setVirtualHeight(event.target.value)} placeholder="Automática" /></label><button className="primary-button" type="submit" disabled={busy}>Criar grupo</button></form></section>}
    <div className="display-group-list">{groups.length === 0 && <p className="empty-state">Nenhum grupo cadastrado.</p>}{groups.map((group) => { const count = members.filter((member) => member.group_id === group.id).length; return <button key={group.id} type="button" className={`display-group-card ${selectedGroupId === group.id ? 'selected' : ''}`} onClick={() => setSelectedGroupId(group.id)}><strong>{group.name}</strong><span>{modeLabels[group.mode]} · {group.rows}×{group.columns}</span><small>{count} TV{count === 1 ? '' : 's'} posicionada{count === 1 ? '' : 's'}</small></button> })}</div>
    {selectedGroup && <section className="display-group-editor">
      <div className="section-heading"><div><p className="eyebrow">Layout</p><h3>{selectedGroup.name}</h3><p>{modeLabels[selectedGroup.mode]} · {selectedGroup.rows}×{selectedGroup.columns}</p></div><div className="display-group-heading-actions">{profile?.role === 'admin' && <button className="secondary-button compact" type="button" onClick={() => void deleteGroup()} disabled={busy}>Excluir grupo</button>}{canManage && <button className="primary-button compact" type="button" onClick={() => void saveLayout()} disabled={busy}>Salvar layout</button>}{canManage && selectedGroup.mode === 'coordinated' && <button className="secondary-button compact" type="button" onClick={() => void saveCoordinatedContent()} disabled={busy || draftDirty || selectedMemberIds.length === 0}>Salvar conteúdo</button>}</div></div>
      {(selectedGroup.mode === 'mirror' || selectedGroup.mode === 'video_wall') && <div className="display-group-mirror-config"><div><p className="eyebrow">Conteúdo</p><h4>Playlist do grupo</h4></div><label>Playlist<select value={groupPlaylistId} onChange={(event) => { setGroupPlaylistId(event.target.value); setPlaylistDirty(true) }} disabled={!canManage}><option value="">Nenhuma playlist</option>{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select></label>{canManage && <button className="primary-button compact" type="button" onClick={() => void saveGroupPlaylist()} disabled={busy}>Salvar playlist</button>}</div>}
      {selectedGroup.mode === 'video_wall' && <div className="display-group-mirror-config"><div><p className="eyebrow">Exibição</p><h4>Encaixe da mídia</h4></div><label>Modo<select value={mediaFitDraft} onChange={(event) => void saveMediaFit(event.target.value as MediaFit)} disabled={!canManage || busy}><option value="contain">Vídeo inteiro</option><option value="cover">Preencher telas</option><option value="native">Conteúdo preparado</option></select></label></div>}
      {selectedGroup.mode === 'video_wall' && <div className="display-group-mirror-config"><div><p className="eyebrow">Sincronização</p><h4>{selectedReady.length}/{selectedMemberIds.length} telas prontas</h4>{selectedLaunch && <p>{launchStatusLabels[selectedLaunch.status]}</p>}</div>{canManage && <button className="secondary-button compact" type="button" onClick={() => void prepareVideoWall()} disabled={busy || !groupPlaylistId || selectedMemberIds.length === 0}>Preparar exibição</button>}{canManage && <button className="primary-button compact" type="button" onClick={() => void startVideoWall()} disabled={busy || !selectedLaunch || selectedReady.length !== selectedMemberIds.length}>Iniciar exibição</button>}</div>}
      {selectedGroup.mode === 'coordinated' && <div className="display-group-mirror-config"><div><p className="eyebrow">Sincronização</p><h4>{selectedReady.length}/{selectedMemberIds.length} telas prontas</h4>{selectedLaunch && <p>{launchStatusLabels[selectedLaunch.status]}</p>}</div>{canManage && <button className="secondary-button compact" type="button" onClick={() => void prepareCoordinated()} disabled={busy || draftDirty || coordinatedDirty || !coordinatedContentComplete}>Preparar exibição</button>}{canManage && <button className="primary-button compact" type="button" onClick={() => void startCoordinated()} disabled={busy || !selectedLaunch || selectedLaunch.status !== 'preparing' || selectedReady.length !== selectedMemberIds.length}>Iniciar exibição</button>}</div>}
      <div className="display-wall-grid" style={{ gridTemplateColumns: `repeat(${selectedGroup.columns}, minmax(150px, 1fr))` }}>{Array.from({ length: selectedGroup.rows * selectedGroup.columns }).map((_, index) => { const rowIndex = Math.floor(index / selectedGroup.columns); const columnIndex = index % selectedGroup.columns; const slot = `${rowIndex}:${columnIndex}`; const displayId = draftSlots[slot] || ''; const ready = selectedReady.some((row) => row.display_id === displayId); return <label className="display-wall-slot" key={slot}><span>TV {index + 1} {selectedLaunch && displayId ? (ready ? '· pronta' : '· aguardando') : ''}</span><small>Linha {rowIndex + 1} · Coluna {columnIndex + 1}</small><select value={displayId} onChange={(event) => { setDraftSlots((current) => ({ ...current, [slot]: event.target.value })); setDraftDirty(true) }} disabled={!canManage}><option value="">Sem tela</option>{activeDisplays.map((display) => <option key={display.id} value={display.id}>{display.name}{display.location ? ` · ${display.location}` : ''}</option>)}</select>{selectedGroup.mode === 'coordinated' && displayId && <><small>Playlist</small><select value={coordinatedPlaylistDraft[displayId] || ''} onChange={(event) => { setCoordinatedPlaylistDraft((current) => ({ ...current, [displayId]: event.target.value })); setCoordinatedDirty(true) }} disabled={!canManage || draftDirty}><option value="">Sem playlist</option>{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select></>}</label> })}</div>
    </section>}
  </section>
}