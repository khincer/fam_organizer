const pad = (n) => String(n).padStart(2, '0')
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromKey = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12) }

export function mondayOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toKey(d)
}

export function addWeeks(week, n) {
  const d = fromKey(week)
  d.setDate(d.getDate() + n * 7)
  return toKey(d)
}

export function isCurrentWeek(week, now = new Date()) {
  return week === mondayOf(now)
}

export function weekLabel(week) {
  const d = fromKey(week)
  const month = d.toLocaleDateString('es-NI', { month: 'short' }).replace('.', '')
  return `Semana del ${d.getDate()} ${month}`
}
