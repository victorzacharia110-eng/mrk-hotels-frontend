<!--
  CashierOrderSummaryPage — the working day's ticket list.
  Filter tabs for Running / Settled / Voided with search; each row offers
  freeze/unfreeze (running only), reprint receipt/KOT, recall of a frozen
  ticket back to its table, and settlement for running tickets.
-->

<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="status-tabs">
        <button v-for="tab in filterTabs" :key="tab.key" class="status-tab"
          :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
          {{ tab.label }} <span class="n">{{ tab.count }}</span>
        </button>
      </div>
      <span class="spacer"></span>
      <label class="sm-inline-label" for="sum-date">{{ $t('cashier.summary.workingDate') }}</label>
      <input id="sum-date" v-model="date" type="date" class="sm-input" @change="load" />
      <div class="sm-search">
        <i class="fas fa-search" aria-hidden="true"></i>
        <input v-model="search" type="search" :placeholder="$t('common.search')" />
      </div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div v-if="supported && !printerState.connected" class="printer-banner">
      <i class="fas fa-plug-circle-xmark" aria-hidden="true"></i>
      <span>{{ printerState.reason || $t('cashier.summary.printerNotConnected') }}</span>
      <button class="sm-btn sm primary" :disabled="connecting" @click="connectFromPage">
        <i class="fas fa-plug"></i> {{ connecting ? $t('common.saving') : $t('cashier.summary.connectPrinter') }}
      </button>
    </div>

    <section class="panel">
      <div class="table-scroll">
      <SkeletonLoader v-if="loading" variant="table" :count="8" :cols="7" />
      <table class="sm-table" v-else>
        <thead>
          <tr>
            <th>{{ $t('cashier.summary.order') }}</th>
            <th>{{ $t('cashier.summary.waiter') }}</th>
            <th>{{ $t('cashier.summary.time') }}</th>
            <th>{{ $t('cashier.summary.table') }}</th>
            <th>{{ $t('cashier.summary.type') }}</th>
            <th>{{ $t('common.status') }}</th>
            <th>{{ $t('cashier.summary.amount') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in pagedOrders" :key="order.order_id"
            :class="{ 'row-frozen': order.is_frozen }">
            <td>
              <button type="button" class="order-link" @click="openDrawer(order)"
                :title="$t('cashier.summary.viewOrder')">
                <strong>{{ order.order_number }}</strong>
                <i class="fas fa-book-open" aria-hidden="true"></i>
              </button>
              <span v-if="order.is_frozen" class="frozen-tag"><i class="fas fa-snowflake" aria-hidden="true"></i> {{ $t('storeManager.common.frozen') }}</span>
              <span v-if="order.is_no_charge" class="nc-tag">{{ $t('cashier.noCharge.tag') }}</span>
            </td>
            <td>{{ order.waiter_name || '—' }}</td>
            <td>{{ timeOf(order.created_at) }}</td>
            <td>{{ order.table_number || order.room_number || '—' }}</td>
            <td>{{ typeLabel(order.order_type) }}</td>
            <td><span class="chip" :class="chipFor(order)">{{ statusLabel(order) }}</span></td>
            <td>{{ money(order.total_amount) }}</td>
            <td>
              <div class="row-actions">
                <template v-if="isRunning(order)">
                  <button v-if="!order.is_frozen" class="sm-btn sm" @click="freeze(order)"
                    :title="$t('storeManager.common.freeze')">
                    <i class="fas fa-snowflake" aria-hidden="true"></i> {{ $t('storeManager.common.freeze') }}
                  </button>
                  <button v-else class="sm-btn sm success" @click="unfreeze(order)"
                    :title="$t('storeManager.common.unfreeze')">
                    <i class="fas fa-sun" aria-hidden="true"></i> {{ $t('storeManager.common.unfreeze') }}
                  </button>
                  <button class="sm-btn sm ghost" @click="settle(order)">
                    <i class="fas fa-money-bill" aria-hidden="true"></i> {{ $t('cashier.summary.settle') }}
                  </button>
                </template>
                <button class="sm-btn sm ghost" @click="reprint(order)">
                  <i class="fas fa-print" aria-hidden="true"></i> {{ $t('cashier.summary.reprintReceipt') }}
                </button>
                <button class="sm-btn sm ghost" @click="reprintKot(order)">
                  <i class="fas fa-utensils" aria-hidden="true"></i> {{ $t('cashier.summary.reprintKot') }}
                </button>
                <button v-if="order.is_frozen" class="sm-btn sm ghost" @click="recall(order)">
                  <i class="fas fa-clock-rotate-left" aria-hidden="true"></i> {{ $t('cashier.summary.recall') }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredOrders.length">
            <td colspan="8" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.summary.none') }}</td>
          </tr>
        </tbody>
      </table>
      </div>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
    </section>

    <!-- Order detail drawer: items, total, and settle/edit/void actions -->
    <div v-if="drawerOpen" class="drawer-overlay" @click.self="closeDrawer">
      <aside class="drawer" role="dialog" aria-modal="true" :aria-label="$t('cashier.summary.drawerTitle')">
        <div v-if="drawerOrder" class="drawer-head">
          <div>
            <h2>{{ drawerOrder.order_number }}</h2>
            <p class="drawer-meta">
              <span v-if="drawerOrder.table_number || drawerOrder.room_number"><i class="fas fa-table" aria-hidden="true"></i> {{ drawerOrder.table_number || drawerOrder.room_number }}</span>
              <span v-if="drawerOrder.waiter_name"><i class="fas fa-user" aria-hidden="true"></i> {{ drawerOrder.waiter_name }}</span>
              <span v-if="drawerOrder.guest_name"><i class="fas fa-users" aria-hidden="true"></i> {{ drawerOrder.guest_name }}</span>
              <span v-if="drawerOrder.created_at"><i class="fas fa-clock" aria-hidden="true"></i> {{ timeOf(drawerOrder.created_at) }}</span>
            </p>
          </div>
          <button type="button" class="drawer-close" aria-label="Close" @click="closeDrawer">
            <i class="fas fa-xmark"></i>
          </button>
        </div>

        <p v-if="drawerError" class="alert alert-error">{{ drawerError }}</p>

        <div class="drawer-items">
          <div class="drawer-items-head">
            <h3>{{ $t('cashier.summary.itemsTitle') }}</h3>
            <button v-if="isRunning(drawerOrder)" type="button" class="sm-btn sm ghost" @click="editing = !editing">
              <i class="fas" :class="editing ? 'fa-check' : 'fa-pen'" aria-hidden="true"></i>
              {{ editing ? $t('cashier.summary.doneEditing') : $t('cashier.summary.editItems') }}
            </button>
          </div>

          <ul v-if="drawerOrder.items?.length" class="drawer-item-list">
            <li v-for="line in drawerOrder.items" :key="line.order_item_id"
              class="drawer-item" :class="{ 'split-selected': splitting && splitLines.includes(line.order_item_id) }">
              <label class="drawer-item-check" v-if="splitting">
                <input type="checkbox" :value="line.order_item_id" v-model="splitLines" :disabled="savingSplit" />
              </label>
              <div class="drawer-item-main">
                <span class="drawer-item-name">{{ line.item_name }}</span>
                <span class="drawer-item-price">{{ money(line.unit_price) }} × {{ line.quantity }}</span>
              </div>
              <div class="drawer-item-right">
                <template v-if="editing">
                  <div class="qty-stepper">
                    <button type="button" class="qty-btn" @click="changeQty(line, -1)" :disabled="savingItem">−</button>
                    <span class="qty-val">{{ line.quantity }}</span>
                    <button type="button" class="qty-btn" @click="changeQty(line, 1)" :disabled="savingItem">+</button>
                  </div>
                  <button type="button" class="sm-btn sm danger-ghost" @click="removeLine(line)" :disabled="savingItem">
                    <i class="fas fa-trash" aria-hidden="true"></i>
                  </button>
                </template>
                <span v-else class="drawer-item-total">{{ money(line.subtotal ?? line.unit_price * line.quantity) }}</span>
              </div>
            </li>
          </ul>
          <p v-else class="drawer-empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.summary.none') }}</p>
        </div>

        <div v-if="splitting" class="drawer-split">
          <p class="drawer-split-hint"><i class="fas fa-scissors" aria-hidden="true"></i> {{ $t('cashier.summary.splitHint') }}</p>
          <div class="drawer-void-actions">
            <button type="button" class="sm-btn sm ghost" :disabled="savingSplit" @click="splitting = false">{{ $t('common.cancel') }}</button>
            <button type="button" class="sm-btn sm primary" :disabled="savingSplit || !splitLines.length" @click="confirmSplit">
              <i class="fas fa-scissors" aria-hidden="true"></i> {{ savingSplit ? $t('common.saving') : $t('cashier.summary.splitToNewTicket') }}
            </button>
          </div>
        </div>

        <div v-if="transferring" class="drawer-transfer">
          <label :for="transferTableId">{{ $t('cashier.summary.transferPlaceholder') }}</label>
          <input :id="transferTableId" v-model.trim="transferTable" type="text" :disabled="savingTransfer"
            :placeholder="$t('cashier.summary.transferPlaceholder')" />
          <p class="drawer-split-hint"><i class="fas fa-right-left" aria-hidden="true"></i> {{ $t('cashier.summary.transferHint') }}</p>
          <div class="drawer-void-actions">
            <button type="button" class="sm-btn sm ghost" :disabled="savingTransfer" @click="transferring = false">
              {{ $t('common.cancel') }}
            </button>
            <button type="button" class="sm-btn sm primary" :disabled="savingTransfer || !transferTable"
              @click="confirmTransfer">
              <i class="fas fa-right-left" aria-hidden="true"></i> {{ savingTransfer ? $t('common.saving') : $t('cashier.summary.moveTicket') }}
            </button>
          </div>
        </div>

        <div class="drawer-total">
          <span>{{ $t('cashier.summary.total') }}</span>
          <strong>{{ money(drawerOrder?.total_amount ?? 0) }}</strong>
        </div>

        <div v-if="isRunning(drawerOrder) && voidConfirming" class="drawer-void">
          <label :for="voidReasonId">{{ $t('storeManager.common.reason') }}</label>
          <input :id="voidReasonId" v-model.trim="voidReason" type="text" maxlength="255" :disabled="savingVoid"
            :placeholder="$t('storeManager.common.reasonTitle')" />
          <div class="drawer-void-actions">
            <button type="button" class="sm-btn sm ghost" :disabled="savingVoid" @click="voidConfirming = false">{{ $t('common.cancel') }}</button>
            <button type="button" class="sm-btn sm danger" :disabled="savingVoid || !voidReason" @click="confirmVoid">
              <i class="fas fa-ban" aria-hidden="true"></i> {{ savingVoid ? $t('common.saving') : $t('cashier.summary.voidOrder') }}
            </button>
          </div>
        </div>

        <div v-if="isRunning(drawerOrder)" class="drawer-actions">
          <template v-if="!splitting && !transferring && !voidConfirming">
            <button type="button" class="sm-btn sm ghost" @click="promptVoid">
              <i class="fas fa-ban" aria-hidden="true"></i> {{ $t('cashier.summary.voidOrder') }}
            </button>
            <button type="button" class="sm-btn sm ghost" @click="promptTransfer">
              <i class="fas fa-right-left" aria-hidden="true"></i> {{ $t('cashier.summary.transfer') }}
            </button>
            <button type="button" class="sm-btn sm ghost" @click="promptSplit">
              <i class="fas fa-scissors" aria-hidden="true"></i> {{ $t('cashier.summary.split') }}
            </button>
          </template>
          <button type="button" class="sm-btn sm primary" :disabled="splitting || transferring || voidConfirming" @click="settleFromDrawer">
            <i class="fas fa-money-bill" aria-hidden="true"></i> {{ $t('cashier.summary.settle') }}
          </button>
        </div>
      </aside>
    </div>

    <!-- Settle payment modal: pick cash, a mobile-money wallet or a bank. -->
    <div v-if="payOpen" class="pay-modal-overlay" @click.self="closePay">
      <div class="pay-modal" role="dialog" aria-modal="true">
        <div class="pay-modal-head">
          <h2><i class="fas fa-money-bill-wave" aria-hidden="true"></i> {{ $t('cashier.summary.settleTitle') }}</h2>
          <button type="button" class="pay-modal-close" aria-label="Close" @click="closePay">
            <i class="fas fa-xmark"></i>
          </button>
        </div>

        <p v-if="payError" class="alert alert-error">{{ payError }}</p>

        <p v-if="payingOrder" class="pay-order-line">
          <strong>{{ payingOrder.order_number }}</strong>
          <span> — {{ payingOrder.table_number || payingOrder.room_number || '—' }}</span>
        </p>
        <p class="pay-amount-label">{{ $t('cashier.summary.settleAmount') }}</p>
        <p class="pay-amount">{{ money(payingOrder?.total_amount ?? 0) }}</p>

        <form @submit.prevent="confirmPay">
          <!-- Collect cash/mobile/bank, or post the ticket to an in-house room. -->
          <div class="settle-mode" role="tablist" :aria-label="$t('cashier.summary.settleModeLabel')">
            <button type="button" class="mode-btn" :class="{ active: settleMode === 'collect' }"
              :disabled="savingPay" @click="switchMode('collect')">
              <i class="fas fa-money-bill-wave" aria-hidden="true"></i> {{ $t('cashier.summary.settleModeCollect') }}
            </button>
            <button type="button" class="mode-btn" :class="{ active: settleMode === 'room' }"
              :disabled="savingPay" @click="switchMode('room')">
              <i class="fas fa-bed" aria-hidden="true"></i> {{ $t('cashier.summary.settleModeRoom') }}
            </button>
          </div>

          <template v-if="settleMode === 'room'">
            <div class="pay-room">
              <label :for="roomPickId">{{ $t('cashier.summary.roomSelectLabel') }}</label>
              <SearchableSelect
                :id="roomPickId"
                v-model="postRoom"
                :options="roomOptions"
                :placeholder="$t('cashier.summary.roomPlaceholder')"
                :empty-label="$t('cashier.summary.roomNone')"
                :disabled="savingPay"
                required
              />
              <p class="room-post-hint"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.summary.roomPostHint') }}</p>
            </div>
          </template>
          <template v-else>
            <PaymentMethodSelect
              v-model:method="payMethod"
              v-model:provider="payProvider"
              :methods="PAYMENT_METHODS"
              :disabled="savingPay"
            />
            <div v-if="needsRef" class="pay-ref">
              <label :for="payRefId">{{ $t('cashier.summary.refLabel') }}</label>
              <input
                :id="payRefId"
                v-model.trim="payRef"
                type="text"
                :placeholder="$t('cashier.summary.refPlaceholder')"
                :disabled="savingPay"
                maxlength="50"
              />
            </div>
          </template>

          <div class="pay-modal-foot">
            <button type="button" class="btn btn-secondary" :disabled="savingPay" @click="closePay">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary"
              :disabled="savingPay || (settleMode === 'collect' && needsRef && !payRef) || (settleMode === 'room' && !postRoom)">
              <i class="fas fa-check"></i>
              {{ savingPay ? $t('common.saving') : settleMode === 'room' ? $t('cashier.summary.roomPostConfirm') : $t('cashier.summary.settleConfirm') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Silent till printing; no browser print dialog. -->
    <div ref="printArea" class="receipt-print"></div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { cashierApi, orderApi, hotelSettingsApi } from '@/api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import PaymentMethodSelect from '@/components/PaymentMethodSelect.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { useAuthStore } from '@/stores/auth'
import { PAYMENT_METHODS } from '@/utils/payments'
import { restorePrinter, printerState, connectPrinter, printerSupported } from '@/utils/printer'
import { usePrintSettingsStore } from '@/stores/printSettings'
import { displayLines } from '@/utils/receipts'
import { toast } from '@/utils/toast'

const { t, te } = useI18n()
const authStore = useAuthStore()
const printStore = usePrintSettingsStore()

/** Hotel logo shown on receipts (per-hotel if set, else the generic mark). */
const logoUrl = ref('')
async function loadLogo() {
  try {
    const { data } = await hotelSettingsApi.show()
    logoUrl.value = data?.hotel?.logo_url || ''
  } catch {
    logoUrl.value = ''
  }
}

const orders = ref([])
const loading = ref(true)
const error = ref('')
/** Working date in the hotel's local timezone (not UTC, so night-shift tickets
 *  created just after midnight still land on "today"). */
const date = ref(localToday())
const search = ref('')
const activeTab = ref('running')
const printArea = ref(null)
const supported = computed(() => printerSupported())
const connecting = ref(false)

const payOpen = ref(false)
const payingOrder = ref(null)
const payMethod = ref('cash')
const payProvider = ref('')
const payRef = ref('')
const payRefId = `pay-ref-${Date.now()}`
const savingPay = ref(false)
const payError = ref('')

/** Order detail drawer: items list with edit-in-place qty/void/settle actions. */
const drawerOpen = ref(false)
const drawerOrder = ref(null)
const editing = ref(false)
const drawerError = ref('')
const savingItem = ref(false)
const voidConfirming = ref(false)
const voidReason = ref('')
const voidReasonId = `void-reason-${Date.now()}`
const savingVoid = ref(false)

/** Bill split / transfer of a ticket to another table. */
const splitting = ref(false)
const splitLines = ref([])
const savingSplit = ref(false)
const transferring = ref(false)
const transferTable = ref('')
const transferTableId = `transfer-table-${Date.now()}`
const savingTransfer = ref(false)

/** "collect" takes cash/mobile/bank; "room" posts the ticket to a folio. */
const settleMode = ref('collect')
const rooms = ref([])
const postRoom = ref('')
const roomPickId = `room-pick-${Date.now()}`
const roomOptions = computed(() =>
  rooms.value.map((room) => ({
    value: room.room_number,
    label: `${room.room_number} — ${room.guest_name || ''}`,
  })),
)

/** A bank transfer needs the statement reference to be recorded on the till. */
const needsRef = computed(() => payMethod.value === 'bank')

// "Voided" maps to cancelled orders; settled = paid/billed/completed.
const isRunning = (order) => !['completed', 'cancelled'].includes(order.status)
const isSettled = (order) => order.status === 'completed' || order.payment_status !== 'unpaid'

const filteredOrders = computed(() => {
  const term = search.value.trim().toLowerCase()
  return orders.value.filter((order) => {
    if (activeTab.value === 'running' && !isRunning(order)) return false
    if (activeTab.value === 'settled' && !(order.status === 'completed' && !['cancelled'].includes(order.status))) {
      if (activeTab.value === 'settled' && !(order.payment_status !== 'unpaid' || order.status === 'completed')) return false
    }
    if (activeTab.value === 'voided' && order.status !== 'cancelled') return false
    if (term && !`${order.order_number} ${order.guest_name || ''} ${order.table_number || ''} ${order.room_number || ''}`.toLowerCase().includes(term)) return false
    return true
  })
})

const page = ref(1)
const PAGE_SIZE = 15
const lastPage = computed(() => Math.max(1, Math.ceil(filteredOrders.value.length / PAGE_SIZE)))
const pagedOrders = computed(() => {
  const p = Math.min(page.value, lastPage.value)
  return filteredOrders.value.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE)
})
watch([search, activeTab], () => { page.value = 1 })

const filterTabs = computed(() => [
  { key: 'running', label: t('cashier.summary.tabRunning'), count: orders.value.filter(isRunning).length },
  {
    key: 'settled',
    label: t('cashier.summary.tabSettled'),
    count: orders.value.filter((o) => o.payment_status !== 'unpaid' || o.status === 'completed').length,
  },
  { key: 'voided', label: t('cashier.summary.tabVoided'), count: orders.value.filter((o) => o.status === 'cancelled').length },
])

function chipFor(order) {
  if (order.status === 'cancelled') return 'cancelled'
  if (isSettled(order)) return 'approved'
  if (order.is_frozen) return 'partial'
  return 'pending'
}

function statusLabel(order) {
  const key = `cashier.delivery.status.${order.status}`
  return te(key) ? t(key) : order.status
}

function typeLabel(type) {
  const key = `cashier.types.${type}`
  return te(key) ? t(key) : type
}

function timeOf(iso) {
  return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'
}

function money(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

/** Today's date in the local timezone as YYYY-MM-DD. */
function localToday() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

async function load() {
  loading.value = true
  try {
    const { data } = await orderApi.index({ date: date.value, per_page: 100 })
    orders.value = data.data || []
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

async function freeze(order) {
  await cashierApi.freeze(order.order_id)
  await load()
}

async function unfreeze(order) {
  await cashierApi.unfreeze(order.order_id)
  await load()
}

/** Recall jumps the cashier back to the Dine In floor focused on this ticket. */
function recall(order) {
  window.alert(t('cashier.summary.recallHint', { number: order.order_number }))
}

/** Opens the payment modal for a running ticket. */
function settle(order) {
  payError.value = ''
  payingOrder.value = order
  payMethod.value = 'cash'
  payProvider.value = ''
  payRef.value = ''
  settleMode.value = 'collect'
  postRoom.value = ''
  payOpen.value = true
}

/**
 * Drawer: lazy-loads the ticket's items the first time it is opened so the
 * list view stays light while the drawer always shows live lines.
 */
async function openDrawer(order) {
  drawerError.value = ''
  editing.value = false
  voidConfirming.value = false
  voidReason.value = ''
  splitting.value = false
  splitLines.value = []
  transferring.value = false
  transferTable.value = ''
  drawerOrder.value = order
  if (!order.items?.length) {
    try {
      const { data } = await orderApi.show(order.order_id)
      drawerOrder.value = data.order
    } catch (err) {
      drawerError.value = err.response?.data?.message || t('common.loadError')
    }
  }
  drawerOpen.value = true
}

function closeDrawer() {
  if (savingItem.value || savingVoid.value) return
  drawerOpen.value = false
  drawerOrder.value = null
}

/** Settling from the drawer reuses the existing payment modal. */
function settleFromDrawer() {
  const order = drawerOrder.value
  closeDrawer()
  settle(order)
}

/** Steps a line's quantity up/down (minimum 1); stock adjusts live. */
async function changeQty(line, delta) {
  const next = (line.quantity || 1) + delta
  if (next < 1 || !drawerOrder.value || savingItem.value) return
  savingItem.value = true
  drawerError.value = ''
  try {
    const { data } = await orderApi.updateOrderItem(drawerOrder.value.order_id, line.order_item_id, { qty: next })
    mergeIntoDrawer(data.order)
    toast(t('cashier.summary.itemUpdated'), 'success')
  } catch (err) {
    drawerError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    savingItem.value = false
  }
}

/** Removes a line; the item's stock is refunded automatically. */
async function removeLine(line) {
  if (!drawerOrder.value || savingItem.value) return
  savingItem.value = true
  drawerError.value = ''
  try {
    const { data } = await orderApi.removeOrderItem(drawerOrder.value.order_id, line.order_item_id)
    mergeIntoDrawer(data.order)
    toast(t('cashier.summary.itemRemoved'), 'success')
  } catch (err) {
    drawerError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    savingItem.value = false
  }
}

/** Replaces the drawer ticket with the fresh response and refreshes the list. */
async function mergeIntoDrawer(order) {
  drawerOrder.value = order
  await load()
}

function promptVoid() {
  voidConfirming.value = true
  splitting.value = false
  transferring.value = false
  voidReason.value = ''
}

/** Voids the ticket with the entered reason; stock is returned. */
async function confirmVoid() {
  if (!drawerOrder.value || !voidReason.value.trim()) {
    drawerError.value = t('cashier.summary.voidReasonRequired')
    return
  }
  savingVoid.value = true
  drawerError.value = ''
  try {
    await orderApi.voidOrder(drawerOrder.value.order_id, { reason: voidReason.value.trim() })
    closeDrawer()
    await load()
    toast(t('cashier.summary.voided'), 'success')
  } catch (err) {
    drawerError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    savingVoid.value = false
  }
}

/** Asks for the target table and moves the whole ticket onto it. */
function promptTransfer() {
  transferring.value = true
  voidConfirming.value = false
  splitting.value = false
  transferTable.value = ''
}

async function confirmTransfer() {
  if (!drawerOrder.value || !transferTable.value.trim()) return
  savingTransfer.value = true
  drawerError.value = ''
  try {
    await orderApi.transferOrder(drawerOrder.value.order_id, { table_number: transferTable.value.trim() })
    closeDrawer()
    await load()
    toast(t('cashier.summary.transferred'), 'success')
  } catch (err) {
    drawerError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    savingTransfer.value = false
  }
}

/** Arms split mode: line checkboxes + a confirmation bar. */
function promptSplit() {
  splitting.value = true
  voidConfirming.value = false
  transferring.value = false
  splitLines.value = []
}

/** Splits the ticked lines onto a fresh ticket on the same table. */
async function confirmSplit() {
  if (!drawerOrder.value || !splitLines.value.length) return
  savingSplit.value = true
  drawerError.value = ''
  try {
    await orderApi.splitOrder(drawerOrder.value.order_id, { order_item_ids: splitLines.value })
    closeDrawer()
    await load()
    toast(t('cashier.summary.splitDone'), 'success')
  } catch (err) {
    drawerError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    savingSplit.value = false
  }
}

/**
 * Switches between collecting cash/mobile/bank and posting to a room,
 * lazy-loading the in-house rooms the first time the room mode is opened.
 */
function switchMode(mode) {
  if (mode === 'room' && !rooms.value.length) loadRooms()
  settleMode.value = mode
}

/** Loads the in-house rooms the Room Service list uses (occupied rooms). */
async function loadRooms() {
  try {
    const { data } = await orderApi.formOptions()
    rooms.value = data.in_house_guests || []
  } catch {
    rooms.value = []
  }
}

function closePay() {
  if (savingPay.value) return
  payOpen.value = false
  payingOrder.value = null
}

/**
 * Settles the ticket: either posts it to an in-house room folio, or collects
 * the payment with the chosen method (cash, mobile money, bank, ...), then
 * prints the paid bill so the guest walks away with a receipt.
 */
async function confirmPay() {
  if (!payingOrder.value) return
  if (settleMode.value === 'room') return confirmRoomPost()
  payError.value = ''
  savingPay.value = true
  try {
    const { data } = await orderApi.pay(payingOrder.value.order_id, {
      method: payMethod.value,
      provider: payProvider.value || null,
      transaction_reference: payRef.value || null,
    })
    const settled = data.order
    settled._payment = data.payment
    if (!settled.items?.length) {
      const { data: detail } = await orderApi.show(settled.order_id)
      settled.items = detail.order.items
    }
    payOpen.value = false
    payingOrder.value = null
    if (printStore.printOnSettle) doPrint(settled, 'receipt')
    await load()
  } catch (err) {
    payError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    savingPay.value = false
  }
}

/** Posts the ticket to the chosen in-house room; the charge lands on the folio. */
async function confirmRoomPost() {
  payError.value = ''
  savingPay.value = true
  try {
    const { data } = await orderApi.billToRoom(payingOrder.value.order_id, {
      room_number: postRoom.value,
    })
    const billed = data.order
    if (!billed.items?.length) {
      const { data: detail } = await orderApi.show(billed.order_id)
      billed.items = detail.order.items
    }
    payOpen.value = false
    payingOrder.value = null
    postRoom.value = ''
    if (printStore.printOnSettle) doPrint(billed, 'receipt')
    await load()
    toast(t('cashier.summary.roomPosted'), 'success')
  } catch (err) {
    payError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    savingPay.value = false
  }
}

async function doPrint(order, kind) {
  const hotel = authStore.user?.tenant?.hotel_name || 'MRK HOTELS'
  const sent = await printStore.print(displayLines(order, kind, { hotel }), { logo: logoUrl.value })
  if (!sent) toast(printerState.reason || t('printer.noPrinter'), 'error')
}

async function connectFromPage() {
  connecting.value = true
  try {
    const ok = await connectPrinter()
    if (ok) toast(t('cashier.summary.printerConnected'), 'success')
    else toast(printerState.reason || t('cashier.summary.connectFailed'), 'error')
  } finally {
    connecting.value = false
  }
}

async function reprint(order) {
  if (!order.items?.length) {
    const { data } = await orderApi.show(order.order_id)
    order = data.order
  }
  doPrint(order, 'receipt')
}

async function reprintKot(order) {
  if (!order.items?.length) {
    const { data } = await orderApi.show(order.order_id)
    order = data.order
  }
  doPrint(order, 'kot')
}

// Live refresh: tickets from the floor (waiters/bartenders) appear without the
// cashier having to reload the page every time.
let orderListPoll = null

onMounted(() => {
  load()
  loadLogo()
  restorePrinter()
  orderListPoll = setInterval(() => {
    if (activeTab.value === 'running' && !loading.value) load()
  }, 25000)
})

onUnmounted(() => {
  if (orderListPoll) clearInterval(orderListPoll)
})
</script>


<style scoped>
.row-frozen td { background: #f8fafc; }
.order-link {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: #00468c;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 14px;
}
.order-link:hover { color: #00264f; text-decoration: underline; }
.order-link i { font-size: 12px; opacity: 0.7; }
.frozen-tag { margin-left: 8px; font-size: 11px; color: #00468c; background: #e8f1fa; border-radius: 999px; padding: 2px 8px; font-weight: 700; }
.nc-tag { margin-left: 6px; font-size: 11px; color: #333333; background: #ececec; border-radius: 999px; padding: 2px 8px; font-weight: 700; }
.sm-inline-label { font-size: 13px; color: #475569; font-weight: 600; }

.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}
.drawer {
  width: 100%;
  max-width: 420px;
  height: 100%;
  background: #fff;
  box-shadow: -12px 0 40px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  padding: 20px 22px;
  gap: 14px;
  overflow-y: auto;
}
.drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.drawer-head h2 { margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; }
.drawer-meta {
  margin: 6px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 13px;
  color: #475569;
}
.drawer-meta span { display: inline-flex; align-items: center; gap: 5px; }
.drawer-meta i { color: #94a3b8; }
.drawer-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
}
.drawer-items { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.drawer-items-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.drawer-items-head h3 { margin: 0; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
.drawer-item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.drawer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #eef2f7;
}
.drawer-item:last-child { border-bottom: none; }
.drawer-item-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.drawer-item-name { font-size: 14px; font-weight: 600; color: #1e293b; }
.drawer-item-price { font-size: 12px; color: #94a3b8; }
.drawer-item-right { display: flex; align-items: center; gap: 10px; }
.drawer-item-total { font-size: 14px; font-weight: 700; color: #0f172a; }
.qty-stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  overflow: hidden;
}
.qty-btn {
  width: 28px;
  height: 28px;
  background: #f8fafc;
  border: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 700;
  color: #334155;
}
.qty-btn:hover:not(:disabled) { background: #e2e8f0; }
.qty-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.qty-val { min-width: 34px; text-align: center; font-weight: 700; font-size: 14px; }
.drawer-empty {
  padding: 14px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
}
.drawer-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-top: 2px solid #0f172a;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}
.drawer-total strong { font-size: 20px; }
.drawer-void { display: flex; flex-direction: column; gap: 8px; }
.drawer-void label { font-size: 12px; font-weight: 700; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.4px; }
.drawer-void input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  font-size: 14px;
}
.drawer-void-actions { display: flex; justify-content: flex-end; gap: 8px; }
.drawer-actions { display: flex; justify-content: flex-end; gap: 8px; }
.drawer-split, .drawer-transfer { display: flex; flex-direction: column; gap: 8px; }
.drawer-split-hint {
  margin: 0;
  font-size: 12px;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 6px;
}
.drawer-transfer label {
  font-size: 12px;
  font-weight: 700;
  color: #00468c;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.drawer-transfer input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #93c5fd;
  border-radius: 6px;
  font-size: 14px;
}
.drawer-item { transition: background 0.15s ease; }
.drawer-item.split-selected { background: #eef2ff; }
.drawer-item-check { display: inline-flex; }
.drawer-item-check input { width: 16px; height: 16px; accent-color: #00468c; }

.printer-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  margin-bottom: 16px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 8px;
  font-size: 13px;
  color: #92400e;
}
.printer-banner i { font-size: 16px; color: #d97706; }
.printer-banner span { flex: 1; }

.pay-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.pay-modal {
  background: #fff;
  border-radius: 8px;
  width: 100%;
  max-width: 460px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.pay-modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.pay-modal-head h2 {
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.pay-modal-head h2 i {
  color: #1e7e34;
}

.pay-modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #757575;
  cursor: pointer;
  padding: 4px;
}

.pay-order-line {
  margin: 8px 0 4px;
  color: #424242;
}

.pay-amount-label {
  margin: 4px 0 0;
  font-size: 12px;
  color: #757575;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.pay-amount {
  margin: 0 0 12px;
  font-size: 32px;
  font-weight: 800;
}

.pay-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.pay-ref {
  margin-top: 14px;
}

.pay-ref label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #424242;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 6px;
}

.pay-ref input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  font-size: 14px;
}

.pay-ref input:focus {
  outline: none;
  border-color: #1e7e34;
  box-shadow: 0 0 0 3px rgba(30, 126, 52, 0.12);
}

.settle-mode {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #d4d4d4;
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
  font-weight: 600;
  color: #424242;
  cursor: pointer;
}

.mode-btn:hover {
  border-color: #1e7e34;
}

.mode-btn.active {
  background: #eafaf1;
  border-color: #1e7e34;
  color: #1e7e34;
}

.mode-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pay-room {
  margin-top: 14px;
}

.pay-room label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #424242;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 6px;
}

.room-post-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: #757575;
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
