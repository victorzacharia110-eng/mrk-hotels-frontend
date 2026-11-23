<!--
  CashierNoChargePage — "No Charge" ordering mode.
  Pending / Settled / Voided tabs with live counts, plus the no-charge modal
  (account picker with previously used accounts, waiter + guest detail).
-->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head">
        <div class="status-tabs">
          <button v-for="tab in tabs" :key="tab.key" class="status-tab"
            :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
            {{ tab.label }} <span class="n">{{ tab.count }}</span>
          </button>
        </div>
        <div class="nc-head-actions">
          <div class="sm-search nc-search">
            <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
            <input v-model="search" type="search" :placeholder="$t('cashier.noCharge.search')"
              @keyup.enter="submitSearch" @input="debouncedSearch" />
          </div>
          <select id="nc-status" v-model="statusFilter" class="sm-select sm nc-status">
            <option value="">{{ $t('cashier.noCharge.allStatuses') }}</option>
            <option v-for="status in statusOptions" :key="status" :value="status">
              {{ statusText(status) }}
            </option>
          </select>
          <OrderDateNav input-id="nc-date" v-model="date" :today="workingDateStore.workingDate"
            :today-label="$t('cashier.noCharge.today')" @change="onFilterChange" />
          <button class="sm-btn sm success" @click="showModal = true">
            <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('cashier.noCharge.newOrder') }}
          </button>
        </div>
      </div>
      <div class="table-scroll">
      <SkeletonLoader v-if="loading" variant="table" :count="5" :cols="6" />
      <table class="sm-table" v-else>
        <thead>
          <tr>
            <th>{{ $t('cashier.summary.order') }}</th>
            <th>{{ $t('cashier.order.account') }}</th>
            <th>{{ $t('cashier.roomService.guest') }}</th>
            <th>{{ $t('cashier.noCharge.time') }}</th>
            <th>{{ $t('common.status') }}</th>
            <th>{{ $t('cashier.summary.amount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filteredOrders" :key="order.order_id">
            <td><button class="order-link" @click="peekId = order.order_id">{{ order.order_number }}</button></td>
            <td>{{ order.no_charge_account || '—' }}</td>
            <td>{{ order.guest_name || '—' }}</td>
            <td>{{ timeOf(order) }}</td>
            <td><span class="chip" :class="statusChip(order)">{{ statusLabel(order) }}</span></td>
            <td>{{ money(order.total_amount) }}</td>
          </tr>
          <tr v-if="!filteredOrders.length">
            <td colspan="6" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.noCharge.none') }}</td>
          </tr>
        </tbody>
      </table>
      </div>
      <div v-if="meta.last_page > 1" class="pagination">
        <button class="sm-btn sm ghost" :disabled="meta.current_page <= 1"
          @click="goPage(meta.current_page - 1)">{{ $t('common.previous') }}</button>
        <span>{{ $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page }) }}</span>
        <button class="sm-btn sm ghost" :disabled="meta.current_page >= meta.last_page"
          @click="goPage(meta.current_page + 1)">{{ $t('common.next') }}</button>
      </div>
    </section>

    <NewOrderModal v-if="showModal" mode="no_charge" :title="$t('cashier.noCharge.newOrder')"
      :known-accounts="knownAccounts" :credit-accounts="creditAccounts"
      @close="showModal = false" @created="onCreated" />
    <OrderPeekModal :open="!!peekId" :order-id="peekId" @close="peekId = null" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { creditAccountApi, orderApi } from '@/api'
import { selectedOutlet } from '@/composables/useOutletContext'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'
import OrderDateNav from '@/components/cashier/OrderDateNav.vue'
import OrderPeekModal from '@/components/cashier/OrderPeekModal.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { useWorkingDateStore } from '@/stores/workingDate'
import { formatTime } from '@/utils/dates'
import { normalizeCreditAccounts } from '@/utils/payments'

const { t } = useI18n()
const workingDateStore = useWorkingDateStore()

const orders = ref([])
const loading = ref(true)
const showModal = ref(false)
const date = ref('')
const activeTab = ref('pending')
const peekId = ref(null)
const creditAccounts = ref([])
const search = ref('')
const statusFilter = ref('')
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 15 })
const statusOptions = ['pending', 'in_progress', 'processing', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'merged']
let debounceTimer = null

