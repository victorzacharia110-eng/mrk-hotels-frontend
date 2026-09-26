<!--
  NewOrderModal — shared order builder for every POS ordering mode.

  Props select the mode and prefill the header (table, room, guest...);
  the cashier searches the menu, adds line items with quantities, then
  posts the order stamped with the currently selected outlet.
-->

<template>
  <!-- Teleported so the backdrop is never trapped under the layout's stacking
       contexts; the served-with popup layers above it via z-index. -->
  <Teleport to="body">
  <div class="sm-modal-backdrop order-modal-backdrop" @click.self="$emit('close')">
    <div class="sm-modal wide order-modal" role="dialog" aria-modal="true">
      <div class="sm-modal-head">
        <h3><i class="fas fa-cart-plus" aria-hidden="true"></i> {{ title }}</h3>
        <button class="sm-btn ghost sm" @click="$emit('close')">{{ $t('common.cancel') }}</button>
      </div>

      <div class="order-grid">
        <section class="order-items">
          <div class="sm-search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input v-model="search" type="search" :placeholder="$t('cashier.order.searchItems')" />
          </div>

          <div class="menu-bar">
            <div class="dept-toggle" role="group" :aria-label="$t('cashier.order.department')">
              <button type="button" class="dept-btn" :class="{ active: dept === 'restaurant' }" @click="dept = 'restaurant'">
                <i class="fas fa-utensils" aria-hidden="true"></i> {{ $t('cashier.order.restaurant') }}
              </button>
              <button type="button" class="dept-btn" :class="{ active: dept === 'bar' }" @click="dept = 'bar'">
                <i class="fas fa-martini-glass-citrus" aria-hidden="true"></i> {{ $t('cashier.order.bar') }}
              </button>
            </div>
            <span v-if="deptLoading" class="dept-loading">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> {{ $t('common.loading') }}
            </span>
          </div>

          <div class="cat-list">
            <div v-for="(itemsInCat, cat) in filteredMenu" :key="cat" class="cat-group">
              <p class="cat-title">{{ cat }}</p>
              <button v-for="item in itemsInCat" :key="item.menu_item_id" class="cat-item"
                :disabled="!item.is_available || item.is_in_stock === false" @click="addItem(item)">
                <span class="cat-item-name">{{ item.item_name }}</span>
                <!-- Review item 4: take-away, room service and delivery order
                     screens must show the live count of the stock this item
                     draws on. A recipe-tracked item reports the servings its
                     ingredients can still cover, so it is labelled as such
                     rather than as raw units. -->
                <span v-if="item.quantity_on_hand !== null && item.quantity_on_hand !== undefined" class="cat-item-stock">
                  <i class="fas fa-boxes-stacked" aria-hidden="true"></i>
                  <template v-if="item.ingredient_count > 0">
                    {{ $t('cashier.order.servingsLeft', { qty: item.quantity_on_hand }) }}
                  </template>
                  <template v-else>
                    {{ $t('cashier.order.stockCount', { qty: item.quantity_on_hand, unit: item.linked_item_unit || '' }) }}
                  </template>
                </span>
                <span class="cat-item-price">{{ money(item.price) }}</span>
              </button>
            </div>
            <button v-if="hasMore" type="button" class="load-more" :disabled="deptLoading" @click="loadMenu(menuPage + 1)">
              <i class="fas fa-ellipsis-h" aria-hidden="true"></i> {{ $t('cashier.order.loadMore') }}
            </button>
            <p v-if="!Object.keys(filteredMenu).length" class="empty">{{ $t('cashier.order.noItems') }}</p>
          </div>
        </section>

        <section class="order-side">
          <div class="fld-col">
            <label class="fld-label" for="no-guest">{{ $t('cashier.order.guestName') }}</label>
            <input id="no-guest" v-model="form.guest_name" class="sm-input" type="text" />
          </div>

          <div class="fld-col">
            <label class="fld-label" for="no-room">{{ $t('cashier.order.assignRoom') }}</label>
            <SearchableSelect
              id="no-room"
              v-model="form.room_number"
              :options="roomOptions"
              :placeholder="roomPlaceholder"
              :empty-label="$t('common.none')"
              :disabled="busy"
              @change="onRoomPicked"
            />
            <p class="fld-hint"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.order.assignRoomHint') }}</p>
          </div>

          <div class="fld-col">
            <label class="fld-label" for="no-waiter">{{ $t('cashier.order.waiter') }}</label>
            <SearchableSelect
              v-model="form.waiter_name"
              :options="waiterOptions"
              :placeholder="$t('cashier.order.waiter')"
              :empty-label="$t('common.none')"
            />
          </div>

          <div v-if="mode === 'delivery'" class="fld-row2">
            <div class="fld-col">
              <label class="fld-label" for="no-phone">{{ $t('cashier.order.deliveryPhone') }} *</label>
              <input id="no-phone" v-model="form.delivery_phone" class="sm-input" type="tel" />
            </div>
            <div class="fld-col">
              <label class="fld-label" for="no-mins">{{ $t('cashier.order.expectedMinutes') }}</label>
              <input id="no-mins" v-model.number="form.expected_minutes" class="sm-input" type="number" min="5" max="240" />
            </div>
          </div>
          <div v-if="mode === 'delivery'" class="fld-col">
            <label class="fld-label" for="no-addr">{{ $t('cashier.order.deliveryAddress') }} *</label>
            <textarea id="no-addr" v-model="form.delivery_address" class="sm-textarea" rows="2"></textarea>
          </div>

          <div v-if="mode === 'no_charge'" class="fld-col">
            <label class="fld-label" for="no-account">{{ $t('cashier.order.selectAccount') }} *</label>
            <SearchableSelect
              id="no-account"
              v-model="form.no_charge_account"
              :options="accountOptions"
              :placeholder="$t('cashier.order.accountPlaceholder')"
              :empty-label="$t('cashier.order.accountEmpty')"
              :empty-as-hint="true"
              :force-search="true"
              :required="true"
              :disabled="busy"
            />
            <!-- Item 7: with an empty registry the picker is a dead end, so it
                 says where to register the account and offers the link. -->
            <p v-if="!accountOptions.length" class="fld-hint">
              <i class="fas fa-circle-info" aria-hidden="true"></i>
              {{ $t('cashier.order.accountRegistryEmpty') }}
              <router-link :to="{ name: 'cashier-account-lookup' }">{{ $t('cashier.order.accountRegistryLink') }}</router-link>
            </p>
            <p v-else class="fld-hint"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.order.accountHint') }}</p>
            <p v-if="accountError" class="form-error"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ accountError }}</p>
          </div>

          <div v-if="mode === 'dine_in'" class="fld-col">
            <label class="fld-label" for="no-covers">{{ $t('cashier.order.covers') }}</label>
            <input id="no-covers" v-model.number="form.covers" class="sm-input" type="number" min="0" max="999" />
          </div>

          <div class="lines">
            <p class="fld-label">{{ $t('cashier.order.lines') }}</p>
            <p v-if="!lines.length" class="empty">{{ $t('cashier.order.emptyLines') }}</p>
            <div v-for="(line, idx) in lines" :key="line.menu_item_id" class="line-row">
              <span class="line-name">{{ line.name }}</span>
              <div class="line-qty">
                <button class="qty-btn" @click="dec(idx)" :aria-label="$t('common.decrement')">−</button>
                <strong>{{ line.quantity }}</strong>
                <button class="qty-btn" @click="inc(idx)" :aria-label="$t('common.increment')">+</button>
              </div>
              <span class="line-sum">{{ money(line.price * line.quantity) }}</span>
              <button class="line-del" @click="lines.splice(idx, 1)" :aria-label="$t('common.delete')">
                <i class="fas fa-trash-can" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <div class="order-total">
            <span>{{ $t('cashier.order.total') }}</span>
            <strong>{{ money(total) }}</strong>
          </div>

          <p v-if="error" class="form-error">{{ error }}</p>

          <button class="sm-btn success submit-btn" :disabled="busy || !lines.length" @click="submit">
            <i class="fas fa-check" aria-hidden="true"></i> {{ busy ? $t('common.saving') : $t('cashier.order.placeOrder') }}
          </button>
        </section>
      </div>
    </div>
  </div>
  </Teleport>

  <Teleport to="body">
    <Transition name="fade">
      <div v-if="accompItem" class="cat-pop" role="dialog" :aria-label="$t('orders.servedWithTitle')">
        <div class="cat-pop-backdrop" @click="skipAccompaniment"></div>
        <div class="cat-pop-panel accomp-panel">
          <header class="cat-pop-head">
            <strong>{{ $t('orders.servedWithTitle') }}</strong>
            <div class="cat-pop-head-actions">
              <button
                v-if="canManageSides"
                type="button"
                class="cat-pop-close"
                :title="$t('orders.manageSides')"
                :aria-label="$t('orders.manageSides')"
                @click="manageAccompaniments"
              >
                <i class="fas fa-plus" aria-hidden="true"></i>
              </button>
              <button type="button" class="cat-pop-close" :aria-label="$t('common.close')" @click="skipAccompaniment">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
          </header>
          <p class="accomp-hint">
            {{ $t('orders.servedWithHint', { item: accompItem.item_name }) }}
          </p>
          <div class="accomp-grid">
            <button
              v-for="option in accompanimentOptions"
              :key="option.value"
              type="button"
              class="accomp-option"
              @click="pickAccompaniment(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Register restaurant "served with" sides (cashier-owned) from the prompt. -->
  <AccompanimentManager
    v-if="showAccompanimentManager"
    :department="'restaurant'"
    :lock-department="true"
    @close="showAccompanimentManager = false"
    @changed="loadAccompaniments(true)"
  />
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { menuItemApi, orderApi } from '@/api'
import { selectedOutlet } from '@/pages/cashier/outlet-context'
import SearchableSelect from '@/components/SearchableSelect.vue'
import AccompanimentManager from '@/components/AccompanimentManager.vue'
import { usePrintSettingsStore } from '@/stores/printSettings'
import { useAuthStore } from '@/stores/auth'
import { displayLines } from '@/utils/receipts'
import { isGrillMenuItem, canManageAccompaniments } from '@/utils/menuAccompaniment'
import { useAccompaniments } from '@/composables/useAccompaniments'
import { toast } from '@/utils/toast'

