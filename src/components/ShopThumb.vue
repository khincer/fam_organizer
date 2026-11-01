<template>
  <span class="shop-thumb" aria-hidden="true">
    <img v-if="url" :src="url" alt="" loading="lazy" />
    <template v-else>{{ fallback }}</template>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { supabase } from '../supabase.js'
import { publicPhotoUrl } from '../shop/photos.js'

const props = defineProps({ product: { type: Object, required: true }, fallback: { type: String, default: '🛒' } })
const url = computed(() => publicPhotoUrl(supabase, props.product.photo_path))
</script>
