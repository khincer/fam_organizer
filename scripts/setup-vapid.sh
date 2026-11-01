#!/usr/bin/env bash
# Generates one VAPID key pair and stores it where each half belongs:
#   - Vercel gets only the PUBLIC key (VITE_VAPID_PUBLIC_KEY) for every environment.
#   - Supabase Edge Function secrets get the full pair, the subject and a cron secret.
# Requires: node/npx, jq, openssl, and the `vercel` and `supabase` CLIs already
# logged in and linked to this project (`vercel link`, `supabase link`).
# Run it once, on your own machine. Rotating keys invalidates every existing
# push subscription, so the script refuses to overwrite an existing key file.
set -euo pipefail
cd "$(dirname "$0")/.."

SUBJECT=${1:-}
if [ -z "$SUBJECT" ]; then
  echo "Uso: scripts/setup-vapid.sh mailto:correo@familia.com" >&2
  exit 1
fi
for cmd in npx jq openssl vercel supabase; do
  command -v "$cmd" >/dev/null || { echo "Falta el comando: $cmd" >&2; exit 1; }
done

KEYS=vapid.json
if [ -e "$KEYS" ]; then
  echo "$KEYS ya existe; no se generan claves nuevas." >&2
else
  umask 077
  npx --yes web-push@3.6.7 generate-vapid-keys --json > "$KEYS"
fi
PUBLIC=$(jq -r .publicKey "$KEYS")
PRIVATE=$(jq -r .privateKey "$KEYS")

for env in production preview development; do
  vercel env rm VITE_VAPID_PUBLIC_KEY "$env" --yes >/dev/null 2>&1 || true
  printf '%s' "$PUBLIC" | vercel env add VITE_VAPID_PUBLIC_KEY "$env"
done

supabase secrets set \
  VAPID_PUBLIC_KEY="$PUBLIC" \
  VAPID_PRIVATE_KEY="$PRIVATE" \
  VAPID_SUBJECT="$SUBJECT" \
  CRON_SECRET="$(openssl rand -hex 32)"

cat <<MSG

Listo. Pasos que faltan:
  1. Guardá $KEYS en el gestor de contraseñas de la familia y luego borralo: rm $KEYS
  2. Volvé a desplegar en Vercel (vercel --prod) para que el build incluya la clave pública.
  3. Desplegá la función: supabase functions deploy send-push
MSG
