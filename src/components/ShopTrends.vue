<template>
  <section class="panel shop-trends" aria-labelledby="trends-title">
    <p class="eyebrow">ÚLTIMAS 8 SEMANAS</p>
    <h2 id="trends-title">Gasto semanal</h2>
    <p v-if="loading" class="empty-state">Cargando…</p>
    <p v-else-if="!totals.length" class="empty-state">Sin datos todavía.</p>
    <svg v-else class="shop-bars" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="ariaLabel">
      <g v-for="(t, i) in bars" :key="t.week_of">
        <rect :x="t.x" :y="t.y" :width="barW" :height="t.h" rx="4" class="shop-bar" :class="{ current: i === bars.length - 1 }" />
        <text :x="t.x + barW / 2" :y="t.y - 6" text-anchor="middle" class="shop-bar-value">{{ short(t.total) }}</text>
        <text :x="t.x + barW / 2" :y="H - 6" text-anchor="middle" class="shop-bar-label">{{ day(t.week_of) }}</text>
      </g>
    </svg>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { currency } from '../shop/format.js'

const props = defineProps({ load: { type: Function, required: true } })
const W = 320, H = 150, TOP = 22, BOTTOM = 22, GAP = 10
const totals = ref([])
const loading = ref(true)

const barW = computed(() => (W - GAP * (totals.value.length + 1)) / Math.max(totals.value.length, 1))
const bars = computed(() => {
  const max = Math.max(...totals.value.map(t => Number(t.total)), 1)
  const area = H - TOP - BOTTOM
  return totals.value.map((t, i) => {
    const h = Math.max((Number(t.total) / max) * area, Number(t.total) > 0 ? 2 : 0)
    return { ...t, x: GAP + i * (barW.value + GAP), y: TOP + area - h, h }
  })
})
const day = (week) => { const [, m, d] = week.split('-'); return `${Number(d)}/${Number(m)}` }
const short = (n) => (Number(n) ? `C$${Math.round(Number(n))}` : '0')
const ariaLabel = computed(() => totals.value.map(t => `${day(t.week_of)}: ${currency(t.total)}`).join(', '))

onMounted(async () => { totals.value = await props.load(); loading.value = false })
</script>
