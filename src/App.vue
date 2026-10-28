<template>
  <div v-if="user" class="app-shell">
    <AppSidebar :nav="nav" :activeTab="activeTab" @change-tab="activeTab = $event" />
    <main id="main-content">
      <AppTopbar 
        :currentTitle="currentTitle"
        :notificationsEnabled="notificationsEnabled"
        :notificationsLoading="notificationsLoading"
        :userInitial="userInitial"
        :displayName="displayName"
        @toggle-notifications="toggleNotifications"
        @sign-out="signOut"
      />
      <div class="content-wrap">
        <section v-if="activeTab==='inicio'" class="dashboard">
          <div class="welcome-row"><div><p class="eyebrow">{{todayLabel}}</p><h1>Hola, {{displayName}} <span class="wave">✳</span></h1><p class="subtitle">Un vistazo a lo que viene para tu familia.</p></div><button class="primary-button" @click="openAdd"><span class="plus">＋</span> Agregar pendiente</button></div>
          <div class="summary-grid">
            <article class="summary-card"><div class="summary-top"><span class="summary-icon mint">↗</span><span class="summary-caption">ESTE MES</span></div><p class="summary-value">{{currency(totalDueThisMonth)}}</p><p class="summary-foot">En pagos pendientes</p><span class="summary-decoration">$</span></article>
            <article class="summary-card"><div class="summary-top"><span class="summary-icon peach">◷</span><span class="summary-caption">PRÓXIMOS 7 DÍAS</span></div><p class="summary-value">{{nextWeekCount}} <span class="summary-unit">pendientes</span></p><p class="summary-foot">{{nextWeekPaymentCount}} pagos · {{nextWeekAppointmentCount}} citas</p><span class="summary-decoration">7</span></article>
            <article class="summary-card next-card"><div class="summary-top"><span class="summary-icon lilac">✳</span><span class="summary-caption">SIGUIENTE EN AGENDA</span></div><p class="next-date">{{nextItem?formatDate(nextItem.date):'Sin pendientes'}} <span v-if="nextItem">· {{nextItem.time}}</span></p><p class="next-title">{{nextItem?.title||'Todo al día'}}</p><p class="summary-foot">{{nextItem?.meta||'No hay eventos próximos'}}</p><span class="summary-decoration">↗</span></article>
          </div>
          <div class="dashboard-columns">
            <section class="panel agenda-panel"><div class="panel-heading"><div><p class="eyebrow">NO DEJEMOS NADA ATRÁS</p><h2>Lo que viene</h2></div><button class="text-button" @click="activeTab='pagos'">Ver agenda <span>→</span></button></div>
              <div class="agenda-list">
                <AgendaItem v-for="item in upcoming" :key="item.id" :item="item" @mark-paid="markPaid" @mark-completed="markCompleted" />
              </div>
            </section>
            <aside class="side-column">
              <section class="panel quick-panel"><div class="panel-heading"><div><p class="eyebrow">UN PASO RÁPIDO</p><h2>Accesos rápidos</h2></div><span class="sparkle">✦</span></div><button class="quick-link" @click="openAdd('pago')"><span class="quick-symbol payment">＋</span><span><b>Anotar un pago</b><small>Único o recurrente</small></span><span class="arrow">→</span></button><button class="quick-link" @click="openAdd('cita')"><span class="quick-symbol appointment">＋</span><span><b>Agendar una cita</b><small>Médico, escuela y más</small></span><span class="arrow">→</span></button><button class="quick-link" @click="activeTab='historial'"><span class="quick-symbol history">↺</span><span><b>Ver historial</b><small>Lo que ya pasó</small></span><span class="arrow">→</span></button></section>
              <section class="tip-card"><span class="tip-sticker">✷</span><div class="tip-label">UN RECORDATORIO AMABLE</div><h3>Lo cotidiano también merece su espacio.</h3><p>Agrega pagos puntuales, citas o actividades para que toda la familia esté al tanto.</p></section>
            </aside>
          </div>
          <section class="panel history-preview"><div class="panel-heading"><div><p class="eyebrow">UN POCO DE CONTEXTO</p><h2>Últimos movimientos</h2></div><button class="text-button" @click="activeTab='historial'">Ver historial <span>→</span></button></div><div v-for="entry in recentHistory" :key="entry.id" class="history-row"><span class="history-bullet" :class="entry.kind==='pago'?'paid':'visit'">{{entry.kind==='pago'?'✓':'✳'}}</span><span class="history-title"><b>{{entry.title}}</b><small>{{entry.meta}}</small></span><span class="history-amount">{{entry.amount||'Cita completada'}}</span></div><p v-if="!recentHistory.length" class="empty-state">Todavía no hay movimientos.</p></section>
        </section>
        <section v-else class="other-page"><div class="welcome-row"><div><p class="eyebrow">Incer Avendaño</p><h1>{{currentTitle}}</h1><p class="subtitle">{{pageDescription}}</p></div><button class="primary-button" @click="openAdd(activeTab==='citas'?'cita':'pago')"><span class="plus">＋</span> {{activeTab==='citas'?'Agendar cita':'Agregar pendiente'}}</button></div>
          <div class="panel placeholder-panel"><div class="panel-heading"><div><p class="eyebrow">AGENDA COMPARTIDA</p><h2>{{currentTitle}}</h2></div></div><template v-if="activeTab==='historial'"><div v-for="entry in history" :key="entry.id" class="history-row"><span class="history-bullet" :class="entry.kind==='pago'?'paid':'visit'">{{entry.kind==='pago'?'✓':'✳'}}</span><span class="history-title"><b>{{entry.title}}</b><small>{{entry.meta}}</small></span><span class="history-amount">{{entry.amount||'Cita completada'}}</span></div><p v-if="!history.length" class="empty-state">Todavía no hay movimientos.</p></template><div v-else class="agenda-list"><AgendaItem v-for="item in activeList" :key="item.id" :item="item" @mark-paid="markPaid" @mark-completed="markCompleted" /><p v-if="!activeList.length" class="empty-state">No hay elementos para mostrar.</p></div></div>
        </section>
      </div>
      <nav class="bottom-nav" aria-label="Navegación móvil"><button v-for="item in nav" :key="item.id" :class="{selected:activeTab===item.id}" @click="activeTab=item.id"><span>{{item.icon}}</span>{{item.label}}</button><button @click="openAdd"><span>＋</span>Agregar</button></nav>
    </main>
    <ItemModal :modalOpen="modalOpen" :form="form" :formError="formError" :saving="saving" @close="modalOpen=false" @save="saveItem" />
    <div v-if="toast" class="toast" role="status" aria-live="polite">{{toast}}</div>
  </div>
  <LoginScreen 
    v-if="!user"
    :otpSent="otpSent"
    :authEmail="authEmail"
    :authCode="authCode"
    :authLoading="authLoading"
    :authMessage="authMessage"
    :supabaseReady="supabaseReady"
    @send-otp="sendOtp"
    @verify-otp="verifyOtp"
    @reset-otp="otpSent=false"
    @update:authEmail="authEmail = $event"
    @update:authCode="authCode = $event"
  />
