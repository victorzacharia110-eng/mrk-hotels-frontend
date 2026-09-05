<!--
  Kitchen Board — the cook's screen.
  Same open-orders layout as the waiter's order-taker page: light POS surface,
  Restaurant/Bar toggle and an order-card grid. Every dish is still one big
  tappable button — tap when it's ready (pending → ready), tap again when
  served (ready → served). Nothing else to open, no modals.
  The board refreshes itself so new tickets appear on their own.
-->
<template>
  <div class="taker-page">
    <!-- Same Restaurant / Bar switch as the waiter's open-orders screen, plus All -->
    <div class="pos-tabs">
      <div class="dept-toggle" role="group" :aria-label="$t('orderTaker.department')">
        <button
          type="button"
          :class="{ active: department === 'all' }"
          :aria-pressed="department === 'all'"
          @click="department = 'all'"
        >
          <i class="fas fa-layer-group" aria-hidden="true"></i> {{ $t('orderTaker.all') }}
        </button>
        <button
          type="button"
          :class="{ active: department === 'restaurant' }"
          :aria-pressed="department === 'restaurant'"
          @click="department = 'restaurant'"
        >
          <i class="fas fa-utensils" aria-hidden="true"></i> {{ $t('orderTaker.restaurant') }}
        </button>
        <button
          type="button"
          :class="{ active: department === 'bar' }"
          :aria-pressed="department === 'bar'"
          @click="department = 'bar'"
        >
          <i class="fas fa-martini-glass" aria-hidden="true"></i> {{ $t('orderTaker.bar') }}
        </button>
      </div>
    </div>

    <!-- Open-orders board header, same as the waiter's -->
    <div class="open-head">
      <h2>
        <i class="fas fa-fire-burner" aria-hidden="true"></i> {{ $t('kitchen.title') }}
        <span class="pos-tab-badge">{{ visibleCount }} {{ $t('kitchen.openOrders') }}</span>
      </h2>
      <div class="kb-controls">
        <label class="kb-auto">
          <input v-model="autoRefresh" type="checkbox" />
          {{ $t('kitchen.autoRefresh') }}
        </label>
        <button type="button" class="oh-manage kb-sound" :title="$t('notificationSound.soundSettings')" @click="showSound = !showSound">
          <i class="fas fa-music" aria-hidden="true"></i>
        </button>
        <button type="button" class="oh-manage" aria-label="$t('orderTaker.refresh')" @click="load">
          <i class="fas fa-rotate" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <div v-if="showSound" class="kb-sound-pop">
      <button type="button" class="kb-sound-close" :aria-label="$t('common.close')" @click="showSound = false">
        <i class="fas fa-xmark" aria-hidden="true"></i>
      </button>
      <NotificationSoundSettings />
    </div>

    <p v-if="error" class="send-error">{{ error }}</p>
    <div v-if="loading && !filteredOrders.length" class="cat-loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></div>
    <p v-else-if="!filteredOrders.length" class="cat-empty">{{ $t('kitchen.allClear') }}</p>

    <div v-else>
      <section v-for="sec in sections" :key="sec.dept" class="kb-section">
        <h3 class="kb-section-head">
          <span class="open-badge" :class="sec.badge">{{ sec.label }}</span>
          <span class="pos-tab-badge">{{ sec.orders.length }}</span>
        </h3>
        <div class="open-grid">
          <article
            v-for="order in sec.orders"
            :key="order.order_id"
            class="open-card"
            :class="{ done: allDone(order) }"
          >
            <header class="open-card-head">
              <strong>{{ order.order_number }}</strong>
              <span class="open-badge" :class="deptBadge(order.department)">{{ deptLabel(order.department) }}</span>
            </header>

            <p class="open-meta">
              <i class="fas fa-location-dot" aria-hidden="true"></i>
              {{ order.table_number || order.room_number || '—' }}
              · {{ order.waiter_name || '—' }}
              · <span class="kb-time">{{ since(order.created_at) }}</span>
            </p>

            <!-- The dish IS the button: one tap = status change (functionality unchanged) -->
            <div class="kb-items">
              <button
                v-for="item in order.items || []"
                :key="item.order_item_id"
                type="button"
                class="kb-item"
                :class="[item.status]"
                :disabled="busy === item.order_item_id"
                @click="advance(item)"
              >
                <span class="kb-item-main">
                  <span class="kb-item-name">{{ item.quantity }}× {{ item.item_name }}</span>
                  <span class="kb-item-state">
                    <i v-if="item.status === 'served'" class="fas fa-check-double" aria-hidden="true"></i>
                    <i v-else-if="item.status === 'ready'" class="fas fa-bell-concierge" aria-hidden="true"></i>
                    {{ itemState(item.status) }}
                  </span>
                </span>
                <span v-if="item.accompaniment" class="kb-item-accomp">
                  <i class="fas fa-bowl-rice" aria-hidden="true"></i> {{ item.accompaniment }}
                </span>
              </button>
            </div>

            <p class="open-total">
              {{ $t('orderTaker.orderTotal') }}: <strong>TZS {{ money(order.total_amount) }}</strong>
              · <span :class="order.payment_status === 'unpaid' ? 'pay-unpaid' : 'pay-ok'">{{ order.payment_status }}</span>
            </p>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { orderApi } from '@/api'
