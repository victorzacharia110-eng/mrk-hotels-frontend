<!--
  CashierTakeAwayPage — the Take Away board.
  Pending / Settled / Voided tabs with live counts, plus an "Add Take Away
  Order" flow that builds the ticket with menu items and their accompaniments
  before posting it to the kitchen.
-->

<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="status-tabs">
        <button v-for="tab in tabs" :key="tab.key" class="status-tab"
          :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
          {{ tab.label }} <span class="n">{{ tab.count }}</span>
        </button>
      </div>
      <span class="spacer"></span>
      <label class="sm-inline-label" for="ta-date">{{ $t('cashier.summary.workingDate') }}</label>
      <OrderDateNav input-id="ta-date" v-model="date" :today="workingDateStore.workingDate"
        :today-label="$t('cashier.takeAway.today')" @change="load" />
      <button class="sm-btn sm success" @click="showModal = true">
        <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('cashier.takeAway.newOrder') }}
      </button>
    </div>

    <section class="panel">
      <div class="table-scroll">
      <SkeletonLoader v-if="loading" variant="table" :count="6" :cols="6" />
      <table class="sm-table" v-else>
        <thead>
          <tr>
            <th>{{ $t('cashier.summary.order') }}</th>
            <th>{{ $t('cashier.takeAway.guest') }}</th>
            <th>{{ $t('cashier.summary.waiter') }}</th>
            <th>{{ $t('cashier.takeAway.time') }}</th>
            <th>{{ $t('common.status') }}</th>
            <th>{{ $t('cashier.summary.amount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filteredOrders" :key="order.order_id">
            <td>
              <button class="order-link" @click="peekId = order.order_id">{{ order.order_number }}</button>
            </td>
            <td>{{ order.guest_name || '—' }}</td>
            <td>{{ order.waiter_name || '—' }}</td>
            <td>{{ timeOf(order) }}</td>
            <td><span class="chip" :class="statusChip(order)">{{ statusLabel(order) }}</span></td>
            <td>{{ money(order.total_amount) }}</td>
          </tr>
          <tr v-if="!filteredOrders.length">
            <td colspan="6" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.takeAway.none') }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </section>

    <NewOrderModal v-if="showModal" mode="takeaway" :title="$t('cashier.takeAway.newOrder')"
      @close="showModal = false" @created="onCreated" />
    <OrderPeekModal :open="!!peekId" :order-id="peekId" @close="peekId = null" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { orderApi } from '@/api'
import { selectedOutlet } from '@/composables/useOutletContext'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'
import OrderDateNav from '@/components/cashier/OrderDateNav.vue'
import OrderPeekModal from '@/components/cashier/OrderPeekModal.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { useWorkingDateStore } from '@/stores/workingDate'
import { formatTime, localDateOf, todayISO } from '@/utils/dates'

const { t } = useI18n()
const workingDateStore = useWorkingDateStore()

const orders = ref([])
const loading = ref(true)
const activeTab = ref('pending')
const showModal = ref(false)
const date = ref('')
const peekId = ref(null)

const isSettled = (o) => o.status === 'completed' || (o.payment_status && o.payment_status !== 'unpaid')
const isVoided = (o) => o.status === 'cancelled'
const isPending = (o) => !isSettled(o) && !isVoided(o)

const tabs = computed(() => [
  { key: 'pending', label: t('cashier.takeAway.tabPending'), count: orders.value.filter(isPending).length },
  { key: 'settled', label: t('cashier.takeAway.tabSettled'), count: orders.value.filter(isSettled).length },
  { key: 'voided', label: t('cashier.takeAway.tabVoided'), count: orders.value.filter(isVoided).length },
])

const filteredOrders = computed(() => {
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

function timeOf(order) {
  return formatTime(order.created_at || order.order_date)
}

function money(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

async function load() {
  loading.value = true
  try {
    const params = { order_type: 'takeaway', per_page: 100 }
    if (selectedOutlet.value?.outlet_id) params.outlet_id = selectedOutlet.value.outlet_id
    if (date.value && date.value < todayISO()) params.date = date.value
    const { data } = await orderApi.index(params)
    const rows = data.data || []
    orders.value = params.date
      ? rows
      : rows.filter((o) => {
          const stamp = o.created_at
          if (stamp) return localDateOf(stamp) === date.value
          return String(o.order_date || '').slice(0, 10) === date.value
        })
  } finally {
    loading.value = false
  }
}

function onCreated() {
  showModal.value = false
  load()
}

watch(() => selectedOutlet.value?.outlet_id, () => load(), { immediate: false })

onMounted(async () => {
  await workingDateStore.ensureLoaded()
  date.value = workingDateStore.workingDate
  load()
})
</script>

<style scoped>
.order-link { background: none; border: none; padding: 0; color: #005eb8; font-weight: 700; cursor: pointer; text-decoration: underline; }
.chip.cancelled { background: #fee2e2; color: #b91c1c; }
</style>
