<template>
  <section class="login-screen">
    <div class="login-card">
      <span class="brand-mark login-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8v10h-6v-7H9v7H3z"/></svg></span>
      <p class="eyebrow">EL HOGAR, EN ORDEN</p>
      <h1>{{otpSent?'Revisa tu correo':'Bienvenida a casa'}}</h1>
      <p class="subtitle">{{otpSent?'Escribe el código de acceso que te enviamos.':'Ingresa con el correo autorizado de tu familia.'}}</p>
      <form v-if="!otpSent" @submit.prevent="$emit('send-otp')">
        <label>Correo electrónico<input :value="authEmail" @input="$emit('update:authEmail', $event.target.value)" type="email" autocomplete="email" required placeholder="tu@correo.com" /></label>
        <button class="primary-button submit-button" :disabled="authLoading">{{authLoading?'Enviando…':'Enviar código de acceso'}}</button>
      </form>
      <form v-else @submit.prevent="$emit('verify-otp')">
        <label>Código de un solo uso<input :value="authCode" @input="$emit('update:authCode', $event.target.value)" inputmode="numeric" autocomplete="one-time-code" required placeholder="123456" /></label>
        <button class="primary-button submit-button" :disabled="authLoading">{{authLoading?'Verificando…':'Entrar'}}</button>
        <button class="text-button" type="button" @click="$emit('reset-otp')">Usar otro correo</button>
      </form>
      <p v-if="authMessage" class="auth-message" role="status">{{authMessage}}</p>
      <p v-if="!supabaseReady" class="demo-note">Vista de demostración · configura Supabase para habilitar el acceso familiar.</p>
    </div>
  </section>
</template>

<script setup>
defineProps({
  otpSent: { type: Boolean, default: false },
  authEmail: { type: String, default: '' },
  authCode: { type: String, default: '' },
  authLoading: { type: Boolean, default: false },
  authMessage: { type: String, default: '' },
  supabaseReady: { type: Boolean, default: false }
})
defineEmits(['send-otp', 'verify-otp', 'reset-otp', 'update:authEmail', 'update:authCode'])
</script>
