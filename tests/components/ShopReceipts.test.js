import { mount, flushPromises } from '@vue/test-utils'
import ShopReceipts from '../../src/components/ShopReceipts.vue'
import { receiptText } from '../../src/shop/listState.js'

const summary = {
  week_total: 20,
  receipts: [
    { supermarket: 'La Colonia', total: 7.5, lines: [{ purchase_id: 'x', name: 'Pan', quantity: 1, unit: null, unit_price: 7.5 }] },
    { supermarket: 'Pali', total: 12.5, lines: [{ purchase_id: 'y', name: 'Leche', quantity: 2, unit: 'l', unit_price: 6.25 }] },
  ],
}

afterEach(() => { delete navigator.share; delete navigator.clipboard })

test('renders one card per supermarket in order', () => {
  const w = mount(ShopReceipts, { props: { summary, week: '2026-10-26' } })
  const cards = w.findAll('.shop-receipt')
  expect(cards).toHaveLength(2)
  expect(cards[0].text()).toContain('La Colonia')
  expect(cards[1].text()).toContain('Leche ×2 l')
  expect(w.text()).toContain('Total de la semana')
  expect(w.text()).toContain('C$20.00')
})

test('share falls back to the clipboard', async () => {
  const writeText = vi.fn().mockResolvedValue()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const w = mount(ShopReceipts, { props: { summary, week: '2026-10-26' } })
  await w.find('[data-action="share"]').trigger('click')
  await flushPromises()
  expect(writeText).toHaveBeenCalledWith(receiptText(summary, 'Semana del 26 oct'))
  expect(w.emitted('toast')[0][0]).toBe('Recibo copiado')
})

test('share uses the Web Share API when available', async () => {
  const share = vi.fn().mockResolvedValue()
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  const w = mount(ShopReceipts, { props: { summary, week: '2026-10-26' } })
  await w.find('[data-action="share"]').trigger('click')
  expect(share).toHaveBeenCalledWith({ text: receiptText(summary, 'Semana del 26 oct') })
})

test('empty receipts show the empty state and no share button', () => {
  const w = mount(ShopReceipts, { props: { summary: { week_total: 0, receipts: [] }, week: '2026-10-26' } })
  expect(w.text()).toContain('Todavía no hay compras esta semana.')
  expect(w.find('[data-action="share"]').exists()).toBe(false)
})
