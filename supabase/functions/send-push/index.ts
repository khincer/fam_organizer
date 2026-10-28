import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    const cronSecret = req.headers.get('x-cron-secret')
    const expectedCronSecret = Deno.env.get('CRON_SECRET')

    if (!authHeader && !(cronSecret && expectedCronSecret && cronSecret === expectedCronSecret)) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json().catch(() => ({}))
    const { title = 'Casa en orden', message = 'Tienes un recordatorio', url = '/', user_id } = body

    let query = supabase.from('push_subscriptions').select('*')
    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    const { data: subs, error } = await query
    if (error) throw error

    const payload = JSON.stringify({ title, body: message, url })

    const results = await Promise.allSettled(
      (subs || []).map((sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }
        return webpush.sendNotification(pushSubscription, payload)
      })
    )

    const failed = results.filter(r => r.status === 'rejected').length
    return new Response(JSON.stringify({ sent: results.length - failed, failed }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error al enviar notificaciones' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
