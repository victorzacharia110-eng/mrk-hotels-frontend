<!--
  StaffReportsPage — department-scoped F&B report for floor staff and cashiers.
  Mirrors the Ezee-Solution-style Reports section of the Bar Tender panel: a
  date-filtered view of sales, fast-moving items, shelf stock and the
  pending/accepted requisition feeds for one outlet department. Every figure
  comes from the level-20 staff-dashboard endpoint, so a bartender only ever
  sees the Bar shelf and a waiter the Restaurant one.
-->

<template>
  <div class="reports-page">
    <header class="rp-head">
      <div class="rp-head-row">
        <div>
          <h1><i class="fas fa-chart-line" aria-hidden="true"></i> {{ $t('staffDashboard.reportsTitle') }} · {{ $t(`orderTaker.${department}`) }}</h1>
          <p class="rp-subtitle">{{ $t('staffDashboard.reportsSubtitle') }}</p>
        </div>
        <button type="button" class="rp-print-btn" :disabled="!dashboard" @click="printReport">
          <i class="fas fa-print" aria-hidden="true"></i> {{ $t('staffDashboard.print') }}
        </button>
      </div>

      <div class="rp-controls">
        <div class="dept-toggle" role="group" :aria-label="$t('orderTaker.department')">
          <button type="button" :class="{ active: department === 'restaurant' }"
            :aria-pressed="department === 'restaurant'" @click="switchDepartment('restaurant')">
            <i class="fas fa-utensils" aria-hidden="true"></i> {{ $t('orderTaker.restaurant') }}
          </button>
          <button type="button" :class="{ active: department === 'bar' }"
            :aria-pressed="department === 'bar'" @click="switchDepartment('bar')">
            <i class="fas fa-martini-glass" aria-hidden="true"></i> {{ $t('orderTaker.bar') }}
          </button>
        </div>

        <label class="rp-field">
          <span>{{ $t('staffDashboard.from') }}</span>
          <input v-model="from" type="date" :max="to || undefined" @change="loadReport" />
        </label>
        <label class="rp-field">
          <span>{{ $t('staffDashboard.to') }}</span>
          <input v-model="to" type="date" :min="from || undefined" @change="loadReport" />
        </label>

        <button type="button" class="rp-refresh" :disabled="loading" @click="loadReport">
          <i class="fas fa-rotate" aria-hidden="true"></i> {{ $t('staffDashboard.refresh') }}
        </button>
      </div>
    </header>

    <p v-if="error" class="send-error">{{ error }}</p>
    <p v-else-if="loading" class="cat-loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i></p>

    <template v-else-if="dashboard">
      <section class="rp-section">
        <h2><i class="fas fa-circle-dollar" aria-hidden="true"></i> {{ $t('staffDashboard.salesTitle') }}</h2>
        <div class="rp-kpis">
          <div class="rp-kpi">
            <span class="rk-label">{{ $t('staffDashboard.salesOrders') }}</span>
            <strong>{{ dashboard.sales?.orders ?? 0 }}</strong>
          </div>
          <div class="rp-kpi">
            <span class="rk-label">{{ $t('staffDashboard.salesRevenue') }}</span>
            <strong>TZS {{ money(dashboard.sales?.revenue) }}</strong>
          </div>
          <div class="rp-kpi">
            <span class="rk-label">{{ $t('staffDashboard.salesCovers') }}</span>
            <strong>{{ dashboard.sales?.covers ?? 0 }}</strong>
          </div>
          <div class="rp-kpi">
            <span class="rk-label">{{ $t('staffDashboard.salesAverage') }}</span>
            <strong>TZS {{ money(dashboard.sales?.average) }}</strong>
          </div>
        </div>

        <table v-if="(dashboard.sales?.daily || []).length" class="rp-table">
          <thead>
            <tr>
              <th>{{ $t('staffDashboard.date') }}</th>
              <th>{{ $t('staffDashboard.salesOrders') }}</th>
              <th class="num">{{ $t('staffDashboard.salesRevenue') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in dashboard.sales.daily" :key="row.date">
              <td>{{ row.date }}</td>
              <td>{{ row.orders }}</td>
              <td class="num">TZS {{ money(row.revenue) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="rp-empty">{{ $t('staffDashboard.fastMovingEmpty') }}</p>
      </section>

      <section class="rp-section">
        <h2><i class="fas fa-fire" aria-hidden="true"></i> {{ $t('staffDashboard.fastMovingTitle') }}</h2>
        <table v-if="(dashboard.fast_moving || []).length" class="rp-table">
          <thead>
            <tr>
              <th>{{ $t('staffDashboard.item') }}</th>
              <th class="num">{{ $t('staffDashboard.qty') }}</th>
              <th class="num">{{ $t('staffDashboard.amount') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in dashboard.fast_moving" :key="row.item_name">
              <td>{{ row.item_name }}</td>
              <td class="num">{{ row.qty }}</td>
              <td class="num">TZS {{ money(row.revenue) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="rp-empty">{{ $t('staffDashboard.fastMovingEmpty') }}</p>
      </section>

      <section class="rp-section">
        <h2><i class="fas fa-boxes-stacked" aria-hidden="true"></i> {{ $t('staffDashboard.stockTitle') }}</h2>
        <div class="rp-kpis">
          <div class="rp-kpi">
            <span class="rk-label">{{ $t('staffDashboard.stockItems') }}</span>
            <strong>{{ dashboard.stock?.items ?? 0 }}</strong>
          </div>
          <div class="rp-kpi">
            <span class="rk-label">{{ $t('staffDashboard.stockOnHand') }}</span>
            <strong>{{ dashboard.stock?.on_hand ?? 0 }}</strong>
          </div>
          <div class="rp-kpi">
            <span class="rk-label">{{ $t('staffDashboard.stockValue') }}</span>
            <strong>TZS {{ money(dashboard.stock?.value) }}</strong>
          </div>
          <div class="rp-kpi" :class="{ 'kpi-alert': (dashboard.stock?.low_stock_count ?? 0) > 0 }">
            <span class="rk-label">{{ $t('staffDashboard.lowStockCount') }}</span>
            <strong>{{ dashboard.stock?.low_stock_count ?? 0 }}</strong>
          </div>
        </div>

        <table v-if="(dashboard.stock?.rows || []).length" class="rp-table">
          <thead>
            <tr>
              <th>{{ $t('staffDashboard.item') }}</th>
              <th>{{ $t('staffDashboard.unit') }}</th>
              <th class="num">{{ $t('staffDashboard.qty') }}</th>
              <th class="num">{{ $t('staffDashboard.reorderLevel') }}</th>
              <th class="num">{{ $t('staffDashboard.amount') }}</th>
              <th class="num">{{ $t('staffDashboard.stockValue') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in dashboard.stock.rows" :key="row.item_name" :class="{ 'row-low': row.low }">
              <td>{{ row.item_name }} <span v-if="row.low" class="rp-badge">low</span></td>
              <td>{{ row.unit }}</td>
              <td class="num">{{ row.quantity }}</td>
              <td class="num">{{ row.reorder_level }}</td>
              <td class="num">{{ money(row.unit_cost) }}</td>
              <td class="num">{{ money(row.value) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="rp-empty">{{ $t('staffDashboard.lowStockEmpty') }}</p>
      </section>

      <section class="rp-section">
        <h2><i class="fas fa-file-signature" aria-hidden="true"></i> {{ $t('staffDashboard.requisitionsTitle') }}</h2>
        <div class="rp-reqs">
          <div>
            <h3><i class="fas fa-hourglass-half" aria-hidden="true"></i> {{ $t('staffDashboard.requisitionsPending') }}</h3>
            <ul v-if="dashboard.requisitions?.pending?.list?.length" class="rp-req-list">
              <li v-for="row in dashboard.requisitions.pending.list" :key="row.indent_id">
                <strong>{{ row.indent_number }}</strong>
                <span>{{ row.items }} items · {{ row.requested_by }}</span>
                <small>{{ row.created_at }}</small>
              </li>
            </ul>
            <p v-else class="rp-empty">{{ $t('staffDashboard.requisitionsEmpty') }}</p>
          </div>
          <div>
            <h3><i class="fas fa-check-circle" aria-hidden="true"></i> {{ $t('staffDashboard.requisitionsAccepted') }}</h3>
            <ul v-if="dashboard.requisitions?.accepted?.list?.length" class="rp-req-list">
              <li v-for="row in dashboard.requisitions.accepted.list" :key="row.indent_id">
                <strong>{{ row.indent_number }}</strong>
                <span>{{ row.items }} items · {{ row.requested_by }}</span>
                <small>{{ row.created_at }}</small>
              </li>
            </ul>
            <p v-else class="rp-empty">{{ $t('staffDashboard.requisitionsEmpty') }}</p>
          </div>
        </div>
      </section>
    </template>

    <p v-else class="rp-empty">{{ $t('staffDashboard.loadError') }}</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { reportApi } from '@/api'

const authStore = useAuthStore()

function nowDate() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The department defaults from the staff role (bartenders start on the bar). */
const department = ref(authStore.user?.user_role === 'bartender' ? 'bar' : 'restaurant')
const from = ref(nowDate())
const to = ref(nowDate())
const dashboard = ref(null)
const loading = ref(false)
const error = ref('')

function switchDepartment(dept) {
  if (department.value === dept) return
  department.value = dept
  loadReport()
}

/** Loads the department report for the selected date window. */
async function loadReport() {
  loading.value = true
  error.value = ''
  try {
    const res = await reportApi.staffDashboard({
      department: department.value,
      from: from.value || undefined,
      to: to.value || undefined,
    })
    const data = res.data
    dashboard.value = data && typeof data === 'object' ? data : null
    if (data?.range?.from) from.value = data.range.from
    if (data?.range?.to) to.value = data.range.to
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load the report.'
    dashboard.value = null
  } finally {
    loading.value = false
  }
}

function printReport() {
  window.print()
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

onMounted(loadReport)
</script>

<style scoped>
.reports-page {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rp-head {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rp-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.rp-head h1 {
  font-size: 20px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.rp-subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}

.rp-print-btn,
.rp-refresh {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 600;
  background: #0f766e;
  color: #fff;
  cursor: pointer;
}

.rp-print-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rp-controls {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  flex-wrap: wrap;
}

.dept-toggle {
  display: inline-flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #cbd5e1;
}

.dept-toggle button {
  border: 0;
  background: #fff;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
}

.dept-toggle button + button {
  border-left: 1px solid #e2e8f0;
}

.dept-toggle button.active {
  background: #0f766e;
  color: #fff;
}

.rp-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #64748b;
}

.rp-field input {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  background: #fff;
}

.rp-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rp-section h2 {
  margin: 0;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rp-section h3 {
  margin: 0 0 10px;
  font-size: 13.5px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rp-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.rp-kpi {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rk-label {
  font-size: 12px;
  color: #64748b;
}

.rp-kpi strong {
  font-size: 19px;
}

.rp-kpi.kpi-alert strong {
  color: #b91c1c;
}

.rp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.rp-table th,
.rp-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid #eef2f7;
}

.rp-table th {
  color: #64748b;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.rp-table .num {
  text-align: right;
}

.rp-table tr.row-low td {
  background: #fef2f2;
}

.rp-badge {
  display: inline-block;
  margin-left: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  background: #fee2e2;
  color: #b91c1c;
  border-radius: 4px;
  padding: 2px 6px;
}

.rp-reqs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.rp-req-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rp-req-list li {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rp-req-list span {
  font-size: 12px;
  color: #475569;
}

.rp-req-list small {
  color: #94a3b8;
  font-size: 11px;
}

.rp-empty {
  color: #94a3b8;
  font-size: 13px;
  margin: 0;
}

.cat-loading {
  text-align: center;
  color: #64748b;
  font-size: 20px;
  padding: 24px;
}

.send-error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 13px;
}

@media print {
  .rp-print-btn,
  .rp-refresh,
  .dept-toggle,
  .rp-field {
    display: none !important;
  }

  .reports-page {
    padding: 0;
  }

  .rp-section {
    break-inside: avoid;
    border-color: transparent;
    padding: 8px 0;
  }
}
</style>