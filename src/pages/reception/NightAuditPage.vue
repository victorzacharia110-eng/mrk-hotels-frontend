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
        <div class="form-group date-field">
          <label>{{ $t('nightAudit.businessDate') }}</label>
          <!-- max=today: the backend refuses a future business date outright, and
               an unconstrained picker only offers a dead end. Today itself stays
               selectable, because previewing today's figures is allowed. -->
          <input v-model="selectedDate" type="date" class="input" :max="today" @change="onPickDate" />
        </div>
        <!-- Yesterday is closable but today is not, so on a normal evening the
             page opens on a day that cannot be closed. This is the way out of
             that without having to know the date picker is the answer. -->
        <button type="button" class="btn btn-secondary" :disabled="!yesterday || selectedDate === yesterday"
          @click="goToDate(yesterday)">
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          {{ $t('nightAudit.runPreviousDay') }}
        </button>
        <div v-if="report?.closed" class="closed-badge">
          <i class="fas fa-lock"></i> {{ $t('nightAudit.closed') }}
        </div>
      </div>
    </div>

    <!-- Double bookings are the most expensive thing on this page: two live
         records for one room on one date means either the room was sold twice or
         the guest was charged twice. Nothing else in the panel shows this. -->
    <div v-if="duplicateRoomBookings.length" class="alert alert-error duplicate-panel">
      <p class="duplicate-title">
        <i class="fas fa-circle-exclamation" aria-hidden="true"></i>
        {{ $t('nightAudit.duplicateRoomsTitle', { count: duplicateRoomBookings.length }) }}
      </p>
      <ul class="duplicate-list">
        <li v-for="group in duplicateRoomBookings" :key="`${group[0].room_number}-${group[0].check_in_date}`">
          <span class="duplicate-room">
            {{ $t('nightAudit.staleArrivalRoom', { room: group[0].room_number }) }}
          </span>
          <span class="duplicate-date">{{ group[0].check_in_date }}</span>
          <span class="duplicate-names">{{group.map((i) => i.guest_name).join(', ')}}</span>
          <span class="duplicate-count">
            {{ $t('nightAudit.duplicateRoomCount', { count: group.length }) }}
          </span>
        </li>
      </ul>
      <p class="duplicate-note">{{ $t('nightAudit.duplicateRoomsNote') }}</p>
    </div>

    <!-- A hole in the middle of the closed record. Distinct from the missed-days
         banner: those days are not done yet, these were skipped over. -->
    <div v-if="historyGaps.length" class="alert alert-warning gap-panel">
      <p class="gap-title">
        <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
        {{ $t('nightAudit.historyGapTitle', { count: historyGaps.length }) }}
      </p>
      <p class="gap-dates">{{ historyGaps.join(', ') }}</p>
      <p class="gap-note">{{ $t('nightAudit.historyGapNote') }}</p>
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
          <span class="stale-chip">{{ $t('nightAudit.staleArrivalRoom', { room: item.room_number || '—' }) }}</span>
          <span class="stale-chip">{{ $t('nightAudit.staleArrivalDate', { date: item.check_in_date }) }}</span>
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
        <h3 style="margin: 0 0 12px;"><i class="fas fa-chart-line" style="color: var(--mrk-blue);"></i> {{
          $t('nightAudit.revenue') }}</h3>
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
        <h3 style="margin: 0 0 12px;"><i class="fas fa-money-bill-wave" style="color: var(--mrk-blue);"></i> {{
          $t('nightAudit.collections') }}</h3>
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
        <h3 style="margin: 0 0 12px;"><i class="fas fa-scale-balanced" style="color: var(--mrk-blue);"></i> {{
          $t('nightAudit.financials') }}</h3>
        <div class="kpi-grid">
          <div class="kpi">
            <span class="kpi-value">{{ fmtMoney(report.expenses) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.expenses') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value" :class="{ 'text-red': report.cash_in_hand < 0 }">{{ fmtMoney(report.cash_in_hand)
              }}</span>
            <span class="kpi-label">{{ $t('nightAudit.cashInHand') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ fmtMoney(report.outstanding) }}</span>
            <span class="kpi-label">{{ $t('nightAudit.outstanding') }}</span>
          </div>
        </div>
      </div>

      <!-- Occupancy counts -->
      <div class="card" style="padding: 20px; margin-bottom: 16px;">
        <h3 style="margin: 0 0 12px;"><i class="fas fa-bed" style="color: var(--mrk-blue);"></i> {{
          $t('nightAudit.occupancy') }}</h3>
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
        <h3 style="margin: 0 0 4px;"><i class="fas fa-hourglass-half" style="color: #d97706;"></i> {{
          $t('nightAudit.dueOuts') }}</h3>
        <p class="muted" style="margin: 0 0 12px;">{{ $t('nightAudit.dueOutsSubtitle') }}</p>
        <div v-if="!dueOuts.length" class="muted">{{ $t('nightAudit.dueOutsEmpty') }}</div>
        <div v-else class="dueout-list">
          <div v-for="guest in dueOuts" :key="guest.reservation_id" class="dueout-item"
            :class="{ overdue: guest.overdue }">
            <div class="dueout-main">
              <span class="dueout-name">{{ guest.guest_name }}</span>
              <span class="dueout-room"><i class="fas fa-bed" aria-hidden="true"></i> {{ guest.room_number || '—'
                }}</span>
            </div>
            <div class="dueout-meta">
              <span><i class="fas fa-calendar-day" aria-hidden="true"></i> {{ $t('nightAudit.departure') }} {{
                guest.departure }}</span>
              <span class="dueout-bal">{{ $t('nightAudit.dueAmount') }}: {{ fmtMoney(guest.balance) }}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="dueout-badge" :class="guest.overdue ? 'badge-overdue' : 'badge-due'">
                <i class="fas" :class="guest.overdue ? 'fa-triangle-exclamation' : 'fa-hourglass-half'"
                  aria-hidden="true"></i>
                {{ guest.overdue ? $t('nightAudit.overdue') : $t('nightAudit.dueToday') }}
              </span>
              <button type="button" class="btn btn-sm btn-primary" @click="goToStayviewForGuest(guest)">{{
                $t('nightAudit.goToStayview') || 'Go to Stayview' }}</button>
            </div>
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
        <ul v-if="closeWarnings.length" class="close-warnings">
          <li v-for="w in closeWarnings" :key="w.key" :class="['close-warning', `close-warning--${w.level}`]">
            <i :class="w.level === 'danger' ? 'fas fa-circle-exclamation' : 'fas fa-triangle-exclamation'"
              aria-hidden="true"></i>
            <span>{{ $t(w.key, w.params) }}</span>
          </li>
        </ul>
        <button class="btn btn-primary btn-lg" :disabled="closing || !canClose"
          :title="!dateHasPassed ? $t('nightAudit.closesAfterMidnight', { date: selectedDate }) : null"
          @click="openCloseConfirm">
          <i class="fas fa-lock"></i>
          {{ closing ? $t('common.saving') : $t('nightAudit.closeDay') }}
        </button>
      </div>
    </template>

    <ConfirmModal :show="showClose" :title="t('nightAudit.closeDay')"
      :body="closeSuccessTitle ? closeSuccessBody : closeConfirmBody" :error="closeError" :success="closeSuccessTitle"
      :busy="closing" :auto-close-ms="closeError || closeSuccessTitle ? 0 : CLOSE_MODAL_MS"
      :confirm-label="t('nightAudit.closeDay')" @confirm="confirmCloseDay" @cancel="cancelCloseConfirm" />

    <AlertModal :show="showIssues" :title="t('nightAudit.closeDay')" wide @dismiss="dismissIssues">
      <div class="na-issues" :class="{ 'na-issues--success': issueSuccess }">
        <div v-if="issueSuccess" class="na-success" role="status" aria-live="polite">
          <span class="na-success-icon" aria-hidden="true"><i class="fas fa-check"></i></span>
          <h3>{{ $t('nightAudit.allIssuesResolved') }}</h3>
          <p>{{ $t('nightAudit.allIssuesResolvedHint') }}</p>
        </div>
        <template v-else>
          <div v-if="issueTotal > 0" class="na-progress">
            <div class="na-progress-head">
              <span><i class="fas fa-person-running" aria-hidden="true"></i> {{ $t('nightAudit.almostThere') }}</span>
              <strong>{{ resolvedIssueCount }} / {{ issueTotal }}</strong>
            </div>
            <div class="na-progress-track" role="progressbar" :aria-valuenow="issueProgress" aria-valuemin="0"
              aria-valuemax="100">
              <div class="na-progress-fill" :style="{ width: issueProgress + '%' }"></div>
            </div>
            <p class="na-progress-label">{{ $t('nightAudit.issuesProgress', {
              resolved: resolvedIssueCount, total:
              issueTotal }) }}</p>
          </div>
          <p class="na-intro">{{ $t('nightAudit.closePrompt') }}</p>
          <p v-if="issueError" class="alert alert-error" style="margin:0 0 12px;">{{ issueError }}</p>
          <div v-if="dueOuts.length" class="na-issue-block">
            <h4><i class="fas fa-hourglass-half" style="color:#d97706;"></i> {{ $t('nightAudit.dueOuts') }}</h4>
            <div v-for="guest in dueOuts" :key="guest.reservation_id" class="na-issue-item">
              <div class="na-issue-main">
                <div><strong>{{ guest.guest_name }}</strong> · {{ guest.room_number || '—' }} · {{
                  $t('nightAudit.departure') }} {{ guest.departure }}</div>
                <div>{{ $t('nightAudit.dueAmount') }}: {{ fmtMoney(guest.balance) }}</div>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-primary" :disabled="checkingOutId === guest.reservation_id"
                  @click="checkOutDueOut(guest)">
                  <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
                  {{ checkingOutId === guest.reservation_id ? $t('common.saving') : ($t('nightAudit.checkOut') || 'Checkout') }}
                </button>
                <button type="button" class="btn btn-sm btn-secondary" @click="goToStayviewForGuest(guest)">{{
                  $t('nightAudit.goToStayview') || 'Go to Stayview' }}</button>
              </div>
            </div>
          </div>
          <div v-if="staleArrivals.count" class="na-issue-block">
            <h4><i class="fas fa-triangle-exclamation" style="color:#dc2626;"></i> {{ $t('nightAudit.warnStaleRemain')
              }}</h4>
            <div v-for="arr in staleArrivals.items || []" :key="arr.reservation_id" class="na-issue-item">
              <div class="na-issue-main">
                <div><strong>{{ arr.guest_name }}</strong> · {{ $t('nightAudit.staleArrivalRoom', {
                  room:
                    arr.room_number || '—' }) }}</div>
                <div>{{ $t('nightAudit.staleArrivalDate', { date: arr.check_in_date }) }}</div>
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-primary"
                  :disabled="resolvingArrivalId === arr.reservation_id" @click="markArrivalNoShow(arr)">
                  <i class="fas fa-user-xmark" aria-hidden="true"></i> {{ $t('reservations.noShow') || 'No Show' }}
                </button>
                <button type="button" class="btn btn-sm btn-danger"
                  :disabled="resolvingArrivalId === arr.reservation_id" @click="cancelArrival(arr)">
                  <i class="fas fa-ban" aria-hidden="true"></i> {{ $t('common.cancel') || 'Cancel' }}
                </button>
                <button type="button" class="btn btn-sm btn-secondary" @click="goToStayviewForGuest(arr)">{{
                  $t('nightAudit.goToStayview') || 'Go to Stayview' }}</button>
              </div>
            </div>
          </div>
          <ul v-if="closeWarnings.length" class="na-warn-list">
            <li v-for="w in closeWarnings" :key="w.key" :class="['na-warn', `na-warn--${w.level}`]">
              <i :class="w.level === 'danger' ? 'fas fa-circle-exclamation' : w.level === 'warning' ? 'fas fa-triangle-exclamation' : 'fas fa-circle-info'"
                aria-hidden="true"></i>
              <span>{{ $t(w.key, w.params) }}</span>
             <button v-if="w.key === 'nightAudit.warnOtherDaysOpen' || w.key === 'nightAudit.warnLeavesGap'"
               type="button" class="btn btn-sm btn-secondary close-warning-action"
               @click="resolveWarning(w)">
               <i class="fas fa-arrow-right" aria-hidden="true"></i> Go to day
             </button>
            </li>
          </ul>
        </template>
      </div>
      <template #footer>
        <template v-if="!issueSuccess">
          <button type="button" class="btn" @click="dismissIssues">{{ $t('common.cancel') || $t('common.close')
            }}</button>
          <button type="button" class="btn btn-primary" :disabled="closing || !canClose"
            @click="proceedToCloseConfirm">{{ $t('nightAudit.confirmClose') || $t('nightAudit.closeDay') }}</button>
        </template>
        <span v-else class="na-success-return">{{ $t('nightAudit.returning') }}</span>
      </template>
    </AlertModal>

    <!-- Close history -->
    <div class="card" style="padding: 20px; margin-top: 16px;">
      <h3 style="margin: 0 0 12px;"><i class="fas fa-clock-rotate-left" style="color: var(--mrk-blue);"></i> {{
        $t('nightAudit.history') }}</h3>
      <div v-if="!history.length" class="muted">{{ $t('nightAudit.noHistory') }}</div>
      <div v-else class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>{{ $t('nightAudit.date') }}</th>
              <th>{{ $t('nightAudit.totalRevenue') }}</th>
              <th>{{ $t('nightAudit.totalCollected') }}</th>
              <th>{{ $t('nightAudit.closedBy') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in history" :key="d.day_close_id">
              <td>{{ d.close_date }}</td>
              <td>{{ fmtMoney(d.total_revenue) }}</td>
              <td>{{ fmtMoney(d.total_collected) }}</td>
              <td>{{ d.closed_by?.full_name || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { nightAuditApi, reservationApi } from '@/api'
import { useI18n } from 'vue-i18n'
import ConfirmModal from '@/components/ConfirmModal.vue'
import AlertModal from '@/components/AlertModal.vue'
import { useBusinessDateStore } from '@/stores/businessDate'
import { useTenantCurrency } from '@/utils/currency'

const router = useRouter()
const { curCode } = useTenantCurrency()

const { t } = useI18n()
const businessDateStore = useBusinessDateStore()

/** The browser's own date, for the moment before the hotel timezone is known. */
const localToday = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// The open business date is the day an audit is actually run against, and it
// is expressed in the hotel's timezone. `toISOString()` was reading UTC here,
// which is a day behind the hotel for part of every evening.
const selectedDate = ref(businessDateStore.current || localToday())

/** Once the guest picks a date themselves, stop moving it under them. */
const userPickedDate = ref(false)

watch(
  () => businessDateStore.current,
  (date) => {
    if (!userPickedDate.value && date) selectedDate.value = date
  },
)

/** The hotel's current calendar day, in the hotel's own timezone. */
const today = computed(() => businessDateStore.calendarToday || localToday())

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

/**
 * Days that were never audited but sit BETWEEN two closed days.
 *
 * `missedDays` only walks back from yesterday, so it stops at the first closed
 * day. That is the right behaviour for "what have I not done yet" but it is
 * blind to a hole punched in the middle of the record: the hotel closed the
 * 17th, then the 22nd, and nothing in between was ever run. Month-to-date
 * reports spanning that window are quietly incomplete, so it is surfaced
 * separately instead of being mistaken for a finished run.
 */
const historyGaps = computed(() => {
  const dates = history.value.map((d) => d.close_date).filter(Boolean)
  if (dates.length < 2) return []

  const oldest = dates[dates.length - 1]
  const newest = dates[0]
  const out = []
  let cursor = shiftDay(oldest, 1)

  for (let i = 0; i < 90 && cursor && cursor < newest; i += 1) {
    if (!closedDates.value.has(cursor)) out.push(cursor)
    cursor = shiftDay(cursor, 1)
  }

  return out
})

/**
 * Unresolved bookings competing for the same room on the same date.
 *
 * These are separate live records, not a display artefact — two of them really
 * did get created. Either the room was sold twice or the guest was charged
 * twice, and neither is visible anywhere else in the panel.
 */
const duplicateRoomBookings = computed(() => {
  const groups = new Map()

  for (const item of staleArrivals.value.items || []) {
    if (!item.room_number || !item.check_in_date) continue
    const key = `${item.room_number}|${item.check_in_date}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }

  return [...groups.values()].filter((group) => group.length > 1)
})

/** The most recent closed business day, or null if none has ever closed. */
const lastClosedDate = computed(() => history.value[0]?.close_date || null)

/**
 * Passed days between two dates that were never closed, oldest first.
 *
 * Used to tell the user that closing out of order will not tidy the gap behind
 * it — the days in between stay open, and they are the ones a month-end report
 * will be missing.
 */
function unclosedBetween(fromIso, toIso) {
  const out = []
  let cursor = shiftDay(fromIso, 1)
  for (let i = 0; i < 90 && cursor && cursor <= toIso; i += 1) {
    if (!closedDates.value.has(cursor)) out.push(cursor)
    cursor = shiftDay(cursor, 1)
  }
  return out
}

/**
 * What closing this day will and will not settle.
 *
 * The close is a one-way door — it freezes a snapshot and the API then refuses
 * to do it again — so the consequences are stated before the button is pressed
 * rather than discovered afterwards. Warnings are ordered by how much they
 * change what the user is about to do.
 */
const closeWarnings = computed(() => {
  const out = []
  const date = selectedDate.value
  const last = lastClosedDate.value

  if (last && date < last) {
    out.push({ level: 'danger', key: 'nightAudit.warnOutOfOrder', params: { date, last } })

    const gap = unclosedBetween(date, last)
    if (gap.length) {
      out.push({ level: 'danger', key: 'nightAudit.warnLeavesGap', params: { count: gap.length, dates: gap.join(', ') } })
    }
  }

  if (missedDays.value.length) {
    out.push({
      level: 'warning',
      key: 'nightAudit.warnOtherDaysOpen',
      params: { count: missedDays.value.length, dates: missedDays.value.join(', ') },
    })
  }

  if (staleArrivals.value.count) {
    out.push({ level: 'warning', key: 'nightAudit.warnStaleRemain', params: { count: staleArrivals.value.count } })
  }

  out.push({ level: 'info', key: 'nightAudit.warnOneWay' })

  return out
})

/** The single most serious warning, echoed inside the confirm modal. */
const topCloseWarning = computed(() => closeWarnings.value.find((w) => w.level === 'danger') || null)

/** The day to close first: the oldest still missing, keeping the run in order. */
const oldestMissedDay = computed(() => missedDays.value[missedDays.value.length - 1] || '')

const canClose = computed(() => Boolean(selectedDate.value) && !report.value?.closed && dateHasPassed.value)
const report = ref(null)
const dueOuts = ref([])
const history = ref([])
const staleArrivals = ref({ count: 0, items: [] })
const loading = ref(false)
const closing = ref(false)
const showClose = ref(false)
const closeError = ref('')
const closeSuccessTitle = ref('')
const closeSuccessBody = ref('')
const CLOSE_SUCCESS_MS = 5000
let closeSuccessTimer = null
const showIssues = ref(false)
const issueTotal = ref(0)
const issueSuccess = ref(false)
const ISSUE_SUCCESS_MS = 5000
let issueSuccessTimer = null
const openIssueCount = computed(() => dueOuts.value.length + Number(staleArrivals.value.count || 0) + blockerArrivals.value.length)
const resolvedIssueCount = computed(() =>
  Math.max(0, issueTotal.value - openIssueCount.value),
)
const issueProgress = computed(() =>
  issueTotal.value ? Math.min(100, Math.round((resolvedIssueCount.value / issueTotal.value) * 100)) : 100,
)
const checkingOutId = ref(null)
const resolvingArrivalId = ref(null)
const blockerArrivals = ref([])
const issueError = ref('')
const error = ref('')
const success = ref('')

function fmtMoney(v) {
  return v != null ? `${curCode()} ${Number(v).toLocaleString()}` : '—'
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

/** How long the confirm dialog waits before dismissing itself. */
const CLOSE_MODAL_MS = 12000

const closeConfirmBody = computed(() => {
  const base = t('nightAudit.closeConfirm')
  return topCloseWarning.value ? `${base} ${t(topCloseWarning.value.key, topCloseWarning.value.params)}` : base
})

function clearIssueSuccessTimer() {
  if (issueSuccessTimer) clearTimeout(issueSuccessTimer)
  issueSuccessTimer = null
}

function clearCloseSuccessTimer() {
  if (closeSuccessTimer) clearTimeout(closeSuccessTimer)
  closeSuccessTimer = null
}

function dismissCloseSuccess() {
  clearCloseSuccessTimer()
  closeSuccessTitle.value = ''
  closeSuccessBody.value = ''
  showClose.value = false
}

function dismissIssues() {
  clearIssueSuccessTimer()
  issueSuccess.value = false
  issueTotal.value = 0
  issueError.value = ''
  showIssues.value = false
}

function startIssueSuccess() {
  if (issueSuccess.value) return
  issueSuccess.value = true
  issueError.value = ''
  clearIssueSuccessTimer()
  issueSuccessTimer = setTimeout(() => {
    issueSuccessTimer = null
    issueSuccess.value = false
    issueTotal.value = 0
    showIssues.value = false
  }, ISSUE_SUCCESS_MS)
}

watch(openIssueCount, (count) => {
  if (!showIssues.value || issueSuccess.value || !issueTotal.value) return
  if (count === 0) startIssueSuccess()
})

onUnmounted(() => {
  clearIssueSuccessTimer()
  clearCloseSuccessTimer()
})

function cancelCloseConfirm() {
  clearCloseSuccessTimer()
  closeSuccessTitle.value = ''
  closeSuccessBody.value = ''
  showClose.value = false
  closeError.value = ''
}

function proceedToCloseConfirm() {
  closeError.value = ''
  dismissIssues()
  showClose.value = true
}

function openCloseConfirm() {
  error.value = ''
  closeError.value = ''
  clearCloseSuccessTimer()
  closeSuccessTitle.value = ''
  closeSuccessBody.value = ''
  // If there are unfinished businesses/issues, show issues modal with actions
  if (dueOuts.value.length || staleArrivals.value.count || blockerArrivals.value.length) {
    issueTotal.value = (dueOuts.value.length + Number(staleArrivals.value.count || 0) + blockerArrivals.value.length)
    issueSuccess.value = false
    clearIssueSuccessTimer()
    showIssues.value = true
    return
  }
  // Always show confirm modal
  showClose.value = true
}

async function confirmCloseDay() {
  closing.value = true
  error.value = ''
  closeError.value = ''
  success.value = ''
  try {
    const res = await nightAuditApi.close({ date: selectedDate.value })
    closeSuccessBody.value = res.data?.message || t('nightAudit.closeSuccess')
    closeSuccessTitle.value = t('nightAudit.allIssuesResolved')
    success.value = closeSuccessBody.value
    clearCloseSuccessTimer()
    closeSuccessTimer = setTimeout(dismissCloseSuccess, CLOSE_SUCCESS_MS)
    // Update business date instantly so stayview reflects new business date
    try {
      await businessDateStore.load()
      await businessDateStore.reload?.()
    } catch {
      /* ignore */
    }
    await load()
  } catch (err) {
    // Keep the dialog open so the blocker stays where the user acted on it.
    closeError.value = err.response?.data?.message || t('common.actionFailed')
    const msg = err.response?.data?.message || ''
    if (msg.toLowerCase().includes('no-show')) {
      blockerArrivals.value = []
      const m = msg.match(/Room\s*(\d+|—)/g)
      if (m && m.length) {
        blockerArrivals.value = m.map((x, i) => ({ reservation_id: 'block-' + i, guest_name: '—', room_number: x.replace(/Room\s*/i, ''), check_in_date: selectedDate.value }))
      } else {
        blockerArrivals.value = [{ reservation_id: 'block-0', guest_name: '—', room_number: '—', check_in_date: selectedDate.value }]
      }
      issueTotal.value = openIssueCount.value
      issueSuccess.value = false
      clearIssueSuccessTimer()
      showIssues.value = true
    }
  } finally {
    closing.value = false
  }
}

/**
 * Resolve a due-out straight from the audit modal. The desk should not have to
 * leave the page (and lose the audit context) just to clear a blocker.
 */
async function checkOutDueOut(guest) {
  if (!guest?.reservation_id || checkingOutId.value) return
  checkingOutId.value = guest.reservation_id
  issueError.value = ''
  try {
    await reservationApi.checkOut(guest.reservation_id, {})
    await load()
  } catch (err) {
    issueError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    checkingOutId.value = null
  }
}

async function markArrivalNoShow(arr) {
  if (!arr?.reservation_id || resolvingArrivalId.value) return
  resolvingArrivalId.value = arr.reservation_id
  issueError.value = ''
  try {
    await reservationApi.noShow(arr.reservation_id)
    await load()
  } catch (err) {
    issueError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    resolvingArrivalId.value = null
  }
}

async function cancelArrival(arr) {
  if (!arr?.reservation_id || resolvingArrivalId.value) return
  resolvingArrivalId.value = arr.reservation_id
  issueError.value = ''
  try {
    await reservationApi.cancel(arr.reservation_id, { reason: 'No show - night audit' })
    await load()
  } catch (err) {
    issueError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    resolvingArrivalId.value = null
  }
}

function goToStayviewForGuest(guest) {
  try {
    const query = {}
    if (guest?.reservation_id) query.reservation_id = guest.reservation_id
    if (guest?.room_id) query.room_id = guest.room_id
    if (guest?.room_number) query.room = guest.room_number
    if (guest?.guest_id) query.guest_id = guest.guest_id
    if (guest?.reservation_id) query.res_id = guest.reservation_id
    query.from = 'night-audit'
    sessionStorage.setItem('nightAuditReturn', window.location.pathname + window.location.search)
    router.push({ name: 'hotel-dashboard', query })
    dismissIssues()
  } catch {
    try {
      const params = new URLSearchParams()
      if (guest?.reservation_id) params.set('reservation_id', guest.reservation_id)
      if (guest?.room_id) params.set('room_id', guest.room_id)
      if (guest?.room_number) params.set('room', guest.room_number)
      if (guest?.guest_id) params.set('guest_id', guest.guest_id)
      if (guest?.reservation_id) params.set('res_id', guest.reservation_id)
      window.location.href = '/app' + (params.toString() ? '?' + params.toString() : '')
      showIssues.value = false
    } catch {
      try {
        window.location.href = '/app'
        showIssues.value = false
      } catch {
        /* ignore */
      }
    }
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

/** Actionable resolver for close warnings that reference specific dates. */
function resolveWarning(w) {
  const dates = String(w?.params?.dates || '').split(',').map((d) => d.trim()).filter(Boolean)
  if (dates.length) goToDate(dates[0])
}

onMounted(async () => {
  // Open on the hotel's actual business date, not the browser's calendar day.
  await businessDateStore.ensureLoaded()
  if (!userPickedDate.value && businessDateStore.current) {
    selectedDate.value = businessDateStore.current
  }
  load()
})
</script>

<style scoped>
.dashboard-page {
  padding: 32px 20px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.page-head h1 {
  font-size: 28px;
  font-weight: 800;
}

.muted {
  color: #757575;
  font-size: 12px;
  margin-top: 2px;
}

.date-row {
  display: flex;
  align-items: end;
  gap: 16px;
}

/* .form-group carries margin-bottom: 16px and flex `align-items: end` aligns to
   the margin box, not the border box — so the jump button used to sit 16px above
   the input it belongs beside. Dropping the margin here restores true baseline
   alignment; the row's own gap keeps the spacing. */
.date-field {
  margin-bottom: 0;
}

/* The close card is centred, but a list of consequences has to be scannable. */
.close-warnings {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  text-align: left;
  display: grid;
  gap: 8px;
}

.close-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  text-align: left;
  font-size: 13px;
  line-height: 1.45;
  padding: 9px 12px;
  border-radius: 8px;
}

.close-warning i {
  margin-top: 2px;
  flex-shrink: 0;
}

.close-warning--danger {
  background: #fdecea;
  color: #96281b;
}

.close-warning--warning {
  background: #fff6e5;
  color: #8a5a00;
}

.close-warning--info {
  background: #eaf4ff;
  color: #1f6ea8;
}

.closed-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #dcfce7;
  color: #166534;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-value {
  font-size: 20px;
  font-weight: 800;
  color: #062A52;
}

.kpi-label {
  font-size: 12px;
  color: #64748b;
}

.kpi.total {
  border-top: 2px solid #e2e8f0;
  padding-top: 8px;
}

.kpi.total .kpi-value {
  color: #005EB8;
  font-size: 22px;
}

.dueout-list {
  display: grid;
  gap: 10px;
}

.dueout-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border: 1px solid #fbd38d;
  background: #fffbeb;
  border-radius: 10px;
}

.dueout-item.overdue {
  border-color: #fecaca;
  background: #fef2f2;
}

.dueout-main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.dueout-name {
  font-weight: 700;
  color: #062A52;
}

.dueout-room {
  font-size: 12px;
  color: #64748b;
}

.dueout-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #475569;
}

.duplicate-panel,
.gap-panel {
  margin-bottom: 16px;
}

.duplicate-title,
.gap-title {
  margin: 0 0 8px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.duplicate-list {
  margin: 0 0 10px;
  padding-left: 18px;
  font-size: 13px;
  display: grid;
  gap: 7px;
}

.duplicate-list li {
  margin-bottom: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.duplicate-room {
  font-weight: 700;
}

.duplicate-date {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(150, 40, 27, 0.25);
  color: #96281b;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  white-space: nowrap;
}

.duplicate-names {
  opacity: 0.85;
}

.duplicate-count {
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.duplicate-note,
.gap-note {
  margin: 0;
  font-size: 12px;
  opacity: 0.85;
}

.gap-dates {
  margin: 0 0 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  word-break: break-word;
}

.stale-panel {
  margin-bottom: 16px;
}

.stale-title {
  margin: 0 0 8px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.stale-list {
  margin: 0 0 10px;
  padding-left: 18px;
  font-size: 13px;
  display: grid;
  gap: 7px;
}

.stale-list li {
  margin-bottom: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.stale-name {
  font-weight: 600;
  min-width: 150px;
}

/* Chips rather than dot separators: "Room 116" and a date are different kinds
   of fact, and running them together with a middot made both hard to scan. */
.stale-chip {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(31, 110, 168, 0.25);
  color: #1f6ea8;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  white-space: nowrap;
}

.stale-note {
  margin: 0;
  font-size: 12px;
  opacity: 0.8;
}

.missed-banner {
  margin-bottom: 16px;
}

.missed-title {
  margin: 0 0 6px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* The dates are the actionable part of the warning, so they are listed rather
   than summarised away into "yesterday". */
.missed-dates {
  margin: 0 0 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  word-break: break-word;
}

.dueout-bal {
  font-weight: 600;
}

.dueout-badge {
  white-space: nowrap;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
}

.badge-due {
  background: #fef3c7;
  color: #92400e;
}

.badge-overdue {
  background: #fee2e2;
  color: #b91c1c;
}

.na-issues {
  text-align: left;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
}

.na-issues>p {
  flex: 1 1 100%;
  margin: 0;
}

.na-issues--success {
  display: block;
}

.na-progress {
  flex: 1 1 100%;
  padding: 14px 16px;
  border-radius: 10px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  margin-bottom: 12px;
}

.na-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
  font-size: 13px;
  font-weight: 700;
  color: #075985;
}

.na-progress-head span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.na-progress-track {
  height: 10px;
  border-radius: 999px;
  background: #dbeafe;
  overflow: hidden;
}

.na-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0ea5e9, #22c55e);
  transition: width 0.35s ease;
}

.na-progress-label {
  margin: 7px 0 0;
  font-size: 12px;
  color: #0369a1;
}

.na-success {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: 20px;
}

.na-success-icon {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #dcfce7;
  color: #16a34a;
  font-size: 32px;
  animation: na-success-pop 0.35s ease;
}

.na-success h3 {
  margin: 0;
  color: #166534;
  font-size: 22px;
}

.na-success p {
  margin: 0;
  max-width: 420px;
  color: #475569;
  font-size: 14px;
}

.na-success-return {
  color: #64748b;
  font-size: 13px;
}

@keyframes na-success-pop {
  from {
    transform: scale(0.7);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

.na-intro {
  margin: 0 0 12px;
  color: #475569;
}

.na-issue-block {
  flex: 1 1 360px;
  min-width: 0;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  background: #fff;
  max-height: 46vh;
  overflow-y: auto;
}

.na-issue-block h4 {
  margin: 0 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.na-issue-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  margin-bottom: 8px;
}

.na-issue-item:last-child {
  margin-bottom: 0;
}

.na-issue-main {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1 1 220px;
}

.na-warn-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  flex: 1 1 100%;
}

.na-warn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.na-warn--danger {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}

.na-warn--warning {
  background: #fffbeb;
  border-color: #fbd38d;
  color: #92400e;
}

.na-warn--info {
  background: #f8fafc;
  color: #475569;
}

/* The issues modal reuses the shared AlertModal shell, but these blocks are
   night-audit specific and were painted light-only. In dark mode they must sit
   on the raised slate panel instead of punching a white hole in the modal. */
html[data-theme='dark'] .na-intro {
  color: #95a3ab;
}

html[data-theme='dark'] .na-progress {
  background: #172a36;
  border-color: #245166;
}

html[data-theme='dark'] .na-progress-head {
  color: #8fd3ff;
}

html[data-theme='dark'] .na-progress-track {
  background: #20343f;
}

html[data-theme='dark'] .na-progress-label {
  color: #9fcbe6;
}

html[data-theme='dark'] .na-success h3 {
  color: #86efac;
}

html[data-theme='dark'] .na-success p {
  color: #aebac1;
}

html[data-theme='dark'] .na-success-icon {
  background: #143a24;
  color: #4ade80;
}

html[data-theme='dark'] .na-success-return {
  color: #95a3ab;
}

html[data-theme='dark'] .na-issue-block {
  background: #202c33;
  border-color: #2f3b43;
  color: #e9edef;
}

html[data-theme='dark'] .na-issue-item {
  border-color: #2f3b43;
}

html[data-theme='dark'] .na-issue-main {
  color: #e9edef;
}

html[data-theme='dark'] .na-warn {
  border-color: #2f3b43;
}

html[data-theme='dark'] .na-warn--danger {
  background: #3a1f22;
  border-color: #5b2a2f;
  color: #ffb4b4;
}

html[data-theme='dark'] .na-warn--warning {
  background: #3a2f18;
  border-color: #5b4a24;
  color: #ffd48a;
}

html[data-theme='dark'] .na-warn--info {
  background: #1b262c;
  color: #aebac1;
}

.text-red {
  color: #DC2626 !important;
}

.text-green {
  color: #16A34A !important;
}

.capitalize {
  text-transform: capitalize;
}

.table-scroll .table {
  min-width: 560px;
}

/* Tablets: 768px is the classic iPad portrait width, so the phone
   treatment below starts at 767px. Without this band a tablet drops
   straight from the full form to a single column. */
@media (min-width: 768px) and (max-width: 1024px) {

  .date-row,
  .page-head {
    flex-direction: row;
  }
}

@media (max-width: 767px) {
  .dashboard-page {
    padding: 20px 16px;
  }

  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .date-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
