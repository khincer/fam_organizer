# Weekly Shop List (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Compras" tab where the family works through one weekly shopping list together. Checking an item off records its price and supermarket and adds it to that supermarket's receipt. Push notifications go out when someone starts or finishes shopping, and the VAPID keys are set up for the Vercel deployment.

**Architecture:** The database came in PR #1 (`supabase/migrations/20261031200000_shop_list.sql`). This plan adds one small migration and builds the UI on top. Logic that needs no Supabase client lives in `src/shop/*.js` and has unit tests. `src/composables/useShopList.js` handles loading, realtime and writes. Vue components in `src/components/Shop*.vue` render the tab, and `App.vue` only mounts them. Receipts are the checked rows of a week grouped by supermarket, from the `shop_week_summary` RPC. Checking off never copies data anywhere.

**Tech Stack:** Vue 3.5 (`<script setup>`), Vite 6, vite-plugin-pwa, @supabase/supabase-js 2, Vitest (new), Postgres 16 + psql for migration tests, Supabase Edge Functions (Deno), Vercel.

**Spec:** No separate spec doc. The decisions come from the conversation of 2026-11-01 and are summarized below.

### Decisions (from the review conversation)

| # | Feature | Decision |
|---|---|---|
| 1, 2 | Tab, list created from the active catalog | Yes. The list is created **once** per week, the first time anyone opens it (tracked by the `shop_weeks` marker from Task 2). After that it changes only through explicit user actions. |
| 3 | Previous/next week buttons | Yes. Past weeks are read-only. The next button stops at the current week. |
| 4 | Planning ahead | **No.** Future weeks can't be opened. |
| 5, 6 | "Por comprar" / "Comprados" groups, search box | Yes |
| 7, 8, 9 | Check-off form with price prefilled from `last_price` and the last-used supermarket | Yes |
| 10 | Fixed supermarket list | Yes (new `shop_supermarkets` table) |
| 11 | Uncheck | Yes. The item leaves the receipt. |
| 12 | Showing who checked an item | **No** |
| 13 | Skip for the week | **Replaced.** Checking off *is* the receipt. Nothing moves between lists. The week's list changes only when a user explicitly removes an item ("Quitar de esta semana" deletes that week's row). |
| 14 | Edit quantity/unit before buying | Yes |
| 15, 16 | Realtime, refetch when the app comes back to the foreground | Yes |
| 17 | Offline queue | **No.** Online only. A failed write shows a toast and the UI rolls back. |
| 18–21 | Catalog: add, rename, deactivate/reactivate, full list | Yes. A product added mid-week also gets a row in the current week. |
| 22–25 | Photos: upload, compress, thumbnails, replace | Yes |
| 26–28 | Week total, receipt per supermarket, past-week totals | Yes |
| 29 | Dashboard card | Yes |
| 30 | Trends | Yes: weekly spend for the last 8 weeks, and a product's price history |
| 31 | Demo mode | **No.** Without Supabase the tab shows "Configuración requerida". |
| 32 | Push on start/finish | Yes |
| 33 | Share a receipt | Yes, as text: Web Share API, with a clipboard fallback |
| — | VAPID keys for Vercel | Yes (Task 11) |

## Global Constraints

- All UI copy is Spanish, matching the app's existing tone. Dates use `es-NI`. Money goes through the existing `currency()` formatter (NIO).
- A week key is the **local** Monday as `YYYY-MM-DD`. Never derive it from `toISOString()`. The database rejects any non-Monday (`shop_purchases_monday`).
- Online only. No IndexedDB, no write queue, no service-worker caching of API calls.
- No demo mode for this feature. If `supabaseReady` is false, the Compras tab shows only `Configuración requerida para usar la lista de compras.`
- Never show `checked_by` in the UI. Still write it, because the check constraint requires it.
- The client never writes `shop_products.last_price`. The trigger owns it.
- Photo object paths are `<productId>/<uuid>.jpg` in bucket `shop-products`. A replacement photo always gets a new uuid path; never upsert an existing path.
- The VAPID **private** key never goes to Vercel or into any `VITE_*` variable.
- Don't add dependencies beyond `vitest`, `@vue/test-utils` and `jsdom` (all dev dependencies).

## Review Focus

