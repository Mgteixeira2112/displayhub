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

const publicToken = getPublicToken()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {publicToken ? <PublicPlayer token={publicToken} /> : <App />}
  </StrictMode>,
)
