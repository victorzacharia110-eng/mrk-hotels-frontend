<!--
  Night Audit Log page (route: /app/night-audit/logs, name: hotel-night-audit-logs).
  Records every night-audit action: day closes and inserted transactions, with
  the acting user, their IP, and the Old/New business-date snapshots.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('nightAudit.logTitle') }}</h1>
        <p class="muted">{{ $t('nightAudit.logSubtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Date range filter -->
    <div class="card" style="padding: 16px 20px; margin-bottom: 16px;">
      <div class="filter-row">
        <div class="form-group">
          <label>{{ $t('reportBrowser.from') }}</label>
          <input v-model="from" type="date" class="input" @change="debouncedLoad" />
        </div>
        <div class="form-group">
          <label>{{ $t('reportBrowser.to') }}</label>
          <input v-model="to" type="date" class="input" @change="debouncedLoad" />
        </div>
        <div class="form-group grow">
          <label>{{ $t('nightAudit.logSearch') }}</label>
          <input v-model="search" type="text" class="input" :placeholder="t('nightAudit.logSearchPlaceholder')" @input="debouncedLoad" />
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('common.loading') }}</div>

    <div class="card" style="padding: 20px;">
      <div v-if="!loading && !logs.length" class="muted" style="text-align: center; padding: 24px;">
        {{ $t('nightAudit.noLogs') }}
      </div>
      <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th>{{ $t('nightAudit.dateTime') }}</th>
            <th>{{ $t('nightAudit.logAction') }}</th>
            <th>{{ $t('nightAudit.logUser') }}</th>
            <th>{{ $t('nightAudit.logRole') }}</th>
            <th>{{ $t('nightAudit.logIp') }}</th>
            <th>{{ $t('nightAudit.oldDate') }}</th>
            <th>{{ $t('nightAudit.newDate') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.log_id">
            <td>{{ fmtDateTime(log.created_at) }}</td>
            <td>
              <span class="action-badge"><i class="fas fa-moon"></i> {{ log.action }}</span>
              <span v-if="log.details" class="action-detail">{{ log.details }}</span>
            </td>
            <td>{{ log.user || '—' }}</td>
            <td>{{ log.role || '—' }}</td>
            <td>{{ log.ip || '—' }}</td>
            <td>{{ log.old_date || '—' }}</td>
            <td>{{ log.new_date || '—' }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { nightAuditApi } from '@/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const from = ref(new Date(new Date().setDate(new Date().getDate() - 6)).toISOString().slice(0, 10))
const to = ref(new Date().toISOString().slice(0, 10))
const search = ref('')
const logs = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 300)
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { from: from.value, to: to.value }
    if (search.value.trim()) params.search = search.value.trim()
    const res = await nightAuditApi.logs(params)
    logs.value = res.data.logs || []
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
    logs.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([from, to], load)
</script>

<style scoped>
.dashboard-page { padding: 32px 20px; }
.page-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
.page-head h1 { font-size: 28px; font-weight: 800; }
.muted { color: #757575; font-size: 12px; margin-top: 2px; }
.filter-row { display: flex; align-items: end; gap: 16px; }
.filter-row .grow { flex: 1; }
.action-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: #eef4ff; color: #005EB8; border-radius: 999px; font-size: 12px; font-weight: 600; }
.action-detail { margin-left: 8px; font-size: 12px; color: #64748b; text-transform: capitalize; }
.table-scroll .table { min-width: 780px; }
@media (max-width: 768px) {
  .dashboard-page { padding: 20px 16px; }
  .page-head { flex-direction: column; align-items: flex-start; }
  .filter-row { flex-direction: column; align-items: stretch; }
}
</style>