const props = defineProps({
  mode: { type: String, default: 'dine_in' }, // dine_in | takeaway | room_service | delivery | no_charge
  title: { type: String, required: true },
  tableNumber: { type: String, default: null },
  roomNumber: { type: String, default: null },
  guestNamePrefill: { type: String, default: '' },
  knownAccounts: { type: Array, default: () => [] },
  // Registered F&B credit accounts (from fnb/credit-accounts) shown in the
  // no-charge account picker ahead of the legacy hard-coded account list.
  creditAccounts: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'created'])

const { t } = useI18n()
const printStore = usePrintSettingsStore()
const authStore = useAuthStore()

/** The logged-in cashier/bartender's display name — used to default the waiter. */
const selfName = computed(
  () =>
    authStore.user?.full_name ||
    authStore.user?.name ||
    [authStore.user?.first_name, authStore.user?.last_name].filter(Boolean).join(' ') ||
    '',
)

const menu = ref([])
const waiters = ref([])
const inHouseRooms = ref([])
const search = ref('')
const lines = ref([])
const busy = ref(false)
const error = ref('')
/** Grill item waiting for its "served with" side-dish choice. */
const accompItem = ref(null)

// Department the order is stamped with, also driving which menu lists. A
// bartender opens on the BAR menu, a cashier on the RESTAURANT menu; either
// can flip the toggle to offer items from the other outlet.
const dept = ref(authStore.user?.user_role === 'bartender' ? 'bar' : 'restaurant')
const deptLoading = ref(false)
const menuPage = ref(1)
const menuTotal = ref(0)
const menuPerPage = 100
const hasMore = computed(() => menu.value.length < menuTotal.value)

