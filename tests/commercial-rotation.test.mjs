import assert from 'node:assert/strict'
import { test } from 'node:test'
import { partitionRegion, regionAt, minimumSlotMs } from '../src/lib/commercialRotation.ts'

for (const [count, capacity, expectedPages] of [[1, 6, 1], [6, 6, 1], [7, 6, 2], [20, 6, 4], [28, 6, 5], [30, 6, 5]]) {
  test(`${count} table items with ${capacity} visible: full cycle, no loss or duplication`, () => {
    const rows = Array.from({ length: count }, (_, index) => `Produto ${index + 1}`)
    const pages = partitionRegion(rows, capacity)
    assert.equal(pages.length, expectedPages)
    assert.deepEqual(pages.flat(), rows)
    assert.ok(pages.every((page) => page.length > 0 && page.length <= capacity))
    const seen = []
    for (let index = 0; index < pages.length; index += 1) {
      const current = regionAt(rows, capacity, index * 3000, 3000)
      assert.equal(current.pageIndex, index)
      seen.push(...current.items)
      assert.equal(current.lastItem - current.firstItem, current.items.length)
    }
    assert.deepEqual(seen, rows)
    assert.deepEqual(regionAt(rows, capacity, expectedPages * 3000, 3000).items, pages[0])
    assert.equal(regionAt(rows, capacity, 9000, 3000).changes, expectedPages > 1)
    assert.equal(minimumSlotMs(count, capacity, 3000), expectedPages * 3000)
  })
}

test('eight selected offers rotate inside two slots in four groups', () => {
  const offers = Array.from({ length: 8 }, (_, index) => `Oferta ${index + 1}`)
  assert.deepEqual(partitionRegion(offers, 2), [offers.slice(0, 2), offers.slice(2, 4), offers.slice(4, 6), offers.slice(6, 8)])
  assert.deepEqual(regionAt(offers, 2, 9000, 3000).items, offers.slice(6, 8))
  assert.deepEqual(regionAt(offers, 2, 12000, 3000).items, offers.slice(0, 2))
})

test('empty and short regions stay fixed and negative times resolve first page', () => {
  assert.deepEqual(partitionRegion([], 4), [])
  assert.deepEqual(regionAt([], 4, 10000, 3000).items, [])
  assert.equal(regionAt([], 4, 10000, 3000).changes, false)
  assert.equal(regionAt(['Um'], 4, 100000, 3000).changes, false)
  assert.deepEqual(regionAt(['Um', 'Dois', 'Três'], 2, -9999, 3000).items, ['Um', 'Dois'])
  assert.equal(minimumSlotMs(0, 6, 3000), 0)
})

test('invalid capacity, duration, count or clock are rejected', () => {
  for (const capacity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => partitionRegion([1], capacity), RangeError)
    assert.throws(() => regionAt([1], capacity, 0, 3000), RangeError)
    assert.throws(() => minimumSlotMs(1, capacity, 3000), RangeError)
  }
  for (const duration of [0, -100, 2.5, Number.POSITIVE_INFINITY]) {
    assert.throws(() => regionAt([1], 1, 0, duration), RangeError)
    assert.throws(() => minimumSlotMs(1, 1, duration), RangeError)
  }
  assert.throws(() => regionAt([1], 1, Number.NaN, 3000), RangeError)
  assert.throws(() => minimumSlotMs(-1, 1, 3000), RangeError)
})

test('source array stays unchanged; table and offers have independent clocks', () => {
  const table = Object.freeze(Array.from({ length: 30 }, (_, index) => index))
  const offers = Object.freeze(Array.from({ length: 8 }, (_, index) => index + 100))
  assert.deepEqual(regionAt(table, 6, 6000, 3000).items, [12, 13, 14, 15, 16, 17])
  assert.deepEqual(regionAt(offers, 2, 6000, 6000).items, [102, 103])
  assert.equal(table.length, 30)
  assert.equal(offers.length, 8)
})
