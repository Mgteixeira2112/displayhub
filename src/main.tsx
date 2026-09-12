import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import PublicPlayer from './PublicPlayer'
import './styles.css'
import './structured.css'
import './playlists.css'
import './templates.css'
import './monitoring.css'
import './player.css'
import './soft-theme.css'
import './module-navigation.css'
import './modern-shell.css'
import './sidebar-overflow-fix.css'
import './home-dashboard.css'
import './promotion-gallery.css'
import './ux-actions.css'
import './display-groups.css'
import './promotion-posters.css'
import './promotion-posters-fixes.css'
import './promotion-animated-backgrounds.css'
import './promotion-beer-live.css'
import './promotion-beer-offer.css'
import './promotion-beer-video.css'
import './promotion-beer-video-portrait.css'
import './promotion-player.css'
import './playlist-transitions.css'
import './promotion-render-scale.css'
import './promotion-editor-tools.css'
import './promotion-creator-workspace.css'
import './promotion-creator-content-panel.css'
import './promotion-creator-compact.css'
import './promotion-creator-header-compact.css'
import './promotion-creator-preview-compact.css'
import './promotion-creator-toolbar-compact.css'
import './promotion-creator-form-dense.css'
import './promotion-creator-hide-demo-button.css'
import './promotion-creator-inline-actions.css'
import './promotion-creator-saved-cards.css'
import './promotion-creator-saved-grid-compact.css'
import './promotion-creator-controls-polish.css'
import './campaigns-visual.css'
import './campaigns-create-panel-compact.css'
import './campaigns-playlist-cards-compact.css'
import './campaigns-playlist-cards-expandable.css'

function getPublicToken() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
  const directMatch = window.location.pathname.match(new RegExp(`^${basePath}/display/([^/]+)$`))
  if (directMatch) return directMatch[1]
  const redirectedPath = new URLSearchParams(window.location.search).get('p')
  const redirectedMatch = redirectedPath?.match(/^display\/([^/]+)$/)
  if (!redirectedMatch) return null
  window.history.replaceState({}, '', `${import.meta.env.BASE_URL}display/${redirectedMatch[1]}`)
  return redirectedMatch[1]
}

function resetAppScroll() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  })
}

function keepCampaignCreatePanelVisible() {
  const panel = document.querySelector<HTMLDetailsElement>('.view-campaigns .playlist-create-panel')
  if (panel && !panel.open) panel.open = true
}

function prepareCampaignPlaylistCards() {
  document.querySelectorAll<HTMLElement>('.view-campaigns .playlist-card-head').forEach((head) => {
    const card = head.closest('.playlist-card') as HTMLElement | null
    head.setAttribute('role', 'button')
    head.setAttribute('tabindex', '0')
    head.setAttribute('aria-expanded', card?.classList.contains('is-expanded') ? 'true' : 'false')
    head.setAttribute('aria-label', 'Abrir ou recolher playlist')
  })
}

function setCampaignPlaylistExpanded(card: HTMLElement, expanded: boolean) {
  if (expanded) {
    document.querySelectorAll<HTMLElement>('.view-campaigns .playlist-card.is-expanded').forEach((otherCard) => {
      if (otherCard === card) return
      otherCard.classList.remove('is-expanded')
      const otherHead = otherCard.querySelector<HTMLElement>('.playlist-card-head')
      otherHead?.setAttribute('aria-expanded', 'false')
    })
  }

  card.classList.toggle('is-expanded', expanded)
  const head = card.querySelector<HTMLElement>('.playlist-card-head')
  head?.setAttribute('aria-expanded', expanded ? 'true' : 'false')
}

function toggleCampaignPlaylistFromTarget(target: Element) {
  const head = target.closest('.view-campaigns .playlist-card-head') as HTMLElement | null
  if (!head || target.closest('button, input, select, textarea, a')) return false
  const card = head.closest('.playlist-card') as HTMLElement | null
  if (!card) return false
  setCampaignPlaylistExpanded(card, !card.classList.contains('is-expanded'))
  return true
}

window.addEventListener('displayhub:navigate', resetAppScroll)
window.addEventListener('displayhub:navigate', () => window.requestAnimationFrame(() => {
  keepCampaignCreatePanelVisible()
  prepareCampaignPlaylistCards()
}))
window.addEventListener('displayhub:use-promotion-template', resetAppScroll)
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('.software-nav-item:not(.software-nav-advanced-toggle), .software-topbar-create')) resetAppScroll()
  if (target) toggleCampaignPlaylistFromTarget(target)
})
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  const target = event.target instanceof HTMLElement ? event.target : null
  if (!target?.matches('.view-campaigns .playlist-card-head')) return
  event.preventDefault()
  const card = target.closest('.playlist-card') as HTMLElement | null
  if (card) setCampaignPlaylistExpanded(card, !card.classList.contains('is-expanded'))
})

const publicToken = getPublicToken()
const root = document.getElementById('root')!

createRoot(root).render(
  <StrictMode>
    {publicToken ? <PublicPlayer token={publicToken} /> : <App />}
  </StrictMode>,
)

if (!publicToken) {
  const observer = new MutationObserver(() => {
    keepCampaignCreatePanelVisible()
    prepareCampaignPlaylistCards()
  })
  observer.observe(root, { childList: true, subtree: true })
  window.requestAnimationFrame(() => {
    keepCampaignCreatePanelVisible()
    prepareCampaignPlaylistCards()
  })
}
