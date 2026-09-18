// Pure rotation rules shared by the future editor preview and the TV renderer.
// No playlist, network or database side effects happen while changing a region.
export type RegionRotation<T> = {
  items: readonly T[]
  pageIndex: number
  pageCount: number
  firstItem: number
  lastItem: number
  changes: boolean
}

function assertPositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`)
  }
  return value
}

/** Partition in source order; every item appears exactly once per full cycle. */
export function partitionRegion<T>(items: readonly T[], visibleCount: number): T[][] {
  const capacity = assertPositiveInteger(visibleCount, 'visibleCount')
  const pages: T[][] = []
  for (let start = 0; start < items.length; start += capacity) {
    pages.push(items.slice(start, start + capacity))
  }
  return pages
}

/** Resolve the contents of one region without changing its surrounding layout. */
export function regionAt<T>(
  items: readonly T[],
  visibleCount: number,
  elapsedMs: number,
  pageDurationMs: number,
): RegionRotation<T> {
  const capacity = assertPositiveInteger(visibleCount, 'visibleCount')
  const duration = assertPositiveInteger(pageDurationMs, 'pageDurationMs')
  if (!Number.isFinite(elapsedMs)) throw new RangeError('elapsedMs must be finite')
  const pageCount = Math.ceil(items.length / capacity)
  if (pageCount === 0) return { items: [], pageIndex: 0, pageCount: 0, firstItem: 0, lastItem: 0, changes: false }
  // A short list never animates; every full list cycle restarts at its first item.
  const pageIndex = pageCount === 1 ? 0 : Math.floor(Math.max(0, elapsedMs) / duration) % pageCount
  const firstItem = pageIndex * capacity
  const selected = items.slice(firstItem, firstItem + capacity)
  return { items: selected, pageIndex, pageCount, firstItem, lastItem: firstItem + selected.length, changes: pageCount > 1 }
}

/** The playlist slot must be long enough to show the last page before switching items. */
export function minimumSlotMs(itemCount: number, visibleCount: number, pageDurationMs: number): number {
  if (!Number.isSafeInteger(itemCount) || itemCount < 0) throw new RangeError('itemCount must be a nonnegative safe integer')
  const capacity = assertPositiveInteger(visibleCount, 'visibleCount')
  const duration = assertPositiveInteger(pageDurationMs, 'pageDurationMs')
  const total = Math.ceil(itemCount / capacity) * duration
  if (!Number.isSafeInteger(total)) throw new RangeError('slot duration exceeds safe integer range')
  return total
}
