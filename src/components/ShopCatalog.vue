<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="modal shop-catalog" role="dialog" aria-modal="true" aria-labelledby="catalog-title">
      <button class="modal-close" aria-label="Cerrar" @click="$emit('close')">×</button>
      <p class="eyebrow">LO QUE SIEMPRE COMPRAMOS</p>
      <h2 id="catalog-title">Productos</h2>

      <form class="shop-new-market" @submit.prevent="add">
        <input v-model="newName" placeholder="Nuevo producto" aria-label="Nuevo producto" />
        <button class="shop-secondary" type="submit" :disabled="!newName.trim() || adding">Agregar</button>
      </form>

      <h3 class="shop-group-title">Activos ({{ active.length }})</h3>
      <ul class="shop-items">
        <li v-for="p in active" :key="p.id" class="shop-item">
          <slot name="thumb" :product="p"><span class="shop-thumb" aria-hidden="true">🛒</span></slot>
          <div class="shop-item-main" v-if="editing !== p.id">
            <b>{{ p.name }}</b>
            <small v-if="p.last_price != null">Último: {{ currency(p.last_price) }}</small>
          </div>
          <form v-else class="shop-rename" @submit.prevent="saveRename(p)">
            <input v-model="editName" :aria-label="`Nuevo nombre de ${p.name}`" />
            <button class="text-button" type="submit">Guardar</button>
          </form>
          <slot name="actions" :product="p" />
          <button v-if="editing !== p.id" class="text-button" @click="startRename(p)">Renombrar</button>
          <button class="text-button" @click="$emit('set-active', p, false)">Desactivar</button>
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

const props = defineProps({ products: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'add', 'rename', 'set-active'])

const byName = (a, b) => a.name.localeCompare(b.name, 'es')
const active = computed(() => props.products.filter(p => p.active).sort(byName))
const inactive = computed(() => props.products.filter(p => !p.active).sort(byName))

const newName = ref('')
const adding = ref(false)
const editing = ref(null)
const editName = ref('')

function add() {
  if (!newName.value.trim()) return
  emit('add', newName.value)
  newName.value = ''
}

function startRename(p) { editing.value = p.id; editName.value = p.name }
function saveRename(p) {
  if (editName.value.trim() && editName.value.trim() !== p.name) emit('rename', p, editName.value)
  editing.value = null
}
</script>