/** Fetches one page of menu items for the active department, appending pages. */
async function loadMenu(page = 1) {
  deptLoading.value = true
  try {
    const { data } = await menuItemApi.index({
      department: dept.value,
      per_page: menuPerPage,
      page,
    })
    const rows = data.data || data
    menu.value = page === 1 ? rows : [...menu.value, ...rows]
    menuTotal.value = data.total ?? rows.length
    menuPage.value = page
  } catch (e) {
    error.value = e.message
  } finally {
    deptLoading.value = false
  }
}

/** Reloads from the first page whenever the outlet toggle changes. */
watch(dept, () => {
  search.value = ''
  // The ticket lines were priced against the menu they were taken from; keep
  // them, but the freshly selected outlet drives the next picks.
  loadMenu(1)
})

const form = reactive({
  guest_name: props.guestNamePrefill || '',
  room_number: props.roomNumber || '',
  // Default the waiter to the person taking the order (cashier/bartender).
  // They can still reassign it to another waiter via the searchable select.
  waiter_name: selfName.value,
  covers: null,
  no_charge_account: '',
  delivery_phone: '',
  delivery_address: '',
  expected_minutes: 30,
})

const waiterOptions = computed(() =>
  waiters.value.map(w => ({ value: w.full_name, label: w.full_name }))
)