const knownAccounts = computed(() =>
  [...new Set(orders.value.map((o) => o.no_charge_account).filter(Boolean))],
)

const isSettled = (o) => o.status === 'completed' || (o.payment_status && o.payment_status !== 'unpaid')
const isVoided = (o) => o.status === 'cancelled'
const isPending = (o) => !isSettled(o) && !isVoided(o)

const tabs = computed(() => [
  { key: 'all', label: t('cashier.noCharge.tabAll'), count: orders.value.length },
  { key: 'pending', label: t('cashier.takeAway.tabPending'), count: orders.value.filter(isPending).length },
  { key: 'settled', label: t('cashier.takeAway.tabSettled'), count: orders.value.filter(isSettled).length },
  { key: 'voided', label: t('cashier.takeAway.tabVoided'), count: orders.value.filter(isVoided).length },
])

const filteredOrders = computed(() => {
  if (activeTab.value === 'all') return orders.value
  if (activeTab.value === 'settled') return orders.value.filter(isSettled)
  if (activeTab.value === 'voided') return orders.value.filter(isVoided)
  return orders.value.filter(isPending)
})

function statusLabel(order) {
  if (isVoided(order)) return t('cashier.takeAway.status.cancelled')
  if (isSettled(order)) return t('cashier.takeAway.status.completed')
  return t('cashier.takeAway.status.pending')
}

function statusChip(order) {
  if (isVoided(order)) return 'cancelled'
  if (isSettled(order)) return 'approved'
  return 'pending'
}

async function loadCreditAccounts() {
  try {
    const res = await creditAccountApi.index({ type: 'no_charge', per_page: 250 })
    creditAccounts.value = normalizeCreditAccounts(res.data)
  } catch {
    /** keep legacy suggestions when the registry is unreachable */
  }
}

function money(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

function timeOf(order) {
  return formatTime(order.created_at || order.order_date)
}

function statusText(status) {
  const key = `cashier.noCharge.status.${status}`
  const text = t(key)
  return text === key ? status : text
}

async function load() {
  loading.value = true
  try {
    const params = {
      order_type: 'no_charge',
      page: meta.value.current_page,
      per_page: meta.value.per_page,
      outlet_id: selectedOutlet.value?.outlet_id || undefined,
      search: search.value.trim() || undefined,
      status: statusFilter.value || undefined,
    }
    if (date.value) params.date = date.value
    const { data } = await orderApi.index(params)
    const rows = data.data || []
    orders.value = rows
    const info = data.meta || data.pagination || {}
    meta.value = {
      current_page: Number(info.current_page) || 1,
      last_page: Number(info.last_page) || 1,
      total: Number(info.total) || rows.length,
      per_page: Number(info.per_page) || meta.value.per_page,
    }
  } finally {
    loading.value = false
  }
}

function onFilterChange() {
  meta.value.current_page = 1
  load()
}

function submitSearch() {
  clearTimeout(debounceTimer)
  onFilterChange()
}

function debouncedSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(submitSearch, 400)
}

function goPage(page) {
  if (page < 1 || page > meta.value.last_page) return
  meta.value.current_page = page
  load()
}

function onCreated() {
  showModal.value = false
  meta.value.current_page = 1
  load()
}

watch(statusFilter, () => {
  activeTab.value = 'all'
  onFilterChange()
})

watch(() => selectedOutlet.value?.outlet_id, () => onFilterChange(), { immediate: false })

onBeforeUnmount(() => clearTimeout(debounceTimer))

onMounted(async () => {
  await workingDateStore.ensureLoaded()
  date.value = workingDateStore.workingDate
  await Promise.all([load(), loadCreditAccounts()])
})
</script>

<style scoped>
.nc-head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-left: auto; }
.nc-search { min-width: 190px; }
.nc-status { min-width: 150px; }
.pagination { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 12px 16px; border-top: 1px solid #e2e8f0; }
.order-link { background: none; border: none; padding: 0; color: #005eb8; font-weight: 700; cursor: pointer; text-decoration: underline; }
.chip.cancelled { background: #fee2e2; color: #b91c1c; }
</style>
