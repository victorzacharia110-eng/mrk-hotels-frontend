# MRK Hotels — Review Batch 04 · Laundry Cloth-Type Registry & Auto-Pricing (Problem & Solution)

**Module:** Laundry — **Status: Resolved** — **5 September 2026**

---

## 1. The Problem

Laundry line items were built from **free-typed names with hand-entered unit prices**. There was no price list and no inventory of the cloth/linen types a hotel actually launders.

**What this meant in practice:**

- Prices drifted: the same "bed sheet" could be charged differently by different attendants, or across days.
- No hotel had a manageable, reviewable laundry price list (wash / iron / dry-clean).
- Data was inconsistent — typo'd item names made reporting and charges unreliable.

## 2. Root Cause

- `laundry_order_items` had only free-text `item_name` + numeric `unit_price`, with **no link** to any registered product.
- There was **no model, controller or routes** for a cloth-type catalogue.
- The order endpoints simply trusted whatever `unit_price` the client sent; nothing locked the price to a list.

## 3. The Solution

### 3.1 Backend — a first-class cloth-type registry

- New table `cloth_types` (via migration):

| Column | Notes |
| --- | --- |
| `cloth_type_id` | UUID primary key |
| `tenant_id` | FK → hotels (tenant scoped) |
| `name` | Display name (e.g. "Bed sheet") |
| `wash_price`, `iron_price`, `dry_clean_price` | Price per service |
| `is_active` | Soft enable/disable for the item picker |
| `timestamps` | created_at / updated_at |

- `laundry_order_items.cloth_type_id` added (nullable FK, `nullOnDelete`) so existing free-form items keep working.
- New `App\Models\Laundry\ClothType` model with a `priceFor(service)` helper (wash / iron / dry_clean → the matching price column).
- New `ClothTypeController` with full CRUD (`index`, `show`, `store`, `update`, `destroy`), tenant-scoped and audit-logged like the rest of the API.
- New routes in `api.php` under `laundry-cloth-types`:
  - `GET /laundry-cloth-types` — level 40
  - `POST/PUT/DELETE` — level 40 + operate permission

### 3.2 Backend — prices locked to the registry

- `LaundryOrderController` now validates `items.*.cloth_type_id` (`exists:cloth_types,cloth_type_id`).
- New `resolveItemUnitPrice($item, $service)`:
  - When the item selects a registered cloth type, the **registry price for the order's service wins** — the client's `unit_price` is ignored.
  - Free-form items (no cloth type) keep whatever price was sent.
- `store` and `update` compute every item's `subtotal`, `items_count` and `total_charge` from these resolved prices, so the estimate can never drift from the published price list.

### 3.3 Frontend — manage the registry

- New `src/pages/laundry/ClothTypesPage.vue`: searchable table, add/edit modal, delete; gated by `canManage` (level 40 + operate).
- New route `laundry/cloth-types` mounted under the Store layout.
- New `clothTypeApi` client (`index` / `store` / `update` / `destroy`).
- i18n keys added to **both** `en.json` and `sw.json` (`clothTypes.*` + `laundry.*`).

### 3.4 Frontend — use the registry in the order form

- The item picker in `LaundryListPage.vue` is now a **SearchableSelect over active cloth types**.
- Selecting a cloth type auto-fills:
  - `item_name` = the cloth type's name,
  - `unit_price` = the registry price **for the currently selected service**.
- The price input becomes **read-only** once a cloth type is chosen.
- Switching the order's service re-prices every registry-backed line automatically (a `watch` on `form.service`).
- When a hotel has **no cloth types** registered yet, the form falls back to the legacy free-text + manual price input, so nothing breaks for hotels that haven't populated the list.

## 4. Files Changed

| Area | File | Change |
| --- | --- | --- |
| Backend | `database/migrations/2026_09_05_000004_create_cloth_types_table.php` | New `cloth_types` table |
| Backend | `database/migrations/2026_09_05_000005_add_cloth_type_id_to_laundry_order_items.php` | `cloth_type_id` FK on items |
| Backend | `app/Models/Laundry/ClothType.php` | Model + `priceFor()` |
| Backend | `app/Models/Laundry/LaundryOrderItem.php` | `cloth_type_id` fillable + `clothType()` relation |
| Backend | `app/Http/Controllers/Api/V1/Laundry/ClothTypeController.php` | CRUD controller |
| Backend | `app/Http/Controllers/Api/V1/Laundry/LaundryOrderController.php` | Validation + `resolveItemUnitPrice()` auto-pricing |
| Backend | `routes/api.php` | `laundry-cloth-types` routes |
| Frontend | `src/pages/laundry/ClothTypesPage.vue` | Registry management page |
| Frontend | `src/api/index.js` | `clothTypeApi` |
| Frontend | `src/router/index.js` | `laundry/cloth-types` route |
| Frontend | `src/pages/laundry/LaundryListPage.vue` | Cloth-type item picker + auto price |
| Frontend | `src/locales/en.json`, `sw.json` | New keys (both languages) |
| Tests | `tests/Feature/ClothTypeTest.php` | Registry CRUD + auto-pricing tests |

## 5. Verification Results

- New `ClothTypeTest` covers: CRUD round-trip, tenant isolation, and auto-pricing for **wash + iron** from the registry.
- Backend full suite — **569 passed / 2305 assertions** (incl. migration-phase policy check for the two new migrations).
- Frontend `vite build` — **clean**; Vitest **107/107 passed**.
- Migrations verified additive in `up()` per the repo's expansion-phase policy.

## 6. Result

Every hotel now has a real, manageable laundry price list. Selecting a cloth type produces the correct item name and service-specific price automatically, order totals are computed server-side from the published list, and hotels that haven't set up cloth types keep the original free-form flow.