</template>
<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { supabase, supabaseReady } from './supabase.js'
import { useNotifications } from './composables/useNotifications.js'
import AppSidebar from './components/AppSidebar.vue'
import AppTopbar from './components/AppTopbar.vue'
import AgendaItem from './components/AgendaItem.vue'
import ItemModal from './components/ItemModal.vue'
import LoginScreen from './components/LoginScreen.vue'

const activeTab=ref('inicio'), modalOpen=ref(false), toast=ref(''), user=ref(null), authEmail=ref(''), authCode=ref(''), otpSent=ref(false), authLoading=ref(false), authMessage=ref(''), saving=ref(false), formError=ref('')
const nav=[{id:'inicio',label:'Inicio',icon:'⌂'},{id:'pagos',label:'Pagos',icon:'＄'},{id:'citas',label:'Citas y actividades',icon:'▦'},{id:'historial',label:'Historial',icon:'↺'}]
const currentTitle=computed(()=>nav.find(n=>n.id===activeTab.value)?.label||'Inicio')
const pageDescription=computed(()=>({pagos:'Pagos recurrentes y gastos de una sola vez.',citas:'Consultas, actividades y momentos importantes.',historial:'Una memoria compartida de lo que ya pasó.'}[activeTab.value]))
const demoUpcoming=[{id:'d1',date:'2026-10-29',kind:'cita',title:'Cita con pediatra',meta:'Dra. Méndez · Clínica Central',time:'9:00 am',patient:'Sofía',status:'scheduled'},{id:'d2',date:'2026-10-30',kind:'pago',title:'Colegiatura',meta:'Colegio Arboleda',amount:'C$340.00',time:'MENSUAL',recurring:true,status:'pending'},{id:'d3',date:'2026-11-02',kind:'pago',title:'Actividad de Halloween',meta:'Colegio Arboleda',amount:'C$18.00',time:'UNA VEZ',status:'pending'},{id:'d4',date:'2026-11-04',kind:'cita',title:'Revisión dental',meta:'Dr. Paredes · Sonrisa',time:'3:30 pm',patient:'Tomás',status:'scheduled'}]
const upcoming=ref(supabaseReady?[]:demoUpcoming.map(x=>({...x}))), history=ref(supabaseReady?[]:[{id:'h1',kind:'pago',title:'Pago de electricidad',meta:'Carlos · 27 oct',amount:'C$82.40'},{id:'h2',kind:'cita',title:'Consulta dental',meta:'Tomás · Dra. López · 21 oct',amount:'Cita completada'}])
const recentHistory=computed(()=>history.value.slice(0,2)), activeList=computed(()=>upcoming.value.filter(i=>activeTab.value==='citas'?i.kind==='cita':i.kind==='pago'))
const totalDueThisMonth=computed(()=>upcoming.value.filter(i=>i.kind==='pago'&&i.status==='pending'&&i.date?.startsWith(new Date().toISOString().slice(0,7))).reduce((sum,i)=>sum+Number(i.amountValue||0),0))
const nextWeek=computed(()=>upcoming.value.filter(i=>daysUntil(i.date)>=0&&daysUntil(i.date)<=7)),nextWeekCount=computed(()=>nextWeek.value.length),nextWeekPaymentCount=computed(()=>nextWeek.value.filter(i=>i.kind==='pago').length),nextWeekAppointmentCount=computed(()=>nextWeek.value.filter(i=>i.kind==='cita').length),nextItem=computed(()=>upcoming.value[0])
const displayName=computed(()=>user.value?.email?.split('@')[0]?.split(/[._-]/)[0]||'Familia'),userInitial=computed(()=>displayName.value[0]?.toUpperCase()||'F'),todayLabel=new Date().toLocaleDateString('es-NI',{weekday:'long',day:'numeric',month:'long'}).toUpperCase()
const form=reactive({type:'pago',title:'',amount:'',recurrence:'once',date:'',time:'',patient:'',doctor:'',location:''})
let authSubscription
const { notificationsEnabled, notificationsLoading, checkNotificationStatus, toggleNotifications } = useNotifications(user, showToast)