import { useNotificationSettingsStore } from '@/stores/notificationSettings'
import NotificationSoundSettings from '@/components/notification/NotificationSoundSettings.vue'

const { t } = useI18n()

const orders = ref([])
const loading = ref(true)
const error = ref('')
const busy = ref(null)
const autoRefresh = ref(true)
const department = ref('all')
const showSound = ref(false)
const notifSettingsStore = useNotificationSettingsStore()
notifSettingsStore.load()
let timer = null

// Statuses that still need kitchen/runner attention; everything else leaves the board.
const OPEN_STATUSES = ['pending', 'in_progress', 'processing', 'preparing', 'ready', 'served']

const openOrders = computed(() =>
  orders.value.filter((o) => {
    const items = o.items || []
    const stillCooking = items.some((i) => i.status !== 'served')
    return OPEN_STATUSES.includes(o.status) && stillCooking
  }),
)

// Orders split by department so the board shows Restaurant and Bar categories.
const restaurantOrders = computed(() => openOrders.value.filter((o) => o.department === 'restaurant'))
const barOrders = computed(() => openOrders.value.filter((o) => o.department === 'bar'))

// Individual department view (restaurant / bar), or the lot.
const filteredOrders = computed(() =>
  department.value === 'all'
    ? openOrders.value
    : openOrders.value.filter((o) => o.department === department.value),
)

// Board sections: both categories on the All view, or a single category otherwise.
const sections = computed(() => {
  if (department.value !== 'all') {
    return [
      {
        dept: department.value,
        label: deptLabel(department.value),
        badge: deptBadge(department.value),
        orders: filteredOrders.value,
      },
    ]
  }
  const list = []
  if (restaurantOrders.value.length) {
    list.push({ dept: 'restaurant', label: deptLabel('restaurant'), badge: deptBadge('restaurant'), orders: restaurantOrders.value })
  }
  if (barOrders.value.length) {
    list.push({ dept: 'bar', label: deptLabel('bar'), badge: deptBadge('bar'), orders: barOrders.value })
  }
  return list
})

const visibleCount = computed(() => filteredOrders.value.length)

function allDone(order) {
  const items = order.items || []
  return items.length > 0 && items.every((i) => i.status === 'served')
}

/** Loads today's orders and keeps only ones with something still open. */
async function load() {
  error.value = ''
  try {
    const res = await orderApi.index({ per_page: 100 })
    const rows = res.data?.data || res.data || []
    // Keep only orders that are not completed/cancelled and have line items.
    orders.value = rows.filter((o) => OPEN_STATUSES.includes(o.status))
  } catch (err) {
    error.value = err.response?.data?.message || t('kitchen.loadError')
  } finally {
    loading.value = false
  }
}

/**
 * One tap on a dish: pending → ready (kitchen), ready → served (runner).
 * Served dishes stay visible briefly as confirmation, then the board reloads.
 */
async function advance(item) {
  if (item.status === 'served') return
  const next = item.status === 'pending' ? 'ready' : 'served'
  busy.value = item.order_item_id
  try {
    await orderApi.markItemStatus(item.order_id, item.order_item_id, next)
    item.status = next
    if (next === 'served') setTimeout(load, 1200)
  } catch (err) {
    error.value = err.response?.data?.message || t('kitchen.updateError')
  } finally {
    busy.value = null
  }
}

function deptLabel(dept) {
  return t(`orderTaker.${dept}`)
}

function deptBadge(dept) {
  return dept === 'bar' ? 'badge-blue' : 'badge-yellow'
}

function itemState(status) {
  if (status === 'ready') return t('orders.itemStatusReady')
  if (status === 'served') return t('orders.itemStatusServed')
  return t('kitchen.tapWhenReady')
}

