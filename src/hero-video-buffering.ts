import { getCachedPromotionVideoUrl, isAndroidWebViewPlayback, preloadPromotionVideoToMemory } from './PromotionVideoPoster'

const selector = '.hero-konva-video, .smart-hero-background-video'

function switchToBufferedSource(video: HTMLVideoElement, source: string, bufferedSource: string) {
  if (!bufferedSource || video.src === bufferedSource || video.dataset.dhVideoSource !== source) return
  const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0
  const shouldResume = !video.paused
  video.src = bufferedSource
  video.load()
  video.addEventListener('loadedmetadata', () => {
    if (currentTime > 0 && Number.isFinite(video.duration)) {
      video.currentTime = Math.min(currentTime, Math.max(0, video.duration - 0.05))
    }
    if (shouldResume) void video.play().catch(() => undefined)
  }, { once: true })
}

function prepareHeroVideo(video: HTMLVideoElement) {
  const source = video.dataset.dhVideoSource || video.currentSrc || video.src
  if (!source) return

  video.preload = 'auto'
  video.dataset.dhVideoSource = source

  if (isAndroidWebViewPlayback()) return

  const cached = getCachedPromotionVideoUrl(source)
  if (cached) {
    switchToBufferedSource(video, source, cached)
    return
  }

  if (video.dataset.dhVideoBuffering === 'true') return
  video.dataset.dhVideoBuffering = 'true'

  void preloadPromotionVideoToMemory(source)
    .then((bufferedSource) => {
      video.dataset.dhVideoBuffering = 'false'
      if (!video.isConnected) return
      switchToBufferedSource(video, source, bufferedSource)
    })
    .catch(() => {
      video.dataset.dhVideoBuffering = 'false'
    })
}

function prepareHeroVideos(root: ParentNode = document) {
  root.querySelectorAll<HTMLVideoElement>(selector).forEach(prepareHeroVideo)
}

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return
      if (node.matches(selector)) prepareHeroVideo(node as HTMLVideoElement)
      prepareHeroVideos(node)
    })
  })
})

observer.observe(document.documentElement, { childList: true, subtree: true })
window.requestAnimationFrame(() => prepareHeroVideos())
