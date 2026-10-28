<template>
  <header class="topbar">
    <div class="mobile-brand"><span class="brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8v10h-6v-7H9v7H3z"/></svg></span><b>casa en orden</b></div>
    <div class="breadcrumb"><span>Incer Avendaño</span><span class="crumb-slash">/</span><strong>{{currentTitle}}</strong></div>
    <div class="top-actions">
      <button class="icon-button notification-button" :aria-label="notificationsEnabled ? 'Desactivar notificaciones' : 'Activar notificaciones'" :aria-pressed="notificationsEnabled" @click="$emit('toggle-notifications')" :disabled="notificationsLoading">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
        <span v-if="notificationsEnabled" class="notification-ping"></span>
      </button>
      <div class="user-chip">
        <span class="user-avatar">{{userInitial}}</span>
        <span class="user-name">{{displayName}}</span>
        <button class="signout-button" @click="$emit('sign-out')">Salir</button>
      </div>
    </div>
  </header>
</template>

<script setup>
defineProps({
  currentTitle: { type: String, default: '' },
  notificationsEnabled: { type: Boolean, default: false },
  notificationsLoading: { type: Boolean, default: false },
  userInitial: { type: String, default: 'I' },
  displayName: { type: String, default: 'Incer' }
})
defineEmits(['toggle-notifications', 'sign-out'])
</script>
