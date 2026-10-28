<template>
  <article class="agenda-item">
    <div class="agenda-date" :class="item.kind"><span>{{item.month}}</span><b>{{item.day}}</b></div>
    <div class="agenda-info">
      <div class="agenda-type"><span class="type-mark" :class="item.kind">{{item.kind==='pago'?'$':'✳'}}</span>{{item.kind==='pago'?'PAGO':'CITA MÉDICA'}}<span v-if="item.recurring" class="recurring-tag">RECURRENTE</span></div>
      <h3>{{item.title}}</h3>
      <p>{{item.meta}}</p>
    </div>
    <div class="agenda-amount" v-if="item.amount">{{item.amount}}<small>{{item.time}}</small></div>
    <div class="agenda-time" v-else>{{item.time}}<small>{{item.patient}}</small></div>
    <button v-if="item.kind==='pago'" class="mark-button" @click="$emit('mark-paid', item)" :aria-label="`Marcar ${item.title} como pagado`">Pagado</button>
    <button v-else class="mark-button" @click="$emit('mark-completed', item)" :aria-label="`Marcar ${item.title} como completada`">Hecha</button>
  </article>
</template>

<script setup>
defineProps({
  item: { type: Object, required: true }
})
defineEmits(['mark-paid', 'mark-completed'])
</script>
