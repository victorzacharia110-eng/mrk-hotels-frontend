<!--
  CashierRoomServicePage — the Room Service board.
  Tabs for All / Preparing / Served / Completed with live counts, plus a
  "+ New Room Service Order" flow that opens the in-house guest picker; the
  cashier picks a room and builds the order which posts to the room folio
  on settlement.
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
      <label class="sm-inline-label" for="rs-date">{{ $t('cashier.summary.workingDate') }}</label>
      <OrderDateNav input-id="rs-date" v-model="date" :today="workingDateStore.workingDate"
        :today-label="$t('cashier.roomService.today')" @change="load" />
      <button class="sm-btn sm success" @click="togglePicker">
        <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('cashier.roomService.newOrder') }}
      </button>
    </div>

    <section class="panel">
      <div class="table-scroll">
      <SkeletonLoader v-if="loading" variant="table" :count="6" :cols="7" />
      <table class="sm-table" v-else>
        <thead>
          <tr>
            <th>{{ $t('cashier.summary.order') }}</th>
            <th>{{ $t('cashier.roomService.room') }}</th>
            <th>{{ $t('cashier.roomService.guest') }}</th>
            <th>{{ $t('cashier.roomService.items') }}</th>
            <th>{{ $t('cashier.roomService.dateTime') }}</th>
            <th>{{ $t('common.status') }}</th>
            <th>{{ $t('cashier.summary.amount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filteredOrders" :key="order.order_id">
            <td><strong>{{ order.order_number }}</strong></td>
            <td><strong>{{ order.room_number || '—' }}</strong></td>
            <td>{{ order.guest_name || '—' }}</td>
            <td class="items-cell">{{ itemsSummary(order) }}</td>
            <td>{{ dateTimeOf(order) }}</td>
            <td><span class="chip" :class="statusChip(order.status)">{{ statusLabel(order.status) }}</span></td>
            <td>{{ money(order.total_amount) }}</td>
          </tr>
          <tr v-if="!filteredOrders.length">
            <td colspan="7" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.roomService.none') }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </section>

    <!-- In-house guest picker: the entry point for a new room-service order. -->
    <section v-if="showPicker" class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-bed" aria-hidden="true"></i> {{ $t('cashier.roomService.title') }}</h2>
        <div class="sm-search">
          <i class="fas fa-search" aria-hidden="true"></i>
          <input v-model="search" type="search" :placeholder="$t('common.search')" />
        </div>
      </div>
      <SkeletonLoader v-if="guestsLoading" variant="table" :count="6" :cols="4" />
      <table class="sm-table" v-else>
        <thead>
          <tr>
            <th>{{ $t('cashier.roomService.room') }}</th>
            <th>{{ $t('cashier.roomService.guest') }}</th>
            <th>{{ $t('cashier.roomService.checkOut') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="guest in filteredGuests" :key="guest.reservation_id">
            <td><strong>{{ guest.room_number }}</strong></td>
            <td>{{ guest.guest_name }}</td>
            <td>{{ guest.check_out || '—' }}</td>
            <td>
              <button class="sm-btn sm success" @click="openOrder(guest)">
                <i class="fas fa-cart-plus" aria-hidden="true"></i> {{ $t('cashier.roomService.order') }}
              </button>
            </td>
          </tr>
          <tr v-if="!filteredGuests.length">
            <td colspan="4" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.roomService.noneInHouse') }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <NewOrderModal v-if="activeGuest" mode="room_service"
      :title="$t('cashier.roomService.newOrderFor', { room: activeGuest.room_number, guest: activeGuest.guest_name })"
      :room-number="activeGuest.room_number" :guest-name-prefill="activeGuest.guest_name"
      @close="activeGuest = null" @created="onCreated" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { orderApi } from '@/api'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const { t } = useI18n()

const guests = ref([])
const loading = ref(true)
const search = ref('')
const activeGuest = ref(null)

const filteredGuests = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return guests.value
  return guests.value.filter((g) => `${g.guest_name} ${g.room_number}`.toLowerCase().includes(term))
})

function openOrder(guest) {
  activeGuest.value = guest
}

// The shared modal reads its own form state; prefill the guest name via prop.
function onCreated(order) {
  window.alert(t('cashier.order.created', { number: order.order_number }))
}

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await orderApi.formOptions()
    guests.value = (data.in_house_guests || []).map((g) => ({ ...g }))
  } finally {
    loading.value = false
  }
})
</script>


