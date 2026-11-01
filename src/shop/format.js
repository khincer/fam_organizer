const nio = new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', maximumFractionDigits: 2 })
export function currency(amount) { return nio.format(Number(amount) || 0) }
