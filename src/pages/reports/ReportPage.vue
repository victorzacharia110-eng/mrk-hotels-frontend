<!--
  Reports page (route: /app/reports, name: hotel-reports).
  Hotel business reports: an overview tab (occupancy, revenue and room status
  over a date range) plus a lazy-loaded, filterable audit log tab.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('reports.title') }}</h1>
        <p class="muted">{{ $t('reports.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="reload"><i class="fas fa-rotate"></i> {{ $t('common.refresh')
          }}</button>
      </div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Tab switcher between the overview and audit-log views -->
    <div class="tabs">
      <button v-for="item in tabs" :key="item.key" class="tab-btn" :class="{ active: activeTab === item.key }"
        @click="switchTab(item.key)">
        <i :class="item.icon"></i> {{ $t(item.label) }}
      </button>
    </div>

    <!-- Overview tab: date range filters and report dashboards -->
    <template v-if="activeTab === 'overview'">
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('common.from') }}</label>
          <input v-model="from" type="date" class="input" @change="loadReports" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.to') }}</label>
          <input v-model="to" type="date" class="input" @change="loadReports" />
        </div>
        <div class="form-group">
          <label>&nbsp;</label>
          <button class="btn btn-secondary" @click="setThisWeek"><i class="fas fa-calendar-week"></i> {{
            $t('reports.thisWeek') }}</button>
        </div>
        <div class="form-group">
          <label>&nbsp;</label>
          <button class="btn btn-secondary" @click="setThisMonth"><i class="fas fa-calendar-days"></i> {{
            $t('reports.thisMonth') }}</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('reports.loading') }}</div>

    <template v-else>
      <!-- KPI summary cards for the selected period -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">{{ $t('reports.occupancyAvg') }}</span>
          <span class="stat-value">{{ avgOccupancy }}%</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">{{ $t('reports.revenuePeriod') }}</span>
          <span class="stat-value">TZS {{ revenue.total ? Number(revenue.total).toLocaleString() : 0 }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">{{ $t('reports.totalRooms') }}</span>
          <span class="stat-value">{{ roomStatus.total }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">{{ $t('reports.revenueDays') }}</span>
          <span class="stat-value">{{ revenue.daily?.length || 0 }}</span>
        </div>
      </div>

      <!-- Room status breakdown plus revenue by payment method, side by side -->
      <div class="dash-grid">
        <div class="card dash-section">
          <div class="section-header-row">
            <h2><i class="fas fa-bed"></i> {{ $t('reports.roomStatus') }}</h2>
          </div>
          <div class="room-status-grid">
            <div v-for="(label, key) in ROOM_STATUS_LABELS" :key="key" class="room-status-item">
              <span class="room-status-dot" :class="key"></span>
              <span class="room-status-label">{{ label }}</span>
              <span class="room-status-value">{{ roomStatus.by_status?.[key] ?? 0 }}</span>
            </div>
          </div>
          <div v-if="roomStatus.by_type" class="type-breakdown">
            <h3>{{ $t('reports.byRoomType') }}</h3>
            <div class="type-row" v-for="(count, type) in roomStatus.by_type" :key="type">
              <span class="capitalize">{{ type }}</span>
              <div class="bar">
                <div class="bar-fill" :style="{ width: typeBar(type) + '%' }"></div>
              </div>
              <span>{{ count }}</span>
            </div>
          </div>
        </div>

        <div class="card dash-section">
          <div class="section-header-row">
            <h2><i class="fas fa-chart-pie"></i> {{ $t('reports.revenueByMethod') }}</h2>
          </div>
          <div v-if="revenue.by_method && Object.keys(revenue.by_method).length" class="method-list">
            <div v-for="(amount, method) in revenue.by_method" :key="method" class="method-row">
              <span class="capitalize">{{ method.replace('_', ' ') }}</span>
              <span class="price">TZS {{ Number(amount).toLocaleString() }}</span>
            </div>
          </div>
          <div v-else class="muted">{{ $t('reports.noRevenue') }}</div>
        </div>
      </div>

      <!-- Daily occupancy rendered as a simple column chart -->
      <div class="card dash-section">
        <div class="section-header-row">
          <h2><i class="fas fa-chart-column"></i> {{ $t('reports.occupancyPerDay') }}</h2>
        </div>
        <div v-if="occupancy.length" class="occupancy-chart">
          <div v-for="row in occupancy" :key="row.date" class="occ-column">
            <div class="occ-bar-wrap">
              <div class="occ-bar" :style="{ height: Math.min(100, Number(row.occupancy_rate)) + '%' }"
                :title="row.date"></div>
            </div>
            <span class="occ-label">{{ shortDate(row.date) }}</span>
            <span class="occ-value">{{ row.occupancy_rate }}%</span>
          </div>
        </div>
        <div v-else class="muted">{{ $t('reports.noOccupancyData') }}</div>
      </div>
    </template>
    </template>

    <!-- Audit tab: filterable audit log table with pagination -->
    <template v-else>
      <div class="card filter-bar">
        <div class="filter-grid audit-filters">
          <div class="form-group">
            <label>{{ $t('reports.auditAction') }}</label>
            <select v-model="auditFilters.action" class="input" @change="loadAuditLogs()">
              <option value="">{{ $t('reports.auditAllActions') }}</option>
              <option v-for="a in AUDIT_ACTIONS" :key="a" :value="a" class="capitalize">{{ a }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('common.from') }}</label>
            <input v-model="auditFilters.from" type="date" class="input" @change="loadAuditLogs()" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.to') }}</label>
            <input v-model="auditFilters.to" type="date" class="input" @change="loadAuditLogs()" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.search') }}</label>
            <input v-model="auditFilters.search" type="text" class="input"
              :placeholder="$t('reports.auditSearchPlaceholder')" @keyup.enter="loadAuditLogs()" />
          </div>
          <div class="filter-actions">
            <button class="btn btn-secondary btn-sm" @click="loadAuditLogs()">
              <i class="fas fa-magnifying-glass"></i> {{ $t('common.search') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="auditLoading" class="alert alert-info">{{ $t('reports.loading') }}</div>

      <div v-else class="card dash-section">
        <table class="table">
          <thead>
            <tr>
              <th>{{ $t('reports.auditTime') }}</th>
              <th>{{ $t('reports.auditUser') }}</th>
              <th>{{ $t('reports.auditAction') }}</th>
              <th>{{ $t('reports.auditEntity') }}</th>
              <th>{{ $t('reports.auditIp') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in auditLogs" :key="log.log_id">
              <td class="muted">{{ formatDateTime(log.created_at) }}</td>
              <td>{{ log.user?.full_name || '—' }}</td>
              <td><span class="badge" :class="actionBadge(log.action)">{{ log.action }}</span></td>
              <td>
                <span class="capitalize">{{ log.entity_type || '—' }}</span><span v-if="log.entity_id" class="muted mono"> · {{ log.entity_id.slice(0, 8) }}</span>
              </td>
              <td class="muted">{{ log.ip_address || '—' }}</td>
            </tr>
            <tr v-if="!auditLogs.length">
              <td colspan="5" class="muted">{{ $t('reports.auditEmpty') }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="auditMeta.total > auditMeta.per_page" class="pagination">
          <button class="btn btn-sm btn-secondary" :disabled="!auditMeta.prev_page_url"
            @click="loadAuditLogs(auditMeta.current_page - 1)">{{ $t('common.previous') }}</button>
          <span class="muted">{{ $t('common.pageXOfY', { current: auditMeta.current_page, total: auditMeta.last_page }) }}</span>
          <button class="btn btn-sm btn-secondary" :disabled="!auditMeta.next_page_url"
            @click="loadAuditLogs(auditMeta.current_page + 1)">{{ $t('common.next') }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportApi } from '@/api'

const { t } = useI18n()

// Tab definitions and the currently active tab.
const tabs = [
  { key: 'overview', icon: 'fas fa-chart-line', label: 'reports.tabOverview' },
  { key: 'audit', icon: 'fas fa-clipboard-list', label: 'reports.tabAudit' },
]
const activeTab = ref('overview')

// Mirrors the action enum on the audit_logs table.
const AUDIT_ACTIONS = ['create', 'update', 'delete', 'login', 'logout', 'other']
// Audit log tab state: rows, pagination meta, filters and lazy-load flags.
const auditLogs = ref([])
const auditMeta = ref({ total: 0, per_page: 15, current_page: 1, last_page: 1, prev_page_url: null, next_page_url: null })
const auditFilters = reactive({ action: '', from: '', to: '', search: '' })
const auditLoading = ref(false)
const auditLoaded = ref(false)

/** Switches the active tab, lazy-loading the audit log the first time that tab is opened. */
function switchTab(tab) {
  activeTab.value = tab
  // Lazy-load: only hit the audit endpoint when the tab is first opened.
  if (tab === 'audit' && !auditLoaded.value) loadAuditLogs()
}

/**
 * Fetches a page of audit log entries matching the current audit filters.
 * @param {number} [page=1] - The page of audit logs to request.
 */
async function loadAuditLogs(page = 1) {
  auditLoading.value = true
  error.value = ''
  try {
    const res = await reportApi.auditLogs({
      action: auditFilters.action || undefined,
      from: auditFilters.from || undefined,
      to: auditFilters.to || undefined,
      search: auditFilters.search || undefined,
      page,
    })
    auditLogs.value = res.data.data
    auditMeta.value = res.data
    auditLoaded.value = true
  } catch (err) {
    error.value = err.response?.data?.message || t('reports.auditLoadError')
  } finally {
    auditLoading.value = false
  }
}

/** Formats a timestamp as a localized string, or an em dash when absent. */
function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

/** Returns the CSS badge class for a given audit action. */
function actionBadge(action) {
  const map = {
    create: 'badge-green',
    update: 'badge-yellow',
    delete: 'badge-red',
    login: 'badge-blue',
    logout: 'badge-gray',
  }
  return map[action] || 'badge-gray'
}

// Display labels for each room status bucket in the breakdown grid.
const ROOM_STATUS_LABELS = { total: t('reports.statusTotal'), available: t('reports.statusAvailable'), occupied: t('reports.statusOccupied'), cleaning: t('reports.statusCleaning'), maintenance: t('reports.statusMaintenance'), dirty: t('reports.statusDirty') }

// Overview tab state: loading flags, date range and report datasets.
const loading = ref(false)
const error = ref('')
const from = ref(todayMinus(6))
const to = ref(today())
const occupancy = ref([])
const revenue = ref({})
const roomStatus = ref({})

/** Computes the average occupancy rate across the loaded occupancy rows. */
const avgOccupancy = computed(() => {
  if (!occupancy.value.length) return 0
  const total = occupancy.value.reduce((sum, row) => sum + Number(row.occupancy_rate), 0)
  return Math.round(total / occupancy.value.length)
})

/** Returns today's date as an ISO string (yyyy-mm-dd). */
function today() {
  return new Date().toISOString().slice(0, 10)
}

/** Returns the date `days` days before today as an ISO string. */
function todayMinus(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Formats an ISO date as a short dd/mm label for the chart axis. */
function shortDate(d) {
  const date = new Date(d + 'T00:00:00')
  return `${date.getDate()}/${date.getMonth() + 1}`
}

/** Computes the percentage width of a room-type bar relative to the total room count. */
function typeBar(type) {
  const total = roomStatus.value.by_type?.total || roomStatus.value.total || 1
  const count = Number(roomStatus.value.by_type?.[type] || 0)
  return Math.round((count / total) * 100)
}

/** Sets the date range to the current week (Monday through today) and reloads reports. */
function setThisWeek() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  from.value = d.toISOString().slice(0, 10)
  to.value = today()
  loadReports()
}

/** Sets the date range to the current calendar month and reloads reports. */
function setThisMonth() {
  from.value = new Date().toISOString().slice(0, 8) + '01'
  to.value = today()
  loadReports()
}

/** Fetches the current room status breakdown for the overview tab. */
async function loadRoomStatus() {
  try {
    const res = await reportApi.roomStatus()
    roomStatus.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('reports.failedRoomStatus')
  }
}

/** Loads occupancy and revenue reports for the selected date range in parallel. */
async function loadReports() {
  loading.value = true
  error.value = ''
  try {
    const [occ, rev] = await Promise.all([
      reportApi.occupancy({ from: from.value, to: to.value }),
      reportApi.revenue({ from: from.value, to: to.value }),
    ])
    occupancy.value = occ.data.occupancy || []
    revenue.value = rev.data
  } catch (err) {
    error.value = err.response?.data?.message || t('reports.loadError')
  } finally {
    loading.value = false
  }
}

/** Reloads whichever tab is active (audit log or overview reports). */
function reload() {
  if (activeTab.value === 'audit') {
    loadAuditLogs(auditMeta.value.current_page)
    return
  }
  loadRoomStatus()
  loadReports()
}

onMounted(reload)
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

.head-actions {
  display: flex;
  gap: 10px;
}

.filter-bar {
  margin-bottom: 16px;
  padding: 16px 20px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: 12px;
  align-items: end;
}

.audit-filters {
  grid-template-columns: repeat(4, 1fr) auto;
}

.filter-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 1px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 10px 16px;
  border: 1px solid #e2e2e2;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #555;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-btn.active {
  background: #005EB8;
  border-color: #005EB8;
  color: #fff;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.mono {
  font-family: monospace;
}

.capitalize {
  text-transform: capitalize;
}

.dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.dash-section {
  padding: 24px;
}

.dash-section h2 {
  font-size: 17px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dash-section h2 i {
  color: #005EB8;
}

.section-header-row {
  margin-bottom: 16px;
}

.room-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
}

.room-status-item {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #bbb;
}

.room-status-dot.total {
  background: #6c757d;
}

.room-status-dot.available {
  background: #27ae60;
}

.room-status-dot.occupied {
  background: #005EB8;
}

.room-status-dot.cleaning {
  background: #005EB8;
}

.room-status-dot.maintenance {
  background: #7f8c8d;
}

.room-status-dot.dirty {
  background: #c0392b;
}

.room-status-label {
  font-size: 12px;
  color: #888;
}

.room-status-value {
  font-size: 20px;
  font-weight: 700;
}

.type-breakdown {
  margin-top: 20px;
}

.type-breakdown h3 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #005EB8;
  margin-bottom: 10px;
}

.type-row {
  display: grid;
  grid-template-columns: 120px 1fr 40px;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 13px;
}

.capitalize {
  text-transform: capitalize;
}

.bar {
  background: #f1f1f1;
  border-radius: 4px;
  height: 8px;
  overflow: hidden;
}

.bar-fill {
  background: #005EB8;
  height: 100%;
  border-radius: 4px;
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.method-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
}

.method-row:last-child {
  border-bottom: none;
}

.price {
  font-weight: 700;
  color: #005EB8;
}

.occupancy-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 220px;
  padding-top: 10px;
  overflow-x: auto;
}

.occ-column {
  flex: 1;
  min-width: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  height: 100%;
}

.occ-bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
}

.occ-bar {
  width: 100%;
  min-height: 4px;
  background: linear-gradient(180deg, #005EB8, #005EB8);
  border-radius: 4px 4px 0 0;
}

.occ-label {
  font-size: 10px;
  color: #888;
  white-space: nowrap;
}

.occ-value {
  font-size: 11px;
  font-weight: 600;
  color: #333;
}

.muted {
  color: #888;
  font-size: 13px;
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 20px 16px;
  }

  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }

  .dash-grid {
    grid-template-columns: 1fr;
  }
}
</style>
