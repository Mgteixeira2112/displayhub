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
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let disposed = false
    let player: YouTubeController | null = null
    let startTimer = 0

    const scheduleStart = (target: YouTubeController) => {
      window.clearTimeout(startTimer)
      if (!shouldPlay) {
        target.pauseVideo()
        return
      }
      const delay = startAt ? Math.max(0, new Date(startAt).getTime() - Date.now()) : 0
      if (delay <= 20) {
        target.playVideo()
        return
      }
      target.pauseVideo()
      startTimer = window.setTimeout(() => {
        if (!disposed) target.playVideo()
      }, delay)
    }

    void loadYouTubeIframeApi().then(() => {
      if (disposed || !hostRef.current || !window.YT?.Player) return

      player = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          rel: 0,
          playsinline: 1,
          disablekb: 1,
          modestbranding: 1,
          start: Math.max(0, Math.floor(startSeconds)),
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            if (disposed) return
            target.mute()
            target.seekTo(Math.max(0, startSeconds), true)
            target.pauseVideo()
            onController(target)
            onReady()
            scheduleStart(target)
          },
          onStateChange: ({ data }) => {
            if (disposed) return
            onBufferingChange(data === 3)
          },
          onAutoplayBlocked: () => onBufferingChange(true),
        },
      })
    }).catch(() => {
      if (!disposed) onBufferingChange(true)
    })

    return () => {
      disposed = true
      window.clearTimeout(startTimer)
      onController(null)
      onBufferingChange(false)
      player?.destroy()
    }
  }, [videoId, syncKey, startSeconds, shouldPlay, startAt, onReady, onController, onBufferingChange])

  return <div className="youtube-sync-player" role="img" aria-label={title} ref={hostRef} />
}
