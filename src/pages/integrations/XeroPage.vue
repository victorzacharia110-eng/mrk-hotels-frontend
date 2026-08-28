<template>
  <div class="container" style="padding-top: 32px; padding-bottom: 40px">
    <div class="page-head">
      <div>
        <h1>{{ $t('integrations.xero.title') }}</h1>
        <p class="muted">{{ $t('integrations.xero.subtitle') }}</p>
      </div>
    </div>

    <div v-if="pageError" class="alert alert-error">{{ pageError }}</div>
    <div v-if="pageSuccess" class="alert alert-success">{{ pageSuccess }}</div>

    <!-- Connection Settings -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-book"></i> {{ $t('integrations.xero.connection') }}</h2>

      <div class="status-row" style="margin-bottom: 20px">
        <span style="font-weight: 600; margin-right: 10px">{{ $t('integrations.xero.status') }}:</span>
        <span v-if="settings.connected" class="badge badge-green">
          <i class="fas fa-circle" style="font-size: 6px; margin-right: 6px"></i>
          {{ $t('integrations.xero.connected') }}
        </span>
        <span v-else class="badge badge-gray">
          <i class="fas fa-circle" style="font-size: 6px; margin-right: 6px"></i>
          {{ $t('integrations.xero.disconnected') }}
        </span>
      </div>

      <div style="max-width: 520px">
        <!-- Organisation info (shown after connected) -->
        <div v-if="settings.connected && settings.organisation_name" class="form-group">
          <label>{{ $t('integrations.xero.organisation') }}</label>
          <input type="text" class="input" :value="settings.organisation_name" disabled />
        </div>

        <div v-if="settings.connected && settings.xero_tenant_id" class="form-group">
          <label>{{ $t('integrations.xero.tenantId') }}</label>
          <input type="text" class="input" :value="settings.xero_tenant_id" disabled />
        </div>

        <!-- Connect / Test buttons -->
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px">
          <button
            v-if="!settings.connected"
            class="btn btn-primary btn-sm"
            @click="connectToXero"
            :disabled="connecting"
          >
            <i v-if="connecting" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-link"></i>
            {{ $t('integrations.xero.connectXero') }}
          </button>

          <button
            v-if="settings.connected"
            class="btn btn-secondary btn-sm"
            @click="testConnection"
            :disabled="testing"
          >
            <i v-if="testing" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-plug"></i>
            {{ $t('integrations.xero.testConnection') }}
          </button>

          <button
            class="btn btn-primary btn-sm"
            @click="saveSettings"
            :disabled="saving"
          >
            <i v-if="saving" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
            {{ $t('integrations.xero.saveSettings') }}
          </button>

          <button
            v-if="settings.connected"
            class="btn btn-danger btn-sm"
            @click="confirmDisconnect"
            :disabled="disconnecting"
          >
            <i v-if="disconnecting" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-link-slash"></i>
            {{ $t('integrations.xero.disconnect') }}
          </button>
        </div>

        <!-- Sync toggles -->
        <div v-if="settings.connected" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee">
          <label style="font-weight: 600; font-size: 14px; color: #555; display: block; margin-bottom: 12px">
            {{ $t('integrations.xero.syncOptions') }}
          </label>
          <div style="display: flex; flex-direction: column; gap: 10px">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px">
              <input
                v-model="settings.sync_invoices"
                type="checkbox"
                style="width: 18px; height: 18px; accent-color: var(--brand)"
              />
              {{ $t('integrations.xero.syncInvoicesLabel') }}
            </label>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px">
              <input
                v-model="settings.sync_payments"
                type="checkbox"
                style="width: 18px; height: 18px; accent-color: var(--brand)"
              />
              {{ $t('integrations.xero.syncPaymentsLabel') }}
            </label>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px">
              <input
                v-model="settings.sync_coa"
                type="checkbox"
                style="width: 18px; height: 18px; accent-color: var(--brand)"
              />
              {{ $t('integrations.xero.syncCoaLabel') }}
            </label>
          </div>
          <div style="margin-top: 10px; font-size: 12px; color: #999">
            {{ $t('integrations.xero.autoSyncHint') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Sync Actions -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-arrows-rotate"></i> {{ $t('integrations.xero.syncActions') }}</h2>

      <div class="form-group" style="max-width: 520px; margin-bottom: 20px">
        <label style="font-weight: 600; font-size: 14px; color: #555; margin-bottom: 8px; display: block">
          {{ $t('integrations.xero.dateRange') }}
        </label>
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
          <div style="flex: 1; min-width: 150px">
            <label style="font-size: 13px; color: #777; margin-bottom: 4px; display: block">
              {{ $t('integrations.xero.startDate') }}
            </label>
            <input v-model="syncDates.start_date" type="date" class="input" />
          </div>
          <div style="flex: 1; min-width: 150px">
            <label style="font-size: 13px; color: #777; margin-bottom: 4px; display: block">
              {{ $t('integrations.xero.endDate') }}
            </label>
            <input v-model="syncDates.end_date" type="date" class="input" />
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 10px; flex-wrap: wrap">
        <button
          class="btn btn-primary btn-sm"
          @click="syncInvoices"
          :disabled="syncingInvoices"
        >
          <i v-if="syncingInvoices" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-file-invoice"></i>
          {{ $t('integrations.xero.syncInvoices') }}
        </button>

        <button
          class="btn btn-primary btn-sm"
          @click="syncPayments"
          :disabled="syncingPayments"
        >
          <i v-if="syncingPayments" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-money-bill-wave"></i>
          {{ $t('integrations.xero.syncPayments') }}
        </button>

        <button
          class="btn btn-primary btn-sm"
          @click="syncAccounts"
          :disabled="syncingAccounts"
        >
          <i v-if="syncingAccounts" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-list"></i>
          {{ $t('integrations.xero.syncAccounts') }}
        </button>
      </div>

      <div v-if="syncResult" style="margin-top: 12px">
        <div :class="syncResult.success ? 'alert alert-success' : 'alert alert-error'">
          {{ syncResult.message }}
        </div>
      </div>
    </div>

    <!-- Accounting Reports -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-table"></i> {{ $t('integrations.xero.reports') }}</h2>
      <p class="muted" style="margin-top: -10px; margin-bottom: 16px">{{ $t('integrations.xero.reportsSubtitle') }}</p>

      <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 16px">
        <div class="form-group" style="margin-bottom: 0">
          <label style="font-size: 13px; color: #777; margin-bottom: 4px; display: block">
            {{ $t('integrations.xero.startDate') }} <small>({{ $t('integrations.xero.optional') }})</small>
          </label>
          <input v-model="reportDates.from_date" type="date" class="input" />
        </div>
        <div class="form-group" style="margin-bottom: 0">
          <label style="font-size: 13px; color: #777; margin-bottom: 4px; display: block">
            {{ $t('integrations.xero.endDate') }} <small>({{ $t('integrations.xero.optional') }})</small>
          </label>
          <input v-model="reportDates.to_date" type="date" class="input" />
        </div>
        <button class="btn btn-secondary btn-sm" @click="loadReport('aged_receivables')" :disabled="reportLoading">
          <i :class="reportLoading && activeReportKey === 'aged_receivables' ? 'fas fa-spinner fa-spin' : 'fas fa-calendar-minus'"></i>
          {{ $t('integrations.xero.agedReceivables') }}
        </button>
        <button class="btn btn-secondary btn-sm" @click="loadReport('profit_and_loss')" :disabled="reportLoading">
          <i :class="reportLoading && activeReportKey === 'profit_and_loss' ? 'fas fa-spinner fa-spin' : 'fas fa-chart-pie'"></i>
          {{ $t('integrations.xero.profitAndLoss') }}
        </button>
        <button class="btn btn-secondary btn-sm" @click="loadReport('trial_balance')" :disabled="reportLoading">
          <i :class="reportLoading && activeReportKey === 'trial_balance' ? 'fas fa-spinner fa-spin' : 'fas fa-scale-balanced'"></i>
          {{ $t('integrations.xero.trialBalance') }}
        </button>
      </div>

      <div v-if="reportError" class="alert alert-error">{{ reportError }}</div>

      <div v-if="reportLoading" class="loading-spinner" style="padding: 24px">
        <div class="spinner"></div>
      </div>

      <div v-else-if="reportTable.header.length || reportTable.rows.length" class="table-scroll">
        <div v-if="reportTitle" style="font-weight: 700; color: #334155; margin-bottom: 10px">{{ reportTitle }}</div>
        <table class="table">
          <thead v-if="reportTable.header.length">
            <tr>
              <th v-for="(cell, i) in reportTable.header" :key="i">{{ cell }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in reportTable.rows" :key="i" :class="{ 'report-summary': row.isSummary }">
              <td v-if="row.isSection" :colspan="Math.max(reportTable.header.length, 1)" class="report-section">{{ row.title }}</td>
              <td v-else v-for="(cell, j) in row.cells" :key="j">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="muted" style="padding: 20px; text-align: center">
        {{ $t('integrations.xero.loadReport') }}
      </div>
    </div>

    <!-- Sync Logs -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-scroll"></i> {{ $t('integrations.xero.logs') }}</h2>

      <div class="filter-bar" style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap">
        <div class="form-group" style="margin-bottom: 0">
          <select v-model="logFilters.direction" class="select" @change="fetchLogs(1)">
            <option value="">{{ $t('integrations.xero.allDirections') }}</option>
            <option value="inbound">{{ $t('integrations.xero.inbound') }}</option>
            <option value="outbound">{{ $t('integrations.xero.outbound') }}</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0">
          <select v-model="logFilters.status" class="select" @change="fetchLogs(1)">
            <option value="">{{ $t('integrations.xero.allStatuses') }}</option>
            <option value="success">{{ $t('integrations.xero.success') }}</option>
            <option value="failed">{{ $t('integrations.xero.failed') }}</option>
          </select>
        </div>
      </div>

      <div v-if="logsLoading" class="loading-spinner" style="padding: 30px">
        <div class="spinner"></div>
      </div>

      <div v-else-if="logs.data && logs.data.length" class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>{{ $t('integrations.xero.date') }}</th>
              <th>{{ $t('integrations.xero.direction') }}</th>
              <th>{{ $t('integrations.xero.event') }}</th>
              <th>{{ $t('integrations.xero.status') }}</th>
              <th>{{ $t('integrations.xero.duration') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs.data" :key="log.id">
              <td>{{ formatDate(log.created_at) }}</td>
              <td>
                <span
                  class="badge"
                  :class="log.direction === 'inbound' ? 'badge-blue' : 'badge-purple'"
                >
                  {{ log.direction === 'inbound' ? $t('integrations.xero.inbound') : $t('integrations.xero.outbound') }}
                </span>
              </td>
              <td>{{ log.event }}</td>
              <td>
                <span
                  class="badge"
                  :class="log.status === 'success' ? 'badge-green' : 'badge-red'"
                >
                  {{ log.status }}
                </span>
              </td>
              <td>{{ log.duration_ms ? log.duration_ms + 'ms' : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="muted" style="padding: 20px; text-align: center">
        {{ $t('integrations.xero.noLogs') }}
      </div>

      <div
        v-if="logs.last_page && logs.last_page > 1"
        style="display: flex; justify-content: center; gap: 8px; margin-top: 16px"
      >
        <button
          class="btn btn-sm btn-secondary"
          :disabled="logs.current_page <= 1"
          @click="fetchLogs(logs.current_page - 1)"
        >
          <i class="fas fa-chevron-left"></i>
        </button>
        <span style="padding: 8px 12px; font-size: 13px; color: #666">
          {{ $t('integrations.xero.page') }} {{ logs.current_page }} {{ $t('integrations.xero.of') }} {{ logs.last_page }}
        </span>
        <button
          class="btn btn-sm btn-secondary"
          :disabled="logs.current_page >= logs.last_page"
          @click="fetchLogs(logs.current_page + 1)"
        >
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { xeroApi } from '@/api'
import { toast, toastError } from '@/utils/toast'

const pageError = ref('')
const pageSuccess = ref('')
const connecting = ref(false)
const testing = ref(false)
const saving = ref(false)
const disconnecting = ref(false)
const syncingInvoices = ref(false)
const syncingPayments = ref(false)
const syncingAccounts = ref(false)
const syncResult = ref(null)
const logsLoading = ref(false)

const settings = reactive({
  connected: false,
  organisation_name: '',
  xero_tenant_id: '',
  sync_invoices: true,
  sync_payments: true,
  sync_coa: true,
})

const syncDates = reactive({
  start_date: '',
  end_date: '',
})

const reportDates = reactive({
  from_date: '',
  to_date: '',
})

const reportLoading = ref(false)
const reportError = ref('')
const activeReportKey = ref('')
const reportTitle = ref('')
const reportTable = ref({ header: [], rows: [] })

const logFilters = reactive({
  direction: '',
  status: '',
})

const logs = ref({
  data: [],
  current_page: 1,
  last_page: 1,
})

function clearMessages() {
  pageError.value = ''
  pageSuccess.value = ''
}

async function loadSettings() {
  clearMessages()
  try {
    const { data } = await xeroApi.getSettings()
    const s = data.settings || data
    Object.assign(settings, {
      connected: !!(s.enabled && s.xero_tenant_id),
      organisation_name: s.organisation_name || '',
      xero_tenant_id: s.xero_tenant_id || '',
      sync_invoices: s.sync_invoices !== false,
      sync_payments: s.sync_payments !== false,
      sync_coa: s.sync_chart_of_accounts !== false,
    })
  } catch (e) {
    pageError.value = e.response?.data?.message || 'Failed to load settings.'
  }
}

function onOAuthMessage(event) {
  const msg = event.data || {}
  if (msg.type !== 'xero:oauth') return
  window.removeEventListener('message', onOAuthMessage)
  connecting.value = false
  if (msg.success) {
    pageSuccess.value = msg.organisation
      ? `Connected to ${msg.organisation}`
      : 'Connected to Xero.'
    toast(msg.organisation ? `Connected to ${msg.organisation}` : 'Connected to Xero.')
  } else {
    pageError.value = msg.message || 'Xero authorization failed.'
    toastError(msg.message || 'Xero authorization failed.')
  }
  loadSettings()
  fetchLogs()
}

async function connectToXero() {
  clearMessages()
  connecting.value = true
  try {
    const { data } = await xeroApi.getAuthUrl()
    const url = data.url || data.data?.auth_url
    if (!url) throw new Error('Could not build the Xero authorization URL.')

    window.addEventListener('message', onOAuthMessage)

    const win = window.open(url, '_blank', 'width=760,height=800')
    if (!win) {
      window.removeEventListener('message', onOAuthMessage)
      connecting.value = false
      pageError.value = 'Popup blocked. Allow popups for this site and try again.'
      toastError('Popup blocked. Allow popups and try again.')
      return
    }

    pageSuccess.value = 'Xero authorization window opened. Complete the login and authorize the app.'
  } catch (e) {
    connecting.value = false
    window.removeEventListener('message', onOAuthMessage)
    pageError.value = e.response?.data?.message || e.message || 'Failed to get the authorization URL'
    toastError(e.response?.data?.message || 'Failed to get the authorization URL')
  }
}

async function testConnection() {
  clearMessages()
  testing.value = true
  try {
    const { data } = await xeroApi.testConnection()
    if (data && data.success === false) {
      pageError.value = data.message || 'Connection failed'
      toastError(data.message || 'Connection failed')
      return
    }
    pageSuccess.value = data.message || 'Connection successful!'
    toast(data.message || 'Connection successful!')
  } catch (e) {
    pageError.value = e.response?.data?.message || e.message || 'Connection failed'
    toastError(e.response?.data?.message || e.message || 'Connection failed')
  } finally {
    testing.value = false
  }
}

async function saveSettings() {
  clearMessages()
  saving.value = true
  try {
    const { data } = await xeroApi.updateSettings({
      sync_invoices: settings.sync_invoices,
      sync_payments: settings.sync_payments,
      sync_chart_of_accounts: settings.sync_coa,
    })
    const s = data.settings || data
    Object.assign(settings, {
      sync_invoices: s.sync_invoices !== false,
      sync_payments: s.sync_payments !== false,
      sync_coa: s.sync_chart_of_accounts !== false,
    })
    pageSuccess.value = 'Settings saved successfully'
    toast('Settings saved successfully')
  } catch (e) {
    pageError.value = e.response?.data?.message || 'Failed to save settings'
    toastError(e.response?.data?.message || 'Failed to save settings')
  } finally {
    saving.value = false
  }
}

async function confirmDisconnect() {
  if (!window.confirm('Are you sure you want to disconnect from Xero?')) return
  disconnecting.value = true
  clearMessages()
  try {
    await xeroApi.disconnect()
    settings.connected = false
    settings.organisation_name = ''
    settings.xero_tenant_id = ''
    pageSuccess.value = 'Disconnected from Xero'
    toast('Disconnected from Xero')
  } catch (e) {
    pageError.value = e.response?.data?.message || 'Failed to disconnect'
    toastError(e.response?.data?.message || 'Failed to disconnect')
  } finally {
    disconnecting.value = false
  }
}

function syncSuccess(message) {
  return { success: true, message }
}

function syncFailed(message) {
  return { success: false, message }
}

async function syncInvoices() {
  syncResult.value = null
  syncingInvoices.value = true
  try {
    const { data } = await xeroApi.syncInvoices({
      start_date: syncDates.start_date || undefined,
      end_date: syncDates.end_date || undefined,
    })
    const message = `${data.synced ?? 0} invoice(s) synced`
    syncResult.value = syncSuccess(message)
    toast(message)
    fetchLogs()
  } catch (e) {
    const message = e.response?.data?.message || 'Failed to sync invoices'
    syncResult.value = syncFailed(message)
    toastError(message)
  } finally {
    syncingInvoices.value = false
  }
}

async function syncPayments() {
  syncResult.value = null
  syncingPayments.value = true
  try {
    const { data } = await xeroApi.syncPayments({
      start_date: syncDates.start_date || undefined,
      end_date: syncDates.end_date || undefined,
    })
    const message = `${data.synced ?? 0} payment(s) synced`
    syncResult.value = syncSuccess(message)
    toast(message)
    fetchLogs()
  } catch (e) {
    const message = e.response?.data?.message || 'Failed to sync payments'
    syncResult.value = syncFailed(message)
    toastError(message)
  } finally {
    syncingPayments.value = false
  }
}

async function syncAccounts() {
  syncResult.value = null
  syncingAccounts.value = true
  try {
    const { data } = await xeroApi.getAccounts()
    const accounts = data.accounts || []
    const message = `${accounts.length} account(s) fetched`
    syncResult.value = syncSuccess(message)
    toast(message)
  } catch (e) {
    const message = e.response?.data?.message || 'Failed to fetch the chart of accounts'
    syncResult.value = syncFailed(message)
    toastError(message)
  } finally {
    syncingAccounts.value = false
  }
}

async function loadReport(key) {
  reportError.value = ''
  reportLoading.value = true
  activeReportKey.value = key
  try {
    const { data } = await xeroApi.getReport(key, {
      from_date: reportDates.from_date || undefined,
      to_date: reportDates.to_date || undefined,
    })
    const report = data.report || {}
    reportTitle.value = (report.ReportTitles || []).filter(Boolean).join(' — ')
    reportTable.value = flattenReport(report)
  } catch (e) {
    reportTable.value = { header: [], rows: [] }
    reportTitle.value = ''
    reportError.value = e.response?.data?.message || e.message || 'Failed to load the report'
    toastError(e.response?.data?.message || 'Failed to load the report')
  } finally {
    reportLoading.value = false
  }
}

function flattenReport(report) {
  const headerRow = (report.Rows || []).find((r) => r.RowType === 'Header')
  const header = (headerRow?.Cells || []).map((c) => c.Value ?? '')
  const rows = []

  function pushRows(list) {
    for (const row of list || []) {
      if (row.RowType === 'Header') continue
      if (row.RowType === 'Section') {
        if (row.Title) rows.push({ isSection: true, isSummary: false, title: row.Title, cells: [] })
        if (row.Rows) pushRows(row.Rows)
      } else {
        rows.push({
          isSection: false,
          isSummary: row.RowType === 'SummaryRow',
          title: '',
          cells: (row.Cells || []).map((c) => c.Value ?? ''),
        })
      }
    }
  }

  pushRows(report.Rows || [])
  return { header, rows }
}

async function fetchLogs(page = 1) {
  logsLoading.value = true
  try {
    const params = { page, ...logFilters }
    Object.keys(params).forEach((k) => { if (!params[k]) delete params[k] })
    const { data } = await xeroApi.getLogs(params)
    logs.value = data.logs || data.data || data
  } catch {
    logs.value = { data: [], current_page: 1, last_page: 1 }
  } finally {
    logsLoading.value = false
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  loadSettings()
  fetchLogs()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onOAuthMessage)
})
</script>

<style scoped>
.report-section {
  background: #f1f5f9;
  font-weight: 700;
  color: #334155;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.03em;
}
.report-summary {
  font-weight: 700;
  color: #1e293b;
  border-top: 1px solid #cbd5e1;
}
</style>