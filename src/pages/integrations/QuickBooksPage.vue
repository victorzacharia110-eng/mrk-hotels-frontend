<template>
  <div class="container" style="padding-top: 32px; padding-bottom: 40px">
    <div class="page-head">
      <div>
        <h1>{{ $t('integrations.quickbooks.title') }}</h1>
        <p class="muted">{{ $t('integrations.quickbooks.subtitle') }}</p>
      </div>
    </div>

    <div v-if="pageError" class="alert alert-error">{{ pageError }}</div>
    <div v-if="pageSuccess" class="alert alert-success">{{ pageSuccess }}</div>

    <!-- Connection Settings -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-calculator"></i> Connection</h2>

      <div class="status-row" style="margin-bottom: 20px">
        <span style="font-weight: 600; margin-right: 10px">Status:</span>
        <span v-if="settings.connected" class="badge badge-green">
          <i class="fas fa-circle" style="font-size: 6px; margin-right: 6px"></i>
          {{ $t('integrations.quickbooks.connected') }}
        </span>
        <span v-else class="badge badge-gray">
          <i class="fas fa-circle" style="font-size: 6px; margin-right: 6px"></i>
          {{ $t('integrations.quickbooks.disconnected') }}
        </span>
      </div>

      <div style="max-width: 520px">
        <!-- Environment selector -->
        <div class="form-group">
          <label>{{ $t('integrations.quickbooks.environment') }}</label>
          <div style="display: flex; gap: 0; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; width: fit-content">
            <button
              type="button"
              :style="{
                padding: '10px 24px',
                fontWeight: 600,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                background: settings.environment === 'sandbox' ? 'var(--brand)' : '#fff',
                color: settings.environment === 'sandbox' ? '#fff' : '#333',
                transition: 'all 0.2s',
              }"
              @click="settings.environment = 'sandbox'"
            >
              {{ $t('integrations.quickbooks.sandbox') }}
            </button>
            <button
              type="button"
              :style="{
                padding: '10px 24px',
                fontWeight: 600,
                fontSize: '14px',
                border: 'none',
                borderLeft: '1px solid #ddd',
                cursor: 'pointer',
                background: settings.environment === 'production' ? 'var(--brand)' : '#fff',
                color: settings.environment === 'production' ? '#fff' : '#333',
                transition: 'all 0.2s',
              }"
              @click="settings.environment = 'production'"
            >
              {{ $t('integrations.quickbooks.production') }}
            </button>
          </div>
        </div>

        <!-- Company info (shown after connected) -->
        <div v-if="settings.connected && settings.company_name" class="form-group" style="margin-top: 16px">
          <label>{{ $t('integrations.quickbooks.companyName') }}</label>
          <input type="text" class="input" :value="settings.company_name" disabled />
        </div>

        <div v-if="settings.connected && settings.realm_id" class="form-group">
          <label>{{ $t('integrations.quickbooks.realmId') }}</label>
          <input type="text" class="input" :value="settings.realm_id" disabled />
        </div>

        <!-- Connect / Test buttons -->
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px">
          <button
            v-if="!settings.connected"
            class="btn btn-primary btn-sm"
            @click="connectToQuickBooks"
            :disabled="connecting"
          >
            <i v-if="connecting" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-link"></i>
            {{ $t('integrations.quickbooks.connectQb') }}
          </button>

          <button
            v-if="settings.connected"
            class="btn btn-secondary btn-sm"
            @click="testConnection"
            :disabled="testing"
          >
            <i v-if="testing" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-plug"></i>
            {{ $t('integrations.quickbooks.testConnection') }}
          </button>

          <button
            class="btn btn-primary btn-sm"
            @click="saveSettings"
            :disabled="saving"
          >
            <i v-if="saving" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
            {{ $t('integrations.quickbooks.saveSettings') }}
          </button>

          <button
            v-if="settings.connected"
            class="btn btn-danger btn-sm"
            @click="confirmDisconnect"
            :disabled="disconnecting"
          >
            <i v-if="disconnecting" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-link-slash"></i>
            {{ $t('integrations.quickbooks.disconnect') }}
          </button>
        </div>

        <!-- Sync toggles -->
        <div v-if="settings.connected" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee">
          <label style="font-weight: 600; font-size: 14px; color: #555; display: block; margin-bottom: 12px">Sync Options</label>
          <div style="display: flex; flex-direction: column; gap: 10px">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px">
              <input
                v-model="settings.sync_invoices"
                type="checkbox"
                style="width: 18px; height: 18px; accent-color: var(--brand)"
              />
              {{ $t('integrations.quickbooks.syncInvoicesLabel') }}
            </label>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px">
              <input
                v-model="settings.sync_payments"
                type="checkbox"
                style="width: 18px; height: 18px; accent-color: var(--brand)"
              />
              {{ $t('integrations.quickbooks.syncPaymentsLabel') }}
            </label>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px">
              <input
                v-model="settings.sync_coa"
                type="checkbox"
                style="width: 18px; height: 18px; accent-color: var(--brand)"
              />
              {{ $t('integrations.quickbooks.syncCoaLabel') }}
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Sync Actions -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-arrows-rotate"></i> Sync Actions</h2>

      <div class="form-group" style="max-width: 520px; margin-bottom: 20px">
        <label style="font-weight: 600; font-size: 14px; color: #555; margin-bottom: 8px; display: block">{{ $t('integrations.quickbooks.dateRange') }}</label>
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
          <div style="flex: 1; min-width: 150px">
            <label style="font-size: 13px; color: #777; margin-bottom: 4px; display: block">{{ $t('integrations.quickbooks.startDate') }}</label>
            <input v-model="syncDates.start_date" type="date" class="input" />
          </div>
          <div style="flex: 1; min-width: 150px">
            <label style="font-size: 13px; color: #777; margin-bottom: 4px; display: block">{{ $t('integrations.quickbooks.endDate') }}</label>
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
          {{ $t('integrations.quickbooks.syncInvoices') }}
        </button>

        <button
          class="btn btn-primary btn-sm"
          @click="syncPayments"
          :disabled="syncingPayments"
        >
          <i v-if="syncingPayments" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-money-bill-wave"></i>
          {{ $t('integrations.quickbooks.syncPayments') }}
        </button>
      </div>

      <div v-if="syncResult" style="margin-top: 12px">
        <div :class="syncResult.success ? 'alert alert-success' : 'alert alert-error'">
          {{ syncResult.message }}
        </div>
      </div>
    </div>

    <!-- Sync Logs -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-scroll"></i> {{ $t('integrations.quickbooks.logs') }}</h2>

      <div class="filter-bar" style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap">
        <div class="form-group" style="margin-bottom: 0">
          <select v-model="logFilters.direction" class="select" @change="fetchLogs(1)">
            <option value="">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0">
          <select v-model="logFilters.status" class="select" @change="fetchLogs(1)">
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
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
              <th>Date</th>
              <th>Direction</th>
              <th>Event</th>
              <th>Status</th>
              <th>Duration</th>
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
                  {{ log.direction === 'inbound' ? 'Inbound' : 'Outbound' }}
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
        {{ $t('integrations.quickbooks.noLogs') }}
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
          Page {{ logs.current_page }} of {{ logs.last_page }}
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
import { ref, reactive, onMounted } from 'vue'
import { quickbooksApi } from '@/api'
import { toast, toastError } from '@/utils/toast'

