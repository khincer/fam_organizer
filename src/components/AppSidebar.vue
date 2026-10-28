<template>
  <aside class="sidebar">
    <a class="brand" href="#inicio" @click="$emit('change-tab', 'inicio')" aria-label="Casa en orden, inicio">
      <span class="brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8v10h-6v-7H9v7H3z"/></svg></span>
      <span>casa en <b>orden</b></span>
    </a>
    <p class="nav-label">TU ESPACIO</p>
    <nav class="main-nav" aria-label="Navegación principal">
      <button v-for="item in nav" :key="item.id" class="nav-item" :class="{selected:activeTab===item.id}" @click="$emit('change-tab', item.id)">
        <span class="nav-icon" aria-hidden="true">{{item.icon}}</span>{{item.label}}
        <span v-if="item.id==='inicio'" class="nav-dot"></span>
      </button>
    </nav>
    <div class="sidebar-bottom"><div class="family-avatar">I</div><div><strong>Incer Avendaño</strong><small>Espacio compartido</small></div><button class="more-button" aria-label="Más opciones">···</button></div>
  </aside>
</template>

<script setup>
defineProps({
  nav: { type: Array, default: () => [] },
  activeTab: { type: String, default: 'inicio' }
})
defineEmits(['change-tab'])
</script>
