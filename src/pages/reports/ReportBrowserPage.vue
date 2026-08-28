<!--
  ReportBrowserPage — the classic PMS report browser (route /app/reports).
  Uses ReportBrowserLayout for the shell: collapsible category tree on the
  left, and a filter toolbar + printable paper + Help Guide on the right.

  Every report opens with its own filter form (mirroring the reference
  screenshots) — as-on-date / currency for front office, stay date / status
  for reservations, from-to / user for audit, etc. — plus a "Report Template"
  dropdown and Search / Reset / Export actions. A Help Guide accordion sits
  below every report. The Front Office → Night Audit report is the wired
  pilot reading real backend data; the rest show a "not wired" body while
  still presenting their filters and help text.
-->
<template>
  <ReportBrowserLayout
    :categories="categories"
    :active="activeReport"
    :title="$t('reportBrowser.title')"
    :subtitle="$t('reportBrowser.subtitle')"
    :exporting="exporting"
    @select="selectReport"
    @print="printPaper"
    @export="exportCsv"
    @search="onSearch"
  >
    <!-- ══ Dynamic filter toolbar per report ══ -->
    <template #toolbar>
      <div class="rb-toolbar">
        <div v-for="f in activeFields" :key="f.key" class="rb-toolbar-field">
          <label>{{ f.label }}</label>
          <input
            v-if="f.type === 'date'"
            type="date"
            v-model="filterValues[f.key]"
            class="rb-input"
            @change="runReport"
          />
          <input
            v-else-if="f.type === 'text'"
            type="text"
            v-model="filterValues[f.key]"
            class="rb-input"
            :placeholder="f.placeholder || ''"
          />
          <select
            v-else-if="f.type === 'select'"
            v-model="filterValues[f.key]"
            class="rb-input rb-select"
          >
            <option v-if="!f.required" value="">{{ f.allLabel || '—' }}</option>
            <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>

        <div class="rb-toolbar-field">
          <label>{{ $t('reportBrowser.template') }}</label>
          <select v-model="templateName" class="rb-input rb-select rb-template">
            <option value="default">{{ $t('reportBrowser.templateDefault') }}</option>
            <option value="export">{{ $t('reportBrowser.templateExport') }}</option>
          </select>
        </div>

        <div class="rb-toolbar-field rb-toolbar-field-end">
          <label>&nbsp;</label>
          <div class="rb-toolbar-actions">
            <button class="rb-btn" type="button" @click="runReport">
              <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
              {{ $t('reportBrowser.search') }}
            </button>
            <button class="rb-btn rb-btn-ghost" type="button" @click="resetFilters">
              <i class="fas fa-rotate-left" aria-hidden="true"></i>{{ $t('reportBrowser.reset') }}
            </button>
            <button class="rb-btn rb-btn-ghost" type="button" @click="exportCsv">
              <i v-if="exporting" class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              <i v-else class="fas fa-download" aria-hidden="true"></i>
              {{ $t('reportBrowser.export') }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ══ Report body ══ -->
    <template v-if="activeConfig?.wired">
      <div v-if="loading" class="rb-loading">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> {{ $t('reportBrowser.loading') }}
      </div>
      <div v-else-if="error" class="rb-error">{{ error }}</div>

      <template v-else-if="report && activeReport === 'night-audit'">
        <div class="rb-report-card">
          <div class="rb-report-head">
            <h2>{{ activeLabel }}</h2>
            <span class="rb-date">{{ prettyDate(filterValues[activeConfig.dateKey] || todayIso()) }}</span>
            <span v-if="report.closed" class="rb-closed">
              <i class="fas fa-lock" aria-hidden="true"></i> {{ $t('nightAudit.closed') }}
            </span>
          </div>

          <div class="rb-numcols">
            <div class="rb-report-row">
              <span class="rb-report-row-label">{{ $t('nightAudit.totalRevenue') }}</span>
              <strong>{{ money(report.revenue.total) }}</strong>
            </div>
            <div class="rb-report-row">
              <span class="rb-report-row-label">{{ $t('nightAudit.cashInHand') }}</span>
              <strong :class="{ 'text-red': report.cash_in_hand < 0 }">{{ money(report.cash_in_hand) }}</strong>
            </div>
            <div class="rb-report-row">
              <span class="rb-report-row-label">{{ $t('nightAudit.netProfit') }}</span>
              <strong :class="{ 'text-green': report.net_profit > 0, 'text-red': report.net_profit < 0 }">{{ money(report.net_profit) }}</strong>
            </div>
            <div class="rb-report-row">
              <span class="rb-report-row-label">{{ $t('nightAudit.outstanding') }}</span>
              <strong>{{ money(report.outstanding) }}</strong>
            </div>
          </div>

          <h3 class="rb-section-title">
            <i class="fas fa-chart-line" aria-hidden="true"></i> {{ $t('nightAudit.revenue') }}
          </h3>
          <table class="rb-table">
            <thead>
              <tr>
                <th>{{ $t('reportBrowser.revenueStream') }}</th>
                <th class="num">{{ $t('reportBrowser.amount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ $t('nightAudit.rooms') }}</td>
                <td class="num">{{ money(report.revenue.rooms) }}</td>
              </tr>
              <tr>
                <td>{{ $t('nightAudit.fnb') }}</td>
                <td class="num">{{ money(report.revenue.fnb) }}</td>
              </tr>
              <tr>
                <td>{{ $t('nightAudit.laundry') }}</td>
                <td class="num">{{ money(report.revenue.laundry) }}</td>
              </tr>
              <tr>
                <td>{{ $t('nightAudit.funGames') }}</td>
                <td class="num">{{ money(report.revenue.fun_games) }}</td>
              </tr>
              <tr class="rb-total">
                <td>{{ $t('nightAudit.totalRevenue') }}</td>
                <td class="num">{{ money(report.revenue.total) }}</td>
              </tr>
            </tbody>
          </table>

          <h3 class="rb-section-title">
            <i class="fas fa-money-bill-wave" aria-hidden="true"></i> {{ $t('reportBrowser.collections') }}
          </h3>
          <table class="rb-table">
            <thead>
              <tr>
                <th>{{ $t('reportBrowser.method') }}</th>
                <th class="num">{{ $t('reportBrowser.amount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(amount, method) in report.collections.by_method" :key="method">
                <td class="capitalize">{{ method.replace('_', ' ') }}</td>
                <td class="num">{{ money(amount) }}</td>
              </tr>
              <tr class="rb-total">
                <td>{{ $t('nightAudit.totalCollected') }}</td>
                <td class="num">{{ money(report.collections.total) }}</td>
              </tr>
            </tbody>
          </table>

          <h3 class="rb-section-title">
            <i class="fas fa-bed" aria-hidden="true"></i> {{ $t('reportBrowser.occupancy') }}
          </h3>
          <table class="rb-table">
            <thead>
              <tr>
                <th>{{ $t('reportBrowser.count') }}</th>
                <th class="num">{{ $t('reportBrowser.value') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ $t('nightAudit.arrivals') }}</td>
                <td class="num">{{ report.counts.arrivals }}</td>
              </tr>
              <tr>
                <td>{{ $t('nightAudit.departures') }}</td>
                <td class="num">{{ report.counts.departures }}</td>
              </tr>
              <tr>
                <td>{{ $t('nightAudit.inHouse') }}</td>
                <td class="num">{{ report.counts.in_house }}</td>
              </tr>
              <tr>
                <td>{{ $t('nightAudit.newBookings') }}</td>
                <td class="num">{{ report.counts.reservations_created }}</td>
              </tr>
            </tbody>
          </table>

          <button v-if="!report.closed" type="button" class="rb-btn rb-btn-primary" :disabled="saving" @click="closeDay">
            <i class="fas fa-lock" aria-hidden="true"></i> {{ $t('nightAudit.closeDay') }}
          </button>
        </div>
      </template>

      <template v-else-if="report && activeReport === 'guest-list'">
        <div class="rb-report-card">
          <div class="rb-report-head">
            <h2>{{ activeLabel }}</h2>
            <span class="rb-date">{{ prettyDate(filterValues.stayDate || todayIso()) }}</span>
          </div>

          <p class="rb-count">{{ $t('reportBrowser.totalRows', { count: report.count || 0 }) }}</p>

          <table class="rb-table">
            <thead>
              <tr>
                <th>{{ $t('reportBrowser.guestName') }}</th>
                <th>{{ $t('reportBrowser.room') }}</th>
                <th>{{ $t('reportBrowser.arrival') }}</th>
                <th>{{ $t('reportBrowser.departure') }}</th>
                <th class="num">{{ $t('reportBrowser.pax') }}</th>
                <th>{{ $t('reportBrowser.rateType') }}</th>
                <th class="num">{{ $t('reportBrowser.balance') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in report.rows" :key="i">
                <td>{{ row.guest_name }}</td>
                <td>{{ row.room }}</td>
                <td>{{ prettyDate(row.arrival) }}</td>
                <td>{{ prettyDate(row.departure) }}</td>
                <td class="num">{{ row.pax }}</td>
                <td>{{ row.rate_type }}</td>
                <td class="num">{{ money(row.balance) }}</td>
              </tr>
              <tr v-if="!report.rows || !report.rows.length">
                <td colspan="7" class="rb-empty">{{ $t('reportBrowser.noRows') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <!-- ══ Placeholder for reports not yet wired to data ══ -->
    <template v-else>
      <div class="rb-placeholder">
        <i class="fas fa-file-lines rb-placeholder-icon" aria-hidden="true"></i>
        <h3>{{ activeLabel }}</h3>
        <p>{{ $t('reportBrowser.notWired') }}</p>
      </div>
    </template>

    <!-- ══ Help Guide (shown for every report) ══ -->
    <details class="rb-help" :open="helpOpen">
      <summary @click="helpOpen = !helpOpen">
        <i class="fas fa-circle-question" aria-hidden="true"></i>
        {{ $t('reportBrowser.helpGuide') }}
      </summary>
      <div class="rb-help-body">
        <p>{{ activeConfig?.helpIntro || $t('reportBrowser.helpGeneric') }}</p>

        <h4 v-if="activeConfig?.compare?.length"><i class="fas fa-diagram-project"></i> {{ $t('reportBrowser.howCompare') }}</h4>
        <ul v-if="activeConfig?.compare?.length">
          <li v-for="(tip, i) in activeConfig.compare" :key="i">{{ tip }}</li>
        </ul>

        <h4 v-if="activeConfig?.columns?.length"><i class="fas fa-table-list"></i> {{ $t('reportBrowser.columnExplanation') }}</h4>
        <table v-if="activeConfig?.columns?.length" class="rb-help-table">
          <tbody>
            <tr v-for="c in activeConfig.columns" :key="c.column">
              <td>{{ c.column }}</td>
              <td>{{ c.desc }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </ReportBrowserLayout>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ReportBrowserLayout from '@/components/reports/ReportBrowserLayout.vue'
import { nightAuditApi, guestReportApi } from '@/api'
import { exportCSV } from '@/utils/export'

const { t } = useI18n()

/* ── Report catalogue (matches the reference screenshot tree) ── */
const categories = [
  {
    key: 'reservation',
    label: 'reportBrowser.catReservation',
    icon: 'fas fa-calendar-check',
    reports: [
      { key: 'arrival-list', label: 'reportBrowser.rArrivalList' },
      { key: 'cancelled-reservations', label: 'reportBrowser.rCancelled' },
      { key: 'country-wise-statistics', label: 'reportBrowser.rCountryWise' },
      { key: 'departure-list', label: 'reportBrowser.rDepartureList' },
      { key: 'no-show-reservations', label: 'reportBrowser.rNoShow' },
      { key: 'release-reservation', label: 'reportBrowser.rReleaseReservation' },
      { key: 'reservation-activity', label: 'reportBrowser.rReservationActivity' },
      { key: 'void-reservation', label: 'reportBrowser.rVoid' },
    ],
  },
  {
    key: 'front-office',
    label: 'reportBrowser.catFrontOffice',
    icon: 'fas fa-bell-concierge',
    reports: [
      { key: 'guest-checked-in', label: 'reportBrowser.rGuestIn' },
      { key: 'guest-checked-out', label: 'reportBrowser.rGuestOut' },
      { key: 'guest-list', label: 'reportBrowser.rGuestList' },
      { key: 'guest-message', label: 'reportBrowser.rGuestMessage' },
      { key: 'inclusion', label: 'reportBrowser.rInclusion' },
      { key: 'inventory-by-room-type', label: 'reportBrowser.rInvByRoomType' },
      { key: 'invoice-breakdown', label: 'reportBrowser.rInvoiceBreakdown' },
      { key: 'night-audit', label: 'reportBrowser.rNightAudit' },
      { key: 'pickup-dropoff', label: 'reportBrowser.rPickupDropoff' },
      { key: 'room-availability', label: 'reportBrowser.rRoomAvailability' },
      { key: 'room-status', label: 'reportBrowser.rRoomStatus' },
      { key: 'task-list', label: 'reportBrowser.rTaskList' },
    ],
  },
  {
    key: 'back-office',
    label: 'reportBrowser.catBackOffice',
    icon: 'fas fa-vault',
    reports: [
      { key: 'advance-deposit-ledger', label: 'reportBrowser.rAdvanceDeposit' },
      { key: 'ageing-debtors-detail', label: 'reportBrowser.rAgeingDetail' },
      { key: 'ageing-debtors-summary', label: 'reportBrowser.rAgeingSummary' },
      { key: 'cashier-sales', label: 'reportBrowser.rCashierSales' },
      { key: 'city-ledger-detail', label: 'reportBrowser.rCityLedgerDetail' },
      { key: 'city-ledger-summary', label: 'reportBrowser.rCityLedgerSummary' },
      { key: 'complementary-room', label: 'reportBrowser.rComplementary' },
      { key: 'credit-card-process', label: 'reportBrowser.rCreditCard' },
      { key: 'daily-extra-charge', label: 'reportBrowser.rDailyExtraCharge' },
      { key: 'daily-receipt-detail', label: 'reportBrowser.rDailyReceiptDetail' },
      { key: 'daily-receipt-summary', label: 'reportBrowser.rDailyReceiptSummary' },
      { key: 'daily-refund', label: 'reportBrowser.rDailyRefund' },
      { key: 'daily-revenue', label: 'reportBrowser.rDailyRevenue' },
      { key: 'detail-discount', label: 'reportBrowser.rDetailDiscount' },
      { key: 'detail-revenue', label: 'reportBrowser.rDetailRevenue' },
      { key: 'expense-voucher', label: 'reportBrowser.rExpenseVoucher' },
      { key: 'folio-list', label: 'reportBrowser.rFolioList' },
      { key: 'guest-ledger', label: 'reportBrowser.rGuestLedger' },
      { key: 'house-status', label: 'reportBrowser.rHouseStatus' },
      { key: 'housekeeping-summary', label: 'reportBrowser.rHousekeepingSummary' },
      { key: 'maintenance-block', label: 'reportBrowser.rMaintenanceBlock' },
      { key: 'manager-report', label: 'reportBrowser.rManagerReport' },
      { key: 'meal-plan', label: 'reportBrowser.rMealPlan' },
      { key: 'meal-planner', label: 'reportBrowser.rMealPlanner' },
      { key: 'owner-statement', label: 'reportBrowser.rOwnerStatement' },
      { key: 'rate-card', label: 'reportBrowser.rRateCard' },
      { key: 'revenue-by-rate-type', label: 'reportBrowser.rRevenueRateType' },
      { key: 'revenue-by-room-type', label: 'reportBrowser.rRevenueRoomType' },
      { key: 'room-typewise-daily-revenue', label: 'reportBrowser.rRoomTypewiseDaily' },
      { key: 'transaction-detail', label: 'reportBrowser.rTransactionDetail' },
      { key: 'travel-agent-commission-detail', label: 'reportBrowser.rTravelAgentDetail' },
      { key: 'travel-agent-commission-summary', label: 'reportBrowser.rTravelAgentSummary' },
      { key: 'weekly-manager', label: 'reportBrowser.rWeeklyManager' },
      { key: 'weekly-meal-plan', label: 'reportBrowser.rWeeklyMealPlan' },
      { key: 'work-order-list', label: 'reportBrowser.rWorkOrderList' },
    ],
  },
  {
    key: 'audit',
    label: 'reportBrowser.catAudit',
    icon: 'fas fa-shield-halved',
    reports: [
      { key: 'audit-trails', label: 'reportBrowser.rAuditTrails' },
      { key: 'ip-report', label: 'reportBrowser.rIpReport' },
      { key: 'keycard-activities', label: 'reportBrowser.rKeycard' },
      { key: 'void-charge', label: 'reportBrowser.rVoidCharge' },
      { key: 'void-payment', label: 'reportBrowser.rVoidPayment' },
      { key: 'void-transaction', label: 'reportBrowser.rVoidTransaction' },
    ],
  },
  {
    key: 'statistical',
    label: 'reportBrowser.catStatistical',
    icon: 'fas fa-chart-pie',
    reports: [
      { key: 'business-analysis', label: 'reportBrowser.rBusinessAnalysis' },
      { key: 'contribution-analysis', label: 'reportBrowser.rContributionAnalysis' },
      { key: 'monthly-country-pax', label: 'reportBrowser.rMonthlyCountryPax' },
      { key: 'monthly-revenue-stream', label: 'reportBrowser.rMonthlyRevenueStream' },
      { key: 'monthly-room-tax', label: 'reportBrowser.rMonthlyRoomTax' },
      { key: 'monthly-statistics', label: 'reportBrowser.rMonthlyStatistics' },
      { key: 'monthly-summary', label: 'reportBrowser.rMonthlySummary' },
      { key: 'room-sale-statistics', label: 'reportBrowser.rRoomSaleStatistics' },
      { key: 'room-statistics', label: 'reportBrowser.rRoomStatistics' },
      { key: 'rooms-on-books', label: 'reportBrowser.rRoomsOnBooks' },
      { key: 'yearly-statistics', label: 'reportBrowser.rYearlyStatistics' },
      { key: 'booking-source-statistics', label: 'reportBrowser.rBookingSource' },
      { key: 'mobile-desktop-statistics', label: 'reportBrowser.rMobileDesktop' },
      { key: 'ota-monthly-breakdown', label: 'reportBrowser.rOtaMonthly' },
      { key: 'performance-analysis', label: 'reportBrowser.rPerformanceAnalysis' },
      { key: 'revenue-analysis', label: 'reportBrowser.rRevenueAnalysis' },
      { key: 'sourcewise-revenue', label: 'reportBrowser.rSourcewiseRevenue' },
    ],
  },
  {
    key: 'graphs',
    label: 'reportBrowser.catGraphs',
    icon: 'fas fa-chart-column',
    reports: [{ key: 'graphs-and-charts', label: 'reportBrowser.rGraphsCharts' }],
  },
]

const allReports = categories.flatMap((c) => c.reports.map((r) => ({ ...r, category: c.key })))

const activeReport = ref('night-audit')

const activeConfig = computed(() => REPORTS[activeReport.value] || null)

const activeFields = computed(() => activeConfig.value?.fields || [])

const activeLabel = computed(() => {
  const found = allReports.find((r) => r.key === activeReport.value)
  return found ? t(found.label) : activeReport.value
})

/* ── Per-report UI configuration ──
   fields: filter inputs rendered in the toolbar.
   dateKey: which field carries the "as on" date, for the report header. */
const templateName = ref('default')
const helpOpen = ref(true)

const filterValues = reactive({})

const REPORTS = {
  'night-audit': {
    wired: true,
    dateKey: 'businessDate',
    fields: [
      { key: 'businessDate', label: t('reportBrowser.asOnDate'), type: 'date' },
      {
        key: 'currency',
        label: t('reportBrowser.currency'),
        type: 'select',
        options: [
          { value: 'TZS', label: 'TSh' },
          { value: 'USD', label: 'USD' },
          { value: 'EUR', label: 'EUR' },
        ],
      },
    ],
    helpIntro: t('reportBrowser.nightAuditHelp1'),
    compare: [t('reportBrowser.nightAuditHelp2'), t('reportBrowser.nightAuditHelp3')],
    columns: [
      { column: t('nightAudit.rooms'), desc: t('reportBrowser.colRooms') },
      { column: t('nightAudit.fnb'), desc: t('reportBrowser.colFnb') },
      { column: t('nightAudit.laundry'), desc: t('reportBrowser.colLaundry') },
      { column: t('nightAudit.funGames'), desc: t('reportBrowser.colFunGames') },
    ],
  },
  'guest-list': {
    wired: true,
    dateKey: 'stayDate',
    fields: [
      { key: 'stayDate', label: t('reportBrowser.stayDate'), type: 'date' },
      {
        key: 'reservationStatus',
        label: t('reportBrowser.reservationStatus'),
        type: 'select',
        required: false,
        allLabel: t('reportBrowser.select'),
        options: [
          { value: 'reserved', label: t('reportBrowser.statusReserved') },
          { value: 'checked_in', label: t('reportBrowser.statusCheckedIn') },
          { value: 'checked_out', label: t('reportBrowser.statusCheckedOut') },
          { value: 'cancelled', label: t('reportBrowser.statusCancelled') },
          { value: 'no_show', label: t('reportBrowser.statusNoShow') },
        ],
      },
    ],
    helpIntro: t('reportBrowser.guestListHelp1'),
    compare: [t('reportBrowser.guestListHelp2'), t('reportBrowser.guestListHelp3'), t('reportBrowser.guestListHelp4')],
    columns: [
      { column: t('reportBrowser.guestName'), desc: t('reportBrowser.colGuestName') },
      { column: t('reportBrowser.room'), desc: t('reportBrowser.colRoom') },
      { column: t('reportBrowser.arrival'), desc: t('reportBrowser.colArrival') },
      { column: t('reportBrowser.departure'), desc: t('reportBrowser.colDeparture') },
      { column: t('reportBrowser.pax'), desc: t('reportBrowser.colPax') },
    ],
  },
  'guest-checked-in': {
    fields: [
      { key: 'from', label: t('reportBrowser.checkedInFrom'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'roomType', label: t('reportBrowser.roomType'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'rateType', label: t('reportBrowser.rateType'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.guestInHelp1'),
    compare: [t('reportBrowser.guestInHelp2'), t('reportBrowser.guestInHelp3')],
    columns: [
      { column: t('reportBrowser.guestName'), desc: t('reportBrowser.colGuestName') },
      { column: t('reportBrowser.room'), desc: t('reportBrowser.colRoom') },
      { column: t('reportBrowser.arrival'), desc: t('reportBrowser.colArrival') },
      { column: t('reportBrowser.pax'), desc: t('reportBrowser.colPax') },
    ],
  },
  'guest-checked-out': {
    fields: [
      { key: 'from', label: t('reportBrowser.checkedOutFrom'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'bookingWise', label: t('reportBrowser.bookingWise'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.guestOutHelp1'),
    compare: [t('reportBrowser.guestOutHelp2'), t('reportBrowser.guestOutHelp3')],
    columns: [
      { column: t('reportBrowser.guestName'), desc: t('reportBrowser.colGuestName') },
      { column: t('reportBrowser.room'), desc: t('reportBrowser.colRoom') },
      { column: t('reportBrowser.departure'), desc: t('reportBrowser.colDeparture') },
      { column: t('reportBrowser.balance'), desc: t('reportBrowser.colBalance') },
    ],
  },
  'departure-list': {
    fields: [
      { key: 'from', label: t('reportBrowser.departure'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'reservationType', label: t('reportBrowser.reservationType'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'user', label: t('reportBrowser.user'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'roomType', label: t('reportBrowser.roomType'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'rateType', label: t('reportBrowser.rateType'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'rateFrom', label: t('reportBrowser.rateFrom'), type: 'text', placeholder: t('reportBrowser.rateFromPh') },
      { key: 'rateTo', label: t('reportBrowser.rateTo'), type: 'text', placeholder: t('reportBrowser.rateToPh') },
      { key: 'marketSegment', label: t('reportBrowser.marketSegment'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'travelAgent', label: t('reportBrowser.travelAgent'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'businessSource', label: t('reportBrowser.businessSource'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'company', label: t('reportBrowser.company'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.departureListHelp1'),
    columns: [
      { column: t('reportBrowser.guestName'), desc: t('reportBrowser.colDepartureGuest') },
      { column: t('reportBrowser.room'), desc: t('reportBrowser.colDepartureRoom') },
      { column: t('reportBrowser.user'), desc: t('reportBrowser.colUser') },
    ],
  },
  'audit-trails': {
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'user', label: t('reportBrowser.user'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'operation', label: t('reportBrowser.operation'), type: 'select', allLabel: t('reportBrowser.operationAll'), options: [] },
    ],
    helpIntro: t('reportBrowser.auditTrailsHelp1'),
  },
  'daily-revenue': {
    fields: [
      { key: 'postingDate', label: t('reportBrowser.asOnDate'), type: 'date' },
      { key: 'revenueAccount', label: t('reportBrowser.dailyRevenueBy'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.dailyRevenueHelp1'),
    compare: [t('reportBrowser.dailyRevenueHelp2'), t('reportBrowser.dailyRevenueHelp3')],
    columns: [
      { column: t('reportBrowser.guestName'), desc: t('reportBrowser.colGuestName') },
      { column: t('reportBrowser.room'), desc: t('reportBrowser.colRoom') },
      { column: t('reportBrowser.rateType'), desc: t('reportBrowser.colRateType') },
      { column: t('reportBrowser.roomCharges'), desc: t('reportBrowser.colRoomCharges') },
    ],
  },
  'ip-report': {
    fields: [
      { key: 'from', label: t('reportBrowser.openedFrom'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'user', label: t('reportBrowser.openedBy'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.ipReportHelp1'),
  },

  /* ── Reservation reports ── */
  'arrival-list': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.arrival'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'company', label: t('reportBrowser.company'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'roomType', label: t('reportBrowser.roomType'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'rateType', label: t('reportBrowser.rateType'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'businessSource', label: t('reportBrowser.businessSource'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'rateFrom', label: t('reportBrowser.rateFrom'), type: 'text', placeholder: t('reportBrowser.rateFromPh') },
      { key: 'rateTo', label: t('reportBrowser.rateTo'), type: 'text', placeholder: t('reportBrowser.rateToPh') },
      { key: 'user', label: t('reportBrowser.user'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.arrivalListHelp1'),
    columns: [
      { column: t('reportBrowser.guestName'), desc: t('reportBrowser.colGuestName') },
      { column: t('reportBrowser.room'), desc: t('reportBrowser.colRoom') },
      { column: t('reportBrowser.arrival'), desc: t('reportBrowser.colArrival') },
      { column: t('reportBrowser.pax'), desc: t('reportBrowser.colPax') },
    ],
  },
  'cancelled-reservations': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.cancelledFrom'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'roomType', label: t('reportBrowser.roomType'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'rateType', label: t('reportBrowser.rateType'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'cancelledBy', label: t('reportBrowser.cancelledBy'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'businessSource', label: t('reportBrowser.businessSource'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'travelAgent', label: t('reportBrowser.travelAgent'), type: 'select', allLabel: t('reportBrowser.travelAgentAll'), options: [] },
    ],
    helpIntro: t('reportBrowser.cancelledHelp1'),
    columns: [
      { column: t('reportBrowser.resNo'), desc: t('reportBrowser.colResNo') },
      { column: t('reportBrowser.guestName'), desc: t('reportBrowser.colGuestName') },
      { column: t('reportBrowser.room'), desc: t('reportBrowser.colRoom') },
      { column: t('reportBrowser.arrival'), desc: t('reportBrowser.colArrival') },
    ],
  },
  'country-wise-statistics': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.arrival'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'country', label: t('reportBrowser.country'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.countryWiseHelp1'),
  },
  'no-show-reservations': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.noShowFrom'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.noShowHelp1'),
    columns: [
      { column: t('reportBrowser.resNo'), desc: t('reportBrowser.colResNo') },
      { column: t('reportBrowser.guestName'), desc: t('reportBrowser.colGuestName') },
      { column: t('reportBrowser.arrival'), desc: t('reportBrowser.colArrival') },
    ],
  },
  'release-reservation': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'user', label: t('reportBrowser.user'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.releaseHelp1'),
  },
  'reservation-activity': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'user', label: t('reportBrowser.user'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.reservationActivityHelp1'),
  },

  /* ── Front Office reports ── */
  'room-availability': {
    dateKey: 'stayDate',
    fields: [
      { key: 'stayDate', label: t('reportBrowser.stayDateFrom'), type: 'date' },
      { key: 'roomType', label: t('reportBrowser.roomType'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    note: t('reportBrowser.roomAvailabilityNote'),
    helpIntro: t('reportBrowser.roomAvailabilityHelp1'),
  },
  'room-status': {
    dateKey: 'businessDate',
    fields: [{ key: 'businessDate', label: t('reportBrowser.asOnDate'), type: 'date' }],
    helpIntro: t('reportBrowser.roomStatusHelp1'),
  },
  'task-list': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.dueDate'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'taskFor', label: t('reportBrowser.taskFor'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'alert', label: t('reportBrowser.alert'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'status', label: t('reportBrowser.status'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.taskListHelp1'),
  },
  'inclusion': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.inclusionDate'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'extraCharge', label: t('reportBrowser.extraCharge'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.inclusionHelp1'),
  },
  'inventory-by-room-type': {
    dateKey: 'businessDate',
    fields: [
      { key: 'businessDate', label: t('reportBrowser.date'), type: 'date' },
      { key: 'roomType', label: t('reportBrowser.roomType'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.inventoryByRoomTypeHelp1'),
  },
  'invoice-breakdown': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.invoiceBreakdownHelp1'),
  },
  'guest-message': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'user', label: t('reportBrowser.user'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.guestMessageHelp1'),
  },
  'pickup-dropoff': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.pickupFrom'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.pickupHelp1'),
  },

  /* ── Audit reports ── */
  'keycard-activities': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.stayDate'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.keycardHelp1'),
  },
  'void-charge': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.voidFrom'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'voidBy', label: t('reportBrowser.voidBy'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'charge', label: t('reportBrowser.charge'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.voidChargeHelp1'),
  },
  'void-payment': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.voidFrom'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'voidBy', label: t('reportBrowser.voidBy'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.voidPaymentHelp1'),
  },
  'void-transaction': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.voidFrom'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'voidBy', label: t('reportBrowser.voidBy'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.voidTransactionHelp1'),
  },
  'void-reservation': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.voidFrom'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'voidBy', label: t('reportBrowser.voidBy'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.voidReservationHelp1'),
  },

  /* ── Statistical reports ── */
  'monthly-statistics': {
    fields: [
      { key: 'month', label: t('reportBrowser.month'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'year', label: t('reportBrowser.year'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.monthlyStatsHelp1'),
  },
  'monthly-summary': {
    fields: [
      { key: 'month', label: t('reportBrowser.month'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'year', label: t('reportBrowser.year'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'by', label: t('reportBrowser.by'), type: 'select', allLabel: t('reportBrowser.businessSource'), options: [] },
    ],
    helpIntro: t('reportBrowser.monthlySummaryHelp1'),
  },
  'business-analysis': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.arrivalDateFrom'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
      { key: 'by', label: t('reportBrowser.by'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.businessAnalysisHelp1'),
  },
  'monthly-country-pax': {
    fields: [
      { key: 'month', label: t('reportBrowser.month'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'year', label: t('reportBrowser.year'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'by', label: t('reportBrowser.by'), type: 'select', allLabel: t('reportBrowser.countryWise'), options: [] },
    ],
    helpIntro: t('reportBrowser.monthlyCountryPaxHelp1'),
  },
  'monthly-revenue-stream': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.monthlyRevenueStreamHelp1'),
  },
  'mobile-desktop-statistics': {
    fields: [
      { key: 'month', label: t('reportBrowser.month'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'year', label: t('reportBrowser.year'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.mobileDesktopHelp1'),
  },
  'sourcewise-revenue': {
    fields: [
      { key: 'from', label: t('reportBrowser.fromDate'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.sourcewiseHelp1'),
  },
  'yearly-statistics': {
    fields: [
      { key: 'year', label: t('reportBrowser.selectYear'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.yearlyHelp1'),
  },
  'rooms-on-books': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.roomsOnBooksHelp1'),
  },
  'room-statistics': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.roomStatisticsHelp1'),
  },
  'room-sale-statistics': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.roomSaleHelp1'),
  },
  'contribution-analysis': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.contributionHelp1'),
  },
  'monthly-room-tax': {
    fields: [
      { key: 'month', label: t('reportBrowser.month'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'year', label: t('reportBrowser.year'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.monthlyRoomTaxHelp1'),
  },
  'booking-source-statistics': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.bookingSourceHelp1'),
  },
  'ota-monthly-breakdown': {
    fields: [
      { key: 'month', label: t('reportBrowser.month'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
      { key: 'year', label: t('reportBrowser.year'), type: 'select', allLabel: t('reportBrowser.select'), options: [] },
    ],
    helpIntro: t('reportBrowser.otaHelp1'),
  },
  'performance-analysis': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.performanceHelp1'),
  },
  'revenue-analysis': {
    dateKey: 'from',
    fields: [
      { key: 'from', label: t('reportBrowser.from'), type: 'date' },
      { key: 'to', label: t('reportBrowser.to'), type: 'date' },
    ],
    helpIntro: t('reportBrowser.revenueAnalysisHelp1'),
  },

  /* ── Back Office reports (misc, date-range based) ── */
  'advance-deposit-ledger': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'ageing-debtors-detail': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'ageing-debtors-summary': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'cashier-sales': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }, { key: 'user', label: t('reportBrowser.user'), type: 'select', allLabel: t('reportBrowser.select'), options: [] }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'city-ledger-detail': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'city-ledger-summary': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'complementary-room': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'daily-receipt-detail': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.receiptFrom'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }, { key: 'receivedBy', label: t('reportBrowser.receivedBy'), type: 'select', allLabel: t('reportBrowser.select'), options: [] }, { key: 'paymentMethod', label: t('reportBrowser.paymentMethod'), type: 'select', allLabel: t('reportBrowser.select'), options: [] }, { key: 'currency', label: t('reportBrowser.currency'), type: 'select', allLabel: t('reportBrowser.select'), options: [] }, { key: 'paymentFor', label: t('reportBrowser.paymentFor'), type: 'select', allLabel: t('reportBrowser.select'), options: [] }], helpIntro: t('reportBrowser.dailyReceiptHelp1') },
  'daily-receipt-summary': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.paymentFrom'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }, { key: 'user', label: t('reportBrowser.user'), type: 'select', allLabel: t('reportBrowser.select'), options: [] }, { key: 'paymentFor', label: t('reportBrowser.paymentFor'), type: 'select', allLabel: t('reportBrowser.select'), options: [] }], helpIntro: t('reportBrowser.dailyReceiptHelp1') },
  'daily-refund': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'detail-discount': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'detail-revenue': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'expense-voucher': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'folio-list': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'guest-ledger': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'housekeeping-summary': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'house-status': { dateKey: 'businessDate', fields: [{ key: 'businessDate', label: t('reportBrowser.asOnDate'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'maintenance-block': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'manager-report': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'meal-plan': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'meal-planner': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'owner-statement': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'rate-card': { dateKey: 'businessDate', fields: [{ key: 'businessDate', label: t('reportBrowser.asOnDate'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'revenue-by-rate-type': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'revenue-by-room-type': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'room-typewise-daily-revenue': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'transaction-detail': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.transactionDetailHelp1') },
  'travel-agent-commission-detail': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'travel-agent-commission-summary': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'weekly-manager': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'weekly-meal-plan': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'work-order-list': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.backDateRangeHelp') },
  'credit-card-process': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.processFrom'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }, { key: 'type', label: t('reportBrowser.type'), type: 'select', allLabel: t('reportBrowser.typeAll'), options: [] }], helpIntro: t('reportBrowser.creditCardHelp1') },
  'daily-extra-charge': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.transactionDate'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }, { key: 'receivedBy', label: t('reportBrowser.receivedBy'), type: 'select', allLabel: t('reportBrowser.select'), options: [] }, { key: 'extraCharge', label: t('reportBrowser.extraCharge'), type: 'select', allLabel: t('reportBrowser.select'), options: [] }, { key: 'room', label: t('reportBrowser.room'), type: 'select', allLabel: t('reportBrowser.select'), options: [] }], helpIntro: t('reportBrowser.dailyExtraChargeHelp1') },
  'graphs-and-charts': { dateKey: 'from', fields: [{ key: 'from', label: t('reportBrowser.from'), type: 'date' }, { key: 'to', label: t('reportBrowser.to'), type: 'date' }], helpIntro: t('reportBrowser.graphsHelp1') },
}

const defaultField = { key: 'businessDate', label: t('reportBrowser.asOnDate'), type: 'date' }

function reportHasConfig(key) {
  return !!REPORTS[key]
}

/* ── State ── */
const businessDate = ref(new Date().toISOString().slice(0, 10))
const currency = ref('TZS')
const report = ref(null)
const loading = ref(false)
const saving = ref(false)
const exporting = ref(false)
const error = ref('')

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

const money = (v) => {
  const num = Number(v || 0)
  const symbol = currency.value === 'USD' ? '$' : currency.value === 'EUR' ? '€' : 'TSh '
  return `${symbol} ${num.toLocaleString('en', { maximumFractionDigits: 2 })}`
}

function prettyDate(iso) {
  if (!iso) return '—'
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

function selectReport(key) {
  activeReport.value = key
  if (reportHasConfig(key)) {
    if (!(activeConfig.value?.dateKey in filterValues)) initFilters(key)
    runReport()
  }
}

function initFilters(key) {
  const cfg = REPORTS[key] || { fields: [defaultField] }
  for (const f of cfg.fields) {
    if (!(f.key in filterValues)) {
      if (f.type === 'date') filterValues[f.key] = todayIso()
      else filterValues[f.key] = ''
    }
  }
}

function resetFilters() {
  for (const key of Object.keys(filterValues)) delete filterValues[key]
  initFilters(activeReport.value)
  runReport()
}

async function runReport() {
  initFilters(activeReport.value)
  if (activeReport.value === 'night-audit') {
    loadNightAudit()
  } else if (activeReport.value === 'guest-list') {
    loadGuestList()
  } else {
    report.value = null
  }
}

async function loadGuestList() {
  loading.value = true
  error.value = ''
  try {
    const res = await guestReportApi.guestList({
      stay_date: filterValues.stayDate || undefined,
      status: filterValues.reservationStatus || undefined,
    })
    report.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

async function loadNightAudit() {
  loading.value = true
  error.value = ''
  try {
    const res = await nightAuditApi.report({ date: filterValues.businessDate || businessDate.value })
    report.value = res.data.report
    report.value.closed = res.data.closed
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

async function closeDay() {
  if (!window.confirm(t('nightAudit.closeConfirm'))) return
  saving.value = true
  error.value = ''
  try {
    await nightAuditApi.close({ date: filterValues.businessDate || businessDate.value })
    await loadNightAudit()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    saving.value = false
  }
}

function printPaper() {
  window.print()
}

async function exportCsv() {
  exporting.value = true
  try {
    if (activeReport.value === 'night-audit' && report.value) {
      const rows = [
        { section: 'Revenue', item: t('nightAudit.rooms'), value: report.value.revenue.rooms },
        { section: 'Revenue', item: t('nightAudit.fnb'), value: report.value.revenue.fnb },
        { section: 'Revenue', item: t('nightAudit.laundry'), value: report.value.revenue.laundry },
        { section: 'Revenue', item: t('nightAudit.funGames'), value: report.value.revenue.fun_games },
        { section: 'Revenue', item: t('nightAudit.totalRevenue'), value: report.value.revenue.total },
        ...Object.entries(report.value.collections.by_method).map(([m, v]) => ({
          section: 'Collections',
          item: m.replace('_', ' '),
          value: v,
        })),
        { section: 'Collections', item: t('nightAudit.totalCollected'), value: report.value.collections.total },
      ]
      exportCSV('night-audit', rows, [
        { key: 'section', label: 'Section' },
        { key: 'item', label: 'Item' },
        { key: 'value', label: 'Value' },
      ])
    } else if (activeReport.value === 'guest-list' && report.value) {
      const cols = [
        { key: 'guest_name', label: t('reportBrowser.guestName') },
        { key: 'room', label: t('reportBrowser.room') },
        { key: 'arrival', label: t('reportBrowser.arrival') },
        { key: 'departure', label: t('reportBrowser.departure') },
        { key: 'pax', label: t('reportBrowser.pax') },
        { key: 'rate_type', label: t('reportBrowser.rateType') },
        { key: 'balance', label: t('reportBrowser.balance') },
      ]
      exportCSV('guest-list', report.value.rows || [], cols)
    }
  } finally {
    exporting.value = false
  }
}

function onSearch(term) {
  // Future: filter the report tree by label.
  void term
}

onMounted(() => {
  initFilters('night-audit')
  loadNightAudit()
})
</script>

<style scoped>
/* Toolbar: mirrors the reference filter row. */
.rb-toolbar {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: flex-end;
  background: #fff;
  padding: 12px 14px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(16, 42, 67, 0.12);
}
.rb-toolbar-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 130px;
}
.rb-toolbar-field label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.rb-toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.rb-input {
  padding: 7px 10px;
  border: 1px solid #cdd6e2;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  color: #1e293b;
}
.rb-select {
  min-width: 120px;
  cursor: pointer;
}
.rb-template {
  min-width: 140px;
}
.rb-btn {
  padding: 7px 14px;
  border: 1px solid var(--mrk-blue, #005eb8);
  background: var(--mrk-blue, #005eb8);
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rb-btn-ghost {
  background: #fff;
  color: var(--mrk-blue, #005eb8);
}
.rb-btn-primary {
  margin-top: 14px;
}
.rb-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Paper content. */
.rb-loading,
.rb-error {
  padding: 24px;
  text-align: center;
  color: #64748b;
}
.rb-error {
  color: #dc2626;
}
.rb-report-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.rb-report-head h2 {
  margin: 0;
  font-size: 18px;
  color: var(--mrk-dark, #062a52);
}
.rb-count {
  color: #64748b;
  font-size: 12px;
  margin: 0 0 10px;
}
.rb-empty {
  text-align: center;
  color: #94a3b8;
  padding: 20px;
}
.rb-date {
  color: #64748b;
  font-size: 13px;
}
.rb-closed {
  background: #dcfce7;
  color: #166534;
  font-weight: 600;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
}
.rb-numcols {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.rb-report-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #f7fafd;
  border: 1px solid #e6ebf2;
  padding: 10px 14px;
  border-radius: 8px;
}
.rb-report-row-label {
  font-size: 11px;
  color: #64748b;
}
.rb-report-row strong {
  font-size: 17px;
  color: var(--mrk-dark, #062a52);
}
.rb-section-title {
  margin: 20px 0 8px;
  font-size: 14px;
  color: var(--mrk-blue, #005eb8);
  display: flex;
  align-items: center;
  gap: 8px;
}
.rb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.rb-table th {
  text-align: left;
  padding: 8px 10px;
  background: var(--mrk-pale, #e8f1fa);
  color: var(--mrk-dark, #062a52);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border: 1px solid #dbe4ef;
}
.rb-table td {
  padding: 8px 10px;
  border: 1px solid #e6ebf2;
}
.rb-table .num,
.rb-table th.num {
  text-align: right;
}
.rb-total td {
  font-weight: 700;
  background: #f7fafd;
  color: var(--mrk-dark, #062a52);
}
.text-red {
  color: #dc2626 !important;
}
.text-green {
  color: #16a34a !important;
}
.capitalize {
  text-transform: capitalize;
}

/* Help guide accordion (reference UI). */
.rb-help {
  margin-top: 18px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: #fbfcfe;
}
.rb-help summary {
  cursor: pointer;
  padding: 10px 14px;
  font-weight: 600;
  font-size: 13px;
  color: var(--mrk-blue, #005eb8);
  display: flex;
  align-items: center;
  gap: 8px;
  list-style: none;
  user-select: none;
}
.rb-help summary::-webkit-details-marker {
  display: none;
}
.rb-help-body {
  padding: 0 14px 14px;
  font-size: 13px;
  color: #475569;
  line-height: 1.5;
}
.rb-help-body h4 {
  margin: 12px 0 4px;
  font-size: 13px;
  color: var(--mrk-dark, #062a52);
  display: flex;
  align-items: center;
  gap: 6px;
}
.rb-help-body h4 i {
  color: var(--mrk-blue, #005eb8);
}
.rb-help-body ul {
  margin: 6px 0 0;
  padding-left: 18px;
}
.rb-help-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 6px;
  font-size: 12.5px;
}
.rb-help-table td {
  border: 1px solid #e6ebf2;
  padding: 6px 8px;
  vertical-align: top;
}
.rb-help-table td:first-child {
  font-weight: 600;
  width: 180px;
  color: var(--mrk-dark, #062a52);
}

/* Placeholder for unwired reports. */
.rb-placeholder {
  text-align: center;
  padding: 60px 20px;
  color: #94a3b8;
}
.rb-placeholder-icon {
  font-size: 42px;
  margin-bottom: 12px;
  opacity: 0.5;
}
.rb-placeholder h3 {
  color: #64748b;
  margin: 0 0 6px;
}

@media print {
  .rb-tree,
  .rb-header,
  .rb-toolbar {
    display: none !important;
  }
  .rb-content {
    padding: 0;
    overflow: visible;
  }
  .rb-paper {
    box-shadow: none;
    border-radius: 0;
    padding: 0;
  }
}
</style>