1. **Two phones open a new week at the same time.** Both see zero rows and both seed. The result must be exactly one row per product, never an error. Test in Task 4: `seedWeek` with an upsert that reports a conflict still resolves, and a reload shows no duplicates.
2. **Every item of a week is removed, then the app is reopened.** That week now has zero rows, so the "seed once" rule would refill it. Expected: an emptied week stays empty. Fix in Task 2: the `shop_weeks` marker table records that a week was created, and seeding runs only when there is no marker. Tests in Task 2 (SQL) and Task 4 (JS).
3. **Check-off on a weak connection.** The optimistic update must roll back if the write fails, and the user sees `No pudimos guardar. Revisa tu conexión.` A second tap while the first write is in flight must not send two writes. Test in Task 4.
4. **Sunday 23:30 or Monday 00:10 local time.** The current week key must be the local Monday. Test in Task 1 at those exact times.
5. **A realtime event for another week, or a DELETE (DELETE events can't be filtered by week).** The current list must not change, except that a DELETE whose id is in the list removes that row. Test in Task 3.

---

### Task 1: Vitest setup and week utilities

**Files:**
- Modify: `package.json` (add `"test": "vitest run"`; dev dependencies `vitest`, `@vue/test-utils`, `jsdom`)
- Create: `vitest.config.js` (`environment: 'jsdom'`, reusing the Vue plugin)
- Create: `src/shop/week.js`
- Test: `tests/shop/week.test.js`

**Interfaces:**
- Produces:
  - `mondayOf(date?: Date) => string` (`YYYY-MM-DD`)
  - `addWeeks(week: string, n: number) => string`
  - `isCurrentWeek(week: string, now?: Date) => boolean`
  - `weekLabel(week: string) => string` (e.g. `Semana del 26 oct`)

- [ ] **Step 1: Write the failing tests**

```js
import { mondayOf, addWeeks, isCurrentWeek, weekLabel } from '../../src/shop/week.js'
test('sunday late belongs to the previous monday', () => expect(mondayOf(new Date(2026,10,1,23,30))).toBe('2026-10-26'))
test('monday just after midnight is that monday', () => expect(mondayOf(new Date(2026,10,2,0,10))).toBe('2026-11-02'))
test('addWeeks crosses months', () => expect(addWeeks('2026-10-26', 1)).toBe('2026-11-02'))
test('addWeeks backwards', () => expect(addWeeks('2026-11-02', -2)).toBe('2026-10-19'))
test('isCurrentWeek', () => expect(isCurrentWeek('2026-10-26', new Date(2026,9,29))).toBe(true))
test('weekLabel', () => expect(weekLabel('2026-10-26')).toBe('Semana del 26 oct'))
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `src/shop/week.js` using local date parts only. Build dates as `new Date(y, m-1, d, 12)`.
- [ ] **Step 4:** Run `npm test`. Expected: 6 passed.
- [ ] **Step 5:** Commit: `test: add vitest and shop week utilities`.

---

### Task 2: Migration for supermarkets, week markers, rounded summary and trend RPCs

**Files:**
- Create: `supabase/migrations/20261101120000_shop_list_ui.sql`
- Create: `supabase/tests/stub.sql`. This stands in for Supabase's `auth.users`, `auth.uid()` (reads `request.jwt.claim.sub`), `private.is_family_member()` (returns true unless `request.jwt.claim.sub` is `00000000-0000-0000-0000-00000000dead`), `storage.buckets`, `storage.objects`, the `supabase_realtime` publication, and the `authenticated` and `anon` roles.
- Create: `supabase/tests/shop_list.test.sql` (assertions are `do $$ begin assert ...; end $$;`)
- Create: `scripts/db-test.sh`. It drops and recreates database `fam_test`, then pipes `stub.sql`, every `supabase/migrations/*.sql` in order, and the test file through `psql -v ON_ERROR_STOP=1`. It exits non-zero on failure.
- Modify: `package.json` (add `"test:db": "bash scripts/db-test.sh"`)

**Interfaces:**
- Produces:
  - **Table `public.shop_supermarkets`** `(id uuid pk, name text not null, created_at timestamptz)`, with a unique index on `lower(btrim(name))` and the same four family-member policies and grants as the other shop tables. Added to `supabase_realtime`.
  - **Table `public.shop_weeks`** `(week_of date pk check isodow=1, created_at timestamptz default now())`. Family members get select and insert policies. Inserts use `on conflict do nothing`.
  - **RPC `public.shop_seed_week(p_week date) returns boolean`**, security invoker. In one transaction: `insert into shop_weeks ... on conflict do nothing`. If this call inserted the marker, insert a row into `shop_purchases` for every active product (`on conflict (product_id, week_of) do nothing`) and return true. Otherwise return false. Reject `p_week > current Monday` with `raise exception 'future_week'` (decision 4).
  - **`public.shop_week_summary(p_week date)`**, replaced: same output shape, with `week_total` and each receipt `total` wrapped in `round(..., 2)`.
  - **RPC `public.shop_weekly_totals(p_weeks int default 8) returns table(week_of date, total numeric)`**: the last `p_weeks` Mondays up to the current one. Weeks with no purchases return `0`.
  - Grant execute on all three RPCs to `authenticated`. Revoke from `public` and `anon`.
  - Seed `shop_weeks` with every distinct `week_of` already in `shop_purchases`, so existing weeks aren't seeded again.

- [ ] **Step 1: Write the failing SQL tests**, one `do` block per assertion:
  - `shop_seed_week('2026-10-26')` returns true the first time and false the second, and creates one row per active product.
  - After deleting every row of that week, calling `shop_seed_week` again returns false and the week stays at 0 rows (Review Focus 2).
  - Inactive products aren't seeded.
  - `shop_seed_week(<next monday>)` raises `future_week`.
  - Inserting the supermarkets `'Pali'` and `' pali'` raises `unique_violation`.
  - `shop_week_summary` with one 1.50 × 1 line returns `'"total": 1.50'` with no `1.5000`.
  - `shop_weekly_totals(8)` returns 8 rows, ordered ascending, with zeros for empty weeks.
  - As the non-member uuid (`...dead`), `select count(*) from shop_supermarkets` is 0 and inserting raises an RLS error.
- [ ] **Step 2:** Run `npm run test:db`. Expected: FAIL at the first assertion (`function shop_seed_week does not exist`).
- [ ] **Step 3:** Write the migration.
- [ ] **Step 4:** Run `npm run test:db`. Expected: exit 0, no `ASSERT` failures.
- [ ] **Step 5:** Commit: `feat(db): supermarkets, week markers, seed RPC, rounded totals, weekly totals`.

---

### Task 3: Pure list-state helpers

**Files:**
- Create: `src/shop/listState.js`
- Test: `tests/shop/listState.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Item = { id, product_id, week_of, checked, unit_price, quantity, unit, supermarket, checked_at, product: { id, name, photo_path, last_price, active } }`
  - `joinItems(rows, productsById: Map) => Item[]`, sorted by `product.name` with `localeCompare('es')`
  - `applyPurchaseChange(items, payload, week, productsById) => Item[]`. `payload` is a Supabase realtime payload `{eventType, new, old}`.
  - `applyProductChange(items, productRow) => Item[]`
  - `groupItems(items, query: string) => { pending: Item[], done: Item[] }`. The query matches the product name case- and accent-insensitively (`normalize('NFD')`).
  - `receiptText(summary, weekLabelText) => string`

- [ ] **Step 1: Write the failing tests**
  - An `INSERT` for `week_of` ≠ `week` returns the same array reference.
  - An `UPDATE` in the current week replaces the row by id and keeps its `product`.
  - A `DELETE` with `old.id` in the list removes it. A `DELETE` with an unknown id returns the same reference (Review Focus 5).
  - An `INSERT` duplicating an existing id replaces it rather than adding a second copy.
  - `applyProductChange` updates `product.last_price` on every item with that `product_id`.
  - `groupItems(items, 'cafe')` matches `Café`. Checked items land in `done`.
  - `receiptText` for `{week_total:12.5, receipts:[{supermarket:'Pali', total:12.5, lines:[{name:'Leche', quantity:2, unit:'l', unit_price:6.25}]}]}` contains `Pali`, `Leche ×2 l`, `C$12.50` and `Total de la semana`.
- [ ] **Step 2:** Run `npm test -- listState`. Expected: FAIL.
- [ ] **Step 3:** Implement. Every function is pure and returns a new array only when something changed.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat(shop): pure list state helpers`.

---

### Task 4: `useShopList` composable (load, seed, realtime, writes)

**Files:**
- Create: `src/composables/useShopList.js`
- Create: `tests/helpers/fakeSupabase.js`. A chainable fake that records calls (`from().select().eq()`, `update().eq()`, `delete().eq()`, `insert()`, `rpc()`, `channel().on().subscribe()`, `removeChannel`) and returns scripted `{data, error}` results.
- Test: `tests/shop/useShopList.test.js`

**Interfaces:**
- Consumes: `mondayOf`, `addWeeks`, `isCurrentWeek` (Task 1); `joinItems`, `applyPurchaseChange`, `applyProductChange`, `groupItems` (Task 3); RPCs `shop_seed_week` and `shop_week_summary` (Task 2).
- Produces: `useShopList({ client, user, showToast })`, which returns:
  - `week: Ref<string>`, `readOnly: ComputedRef<boolean>` (true unless it's the current week), `items: Ref<Item[]>`, `supermarkets: Ref<{id,name}[]>`, `summary: Ref<object|null>`, `loading: Ref<boolean>`, `pendingIds: Ref<Set<string>>`
  - `load(): Promise<void>`. If it's the current week: `rpc('shop_seed_week')`. Then fetch the products (all of them, for the join), the week's rows, the supermarkets and the summary.
  - `goToWeek(delta: -1|1): Promise<void>`. Refuses to move past the current week.
  - `checkOff(item, { unit_price, quantity, unit, supermarket }): Promise<boolean>`. Writes `checked:true, checked_by:user.id, checked_at:now`.
  - `uncheck(item): Promise<boolean>`
  - `updateQuantity(item, { quantity, unit }): Promise<boolean>`
  - `removeFromWeek(item): Promise<boolean>` (`delete` by id)
  - `addSupermarket(name): Promise<{id,name}|null>`
  - `start()`: subscribes to channel `shop:<week>` (purchases filtered `week_of=eq.<week>`, unfiltered purchase DELETEs, products, supermarkets) and adds a `visibilitychange` listener that runs `load()` when the page becomes visible. `stop()` removes both. Changing week calls stop then start.
  - After any purchase change (local or realtime), refresh `summary` with a 300 ms debounce.

- [ ] **Step 1: Write the failing tests**
  - `load` in the current week calls `rpc('shop_seed_week', {p_week})` before selecting rows. In a past week it doesn't call it.
  - If the seed RPC returns `{data:false}` (another phone seeded first), `load` still fetches and shows the rows (Review Focus 1).
  - `goToWeek(1)` while on the current week leaves `week` unchanged and makes no calls.
  - `checkOff` updates `items` optimistically. When the fake returns `{error:{}}`, the item goes back to unchecked and `showToast` receives `No pudimos guardar. Revisa tu conexión.` (Review Focus 3).
  - Calling `checkOff` twice on the same item before the first resolves sends one update. `pendingIds` holds the id while the write is in flight.
  - `checkOff` while `readOnly` makes no calls and returns false.
  - The update payload never contains `last_price`.
  - `stop()` calls `removeChannel` and removes the `visibilitychange` listener.
- [ ] **Step 2:** Run `npm test -- useShopList`. Expected: FAIL.
- [ ] **Step 3:** Implement. Inject `client`, which defaults to `supabase` from `src/supabase.js`, so tests can pass the fake.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit: `feat(shop): useShopList composable with seeding, realtime and optimistic writes`.

---

### Task 5: Compras tab, list view and check-off sheet

**Files:**
- Modify: `src/App.vue:70` (add `{id:'compras',label:'Compras',icon:'🛒'}` to `nav`). Add a `pageDescription` entry: `'La lista de la semana, entre todos.'`. Render `<ShopList v-if="activeTab==='compras'" :user="user" @toast="showToast" />` in place of the generic `other-page` section for this tab.
- Create: `src/components/ShopList.vue`
- Create: `src/components/ShopCheckoffSheet.vue`
- Modify: `src/style.css` (shop list styles, using the existing panel and button classes where they fit)
- Test: `tests/components/ShopCheckoffSheet.test.js`

**Interfaces:**
- Consumes: `useShopList` (Task 4), `weekLabel` (Task 1), `groupItems` (Task 3).
- Produces:
  - `ShopCheckoffSheet` props `{ item: Item, supermarkets, defaultSupermarket: string|null }`, emits `save({unit_price, quantity, unit, supermarket})`, `add-supermarket(name)`, `close`.
  - `localStorage` key `shop:lastSupermarket` holds the last-used supermarket name. Wrap every access in try/catch.

**What the user sees:**
- Header: `weekLabel`, the previous/next buttons (next disabled on the current week), and the week total from `summary.week_total`.
- Search input with placeholder `Buscar producto`.
- Sections `Por comprar (n)` and `Comprados (n)`. A row shows the thumbnail (Task 7), name, quantity and unit, and the last price as `Último: C$x`. Checked rows also show the unit price and supermarket. No name of who checked it.
- Tapping a pending row opens the sheet. Tapping a checked row asks `¿Desmarcar?` and then calls `uncheck`.
- A row menu (`···`) has `Cambiar cantidad` and `Quitar de esta semana`. The second asks `¿Quitar {name} de la lista de esta semana?` before calling `removeFromWeek`.
- Read-only weeks hide every action.
- When `!supabaseReady`, show only `Configuración requerida para usar la lista de compras.`

- [ ] **Step 1: Write the failing component tests**
  - The sheet prefills the price with `item.product.last_price` and the supermarket with `defaultSupermarket`.
  - `Guardar` is disabled until both price (≥ 0) and supermarket are set.
  - Saving emits `save` with numbers, not strings: `{unit_price: 6.25, quantity: 2, unit: 'l', supermarket: 'Pali'}`.
  - Typing a new supermarket name and choosing `Agregar "{name}"` emits `add-supermarket`.
- [ ] **Step 2:** Run `npm test -- ShopCheckoffSheet`. Expected: FAIL.
- [ ] **Step 3:** Implement both components and wire up `App.vue`.
- [ ] **Step 4:** Run `npm test` and `npm run build`. Expected: both pass.
- [ ] **Step 5:** Run `npm run dev` against the Supabase project and check by hand with two browser windows. Check off in A and it moves in B within about 1 s. Uncheck in B. Remove an item and reload: it stays removed.
- [ ] **Step 6:** Commit: `feat(shop): compras tab with weekly list and check-off sheet`.

---

### Task 6: Catalog management

**Files:**
- Create: `src/components/ShopCatalog.vue` (opened from a `Productos` button in the ShopList header)
- Modify: `src/composables/useShopList.js`
- Test: `tests/shop/useShopList.test.js` (extend it)

**Interfaces:**
- Produces, on `useShopList`:
  - `products: Ref<Product[]>`, every product including inactive ones
  - `addProduct(name): Promise<Product|null>`: inserts the product. In the current week it also inserts a `shop_purchases` row for it (decision 18).
  - `renameProduct(product, name): Promise<boolean>`
  - `setProductActive(product, active): Promise<boolean>`

- [ ] **Step 1: Write the failing tests**
  - `addProduct('Pan')` in the current week inserts the product, then a purchase row `{product_id, week_of: week}`. In a past week it only inserts the product.
  - `addProduct('  ')` makes no calls and returns null.
  - `setProductActive(p, false)` updates only `active` and leaves this week's row alone (the list doesn't change on its own).
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement, plus `ShopCatalog.vue`: two sections, `Activos` and `Inactivos`, with rename inline and `Desactivar` / `Reactivar` buttons.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(shop): product catalog management`.

---

### Task 7: Product photos

**Files:**
- Create: `src/shop/photos.js`
- Modify: `src/components/ShopCatalog.vue` (`Foto` button: `<input type="file" accept="image/*" capture="environment">`), `src/components/ShopList.vue` (40 px thumbnail, with a placeholder when there's no photo)
- Test: `tests/shop/photos.test.js`

**Interfaces:**
- Produces:
  - `photoPath(productId: string, uuid?: string) => string` returns `${productId}/${uuid}.jpg`
  - `fitWithin(w, h, max = 800) => {width, height}`
  - `compressImage(file: File) => Promise<Blob>`: `createImageBitmap`, then a canvas sized by `fitWithin`, then `toBlob('image/jpeg', 0.8)`
  - `publicPhotoUrl(client, path) => string|null`
  - On `useShopList`: `setProductPhoto(product, file): Promise<boolean>`. Compress, upload to a new `photoPath` with `upsert:false`, then update `photo_path`. If the update fails, remove the uploaded object. Members can't delete objects, so treat that removal as best effort and ignore errors.

- [ ] **Step 1: Write the failing tests:** `fitWithin(4000,3000)` returns `{width:800,height:600}`. `fitWithin(500,300)` stays unchanged. `photoPath('p1','u1')` returns `'p1/u1.jpg'`. `setProductPhoto` never calls upload with `upsert:true`, and makes two calls with two different paths.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: pass. Then upload a photo of about 5 MB from a phone. The stored object should be under 200 KB, and the thumbnail should show up on a second device through realtime.
- [ ] **Step 5:** Commit: `feat(shop): product photos with client-side compression`.

---

### Task 8: Receipts, past weeks and sharing

**Files:**
- Create: `src/components/ShopReceipts.vue` (under the list, or a `Recibos` toggle on small screens)
- Test: `tests/components/ShopReceipts.test.js`

**Interfaces:**
- Consumes: `summary` (Task 4), `receiptText` (Task 3), `weekLabel` (Task 1).
- Produces: `ShopReceipts` props `{ summary, week }`.

**What the user sees:** one card per supermarket with its lines (`name ×qty unit — C$line total`) and subtotal, then `Total de la semana`. A `Compartir` button calls `navigator.share({ text })` when it exists. Otherwise it calls `navigator.clipboard.writeText` and shows the toast `Recibo copiado`. Past weeks reached with the Task 5 buttons show the same view, read-only. If nothing is checked yet: `Todavía no hay compras esta semana.`

- [ ] **Step 1: Write the failing tests:** two receipts render two cards in supermarket order. `Compartir` with no `navigator.share` calls `clipboard.writeText` with `receiptText(...)`. An empty `receipts` array shows the empty-state copy.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(shop): per-supermarket receipts and sharing`.

---

### Task 9: Dashboard card and trends

**Files:**
- Create: `src/components/ShopDashboardCard.vue`
- Create: `src/components/ShopTrends.vue` (inside ShopList behind a `Tendencias` toggle)
- Modify: `src/App.vue` (render the card in the `inicio` dashboard grid; clicking it sets `activeTab='compras'`)
- Modify: `src/composables/useShopList.js`
- Test: `tests/shop/useShopList.test.js` (extend it)

**Interfaces:**
- Produces, on `useShopList`:
  - `weeklyTotals(): Promise<{week_of,total}[]>` (RPC `shop_weekly_totals`, `p_weeks: 8`)
  - `priceHistory(productId): Promise<{week_of, unit_price, supermarket}[]>`: checked rows for that product, newest first, limit 12
- The dashboard card uses its own lightweight query (current week's counts plus `shop_week_summary`). It doesn't subscribe to realtime. It shows `{pending} por comprar · C${total} gastado`.
- Trends: 8 bars of weekly spend as plain inline SVG, no chart library, with the value labelled on each bar. Tapping a product in the catalog shows its price history as a list.

- [ ] **Step 1: Write the failing tests:** `weeklyTotals` calls `rpc('shop_weekly_totals', {p_weeks: 8})`. `priceHistory` filters `checked = true` and `product_id`, orders by `week_of` descending, and limits to 12.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: pass.
- [ ] **Step 5:** Commit: `feat(shop): dashboard card and spending trends`.

---

### Task 10: Push notifications for "started" and "finished" shopping

**Files:**
- Modify: `supabase/functions/send-push/index.ts`
- Create: `src/shop/shoppingEvents.js`
- Modify: `src/composables/useShopList.js` (after a successful `checkOff`)
- Test: `tests/shop/shoppingEvents.test.js`

**Interfaces:**
- Produces:
  - `shoppingEvent(itemsBefore: Item[], itemsAfter: Item[]) => 'started'|'finished'|null`. `'started'` when the done count goes from 0 to 1. `'finished'` when the pending count goes from 1 to 0. If both happen at once (a 1-item list), return `'finished'`.
  - `notifyShopping(client, event)`: `client.functions.invoke('send-push', { body: { title, message, url: '/?tab=compras', exclude_user_id: user.id } })`. Copy: started is `Alguien empezó las compras` / `Mirá la lista de la semana.`; finished is `¡Compras terminadas!` / `Ya está todo comprado esta semana.`. Errors are ignored, because a failed notification must never fail a check-off.
  - `send-push` changes. Required fix: today the function accepts **any** `Authorization` header and sends with the service role. Anyone holding the public anon key can push to every subscription.
    1. With a bearer token, resolve the caller with `supabase.auth.getUser(token)` and require a row in `private.family_members` for their email (`rpc('is_email_allowed')`, or a select with the service role). If either check fails, return 401.
    2. The cron-secret path stays as it is.
    3. A new optional `exclude_user_id` filters subscriptions with `.neq('user_id', exclude_user_id)`.
    4. Delete subscriptions whose send rejects with status 404 or 410 (expired endpoints).
- `App.vue`: on mount, read `?tab=` and set `activeTab` when it matches a nav id. Clicking a notification then opens Compras.

- [ ] **Step 1: Write the failing tests** for `shoppingEvent`: 0→1 done gives `'started'`; 1→0 pending gives `'finished'`; 2→3 done gives `null`; a 1-item list going 0→1 done gives `'finished'`. For `notifyShopping`: a rejected `invoke` doesn't throw.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the client side and the function changes.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: pass. Deploy with `supabase functions deploy send-push`. Check with curl:
  - with only the anon key as bearer: expected `401`;
  - with a family member's access token: expected `{"sent":n,"failed":0}`.
- [ ] **Step 5:** Commit: `feat(push): shopping start/finish notifications; require family member to send`.

---

### Task 11: VAPID keys for Vercel and Supabase

No code tests. This task is configuration plus docs, with verification at the end.

**Files:**
- Modify: `README.md` (replace the "Notificaciones push" setup steps with the exact commands below; add a "Despliegue en Vercel" section)
- Modify: `.env.example` (keep only `VITE_VAPID_PUBLIC_KEY` for push, with a comment that the private key belongs in Supabase only)

- [ ] **Step 1: Generate one key pair, once.** Run it locally, never in CI:

  ```sh
  npx web-push generate-vapid-keys --json > vapid.json   # do not commit; add vapid.json to .gitignore
  ```

  Store both keys in the family's password manager. Rotating the pair later invalidates every existing subscription.
- [ ] **Step 2: Vercel gets the public key only.** Vite inlines it at build time.

  ```sh
  vercel link
  for env in production preview development; do
    jq -r .publicKey vapid.json | vercel env add VITE_VAPID_PUBLIC_KEY "$env"
  done
  ```

  Also confirm that `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` exist for all three environments (`vercel env ls`).
- [ ] **Step 3: Supabase gets the full pair.**

  ```sh
  supabase secrets set \
    VAPID_PUBLIC_KEY="$(jq -r .publicKey vapid.json)" \
    VAPID_PRIVATE_KEY="$(jq -r .privateKey vapid.json)" \
    VAPID_SUBJECT="mailto:<family contact email>" \
    CRON_SECRET="$(openssl rand -hex 32)"
  ```

  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into Edge Functions automatically, so don't set them.
- [ ] **Step 4: Redeploy so the new key is in the bundle.** Run `vercel --prod`, or push to the production branch. An environment variable change has no effect until a rebuild.
- [ ] **Step 5: Verify.**
  - On the deployed site, `Notificaciones` → allow. A row appears in `push_subscriptions`.
  - On a second account's phone, check off the week's first item. The first phone receives `Alguien empezó las compras`. The sender doesn't.
  - `grep -r "privateKey\|VAPID_PRIVATE" dist/` → no matches.
- [ ] **Step 6:** Delete `vapid.json` from disk once the keys are stored. Commit the README and `.env.example`: `docs: VAPID setup for Vercel and Supabase`.

---

## Execution order and dependencies

Task 1 → 2 → 3 → 4 → 5, then 6, 7, 8 and 9 in any order (each extends Task 4/5), then 10 → 11. Task 11's Vercel and Supabase steps need someone with access to those accounts. The session can prepare the commands and docs but can't run `vercel env add` or `supabase secrets set` on the family's projects.
