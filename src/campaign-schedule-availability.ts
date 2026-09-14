import { supabase } from './lib/supabase'

type Publication = {
  id: string
  display_id: string
  starts_at: string | null
  ends_at: string | null
  repeat_mode: 'always' | 'daily'
  daily_start: string | null
  daily_end: string | null
  weekdays: number[]
  is_active: boolean
}

type DraftSchedule = {
  start: number
  end: number
  repeatMode: 'always' | 'daily'
  dailyStart: number | null
  dailyEnd: number | null
  weekdays: number[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const formRevision = new WeakMap<HTMLFormElement, number>()
let refreshTimer: number | null = null

function labelText(label: HTMLLabelElement) {
  return Array.from(label.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent?.trim() || '')
    .join(' ')
    .trim()
}

function field(form: HTMLFormElement, name: string) {
  return Array.from(form.querySelectorAll<HTMLLabelElement>('label')).find((label) => labelText(label) === name) || null
}

function minutes(value: string | null) {
  if (!value) return null
  const [hours, mins] = value.slice(0, 5).split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null
  return hours * 60 + mins
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart
}

function publicationStart(publication: Publication) {
  return publication.starts_at ? new Date(publication.starts_at).getTime() : Number.NEGATIVE_INFINITY
}

function publicationEnd(publication: Publication) {
  return publication.ends_at ? new Date(publication.ends_at).getTime() : Number.POSITIVE_INFINITY
}

function isContinuous(publication: Publication) {
  return publication.is_active && publication.repeat_mode === 'always' && !publication.starts_at && !publication.ends_at
}

function occurrenceOverlapsRange(
  rangeStart: number,
  rangeEnd: number,
  dailyStart: number,
  dailyEnd: number,
  weekdays: number[],
  boundStart: number,
  boundEnd: number,
) {
  const effectiveStart = Math.max(rangeStart, boundStart)
  const effectiveEnd = Math.min(rangeEnd, boundEnd)
  if (!(effectiveStart < effectiveEnd) || dailyStart >= dailyEnd || weekdays.length === 0) return false

  if (effectiveEnd - effectiveStart > 8 * DAY_MS) return true

  const allowedDays = new Set(weekdays)
  const first = new Date(effectiveStart)
  const cursor = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 0, 0, 0, 0)

  for (let index = 0; index < 10 && cursor.getTime() < effectiveEnd; index += 1) {
    if (allowedDays.has(cursor.getDay())) {
      const startHour = Math.floor(dailyStart / 60)
      const startMinute = dailyStart % 60
      const endHour = Math.floor(dailyEnd / 60)
      const endMinute = dailyEnd % 60
      const occurrenceStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), startHour, startMinute).getTime()
      const occurrenceEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), endHour, endMinute).getTime()
      const clippedStart = Math.max(occurrenceStart, boundStart)
      const clippedEnd = Math.min(occurrenceEnd, boundEnd)
      if (rangesOverlap(rangeStart, rangeEnd, clippedStart, clippedEnd)) return true
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return false
}

function oneTimeConflictsDaily(oneStart: number, oneEnd: number, daily: DraftSchedule | Publication) {
  const dailyStart = 'dailyStart' in daily ? daily.dailyStart : minutes(daily.daily_start)
  const dailyEnd = 'dailyEnd' in daily ? daily.dailyEnd : minutes(daily.daily_end)
  const boundStart = 'start' in daily ? daily.start : publicationStart(daily)
  const boundEnd = 'end' in daily ? daily.end : publicationEnd(daily)
  if (dailyStart == null || dailyEnd == null) return false
  return occurrenceOverlapsRange(oneStart, oneEnd, dailyStart, dailyEnd, daily.weekdays, boundStart, boundEnd)
}

function dailyConflictsDaily(draft: DraftSchedule, publication: Publication) {
  const existingDailyStart = minutes(publication.daily_start)
  const existingDailyEnd = minutes(publication.daily_end)
  if (draft.dailyStart == null || draft.dailyEnd == null || existingDailyStart == null || existingDailyEnd == null) return false

  const effectiveStart = Math.max(draft.start, publicationStart(publication))
  const effectiveEnd = Math.min(draft.end, publicationEnd(publication))
  if (!(effectiveStart < effectiveEnd)) return false

  const sharedWeekdays = draft.weekdays.filter((day) => publication.weekdays.includes(day))
  if (sharedWeekdays.length === 0) return false

  const sharedStart = Math.max(draft.dailyStart, existingDailyStart)
  const sharedEnd = Math.min(draft.dailyEnd, existingDailyEnd)
  if (sharedStart >= sharedEnd) return false

  return occurrenceOverlapsRange(effectiveStart, effectiveEnd, sharedStart, sharedEnd, sharedWeekdays, effectiveStart, effectiveEnd)
}

