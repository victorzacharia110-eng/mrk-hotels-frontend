<!--
  CashierRoomServicePage — in-house guests for room service ordering.
  Lists every checked-in reservation; the cashier picks a guest and builds
  the order which posts to the room folio on settlement.
-->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-bed" aria-hidden="true"></i> {{ $t('cashier.roomService.title') }}</h2>
        <div class="sm-search">
          <i class="fas fa-search" aria-hidden="true"></i>
          <input v-model="search" type="search" :placeholder="$t('common.search')" />
        </div>
      </div>
      <SkeletonLoader v-if="loading" variant="table" :count="6" :cols="4" />
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


