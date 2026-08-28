<!--
  Activity Log Report page (route: /app/activity-log-report, name: hotel-activity-log-report).
  Daily/weekly/monthly staff activity summary with CSV download.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('activityLog.title') }}</h1>
        <p class="muted">{{ $t('activityLog.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <button class="btn btn-primary" @click="downloadCsv" :disabled="downloading">
          <i class="fas fa-download"></i>
          {{ downloading ? $t('common.loading') : $t('activityLog.downloadCsv') }}
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filters -->
    <div class="card" style="padding: 16px 20px; margin-bottom: 16px;">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('activityLog.period') }}</label>
          <select v-model="period" class="input" @change="load">
            <option value="daily">{{ $t('activityLog.daily') }}</option>
            <option value="weekly">{{ $t('activityLog.weekly') }}</option>
            <option value="monthly">{{ $t('activityLog.monthly') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('activityLog.from') }}</label>
          <input v-model="from" type="date" class="input" @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('activityLog.to') }}</label>
          <input v-model="to" type="date" class="input" @change="load" />
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('common.loading') }}</div>

    <!-- Summary cards -->
    <template v-else-if="rows.length">
      <div v-for="row in rows" :key="row.period_start" class="card" style="padding: 20px; margin-bottom: 16px;">
        <div class="period-header">
          <h3 style="margin: 0;">
            <i class="fas fa-calendar-day" style="color: var(--mrk-blue);"></i>
            {{ row.period_start }}{{ period !== 'daily' ? ' → ' + row.period_end : '' }}
          </h3>
          <span class="action-count">{{ row.total_actions }} {{ $t('activityLog.actions') }}</span>
        </div>

        <div class="kpi-grid">
          <div class="kpi">
            <span class="kpi-value blue">{{ row.creates }}</span>
            <span class="kpi-label">{{ $t('activityLog.creates') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value amber">{{ row.updates }}</span>
            <span class="kpi-label">{{ $t('activityLog.updates') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value red">{{ row.deletes }}</span>
            <span class="kpi-label">{{ $t('activityLog.deletes') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value green">{{ row.logins }}</span>
            <span class="kpi-label">{{ $t('activityLog.logins') }}</span>
          </div>
          <div class="kpi">
            <span class="kpi-value">{{ row.unique_users }}</span>
            <span class="kpi-label">{{ $t('activityLog.activeStaff') }}</span>
          </div>
        </div>

        <!-- Staff list -->
        <div v-if="row.active_users.length" class="staff-list">
          <span class="staff-label">{{ $t('activityLog.staffInvolved') }}:</span>
          <span v-for="(name, i) in row.active_users" :key="i" class="staff-chip">{{ name }}</span>
        </div>

        <!-- Activity details toggle -->
        <button class="btn btn-sm btn-secondary" style="margin-top: 12px;" @click="toggleDetails(row.period_start)">
          <i class="fas" :class="expanded[row.period_start] ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          {{ $t('activityLog.viewDetails') }}
        </button>

        <div v-if="expanded[row.period_start]" class="activity-details">
          <table class="table" style="margin-top: 12px;">
            <thead>
              <tr>
                <th>{{ $t('activityLog.time') }}</th>
                <th>{{ $t('activityLog.user') }}</th>
                <th>{{ $t('activityLog.role') }}</th>
                <th>{{ $t('activityLog.action') }}</th>
                <th>{{ $t('activityLog.details') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(act, idx) in row.actions" :key="idx">
                <td>{{ act.time }}</td>
                <td>{{ act.user }}</td>
                <td class="capitalize">{{ act.role.replace('_', ' ') }}</td>
                <td>
                  <span class="badge" :class="actionBadge(act.action)">{{ act.action }}</span>
                </td>
                <td>{{ act.details }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-else-if="!loading" class="card" style="padding: 40px; text-align: center;">
      <p class="muted">{{ $t('activityLog.empty') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { activityLogReportApi } from '@/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const period = ref('daily')
const from = ref(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
const to = ref(new Date().toISOString().slice(0, 10))
const rows = ref([])
const loading = ref(false)
const error = ref('')
const expanded = reactive({})
const downloading = ref(false)

function actionBadge(action) {
  const map = { create: 'badge-green', update: 'badge-blue', delete: 'badge-red', login: 'badge-gray', logout: 'badge-gray' }
  return map[action] || 'badge-gray'
}

function toggleDetails(key) {
  expanded[key] = !expanded[key]
}

async function downloadCsv() {
  downloading.value = true
  try {
    // Fetch through axios so the Sanctum bearer token is attached (a plain
    // <a href> cannot send the Authorization header and would get a 401).
    const res = await activityLogReportApi.csv({
      period: period.value,
      from: from.value,
      to: to.value,
    })
    const blob = new Blob([res.data], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const stamp = new Date().toISOString().slice(0, 10)
    link.download = `activity-log-report-${period.value}-${stamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (err) {
    let msg = ''
    if (err.response?.data instanceof Blob) {
      try { msg = JSON.parse(await err.response.data.text()).message } catch {
        // fall back to the generic message below
      }
    }
    error.value = msg || err.response?.data?.message || t('common.loadError')
  } finally {
    downloading.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await activityLogReportApi.index({
      period: period.value,
      from: from.value,
      to: to.value,
    })
    rows.value = res.data.rows || []
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.dashboard-page { padding: 32px 20px; }
.page-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
.page-head h1 { font-size: 28px; font-weight: 800; }
.muted { color: #757575; font-size: 12px; margin-top: 2px; }
.head-actions { display: flex; gap: 10px; }
.filter-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; align-items: end; }
.period-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.action-count { font-size: 13px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; }
.kpi { display: flex; flex-direction: column; gap: 4px; }
.kpi-value { font-size: 22px; font-weight: 800; color: #062A52; }
.kpi-value.blue { color: #005EB8; }
.kpi-value.amber { color: #D97706; }
.kpi-value.red { color: #DC2626; }
.kpi-value.green { color: #16A34A; }
.kpi-label { font-size: 12px; color: #64748b; }
.staff-list { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 12px; }
.staff-label { font-size: 12px; color: #64748b; font-weight: 600; }
.staff-chip { font-size: 11px; padding: 3px 8px; background: #E8F1FA; color: #005EB8; border-radius: 12px; font-weight: 500; }
.capitalize { text-transform: capitalize; }
@media (max-width: 768px) { .dashboard-page { padding: 20px 16px; } .page-head { flex-direction: column; align-items: flex-start; } .filter-grid { grid-template-columns: 1fr; } }
</style>
