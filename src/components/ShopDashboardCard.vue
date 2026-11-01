<template>
  <button class="panel shop-dash" @click="$emit('open')">
    <span class="shop-dash-icon" aria-hidden="true">🛒</span>
    <span class="shop-dash-body">
      <span class="eyebrow">COMPRAS DE LA SEMANA</span>
      <b v-if="ready">{{ pending }} por comprar · {{ currency(total) }} gastado</b>
      <b v-else>Ver la lista</b>
    </span>
    <span class="arrow" aria-hidden="true">→</span>
  </button>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { supabase } from '../supabase.js'
import { mondayOf } from '../shop/week.js'
import { currency } from '../shop/format.js'

defineEmits(['open'])
const pending = ref(0)
const total = ref(0)
const ready = ref(false)

onMounted(async () => {
  if (!supabase) return
  const week = mondayOf()
  const [count, sum] = await Promise.all([
    supabase.from('shop_purchases').select('id', { count: 'exact', head: true }).eq('week_of', week).eq('checked', false),
    supabase.rpc('shop_week_summary', { p_week: week }),
  ])
  if (count.error || sum.error) return
  pending.value = count.count || 0
  total.value = sum.data?.week_total || 0
  ready.value = true
})
</script>
