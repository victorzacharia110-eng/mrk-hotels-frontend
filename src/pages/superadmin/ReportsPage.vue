<!--
  Superadmin reports page (route: /superadmin/reports, name: superadmin-reports).
  Platform-level reporting hub: KPIs, revenue trend chart and tenant performance table.
  All data sourced from the superadmin dashboard report and the tenant list endpoint.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1><i class="fas fa-chart-bar"></i> {{ $t('superadmin.reportTitle') }}</h1>
        <p class="muted">{{ $t('superadmin.reportSubtitle') }}</p>
      </div>
      <button class="btn btn-secondary" @click="load" :disabled="loading">
        <i class="fas fa-rotate"></i> {{ $t('superadmin.refresh') }}
      </button>
    </div>

    <div v-if="loading && !dash" class="loading-spinner">
      <div class="spinner"></div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <template v-if="dash">
      <!-- ─── Section 1: KPI Cards ─── -->
      <div class="stats-grid">
        <!-- Total Hotels -->
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-hotel"></i></div>
          <div>
            <span class="stat-value">{{ dash.tenants.total }}</span>
            <span class="stat-label">{{ $t('superadmin.totalHotels') }}</span>
            <span class="stat-sub">
              <span class="dot dot-green"></span> {{ dash.tenants.active }} {{ $t('superadmin.active') }}
              <span class="dot dot-yellow"></span> {{ dash.tenants.pending_approvals }} {{ $t('superadmin.pending') }}
              <span class="dot dot-red"></span> {{ dash.tenants.suspended }} {{ $t('superadmin.suspended') }}
            </span>
          </div>
        </div>

        <!-- MRR / ARR -->
        <div class="stat-card">
          <div class="stat-icon mrr"><i class="fas fa-money-bill-wave"></i></div>
          <div>
            <span class="stat-value">{{ currency }} {{ formatNum(dash.saas?.mrr) }}</span>
            <span class="stat-label">{{ $t('superadmin.mrr') }}</span>
            <span class="stat-sub">
              {{ $t('superadmin.arrLabel') }} {{ currency }} {{ formatNum(dash.saas?.arr) }}
            </span>
          </div>
        </div>

        <!-- Total Staff -->
        <div class="stat-card">
          <div class="stat-icon staff"><i class="fas fa-users"></i></div>
          <div>
            <span class="stat-value">{{ formatNum(dash.users_total) }}</span>
            <span class="stat-label">{{ $t('superadmin.totalStaff') }}</span>
          </div>
        </div>

        <!-- Total Rooms -->
        <div class="stat-card">
          <div class="stat-icon rooms"><i class="fas fa-door-open"></i></div>
          <div>
            <span class="stat-value">{{ formatNum(dash.rooms_total) }}</span>
            <span class="stat-label">{{ $t('superadmin.totalRooms') }}</span>
          </div>
        </div>

        <!-- Trials -->
        <div class="stat-card">
          <div class="stat-icon trials"><i class="fas fa-hourglass-half"></i></div>
          <div>
            <span class="stat-value">{{ dash.saas?.active_trials ?? 0 }}</span>
            <span class="stat-label">{{ $t('superadmin.activeTrials') }}</span>
            <span class="stat-sub warn" v-if="dash.saas?.trials_expiring_7_days">
              <i class="fas fa-exclamation-triangle"></i>
              {{ dash.saas.trials_expiring_7_days }} {{ $t('superadmin.expiring7Days') }}
            </span>
          </div>
        </div>

        <!-- Conversion Rate -->
        <div class="stat-card">
          <div class="stat-icon conversion"><i class="fas fa-filter-circle-dollar"></i></div>
          <div>
            <span class="stat-value">{{ dash.saas?.conversion_rate ?? 0 }}%</span>
            <span class="stat-label">{{ $t('superadmin.conversionRate') }}</span>
            <span class="stat-sub">
              {{ dash.saas?.paying_hotels ?? 0 }} {{ $t('superadmin.paying') }} / {{ dash.tenants.total }} {{ $t('superadmin.total') }}
            </span>
          </div>
        </div>
      </div>

      <!-- ─── Section 2: Revenue Trend ─── -->
      <div class="card section-card">
        <h2 class="section-title">
          <i class="fas fa-chart-column"></i> {{ $t('superadmin.gmvTitle') }}
          <span class="badge badge-green" style="margin-left:auto; font-size:12px;">
            {{ currency }} {{ formatNum(dash.revenue_last_30_days) }} {{ $t('superadmin.last30d') }}
          </span>
        </h2>
        <p class="section-hint">{{ $t('superadmin.gmvHint') }}</p>
        <div class="bars" v-if="gmvData.length">
          <div v-for="m in gmvData" :key="m.month" class="bar-row">
            <span class="bar-label">{{ formatMonth(m.month) }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: barWidth(m.total) }"></div>
            </div>
            <span class="bar-value">{{ currency }} {{ formatCompact(m.total) }}</span>
          </div>
        </div>
        <p v-else class="empty-mini"><i class="fas fa-chart-bar"></i> {{ $t('superadmin.noGmvData') }}</p>
      </div>

      <!-- ─── Section 3: Tenant Performance Table ─── -->
      <div class="card section-card">
        <div class="section-title-row">
          <h2 class="section-title">
            <i class="fas fa-table"></i> {{ $t('superadmin.tenantPerformance') }}
          </h2>
          <button class="btn btn-sm btn-secondary" @click="loadTenants" :disabled="loadingTenants">
            <i class="fas fa-rotate"></i> {{ $t('superadmin.refresh') }}
          </button>
        </div>
        <div v-if="loadingTenants" class="alert alert-info">{{ $t('superadmin.loadingTenants') }}</div>
        <div v-else-if="tenants.length" class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ $t('superadmin.tenant') }}</th>
                <th>{{ $t('superadmin.plan') }}</th>
                <th>{{ $t('superadmin.status') }}</th>
                <th>{{ $t('superadmin.staff') }}</th>
                <th>{{ $t('superadmin.rooms') }}</th>
                <th>{{ $t('superadmin.subscription') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tenant in tenants" :key="tenant.tenant_id">
                <td>
                  <router-link
                    :to="{ name: 'superadmin-tenant-detail', params: { id: tenant.tenant_id } }"
                    class="tenant-name"
                  >
                    {{ tenant.hotel_name }}
                  </router-link>
                  <div class="muted">{{ tenant.city || tenant.subdomain }}</div>
                </td>
                <td><span class="plan-pill" :class="'plan-' + tenant.subscription_plan">{{ tenant.subscription_plan }}</span></td>
                <td><span class="badge" :class="statusBadge(tenant.status)">{{ tenant.status }}</span></td>
                <td class="num-cell">{{ tenant.staff_count ?? '-' }}</td>
                <td class="num-cell">{{ tenant.room_count ?? '-' }}</td>
                <td>
                  <span class="muted">{{ tenant.subscription_status || '—' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="empty-mini"><i class="fas fa-hotel"></i> {{ $t('superadmin.noTenantsFound') }}</p>
      </div>

      <!-- ─── Section 4: Expiring Trials ─── -->
      <div class="card section-card" v-if="dash.saas?.trials_expiring?.length">
        <h2 class="section-title">
          <i class="fas fa-hourglass-half"></i> {{ $t('superadmin.trialsExpiringSoon') }}
        </h2>
        <div
          v-for="tenant in dash.saas.trials_expiring"
          :key="tenant.tenant_id"
          class="list-item"
        >
          <div>
            <router-link
              :to="{ name: 'superadmin-tenant-detail', params: { id: tenant.tenant_id } }"
              class="tenant-name"
            >
              {{ tenant.hotel_name }}
            </router-link>
          </div>
          <span class="trial-date">
            <i class="fas fa-calendar"></i>
            {{ new Date(tenant.trial_ends_at).toLocaleDateString() }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { superadminReportApi, tenantApi } from '@/api'

const { t } = useI18n()

const dash = ref(null)
const loading = ref(false)
const error = ref('')

const tenants = ref([])
const loadingTenants = ref(false)

const currency = computed(() => dash.value?.saas?.currency || 'TZS')

const gmvData = computed(() => dash.value?.saas?.monthly_gmv || [])

const maxGmv = computed(() =>
  Math.max(1, ...gmvData.value.map((m) => m.total)),
)

function barWidth(total) {
  return `${Math.max(2, Math.round((total / maxGmv.value) * 100))}%`
}

function formatNum(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString()
}

function formatCompact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

function formatMonth(month) {
  if (!month) return ''
  const d = new Date(month + '-01')
  return d.toLocaleString('en', { month: 'short', year: '2-digit' })
}

function statusBadge(status) {
  const map = { active: 'badge-green', pending: 'badge-yellow', suspended: 'badge-red', cancelled: 'badge-gray' }
  return map[status] || 'badge-gray'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await superadminReportApi.dashboard()
    dash.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.dashboardLoadError')
  } finally {
    loading.value = false
  }
}

async function loadTenants() {
  loadingTenants.value = true
  try {
    const res = await tenantApi.index({ per_page: 100 })
    tenants.value = res.data.data || []
  } catch {
    tenants.value = []
  } finally {
    loadingTenants.value = false
  }
}

onMounted(() => {
  load()
  loadTenants()
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
  margin-bottom: 28px;
}

.page-head h1 {
  font-size: 28px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-head h1 i {
  color: #005eb8;
}

.page-head .muted {
  margin-top: 4px;
  color: #757575;
  font-size: 14px;
}

/* ── KPI Cards ── */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 24px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-width: 0;
}

.stat-card > div:last-child {
  min-width: 0;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: #fef5f5;
  color: #005eb8;
  flex-shrink: 0;
}

.stat-icon.mrr { background: #eafaf1; color: #1e8449; }
.stat-icon.staff { background: #eaf4ff; color: #1f6ea8; }
.stat-icon.rooms { background: #fdf2e9; color: #b9770e; }
.stat-icon.trials { background: #f5f0ff; color: #8e44ad; }
.stat-icon.conversion { background: #fdecea; color: #c0392b; }

.stat-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #333;
  overflow-wrap: anywhere;
}

.stat-label {
  font-size: 13px;
  color: #757575;
  display: block;
}

.stat-sub {
  display: block;
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

.stat-sub.warn {
  color: #b9770e;
}

.stat-sub .dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 2px;
  vertical-align: middle;
}

.dot-green { background: #1e8449; }
.dot-yellow { background: #d4a017; }
.dot-red { background: #c0392b; }

/* ── Section Cards ── */

.section-card {
  padding: 24px;
  margin-bottom: 24px;
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.section-title i {
  color: #005eb8;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title-row .section-title {
  margin-bottom: 0;
}

.section-hint {
  font-size: 12px;
  color: #999;
  margin: -4px 0 16px;
}

/* ── GMV Bar Chart ── */

.bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.bar-label {
  width: 72px;
  color: #757575;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 16px;
  background: #f1f5f9;
  border-radius: 8px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(135deg, #005eb8 0%, #3a9bd5 100%);
  border-radius: 8px;
  min-width: 4px;
  transition: width 0.4s ease;
}

.bar-value {
  width: 90px;
  text-align: right;
  font-weight: 600;
  flex-shrink: 0;
  color: #333;
}

/* ── Tenant Table ── */

.table-wrap {
  overflow-x: auto;
  margin-top: 12px;
}

.muted {
  color: #757575;
  font-size: 12px;
}

.tenant-name {
  color: #005eb8;
  font-weight: 600;
  text-decoration: none;
}

.tenant-name:hover {
  text-decoration: underline;
}

.num-cell {
  text-align: center;
  font-weight: 600;
}

.plan-pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
}

.plan-trial { background: #f5f0ff; color: #8e44ad; }
.plan-basic { background: #eaf4ff; color: #1f6ea8; }
.plan-premium { background: #eafaf1; color: #1e8449; }
.plan-enterprise { background: #fef9e7; color: #b9770e; }

/* ── Expiring Trials List ── */

.list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
}

.list-item:last-child {
  border-bottom: none;
}

.trial-date {
  font-size: 13px;
  color: #b9770e;
  font-weight: 600;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.empty-mini {
  text-align: center;
  padding: 32px 16px;
  color: #757575;
  font-size: 14px;
}

.empty-mini i {
  font-size: 28px;
  color: #ddd;
  margin-bottom: 12px;
  display: block;
}

@media (max-width: 768px) {
  .dashboard-page { padding: 20px 16px; }
  .page-head { flex-direction: column; align-items: flex-start; }
  .stats-grid { grid-template-columns: 1fr; gap: 12px; }
  .stat-card { padding: 16px; gap: 12px; }
  .stat-icon { width: 40px; height: 40px; font-size: 16px; }
  .stat-value { font-size: 18px; }
  .bar-label { width: 56px; font-size: 12px; }
  .bar-value { width: 70px; font-size: 12px; }
}
</style>
