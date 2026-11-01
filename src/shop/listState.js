import { currency } from './format.js'

const byName = (a, b) => a.product.name.localeCompare(b.product.name, 'es')
const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function joinItems(rows, productsById) {
  return rows
    .filter(r => productsById.has(r.product_id))
    .map(r => ({ ...r, product: productsById.get(r.product_id) }))
    .sort(byName)
}

export function applyPurchaseChange(items, payload, week, productsById) {
  const { eventType } = payload
  if (eventType === 'DELETE') {
    const id = payload.old?.id
    return items.some(i => i.id === id) ? items.filter(i => i.id !== id) : items
  }
  const row = payload.new
  if (!row || row.week_of !== week) return items
  const existing = items.find(i => i.id === row.id)
  const product = existing?.product || productsById.get(row.product_id)
  if (!product) return items
  const item = { ...row, product }
  return existing ? items.map(i => (i.id === row.id ? item : i)) : [...items, item].sort(byName)
}

export function applyProductChange(items, productRow) {
  if (!items.some(i => i.product_id === productRow.id)) return items
  return items.map(i => (i.product_id === productRow.id ? { ...i, product: productRow } : i)).sort(byName)
}

export function groupItems(items, query) {
  const q = fold(query)
  const visible = q ? items.filter(i => fold(i.product.name).includes(q)) : items
  return { pending: visible.filter(i => !i.checked), done: visible.filter(i => i.checked) }
}

function qty(line) {
  return `×${Number(line.quantity)}${line.unit ? ` ${line.unit}` : ''}`
}

export function receiptText(summary, weekLabelText) {
  const out = [`🛒 ${weekLabelText}`, '']
  for (const r of summary?.receipts || []) {
    out.push(r.supermarket)
    for (const line of r.lines) {
      out.push(`  ${line.name} ${qty(line)} — ${currency(Number(line.unit_price) * Number(line.quantity))}`)
    }
    out.push(`  Subtotal: ${currency(r.total)}`, '')
  }
  out.push(`Total de la semana: ${currency(summary?.week_total)}`)
  return out.join('\n')
}