const pageError = ref('')
const pageSuccess = ref('')
const connecting = ref(false)
const testing = ref(false)
const saving = ref(false)
const disconnecting = ref(false)
const syncingInvoices = ref(false)
const syncingPayments = ref(false)
const syncResult = ref(null)
const logsLoading = ref(false)

const settings = reactive({
  connected: false,
  environment: 'sandbox',
  company_name: '',
  realm_id: '',
  sync_invoices: true,
  sync_payments: true,
  sync_coa: false,
})

const syncDates = reactive({
  start_date: '',
  end_date: '',
})

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
    const { data } = await quickbooksApi.getSettings()
    Object.assign(settings, data.data || data)
  } catch (e) {
    pageError.value = e.response?.data?.message || 'Failed to load settings.'
  }
}

async function connectToQuickBooks() {
  clearMessages()
  connecting.value = true
  try {
    const { data } = await quickbooksApi.getAuthUrl()
    const url = data.data?.auth_url || data.auth_url
    if (url) {
      window.open(url, '_blank', 'width=600,height=700')
      pageSuccess.value = 'QuickBooks authorization window opened. Complete the login and authorize the app.'
    }
  } catch (e) {
    pageError.value = e.response?.data?.message || 'Failed to get authorization URL'
    toastError(e.response?.data?.message || 'Failed to get authorization URL')
  } finally {
    connecting.value = false
  }
}

