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

    <section class="panel">
      <div class="table-scroll">
      <table class="sm-table">
        <thead>
          <tr>
            <th>{{ $t('cashier.summary.order') }}</th>
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
            <td><strong>{{ order.order_number }}</strong>
              <span v-if="order.is_frozen" class="frozen-tag"><i class="fas fa-snowflake" aria-hidden="true"></i> {{ $t('storeManager.common.frozen') }}</span>
              <span v-if="order.is_no_charge" class="nc-tag">{{ $t('cashier.noCharge.tag') }}</span>
            </td>
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
            <td colspan="7" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.summary.none') }}</td>
          </tr>
        </tbody>
      </table>
      </div>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
    </section>

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
          <div class="pay-modal-foot">
            <button type="button" class="btn btn-secondary" :disabled="savingPay" @click="closePay">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="savingPay || needsRef && !payRef">
              <i class="fas fa-check"></i>
              {{ savingPay ? $t('common.saving') : $t('cashier.summary.settleConfirm') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Printable receipt / KOT (hidden on screen, visible in print). -->
    <div ref="printArea" class="receipt-print">
      <template v-if="printing">
        <p class="print-brand">{{ printRows[0]?.[0] }}</p>
        <div v-for="(row, i) in printRows" :key="i">
          <p v-if="row[0]" class="print-line" :class="{ 'print-bold': row[1] }">{{ row[0] }}</p>
          <div v-else class="print-gap"></div>
        </div>
        <img v-if="logoUrl && printing.kind !== 'kot'" :src="logoUrl" alt="Hotel logo" class="print-logo" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { cashierApi, orderApi, hotelSettingsApi } from '@/api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import PaymentMethodSelect from '@/components/PaymentMethodSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { PAYMENT_METHODS } from '@/utils/payments'
import { printToPrinter, restorePrinter } from '@/utils/printer'
import { displayLines } from '@/utils/receipts'

const { t, te } = useI18n()
const authStore = useAuthStore()

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
const error = ref('')
const date = ref(new Date().toISOString().slice(0, 10))
const search = ref('')
const activeTab = ref('running')
const printing = ref(null)
const printArea = ref(null)

const payOpen = ref(false)
const payingOrder = ref(null)
const payMethod = ref('cash')
const payProvider = ref('')
const payRef = ref('')
const payRefId = `pay-ref-${Date.now()}`
const savingPay = ref(false)
const payError = ref('')

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

const printRows = computed(() => {
  if (!printing.value) return []
  const hotel = authStore.user?.tenant?.hotel_name || 'MRK HOTELS'
  return displayLines(printing.value.order, printing.value.kind, { hotel })
})

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

async function load() {
  const { data } = await orderApi.index({ date: date.value, per_page: 100 })
  orders.value = data.data || []
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
  payOpen.value = true
}

function closePay() {
  if (savingPay.value) return
  payOpen.value = false
  payingOrder.value = null
}

/**
 * Settles the ticket with the chosen method (cash, mobile money, bank, ...),
 * then prints the paid bill so the guest walks away with a receipt.
 */
async function confirmPay() {
  if (!payingOrder.value) return
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
    doPrint(settled, 'receipt')
    await load()
  } catch (err) {
    payError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    savingPay.value = false
  }
}

async function doPrint(order, kind) {
  const hotel = authStore.user?.tenant?.hotel_name || 'MRK HOTELS'
  const sent = await printToPrinter(displayLines(order, kind, { hotel }), { logo: logoUrl.value })
  if (sent) return
  printing.value = { order, kind }
  requestAnimationFrame(() => {
    window.print()
    setTimeout(() => { printing.value = null }, 300)
  })
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

onMounted(() => {
  load()
  loadLogo()
  restorePrinter()
})
</script>


<style scoped>
.row-frozen td { background: #f8fafc; }
.frozen-tag { margin-left: 8px; font-size: 11px; color: #00468c; background: #e8f1fa; border-radius: 999px; padding: 2px 8px; font-weight: 700; }
.nc-tag { margin-left: 6px; font-size: 11px; color: #333333; background: #ececec; border-radius: 999px; padding: 2px 8px; font-weight: 700; }
.sm-inline-label { font-size: 13px; color: #475569; font-weight: 600; }

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
</style>
