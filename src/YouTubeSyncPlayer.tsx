import { useEffect, useRef } from 'react'

export type YouTubeController = {
  getCurrentTime: () => number
  getPlayerState: () => number
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  playVideo: () => void
  pauseVideo: () => void
  mute: () => void
  destroy: () => void
}

type YouTubeEvent = { target: YouTubeController }
type YouTubeStateEvent = { data: number; target: YouTubeController }
type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (event: YouTubeEvent) => void
        onStateChange?: (event: YouTubeStateEvent) => void
        onAutoplayBlocked?: () => void
      }
    },
  ) => YouTubeController
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<void> | null = null

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise

  apiPromise = new Promise<void>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      resolve()
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')
    if (existing) {
      existing.addEventListener('error', () => reject(new Error('youtube_api_load_failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => reject(new Error('youtube_api_load_failed'))
    document.head.appendChild(script)
  })

  return apiPromise
}

type Props = {
  videoId: string
  title: string
  startSeconds: number
  syncKey: string
  shouldPlay: boolean
  startAt: string | null
  onReady: () => void
  onController: (controller: YouTubeController | null) => void
  onBufferingChange: (buffering: boolean) => void
}

export default function YouTubeSyncPlayer({ videoId, title, startSeconds, syncKey, shouldPlay, startAt, onReady, onController, onBufferingChange }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubeController | null>(null)
  const startTimerRef = useRef(0)
  const startSecondsRef = useRef(startSeconds)
  const shouldPlayRef = useRef(shouldPlay)
  const startAtRef = useRef(startAt)
  const onReadyRef = useRef(onReady)
  const onControllerRef = useRef(onController)
  const onBufferingChangeRef = useRef(onBufferingChange)

  startSecondsRef.current = startSeconds
  shouldPlayRef.current = shouldPlay
  startAtRef.current = startAt
  onReadyRef.current = onReady
  onControllerRef.current = onController
  onBufferingChangeRef.current = onBufferingChange

  useEffect(() => {
    let disposed = false

    const applyCoverSizing = () => {
      const wrapper = wrapperRef.current
      const iframe = wrapper?.querySelector<HTMLIFrameElement>('iframe')
      if (!wrapper || !iframe) return

      const { width, height } = wrapper.getBoundingClientRect()
      if (!width || !height) return

      const videoAspect = 16 / 9
      const surfaceAspect = width / height
      const targetWidth = surfaceAspect >= videoAspect ? width : height * videoAspect
      const targetHeight = surfaceAspect >= videoAspect ? width / videoAspect : height

      iframe.style.position = 'absolute'
      iframe.style.left = '50%'
      iframe.style.top = '50%'
      iframe.style.width = `${Math.ceil(targetWidth)}px`
      iframe.style.height = `${Math.ceil(targetHeight)}px`
      iframe.style.maxWidth = 'none'
      iframe.style.transform = 'translate(-50%, -50%)'
      iframe.style.border = '0'
    }

    const scheduleStart = (target: YouTubeController) => {
      window.clearTimeout(startTimerRef.current)
      if (!shouldPlayRef.current) {
        target.pauseVideo()
        return
      }
      const targetStartAt = startAtRef.current
      const delay = targetStartAt ? Math.max(0, new Date(targetStartAt).getTime() - Date.now()) : 0
      if (delay <= 20) {
        target.playVideo()
        return
      }
      target.pauseVideo()
      startTimerRef.current = window.setTimeout(() => {
        if (!disposed) target.playVideo()
      }, delay)
    }

    const resizeObserver = new ResizeObserver(() => applyCoverSizing())
    if (wrapperRef.current) resizeObserver.observe(wrapperRef.current)

    void loadYouTubeIframeApi().then(() => {
      if (disposed || !hostRef.current || !window.YT?.Player) return

      const initialStartSeconds = Math.max(0, startSecondsRef.current)
      const player = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          rel: 0,
          playsinline: 1,
          disablekb: 1,
          modestbranding: 1,
          start: Math.floor(initialStartSeconds),
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            if (disposed) return
            playerRef.current = target
            target.mute()
            target.seekTo(initialStartSeconds, true)
            target.pauseVideo()
            applyCoverSizing()
            onControllerRef.current(target)
            onReadyRef.current()
            scheduleStart(target)
          },
          onStateChange: ({ data }) => {
            if (disposed) return
            onBufferingChangeRef.current(data === 3)
          },
          onAutoplayBlocked: () => onBufferingChangeRef.current(true),
        },
      })
      playerRef.current = player
      window.requestAnimationFrame(applyCoverSizing)
    }).catch(() => {
      if (!disposed) onBufferingChangeRef.current(true)
    })

    return () => {
      disposed = true
      resizeObserver.disconnect()
      window.clearTimeout(startTimerRef.current)
      startTimerRef.current = 0
      playerRef.current = null
      onControllerRef.current(null)
      onBufferingChangeRef.current(false)
    }
  }, [videoId, syncKey])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    window.clearTimeout(startTimerRef.current)
    if (!shouldPlay) {
      player.pauseVideo()
      onReadyRef.current()
      return
    }

    const delay = startAt ? Math.max(0, new Date(startAt).getTime() - Date.now()) : 0
    if (delay <= 20) {
      player.playVideo()
      return
    }

    player.pauseVideo()
    startTimerRef.current = window.setTimeout(() => player.playVideo(), delay)
    return () => window.clearTimeout(startTimerRef.current)
  }, [shouldPlay, startAt])

  return <div className="youtube-sync-player" role="img" aria-label={title} ref={wrapperRef}><div className="youtube-sync-player-host" ref={hostRef} /></div>
}
