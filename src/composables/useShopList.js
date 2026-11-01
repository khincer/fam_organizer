import { computed, ref, unref } from 'vue'
import { supabase } from '../supabase.js'
import { mondayOf, addWeeks, isCurrentWeek } from '../shop/week.js'
import { joinItems, applyPurchaseChange, applyProductChange } from '../shop/listState.js'
import { PHOTO_BUCKET, compressImage, photoPath } from '../shop/photos.js'

const SAVE_ERROR = 'No pudimos guardar. Revisa tu conexión.'
const PHOTO_ERROR = 'No pudimos subir la foto. Inténtalo de nuevo.'
const LOAD_ERROR = 'No pudimos cargar la lista. Inténtalo de nuevo.'
const fold = (s) => (s || '').trim().toLowerCase()

export function useShopList({ client = supabase, user, showToast = () => {} } = {}) {
  const week = ref(mondayOf())
  const items = ref([])
  const products = ref([])
  const supermarkets = ref([])
  const summary = ref(null)
  const loading = ref(false)
  const pendingIds = ref(new Set())
  const readOnly = computed(() => !isCurrentWeek(week.value))
  const productsById = computed(() => new Map(products.value.map(p => [p.id, p])))

  let channel = null
  let summaryTimer = null
  let started = false

  async function refreshSummary() {
    const target = week.value
    const { data, error } = await client.rpc('shop_week_summary', { p_week: target })
    if (!error && target === week.value) summary.value = data
  }

  function scheduleSummary() {
    clearTimeout(summaryTimer)
    summaryTimer = setTimeout(refreshSummary, 300)
  }

  async function load() {
    if (!client) return
    const target = week.value
    loading.value = true
    try {
      if (!readOnly.value) {
        const { error } = await client.rpc('shop_seed_week', { p_week: target })
        if (error) showToast(LOAD_ERROR)
      }
      const [prod, rows, markets, sum] = await Promise.all([
        client.from('shop_products').select('*').order('name'),
        client.from('shop_purchases').select('*').eq('week_of', target),
        client.from('shop_supermarkets').select('*').order('name'),
        client.rpc('shop_week_summary', { p_week: target }),
      ])
      if (target !== week.value) return
      const error = prod.error || rows.error || markets.error
      if (error) { showToast(LOAD_ERROR); return }
      products.value = prod.data || []
      supermarkets.value = markets.data || []
      items.value = joinItems(rows.data || [], productsById.value)
      if (!sum.error) summary.value = sum.data
    } finally {
      loading.value = false
    }
  }

  async function goToWeek(delta) {
    const target = addWeeks(week.value, delta)
    if (target > mondayOf()) return
    week.value = target
    items.value = []
    summary.value = null
    if (started) { stop(); start() }
    await load()
  }

  function setPending(id, on) {
    const next = new Set(pendingIds.value)
    on ? next.add(id) : next.delete(id)
    pendingIds.value = next
  }

  // Applies `patch` locally, sends the write, and puts the old item back if it fails.
  async function optimisticUpdate(item, patch) {
    if (readOnly.value || pendingIds.value.has(item.id)) return false
    const previous = items.value.find(i => i.id === item.id)
    if (!previous) return false
    setPending(item.id, true)
    items.value = items.value.map(i => (i.id === item.id ? { ...i, ...patch } : i))
    try {
      const { error } = await client.from('shop_purchases').update(patch).eq('id', item.id)
      if (error) {
        items.value = items.value.map(i => (i.id === item.id ? previous : i))
        showToast(SAVE_ERROR)
        return false
      }
      scheduleSummary()
      return true
    } finally {
      setPending(item.id, false)
    }
  }

  function checkOff(item, { unit_price, quantity, unit, supermarket }) {
    return optimisticUpdate(item, {
      checked: true,
      unit_price: Number(unit_price),
      quantity: Number(quantity),
      unit: unit || null,
      supermarket,
      checked_by: unref(user)?.id,
      checked_at: new Date().toISOString(),
    })
  }

  function uncheck(item) {
    return optimisticUpdate(item, { checked: false })
  }

  function updateQuantity(item, { quantity, unit }) {
    return optimisticUpdate(item, { quantity: Number(quantity), unit: unit || null })
  }

  async function removeFromWeek(item) {
    if (readOnly.value || pendingIds.value.has(item.id)) return false
    const before = items.value
    setPending(item.id, true)
    items.value = items.value.filter(i => i.id !== item.id)
    try {
      const { error } = await client.from('shop_purchases').delete().eq('id', item.id)
      if (error) { items.value = before; showToast(SAVE_ERROR); return false }
      scheduleSummary()
      return true
    } finally {
      setPending(item.id, false)
    }
  }

  async function addSupermarket(name) {
    const clean = (name || '').trim()
    if (!clean) return null
    const existing = supermarkets.value.find(s => fold(s.name) === fold(clean))
    if (existing) return existing
    const { data, error } = await client.from('shop_supermarkets').insert({ name: clean }).select().single()
    if (error) { showToast(SAVE_ERROR); return null }
    mergeSupermarket(data)
    return data
  }

  async function addProduct(name) {
    const clean = (name || '').trim()
    if (!clean) return null
    const { data: product, error } = await client.from('shop_products').insert({ name: clean }).select().single()
    if (error) { showToast(SAVE_ERROR); return null }
    mergeProduct(product)
    if (!readOnly.value) {
      const { data: row, error: rowError } = await client.from('shop_purchases')
        .insert({ product_id: product.id, week_of: week.value }).select().single()
      if (rowError) showToast(SAVE_ERROR)
      else onPurchase({ eventType: 'INSERT', new: row })
    }
    return product
  }

  async function updateProduct(product, patch) {
    const { error } = await client.from('shop_products').update(patch).eq('id', product.id)
    if (error) { showToast(SAVE_ERROR); return false }
    mergeProduct({ ...(productsById.value.get(product.id) || product), ...patch })
    return true
  }

  function renameProduct(product, name) {
    const clean = (name || '').trim()
    if (!clean) return Promise.resolve(false)
    return updateProduct(product, { name: clean })
  }

  function setProductActive(product, active) {
    return updateProduct(product, { active })
  }

  async function setProductPhoto(product, file, { compress = compressImage } = {}) {
    let blob
    try { blob = await compress(file) } catch { showToast(PHOTO_ERROR); return false }
    const path = photoPath(product.id)
    const bucket = client.storage.from(PHOTO_BUCKET)
    const { error } = await bucket.upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) { showToast(PHOTO_ERROR); return false }
    const saved = await updateProduct(product, { photo_path: path })
    // Members have no delete policy on storage, so this cleanup is best effort.
    if (!saved) await bucket.remove([path]).catch(() => {})
    return saved
  }

  function mergeSupermarket(row) {
    const rest = supermarkets.value.filter(s => s.id !== row.id)
    supermarkets.value = [...rest, row].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }

  function mergeProduct(row) {
    const exists = products.value.some(p => p.id === row.id)
    products.value = exists ? products.value.map(p => (p.id === row.id ? row : p)) : [...products.value, row]
    items.value = applyProductChange(items.value, row)
  }

  function onPurchase(payload) {
    const next = applyPurchaseChange(items.value, payload, week.value, productsById.value)
    if (next !== items.value) { items.value = next; scheduleSummary() }
  }

  function onVisible() {
    if (document.visibilityState === 'visible') load()
  }

  function start() {
    if (!client || channel) return
    started = true
    channel = client.channel(`shop:${week.value}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_purchases', filter: `week_of=eq.${week.value}` }, onPurchase)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'shop_purchases' }, onPurchase)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_products' }, ({ eventType, new: row }) => { if (eventType !== 'DELETE') mergeProduct(row) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_supermarkets' }, ({ eventType, new: row, old }) => {
        if (eventType === 'DELETE') supermarkets.value = supermarkets.value.filter(s => s.id !== old.id)
        else mergeSupermarket(row)
      })
      .subscribe()
    document.addEventListener('visibilitychange', onVisible)
  }

  function stop() {
    if (channel) client.removeChannel(channel)
    channel = null
    started = false
    clearTimeout(summaryTimer)
    document.removeEventListener('visibilitychange', onVisible)
  }

  return {
    week, readOnly, items, products, supermarkets, summary, loading, pendingIds,
    load, goToWeek, checkOff, uncheck, updateQuantity, removeFromWeek, addSupermarket,
    addProduct, renameProduct, setProductActive, setProductPhoto,
    start, stop, refreshSummary,
  }
}
