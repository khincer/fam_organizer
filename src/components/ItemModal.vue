<template>
  <div v-if="modalOpen" class="modal-backdrop" @click.self="$emit('close')">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close" aria-label="Cerrar" @click="$emit('close')">×</button>
      <p class="eyebrow">PARA QUE NO SE PASE</p>
      <h2 id="modal-title">{{form.type==='cita'?'Agendar algo':'Agregar pendiente'}}</h2>
      <div class="type-switch">
        <button :class="{active:form.type==='pago'}" @click="form.type='pago'">Pago</button>
        <button :class="{active:form.type==='cita'}" @click="form.type='cita'">Cita o actividad</button>
      </div>
      <form @submit.prevent="$emit('save')">
        <label>{{form.type==='cita'?'Nombre de la cita o actividad':'¿Qué hay que pagar?'}}<input v-model="form.title" required :placeholder="form.type==='pago'?'Ej. Colegiatura':'Ej. Cita con el pediatra'" /></label>
        <div v-if="form.type==='pago'" class="form-row">
          <label>Monto<input v-model="form.amount" type="number" min="0" step="0.01" placeholder="0.00" /></label>
          <label>Se repite<select v-model="form.recurrence"><option value="once">Una sola vez</option><option value="monthly">Cada mes</option><option value="yearly">Cada año</option></select></label>
        </div>
        <div v-else class="form-row">
          <label>Paciente<input v-model="form.patient" required placeholder="Nombre" /></label>
          <label>Doctor o lugar<input v-model="form.doctor" required placeholder="Nombre" /></label>
        </div>
        <div class="form-row">
          <label>Fecha<input v-model="form.date" type="date" required /></label>
          <label>Hora<input v-model="form.time" type="time" /></label>
        </div>
        <label>Lugar (opcional)<input v-model="form.location" placeholder="Dirección o clínica" /></label>
        <p v-if="formError" class="form-error" role="alert">{{formError}}</p>
        <button class="primary-button submit-button" type="submit" :disabled="saving" :aria-busy="saving">{{saving?'Guardando…':'Guardar en la agenda'}} <span aria-hidden="true">→</span></button>
      </form>
    </section>
  </div>
</template>

<script setup>
defineProps({
  modalOpen: { type: Boolean, default: false },
  form: { type: Object, required: true },
  formError: { type: String, default: '' },
  saving: { type: Boolean, default: false }
})
defineEmits(['close', 'save'])
</script>
