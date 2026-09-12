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

window.addEventListener('displayhub:navigate', resetAppScroll)
window.addEventListener('displayhub:use-promotion-template', resetAppScroll)
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('.software-nav-item:not(.software-nav-advanced-toggle), .software-topbar-create')) resetAppScroll()
})

const publicToken = getPublicToken()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publicToken ? <PublicPlayer token={publicToken} /> : <App />}
  </StrictMode>,
)
