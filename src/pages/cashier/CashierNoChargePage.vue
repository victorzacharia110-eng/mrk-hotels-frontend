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
        <button class="sm-btn sm success" @click="showModal = true">
          <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('cashier.noCharge.newOrder') }}
        </button>
      </div>
      <div class="table-scroll">
      <table class="sm-table">
        <thead>
          <tr>
            <th>{{ $t('cashier.summary.order') }}</th>
            <th>{{ $t('cashier.order.account') }}</th>
            <th>{{ $t('cashier.roomService.guest') }}</th>
            <th>{{ $t('common.status') }}</th>
            <th>{{ $t('cashier.summary.amount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.order_id">
            <td><strong>{{ order.order_number }}</strong></td>
            <td>{{ order.no_charge_account || '—' }}</td>
            <td>{{ order.guest_name || '—' }}</td>
            <td><span class="chip pending">{{ order.status }}</span></td>
            <td>{{ money(order.total_amount) }}</td>
          </tr>
          <tr v-if="!orders.length">
            <td colspan="5" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.noCharge.none') }}</td>
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

const orders = ref([])
const showModal = ref(true) // auto-open: the nav click lands here to get the modal

const knownAccounts = computed(() =>
  [...new Set(orders.value.map((o) => o.no_charge_account).filter(Boolean))],
)

function money(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

async function load() {
  const { data } = await orderApi.index({ order_type: 'no_charge', per_page: 100 })
  orders.value = data.data || []
}

function onCreated() {
  showModal.value = false
  load()
}

onMounted(load)
</script>