/** In-house rooms as searchable "Room N — Guest" choices for room billing. */
const roomOptions = computed(() =>
  inHouseRooms.value.map((room) => ({
    value: room.room_number,
    label: `${room.room_number} — ${room.guest_name || ''}`,
  })),
)

const roomPlaceholder = computed(() => t('cashier.order.assignRoom'))

/** Fills in the guest auto-name when the cashier picks a room to bill. */
function onRoomPicked(value) {
  const room = inHouseRooms.value.find((r) => r.room_number === value)
  if (room?.guest_name) form.guest_name = room.guest_name
}

// Order type derived from the modal's POS mode; department comes from the toggle.
const ORDER_TYPE = {
  dine_in: 'dine_in',
  takeaway: 'takeaway',
  room_service: 'room_service',
  delivery: 'delivery',
  no_charge: 'no_charge',
}

/** No-charge accounts to offer: registered registry entries first, then the
    legacy hard-coded list the cashier panel used to suggest. */
const accountOptions = computed(() => {
  const seen = new Set()
  const options = []
  for (const account of props.creditAccounts) {
    const value = account.name?.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    options.push({ value, label: value })
  }
  for (const value of props.knownAccounts) {
    const name = typeof value === 'string' ? value.trim() : value?.name?.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    options.push({ value: name, label: name })
  }
  return options
})

/** Inline error for the account field, cleared as soon as one is picked. */
const accountError = ref('')
watch(
  () => form.no_charge_account,
  (value) => {
    if (value?.trim()) accountError.value = ''
  },
)

const total = computed(() => lines.value.reduce((sum, l) => sum + l.price * l.quantity, 0))

const filteredMenu = computed(() => {
  const term = search.value.trim().toLowerCase()
  const groups = {}
  for (const item of menu.value) {
    if (term && !`${item.item_name} ${item.category || ''}`.toLowerCase().includes(term)) continue
    const key = item.category || t('cashier.order.uncategorized')
    ;(groups[key] ||= []).push(item)
  }
  return groups
})

function addItem(item) {
  if (isGrillItem(item)) {
    accompItem.value = item
    return
  }
  commitItem(item, '')
}

/** "Served with" side-dish choices for grill-style mains (mshikaki, choma...). */
const { accompanimentOptions, loadAccompaniments } = useAccompaniments(t, 'restaurant')

// The cashier owns the restaurant list, so they may register a missing side
// straight from the prompt without leaving the order.
const canManageSides = computed(() => canManageAccompaniments(authStore.user?.user_role))
const showAccompanimentManager = ref(false)

/** Opens the registry (closing the prompt) so the cashier can add a side. */
function manageAccompaniments() {
  accompItem.value = null
  showAccompanimentManager.value = true
}

function isGrillItem(item) {
  return isGrillMenuItem(item)
}

function accompanimentLabel(value) {
  return accompanimentOptions.value.find((option) => option.value === value)?.label || value
}

function pickAccompaniment(invoiceValue) {
  if (accompItem.value) commitItem(accompItem.value, invoiceValue)
  accompItem.value = null
}

function skipAccompaniment() {
  accompItem.value = null
}

