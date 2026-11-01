<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="modal shop-catalog" role="dialog" aria-modal="true" aria-labelledby="catalog-title">
      <button class="modal-close" aria-label="Cerrar" @click="$emit('close')">×</button>
      <p class="eyebrow">LO QUE SIEMPRE COMPRAMOS</p>
      <h2 id="catalog-title">Productos</h2>

      <form class="shop-new-market" @submit.prevent="add">
        <input v-model="newName" placeholder="Nuevo producto" aria-label="Nuevo producto" />
        <button class="shop-secondary" type="submit" :disabled="!newName.trim()">Agregar</button>
      </form>

      <h3 class="shop-group-title">Activos ({{ active.length }})</h3>
      <ul class="shop-items">
        <li v-for="p in active" :key="p.id" class="shop-item">
          <ShopThumb :product="p" />
          <button class="shop-item-main" v-if="editing !== p.id" :aria-expanded="historyFor === p.id" @click="toggleHistory(p)">
            <b>{{ p.name }}</b>
            <small v-if="p.last_price != null">Último: {{ currency(p.last_price) }}</small>
          </button>
          <form v-else class="shop-rename" @submit.prevent="saveRename(p)">
            <input v-model="editName" :aria-label="`Nuevo nombre de ${p.name}`" />
            <button class="text-button" type="submit">Guardar</button>
          </form>
          <label class="text-button shop-photo-button">Foto
            <input type="file" accept="image/*" capture="environment" class="visually-hidden" @change="onPhoto(p, $event)" />
          </label>
          <button v-if="editing !== p.id" class="text-button" @click="startRename(p)">Renombrar</button>
          <button class="text-button" @click="$emit('set-active', p, false)">Desactivar</button>
          <ul v-if="historyFor === p.id" class="shop-history">
            <li v-if="!history.length">Sin compras registradas.</li>
            <li v-for="h in history" :key="h.week_of + h.supermarket"><span>{{ weekLabel(h.week_of) }} · {{ h.supermarket }}</span><b>{{ currency(h.unit_price) }}</b></li>
          </ul>
        </li>
      </ul>
      <p v-if="!active.length" class="empty-state">Todavía no hay productos.</p>

      <template v-if="inactive.length">
        <h3 class="shop-group-title">Inactivos ({{ inactive.length }})</h3>
        <ul class="shop-items">
          <li v-for="p in inactive" :key="p.id" class="shop-item done">
            <div class="shop-item-main"><b>{{ p.name }}</b></div>
            <button class="text-button" @click="$emit('set-active', p, true)">Reactivar</button>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { currency } from '../shop/format.js'
import ShopThumb from './ShopThumb.vue'
import { weekLabel } from '../shop/week.js'

const props = defineProps({
  products: { type: Array, default: () => [] },
  priceHistory: { type: Function, default: async () => [] },
})
const emit = defineEmits(['close', 'add', 'rename', 'set-active', 'photo'])

const byName = (a, b) => a.name.localeCompare(b.name, 'es')
const active = computed(() => props.products.filter(p => p.active).sort(byName))
const inactive = computed(() => props.products.filter(p => !p.active).sort(byName))

const newName = ref('')
const editing = ref(null)
const editName = ref('')

function add() {
  if (!newName.value.trim()) return
  emit('add', newName.value)
  newName.value = ''
}

function onPhoto(p, event) {
  const file = event.target.files?.[0]
  if (file) emit('photo', p, file)
  event.target.value = ''
}

const historyFor = ref(null)
const history = ref([])
async function toggleHistory(p) {
  if (historyFor.value === p.id) { historyFor.value = null; return }
  history.value = []
  historyFor.value = p.id
  const rows = await props.priceHistory(p.id)
  if (historyFor.value === p.id) history.value = rows
}

function startRename(p) { editing.value = p.id; editName.value = p.name }
function saveRename(p) {
  if (editName.value.trim() && editName.value.trim() !== p.name) emit('rename', p, editName.value)
  editing.value = null
}
</script>
