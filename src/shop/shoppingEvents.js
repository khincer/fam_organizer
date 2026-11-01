const COPY = {
  started: { title: 'Alguien empezó las compras', message: 'Mirá la lista de la semana.' },
  finished: { title: '¡Compras terminadas!', message: 'Ya está todo comprado esta semana.' },
}

const count = (items, checked) => items.filter(i => !!i.checked === checked).length

// Compares the list before and after a check-off. A one-item list going from
// 0 to 1 bought is both a start and a finish; it reports 'finished'.
export function shoppingEvent(before, after) {
  const doneBefore = count(before, true), doneAfter = count(after, true)
  if (doneAfter <= doneBefore) return null
  if (count(before, false) > 0 && count(after, false) === 0) return 'finished'
  if (doneBefore === 0 && doneAfter === 1) return 'started'
  return null
}

export async function notifyShopping(client, event, userId) {
  const copy = COPY[event]
  if (!copy || !client?.functions) return
  try {
    await client.functions.invoke('send-push', { body: { ...copy, url: '/?tab=compras', exclude_user_id: userId } })
  } catch {
    // A failed notification must never fail a check-off.
  }
}
