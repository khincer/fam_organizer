<template>
  <section class="panel shop-receipts" aria-labelledby="receipts-title">
    <div class="panel-heading">
      <div><p class="eyebrow">LO QUE YA COMPRAMOS</p><h2 id="receipts-title">Recibos</h2></div>
      <button v-if="receipts.length" class="shop-secondary" data-action="share" @click="share">Compartir</button>
    </div>
    <p v-if="!receipts.length" class="empty-state">Todavía no hay compras esta semana.</p>
    <article v-for="r in receipts" :key="r.supermarket" class="shop-receipt">
      <h3>{{ r.supermarket }}</h3>
      <ul>
        <li v-for="line in r.lines" :key="line.purchase_id">
          <span>{{ lineLabel(line) }}</span>
          <span>{{ currency(Number(line.unit_price) * Number(line.quantity)) }}</span>
        </li>
      </ul>
      <p class="shop-receipt-total"><span>Subtotal</span><b>{{ currency(r.total) }}</b></p>
    </article>
    <p v-if="receipts.length" class="shop-receipt-total shop-week-total"><span>Total de la semana</span><b>{{ currency(summary?.week_total) }}</b></p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { currency } from '../shop/format.js'
import { receiptText } from '../shop/listState.js'
import { weekLabel } from '../shop/week.js'

const props = defineProps({ summary: { type: Object, default: null }, week: { type: String, required: true } })
const emit = defineEmits(['toast'])
const lineLabel = (l) => `${l.name} ×${Number(l.quantity)}${l.unit ? ` ${l.unit}` : ''}`
const receipts = computed(() => props.summary?.receipts || [])

async function share() {
  const text = receiptText(props.summary, weekLabel(props.week))
  try {
    if (navigator.share) { await navigator.share({ text }); return }
    await navigator.clipboard.writeText(text)
    emit('toast', 'Recibo copiado')
  } catch (e) {
    if (e?.name !== 'AbortError') emit('toast', 'No pudimos compartir el recibo.')
  }
}
</script>
