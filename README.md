# Casa en orden

PWA familiar de agenda compartida para pagos, citas y actividades. La interfaz está en español y prioriza el uso desde el teléfono.

## Requisitos

- Node.js 20 o posterior
- Un proyecto de Supabase

## Configuración

1. En Supabase, ejecutá `supabase/migrations/20261028000000_family_organizer.sql` desde el editor SQL.
2. Agregá cada correo permitido a la lista privada desde el SQL Editor, en minúsculas:

   ```sql
   insert into private.family_members (email)
   values ('persona@ejemplo.com');
   ```

3. En **Authentication → Hooks**, activá **Before User Created** y seleccioná `public.allowlisted_email_before_user_created`. Así el servidor rechaza el alta de correos que no estén en la lista. La política RLS también impide que usuarios no autorizados lean o modifiquen los datos compartidos.
4. En **Authentication → Email Templates → Magic Link**, usá `{{ .Token }}` para enviar un código de un solo uso.
5. Copiá `.env.example` a `.env.local` y completá la URL y la publishable key del proyecto. Nunca pongas una `service_role` key en el navegador.
6. Instalá dependencias e iniciá la app:

   ```sh
   npm install
   npm run dev
   ```

Sin variables de Supabase, la app abre en modo demostración; los cambios de esa vista no se guardan. Con Supabase configurado, los pagos y citas se leen y escriben en las tablas compartidas.

## Datos

- `payment_templates`: pagos únicos o recurrentes.
- `payment_occurrences`: vencimientos individuales e historial de pagos.
- `appointments`: citas con paciente, profesional, fecha, hora y lugar.
- `private.family_members`: lista de correos autorizados, fuera del esquema expuesto al cliente.

Al crear un pago recurrente, la app genera 12 vencimientos iniciales. Para cubrir más meses, la familia deberá agregar nuevas ocurrencias o ampliar la generación desde un proceso programado.

## Notificaciones push

La app permite activar notificaciones push desde el botón de campana. Para habilitarlas completamente:

1. Genera claves VAPID. Puedes usar `npx web-push generate-vapid-keys` o cualquier herramienta de Web Push.
2. Agrega la clave pública a `.env.local` como `VITE_VAPID_PUBLIC_KEY`.
3. Guarda la clave privada en los secretos de Supabase (para usarla desde Edge Functions): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
4. Ejecuta la migración actualizada para crear la tabla `push_subscriptions`.
5. Crea una Edge Function (por ejemplo `send-push`) que use la clave privada VAPID para enviar notificaciones a las suscripciones guardadas. Puedes dispararla con un cron o desde triggers según necesites.

Las notificaciones funcionan en segundo plano gracias al service worker (`src/sw.js`). Cuando la app esté abierta, las notificaciones se mostrarán igual. El envío programado requiere la Edge Function y el cron configurados en Supabase.
