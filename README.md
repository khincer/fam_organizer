# Casa en orden

PWA familiar de agenda compartida para pagos, citas y actividades. La interfaz está en español y prioriza el uso desde el teléfono.

## Requisitos

- Node.js 20 o posterior
- Un proyecto de Supabase

## Configuración

1. En Supabase, aplicá las migraciones de `supabase/migrations/` en orden (`supabase db push`, o ejecutá cada archivo en el editor SQL).
2. Agregá cada correo permitido a la lista privada desde el SQL Editor, en minúsculas:

   ```sql
   insert into private.family_members (email)
   values ('persona@ejemplo.com');
   ```

3. En **Authentication → Hooks**, activá **Before User Created** y seleccioná `public.allowlisted_email_before_user_created`. Así el servidor rechaza el alta de correos que no estén en la lista. La política RLS también impide que usuarios no autorizados lean o modifiquen los datos compartidos.
4. En **Authentication → URL Configuration**, agregá tu dominio de producción (ej. `https://tudominio.com`) a **Site URL** y a **Redirect URLs**.
5. En **Authentication → Email Templates → Magic Link**, usá `{{ .Token }}` para enviar un código de un solo uso.
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

La app permite activar notificaciones push desde el botón de campana. También avisa a los demás cuando alguien empieza las compras de la semana y cuando se termina la lista.

Las claves VAPID son un par: la **pública** va en el navegador (Vercel) y la **privada** solo en Supabase. Nunca pongas la privada en Vercel ni en una variable `VITE_*`.

### Configuración automática

Con los CLIs de Vercel y Supabase instalados, con sesión iniciada y vinculados al proyecto (`vercel link`, `supabase link`):

```sh
scripts/setup-vapid.sh mailto:correo@familia.com
```

El script genera el par una sola vez (`vapid.json`, ignorado por git), carga `VITE_VAPID_PUBLIC_KEY` en los entornos production, preview y development de Vercel, y guarda en Supabase `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` y un `CRON_SECRET` nuevo. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles en las Edge Functions; no hace falta cargarlas.

### Configuración manual

1. Generá el par: `npx web-push generate-vapid-keys --json > vapid.json`.
2. Vercel, solo la pública, en cada entorno: `jq -r .publicKey vapid.json | vercel env add VITE_VAPID_PUBLIC_KEY production` (repetir con `preview` y `development`).
3. Supabase: `supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:... CRON_SECRET=$(openssl rand -hex 32)`.
4. Para desarrollo local, copiá la pública a `.env.local` como `VITE_VAPID_PUBLIC_KEY`.

### Después de cargar las claves

1. Volvé a desplegar en Vercel (`vercel --prod`). Vite incluye la clave al compilar, así que cambiarla no tiene efecto hasta el siguiente build.
2. Desplegá la función: `supabase functions deploy send-push`. Solo acepta a un miembro de la familia con sesión iniciada o al cron con `x-cron-secret`.
3. Guardá `vapid.json` en el gestor de contraseñas y borralo del disco. Cambiar el par más adelante invalida todas las suscripciones existentes.

### Verificación

- En el sitio desplegado, activá las notificaciones: aparece una fila en `push_subscriptions`.
- Desde otra cuenta, marcá el primer producto de la semana: el primer teléfono recibe «Alguien empezó las compras» y quien lo marcó no.
- `grep -r "privateKey\|VAPID_PRIVATE" dist/` no devuelve nada.

Las notificaciones funcionan en segundo plano gracias al service worker (`src/sw.js`).

## Lista de compras

- `shop_products`: el catálogo de productos (con foto y último precio).
- `shop_purchases`: un renglón por producto y semana; al marcarlo se guarda precio, cantidad y supermercado.
- `shop_weeks`: indica que la lista de una semana ya se creó, para que no se vuelva a armar.
- `shop_supermarkets`: la lista fija de supermercados.

La lista de cada semana se arma una sola vez, con los productos activos, la primera vez que alguien la abre. Después solo cambia cuando alguien agrega o quita un producto. Los recibos por supermercado salen de lo marcado.

## Pruebas

- `npm test`: pruebas de la interfaz y la lógica (Vitest).
- `npm run test:db`: aplica todas las migraciones a una base Postgres local temporal y corre `supabase/tests/*.test.sql`.
