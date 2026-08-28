<!--
  CashierDeliveryPage — the Delivery Manager board.
  Tabs for All / Preparing / Dispatched / Completed with live counts, plus
  an "Add Delivery Order" flow that captures guest contact details, the
  delivery address and the expected delivery time.
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
        <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('cashier.delivery.addOrder') }}
      </button>
    </div>

    <section class="panel">
      <table class="sm-table">
        <thead>
          <tr>
            <th>{{ $t('cashier.summary.order') }}</th>
            <th>{{ $t('cashier.roomService.guest') }}</th>
            <th>{{ $t('cashier.delivery.phone') }}</th>
            <th>{{ $t('cashier.delivery.address') }}</th>
            <th>{{ $t('cashier.delivery.eta') }}</th>
            <th>{{ $t('common.status') }}</th>
            <th>{{ $t('cashier.summary.amount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filteredOrders" :key="order.order_id">
            <td><strong>{{ order.order_number }}</strong></td>
            <td>{{ order.guest_name || '—' }}</td>
            <td>{{ order.delivery_phone || '—' }}</td>
            <td class="addr-cell">{{ order.delivery_address || '—' }}</td>
            <td>{{ order.expected_minutes ? `${order.expected_minutes} ${$t('cashier.delivery.minutes')}` : '—' }}</td>
            <td><span class="chip" :class="statusChip(order.status)">{{ statusLabel(order.status) }}</span></td>
            <td>{{ money(order.total_amount) }}</td>
          </tr>
          <tr v-if="!filteredOrders.length">
            <td colspan="7" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.delivery.none') }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <NewOrderModal v-if="showModal" mode="delivery" :title="$t('cashier.delivery.addOrder')"
      @close="showModal = false" @created="onCreated" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { orderApi } from '@/api'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'

const { t, te } = useI18n()

const orders = ref([])
const activeTab = ref('all')
const showModal = ref(false)

const TAB_STATUS = {
  preparing: ['pending', 'in_progress', 'processing', 'preparing'],
  dispatched: ['ready', 'served'],
  completed: ['completed'],
}

const tabs = computed(() => [
  { key: 'all', label: t('cashier.delivery.tabAll'), count: orders.value.length },
  { key: 'preparing', label: t('cashier.delivery.tabPreparing'), count: countFor('preparing') },
  { key: 'dispatched', label: t('cashier.delivery.tabDispatched'), count: countFor('dispatched') },
  { key: 'completed', label: t('cashier.delivery.tabCompleted'), count: countFor('completed') },
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
  const key = `cashier.delivery.status.${status}`
  return te(key) ? t(key) : status
}

function statusChip(status) {
  if (TAB_STATUS.completed.includes(status)) return 'approved'
  if (TAB_STATUS.dispatched.includes(status)) return 'partial'
  return 'pending'
}

function money(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

async function load() {
  const { data } = await orderApi.index({ order_type: 'delivery', per_page: 100 })
  orders.value = data.data || []
}

function onCreated() {
  showModal.value = false
  load()
}

onMounted(load)
</script>


<style scoped>
.addr-cell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
