import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

type Mode = 'mirror' | 'coordinated' | 'video_wall'
type Profile = { company_id: string; role: string }
type Display = { id: string; name: string; location: string | null; resolution_width: number; resolution_height: number; revoked_at: string | null; is_active: boolean }
type Group = { id: string; name: string; mode: Mode; rows: number; columns: number; virtual_width: number | null; virtual_height: number | null; is_active: boolean }
type Member = { id: string; group_id: string; display_id: string; row_index: number; column_index: number }
type Playlist = { id: string; name: string }
type GroupPublication = { id: string; group_id: string; playlist_id: string; is_active: boolean }
type Launch = { id: string; group_id: string; playlist_id: string; status: 'preparing' | 'armed' | 'started' | 'cancelled'; sequence: number; start_at: string | null }
type ReadyState = { launch_id: string; display_id: string; ready: boolean; provider: string | null; reported_at: string }

const modeLabels: Record<Mode, string> = { mirror: 'Espelhamento', coordinated: 'Conteúdo coordenado', video_wall: 'Video Wall' }

export default function DisplayGroupsManager() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displays, setDisplays] = useState<Display[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [groupPublications, setGroupPublications] = useState<GroupPublication[]>([])
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
  const [draftDirty, setDraftDirty] = useState(false)
  const [playlistDirty, setPlaylistDirty] = useState(false)
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
      supabase.from('display_groups').select('id, name, mode, rows, columns, virtual_width, virtual_height, is_active').order('created_at', { ascending: false }),
      supabase.from('display_group_members').select('id, group_id, display_id, row_index, column_index'),
      supabase.from('playlists').select('id, name').eq('is_active', true).order('name'),
      supabase.from('display_group_publications').select('id, group_id, playlist_id, is_active'),
      supabase.from('display_group_launches').select('id, group_id, playlist_id, status, sequence, start_at'),
      supabase.from('display_group_ready_states').select('launch_id, display_id, ready, provider, reported_at'),
    ])
    for (const result of results) if (result.error) throw result.error
    setDisplays((results[0].data || []) as Display[])
    setGroups((results[1].data || []) as Group[])
    setMembers((results[2].data || []) as Member[])
    setPlaylists((results[3].data || []) as Playlist[])
    setGroupPublications((results[4].data || []) as GroupPublication[])
    setLaunches((results[5].data || []) as Launch[])
    setReadyStates((results[6].data || []) as ReadyState[])
  }, [])

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os grupos.')) }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => void load().catch(() => undefined), 3000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    setDraftDirty(false)
    setPlaylistDirty(false)
  }, [selectedGroupId])

  useEffect(() => {
    if (!selectedGroup) {
      if (!draftDirty) setDraftSlots({})
      if (!playlistDirty) setGroupPlaylistId('')
      return
    }
    if (!draftDirty) {
      const next: Record<string, string> = {}
      members.filter((member) => member.group_id === selectedGroup.id).forEach((member) => { next[`${member.row_index}:${member.column_index}`] = member.display_id })
      setDraftSlots(next)
    }
    if (!playlistDirty) {
      setGroupPlaylistId(groupPublications.find((publication) => publication.group_id === selectedGroup.id && publication.is_active)?.playlist_id || '')
    }
  }, [selectedGroup, members, groupPublications, draftDirty, playlistDirty])

  const activeDisplays = useMemo(() => displays.filter((display) => display.is_active && !display.revoked_at), [displays])
  const selectedLaunch = selectedGroup ? launches.find((launch) => launch.group_id === selectedGroup.id) || null : null
  const selectedMemberIds = selectedGroup ? members.filter((member) => member.group_id === selectedGroup.id).map((member) => member.display_id).filter((id) => activeDisplays.some((display) => display.id === id)) : []
  const selectedReady = selectedLaunch ? readyStates.filter((row) => row.launch_id === selectedLaunch.id && row.ready && selectedMemberIds.includes(row.display_id)) : []

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!profile || !canManage) return
    setBusy(true); setMessage('')
    try {
      const { data, error } = await supabase.from('display_groups').insert({ company_id: profile.company_id, name: name.trim(), mode, rows, columns, virtual_width: virtualWidth ? Number(virtualWidth) : null, virtual_height: virtualHeight ? Number(virtualHeight) : null }).select('id').single()
      if (error) throw error
      setName(''); await load(); setSelectedGroupId(data.id); setMessage('Grupo criado. Agora posicione as TVs na grade.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível criar o grupo.') } finally { setBusy(false) }
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
      await load(); setDraftDirty(false); setMessage('Posicionamento salvo com sucesso.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o posicionamento.') } finally { setBusy(false) }
  }

  async function saveGroupPlaylist() {
    if (!profile || !selectedGroup || !['mirror', 'video_wall'].includes(selectedGroup.mode) || !canManage) return
    setBusy(true); setMessage('')
    try {
      const { error: deleteError } = await supabase.from('display_group_publications').delete().eq('group_id', selectedGroup.id); if (deleteError) throw deleteError
      if (groupPlaylistId) { const { error } = await supabase.from('display_group_publications').insert({ company_id: profile.company_id, group_id: selectedGroup.id, playlist_id: groupPlaylistId, is_active: true }); if (error) throw error }
      await load(); setPlaylistDirty(false); setMessage(groupPlaylistId ? 'Playlist do grupo salva.' : 'Grupo sem playlist ativa.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a playlist do grupo.') } finally { setBusy(false) }
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
    if (!profile || !selectedGroup || !selectedLaunch || !canManage) return
    if (!selectedMemberIds.length || selectedReady.length !== selectedMemberIds.length) { setMessage(`Aguarde: ${selectedReady.length}/${selectedMemberIds.length} telas prontas.`); return }
    setBusy(true); setMessage('')
    try {
      const startAt = new Date(Date.now() + 8000).toISOString()
      const { error: launchError } = await supabase.from('display_group_launches').update({ status: 'armed', start_at: startAt }).eq('id', selectedLaunch.id); if (launchError) throw launchError
      const { data: currentSession, error: sessionReadError } = await supabase.from('display_group_sessions').select('sequence').eq('group_id', selectedGroup.id).maybeSingle(); if (sessionReadError) throw sessionReadError
      const { error: sessionError } = await supabase.from('display_group_sessions').upsert({ company_id: profile.company_id, group_id: selectedGroup.id, playlist_id: selectedLaunch.playlist_id, playback_state: 'playing', started_at: startAt, paused_position_ms: 0, sequence: Number(currentSession?.sequence || 0) + 1 }, { onConflict: 'group_id' }); if (sessionError) throw sessionError
      await load(); setMessage(`Video Wall armado. Início comum em ${new Date(startAt).toLocaleTimeString('pt-BR')}.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível iniciar o Video Wall.') } finally { setBusy(false) }
  }

  return <section className="display-groups-module">
    <div className="section-heading"><div><p className="eyebrow">Video Wall</p><h2>Grupos de Displays</h2><p>Organize várias TVs como espelhamento, conteúdo coordenado ou uma superfície única.</p></div><button className="secondary-button compact" type="button" onClick={() => void load()} disabled={busy}>Atualizar</button></div>
    {message && <p className="form-message" role="status">{message}</p>}
    {canManage && <details className="create-panel display-group-create"><summary>+ Novo grupo de displays</summary><form className="display-group-form" onSubmit={createGroup}><label>Nome<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} required placeholder="Painel Principal" /></label><label>Modo<select value={mode} onChange={(event) => setMode(event.target.value as Mode)}><option value="video_wall">Video Wall</option><option value="coordinated">Conteúdo coordenado</option><option value="mirror">Espelhamento</option></select></label><label>Linhas<input type="number" min="1" max="16" value={rows} onChange={(event) => setRows(Number(event.target.value))} /></label><label>Colunas<input type="number" min="1" max="16" value={columns} onChange={(event) => setColumns(Number(event.target.value))} /></label><label>Largura virtual<input type="number" min="320" max="65536" value={virtualWidth} onChange={(event) => setVirtualWidth(event.target.value)} placeholder="Automática" /></label><label>Altura virtual<input type="number" min="320" max="65536" value={virtualHeight} onChange={(event) => setVirtualHeight(event.target.value)} placeholder="Automática" /></label><button className="primary-button" type="submit" disabled={busy}>Criar grupo</button></form></details>}
    <div className="display-group-list">{groups.length === 0 && <p className="empty-state">Nenhum grupo cadastrado.</p>}{groups.map((group) => { const count = members.filter((member) => member.group_id === group.id).length; return <button key={group.id} type="button" className={`display-group-card ${selectedGroupId === group.id ? 'selected' : ''}`} onClick={() => setSelectedGroupId(group.id)}><strong>{group.name}</strong><span>{modeLabels[group.mode]} · {group.rows}×{group.columns}</span><small>{count} TV{count === 1 ? '' : 's'} posicionada{count === 1 ? '' : 's'}</small></button> })}</div>
    {selectedGroup && <section className="display-group-editor">
      <div className="section-heading"><div><p className="eyebrow">Posicionamento</p><h3>{selectedGroup.name}</h3><p>{modeLabels[selectedGroup.mode]} · grade {selectedGroup.rows}×{selectedGroup.columns}</p></div>{canManage && <button className="primary-button compact" type="button" onClick={() => void saveLayout()} disabled={busy}>Salvar posições</button>}</div>
      {(selectedGroup.mode === 'mirror' || selectedGroup.mode === 'video_wall') && <div className="display-group-mirror-config"><div><p className="eyebrow">{selectedGroup.mode === 'video_wall' ? 'Conteúdo do Video Wall' : 'Conteúdo espelhado'}</p><h4>Playlist do grupo</h4><p>Todos os displays carregam a mesma playlist; no Video Wall cada TV exibe sua região.</p></div><label>Playlist<select value={groupPlaylistId} onChange={(event) => { setGroupPlaylistId(event.target.value); setPlaylistDirty(true) }} disabled={!canManage}><option value="">Nenhuma playlist</option>{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select></label>{canManage && <button className="primary-button compact" type="button" onClick={() => void saveGroupPlaylist()} disabled={busy}>Salvar playlist</button>}</div>}
      {selectedGroup.mode === 'video_wall' && <div className="display-group-mirror-config"><div><p className="eyebrow">Teste sincronizado</p><h4>PRELOAD → READY → START</h4><p>Prontas: <strong>{selectedReady.length}/{selectedMemberIds.length}</strong>{selectedLaunch ? ` · ${selectedLaunch.status}` : ''}</p></div>{canManage && <button className="secondary-button compact" type="button" onClick={() => void prepareVideoWall()} disabled={busy || !groupPlaylistId || selectedMemberIds.length === 0}>Preparar telas</button>}{canManage && <button className="primary-button compact" type="button" onClick={() => void startVideoWall()} disabled={busy || !selectedLaunch || selectedReady.length !== selectedMemberIds.length}>Iniciar sincronizado</button>}</div>}
      <div className="display-wall-grid" style={{ gridTemplateColumns: `repeat(${selectedGroup.columns}, minmax(150px, 1fr))` }}>{Array.from({ length: selectedGroup.rows * selectedGroup.columns }).map((_, index) => { const rowIndex = Math.floor(index / selectedGroup.columns); const columnIndex = index % selectedGroup.columns; const slot = `${rowIndex}:${columnIndex}`; const displayId = draftSlots[slot] || ''; const ready = selectedReady.some((row) => row.display_id === displayId); return <label className="display-wall-slot" key={slot}><span>TV {index + 1} {selectedLaunch && displayId ? (ready ? '· READY' : '· aguardando') : ''}</span><small>Linha {rowIndex + 1} · Coluna {columnIndex + 1}</small><select value={displayId} onChange={(event) => { setDraftSlots((current) => ({ ...current, [slot]: event.target.value })); setDraftDirty(true) }} disabled={!canManage}><option value="">Sem display</option>{activeDisplays.map((display) => <option key={display.id} value={display.id}>{display.name}{display.location ? ` · ${display.location}` : ''}</option>)}</select></label> })}</div>
    </section>}
  </section>
}