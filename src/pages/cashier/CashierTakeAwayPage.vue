<!--
  CashierTakeAwayPage — the Take Away board.
  Tabs for All / Preparing / Ready / Completed with live counts, plus an
  "Add Take Away Order" flow that builds the ticket with menu items and
  their accompaniments before posting it to the kitchen.
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
            <th>{{ $t('cashier.summary.time') }}</th>
            <th>{{ $t('common.status') }}</th>
            <th>{{ $t('cashier.summary.amount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filteredOrders" :key="order.order_id">
            <td><strong>{{ order.order_number }}</strong></td>
            <td>{{ order.guest_name || '—' }}</td>
            <td>{{ order.waiter_name || '—' }}</td>
            <td>{{ timeOf(order.created_at) }}</td>
            <td><span class="chip" :class="statusChip(order.status)">{{ statusLabel(order.status) }}</span></td>
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
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { orderApi } from '@/api'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const { t, te } = useI18n()

const orders = ref([])
const loading = ref(true)
const activeTab = ref('all')
const showModal = ref(false)

const TAB_STATUS = {
  preparing: ['pending', 'in_progress', 'processing', 'preparing'],
  ready: ['ready', 'served'],
  completed: ['completed'],
}

const tabs = computed(() => [
  { key: 'all', label: t('cashier.takeAway.tabAll'), count: orders.value.length },
  { key: 'preparing', label: t('cashier.takeAway.tabPreparing'), count: countFor('preparing') },
  { key: 'ready', label: t('cashier.takeAway.tabReady'), count: countFor('ready') },
  { key: 'completed', label: t('cashier.takeAway.tabCompleted'), count: countFor('completed') },
])

const filteredOrders = computed(() => {
  const statuses = TAB_STATUS[activeTab.value]
  if (!statuses) return orders.value
  return orders.value.filter((o) => statuses.includes(o.status))
})

function countFor(tab) {
  return orders.value.filter((o) => TAB_STATUS[tab].includes(o.status)).length
}

function statusLabel(status) {
  const key = `cashier.takeAway.status.${status}`
  return te(key) ? t(key) : status
}

function statusChip(status) {
  if (TAB_STATUS.completed.includes(status)) return 'approved'
  if (TAB_STATUS.ready.includes(status)) return 'partial'
  return 'pending'
}

function timeOf(iso) {
  return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'
}

function money(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

async function load() {
  loading.value = true
  try {
    const { data } = await orderApi.index({ order_type: 'takeaway', per_page: 100 })
    orders.value = data.data || []
  } finally {
    loading.value = false
  }
}

function onCreated() {
  showModal.value = false
  load()
}

onMounted(load)
</script>