/** Minutes elapsed since the ticket was placed. */
function since(ts) {
  if (!ts) return ''
  const mins = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000))
  return `${mins}′`
}

/** Formats a money value with thousands separators (matches the waiter page). */
function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

onMounted(() => {
  load()
  timer = setInterval(() => {
    if (autoRefresh.value) load()
  }, 15000)
})

onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
/* Light touch-POS surface — identical look to the waiter's order-taker page. */
.taker-page {
  min-height: 100vh;
  background: #e9e9ec;
  padding: 12px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pos-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 4px;
}

.dept-toggle {
  display: flex;
  border: 1px solid #d4d4d8;
  border-radius: 9px;
  overflow: hidden;
  min-width: 220px;
}

.dept-toggle button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 14px 12px;
  font-size: 15px;
  font-weight: 700;
  color: #52525b;
  background: linear-gradient(180deg, #fafafa, #f0f0f2);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.dept-toggle button + button {
  border-left: 1px solid #d4d4d8;
}

.dept-toggle button.active {
  background: #b8860b;
  color: #fff;
}

.open-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.open-head h2 {
  font-size: 17px;
  font-weight: 800;
  color: #27272a;
  display: flex;
  align-items: center;
  gap: 10px;
}

.kb-sound-pop {
  position: relative;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
  padding: 14px;
  margin-bottom: 12px;
  z-index: 20;
}

.kb-sound-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: #f1f5f9;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
}

.kb-sound-close:hover {
  background: #fee2e2;
  color: #b91c1c;
}

.kb-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.kb-auto {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #71717a;
  cursor: pointer;
}

.pos-tab-badge {
  background: #b8860b;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
}

.oh-manage {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #c9a227;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.oh-manage:hover { background: #a8871e; }

.send-error {
  color: #dc2626;
  font-size: 13px;
  margin: 0;
  text-align: center;
}

.cat-loading {
  text-align: center;
  padding: 26px;
  color: #b8860b;
  font-size: 20px;
}

.cat-empty {
  text-align: center;
  color: #a1a1aa;
  padding: 20px;
  margin: 0;
}

/* ---- Department sections on the All view ---- */
.kb-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kb-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.kb-section-head:not(:first-of-type) {
  margin-top: 4px;
}

/* ---- Open orders grid (same cards as the waiter page) ---- */
.open-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.open-card {
  background: #fff;
  border: 1px solid #d4d4d8;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.open-card.done {
  opacity: 0.45;
}

.open-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  color: #27272a;
}

.open-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-yellow { background: #fef9c3; color: #854d0e; }
.badge-blue { background: #dbeafe; color: #1e40af; }

.open-meta {
  margin: 0;
  font-size: 13px;
  color: #71717a;
}

.open-total {
  margin: 0;
  font-size: 13px;
  color: #52525b;
}

.pay-unpaid { color: #b91c1c; font-weight: 700; }
.pay-ok { color: #15803d; font-weight: 700; }

.kb-time {
  color: #b91c1c;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* The dish IS the button: one tap = status change. Light theme, still one big target. */
.kb-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kb-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  border: 2px solid #d4d4d8;
  background: #fff;
  color: #27272a;
  border-radius: 10px;
  padding: 12px 14px;
  cursor: pointer;
  font-size: 15px;
  width: 100%;
  transition: transform 0.12s, border-color 0.12s;
}

.kb-item:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: #b8860b;
}

.kb-item.pending {
  border-color: #d97706;
}

.kb-item.ready {
  border-color: #16a34a;
  background: #f0fdf4;
}

.kb-item.served {
  background: #f4f4f5;
  border-color: #d4d4d8;
  opacity: 0.6;
  cursor: default;
}

.kb-item-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}

.kb-item-name {
  font-weight: 700;
  font-size: 14px;
}

.kb-item-state {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #71717a;
}

.kb-item.ready .kb-item-state { color: #15803d; }

.kb-item-accomp {
  font-size: 12px;
  color: #b8860b;
}

/* ---- Responsive: phones / small tablets ---- */
@media (max-width: 768px) {
  .taker-page {
    padding: 8px 10px 20px;
    gap: 10px;
  }

  .pos-tabs {
    flex-wrap: wrap;
  }

  .dept-toggle {
    width: 100%;
    min-width: 0;
  }

  .dept-toggle button {
    padding: 12px 8px;
    font-size: 14px;
  }
}
</style>