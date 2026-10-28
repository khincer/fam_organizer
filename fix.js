const fs = require('fs');
let c = fs.readFileSync('src/App.vue','utf8');
// Replace broken section
const broken = /<section v-else class="other-page">[\s\S]*?<div class="panel placeholder-panel">/;
const fixed = `<section v-else class="other-page"><div class="welcome-row"><div><p class="eyebrow">Incer Avendaño</p><h1>{{currentTitle}}</h1><p class="subtitle">{{pageDescription}}</p></div><button class="primary-button" @click="openAdd(activeTab==='citas'?'cita':'pago')"><span class="plus">＋</span> {{activeTab==='citas'?'Agendar cita':'Agregar pendiente'}}</button></div>
          <div class="panel placeholder-panel">`;
c = c.replace(broken, fixed);
fs.writeFileSync('src/App.vue', c, 'utf8');
console.log('done');
