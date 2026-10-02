<!--
  Night Audit page (route: /app/night-audit, name: hotel-night-audit).
  Receptionist-accessible day close: revenue summary, collections, occupancy counts.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('nightAudit.title') }}</h1>
        <p class="muted">{{ $t('nightAudit.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Date picker -->
    <div class="card" style="padding: 16px 20px; margin-bottom: 16px;">
      <div class="date-row">
        <div class="form-group">
          <label>{{ $t('nightAudit.businessDate') }}</label>
          <!-- max=today: the backend refuses a future business date outright, and
               an unconstrained picker only offers a dead end. Today itself stays
               selectable, because previewing today's figures is allowed. -->
          <input
            v-model="selectedDate"
            type="date"
            class="input"
            :max="today"
            @change="onPickDate"
          />
        </div>
        <!-- Yesterday is closable but today is not, so on a normal evening the
             page opens on a day that cannot be closed. This is the way out of
             that without having to know the date picker is the answer. -->
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="!yesterday || selectedDate === yesterday"
          @click="goToDate(yesterday)"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          {{ $t('nightAudit.runPreviousDay') }}
        </button>
        <div v-if="report?.closed" class="closed-badge">
          <i class="fas fa-lock"></i> {{ $t('nightAudit.closed') }}
        </div>
      </div>
    </div>

    <!-- Booking debt that no longer blocks anything. Listed because hiding it
         would only trade one silent failure for another: these are guests who
         never arrived and whose bookings were never resolved. -->
    <div v-if="staleArrivals.count" class="alert alert-info stale-panel">
      <p class="stale-title">
        <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
        {{ $t('nightAudit.staleArrivalsTitle', { count: staleArrivals.count }) }}
      </p>
      <ul class="stale-list">
        <li v-for="item in staleArrivals.items" :key="item.reservation_id">
          <span class="stale-name">{{ item.guest_name }}</span>
          <span class="stale-meta">
            {{ $t('nightAudit.staleArrivalRoom', { room: item.room_number || '—' }) }}
            · {{ $t('nightAudit.staleArrivalDate', { date: item.check_in_date }) }}
          </span>
        </li>
      </ul>
      <p class="stale-note">{{ $t('nightAudit.staleArrivalsNote') }}</p>
    </div>

    <!-- A missed audit is invisible otherwise: the page just opens on today with
         the close button disabled, which reads as "come back after midnight"
         rather than "yesterday never got done". -->
    <div v-if="missedDays.length" class="alert alert-warning missed-banner">
      <p class="missed-title">
        <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
        {{ $t('nightAudit.missedDaysTitle', { count: missedDays.length }) }}
      </p>
      <p class="missed-dates">{{ missedDays.join(', ') }}</p>
      <button type="button" class="btn btn-primary" @click="goToDate(oldestMissedDay)">
        <i class="fas fa-lock-open" aria-hidden="true"></i>
        {{ $t('nightAudit.openMissedDay', { date: oldestMissedDay }) }}
      </button>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('common.loading') }}</div>

    <template v-else-if="report">
      <!-- Revenue breakdown -->
      <div class="card" style="padding: 20px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px;"><i class="fas fa-chart-line" style="color: var(--mrk-blue);"></i> {{ $t('nightAudit.revenue') }}</h3>
        <div class="kpi-grid">
          <div class="kpi">
            <span class="kpi-value">{{ fmtMoney(report.revenue.rooms) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.rooms') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ fmtMoney(report.revenue.fnb) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.fnb') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ fmtMoney(report.revenue.laundry) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.laundry') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ fmtMoney(report.revenue.fun_games) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.funGames') }}</span>
          </div>
          <div class="kpi total">
            <span class="kpi-value">{{ fmtMoney(report.revenue.total) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.totalRevenue') }}</span>
          </div>
        </div>
      </div>

      <!-- Collections & financials -->
      <div class="card" style="padding: 20px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px;"><i class="fas fa-money-bill-wave" style="color: var(--mrk-blue);"></i> {{ $t('nightAudit.collections') }}</h3>
        <div class="kpi-grid">
          <div v-for="(amount, method) in report.collections.by_method" :key="method" class="kpi">
            <span class="kpi-value">{{ fmtMoney(amount) }}</span>
            <span class="kpi-label capitalize">{{ method.replace('_', ' ') }}</span>
          </div>
          <div class="kpi total">
            <span class="kpi-value">{{ fmtMoney(report.collections.total) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.totalCollected') }}</span>
          </div>
        </div>
      </div>

      <!-- Financial positions -->
      <div class="card" style="padding: 20px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px;"><i class="fas fa-scale-balanced" style="color: var(--mrk-blue);"></i> {{ $t('nightAudit.financials') }}</h3>
        <div class="kpi-grid">
          <div class="kpi">
            <span class="kpi-value">{{ fmtMoney(report.expenses) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.expenses') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value" :class="{ 'text-red': report.cash_in_hand < 0 }">{{ fmtMoney(report.cash_in_hand) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.cashInHand') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value" :class="{ 'text-green': report.net_profit > 0, 'text-red': report.net_profit < 0 }">{{ fmtMoney(report.net_profit) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.netProfit') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ fmtMoney(report.outstanding) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.outstanding') }}</span>
          </div>
        </div>
      </div>

      <!-- Occupancy counts -->
      <div class="card" style="padding: 20px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px;"><i class="fas fa-bed" style="color: var(--mrk-blue);"></i> {{ $t('nightAudit.occupancy') }}</h3>
        <div class="kpi-grid">
          <div class="kpi">
            <span class="kpi-value">{{ report.counts.arrivals }}</span>
            <span class="kpi-label">{{ $t('nightAudit.arrivals') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ report.counts.departures }}</span>
            <span class="kpi-label">{{ $t('nightAudit.departures') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ report.counts.in_house }}</span>
            <span class="kpi-label">{{ $t('nightAudit.inHouse') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ report.counts.reservations_created }}</span>
            <span class="kpi-label">{{ $t('nightAudit.newBookings') }}</span>
          </div>
        </div>
      </div>

      <!-- Due Out guests -->
      <div class="card" style="padding: 20px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 4px;"><i class="fas fa-hourglass-half" style="color: #d97706;"></i> {{ $t('nightAudit.dueOuts') }}</h3>
        <p class="muted" style="margin: 0 0 12px;">{{ $t('nightAudit.dueOutsSubtitle') }}</p>
        <div v-if="!dueOuts.length" class="muted">{{ $t('nightAudit.dueOutsEmpty') }}</div>
        <div v-else class="dueout-list">
          <div v-for="guest in dueOuts" :key="guest.reservation_id" class="dueout-item" :class="{ overdue: guest.overdue }">
            <div class="dueout-main">
              <span class="dueout-name">{{ guest.guest_name }}</span>
              <span class="dueout-room"><i class="fas fa-bed" aria-hidden="true"></i> {{ guest.room_number || '—' }}</span>
            </div>
            <div class="dueout-meta">
              <span><i class="fas fa-calendar-day" aria-hidden="true"></i> {{ $t('nightAudit.departure') }} {{ guest.departure }}</span>
              <span class="dueout-bal">{{ $t('nightAudit.dueAmount') }}: {{ fmtMoney(guest.balance) }}</span>
            </div>
            <span class="dueout-badge" :class="guest.overdue ? 'badge-overdue' : 'badge-due'">
              <i class="fas" :class="guest.overdue ? 'fa-triangle-exclamation' : 'fa-hourglass-half'" aria-hidden="true"></i>
              {{ guest.overdue ? $t('nightAudit.overdue') : $t('nightAudit.dueToday') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Close button -->
      <div v-if="!report.closed" class="card" style="padding: 20px; margin-bottom: 16px; text-align: center;">
        <p style="margin: 0 0 12px; color: #64748b;">{{ $t('nightAudit.closePrompt') }}</p>
        <p v-if="!dateHasPassed" class="muted" style="margin: 0 0 12px;">
          <i class="fas fa-circle-info" aria-hidden="true"></i>
          {{ $t('nightAudit.closesAfterMidnight', { date: selectedDate }) }}
        </p>
        <button
          class="btn btn-primary btn-lg"
          :disabled="closing || !canClose"
          :title="!dateHasPassed ? $t('nightAudit.closesAfterMidnight', { date: selectedDate }) : null"
          @click="openCloseConfirm"
        >
          <i class="fas fa-lock"></i>
          {{ closing ? $t('common.saving') : $t('nightAudit.closeDay') }}
        </button>
      </div>
    </template>

    <ConfirmModal
      :show="showClose"
      :title="t('nightAudit.closeDay')"
      :body="t('nightAudit.closeConfirm')"
      :busy="closing"
      :confirm-label="t('nightAudit.closeDay')"
      @confirm="confirmCloseDay"
      @cancel="showClose = false"
    />

    <!-- Close history -->
    <div class="card" style="padding: 20px; margin-top: 16px;">
      <h3 style="margin: 0 0 12px;"><i class="fas fa-clock-rotate-left" style="color: var(--mrk-blue);"></i> {{ $t('nightAudit.history') }}</h3>
      <div v-if="!history.length" class="muted">{{ $t('nightAudit.noHistory') }}</div>
      <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th>{{ $t('nightAudit.date') }}</th>
            <th>{{ $t('nightAudit.totalRevenue') }}</th>
            <th>{{ $t('nightAudit.totalCollected') }}</th>
            <th>{{ $t('nightAudit.netProfit') }}</th>
            <th>{{ $t('nightAudit.closedBy') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in history" :key="d.day_close_id">
            <td>{{ d.close_date }}</td>
            <td>{{ fmtMoney(d.total_revenue) }}</td>
            <td>{{ fmtMoney(d.total_collected) }}</td>
            <td :class="{ 'text-green': d.net_profit > 0, 'text-red': d.net_profit < 0 }">{{ fmtMoney(d.net_profit) }}</td>
            <td>{{ d.closed_by?.full_name || '—' }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { nightAuditApi } from '@/api'
import { useI18n } from 'vue-i18n'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useWorkingDateStore } from '@/stores/workingDate'

const { t } = useI18n()
const workingDateStore = useWorkingDateStore()

/** The browser's own date, for the moment before the hotel timezone is known. */
const localToday = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// The open business date is the day an audit is actually run against, and it
// is expressed in the hotel's timezone. `toISOString()` was reading UTC here,
// which is a day behind the hotel for part of every evening.
const selectedDate = ref(workingDateStore.workingDate || localToday())

/** Once the guest picks a date themselves, stop moving it under them. */
const userPickedDate = ref(false)

watch(
  () => workingDateStore.workingDate,
  (date) => {
    if (!userPickedDate.value && date) selectedDate.value = date
  },
)

/** The hotel's current calendar day, in the hotel's own timezone. */
const today = computed(() => workingDateStore.today || localToday())

/**
 * A business day can only be closed once it has fully passed — the backend
 * refuses today, and says so. Offering the button anyway just produced a 422
 * with no way to tell what the user did wrong, so the action is disabled and
 * the reason shown instead.
 */
const dateHasPassed = computed(
  () => Boolean(selectedDate.value) && selectedDate.value < today.value,
)

/** The calendar day before the hotel's today, as YYYY-MM-DD. */
const yesterday = computed(() => shiftDay(today.value, -1))

/** Moves a YYYY-MM-DD string by whole days. Noon avoids DST edges. */
function shiftDay(iso, days) {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const closedDates = computed(
  () => new Set(history.value.map((d) => d.close_date)),
)

/**
 * Passed business days that were never closed, newest first.
 *
 * Walks back from yesterday and stops at the first day that *was* closed, so the
 * result is only the open run of days rather than every gap ever — a hotel that
 * closed nothing in March should not still be showing March. Capped so a history
 * that has never been closed cannot spin through thousands of days.
 */
const missedDays = computed(() => {
  const missed = []
  let cursor = yesterday.value
  for (let i = 0; i < 90 && cursor && !closedDates.value.has(cursor); i += 1) {
    missed.push(cursor)
    cursor = shiftDay(cursor, -1)
  }
  return missed
})

/** The day to close first: the oldest still missing, keeping the run in order. */
const oldestMissedDay = computed(() => missedDays.value[missedDays.value.length - 1] || '')

const canClose = computed(() => dateHasPassed.value && !report.value?.closed)
const report = ref(null)
const dueOuts = ref([])
const history = ref([])
const staleArrivals = ref({ count: 0, items: [] })
const loading = ref(false)
const closing = ref(false)
const showClose = ref(false)
const error = ref('')
const success = ref('')

function fmtMoney(v) {
  return v != null ? `TZS ${Number(v).toLocaleString()}` : '—'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [reportRes, historyRes] = await Promise.all([
      nightAuditApi.report({ date: selectedDate.value }),
      nightAuditApi.history(),
    ])
    report.value = reportRes.data.report
    report.value.closed = reportRes.data.closed
    dueOuts.value = reportRes.data.due_outs || []
    history.value = historyRes.data.day_closes || []
    staleArrivals.value = reportRes.data.stale_arrivals || { count: 0, items: [] }
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

function openCloseConfirm() {
  error.value = ''
  showClose.value = true
}

async function confirmCloseDay() {
  closing.value = true
  error.value = ''
  try {
    await nightAuditApi.close({ date: selectedDate.value })
    success.value = t('nightAudit.closeSuccess')
    showClose.value = false
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    closing.value = false
  }
}

function onPickDate() {
  userPickedDate.value = true
  load()
}

/** Jumps to a specific business day, e.g. from the missed-audit banner. */
function goToDate(date) {
  if (!date) return
  selectedDate.value = date
  onPickDate()
}

onMounted(() => {
  workingDateStore.ensureLoaded()
  load()
})
</script>

<style scoped>
.dashboard-page { padding: 32px 20px; }
.page-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
.page-head h1 { font-size: 28px; font-weight: 800; }
.muted { color: #757575; font-size: 12px; margin-top: 2px; }
.date-row { display: flex; align-items: end; gap: 16px; }
.closed-badge { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: #dcfce7; color: #166534; border-radius: 8px; font-weight: 600; font-size: 13px; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }
.kpi { display: flex; flex-direction: column; gap: 4px; }
.kpi-value { font-size: 20px; font-weight: 800; color: #062A52; }
.kpi-label { font-size: 12px; color: #64748b; }
.kpi.total { border-top: 2px solid #e2e8f0; padding-top: 8px; }
.kpi.total .kpi-value { color: #005EB8; font-size: 22px; }
.dueout-list { display: grid; gap: 10px; }
.dueout-item { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 12px 16px; border: 1px solid #fbd38d; background: #fffbeb; border-radius: 10px; }
.dueout-item.overdue { border-color: #fecaca; background: #fef2f2; }
.dueout-main { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.dueout-name { font-weight: 700; color: #062A52; }
.dueout-room { font-size: 12px; color: #64748b; }
.dueout-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 13px; color: #475569; }
.stale-panel { margin-bottom: 16px; }
.stale-title { margin: 0 0 8px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.stale-list { margin: 0 0 10px; padding-left: 18px; font-size: 13px; }
.stale-list li { margin-bottom: 4px; }
.stale-name { font-weight: 600; }
.stale-meta { opacity: 0.75; }
.stale-note { margin: 0; font-size: 12px; opacity: 0.8; }
.missed-banner { margin-bottom: 16px; }
.missed-title { margin: 0 0 6px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
/* The dates are the actionable part of the warning, so they are listed rather
   than summarised away into "yesterday". */
.missed-dates { margin: 0 0 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; word-break: break-word; }
.dueout-bal { font-weight: 600; }
.dueout-badge { white-space: nowrap; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
.badge-due { background: #fef3c7; color: #92400e; }
.badge-overdue { background: #fee2e2; color: #b91c1c; }
.text-red { color: #DC2626 !important; }
.text-green { color: #16A34A !important; }
.capitalize { text-transform: capitalize; }
.table-scroll .table { min-width: 560px; }
/* Tablets: 768px is the classic iPad portrait width, so the phone
   treatment below starts at 767px. Without this band a tablet drops
   straight from the full form to a single column. */
@media (min-width: 768px) and (max-width: 1024px) {
  .date-row,
  .page-head {
    flex-direction: row;
  }
}

@media (max-width: 767px) { .dashboard-page { padding: 20px 16px; } .page-head { flex-direction: column; align-items: flex-start; } .date-row { flex-direction: column; align-items: stretch; } }
</style>
