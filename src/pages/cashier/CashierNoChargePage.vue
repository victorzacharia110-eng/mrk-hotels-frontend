<!--
  CashierNoChargePage — "No Charge" ordering mode.
  Clicking the sidebar item opens the no-charge modal straight away
  (account picker with previously used accounts, waiter + guest detail);
  the list of existing no-charge tickets stays behind it for reference.
-->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-gift" aria-hidden="true"></i> {{ $t('cashier.noCharge.title') }}</h2>
        <div class="nc-head-actions">
          <label class="sm-inline-label" for="nc-date">{{ $t('cashier.noCharge.workingDate') }}</label>
          <OrderDateNav input-id="nc-date" v-model="date" :today="workingDateStore.workingDate"
            :today-label="$t('cashier.noCharge.today')" @change="load" />
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
            <th>{{ $t('cashier.noCharge.dateTime') }}</th>
            <th>{{ $t('common.status') }}</th>
            <th>{{ $t('cashier.summary.amount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.order_id">
            <td><strong>{{ order.order_number }}</strong></td>
            <td>{{ order.no_charge_account || '—' }}</td>
            <td>{{ order.guest_name || '—' }}</td>
            <td>{{ dateTimeOf(order) }}</td>
            <td><span class="chip pending">{{ order.status }}</span></td>
            <td>{{ money(order.total_amount) }}</td>
          </tr>
          <tr v-if="!orders.length">
            <td colspan="6" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.noCharge.none') }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </section>

    <!-- The modal opens automatically when the No Charge nav item is clicked. -->
    <NewOrderModal v-if="showModal" mode="no_charge" :title="$t('cashier.noCharge.newOrder')"
      :known-accounts="knownAccounts" @close="showModal = false" @created="onCreated" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { orderApi } from '@/api'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'
import OrderDateNav from '@/components/cashier/OrderDateNav.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { useWorkingDateStore } from '@/stores/workingDate'
import { formatOrderDateTime, todayISO } from '@/utils/dates'

const workingDateStore = useWorkingDateStore()

const orders = ref([])
const loading = ref(true)
const showModal = ref(true) // auto-open: the nav click lands here to get the modal
const date = ref('')

const knownAccounts = computed(() =>
  [...new Set(orders.value.map((o) => o.no_charge_account).filter(Boolean))],
)

function money(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

/** Human-readable date + time for the row (the board can show older dates). */
function dateTimeOf(order) {
  return formatOrderDateTime(order.created_at || order.order_date)
}

async function load() {
  loading.value = true
  try {
    const params = { order_type: 'no_charge', per_page: 100 }
    // "Previous orders" (a date before today) lists that whole date's tickets.
    if (date.value && date.value < todayISO()) params.date = date.value
    const { data } = await orderApi.index(params)
    const rows = data.data || []
    // Otherwise show today's tickets by business order date, so anything the
    // backend clock stamps on the wrong calendar day still surfaces.
    orders.value = params.date
      ? rows
      : rows.filter((o) => (o.order_date || '').slice(0, 10) === date.value)
  } finally {
    loading.value = false
  }
}

function onCreated() {
  showModal.value = false
  load()
}

onMounted(async () => {
  await workingDateStore.ensureLoaded()
  date.value = workingDateStore.workingDate
  load()
})
</script>

<style scoped>
.nc-head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
</style>