function conflicts(draft: DraftSchedule, publication: Publication) {
  if (!publication.is_active || isContinuous(publication)) return false

  const existingStart = publicationStart(publication)
  const existingEnd = publicationEnd(publication)

  if (draft.repeatMode === 'always' && publication.repeat_mode === 'always') {
    return rangesOverlap(draft.start, draft.end, existingStart, existingEnd)
  }
  if (draft.repeatMode === 'always' && publication.repeat_mode === 'daily') {
    return oneTimeConflictsDaily(draft.start, draft.end, publication)
  }
  if (draft.repeatMode === 'daily' && publication.repeat_mode === 'always') {
    return oneTimeConflictsDaily(existingStart, existingEnd, draft)
  }
  return dailyConflictsDaily(draft, publication)
}

function readDraft(form: HTMLFormElement): DraftSchedule | null {
  const startsAt = field(form, 'Início')?.querySelector<HTMLInputElement>('input')?.value || ''
  const endsAt = field(form, 'Fim')?.querySelector<HTMLInputElement>('input')?.value || ''
  const repeatMode = field(form, 'Repetição')?.querySelector<HTMLSelectElement>('select')?.value as 'always' | 'daily' | undefined
  const start = startsAt ? new Date(startsAt).getTime() : Number.NaN
  const end = endsAt ? new Date(endsAt).getTime() : Number.NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || !repeatMode) return null

  if (repeatMode === 'always') {
    return { start, end, repeatMode, dailyStart: null, dailyEnd: null, weekdays: [0, 1, 2, 3, 4, 5, 6] }
  }

  const dailyStart = minutes(field(form, 'De')?.querySelector<HTMLInputElement>('input')?.value || null)
  const dailyEnd = minutes(field(form, 'Até')?.querySelector<HTMLInputElement>('input')?.value || null)
  const weekdays = Array.from(form.querySelectorAll<HTMLInputElement>('.weekday-row input[type="checkbox"]'))
    .map((checkbox, index) => checkbox.checked ? index : -1)
    .filter((day) => day >= 0)

  if (dailyStart == null || dailyEnd == null || dailyStart >= dailyEnd || weekdays.length === 0) return null
  return { start, end, repeatMode, dailyStart, dailyEnd, weekdays }
}

function resetOptions(select: HTMLSelectElement) {
  Array.from(select.options).forEach((option) => {
    if (!option.value) return
    option.hidden = false
    option.disabled = false
  })
}

function clearDisplay(select: HTMLSelectElement) {
  if (!select.value) return
  select.value = ''
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

async function refreshForm(form: HTMLFormElement) {
  const modeLabel = field(form, 'Exibição')
  const displayLabel = field(form, 'Display')
  const displaySelect = displayLabel?.querySelector<HTMLSelectElement>('select')
  const mode = modeLabel?.querySelector<HTMLSelectElement>('select')?.value
  if (!displayLabel || !displaySelect || !mode) return

  resetOptions(displaySelect)
  displayLabel.style.order = mode === 'scheduled' ? '99' : ''

  if (mode !== 'scheduled') {
    displayLabel.hidden = false
    return
  }

  const draft = readDraft(form)
  if (!draft) {
    displayLabel.hidden = true
    clearDisplay(displaySelect)
    return
  }

  const revision = (formRevision.get(form) || 0) + 1
  formRevision.set(form, revision)

  const { data, error } = await supabase
    .from('display_publications')
    .select('id,display_id,starts_at,ends_at,repeat_mode,daily_start,daily_end,weekdays,is_active')
    .eq('is_active', true)

  if (formRevision.get(form) !== revision) return
  if (error) {
    displayLabel.hidden = true
    clearDisplay(displaySelect)
    return
  }

  const conflictDisplays = new Set(
    ((data || []) as Publication[])
      .filter((publication) => conflicts(draft, publication))
      .map((publication) => publication.display_id),
  )

  Array.from(displaySelect.options).forEach((option) => {
    if (!option.value) return
    const unavailable = conflictDisplays.has(option.value)
    option.hidden = unavailable
    option.disabled = unavailable
  })

  if (displaySelect.value && conflictDisplays.has(displaySelect.value)) clearDisplay(displaySelect)
  displayLabel.hidden = false
}

function scheduleRefresh() {
  if (refreshTimer != null) window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null
    document.querySelectorAll<HTMLFormElement>('.publication-form').forEach((form) => void refreshForm(form))
  }, 80)
}

document.addEventListener('input', (event) => {
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('.publication-form')) scheduleRefresh()
})

document.addEventListener('change', (event) => {
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('.publication-form')) scheduleRefresh()
})

const observer = new MutationObserver(() => scheduleRefresh())
const root = document.getElementById('root')
if (root) observer.observe(root, { childList: true, subtree: true })
window.requestAnimationFrame(scheduleRefresh)
