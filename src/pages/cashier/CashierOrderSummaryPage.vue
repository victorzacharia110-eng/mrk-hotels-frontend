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

    <section class="panel">
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
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
    </section>

    <!-- Printable receipt / KOT (hidden on screen, visible in print). -->
    <div ref="printArea" class="receipt-print">
      <template v-if="printing">
        <h2 style="text-align:center;margin:4px 0">{{ printing.kind === 'kot' ? 'KITCHEN ORDER TICKET' : 'MRK HOTELS' }}</h2>
        <p style="text-align:center;margin:2px 0">{{ printing.order.order_number }} — {{ printing.order.outlet_name || '' }}</p>
        <p style="margin:2px 0">Table: {{ printing.order.table_number || printing.order.room_number || '-' }} |
          Waiter: {{ printing.order.waiter_name || '-' }}</p>
        <hr />
        <table style="width:100%">
          <tbody>
            <tr v-for="item in printing.order.items" :key="item.order_item_id">
              <td>{{ item.quantity }} x</td>
              <td>{{ item.item_name }}</td>
              <td style="text-align:right">{{ money(item.subtotal) }}</td>
            </tr>
          </tbody>
        </table>
        <hr />
        <p v-if="printing.kind !== 'kot'" style="text-align:right"><strong>TOTAL: {{ money(printing.order.total_amount) }}</strong></p>
        <p style="text-align:center">{{ new Date().toLocaleString() }}</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { cashierApi, orderApi } from '@/api'
import PaginationBar from '@/components/store/PaginationBar.vue'

const { t, te } = useI18n()

const orders = ref([])
const date = ref(new Date().toISOString().slice(0, 10))
const search = ref('')
const activeTab = ref('running')
const printing = ref(null)
const printArea = ref(null)

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

/** Settle a running ticket in cash through the standard payment flow. */
async function settle(order) {
  await orderApi.pay(order.order_id, {})
  await load()
}

function doPrint(order, kind) {
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

onMounted(load)
</script>


<style scoped>
.row-frozen td { background: #f8fafc; }
.frozen-tag { margin-left: 8px; font-size: 11px; color: #00468c; background: #e8f1fa; border-radius: 999px; padding: 2px 8px; font-weight: 700; }
.nc-tag { margin-left: 6px; font-size: 11px; color: #333333; background: #ececec; border-radius: 999px; padding: 2px 8px; font-weight: 700; }
.sm-inline-label { font-size: 13px; color: #475569; font-weight: 600; }
</style>
