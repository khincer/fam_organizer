import { shoppingEvent, notifyShopping } from '../../src/shop/shoppingEvents.js'

const it = (id, checked) => ({ id, checked })

test('first item checked starts shopping', () => {
  expect(shoppingEvent([it('a', false), it('b', false)], [it('a', true), it('b', false)])).toBe('started')
})
test('last pending item checked finishes shopping', () => {
  expect(shoppingEvent([it('a', true), it('b', false)], [it('a', true), it('b', true)])).toBe('finished')
})
test('a middle item is no event', () => {
  expect(shoppingEvent([it('a', true), it('b', true), it('c', false), it('d', false)], [it('a', true), it('b', true), it('c', true), it('d', false)])).toBeNull()
})
test('a one-item list reports finished', () => {
  expect(shoppingEvent([it('a', false)], [it('a', true)])).toBe('finished')
})
test('removing the last pending item is not a finish', () => {
  expect(shoppingEvent([it('a', true), it('b', false)], [it('a', true)])).toBeNull()
})
test('notifyShopping sends copy and excludes the sender', async () => {
  const invoke = vi.fn().mockResolvedValue({ data: {}, error: null })
  await notifyShopping({ functions: { invoke } }, 'started', 'u1')
  expect(invoke).toHaveBeenCalledWith('send-push', { body: { title: 'Alguien empezó las compras', message: 'Mirá la lista de la semana.', url: '/?tab=compras', exclude_user_id: 'u1' } })
})
test('notifyShopping swallows errors', async () => {
  const invoke = vi.fn().mockRejectedValue(new Error('down'))
  await expect(notifyShopping({ functions: { invoke } }, 'finished', 'u1')).resolves.toBeUndefined()
})
