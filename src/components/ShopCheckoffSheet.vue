<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="modal shop-sheet" role="dialog" aria-modal="true" aria-labelledby="checkoff-title">
      <button class="modal-close" aria-label="Cerrar" @click="$emit('close')">×</button>
      <p class="eyebrow">YA ESTÁ EN EL CARRITO</p>
      <h2 id="checkoff-title">{{ item.product.name }}</h2>
      <form @submit.prevent="save">
        <div class="form-row">
          <label>Precio unitario (C$)
            <input name="price" v-model="price" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" required />
          </label>
          <label>Cantidad
            <input name="quantity" v-model="quantity" type="number" inputmode="decimal" min="0.01" step="0.01" required />
          </label>
        </div>
        <label>Unidad (opcional)
          <input name="unit" v-model="unit" placeholder="Ej. kg, l, paquete" />
        </label>
        <fieldset class="shop-markets">
          <legend>Supermercado</legend>
          <div class="shop-chips">
            <button v-for="s in supermarkets" :key="s.id" type="button" class="shop-chip"
              :class="{ selected: s.name === supermarket }" :data-supermarket="s.name"
              :aria-pressed="s.name === supermarket" @click="supermarket = s.name">{{ s.name }}</button>
          </div>
          <div class="shop-new-market">
            <input name="new-supermarket" v-model="newName" placeholder="Otro supermercado" aria-label="Otro supermercado" />
            <button v-if="canAdd" type="button" class="text-button" data-action="add-supermarket" @click="add">Agregar "{{ cleanNew }}"</button>
          </div>
        </fieldset>
        <button class="shop-submit primary-button submit-button" type="submit" :disabled="!valid">Guardar <span aria-hidden="true">✓</span></button>
      </form>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  item: { type: Object, required: true },
  supermarkets: { type: Array, default: () => [] },
  defaultSupermarket: { type: String, default: null },
})
const emit = defineEmits(['save', 'add-supermarket', 'close'])

const price = ref(props.item.product.last_price ?? '')
const quantity = ref(props.item.quantity ?? 1)
const unit = ref(props.item.unit ?? '')
const supermarket = ref(props.supermarkets.some(s => s.name === props.defaultSupermarket) ? props.defaultSupermarket : null)
const newName = ref('')

const fold = (s) => s.trim().toLowerCase()
const cleanNew = computed(() => newName.value.trim())
const canAdd = computed(() => cleanNew.value && !props.supermarkets.some(s => fold(s.name) === fold(cleanNew.value)))
const valid = computed(() => {
  const p = Number(price.value), q = Number(quantity.value)
  return price.value !== '' && Number.isFinite(p) && p >= 0 && Number.isFinite(q) && q > 0 && !!supermarket.value
})

function add() {
  emit('add-supermarket', cleanNew.value)
  supermarket.value = cleanNew.value
  newName.value = ''
}

function save() {
  if (!valid.value) return
  emit('save', { unit_price: Number(price.value), quantity: Number(quantity.value), unit: unit.value.trim() || null, supermarket: supermarket.value })
}
</script>