async function testConnection() {
  clearMessages()
  testing.value = true
  try {
    const { data } = await quickbooksApi.testConnection()
    pageSuccess.value = data.message || 'Connection successful!'
    toast(data.message || 'Connection successful!')
  } catch (e) {
    pageError.value = e.response?.data?.message || 'Connection failed'
    toastError(e.response?.data?.message || 'Connection failed')
  } finally {
    testing.value = false
  }
}

async function saveSettings() {
  clearMessages()
  saving.value = true
  try {
    const { data } = await quickbooksApi.updateSettings({
      environment: settings.environment,
      sync_invoices: settings.sync_invoices,
      sync_payments: settings.sync_payments,
      sync_coa: settings.sync_coa,
    })
    Object.assign(settings, data.data || data)
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
  if (!window.confirm('Are you sure you want to disconnect from QuickBooks?')) return
  disconnecting.value = true
  clearMessages()
  try {
    await quickbooksApi.disconnect()
    settings.connected = false
    settings.company_name = ''
    settings.realm_id = ''
    pageSuccess.value = 'Disconnected from QuickBooks'
    toast('Disconnected from QuickBooks')
  } catch (e) {
    pageError.value = e.response?.data?.message || 'Failed to disconnect'
    toastError(e.response?.data?.message || 'Failed to disconnect')
  } finally {
    disconnecting.value = false
  }
}

async function syncInvoices() {
  syncResult.value = null
  syncingInvoices.value = true
  try {
    const { data } = await quickbooksApi.syncInvoices({
      start_date: syncDates.start_date,
      end_date: syncDates.end_date,
    })
    syncResult.value = { success: true, message: data.message || 'Invoices synced successfully' }
    toast(data.message || 'Invoices synced successfully')
  } catch (e) {
    syncResult.value = { success: false, message: e.response?.data?.message || 'Failed to sync invoices' }
    toastError(e.response?.data?.message || 'Failed to sync invoices')
  } finally {
    syncingInvoices.value = false
  }
}

async function syncPayments() {
  syncResult.value = null
  syncingPayments.value = true
  try {
    const { data } = await quickbooksApi.syncPayments({
      start_date: syncDates.start_date,
      end_date: syncDates.end_date,
    })
    syncResult.value = { success: true, message: data.message || 'Payments synced successfully' }
    toast(data.message || 'Payments synced successfully')
  } catch (e) {
    syncResult.value = { success: false, message: e.response?.data?.message || 'Failed to sync payments' }
    toastError(e.response?.data?.message || 'Failed to sync payments')
  } finally {
    syncingPayments.value = false
  }
}

async function fetchLogs(page = 1) {
  logsLoading.value = true
  try {
    const params = { page, ...logFilters }
    Object.keys(params).forEach((k) => { if (!params[k]) delete params[k] })
    const { data } = await quickbooksApi.getLogs(params)
    logs.value = data.data || data
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
</script>
