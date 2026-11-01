import { joinItems, applyPurchaseChange, applyProductChange, groupItems, receiptText } from '../../src/shop/listState.js'

const W = '2026-10-26'
const products = new Map([
  ['p1', { id: 'p1', name: 'Leche', photo_path: null, last_price: 6, active: true }],
  ['p2', { id: 'p2', name: 'Café', photo_path: null, last_price: 90, active: true }],
])
const row = (id, product_id, extra = {}) => ({ id, product_id, week_of: W, checked: false, unit_price: null, quantity: 1, unit: null, supermarket: null, checked_at: null, ...extra })
const base = () => joinItems([row('a', 'p1'), row('b', 'p2')], products)

test('joinItems attaches products and sorts by name', () => {
  const items = base()
  expect(items.map(i => i.product.name)).toEqual(['Café', 'Leche'])
})

test('change for another week returns the same array', () => {
  const items = base()
  expect(applyPurchaseChange(items, { eventType: 'INSERT', new: { ...row('c', 'p1'), week_of: '2026-10-19' }, old: {} }, W, products)).toBe(items)
})

test('update replaces the row by id and keeps its product', () => {
  const next = applyPurchaseChange(base(), { eventType: 'UPDATE', new: row('a', 'p1', { checked: true, unit_price: 6 }), old: { id: 'a' } }, W, products)
  const a = next.find(i => i.id === 'a')
  expect(a.checked).toBe(true)
  expect(a.product.name).toBe('Leche')
})

test('delete removes a known id', () => {
  const next = applyPurchaseChange(base(), { eventType: 'DELETE', new: {}, old: { id: 'a' } }, W, products)
  expect(next.map(i => i.id)).toEqual(['b'])
})

test('delete with unknown id returns the same array', () => {
  const items = base()
  expect(applyPurchaseChange(items, { eventType: 'DELETE', new: {}, old: { id: 'zzz' } }, W, products)).toBe(items)
})

test('insert with an existing id replaces instead of duplicating', () => {
  const next = applyPurchaseChange(base(), { eventType: 'INSERT', new: row('a', 'p1', { quantity: 3 }), old: {} }, W, products)
  expect(next.filter(i => i.id === 'a')).toHaveLength(1)
  expect(next.find(i => i.id === 'a').quantity).toBe(3)
})

test('insert for an unknown product is ignored', () => {
  const items = base()
  expect(applyPurchaseChange(items, { eventType: 'INSERT', new: row('c', 'nope'), old: {} }, W, products)).toBe(items)
})

test('applyProductChange updates last_price on matching items', () => {
  const next = applyProductChange(base(), { id: 'p1', name: 'Leche', photo_path: null, last_price: 7, active: true })
  expect(next.find(i => i.id === 'a').product.last_price).toBe(7)
})

test('groupItems matches accent-insensitively and splits checked', () => {
  const items = applyPurchaseChange(base(), { eventType: 'UPDATE', new: row('a', 'p1', { checked: true }), old: { id: 'a' } }, W, products)
  expect(groupItems(items, 'cafe').pending.map(i => i.id)).toEqual(['b'])
  const all = groupItems(items, '')
  expect(all.done.map(i => i.id)).toEqual(['a'])
  expect(all.pending.map(i => i.id)).toEqual(['b'])
})

test('receiptText lists supermarkets, lines and total', () => {
  const text = receiptText({ week_total: 12.5, receipts: [{ supermarket: 'Pali', total: 12.5, lines: [{ name: 'Leche', quantity: 2, unit: 'l', unit_price: 6.25 }] }] }, 'Semana del 26 oct')
  expect(text).toContain('Semana del 26 oct')
  expect(text).toContain('Pali')
  expect(text).toContain('Leche ×2 l')
  expect(text).toContain('C$12.50')
  expect(text).toContain('Total de la semana')
})
