<!--
  CashierRoomServicePage — the Room Service board.
  Tabs for All / Preparing / Served / Completed with live counts, plus a
  "+ New Room Service Order" flow that opens a modal in-house guest picker;
  the cashier picks a room and builds the order which posts to the room
  folio on settlement.
-->

<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="status-tabs">
        <button v-for="tab in tabs" :key="tab.key" class="status-tab" :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key">
          {{ tab.label }} <span class="n">{{ tab.count }}</span>
        </button>
      </div>
      <span class="spacer"></span>
      <label class="sm-inline-label" for="rs-date">{{ $t('cashier.summary.workingDate') }}</label>
      <OrderDateNav input-id="rs-date" v-model="date" :today="workingDateStore.workingDate"
        :today-label="$t('cashier.roomService.today')" @change="load" />
      <button type="button" class="sm-btn sm success" @click="togglePicker">
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
              <td colspan="7" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{
                $t('cashier.roomService.none') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- In-house guest picker modal: sits BELOW NewOrderModal so the order
         builder can stack on top of it. -->
    <Teleport to="body">
      <Transition name="rs-fade">
        <div v-if="showPicker" class="sm-modal-backdrop rs-picker-backdrop" @click.self="closePicker">
          <div class="sm-modal wide" role="dialog" aria-modal="true">
            <div class="sm-modal-head">
              <h3><i class="fas fa-bed" aria-hidden="true"></i> {{ $t('cashier.roomService.title') }}</h3>
              <button type="button" class="sm-btn ghost sm" @click.stop="closePicker">
                {{ $t('common.cancel') }}
              </button>
            </div>
            <div class="rs-picker-body">
              <div class="sm-search">
                <i class="fas fa-search" aria-hidden="true"></i>
                <input v-model="search" type="search" :placeholder="$t('common.search')" />
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
                      <button type="button" class="sm-btn sm success" @click.stop="openOrder(guest)">
                        <i class="fas fa-cart-plus" aria-hidden="true"></i> {{ $t('cashier.roomService.order') }}
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!filteredGuests.length">
                    <td colspan="4" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{
                      $t('cashier.roomService.noneInHouse') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <NewOrderModal v-if="activeGuest" mode="room_service"
      :title="$t('cashier.roomService.newOrderFor', { room: activeGuest.room_number, guest: activeGuest.guest_name })"
      :room-number="activeGuest.room_number" :guest-name-prefill="activeGuest.guest_name" @close="activeGuest = null"
      @created="onCreated" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { orderApi } from '@/api'
import { useWorkingDateStore } from '@/stores/workingDate'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import OrderDateNav from '@/components/cashier/OrderDateNav.vue'

const { t } = useI18n()

// ---- Store / board state --------------------------------------------------
const workingDateStore = useWorkingDateStore()
const date = ref(workingDateStore.workingDate || '')
const activeTab = ref('all')
const orders = ref([])
const loading = ref(true)

// ---- In-house guest picker state -----------------------------------------
const showPicker = ref(false)
const guestsLoading = ref(false)
const search = ref('')
const guests = ref([])
const activeGuest = ref(null)

// ---- Status metadata (adjust keys to match your backend) -----------------
const STATUS_KEYS = ['preparing', 'served', 'completed']

// ---- Tabs (computed so counts stay live) ---------------------------------
const tabs = computed(() => {
  const counts = { all: orders.value.length }
  for (const key of STATUS_KEYS) {
    counts[key] = orders.value.filter((o) => o.status === key).length
  }
  return [
    { key: 'all', label: t('common.all'), count: counts.all },
    ...STATUS_KEYS.map((key) => ({
      key,
      label: t(`cashier.roomService.${key}`),
      count: counts[key],
    })),
  ]
})

// ---- Filtered lists ------------------------------------------------------
const filteredOrders = computed(() => {
  if (activeTab.value === 'all') return orders.value
  return orders.value.filter((o) => o.status === activeTab.value)
})

const filteredGuests = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return guests.value
  return guests.value.filter((g) =>
    `${g.guest_name} ${g.room_number}`.toLowerCase().includes(term)
  )
})

// ---- Data loading --------------------------------------------------------
async function load() {
  loading.value = true
  try {
    const { data } = await orderApi.index({ date: date.value })
    // Handles Laravel paginator ({ data: [...] }) or a plain array.
    orders.value = data?.data || data?.orders || data?.results || data || []
  } catch (err) {
    console.error('Failed to load room-service orders:', err)
    orders.value = []
  } finally {
    loading.value = false
  }
}

async function loadGuests() {
  guestsLoading.value = true
  try {
    const { data } = await orderApi.formOptions()
    guests.value = (data.in_house_guests || []).map((g) => ({ ...g }))
  } catch (err) {
    console.error('Failed to load in-house guests:', err)
    guests.value = []
  } finally {
    guestsLoading.value = false
  }
}

// ---- UI actions ----------------------------------------------------------
function togglePicker() {
  showPicker.value = !showPicker.value
  if (showPicker.value && !guests.value.length) {
    loadGuests()
  }
}

function closePicker() {
  showPicker.value = false
}

function openOrder(guest) {
  // Keep the picker open; NewOrderModal stacks on top of it (z-index 1200).
  activeGuest.value = guest
}

function onCreated(order) {
  window.alert(t('cashier.order.created', { number: order.order_number }))
  // Optionally refresh the board and close both modals:
  // activeGuest.value = null
  // showPicker.value = false
  // load()
}

// ---- Display helpers -----------------------------------------------------
function itemsSummary(order) {
  const items = order.items || order.order_items || []
  if (!items.length) return '—'
  return items
    .map((it) => `${it.quantity ?? 1}× ${it.name ?? it.item_name ?? ''}`.trim())
    .join(', ')
}

function dateTimeOf(order) {
  const raw = order.created_at || order.date_time || order.ordered_at
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString()
}

function statusChip(status) {
  return `chip-${status || 'unknown'}`
}

function statusLabel(status) {
  if (!status) return '—'
  return t(`cashier.roomService.${status}`)
}

function money(value) {
  const n = Number(value ?? 0)
  if (Number.isNaN(n)) return value
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ---- Lifecycle -----------------------------------------------------------
onMounted(() => {
  load()
  loadGuests()
})
</script>

<style scoped>
/* ---- Guest picker: sits BELOW NewOrderModal (which uses z-index 1200),
        so the order builder can stack cleanly on top of it. ---- */
.rs-picker-backdrop {
  z-index: 1100;
}

.rs-picker-body {
  padding: 16px 18px 18px;
  overflow-y: auto;
}

.rs-picker-body .sm-search {
  margin-bottom: 12px;
}

/* ---- Ensure header interactive elements always receive clicks,
        in case global styles set pointer-events on the header. ---- */
.sm-modal-head {
  pointer-events: auto;
}

.sm-modal-head .sm-btn {
  pointer-events: auto;
  cursor: pointer;
}

/* ---- Modal transition: backdrop fades, panel scales in from below ---- */
.rs-fade-enter-active,
.rs-fade-leave-active {
  transition: opacity 0.2s ease;
}

.rs-fade-enter-active .sm-modal,
.rs-fade-leave-active .sm-modal {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.rs-fade-enter-from,
.rs-fade-leave-to {
  opacity: 0;
}

.rs-fade-enter-from .sm-modal,
.rs-fade-leave-to .sm-modal {
  opacity: 0;
  transform: scale(0.96) translateY(12px);
}
</style>