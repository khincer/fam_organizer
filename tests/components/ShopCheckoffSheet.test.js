import { mount } from '@vue/test-utils'
import ShopCheckoffSheet from '../../src/components/ShopCheckoffSheet.vue'

const item = { id: 'a', quantity: 1, unit: null, product: { id: 'p1', name: 'Leche', last_price: 6.25 } }
const supermarkets = [{ id: 's1', name: 'Pali' }, { id: 's2', name: 'La Colonia' }]
const mk = (props = {}) => mount(ShopCheckoffSheet, { props: { item, supermarkets, defaultSupermarket: 'Pali', ...props } })

test('prefills price from last_price and the default supermarket', () => {
  const w = mk()
  expect(w.find('input[name="price"]').element.value).toBe('6.25')
  expect(w.find('[data-supermarket="Pali"]').classes()).toContain('selected')
})

test('save is disabled until price and supermarket are set', async () => {
  const w = mk({ item: { ...item, product: { ...item.product, last_price: null } }, defaultSupermarket: null })
  const save = () => w.find('button[type="submit"]')
  expect(save().attributes('disabled')).toBeDefined()
  await w.find('input[name="price"]').setValue('5')
  expect(save().attributes('disabled')).toBeDefined()
  await w.find('[data-supermarket="La Colonia"]').trigger('click')
  expect(save().attributes('disabled')).toBeUndefined()
  await w.find('input[name="price"]').setValue('-1')
  expect(save().attributes('disabled')).toBeDefined()
})

test('save emits numbers', async () => {
  const w = mk()
  await w.find('input[name="quantity"]').setValue('2')
  await w.find('input[name="unit"]').setValue('l')
  await w.find('form').trigger('submit')
  expect(w.emitted('save')[0][0]).toEqual({ unit_price: 6.25, quantity: 2, unit: 'l', supermarket: 'Pali' })
})

test('typing a new supermarket offers to add it', async () => {
  const w = mk()
  await w.find('input[name="new-supermarket"]').setValue('  Maxi Palí ')
  const add = w.find('[data-action="add-supermarket"]')
  expect(add.text()).toBe('Agregar "Maxi Palí"')
  await add.trigger('click')
  expect(w.emitted('add-supermarket')[0][0]).toBe('Maxi Palí')
})

test('an existing name is not offered as new', async () => {
  const w = mk()
  await w.find('input[name="new-supermarket"]').setValue('pali')
  expect(w.find('[data-action="add-supermarket"]').exists()).toBe(false)
})
