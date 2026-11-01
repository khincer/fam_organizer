import { mount, flushPromises } from '@vue/test-utils'
import { createFakeSupabase } from '../helpers/fakeSupabase.js'
import { mondayOf } from '../../src/shop/week.js'

const fake = createFakeSupabase()
vi.mock('../../src/supabase.js', () => ({ get supabase() { return fake.client }, supabaseReady: true }))
const { default: ShopList } = await import('../../src/components/ShopList.vue')

const W = mondayOf()
fake.respond('shop_products.select', { data: [
  { id: 'p1', name: 'Leche', photo_path: null, last_price: 6.25, active: true },
  { id: 'p2', name: 'Pan', photo_path: 'p2/x.jpg', last_price: null, active: true },
], error: null })
fake.respond('shop_purchases.select', { data: [
  { id: 'a', product_id: 'p1', week_of: W, checked: false, quantity: 1, unit: null },
  { id: 'b', product_id: 'p2', week_of: W, checked: true, quantity: 2, unit: null, unit_price: 7, supermarket: 'Pali' },
], error: null })
fake.respond('shop_supermarkets.select', { data: [{ id: 's1', name: 'Pali' }], error: null })
fake.respond('rpc.shop_week_summary', { data: { week_total: 14, receipts: [{ supermarket: 'Pali', total: 14, lines: [{ purchase_id: 'b', name: 'Pan', quantity: 2, unit: null, unit_price: 7 }] }] }, error: null })

test('renders the week, both groups, thumbnails and the receipt; check-off writes', async () => {
  const w = mount(ShopList, { props: { user: { id: 'u1' } }, attachTo: document.body })
  await flushPromises()
  expect(w.text()).toContain('Por comprar (1)')
  expect(w.text()).toContain('Comprados (1)')
  expect(w.text()).toContain('Último: C$6.25')
  expect(w.find('img').attributes('src')).toBe('https://cdn.test/shop-products/p2/x.jpg')
  expect(w.text()).toContain('Total de la semana')
  expect(w.find('button[aria-label="Semana siguiente"]').attributes('disabled')).toBeDefined()

  await w.find('.shop-item-main').trigger('click')
  await w.find('[data-supermarket="Pali"]').trigger('click')
  await w.find('.shop-sheet form').trigger('submit')
  await flushPromises()
  const update = fake.calls.find(c => c.table === 'shop_purchases' && c.op === 'update')
  expect(update.payload).toMatchObject({ checked: true, unit_price: 6.25, supermarket: 'Pali' })
  expect(w.text()).toContain('Comprados (2)')
  w.unmount()
  expect(fake.removed).toHaveLength(1)
})
