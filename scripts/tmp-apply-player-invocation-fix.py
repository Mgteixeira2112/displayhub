from pathlib import Path

path = Path('src/PublicPlayer.tsx')
source = path.read_text(encoding='utf-8')


def replace_once(before: str, after: str) -> None:
    global source
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'Expected exactly one match, found {count}: {before[:90]!r}')
    source = source.replace(before, after, 1)


replace_once(
    """    const [programRes, wallRes] = await Promise.all([
      publicSupabase.functions.invoke('display-program', { body: { token } }),
      publicSupabase.functions.invoke('display-wall-context', { body: { token } }),
    ])
    const { data, error } = programRes""",
    """    const { data, error } = await publicSupabase.functions.invoke('display-program', { body: { token } })""",
)
replace_once(
    "    const nextProgram = data as Program\n",
    """    const nextProgram = data as Program
    // Only video walls need an additional Edge Function for their viewport.
    let nextWall: WallContext | null = null
    if (nextProgram.group_mode === 'video_wall') {
      const { data: wallData, error: wallError } = await publicSupabase.functions.invoke('display-wall-context', { body: { token } })
      if (wallError) {
        setLoadError(true)
        return
      }
      nextWall = (wallData?.wall || null) as WallContext | null
    }
""",
)
replace_once("    setWall((wallRes.data?.wall || null) as WallContext | null)", "    setWall(nextWall)")

replace_once(
    """  useEffect(() => {
    let active = true
    void loadProgram()
    const channel = publicSupabase.channel(`display:${token}`)
      .on('broadcast', { event: 'display_invalidated' }, () => { if (active) setInvalid(true) })
      .on('broadcast', { event: 'display_program_changed' }, () => { if (active) void loadProgram() })
      .subscribe()
    const timer = window.setInterval(() => { if (active) void loadProgram() }, 2000)
    return () => {
      active = false
      window.clearInterval(timer)
      if (transitionTimerRef.current != null) window.clearTimeout(transitionTimerRef.current)
      void publicSupabase.removeChannel(channel)
    }
  }, [token, loadProgram])""",
    """  const groupMode = program?.group_mode || null
  useEffect(() => {
    let active = true
    let connectedOnce = false
    void loadProgram()
    const channel = publicSupabase.channel(`display:${token}`)
      .on('broadcast', { event: 'display_invalidated' }, () => { if (active) setInvalid(true) })
      .on('broadcast', { event: 'display_program_changed' }, () => { if (active) void loadProgram() })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        // Revalidate after a dropped Realtime connection; the first connection already loads above.
        if (connectedOnce && active) void loadProgram()
        connectedOnce = true
      })
    return () => {
      active = false
      if (transitionTimerRef.current != null) window.clearTimeout(transitionTimerRef.current)
      void publicSupabase.removeChannel(channel)
    }
  }, [token, loadProgram])

  useEffect(() => {
    // Launch synchronization requires the existing two-second cadence.
    // Standalone displays use Realtime plus a two-minute recovery poll.
    const timer = window.setInterval(() => { void loadProgram() }, groupMode ? 2000 : 120000)
    return () => window.clearInterval(timer)
  }, [groupMode, loadProgram])""",
)

start_marker = "  useEffect(() => {\n    if (!program || invalid) return\n    const report = () => {"
end_marker = "\n\n  if (invalid) return <main"
start = source.index(start_marker)
end = source.index(end_marker, start)
old_section = source[start:end]
if 'setInterval(report, 10000)' not in old_section or "functions.invoke('display-state'" not in old_section:
    raise RuntimeError('Unexpected telemetry section; refusing to change')
new_section = """  // Keep the current slide and playback sample fresh without restarting the heartbeat
  // whenever a playlist item or a two-second group refresh changes React state.
  const heartbeatContext = useRef<{
    program: Program | null
    invalid: boolean
    publication: Publication | null
    item: Item | null
    items: Item[]
    syncSession: SyncSession | null
    coordinatedLaunch: GroupLaunch | null
    effectiveIndex: number
  } | null>(null)

  useEffect(() => {
    heartbeatContext.current = { program, invalid, publication, item, items, syncSession, coordinatedLaunch, effectiveIndex }
  }, [program, invalid, publication, item, items, syncSession, coordinatedLaunch, effectiveIndex])

  const hasProgram = program !== null
  const heartbeatMs = groupMode ? 10000 : 60000
  useEffect(() => {
    if (!hasProgram || invalid) return
    const report = () => {
      const state = heartbeatContext.current
      if (!state?.program || state.invalid) return
      const {
        program: currentProgram, publication: currentPublication, item: currentItem,
        items: currentItems, syncSession: currentSession,
        coordinatedLaunch: currentLaunch, effectiveIndex: currentIndex,
      } = state
      let expectedPositionMs: number | null = null
      let actualPositionMs: number | null = null
      let buffering = false
      let measurementKind: 'clock' | 'media' = 'clock'
      const mediaSample = providerTelemetry.current
      if (mediaSample && Date.now() - mediaSample.sampledAt <= 5000) {
        expectedPositionMs = mediaSample.expectedPositionMs; actualPositionMs = mediaSample.actualPositionMs; buffering = mediaSample.buffering; measurementKind = mediaSample.measurementKind
      } else if ((currentSession || currentLaunch) && currentItem && currentItems.length) {
        const expected = currentSession ? resolveSyncCursor(currentItems, currentSession) : currentLaunch ? resolveLaunchCursor(currentItems, currentLaunch) : null
        if (expected && expected.index === currentIndex) {
          expectedPositionMs = Math.max(0, Math.round(expected.offsetSeconds * 1000))
          const anchor = playbackAnchor.current
          if (anchor?.key === `${expected.sequence}:${currentItem.id}`) {
            const elapsed = Math.max(0, performance.now() - anchor.startedAt)
            actualPositionMs = Math.min(currentItem.duration_seconds * 1000, Math.max(0, Math.round(anchor.offsetMs + elapsed)))
          }
        }
      }
      const sequence = currentSession?.sequence ?? currentLaunch?.sequence ?? 0
      void publicSupabase.functions.invoke('display-state', { body: { token, playlist_id: currentPublication?.playlist.id ?? null, item_id: currentItem?.id ?? null, group_id: currentProgram.group_id ?? null, session_id: currentSession?.id ?? null, expected_position_ms: expectedPositionMs, actual_position_ms: actualPositionMs, sequence, buffering, measurement_kind: measurementKind } })
    }
    report()
    // The monitoring panel treats a display as online for 90 seconds; use 60s
    // for standalone heartbeat, retaining 10s for group sync telemetry (30s TTL).
    const timer = window.setInterval(report, heartbeatMs)
    return () => window.clearInterval(timer)
  }, [token, hasProgram, invalid, heartbeatMs])"""
source = source[:start] + new_section + source[end:]

if "setInterval(() => { if (active) void loadProgram() }, 2000)" in source or 'setInterval(report, 10000)' in source:
    raise RuntimeError('Old polling/heartbeat behavior still present')
if source.count("functions.invoke('display-wall-context'") != 1 or source.count("functions.invoke('display-state'") != 1:
    raise RuntimeError('Expected one call per function in source')
path.write_text(source, encoding='utf-8')
print('PATCH_OK: program poll 120s standalone / 2s grouped; wall request only video_wall; heartbeat 60s standalone / 10s grouped, stable across item rerenders')
