<template>
  <div class="shop">
    <div class="welcome-row">
      <div>
        <p class="eyebrow">LISTA DE LA SEMANA</p>
        <h1>Compras</h1>
        <p class="subtitle">La lista de la semana, entre todos.</p>
      </div>
    </div>

    <p v-if="!supabaseReady" class="panel shop-config">Configuración requerida para usar la lista de compras.</p>

    <template v-else>
      <section class="panel shop-panel">
        <header class="shop-week">
          <button class="shop-icon-button" aria-label="Semana anterior" @click="list.goToWeek(-1)">‹</button>
          <div class="shop-week-label">
            <h2>{{ weekLabel(list.week.value) }}</h2>
            <small>{{ list.readOnly.value ? 'Semana cerrada' : 'Esta semana' }}</small>
          </div>
          <button class="shop-icon-button" aria-label="Semana siguiente" :disabled="!list.readOnly.value" @click="list.goToWeek(1)">›</button>
          <div class="shop-total">
            <small>Total</small>
            <b>{{ currency(list.summary.value?.week_total) }}</b>
          </div>
        </header>

        <div class="shop-toolbar">
          <input v-model="query" class="shop-search" type="search" placeholder="Buscar producto" aria-label="Buscar producto" />
          <slot name="toolbar" :list="list" />
        </div>

        <p v-if="list.loading.value && !list.items.value.length" class="empty-state">Cargando…</p>
        <template v-else>
          <h3 class="shop-group-title">Por comprar ({{ groups.pending.length }})</h3>
          <ul class="shop-items">
            <li v-for="item in groups.pending" :key="item.id" class="shop-item" :class="{ busy: list.pendingIds.value.has(item.id) }">
              <slot name="thumb" :item="item"><span class="shop-thumb" aria-hidden="true">🛒</span></slot>
              <button class="shop-item-main" :disabled="list.readOnly.value" @click="openCheckoff(item)">
                <b>{{ item.product.name }}</b>
                <small>{{ qty(item) }}<template v-if="item.product.last_price != null"> · Último: {{ currency(item.product.last_price) }}</template></small>
              </button>
              <div v-if="!list.readOnly.value" class="shop-menu">
                <button class="shop-icon-button" :aria-label="`Opciones de ${item.product.name}`" @click="menuFor = menuFor === item.id ? null : item.id">···</button>
                <div v-if="menuFor === item.id" class="shop-menu-pop" role="menu">
                  <button role="menuitem" @click="openQuantity(item)">Cambiar cantidad</button>
                  <button role="menuitem" @click="remove(item)">Quitar de esta semana</button>
                </div>
              </div>
            </li>
          </ul>
          <p v-if="!groups.pending.length" class="empty-state">{{ list.items.value.length ? 'Nada pendiente.' : 'La lista de esta semana está vacía.' }}</p>

          <h3 class="shop-group-title">Comprados ({{ groups.done.length }})</h3>
          <ul class="shop-items">
            <li v-for="item in groups.done" :key="item.id" class="shop-item done" :class="{ busy: list.pendingIds.value.has(item.id) }">
              <slot name="thumb" :item="item"><span class="shop-thumb" aria-hidden="true">✓</span></slot>
              <button class="shop-item-main" :disabled="list.readOnly.value" @click="confirmUncheck(item)">
                <b>{{ item.product.name }}</b>
                <small>{{ qty(item) }} · {{ currency(item.unit_price) }} c/u · {{ item.supermarket }}</small>
              </button>
            </li>
          </ul>
        </template>
      </section>

      <slot name="after" :list="list" />
    </template>

    <ShopCheckoffSheet v-if="checkoffItem" :item="checkoffItem" :supermarkets="list.supermarkets.value"
      :defaultSupermarket="lastSupermarket" @close="checkoffItem = null"
      @add-supermarket="list.addSupermarket" @save="saveCheckoff" />

    <div v-if="quantityItem" class="modal-backdrop" @click.self="quantityItem = null">
      <section class="modal shop-sheet" role="dialog" aria-modal="true" aria-labelledby="qty-title">
        <button class="modal-close" aria-label="Cerrar" @click="quantityItem = null">×</button>
        <h2 id="qty-title">{{ quantityItem.product.name }}</h2>
        <form @submit.prevent="saveQuantity">
          <div class="form-row">
            <label>Cantidad<input v-model="quantityForm.quantity" type="number" min="0.01" step="0.01" required /></label>
            <label>Unidad<input v-model="quantityForm.unit" placeholder="Ej. kg" /></label>
          </div>
          <button class="shop-submit primary-button submit-button" type="submit">Guardar</button>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, toRef } from 'vue'
import { supabaseReady } from '../supabase.js'
import { useShopList } from '../composables/useShopList.js'
import { weekLabel } from '../shop/week.js'
import { groupItems } from '../shop/listState.js'
import { currency } from '../shop/format.js'
import ShopCheckoffSheet from './ShopCheckoffSheet.vue'

const props = defineProps({ user: { type: Object, default: null } })
const emit = defineEmits(['toast'])
const list = useShopList({ user: toRef(props, 'user'), showToast: (m) => emit('toast', m) })
defineExpose({ list })

const LAST_KEY = 'shop:lastSupermarket'
const readLast = () => { try { return localStorage.getItem(LAST_KEY) } catch { return null } }
const writeLast = (v) => { try { localStorage.setItem(LAST_KEY, v) } catch { /* storage unavailable */ } }

const query = ref('')
const menuFor = ref(null)
const checkoffItem = ref(null)
const quantityItem = ref(null)
const quantityForm = reactive({ quantity: 1, unit: '' })
const lastSupermarket = ref(readLast())
const groups = computed(() => groupItems(list.items.value, query.value))

const qty = (item) => `${Number(item.quantity)}${item.unit ? ` ${item.unit}` : ''}`

function openCheckoff(item) { menuFor.value = null; checkoffItem.value = item }

async function saveCheckoff(form) {
  const item = checkoffItem.value
  checkoffItem.value = null
  lastSupermarket.value = form.supermarket
  writeLast(form.supermarket)
  await list.checkOff(item, form)
}

function confirmUncheck(item) {
  if (window.confirm(`¿Desmarcar ${item.product.name}?`)) list.uncheck(item)
}

function openQuantity(item) {
  menuFor.value = null
  quantityForm.quantity = Number(item.quantity)
  quantityForm.unit = item.unit || ''
  quantityItem.value = item
}

async function saveQuantity() {
  const item = quantityItem.value
  quantityItem.value = null
  await list.updateQuantity(item, { ...quantityForm })
}

function remove(item) {
  menuFor.value = null
  if (window.confirm(`¿Quitar ${item.product.name} de la lista de esta semana?`)) list.removeFromWeek(item)
}

onMounted(() => { if (supabaseReady) { list.load(); list.start() } })
onUnmounted(() => list.stop())
</script>
