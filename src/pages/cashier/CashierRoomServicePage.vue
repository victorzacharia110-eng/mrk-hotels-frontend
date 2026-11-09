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
      <OrderDateNav input-id="rs-date" v-model="date" :today="workingToday"
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
              <th>{{ $t('cashier.summary.waiter') }}</th>
              <th>{{ $t('cashier.roomService.time') }}</th>
              <th>{{ $t('common.status') }}</th>
              <th>{{ $t('cashier.summary.amount') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in filteredOrders" :key="order.order_id">
              <td><button class="order-link" @click="peekId = order.order_id">{{ order.order_number }}</button></td>
              <td><strong>{{ order.room_number || '—' }}</strong></td>
              <td>{{ order.guest_name || '—' }}</td>
              <td>{{ order.waiter_name || '—' }}</td>
              <td>{{ timeOf(order) }}</td>
              <td><span class="chip" :class="statusChip(order)">{{ statusLabel(order) }}</span></td>
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
                        {{ $t('cashier.roomService.order') }}
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

    <OrderPeekModal :open="!!peekId" :order-id="peekId" @close="peekId = null" />
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
import { selectedOutlet } from '@/composables/useOutletContext'
import { useWorkingDateStore } from '@/stores/workingDate'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'
import OrderPeekModal from '@/components/cashier/OrderPeekModal.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import OrderDateNav from '@/components/cashier/OrderDateNav.vue'
import { formatTime } from '@/utils/dates'

const { t } = useI18n()

// ---- Store / board state --------------------------------------------------
// Read through a null-safe computed: a chunk-ordering quirk in a past build
// left this binding undefined, which white-screened the whole panel. The page
// must always render, so it falls back to the local date.
const workingDateStore = useWorkingDateStore()
const localToday = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
const workingToday = computed(() => workingDateStore?.workingDate || localToday())
const date = ref(workingToday.value)
const activeTab = ref('pending')
const orders = ref([])
const loading = ref(true)
const peekId = ref(null)

// ---- In-house guest picker state -----------------------------------------
const showPicker = ref(false)
const guestsLoading = ref(false)
const search = ref('')
const guests = ref([])
const activeGuest = ref(null)

// ---- Status buckets ------------------------------------------------------
const isSettled = (o) => o.status === 'completed' || (o.payment_status && o.payment_status !== 'unpaid')
const isVoided = (o) => o.status === 'cancelled'
const isPending = (o) => !isSettled(o) && !isVoided(o)

// ---- Tabs (computed so counts stay live) ---------------------------------
const tabs = computed(() => [
  { key: 'pending', label: t('cashier.takeAway.tabPending'), count: orders.value.filter(isPending).length },
  { key: 'settled', label: t('cashier.takeAway.tabSettled'), count: orders.value.filter(isSettled).length },
  { key: 'voided', label: t('cashier.takeAway.tabVoided'), count: orders.value.filter(isVoided).length },
])

// ---- Filtered lists ------------------------------------------------------
const filteredOrders = computed(() => {
  if (activeTab.value === 'settled') return orders.value.filter(isSettled)
  if (activeTab.value === 'voided') return orders.value.filter(isVoided)
  return orders.value.filter(isPending)
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
    const { data } = await orderApi.index({
      date: date.value,
      order_type: 'room_service',
      per_page: 100,
      outlet_id: selectedOutlet.value?.outlet_id || undefined,
    })
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

function onCreated() {
  activeGuest.value = null
  load()
}

// ---- Display helpers -----------------------------------------------------
function timeOf(order) {
  return formatTime(order.created_at || order.date_time || order.ordered_at)
}

function statusChip(order) {
  if (isVoided(order)) return 'cancelled'
  if (isSettled(order)) return 'approved'
  return 'pending'
}

function statusLabel(order) {
  if (isVoided(order)) return t('cashier.takeAway.status.cancelled')
  if (isSettled(order)) return t('cashier.takeAway.status.completed')
  return t('cashier.takeAway.status.pending')
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
onMounted(async () => {
  await workingDateStore.ensureLoaded()
  date.value = workingDateStore.workingDate
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

.order-link { background: none; border: none; padding: 0; color: #005eb8; font-weight: 700; cursor: pointer; text-decoration: underline; }
.chip.cancelled { background: #fee2e2; color: #b91c1c; }

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