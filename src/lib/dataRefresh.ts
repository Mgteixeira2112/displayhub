export const DISPLAYHUB_DATA_CHANGED_EVENT = 'displayhub:data-changed'

export type DisplayHubDataTopic =
  | 'displays'
  | 'content'
  | 'structured_content'
  | 'promotion_posters'
  | 'templates'
  | 'playlists'
  | 'playlist_items'
  | 'publications'
  | 'all'

export function notifyDataChanged(topic: DisplayHubDataTopic = 'all') {
  window.dispatchEvent(new CustomEvent<DisplayHubDataTopic>(DISPLAYHUB_DATA_CHANGED_EVENT, { detail: topic }))
}

export function subscribeDataChanged(
  listener: (topic: DisplayHubDataTopic) => void,
  topics?: DisplayHubDataTopic[],
) {
  const handler = (event: Event) => {
    const topic = (event as CustomEvent<DisplayHubDataTopic>).detail || 'all'
    if (!topics || topics.includes(topic) || topic === 'all') listener(topic)
  }

  window.addEventListener(DISPLAYHUB_DATA_CHANGED_EVENT, handler)
  return () => window.removeEventListener(DISPLAYHUB_DATA_CHANGED_EVENT, handler)
}
