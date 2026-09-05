<!--
  AdminOverviewPage.vue
  Hotel admin/owner overview (route /app/overview). Combines KPI stat cards,
  an interactive staff directory with role/status filters, pagination and
  activate/deactivate actions, an in-house guest list with balances and
  check-out shortcuts, upcoming arrivals, and a housekeeping task list with
  assign/confirm/verify/complete actions. Each section's filters reload the
  overview API with debouncing. Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Loading indicator shown until the first overview payload arrives -->
    <div v-if="loading" class="alert alert-info">{{ $t('overview.loading') }}</div>

    <template v-else-if="data">
      <!-- Header: page title and hotel name badge -->
      <div class="dash-header">
        <div>
          <h1>{{ $t('overview.title') }}</h1>
          <p>{{ $t('overview.subtitle') }}</p>
        </div>
        <span class="role-badge"><i class="fas fa-user-shield"></i> {{ hotelName }}</span>
      </div>

      <!-- Inline feedback banners (e.g. after toggling a staff account) -->
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div v-if="success" class="alert alert-success">{{ success }}</div>

      <!-- Summary status pills (stay-view style) computed from the same data -->
      <div class="sv-pills">
        <span v-for="pill in statusPills" :key="pill.key" class="sv-pill" :class="pill.key">
          {{ pill.label }} <strong>{{ pill.count }}</strong>
        </span>
      </div>

      <!-- Room status distribution as one segmented track bar (stay-view style) -->
      <div class="card sv-card">
        <div class="sv-card-head">
          <h2><i class="fas fa-bed"></i> {{ $t('overview.housekeepingSummary') }}</h2>
          <router-link to="/app/housekeeping" class="view-all-link"
            >{{ $t('overview.viewAllHousekeeping') }} <i class="fas fa-arrow-right"></i
          ></router-link>
        </div>
        <div class="sv-segbar">
          <div
            class="sv-seg seg-clean"
            :style="{ width: roomPct(roomStatus.clean) + '%' }"
            :title="`${$t('overview.roomsClean')}: ${roomStatus.clean}`"
          ></div>
          <div
            class="sv-seg seg-dirty"
            :style="{ width: roomPct(roomStatus.dirty) + '%' }"
            :title="`${$t('overview.roomsDirty')}: ${roomStatus.dirty}`"
          ></div>
          <div
            class="sv-seg seg-blocked"
            :style="{ width: roomPct(roomStatus.blocked) + '%' }"
            :title="`${$t('overview.roomsBlocked')}: ${roomStatus.blocked}`"
          ></div>
        </div>
        <div class="sv-seg-legend">
          <span class="legend-item"><i class="dot dot-clean"></i> {{ $t('overview.roomsClean') }} — <strong>{{ roomStatus.clean }}</strong></span>
          <span class="legend-item"><i class="dot dot-dirty"></i> {{ $t('overview.roomsDirty') }} — <strong>{{ roomStatus.dirty }}</strong></span>
          <span class="legend-item"><i class="dot dot-blocked"></i> {{ $t('overview.roomsBlocked') }} — <strong>{{ roomStatus.blocked }}</strong></span>
        </div>
      </div>

      <!-- Occupancy & guest flow represented as horizontal bars -->
      <div class="card sv-card">
        <div class="sv-card-head"><h2><i class="fas fa-gauge-high"></i> {{ $t('overview.occupancyRate') }} & {{ $t('overview.inHouse') }}</h2></div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'occupancy')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-percent"></i> {{ $t('overview.occupancyRate') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-blue" :style="{ width: Math.min(100, Number(data.stats.occupancy_rate) || 0) + '%' }">
              <span class="sv-bar-label">{{ data.stats.occupancy_rate }}%</span>
            </div>
          </div>
        </div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'in-house')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-users"></i> {{ $t('overview.inHouse') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-blue" :style="{ width: pctOfRooms(data.stats.guests_in_house) + '%' }">
              <span class="sv-bar-label">{{ data.stats.guests_in_house }}</span>
            </div>
          </div>
        </div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'occupied')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-bed"></i> {{ $t('overview.occupiedRooms') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-blue" :style="{ width: pctOfRooms(data.stats.occupied_rooms) + '%' }">
              <span class="sv-bar-label">{{ data.stats.occupied_rooms }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Today's arrivals / departures / upcoming flow as bars -->
      <div class="card sv-card">
        <div class="sv-card-head"><h2><i class="fas fa-right-left"></i> {{ $t('overview.arrivalsToday') }}</h2></div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'arrivals')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-right-to-bracket"></i> {{ $t('overview.arrivalsToday') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-green" :style="{ width: pctOfFlow(data.stats.arrivals_today) + '%' }">
              <span class="sv-bar-label">{{ data.stats.arrivals_today }}</span>
            </div>
          </div>
        </div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'departures')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-right-from-bracket"></i> {{ $t('overview.departuresToday') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-green" :style="{ width: pctOfFlow(data.stats.departures_today) + '%' }">
              <span class="sv-bar-label">{{ data.stats.departures_today }}</span>
            </div>
          </div>
        </div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'upcoming')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-calendar-check"></i> {{ $t('overview.upcomingArrivals') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-green" :style="{ width: pctOfRooms(data.stats.upcoming_arrivals) + '%' }">
              <span class="sv-bar-label">{{ data.stats.upcoming_arrivals }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Staff, housekeeping queue and open issues as bars -->
      <div class="card sv-card">
        <div class="sv-card-head"><h2><i class="fas fa-user-tie"></i> {{ $t('overview.staffSection') }}</h2></div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'staff')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-user-tie"></i> {{ $t('overview.staffActive') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-green" :style="{ width: ratioPct(data.stats.staff_active, data.stats.staff_total) + '%' }">
              <span class="sv-bar-label">{{ data.stats.staff_active }}/{{ data.stats.staff_total }}</span>
            </div>
          </div>
        </div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'housekeeping')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-broom"></i> {{ $t('overview.pendingHousekeeping') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-red" :style="{ width: pctOfRooms(data.stats.pending_housekeeping) + '%' }">
              <span class="sv-bar-label">{{ data.stats.pending_housekeeping }}</span>
            </div>
          </div>
        </div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'issues')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-flag"></i> {{ $t('overview.openIssues') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-red" :style="{ width: pctOfRooms(data.stats.open_issues) + '%' }">
              <span class="sv-bar-label">{{ data.stats.open_issues }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- F&B orders and sales as bars -->
      <div class="card sv-card">
        <div class="sv-card-head"><h2><i class="fas fa-utensils"></i> {{ $t('overview.fnbTitle') }}</h2></div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'orders-all')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-receipt"></i> {{ $t('overview.fnbAllToday') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-blue" :style="{ width: orderPct(fnb.orders_all, 0) + '%' }">
              <span class="sv-bar-label">{{ fnb.orders_all }}</span>
            </div>
          </div>
        </div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'orders-running')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-fire"></i> {{ $t('overview.fnbRunning') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-green" :style="{ width: orderPct(fnb.orders_running, fnb.orders_all) + '%' }">
              <span class="sv-bar-label">{{ fnb.orders_running }}</span>
            </div>
          </div>
        </div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'orders-settled')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-check-double"></i> {{ $t('overview.fnbSettled') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-green" :style="{ width: orderPct(fnb.orders_settled, fnb.orders_all) + '%' }">
              <span class="sv-bar-label">{{ fnb.orders_settled }}</span>
            </div>
          </div>
        </div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'sales-total')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-dollar-sign"></i> {{ $t('overview.totalSales') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-green" :style="{ width: salesPct(fnb.total_sales, fnb.total_sales) + '%' }">
              <span class="sv-bar-label">{{ formatMoney(fnb.total_sales) }}</span>
            </div>
          </div>
        </div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'sales-bar')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-martini-glass"></i> {{ $t('overview.barSales') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-blue" :style="{ width: salesPct(fnb.bar_sales, fnb.total_sales) + '%' }">
              <span class="sv-bar-label">{{ formatMoney(fnb.bar_sales) }}</span>
            </div>
          </div>
        </div>
        <div
          class="sv-bar-row has-pop-row"
          @mouseenter="showBarTip($event, 'sales-restaurant')"
          @mousemove="moveBarTip"
          @mouseleave="hideBarTip"
        >
          <span class="sv-row-label"><i class="fas fa-utensils"></i> {{ $t('overview.restaurantSales') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-blue" :style="{ width: salesPct(fnb.restaurant_sales, fnb.total_sales) + '%' }">
              <span class="sv-bar-label">{{ formatMoney(fnb.restaurant_sales) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Hover popover on bars: shows the detail records (in-house / upcoming / housekeeping) -->
      <div
        v-if="barTip"
        class="sv-popover"
        :style="{ left: barTip.x + 'px', top: barTip.y + 'px' }"
        @mouseenter="keepBarTip()"
        @mouseleave="hideBarTip()"
      >
        <div class="sv-popover-head">
          <span v-if="tipHeader(barTip.key).icon" class="sv-popover-icon">
            <i :class="['fas', tipHeader(barTip.key).icon]"></i>
          </span>
          <div class="sv-popover-title">{{ tipHeader(barTip.key).title }}</div>
        </div>

        <template v-if="barTip.key === 'in-house'">
          <div v-if="!inHouseRows.length" class="sv-popover-empty">{{ $t('overview.inHouseEmpty') }}</div>
          <div v-for="r in inHouseRows" :key="r.reservation_id" class="sv-popover-item">
            <div class="sv-popover-main">
              <strong>{{ r.guest_name }}</strong>
              <span v-if="r.guest_phone" class="sv-popover-sub">{{ r.guest_phone }}</span>
              <span v-if="r.room" class="sv-popover-sub">{{ $t('reservations.room') }} {{ r.room.room_number }} · {{ r.room_type || r.room.room_type }}</span>
              <span class="sv-popover-sub">{{ formatDate(r.arrival_date) }} → {{ formatDate(r.departure_date) }} · {{ r.num_days || r.nights }} {{ $t('reservations.nights') }}</span>
              <span class="sv-popover-sub" :class="{ due: Number(r.balance) > 0 }">TZS {{ Number(r.balance).toLocaleString() }}</span>
            </div>
            <button class="btn btn-sm btn-primary" @click="checkOut(r)"><i class="fas fa-right-from-bracket"></i> {{ $t('overview.checkOut') }}</button>
          </div>
        </template>

        <template v-else-if="barTip.key === 'upcoming'">
          <div v-if="!upcomingRows.length" class="sv-popover-empty">{{ $t('overview.upcomingEmpty') }}</div>
          <div v-for="r in upcomingRows" :key="r.reservation_id" class="sv-popover-item">
            <div class="sv-popover-main">
              <strong>{{ r.guest_name }}</strong>
              <span class="sv-popover-sub">{{ $t('reservations.room') }} {{ r.room?.room_number || '—' }} · {{ formatDate(r.arrival_date) }} · {{ r.num_days || r.nights }} {{ $t('reservations.nights') }}</span>
              <span class="sv-popover-sub">{{ r.status.replace('_', ' ') }}</span>
            </div>
            <span class="badge badge-yellow">{{ r.status.replace('_', ' ') }}</span>
          </div>
        </template>

        <template v-else-if="barTip.key === 'housekeeping'">
          <div v-if="!housekeepingRows.length" class="sv-popover-empty">{{ $t('overview.housekeepingEmpty') }}</div>
          <div v-for="task in housekeepingRows" :key="task.task_id" class="sv-popover-item sv-popover-stack">
            <div class="sv-popover-stack-top">
              <div class="sv-popover-main">
                <strong>{{ $t('reservations.room') }} {{ task.room?.room_number || '—' }}</strong>
                <span class="sv-popover-sub">{{ houseStatusLabel(task.status) }}</span>
              </div>
              <span class="badge" :class="houseBadge(task.status)">{{ houseStatusLabel(task.status) }}</span>
            </div>
            <div class="sv-popover-actions">
              <button
                v-if="task.status === 'dirty'"
                class="btn btn-sm btn-secondary"
                @click="openAssign(task)"
              >
                <i class="fas fa-user-plus"></i> {{ $t('housekeeping.assign') }}
              </button>
              <button
                v-if="task.status === 'in_progress' && canConfirm"
                class="btn btn-sm btn-secondary"
                @click="confirmTask(task)"
              >
                {{ $t('overview.confirm') }}
              </button>
              <button
                v-if="task.status === 'confirmed' && canVerify"
                class="btn btn-sm btn-secondary"
                @click="verifyTask(task)"
              >
                {{ $t('overview.verify') }}
              </button>
              <button
                v-if="task.status === 'verified'"
                class="btn btn-sm btn-success"
                @click="completeTask(task)"
              >
                {{ $t('overview.complete') }}
              </button>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-if="!tipSummary(barTip.key).length" class="sv-popover-empty">{{ $t('overview.noDetails') }}</div>
          <div v-for="(row, i) in tipSummary(barTip.key)" :key="i" class="sv-summary-row">
            <span class="sv-summary-label">{{ row.label }}</span>
            <strong class="sv-summary-value">{{ row.value }}</strong>
          </div>
        </template>
      </div>
    </template>

    <!-- Assign housekeeping task modal -->
    <div v-if="showAssign" class="modal-overlay" @click.self="showAssign = false">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-user-plus"></i> {{ $t('housekeeping.assignTo') }}</h2>
          <button class="modal-close" @click="showAssign = false">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <form @submit.prevent="assignTask">
          <div class="form-group">
            <label>{{ $t('housekeeping.assignTo') }} *</label>
            <SearchableSelect
              v-model="assignUserId"
              :options="housekeeperOptions"
              :empty-label="$t('overview.unassigned')"
              required
            />
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="showAssign = false">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('housekeeping.assign') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Dashboard alert modal for urgent notifications -->
    <AlertModal
      v-if="currentAlert"
      :show="true"
      :title="currentAlert.title"
      :body="currentAlert.body"
      :details="alertDetails"
      :timestamp="currentAlert.created_at"
      :type="alertType"
      @dismiss="dismissCurrentAlert"
    />

    <div v-else-if="error" class="alert alert-error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { reportApi, reservationApi, housekeepingApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import AlertModal from '@/components/AlertModal.vue'

const authStore = useAuthStore()
const notifStore = useNotificationStore()
const { t } = useI18n()
// Root dashboard data and loading/feedback state.
const data = ref(null)
const loading = ref(false)
const error = ref('')
const success = ref('')

// Filter/page controls for the three dashboard sections (in-house, upcoming, housekeeping).
const inHouse = reactive({ search: '', page: 1 })
const upcoming = reactive({ search: '', page: 1 })
const housekeeping = reactive({ status: '', page: 1 })

// Housekeeping assign-modal state.
const showAssign = ref(false)
const assignTaskId = ref('')
const assignUserId = ref('')
const modalError = ref('')
const saving = ref(false)

/* ---------------- Bar hover popover (stay-view popover style) ---------------- */

// Hovered bar payload + viewport coordinates for the popover card. The
// popover reuses the same detail lists that used to render as tables below
// the bars, so hovering a bar shows its underlying records.
const barTip = ref(null)
// Timer used to delay the popover hide so the cursor can move onto it.
let barTipTimer = null

/** Positions the popover near the cursor, clamped inside the viewport. */
function tipPosition(event) {
  const width = 320
  const height = 320
  const x = Math.min(event.clientX + 14, window.innerWidth - width - 12)
  const y = Math.min(event.clientY + 14, window.innerHeight - height - 12)
  return { x: Math.max(8, x), y: Math.max(8, y) }
}

/** Shows a popover for the given bar group anchored at the cursor. */
function showBarTip(event, key) {
  clearTimeout(barTipTimer)
  barTip.value = { key, ...tipPosition(event) }
}

/** Keeps the popover glued to the cursor while moving within a bar. */
function moveBarTip(event) {
  if (barTip.value) Object.assign(barTip.value, tipPosition(event))
}

/** Hides the popover after a short delay so the cursor can reach it. */
function hideBarTip() {
  clearTimeout(barTipTimer)
  barTipTimer = setTimeout(() => {
    barTip.value = null
  }, 250)
}

/** Cancels the pending hide while the cursor is over the popover or bar. */
function keepBarTip() {
  clearTimeout(barTipTimer)
}

/** Detail records for the "guests in house" bar (in-house reservations). */
const inHouseRows = computed(() => data.value?.in_house?.data || [])

/** Detail records for the "upcoming arrivals" bar. */
const upcomingRows = computed(() => data.value?.upcoming?.data || [])

/** Detail records for the "tasks in queue" bar (housekeeping tasks). */
const housekeepingRows = computed(() => data.value?.housekeeping?.data || [])

/** Icon and title for the popover header of a given bar key. */
function tipHeader(key) {
  const map = {
    occupancy: { icon: 'fa-percent', title: t('overview.occupancyRate') },
    'in-house': { icon: 'fa-users', title: t('overview.inHouse') },
    occupied: { icon: 'fa-bed', title: t('overview.occupiedRooms') },
    arrivals: { icon: 'fa-right-to-bracket', title: t('overview.arrivalsToday') },
    departures: { icon: 'fa-right-from-bracket', title: t('overview.departuresToday') },
    upcoming: { icon: 'fa-calendar-check', title: t('overview.upcomingSection') },
    staff: { icon: 'fa-user-tie', title: t('overview.staffSection') },
    housekeeping: { icon: 'fa-broom', title: t('overview.housekeepingSection') },
    issues: { icon: 'fa-flag', title: t('overview.openIssues') },
    'orders-all': { icon: 'fa-receipt', title: t('overview.fnbAllToday') },
    'orders-running': { icon: 'fa-fire', title: t('overview.fnbRunning') },
    'orders-settled': { icon: 'fa-check-double', title: t('overview.fnbSettled') },
    'sales-total': { icon: 'fa-dollar-sign', title: t('overview.totalSales') },
    'sales-bar': { icon: 'fa-martini-glass', title: t('overview.barSales') },
    'sales-restaurant': { icon: 'fa-utensils', title: t('overview.restaurantSales') },
  }
  return map[key] || { icon: 'fa-chart-simple', title: '' }
}

/**
 * Summary detail rows for aggregate bars (no per-item list in the payload).
 * Returns an array of { label, value } shown inside the popover.
 */
function tipSummary(key) {
  const s = data.value?.stats || {}
  const f = fnb.value
  const rows = {
    occupancy: [
      { label: t('overview.occupiedRooms'), value: String(Number(s.occupied_rooms) || 0) },
      { label: t('overview.roomsClean'), value: String(roomStatus.value.clean) },
      { label: t('overview.roomsDirty'), value: String(roomStatus.value.dirty) },
      { label: t('overview.roomsBlocked'), value: String(roomStatus.value.blocked) },
    ],
    occupied: [
      { label: t('overview.occupancyRate'), value: (Number(s.occupancy_rate) || 0) + '%' },
      { label: t('overview.inHouse'), value: String(Number(s.guests_in_house) || 0) },
      { label: t('overview.roomsClean'), value: String(roomStatus.value.clean) },
      { label: t('overview.roomsDirty'), value: String(roomStatus.value.dirty) },
    ],
    arrivals: [
      { label: t('overview.upcomingArrivals'), value: String(Number(s.upcoming_arrivals) || 0) },
      { label: t('overview.arrivalsToday'), value: String(Number(s.arrivals_today) || 0) },
    ],
    departures: [
      { label: t('overview.departuresToday'), value: String(Number(s.departures_today) || 0) },
      { label: t('overview.inHouse'), value: String(Number(s.guests_in_house) || 0) },
    ],
    staff: [
      { label: t('overview.staffActive'), value: `${Number(s.staff_active) || 0} / ${Number(s.staff_total) || 0}` },
      { label: t('overview.staffTotal'), value: String(Number(s.staff_total) || 0) },
    ],
    issues: [
      { label: t('overview.openIssues'), value: String(Number(s.open_issues) || 0) },
    ],
    'orders-all': [
      { label: t('overview.fnbRunning'), value: String(Number(f.orders_running) || 0) },
      { label: t('overview.fnbSettled'), value: String(Number(f.orders_settled) || 0) },
    ],
    'orders-running': [
      { label: t('overview.fnbAllToday'), value: String(Number(f.orders_all) || 0) },
      { label: t('overview.fnbSettled'), value: String(Number(f.orders_settled) || 0) },
    ],
    'orders-settled': [
      { label: t('overview.fnbAllToday'), value: String(Number(f.orders_all) || 0) },
      { label: t('overview.fnbRunning'), value: String(Number(f.orders_running) || 0) },
    ],
    'sales-total': [
      { label: t('overview.barSales'), value: formatMoney(f.bar_sales) },
      { label: t('overview.restaurantSales'), value: formatMoney(f.restaurant_sales) },
    ],
    'sales-bar': [
      { label: t('overview.totalSales'), value: formatMoney(f.total_sales) },
      { label: t('overview.restaurantSales'), value: formatMoney(f.restaurant_sales) },
    ],
    'sales-restaurant': [
      { label: t('overview.totalSales'), value: formatMoney(f.total_sales) },
      { label: t('overview.barSales'), value: formatMoney(f.bar_sales) },
    ],
  }
  return rows[key] || []
}

/* ---------------- End bar hover popover ---------------- */


// Derived value: the tenant's hotel name shown in greeting text.
const hotelName = computed(() => authStore.user?.tenant?.hotel_name || 'MRK Hotels')

// Action permissions and housekeeper options for the assign modal.
const canConfirm = computed(() => authStore.can(80) && authStore.canOperate)
const canVerify = computed(
  () => authStore.canOperate && (!!authStore.user?.is_sub_manager || authStore.can(80)),
)
const housekeepers = computed(() =>
  (data.value?.staff?.data || []).filter(
    (user) =>
      user.is_active && (user.user_role === 'housekeeping' || user.department === 'housekeeping'),
  ),
)
const housekeeperOptions = computed(() =>
  housekeepers.value.map((user) => ({ value: user.user_id, label: user.full_name })),
)

// Housekeeping room-status summary: clean (available), dirty and under
// maintenance/cleaning buckets derived from the backend room status counts.
const roomStatus = computed(() => {
  const rs = data.value?.stats?.room_status || {}
  return {
    clean: Number(rs.available) || 0,
    dirty: Number(rs.dirty) || 0,
    blocked: (Number(rs.maintenance) || 0) + (Number(rs.cleaning) || 0),
  }
})

// Summary status pills (front-desk style) computed from the overview stats.
const statusPills = computed(() => {
  const s = data.value?.stats || {}
  return [
    { key: 'vacant', label: t('overview.roomsClean'), count: roomStatus.value.clean },
    { key: 'occupied', label: t('overview.occupiedRooms'), count: Number(s.occupied_rooms) || 0 },
    { key: 'reserved', label: t('overview.upcomingArrivals'), count: Number(s.upcoming_arrivals) || 0 },
    { key: 'dueout', label: t('overview.departuresToday'), count: Number(s.departures_today) || 0 },
    { key: 'dirty', label: t('overview.roomsDirty'), count: roomStatus.value.dirty },
  ]
})

// F&B orders + total sales (bar + restaurant) summary from the overview stats.
const fnb = computed(() => {
  const f = data.value?.stats?.fnb || {}
  return {
    orders_all: Number(f.orders_all) || 0,
    orders_running: Number(f.orders_running) || 0,
    orders_settled: Number(f.orders_settled) || 0,
    total_sales: Number(f.total_sales) || 0,
    bar_sales: Number(f.bar_sales) || 0,
    restaurant_sales: Number(f.restaurant_sales) || 0,
  }
})

/** Renders a money figure with thousands separators. */
function formatMoney(value) {
  return `TZS ${Number(value || 0).toLocaleString()}`
}

/** Share of the room stock a housekeeping bucket represents, for its bar. */
function roomPct(value) {
  const total = Number(data.value?.stats?.room_status?.total) || 0
  if (total <= 0) return 0
  return Math.min(100, ((Number(value) || 0) / total) * 100)
}

/**
 * Share of total room stock a metric represents, for the KPI bars.
 * Falls back to normalising against the busiest flow number when the
 * payload predates rooms_total, so bars never render empty.
 */
function pctOfRooms(value) {
  const rooms = Number(data.value?.stats?.rooms_total) || 0
  if (rooms > 0) return Math.min(100, ((Number(value) || 0) / rooms) * 100)
  const flowMax = Math.max(
    Number(data.value?.stats?.arrivals_today) || 0,
    Number(data.value?.stats?.departures_today) || 0,
    Number(value) || 0,
    1,
  )
  return Math.min(100, ((Number(value) || 0) / flowMax) * 100)
}

/** Normalises today's arrivals/departures against the busier of the two. */
function pctOfFlow(value) {
  const peak = Math.max(
    Number(data.value?.stats?.arrivals_today) || 0,
    Number(data.value?.stats?.departures_today) || 0,
    1,
  )
  return Math.min(100, ((Number(value) || 0) / peak) * 100)
}

/** Safe percentage of a part over its whole (e.g. active staff over all staff). */
function ratioPct(part, whole) {
  const w = Number(whole) || 0
  if (w <= 0) return 0
  return Math.min(100, ((Number(part) || 0) / w) * 100)
}

/**
 * Percentage of the "total orders" number a bucket (e.g. running/settled)
 * represents, for the F&B bars. Falls back to a fixed share when the total
 * is unknown so the bars never render empty.
 */
function orderPct(value, total) {
  const t = Number(total) || 0
  if (t <= 0) return value ? 30 : 0
  return Math.min(100, ((Number(value) || 0) / t) * 100)
}

/**
 * Percentage of the total sales a subgroup (bar/restaurant) represents.
 * The total-bar always fills to 100; subgroups share against the same base.
 */
function salesPct(value, total) {
  const t = Number(total) || 0
  if (t <= 0) return value ? 30 : 0
  return Math.max(4, Math.min(100, ((Number(value) || 0) / t) * 100))
}

// Housekeeping task statuses used by the housekeeping filter dropdown.
const HOUSE_STATUSES = {
  dirty: t('housekeeping.statusDirty'),
  in_progress: t('housekeeping.statusInProgress'),
  confirmed: t('housekeeping.statusConfirmed'),
  verified: t('housekeeping.statusVerified'),
  completed: t('housekeeping.statusCompleted'),
}

/** Resolves a housekeeping status key to its translated display label. */
function houseStatusLabel(value) {
  return HOUSE_STATUSES[value] || value
}

/** Returns the CSS badge class for a housekeeping status. */
function houseBadge(value) {
  const map = {
    dirty: 'badge-red',
    in_progress: 'badge-yellow',
    confirmed: 'badge-blue',
    verified: 'badge-blue',
    completed: 'badge-green',
  }
  return map[value] || 'badge-gray'
}

/** Formats an ISO datetime string for display, or the "never" translation when absent. */
function formatDate(date) {
  return date ? String(date).slice(0, 16).replace('T', ' ') : t('common.never')
}

/**
 * Flattens a validation/API error into a single readable message string.
 * @param {Error} err - The thrown request error.
 * @returns {string} A space-joined error message or the generic failure text.
 */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
}

/**
 * Builds the query params for the overview endpoint from every section's filters.
 * Empty filters and page 1 are omitted so the backend keeps its defaults.
 * @returns {object} The request query parameters.
 */
function buildParams() {
  const params = {}
  if (inHouse.search) params.in_house_search = inHouse.search
  if (inHouse.page > 1) params.in_house_page = inHouse.page
  if (upcoming.search) params.upcoming_search = upcoming.search
  if (upcoming.page > 1) params.upcoming_page = upcoming.page
  if (housekeeping.status) params.housekeeping_status = housekeeping.status
  if (housekeeping.page > 1) params.housekeeping_page = housekeeping.page
  return params
}

/** Fetches the whole overview payload and stores it, showing errors via the error banner. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await reportApi.overview(buildParams())
    data.value = res.data
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    loading.value = false
  }
}

/**
 * Runs an action against the API with an optional confirmation prompt,
 * then shows its success message and reloads the overview.
 * @param {Function} fn - The API call to perform.
 * @param {string} message - Default success message.
 * @param {string} [confirmMsg] - Optional confirm dialog text; skipped when absent.
 */
async function runAction(fn, message, confirmMsg) {
  if (confirmMsg && !window.confirm(confirmMsg)) return
  error.value = ''
  success.value = ''
  try {
    const res = await fn()
    success.value = res.data.message || message
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

// One-liner wrapper binding the check-out action shown in the in-house popover.
const checkOut = (reservation) =>
  runAction(
    () => reservationApi.checkOut(reservation.reservation_id),
    t('overview.checkedOut', { name: reservation.guest_name }),
    t('overview.confirmCheckOut', { name: reservation.guest_name }),
  )

// Housekeeping task actions shown in the housekeeping hover popover.
const confirmTask = (task) =>
  runAction(() => housekeepingApi.confirm(task.task_id), t('overview.confirmed'))
const verifyTask = (task) =>
  runAction(() => housekeepingApi.verify(task.task_id), t('overview.verified'))
const completeTask = (task) =>
  runAction(() => housekeepingApi.complete(task.task_id), t('overview.completed'))

/** Opens the assign modal for the given housekeeping task. */
function openAssign(task) {
  modalError.value = ''
  assignTaskId.value = task.task_id
  assignUserId.value = ''
  showAssign.value = true
}

/** Assigns the selected housekeeper to the task and reloads the overview on success. */
async function assignTask() {
  modalError.value = ''
  saving.value = true
  try {
    const res = await housekeepingApi.assign(assignTaskId.value, {
      assigned_to: assignUserId.value,
    })
    success.value = res.data.message || t('housekeeping.assigned')
    showAssign.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  load()
  notifStore.fetchAlerts()
})

/** Alert modal logic. */
const currentAlert = computed(() => notifStore.alerts[0] || null)
const alertType = computed(() => {
  if (!currentAlert.value) return 'info'
  switch (currentAlert.value.type) {
    case 'payment_awaiting_confirmation': return 'payment'
    case 'reservation_new': return 'reservation'
    case 'booking_requisition_new': return 'approval'
    case 'purchase_requisition_pending': return 'approval'
    case 'purchase_order_pending': return 'approval'
    default: return 'info'
  }
})
const alertDetails = computed(() => {
  if (!currentAlert.value?.data) return []
  const d = currentAlert.value.data
  const details = []
  if (d.guest_name) details.push({ label: t('guests.guestName'), value: d.guest_name })
  if (d.amount) details.push({ label: t('payments.amount'), value: `TZS ${Number(d.amount).toLocaleString()}` })
  if (d.provider) details.push({ label: t('payments.provider'), value: d.provider })
  if (d.requested_by) details.push({ label: 'Requested by', value: d.requested_by })
  if (d.ordered_by) details.push({ label: 'Ordered by', value: d.ordered_by })
  if (d.requisition_number) details.push({ label: t('bookingRequisitions.requisitionNumber'), value: d.requisition_number })
  return details
})
function dismissCurrentAlert() {
  if (currentAlert.value) notifStore.dismissAlert(currentAlert.value.id)
}
</script>

<style scoped>
.dashboard-page {
  padding: 32px 20px;
}

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.dash-header h1 {
  font-size: 28px;
  font-weight: 800;
}

.dash-header p {
  color: #6f6f6f;
  font-size: 15px;
  margin-top: 4px;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fef5f5;
  color: #005eb8;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: #fef5f5;
  color: #005eb8;
  flex-shrink: 0;
}

.stat-icon.checkin,
.stat-icon.rooms {
  background: #eaf4ff;
  color: #1f6ea8;
}

.stat-icon.checkout,
.stat-icon.staff {
  background: #fef9e7;
  color: #d4ac0d;
}

.stat-icon.bookings {
  background: #eafaf1;
  color: #1e8449;
}

.stat-icon.cleaning {
  background: #fdf2e9;
  color: #e67e22;
}

.stat-icon.occupancy {
  background: #f5eefb;
  color: #8e44ad;
}

.stat-icon.issues {
  background: #fdecea;
  color: #c0392b;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.stat-label {
  font-size: 12px;
  color: #757575;
}

/* Proportional KPI bars under each stat value. */
.stat-body {
  min-width: 0;
  flex: 1;
}

.stat-bar {
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
}

.stat-fill {
  height: 100%;
  border-radius: 3px;
  min-width: 2px;
  transition: width 0.4s ease;
}

/* Housekeeping summary: three colored room-status buckets with bars. */
.house-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.house-chip {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
}
.house-num {
  font-size: 22px;
  font-weight: 700;
  color: #333;
}
.house-label {
  font-size: 12px;
  color: #757575;
}
.house-fill {
  height: 6px;
  border-radius: 3px;
  margin-top: 4px;
  overflow: hidden;
}
.house-clean { border-top: 3px solid #1e8449; }
.house-clean .house-fill { background: #1e8449; }
.house-dirty { border-top: 3px solid #c0392b; }
.house-dirty .house-fill { background: #c0392b; }
.house-blocked { border-top: 3px solid #f1c40f; }
.house-blocked .house-fill { background: #f1c40f; }

.fnb-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
}
.fnb-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
}
.fnb-num {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}
.fnb-label {
  font-size: 12px;
  color: #757575;
}
.fnb-sub {
  font-size: 11px;
  color: #9e9e9e;
}
.fnb-total {
  border: 1px solid #005eb8;
  border-top: 3px solid #005eb8;
  background: #f2f8ff;
}
.fnb-total .fnb-num {
  color: #005eb8;
}

@media (max-width: 1024px) {
  .fnb-strip {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 600px) {
  .fnb-strip {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .house-strip {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}

.fill-blue {
  background: #1f6ea8;
}

.fill-green {
  background: #1e8449;
}

.fill-red {
  background: #c0392b;
}

.dash-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.dash-section {
  padding: 24px;
  margin-bottom: 24px;
}

.dash-section h2 {
  font-size: 17px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dash-section h2 i {
  color: #005eb8;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.view-all-link {
  font-size: 13px;
  color: #005eb8;
  text-decoration: none;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.2s;
}

.view-all-link:hover {
  opacity: 0.8;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item > i {
  color: #005eb8;
  width: 16px;
  text-align: center;
}

.list-item .badge {
  flex-shrink: 0;
}

.list-item .actions {
  flex-shrink: 0;
}

.empty-mini {
  color: #757575;
  font-size: 14px;
  padding: 12px 0;
}

.sub {
  color: #757575;
  font-size: 12px;
  margin-top: 2px;
}

.capitalize {
  text-transform: capitalize;
}

.due {
  color: #c0392b;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-row .input {
  flex: 1;
  min-width: 160px;
  max-width: 320px;
}

.filter-row .select-input {
  flex: 0 0 auto;
  min-width: 0;
  max-width: 200px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 20px 16px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 14px;
  }

  .stat-card > div {
    min-width: 0;
  }

  .stat-bar {
    width: 100%;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  .stat-value {
    font-size: 20px;
  }

  .stat-label {
    font-size: 11px;
  }

  .dash-grid {
    grid-template-columns: 1fr;
  }
}

/* ------- Stay-view style bars ------- */

/* Summary status pills (mirror the reception stay-view toolbar) */
.sv-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.sv-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  background: #f1f3f5;
  color: #333;
}

.sv-pill strong {
  font-weight: 700;
}

.sv-pill.vacant { background: #e7f6ec; color: #1e7e34; }
.sv-pill.occupied { background: #fde8e8; color: #c0392b; }
.sv-pill.reserved { background: #fff3cd; color: #856404; }
.sv-pill.dueout { background: #d1ecf1; color: #0c5460; }
.sv-pill.dirty { background: #f8d7da; color: #721c24; }

/* Cards holding the bar representations */
.sv-card {
  padding: 22px 24px;
  margin-bottom: 20px;
}

.sv-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.sv-card-head h2 {
  font-size: 17px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sv-card-head h2 i {
  color: #005eb8;
}

/* One metric row: label on the left, a track with a colored bar on the right */
.sv-bar-row {
  display: grid;
  grid-template-columns: 220px 1fr;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}

.sv-row-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #444;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-row-label i {
  color: #005eb8;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.sv-track {
  height: 30px;
  background: #f0f2f5;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

/* The stay-view style bar: bold colored rounded block with a label inside */
.sv-track .sv-bar {
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  overflow: hidden;
  white-space: nowrap;
  min-width: 44px;
  animation: sv-bar-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  transition: filter 0.2s ease;
}

.sv-track .sv-bar:hover {
  filter: brightness(0.92);
}

.sv-track .sv-bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-bar.bar-green { background: #28c76f; }
.sv-bar.bar-red { background: #ff6b6b; }
.sv-bar.bar-blue { background: #3b82f6; }

@keyframes sv-bar-in {
  from {
    opacity: 0;
    transform: translateX(-10px) scaleX(0.85);
  }
  to {
    opacity: 1;
    transform: translateX(0) scaleX(1);
  }
}

/* Segmented room-status bar (one full-width track split by color segments) */
.sv-segbar {
  display: flex;
  height: 34px;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #f0f2f5;
}

.sv-seg {
  height: 100%;
  min-width: 0;
  transition: width 0.4s ease;
}

.sv-seg.seg-clean { background: #28c76f; }
.sv-seg.seg-dirty { background: #ff6b6b; }
.sv-seg.seg-blocked { background: #f1c40f; }

.sv-seg-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 14px;
  font-size: 13px;
  color: #555;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-item .dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.dot-clean { background: #28c76f; }
.dot-dirty { background: #ff6b6b; }
.dot-blocked { background: #f1c40f; }

/* Bars with detail data are hoverable: show a help cursor and gentle lift */
.sv-track .sv-bar.has-pop {
  cursor: help;
}
.sv-track .sv-bar.has-pop:hover {
  filter: brightness(0.94);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
}

/* The whole row is the hover target (bigger/easier to hit than the bar) */
.sv-bar-row.has-pop-row {
  cursor: help;
  border-radius: 8px;
  transition: background 0.15s ease;
}
.sv-bar-row.has-pop-row:hover {
  background: rgba(59, 130, 246, 0.06);
}

/* Hover popover shown when a bar with detail data is hovered (reception style) */
.sv-popover {
  position: fixed;
  z-index: 1400;
  width: 320px;
  max-height: 320px;
  overflow-y: auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.18);
  border: 1px solid rgba(15, 23, 42, 0.08);
  pointer-events: auto;
  animation: sv-pop-in 0.16s ease;
}

@keyframes sv-pop-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sv-popover-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: #f6f8fb;
  border-bottom: 1px solid #eef1f5;
  position: sticky;
  top: 0;
  z-index: 1;
}

.sv-popover-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #3b82f6;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.sv-popover-title {
  font-weight: 700;
  font-size: 14px;
  color: #1e293b;
}

.sv-popover-empty {
  padding: 18px 14px;
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
}

/* Summary rows shown for aggregate bars (label + value pairs) */
.sv-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 14px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 13px;
}
.sv-summary-row:last-child {
  border-bottom: none;
}
.sv-summary-label {
  color: #64748b;
}
.sv-summary-value {
  color: #1e293b;
  font-weight: 700;
}

.sv-popover-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid #f1f5f9;
}

.sv-popover-item:last-child {
  border-bottom: none;
}

/* Stacked housekeeping item: info on top, action buttons below */
.sv-popover-item.sv-popover-stack {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.sv-popover-stack-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.sv-popover-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sv-popover-actions .btn {
  padding: 5px 10px;
  font-size: 12px;
}

.sv-popover-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sv-popover-main strong {
  font-size: 13px;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sv-popover-sub {
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sv-popover-sub.due {
  color: #dc2626;
  font-weight: 700;
}

.sv-popover-item > strong {
  font-size: 13px;
  color: #1e293b;
}

@media (max-width: 768px) {
  .sv-bar-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>
