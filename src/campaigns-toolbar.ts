import './campaigns-toolbar.css'

type CampaignFilter = 'all' | 'continuous' | 'scheduled'

function getPlaylistName(card: HTMLElement) {
  return card.querySelector<HTMLElement>('.playlist-card-head strong')?.textContent?.trim() || ''
}

function getPublicationList(workspace: HTMLElement) {
  return workspace.querySelector<HTMLElement>('.publication-list')
}

function matchingPublications(card: HTMLElement, workspace: HTMLElement) {
  const name = getPlaylistName(card)
  const list = getPublicationList(workspace)
  if (!name || !list) return []
  return Array.from(list.querySelectorAll<HTMLElement>('.publication-card')).filter((publication) => {
    const label = publication.querySelector<HTMLElement>('strong')?.textContent?.trim() || ''
    return label.startsWith(`${name} →`)
  })
}

function applyCampaignFilters(workspace: HTMLElement, toolbar: HTMLElement) {
  const query = (toolbar.querySelector<HTMLInputElement>('.campaign-toolbar-search')?.value || '').trim().toLocaleLowerCase('pt-BR')
  const filter = (toolbar.dataset.filter || 'all') as CampaignFilter

  workspace.querySelectorAll<HTMLElement>('.playlist-list > .playlist-card').forEach((card) => {
    const name = getPlaylistName(card).toLocaleLowerCase('pt-BR')
    const description = (card.querySelector<HTMLElement>('.playlist-card-head p')?.textContent || '').toLocaleLowerCase('pt-BR')
    const publications = matchingPublications(card, workspace)
    const hasContinuous = publications.some((publication) =>
      (publication.querySelector<HTMLElement>('span')?.textContent || '').trim().startsWith('Contínuo'),
    )
    const hasScheduled = publications.some((publication) =>
      (publication.querySelector<HTMLElement>('span')?.textContent || '').trim().startsWith('Agendado'),
    )

    const matchesQuery = !query || name.includes(query) || description.includes(query)
    const matchesFilter = filter === 'all' || (filter === 'continuous' && hasContinuous) || (filter === 'scheduled' && hasScheduled)
    card.hidden = !(matchesQuery && matchesFilter)
  })
}

function prepareCreatePanel(workspace: HTMLElement) {
  const panel = workspace.querySelector<HTMLDetailsElement>('.playlist-create-panel')
  if (!panel) return
  const summary = panel.querySelector<HTMLElement>(':scope > summary')
  if (summary) summary.textContent = '+ Nova playlist'
  if (!panel.dataset.campaignProfessional) {
    panel.dataset.campaignProfessional = 'true'
    panel.open = false
  }
}

function createToolbar(workspace: HTMLElement) {
  const list = workspace.querySelector<HTMLElement>('.playlist-list')
  if (!list) return null

  let toolbar = workspace.querySelector<HTMLElement>('.campaign-toolbar')
  if (toolbar) return toolbar

  toolbar = document.createElement('div')
  toolbar.className = 'campaign-toolbar'
  toolbar.dataset.filter = 'all'
  toolbar.innerHTML = `
    <div class="campaign-toolbar-search-wrap">
      <input class="campaign-toolbar-search" type="search" placeholder="Buscar playlist" aria-label="Buscar playlist">
    </div>
    <div class="campaign-toolbar-filters" role="group" aria-label="Filtrar playlists">
      <button type="button" class="is-active" data-filter="all">Todas</button>
      <button type="button" data-filter="continuous">Contínuas</button>
      <button type="button" data-filter="scheduled">Agendadas</button>
    </div>
  `
  list.insertAdjacentElement('beforebegin', toolbar)

  toolbar.querySelector<HTMLInputElement>('.campaign-toolbar-search')?.addEventListener('input', () => {
    applyCampaignFilters(workspace, toolbar!)
  })

  toolbar.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      toolbar!.dataset.filter = button.dataset.filter || 'all'
      toolbar!.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('is-active', item === button))
      applyCampaignFilters(workspace, toolbar!)
    })
  })

  return toolbar
}

function prepareCampaignToolbar() {
  const workspace = document.querySelector<HTMLElement>('.view-campaigns .playlist-workspace')
  if (!workspace) return
  prepareCreatePanel(workspace)
  const toolbar = createToolbar(workspace)
  if (toolbar) applyCampaignFilters(workspace, toolbar)
}

const root = document.getElementById('root')
if (root) {
  const observer = new MutationObserver(() => window.requestAnimationFrame(prepareCampaignToolbar))
  observer.observe(root, { childList: true, subtree: true })
}

window.addEventListener('displayhub:navigate', () => window.requestAnimationFrame(prepareCampaignToolbar))
window.requestAnimationFrame(prepareCampaignToolbar)
