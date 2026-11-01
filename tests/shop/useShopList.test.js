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

describe('catalog', () => {
  const pan = { id: 'p2', name: 'Pan', photo_path: null, last_price: null, active: true }

  test('addProduct in the current week also adds it to this week', async () => {
    const { fake, list } = setup()
    await list.load()
    fake.respond('shop_products.insert', { data: pan, error: null })
    fake.respond('shop_purchases.insert', { data: { id: 'b', product_id: 'p2', week_of: W, checked: false, quantity: 1 }, error: null })
    expect(await list.addProduct('  Pan ')).toEqual(pan)
    expect(fake.calls.find(c => c.table === 'shop_products' && c.op === 'insert').payload).toEqual({ name: 'Pan' })
    expect(fake.calls.find(c => c.table === 'shop_purchases' && c.op === 'insert').payload).toEqual({ product_id: 'p2', week_of: W })
    expect(list.items.value.map(i => i.product.name)).toEqual(['Leche', 'Pan'])
    expect(list.products.value.some(p => p.id === 'p2')).toBe(true)
  })

  test('addProduct in a past week only creates the product', async () => {
    const { fake, list } = setup()
    await list.goToWeek(-1)
    fake.respond('shop_products.insert', { data: pan, error: null })
    await list.addProduct('Pan')
    expect(fake.calls.some(c => c.table === 'shop_purchases' && c.op === 'insert')).toBe(false)
  })

  test('addProduct with a blank name does nothing', async () => {
    const { fake, list } = setup()
    expect(await list.addProduct('   ')).toBeNull()
    expect(fake.calls).toHaveLength(0)
  })

  test('renameProduct updates only the name', async () => {
    const { fake, list } = setup()
    await list.load()
    expect(await list.renameProduct(products[0], ' Leche entera ')).toBe(true)
    const call = fake.calls.find(c => c.table === 'shop_products' && c.op === 'update')
    expect(call.payload).toEqual({ name: 'Leche entera' })
    expect(list.items.value[0].product.name).toBe('Leche entera')
  })

  test('setProductActive(false) leaves this week alone', async () => {
    const { fake, list } = setup()
    await list.load()
    expect(await list.setProductActive(products[0], false)).toBe(true)
    expect(fake.calls.find(c => c.table === 'shop_products' && c.op === 'update').payload).toEqual({ active: false })
    expect(fake.calls.some(c => c.table === 'shop_purchases' && c.op !== 'select')).toBe(false)
    expect(list.items.value).toHaveLength(1)
  })
})

describe('photos', () => {
  const file = new Blob(['x'], { type: 'image/jpeg' })
  const compress = async () => new Blob(['small'], { type: 'image/jpeg' })

  test('setProductPhoto uploads to a new path without upsert, then saves photo_path', async () => {
    const { fake, list } = setup()
    await list.load()
    expect(await list.setProductPhoto(products[0], file, { compress })).toBe(true)
    expect(await list.setProductPhoto(products[0], file, { compress })).toBe(true)
    const uploads = fake.calls.filter(c => c.storage === 'upload')
    expect(uploads).toHaveLength(2)
    expect(uploads[0].bucket).toBe('shop-products')
    expect(uploads[0].args[0]).not.toBe(uploads[1].args[0])
    expect(uploads.every(u => u.args[2].upsert === false)).toBe(true)
    const update = fake.calls.find(c => c.table === 'shop_products' && c.op === 'update')
    expect(update.payload).toEqual({ photo_path: uploads[0].args[0] })
  })

  test('a failed photo_path update removes the uploaded object', async () => {
    const { fake, list } = setup()
    await list.load()
    fake.respond('shop_products.update', { data: null, error: { message: 'x' } })
    expect(await list.setProductPhoto(products[0], file, { compress })).toBe(false)
    const up = fake.calls.find(c => c.storage === 'upload')
    expect(fake.calls.find(c => c.storage === 'remove').args[0]).toEqual([up.args[0]])
  })

  test('a failed upload does not touch the product', async () => {
    const { fake, list, toasts } = setup()
    await list.load()
    fake.respond('storage.upload', { data: null, error: { message: 'x' } })
    expect(await list.setProductPhoto(products[0], file, { compress })).toBe(false)
    expect(fake.calls.some(c => c.table === 'shop_products' && c.op === 'update')).toBe(false)
    expect(toasts).toContain('No pudimos subir la foto. Inténtalo de nuevo.')
  })
})

describe('trends', () => {
  test('weeklyTotals asks for 8 weeks', async () => {
    const { fake, list } = setup()
    fake.respond('rpc.shop_weekly_totals', { data: [{ week_of: W, total: 10 }], error: null })
    expect(await list.weeklyTotals()).toEqual([{ week_of: W, total: 10 }])
    expect(fake.calls.find(c => c.rpc === 'shop_weekly_totals').args).toEqual({ p_weeks: 8 })
  })

  test('priceHistory reads checked rows for the product, newest first, 12 max', async () => {
    const { fake, list } = setup()
    fake.respond('shop_purchases.select', { data: [{ week_of: W, unit_price: 6, supermarket: 'Pali' }], error: null })
    expect(await list.priceHistory('p1')).toEqual([{ week_of: W, unit_price: 6, supermarket: 'Pali' }])
    const call = fake.calls.find(c => c.table === 'shop_purchases')
    expect(call.filters).toEqual(expect.arrayContaining([['eq', 'product_id', 'p1'], ['eq', 'checked', true]]))
    expect(call.order).toEqual(['week_of', { ascending: false }])
    expect(call.limit).toBe(12)
  })

  test('trend queries return [] on error', async () => {
    const { fake, list } = setup()
    fake.respond('rpc.shop_weekly_totals', { data: null, error: { message: 'x' } })
    expect(await list.weeklyTotals()).toEqual([])
  })
})

describe('shopping notifications', () => {
  test('checking off the only item sends a finished notification', async () => {
    const { fake, list } = setup()
    await list.load()
    await list.checkOff(list.items.value[0], form)
    await new Promise(r => setTimeout(r, 0))
    const call = fake.calls.find(c => c.invoke === 'send-push')
    expect(call.opts.body).toMatchObject({ title: '¡Compras terminadas!', exclude_user_id: 'u1' })
  })

  test('a failed check-off sends nothing', async () => {
    const { fake, list } = setup()
    await list.load()
    fake.respond('shop_purchases.update', { data: null, error: { message: 'x' } })
    await list.checkOff(list.items.value[0], form)
    expect(fake.calls.some(c => c.invoke)).toBe(false)
  })
})
