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
import './campaigns-playlist-scheduling-inline.css'
import './campaigns-playlist-add-content-inline.css'
import './campaigns-expanded-professional.css'

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

function getCampaignPlaylistName(card: HTMLElement) {
  return card.querySelector<HTMLElement>('.playlist-card-head strong')?.textContent?.trim() || ''
}

function getCampaignAddContentForm(workspace: HTMLElement) {
  return workspace.querySelector<HTMLFormElement>('.campaign-inline-add-content')
    || workspace.querySelector<HTMLFormElement>('.playlist-create-panel .playlist-create-grid > form.content-form:nth-of-type(2)')
}

function attachCampaignAddContent(card: HTMLElement) {
  const workspace = card.closest<HTMLElement>('.playlist-workspace')
  if (!workspace) return

  const addContentForm = getCampaignAddContentForm(workspace)
  if (!addContentForm) return

  addContentForm.classList.add('campaign-inline-add-content')
  const heading = addContentForm.querySelector<HTMLElement>('h3')
  if (heading) heading.textContent = 'Adicionar conteúdo'

  const playlistName = getCampaignPlaylistName(card)
  const playlistSelect = addContentForm.querySelector<HTMLSelectElement>('label:first-of-type select')
  if (playlistSelect && playlistName) {
    const matchingOption = Array.from(playlistSelect.options).find((option) => option.textContent?.trim() === playlistName)
    if (matchingOption && playlistSelect.value !== matchingOption.value) {
      playlistSelect.value = matchingOption.value
      playlistSelect.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  const playlistItems = card.querySelector<HTMLElement>('.playlist-items')
  if (playlistItems && addContentForm.parentElement !== card) {
    playlistItems.insertAdjacentElement('afterend', addContentForm)
  }
}

function getCampaignPublicationCards(card: HTMLElement, publicationList: HTMLElement) {
  const playlistName = getCampaignPlaylistName(card)
  if (!playlistName) return []
  return Array.from(publicationList.querySelectorAll<HTMLElement>('.publication-card')).filter((publicationCard) => {
    const label = publicationCard.querySelector<HTMLElement>('strong')?.textContent?.trim() || ''
    return label.startsWith(`${playlistName} →`)
  })
}

function updateCampaignPlaylistSummary(card: HTMLElement, publicationList: HTMLElement) {
  const head = card.querySelector<HTMLElement>('.playlist-card-head')
  const copy = head?.firstElementChild as HTMLElement | null
  if (!copy) return

  const itemCount = card.querySelectorAll('.playlist-item').length
  const matchingPublications = getCampaignPublicationCards(card, publicationList)
  const displays = new Set(
    matchingPublications
      .map((publicationCard) => publicationCard.querySelector<HTMLElement>('strong')?.textContent?.split('→').slice(1).join('→').trim() || '')
      .filter(Boolean),
  )

  const contentText = `${itemCount} ${itemCount === 1 ? 'conteúdo' : 'conteúdos'}`
  let displayText = 'sem exibição'
  if (displays.size > 0) displayText = `${displays.size} ${displays.size === 1 ? 'tela' : 'telas'}`

  let scheduleText = ''
  if (matchingPublications.length === 1) {
    scheduleText = matchingPublications[0].querySelector<HTMLElement>('span')?.textContent?.trim() || ''
  } else if (matchingPublications.length > 1) {
    scheduleText = `${matchingPublications.length} programações`
  }

  const summaryText = [contentText, displayText, scheduleText].filter(Boolean).join(' · ')
  let summary = copy.querySelector<HTMLElement>('.campaign-playlist-summary')
  if (!summary) {
    summary = document.createElement('span')
    summary.className = 'campaign-playlist-summary'
    copy.append(summary)
  }
  if (summary.textContent !== summaryText) summary.textContent = summaryText
}

function prepareCampaignPlaylistCards() {
  document.querySelectorAll<HTMLElement>('.view-campaigns .playlist-card-head').forEach((head) => {
    const card = head.closest('.playlist-card') as HTMLElement | null
    head.setAttribute('role', 'button')
    head.setAttribute('tabindex', '0')
    head.setAttribute('aria-expanded', card?.classList.contains('is-expanded') ? 'true' : 'false')
    head.setAttribute('aria-label', 'Abrir ou recolher playlist')

    const workspace = card?.closest<HTMLElement>('.playlist-workspace')
    const publicationList = workspace?.querySelector<HTMLElement>('.publication-list')
    if (card && publicationList) updateCampaignPlaylistSummary(card, publicationList)
  })
}

function syncCampaignPublicationList(card: HTMLElement, publicationList: HTMLElement) {
  const matchingPublications = getCampaignPublicationCards(card, publicationList)
  const matchingSet = new Set(matchingPublications)

  publicationList.querySelectorAll<HTMLElement>('.publication-card').forEach((publicationCard) => {
    publicationCard.hidden = !matchingSet.has(publicationCard)
  })

  publicationList.querySelectorAll<HTMLElement>('.empty-state').forEach((emptyState) => {
    emptyState.hidden = true
  })

  const heading = publicationList.querySelector<HTMLElement>('h3')
  if (heading) heading.textContent = 'Exibições ativas'
  publicationList.dataset.campaignHasPublications = matchingPublications.length > 0 ? 'true' : 'false'
  updateCampaignPlaylistSummary(card, publicationList)
}

function attachCampaignScheduling(card: HTMLElement) {
  const workspace = card.closest<HTMLElement>('.playlist-workspace')
  if (!workspace) return

  const schedulePanel = workspace.querySelector<HTMLDetailsElement>('.schedule-create-panel')
  const publicationList = workspace.querySelector<HTMLElement>('.publication-list')
  if (!schedulePanel || !publicationList) return

  schedulePanel.classList.add('campaign-inline-schedule')
  publicationList.classList.add('campaign-inline-publications')
  schedulePanel.open = true

  const heading = schedulePanel.querySelector<HTMLElement>('h3')
  if (heading) heading.textContent = 'Onde e quando exibir'

  const playlistName = getCampaignPlaylistName(card)
  const playlistSelect = schedulePanel.querySelector<HTMLSelectElement>('.publication-grid label:nth-child(2) select')
  if (playlistSelect && playlistName) {
    const matchingOption = Array.from(playlistSelect.options).find((option) => option.textContent?.trim() === playlistName)
    if (matchingOption && playlistSelect.value !== matchingOption.value) {
      playlistSelect.value = matchingOption.value
      playlistSelect.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  card.append(schedulePanel, publicationList)
  syncCampaignPublicationList(card, publicationList)
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

  if (expanded) {
    attachCampaignAddContent(card)
    attachCampaignScheduling(card)
  }
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
