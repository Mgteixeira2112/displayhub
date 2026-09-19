import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePageDurationMs, resolveVisibleCount } from '../src/lib/commercialTablePlayerRuntime.ts'

test('usa capacidade padrão de 6 itens em horizontal e 5 em vertical', () => {
  assert.equal(resolveVisibleCount(30, false), 6)
  assert.equal(resolveVisibleCount(30, true), 5)
})

test('listas menores não criam espaços artificiais', () => {
  assert.equal(resolveVisibleCount(4, false), 4)
  assert.equal(resolveVisibleCount(3, true), 3)
})

test('capacidade futura configurada pelo template prevalece sobre o padrão', () => {
  assert.equal(resolveVisibleCount(30, false, 8), 8)
  assert.equal(resolveVisibleCount(30, true, 7), 7)
})

test('divide o tempo disponível entre todas as páginas para completar o ciclo', () => {
  assert.equal(resolvePageDurationMs(20_000, 5), 4_000)
  assert.equal(resolvePageDurationMs(12_000, 3), 4_000)
})

test('tempo de página configurado pode ser usado quando o editor expuser essa opção', () => {
  assert.equal(resolvePageDurationMs(20_000, 5, 3_500), 3_500)
})

test('rejeita capacidades e tempos inválidos', () => {
  assert.throws(() => resolveVisibleCount(-1, false), RangeError)
  assert.throws(() => resolveVisibleCount(10, false, 0), RangeError)
  assert.throws(() => resolvePageDurationMs(0, 2), RangeError)
  assert.throws(() => resolvePageDurationMs(10_000, 0), RangeError)
})
