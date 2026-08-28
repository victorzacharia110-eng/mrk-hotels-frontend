<!--
  Channel Logs page (route: /app/distribution/channel-logs).

  Lists every channel distribution change: which channel (source) the change
  touched, the business date it takes effect from, the request/process
  timestamps (displayed in East Africa Time), the new value, the acting user
  and the outcome. The toolbar's "Auto Stopsell" button opens the same
  slide-in drawer the Distribution accordion exposes.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('distribution.title') }}</h1>
        <p class="muted">{{ $t('distribution.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <button class="btn btn-primary" :disabled="loading" @click="openStopsell">
          <i class="fas fa-hand"></i> {{ $t('distribution.autoStopsell') }}
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filters -->
    <div class="card filter-card">
      <div class="filter-row">
        <div class="form-group">
          <label>{{ $t('distribution.source') }}</label>
          <select v-model="source" class="input" @change="fetchPage(1)">
            <option value="">{{ $t('distribution.allSources') }}</option>
            <option v-for="s in sources" :key="s.key" :value="s.key">{{ s.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('reportBrowser.from') }}</label>
          <input v-model="from" type="date" class="input" @change="debouncedLoad" />
        </div>
        <div class="form-group">
          <label>{{ $t('reportBrowser.to') }}</label>
          <input v-model="to" type="date" class="input" @change="debouncedLoad" />
        </div>
        <div class="form-group grow">
          <label>{{ $t('distribution.search') }}</label>
          <input v-model="search" type="text" class="input" :placeholder="t('distribution.searchPlaceholder')" @input="debouncedLoad" />
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('common.loading') }}</div>

    <div class="card" style="padding: 20px;">
      <div v-if="!loading && !logs.length" class="muted" style="text-align: center; padding: 24px;">
        {{ $t('distribution.noData') }}
      </div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>{{ $t('distribution.source') }}</th>
            <th>{{ $t('distribution.forDate') }}</th>
            <th>{{ $t('distribution.requestedAt') }}</th>
            <th>{{ $t('distribution.processedAt') }}</th>
            <th>{{ $t('distribution.updatedValue') }}</th>
            <th>{{ $t('distribution.user') }}</th>
            <th>{{ $t('distribution.status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.log_id">
            <td><span class="source-badge">{{ sourceName(log.source) }}</span></td>
            <td>{{ log.for_date || '—' }}</td>
            <td>{{ fmtEAT(log.requested_at) }}</td>
            <td>{{ fmtEAT(log.processed_at) }}</td>
            <td>{{ log.updated_value || '—' }}</td>
            <td>{{ log.user_name || '—' }}</td>
            <td>
              <span class="status-badge" :class="`status-badge--${String(log.status || '').toLowerCase()}`">
                {{ log.status || '—' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="lastPage > 1" class="pager">
        <button class="btn btn-secondary" :disabled="currentPage <= 1 || loading" @click="fetchPage(currentPage - 1)">
          <i class="fas fa-chevron-left"></i> {{ $t('common.previous') }}
        </button>
        <span class="pager-count">{{ $t('distribution.page', { page: currentPage, total: lastPage }) }}</span>
        <button class="btn btn-secondary" :disabled="currentPage >= lastPage || loading" @click="fetchPage(currentPage + 1)">
          {{ $t('common.next') }} <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>

    <StopSellManager />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { distributionApi } from '@/api'
import { useDistribution } from '@/composables/useDistribution'
import StopSellManager from '@/components/distribution/StopSellManager.vue'

const { t } = useI18n()
const { openStopsell } = useDistribution()

const logs = ref([])
const sources = ref([])
const source = ref('')
const from = ref(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
const to = ref(new Date().toISOString().slice(0, 10))
const search = ref('')
const loading = ref(false)
const error = ref('')
const currentPage = ref(1)
const lastPage = ref(1)

const sourceNames = computed(() => {
  const map = {}
  for (const s of sources.value) map[s.key] = s.name
  return map
})

/** Friendly name for a channel key (the hotel's list, then the global names, then the key). */
function sourceName(key) {
  if (sourceNames.value[key]) return sourceNames.value[key]
  const localized = t(`distribution.sources.${key}`)
  return localized === `distribution.sources.${key}` ? key : localized
}

const fmtEAT = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Africa/Dar_es_Salaam',
  })
}

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchPage(1), 300)
}

async function loadSources() {
  try {
    const res = await distributionApi.getStopSellSchedules()
    sources.value = res.data.sources || []
  } catch {
    sources.value = []
  }
}

async function fetchPage(page) {
  loading.value = true
  error.value = ''
  try {
    const params = { per_page: 15, page }
    if (from.value) params.from = from.value
    if (to.value) params.to = to.value
    if (source.value) params.source = source.value
    if (search.value.trim()) params.search = search.value.trim()
    const res = await distributionApi.getLogs(params)
    logs.value = res.data.logs || []
    currentPage.value = res.data.current_page || 1
    lastPage.value = res.data.last_page || 1
  } catch (err) {
    error.value = err.response?.data?.message || t('distribution.loadError')
    logs.value = []
  } finally {
    loading.value = false
  }
}

function load() {
  fetchPage(currentPage.value)
}

watch([from, to], () => fetchPage(1))

onMounted(async () => {
  await loadSources()
  await fetchPage(1)
})
</script>

<style scoped>
.dashboard-page { padding: 32px 20px; }
.page-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
.page-head h1 { font-size: 28px; font-weight: 800; }
.muted { color: #757575; font-size: 12px; margin-top: 2px; }
.filter-card { padding: 16px 20px; margin-bottom: 16px; }
.filter-row { display: flex; align-items: end; gap: 16px; }
.filter-row .grow { flex: 1; }
.source-badge {
  display: inline-flex;
  padding: 4px 10px;
  background: #eef4ff;
  color: #005EB8;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.status-badge {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: #f1f5f9;
  color: #475569;
}
.status-badge--completed { background: #e7f8ee; color: #177a3b; }
.status-badge--pending { background: #fff4e5; color: #b45309; }
.status-badge--failed { background: #fdeaea; color: #b91c1c; }
.pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
.pager-count { font-size: 13px; color: #64748b; }
@media (max-width: 768px) {
  .dashboard-page { padding: 20px 16px; }
  .page-head { flex-direction: column; align-items: flex-start; }
  .filter-row { flex-direction: column; align-items: stretch; }
}
</style>