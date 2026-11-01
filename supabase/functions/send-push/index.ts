import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.7'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Two ways in: the scheduler with the cron secret, or a signed-in family
    // member. A bare Authorization header (e.g. the public anon key) is not enough.
    const cronSecret = req.headers.get('x-cron-secret')
    const expectedCronSecret = Deno.env.get('CRON_SECRET')
    const fromCron = !!(cronSecret && expectedCronSecret && cronSecret === expectedCronSecret)

    if (!fromCron) {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
      if (!token) return json({ error: 'No autorizado' }, 401)
      const { data: auth, error: authError } = await supabase.auth.getUser(token)
      const email = auth?.user?.email
      if (authError || !email) return json({ error: 'No autorizado' }, 401)
      const { data: allowed, error: allowError } = await supabase.rpc('is_email_allowed', { check_email: email })
      if (allowError || allowed !== true) return json({ error: 'No autorizado' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const { title = 'Casa en orden', message = 'Tienes un recordatorio', url = '/', user_id, exclude_user_id } = body

    let query = supabase.from('push_subscriptions').select('*')
    if (user_id) query = query.eq('user_id', user_id)
    if (exclude_user_id) query = query.neq('user_id', exclude_user_id)

    const { data: subs, error } = await query
    if (error) throw error

    const payload = JSON.stringify({ title, body: message, url })

    const results = await Promise.allSettled(
      (subs || []).map((sub) =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      )
    )

    // Endpoints the push service reports as gone will never work again.
    const expired = (subs || [])
      .filter((_, i) => {
        const r = results[i]
        return r.status === 'rejected' && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)
      })
      .map((sub) => sub.endpoint)
    if (expired.length) await supabase.from('push_subscriptions').delete().in('endpoint', expired)

    const failed = results.filter(r => r.status === 'rejected').length
    return json({ sent: results.length - failed, failed, removed: expired.length })
  } catch (_e) {
    return json({ error: 'Error al enviar notificaciones' }, 500)
  }
})