/** Places the item on the ticket, bumping quantity for the same item+side combo. */
function commitItem(item, accompaniment) {
  const key = `${item.menu_item_id}|${accompaniment}`
  const found = lines.value.find((l) => l.key === key)
  if (found) found.quantity += 1
  else lines.value.push({
    key,
    menu_item_id: item.menu_item_id,
    name: accompaniment
      ? `${item.item_name} · ${accompanimentLabel(accompaniment)}`
      : item.item_name,
    accompaniment,
    price: Number(item.price),
    quantity: 1,
  })
}

function inc(idx) {
  lines.value[idx].quantity += 1
}
function dec(idx) {
  if (lines.value[idx].quantity > 1) lines.value[idx].quantity -= 1
}

function money(value) {
  return new Intl.NumberFormat(undefined, { style: 'decimal', maximumFractionDigits: 2 }).format(value ?? 0)
}

async function submit() {
  error.value = ''
  // Item 7: the account is what makes a no-charge order reportable, and the
  // API rejects a blank one with a 422 the cashier cannot act on.
  if (props.mode === 'no_charge' && !form.no_charge_account?.trim()) {
    accountError.value = t('cashier.order.accountRequired')
    return
  }
  busy.value = true
  try {
    const payload = {
      department: dept.value,
      outlet_id: selectedOutlet.value?.outlet_id || null,
      order_type: ORDER_TYPE[props.mode],
      table_number: props.tableNumber,
      room_number: form.room_number || props.roomNumber || null,
      guest_name: form.guest_name || null,
      waiter_name: form.waiter_name || null,
      items: lines.value.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity, accompaniment: l.accompaniment || null })),
    }
    if (props.mode === 'dine_in' && form.covers != null) payload.covers = form.covers
    if (props.mode === 'no_charge') {
      payload.is_no_charge = true
      payload.no_charge_account = form.no_charge_account
    }
    if (props.mode === 'delivery') {
      payload.delivery_phone = form.delivery_phone
      payload.delivery_address = form.delivery_address
      payload.expected_minutes = form.expected_minutes || undefined
    }

    const { data } = await orderApi.store(payload)
    const order = data.order
    emit('created', order)
    emit('close')
    printNewOrder(order)
  } catch (e) {
    error.value = e.response?.data?.message || e.message
  } finally {
    busy.value = false
  }
}

/**
 * Prints the placed order according to the Cloud Print Settings:
 *  - a receipt/guest check on save when "printOnSave" is on;
 *  - a guest check when the order is not settled (left open on a table).
 */
async function printNewOrder(order) {
  if (!order) return
  const printGuestCheck = printStore.printOnSave || printStore.printGuestCheckWhenUnsettled
  if (!printGuestCheck) return
  let full = order
  if (!full.items?.length) {
    try {
      const { data } = await orderApi.show(order.order_id)
      full = data.order
    } catch {
      /* still print with whatever items we have */
    }
  }
  const lines = displayLines(full, 'receipt', {})
  const sent = await printStore.print(lines)
  if (!sent) toast(t('orderTaker.noPrinter'), 'error')
}

onMounted(async () => {
  await loadMenu(1)
  try {
    const { data } = await orderApi.formOptions()
    waiters.value = data.waiters || []
    inHouseRooms.value = data.in_house_guests || []
    // Snap the prefilled waiter to the exact waiter-list entry (case/spacing
    // differences between the auth profile and the waiter roster) so the order
    // resolves to a real waiter. Leaves an unmatched name as-is.
    const self = selfName.value.trim().toLowerCase()
    if (self) {
      const match = waiters.value.find((w) => (w.full_name || '').trim().toLowerCase() === self)
      if (match) form.waiter_name = match.full_name
    }
  } catch (e) {
    error.value = e.message
  }
})
</script>