function daysUntil(date){return Math.floor((new Date(`${date}T12:00:00`).getTime()-new Date().setHours(12,0,0,0))/86400000)}
function formatDate(date){return new Date(`${date}T12:00:00`).toLocaleDateString('es-NI',{weekday:'short',day:'numeric',month:'short'})}
function currency(amount){return new Intl.NumberFormat('es-NI',{style:'currency',currency:'NIO',maximumFractionDigits:2}).format(amount||0)}
function normalizeDate(date){const d=new Date(`${date}T12:00:00`);return{month:d.toLocaleDateString('es-NI',{month:'short'}).replace('.','').toUpperCase(),day:d.toLocaleDateString('es-NI',{day:'2-digit'})}}
function paymentItem(row,template){const date=normalizeDate(row.due_on);return{id:row.id,kind:'pago',date:row.due_on,month:date.month,day:date.day,title:row.title,meta:row.category||template?.category||'Pago familiar',amount:row.amount==null?'':currency(Number(row.amount)),amountValue:Number(row.amount)||0,time:template?.recurrence==='monthly'?'MENSUAL':template?.recurrence==='yearly'?'ANUAL':'PENDIENTE',recurring:template?.recurrence!=='once',status:row.status,source:row}}
function appointmentItem(row){const d=new Date(row.starts_at),date=row.starts_at.slice(0,10),parts=normalizeDate(date);return{id:row.id,kind:'cita',date,month:parts.month,day:parts.day,title:row.title,meta:[row.doctor,row.location].filter(Boolean).join(' · '),time:d.toLocaleTimeString('es-NI',{hour:'numeric',minute:'2-digit'}),patient:row.patient,status:row.status,source:row}}
async function loadData(){if(!supabaseReady||!user.value)return;const [payments,templates,appointments]=await Promise.all([supabase.from('payment_occurrences').select('*').order('due_on'),supabase.from('payment_templates').select('*'),supabase.from('appointments').select('*').order('starts_at')]);const error=payments.error||templates.error||appointments.error;if(error){showToast('No pudimos cargar la agenda. Inténtalo de nuevo.');return}const templateMap=new Map(templates.data.map(t=>[t.id,t]));upcoming.value=[...payments.data.filter(x=>x.status==='pending').map(x=>paymentItem(x,templateMap.get(x.template_id))),...appointments.data.filter(x=>x.status==='scheduled').map(appointmentItem)].sort((a,b)=>a.date.localeCompare(b.date));history.value=[...payments.data.filter(x=>x.status==='paid').map(x=>({...paymentItem(x,templateMap.get(x.template_id)),meta:`Pago registrado · ${formatDate(x.paid_at?.slice(0,10)||x.due_on)}`})),...appointments.data.filter(x=>x.status==='completed').map(x=>({...appointmentItem(x),meta:`${x.patient} · ${x.doctor} · ${formatDate(x.starts_at.slice(0,10))}`}))].sort((a,b)=>b.date.localeCompare(a.date))}
async function sendOtp(){authLoading.value=true;authMessage.value='';const email=authEmail.value.trim().toLowerCase();if(!supabaseReady){authLoading.value=false;authMessage.value='Configuración no disponible.';return}const {data:member}=await supabase.from('family_members').select('email').eq('email',email).maybeSingle();if(!member){authLoading.value=false;authMessage.value='Este correo no está autorizado para acceder.';return}const {error}=await supabase.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:window.location.origin}});authLoading.value=false;if(error){authMessage.value='No pudimos enviar el código. Inténtalo de nuevo.';return}otpSent.value=true;authMessage.value='Te enviamos un código de acceso a tu correo.'}
async function verifyOtp(){authLoading.value=true;authMessage.value='';const email=authEmail.value.trim().toLowerCase();const {data,error}=await supabase.auth.verifyOtp({email,token:authCode.value.trim(),type:'email'});authLoading.value=false;if(error){authMessage.value='El código no es válido o ya venció. Solicita uno nuevo.';return}if(supabaseReady){const {data:member}=await supabase.from('family_members').select('email').eq('email',email).maybeSingle();if(!member){await supabase.auth.signOut();authMessage.value='Este correo no está autorizado.';user.value=null;return}}user.value=data.user;await loadData()}
async function signOut(){if(supabaseReady)await supabase.auth.signOut();user.value=null;otpSent.value=false;authCode.value=''}
onMounted(async()=>{checkNotificationStatus();if(supabaseReady){const {data}=await supabase.auth.getSession();const sessionUser=data.session?.user||null;if(sessionUser){const email=sessionUser.email?.toLowerCase();const {data:member}=await supabase.from('family_members').select('email').eq('email',email).maybeSingle();if(member){user.value=sessionUser;loadData();checkNotificationStatus()}else{await supabase.auth.signOut();user.value=null}}const {data:listener}=supabase.auth.onAuthStateChange(async (_event,session)=>{const sessionUser=session?.user||null;if(sessionUser){const email=sessionUser.email?.toLowerCase();const {data:member}=await supabase.from('family_members').select('email').eq('email',email).maybeSingle();if(member){user.value=sessionUser;if(!upcoming.value.length && !history.value.length)loadData();checkNotificationStatus()}else{await supabase.auth.signOut();user.value=null}}else{user.value=null;notificationsEnabled.value=false}});authSubscription=listener.subscription}else{if(import.meta.env.PROD){showToast('Configuración requerida')}else{user.value={email:'demo@familia.test'}}}})
onUnmounted(()=>authSubscription?.unsubscribe())
function openAdd(type='pago'){form.type=type;form.title='';form.amount='';form.recurrence='once';form.date='';form.time='';form.patient='';form.doctor='';form.location='';formError.value='';modalOpen.value=true}
async function saveItem(){formError.value='';saving.value=true;try{if(supabaseReady){if(form.type==='pago'){const recurring=form.recurrence!=='once';const {data:template,error:templateError}=await supabase.from('payment_templates').insert({title:form.title,category:'Otros',amount:form.amount||null,currency:'NIO',due_day:recurring?Number(form.date.slice(-2)):null,next_due_on:form.date,recurrence:form.recurrence}).select().single();if(templateError)throw templateError;const dates=recurring?recurrenceDates(form.date,form.recurrence,12):[form.date];const rows=dates.map(d=>({template_id:template.id,title:form.title,category:'Otros',amount:form.amount||null,currency:'NIO',due_on:d}));const {error}=await supabase.from('payment_occurrences').insert(rows);if(error)throw error}else{const startsAt=new Date(`${form.date}T${form.time||'09:00'}:00`).toISOString();const {error}=await supabase.from('appointments').insert({title:form.title,doctor:form.doctor,patient:form.patient,starts_at:startsAt,location:form.location});if(error)throw error}}modalOpen.value=false;if(supabaseReady)await loadData();else addDemoItem();showToast('Listo, ya está en la agenda')}catch(error){formError.value='No se pudo guardar. Revisa los datos e inténtalo de nuevo.'}finally{saving.value=false}}
function recurrenceDates(date,recurrence,count){const [y,m,d]=date.split('-').map(Number);return Array.from({length:count},(_,i)=>{const monthIndex=m-1+(recurrence==='monthly'?i:i*12),lastDay=new Date(y,monthIndex+1,0).getDate();return`${new Date(y,monthIndex,1).getFullYear()}-${String(new Date(y,monthIndex,1).getMonth()+1).padStart(2,'0')}-${String(Math.min(d,lastDay)).padStart(2,'0')}`})}
function addDemoItem(){const date=normalizeDate(form.date);if(form.type==='pago'){const item={id:crypto.randomUUID(),kind:'pago',date:form.date,...date,title:form.title,meta:'Pago familiar',amount:form.amount?currency(Number(form.amount)):'',amountValue:Number(form.amount)||0,time:form.recurrence==='once'?'UNA VEZ':form.recurrence==='monthly'?'MENSUAL':'ANUAL',recurring:form.recurrence!=='once',status:'pending'};upcoming.value.push(item)}else{upcoming.value.push({id:crypto.randomUUID(),kind:'cita',date:form.date,...date,title:form.title,meta:`${form.doctor} · ${form.location}`,time:form.time||'9:00 am',patient:form.patient,status:'scheduled'})}upcoming.value.sort((a,b)=>a.date.localeCompare(b.date))}
async function updateStatus(item,status){if(supabaseReady){const table=item.kind==='pago'?'payment_occurrences':'appointments',payload=item.kind==='pago'?{status,paid_at:new Date().toISOString()}:{status};const {error}=await supabase.from(table).update(payload).eq('id',item.id);if(error){showToast('No pudimos actualizar el estado. Inténtalo de nuevo.');return}}upcoming.value=upcoming.value.filter(x=>x.id!==item.id);history.value.unshift({...item,status,meta:item.kind==='pago'?`Pago registrado · ${formatDate(item.date)}`:`${item.patient} · ${item.meta} · ${formatDate(item.date)}`,amount:item.kind==='pago'?item.amount:'Cita completada'});showToast(item.kind==='pago'?'Pago marcado como pagado':'Cita marcada como completada')}
function markPaid(item){updateStatus(item,'paid')}
function markCompleted(item){updateStatus(item,'completed')}
function showToast(message){toast.value=message;window.setTimeout(()=>toast.value='',2800)}
</script>
