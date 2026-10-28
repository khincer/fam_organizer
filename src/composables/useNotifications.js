import { ref } from 'vue'
import { supabase, supabaseReady } from '../supabase.js'

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function useNotifications(user, showToast) {
  const notificationsEnabled = ref(false)
  const notificationsSupported = ref(false)
  const notificationsLoading = ref(false)

  function checkNotificationStatus(){
    notificationsSupported.value = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
    if(!notificationsSupported.value) return
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        notificationsEnabled.value = !!sub
      })
    }).catch(() => {})
  }

  async function toggleNotifications(){
    if(!notificationsSupported.value || !user.value || !supabaseReady) {
      showToast('Notificaciones no disponibles en este dispositivo')
      return
    }
    notificationsLoading.value = true
    try {
      if(notificationsEnabled.value){
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if(sub){
          await sub.unsubscribe()
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        notificationsEnabled.value = false
        showToast('Notificaciones desactivadas')
        return
      }
      const permission = await Notification.requestPermission()
      if(permission !== 'granted'){
        showToast('Permiso de notificaciones denegado')
        return
      }
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if(!vapidKey){
        showToast('Falta configurar VITE_VAPID_PUBLIC_KEY')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      })
      const key = sub.getKey('p256dh')
      const auth = sub.getKey('auth')
      await supabase.from('push_subscriptions').upsert({
        user_id: user.value.id,
        endpoint: sub.endpoint,
        p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(key))),
        auth: btoa(String.fromCharCode.apply(null, new Uint8Array(auth)))
      }, { onConflict: 'endpoint' })
      notificationsEnabled.value = true
      showToast('Notificaciones activadas')
    } catch(e){
      showToast('No se pudo activar las notificaciones')
    } finally {
      notificationsLoading.value = false
    }
  }

  return {
    notificationsEnabled,
    notificationsSupported,
    notificationsLoading,
    checkNotificationStatus,
    toggleNotifications
  }
}