<style scoped>
.order-modal { max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; }
.order-grid { display: grid; grid-template-columns: 1fr 300px; gap: 16px; overflow-y: auto; padding: 16px 18px 18px; }
@media (max-width: 800px) { .order-grid { grid-template-columns: 1fr; } }
.order-items { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.cat-list { max-height: 46vh; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.menu-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dept-toggle { display: inline-flex; border: 1px solid #cbd5e1; border-radius: 9px; overflow: hidden; background: #fff; }
.dept-btn {
  border: none; background: #fff; color: #475569; cursor: pointer;
  font-family: inherit; font-size: 12.5px; font-weight: 600;
  padding: 7px 14px; display: inline-flex; align-items: center; gap: 6px;
}
.dept-btn + .dept-btn { border-left: 1px solid #e2e8f0; }
.dept-btn.active { background: #005eb8; color: #fff; }
.dept-loading { font-size: 12px; color: #94a3b8; display: inline-flex; align-items: center; gap: 6px; }
.cat-title { margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; }
.cat-item {
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  width: 100%; text-align: left; font-family: inherit;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 9px;
  padding: 8px 12px; cursor: pointer; font-size: 13px;
}
.cat-item:hover:not(:disabled) { border-color: #005eb8; background: #e8f1fa; }
.cat-item:disabled { opacity: 0.45; cursor: not-allowed; }
.cat-item-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-item-stock {
  color: #0f766e; font-size: 11.5px; font-weight: 600; white-space: nowrap;
  display: inline-flex; align-items: center; gap: 4px;
}
.cat-item-price { color: #00468c; font-weight: 700; white-space: nowrap; }
.load-more {
  font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  background: #f1f5f9; border: 1px dashed #cbd5e1; color: #005eb8;
  border-radius: 9px; padding: 9px 12px;
}
.load-more:disabled { opacity: 0.55; cursor: wait; }
.order-side { display: flex; flex-direction: column; gap: 10px; }
.fld-col { display: flex; flex-direction: column; gap: 4px; }
.fld-row2 { display: grid; grid-template-columns: 1fr 110px; gap: 10px; }
.fld-label { font-size: 12px; font-weight: 600; color: #475569; }
.fld-hint { margin: 2px 0 0; font-size: 11.5px; color: #94a3b8; display: flex; align-items: center; gap: 4px; }
.sm-input.full { width: 100%; }
.lines { border-top: 1px dashed #e2e8f0; padding-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.line-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.line-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.line-qty { display: inline-flex; align-items: center; gap: 7px; }
.qty-btn {
  width: 22px; height: 22px; border-radius: 6px;
  border: 1px solid #cbd5e1; background: #fff; cursor: pointer;
  font-weight: 700; line-height: 1;
}
.qty-btn:hover { background: #e8f1fa; border-color: #005eb8; color: #005eb8; }
.line-sum { font-weight: 700; color: #0d2b45; min-width: 70px; text-align: right; }
.line-del { border: none; background: none; color: #dc2626; cursor: pointer; }
.order-total {
  display: flex; justify-content: space-between; align-items: center;
  border-top: 2px solid #333333; padding-top: 8px; font-size: 15px;
}
.order-total strong { font-size: 19px; color: #005eb8; }
.form-error { color: #dc2626; font-size: 13px; margin: 0; }
.submit-btn { justify-content: center; }

/* ---- Layering: the teleported modal sits above the layout chrome, and the
     "served with" popup stacks one level above the modal backdrop so picking
     a grill item never looks like a dead darker overlay. ---- */
.order-modal-backdrop { z-index: 1200; }

/* ---- "Served with" popup (single-tap side dish) ---- */
.cat-pop {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.cat-pop-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
}

.cat-pop {
  --pad-accent: #b8860b;
  --pad-accent-deep: #a8871e;
  --pad-accent-soft: #fffbeb;
  --pad-accent-soft-text: #92400e;
}

.cat-pop-panel {
  position: relative;
  background: #fff;
  border-radius: 12px;
  width: min(760px, 94vw);
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.cat-pop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 18px;
  background: #3f3f46;
  color: #fff;
  font-size: 16px;
}

.cat-pop-close {
  border: none;
  background: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
}

.cat-pop-head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.accomp-panel {
  width: min(560px, 94vw);
}

.accomp-hint {
  margin: 0;
  padding: 12px 18px 0;
  color: #71717a;
  font-size: 13px;
}

.accomp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  padding: 16px;
}

.accomp-option {
  border: 1px solid #d4d4d8;
  background: linear-gradient(180deg, #fafafa, #f0f0f2);
  border-radius: 9px;
  padding: 20px 10px;
  font-size: 15px;
  font-weight: 700;
  color: #27272a;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
}

.accomp-option:hover {
  transform: translateY(-2px);
  border-color: var(--pad-accent);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
