import { ref } from 'vue'
import { createFakeSupabase } from '../helpers/fakeSupabase.js'
import { useShopList } from '../../src/composables/useShopList.js'
import { mondayOf, addWeeks } from '../../src/shop/week.js'

const user = ref({ id: 'u1' })
const W = mondayOf()
const products = [{ id: 'p1', name: 'Leche', photo_path: null, last_price: 6, active: true }]
const rows = [{ id: 'a', product_id: 'p1', week_of: W, checked: false, unit_price: null, quantity: 1, unit: null, supermarket: null }]

function setup() {
  const fake = createFakeSupabase()
  fake.respond('shop_products.select', { data: products, error: null })
  fake.respond('shop_purchases.select', { data: rows, error: null })
  fake.respond('rpc.shop_seed_week', { data: true, error: null })
  fake.respond('rpc.shop_week_summary', { data: { week_total: 0, receipts: [] }, error: null })
  const toasts = []
  const list = useShopList({ client: fake.client, user, showToast: (m) => toasts.push(m) })
  return { fake, list, toasts }
}
const deferred = () => { let r; const p = new Promise(res => { r = res }); return { p, resolve: r } }
const form = { unit_price: 6.25, quantity: 2, unit: 'l', supermarket: 'Pali' }

test('load seeds the current week before reading rows', async () => {
  const { fake, list } = setup()
  await list.load()
  const seed = fake.calls.findIndex(c => c.rpc === 'shop_seed_week')
  const read = fake.calls.findIndex(c => c.table === 'shop_purchases' && c.op === 'select')
  expect(seed).toBeGreaterThanOrEqual(0)
  expect(fake.calls[seed].args).toEqual({ p_week: W })
  expect(seed).toBeLessThan(read)
  expect(list.items.value.map(i => i.id)).toEqual(['a'])
})

test('a past week is not seeded', async () => {
  const { fake, list } = setup()
  await list.goToWeek(-1)
  expect(list.week.value).toBe(addWeeks(W, -1))
  expect(fake.calls.some(c => c.rpc === 'shop_seed_week')).toBe(false)
  expect(list.readOnly.value).toBe(true)
})

test('rows still load when another phone seeded first', async () => {
  const { fake, list } = setup()
  fake.respond('rpc.shop_seed_week', { data: false, error: null })
  await list.load()
  expect(list.items.value).toHaveLength(1)
})

test('cannot move past the current week', async () => {
  const { fake, list } = setup()
  await list.goToWeek(1)
  expect(list.week.value).toBe(W)
  expect(fake.calls).toHaveLength(0)
})

test('checkOff updates optimistically and rolls back on error', async () => {
  const { fake, list, toasts } = setup()
  await list.load()
  const d = deferred()
  fake.respond('shop_purchases.update', () => d.p)
  const pending = list.checkOff(list.items.value[0], form)
  expect(list.items.value[0].checked).toBe(true)
  d.resolve({ data: null, error: { message: 'offline' } })
  expect(await pending).toBe(false)
  expect(list.items.value[0].checked).toBe(false)
  expect(toasts).toContain('No pudimos guardar. Revisa tu conexión.')
})

test('a second tap while a write is in flight sends one update', async () => {
  const { fake, list } = setup()
  await list.load()
  const d = deferred()
  fake.respond('shop_purchases.update', () => d.p)
  const item = list.items.value[0]
  const first = list.checkOff(item, form)
  expect(list.pendingIds.value.has('a')).toBe(true)
  expect(await list.checkOff(item, form)).toBe(false)
  d.resolve({ data: null, error: null })
  expect(await first).toBe(true)
  expect(fake.calls.filter(c => c.table === 'shop_purchases' && c.op === 'update')).toHaveLength(1)
  expect(list.pendingIds.value.has('a')).toBe(false)
})

test('checkOff writes the check-off facts and never last_price', async () => {
  const { fake, list } = setup()
  await list.load()
  await list.checkOff(list.items.value[0], form)
  const call = fake.calls.find(c => c.table === 'shop_purchases' && c.op === 'update')
  expect(call.payload).toMatchObject({ checked: true, unit_price: 6.25, quantity: 2, unit: 'l', supermarket: 'Pali', checked_by: 'u1' })
  expect(call.payload.checked_at).toBeTruthy()
  expect(call.payload).not.toHaveProperty('last_price')
  expect(call.filters).toContainEqual(['eq', 'id', 'a'])
})

test('checkOff on a read-only week does nothing', async () => {
  const { fake, list } = setup()
  await list.goToWeek(-1)
  fake.respond('shop_purchases.select', { data: [{ ...rows[0], week_of: addWeeks(W, -1) }], error: null })
  const before = fake.calls.length
  expect(await list.checkOff({ ...rows[0], product: products[0] }, form)).toBe(false)
  expect(fake.calls.length).toBe(before)
})

test('removeFromWeek deletes the row and restores it on error', async () => {
  const { fake, list } = setup()
  await list.load()
  fake.respond('shop_purchases.delete', { data: null, error: { message: 'x' } })
  expect(await list.removeFromWeek(list.items.value[0])).toBe(false)
  expect(list.items.value).toHaveLength(1)
  fake.respond('shop_purchases.delete', { data: null, error: null })
  expect(await list.removeFromWeek(list.items.value[0])).toBe(true)
  expect(list.items.value).toHaveLength(0)
})

test('realtime update from another phone is merged', async () => {
  const { fake, list } = setup()
  await list.load()
  list.start()
  fake.emit('shop_purchases', { eventType: 'UPDATE', new: { ...rows[0], checked: true, unit_price: 6, supermarket: 'Pali' }, old: { id: 'a' } })
  expect(list.items.value[0].checked).toBe(true)
  list.stop()
})

test('stop removes the channel and the visibility listener', async () => {
  const { fake, list } = setup()
  const spy = vi.spyOn(document, 'removeEventListener')
  list.start()
  list.stop()
  expect(fake.removed).toHaveLength(1)
  expect(spy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
})

test('addSupermarket trims, reuses an existing name, and inserts new ones', async () => {
  const { fake, list } = setup()
  fake.respond('shop_supermarkets.select', { data: [{ id: 's1', name: 'Pali' }], error: null })
  await list.load()
  expect(await list.addSupermarket('  pali ')).toEqual({ id: 's1', name: 'Pali' })
  fake.respond('shop_supermarkets.insert', { data: { id: 's2', name: 'La Colonia' }, error: null })
  expect(await list.addSupermarket(' La Colonia ')).toEqual({ id: 's2', name: 'La Colonia' })
  expect(fake.calls.find(c => c.table === 'shop_supermarkets' && c.op === 'insert').payload).toEqual({ name: 'La Colonia' })
  expect(await list.addSupermarket('   ')).toBeNull()
})
