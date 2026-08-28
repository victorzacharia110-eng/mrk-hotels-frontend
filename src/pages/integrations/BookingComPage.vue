<template>
  <div class="container" style="padding-top: 32px; padding-bottom: 40px">
    <div class="page-head">
      <div>
        <h1>{{ $t('integrations.bookingCom.title') }}</h1>
        <p class="muted">{{ $t('integrations.bookingCom.subtitle') }}</p>
      </div>
    </div>

    <div v-if="pageError" class="alert alert-error">{{ pageError }}</div>
    <div v-if="pageSuccess" class="alert alert-success">{{ pageSuccess }}</div>

    <!-- Connection Settings -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-plug"></i> Connection</h2>

      <div class="status-row" style="margin-bottom: 20px">
        <span style="font-weight: 600; margin-right: 10px">Status:</span>
        <span v-if="settings.connected" class="badge badge-green">
          <i class="fas fa-circle" style="font-size: 6px; margin-right: 6px"></i>
          {{ $t('integrations.bookingCom.connected') }}
        </span>
        <span v-else class="badge badge-gray">
          <i class="fas fa-circle" style="font-size: 6px; margin-right: 6px"></i>
          {{ $t('integrations.bookingCom.disconnected') }}
        </span>
      </div>

      <div style="max-width: 520px">
        <div class="form-group">
          <label>{{ $t('integrations.bookingCom.hotelId') }}</label>
          <input
            v-model="settings.hotel_id"
            type="text"
            class="input"
            :placeholder="$t('integrations.bookingCom.hotelIdPlaceholder')"
          />
        </div>

        <div class="form-group">
          <label>{{ $t('integrations.bookingCom.apiPassword') }}</label>
          <div style="position: relative">
            <input
              v-model="settings.api_password"
              :type="showPassword ? 'text' : 'password'"
              class="input"
              :placeholder="$t('integrations.bookingCom.apiPasswordPlaceholder')"
              style="padding-right: 42px"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #888; font-size: 14px"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
            >
              <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer">
            <input
              v-model="settings.auto_sync"
              type="checkbox"
              style="width: 18px; height: 18px; accent-color: var(--brand)"
            />
            {{ $t('integrations.bookingCom.autoSync') }}
          </label>
        </div>

        <div class="form-group">
          <label>{{ $t('integrations.bookingCom.syncInterval') }}</label>
          <select v-model="settings.sync_interval" class="select">
            <option value="4">Every 4 hours</option>
            <option value="6">Every 6 hours</option>
            <option value="8">Every 8 hours</option>
            <option value="12">Every 12 hours</option>
            <option value="24">Every 24 hours</option>
          </select>
        </div>

        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px">
          <button
            class="btn btn-secondary btn-sm"
            @click="testConnection"
            :disabled="testing"
          >
            <i v-if="testing" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-plug"></i>
            {{ $t('integrations.bookingCom.testConnection') }}
          </button>

          <button
            class="btn btn-primary btn-sm"
            @click="saveSettings"
            :disabled="saving"
          >
            <i v-if="saving" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-save"></i>
            {{ $t('integrations.bookingCom.saveSettings') }}
          </button>

          <button
            v-if="settings.connected"
            class="btn btn-danger btn-sm"
            @click="confirmDisconnect"
            :disabled="disconnecting"
          >
            <i v-if="disconnecting" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-link-slash"></i>
            {{ $t('integrations.bookingCom.disconnect') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Sync Actions -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-arrows-rotate"></i> Sync Actions</h2>

      <div style="display: flex; gap: 10px; flex-wrap: wrap">
        <button
          class="btn btn-primary btn-sm"
          @click="pushAvailability"
          :disabled="syncingAvailability"
        >
          <i v-if="syncingAvailability" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-arrow-up"></i>
          {{ $t('integrations.bookingCom.pushAvailability') }}
        </button>

        <button
          class="btn btn-primary btn-sm"
          @click="pushRates"
          :disabled="syncingRates"
        >
          <i v-if="syncingRates" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-dollar-sign"></i>
          {{ $t('integrations.bookingCom.pushRates') }}
        </button>

        <button
          class="btn btn-secondary btn-sm"
          @click="pullReservations"
          :disabled="pullingReservations"
        >
          <i v-if="pullingReservations" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fas fa-arrow-down"></i>
          {{ $t('integrations.bookingCom.pullReservations') }}
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
      <h2 class="card-title"><i class="fas fa-scroll"></i> {{ $t('integrations.bookingCom.logs') }}</h2>

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
        {{ $t('integrations.bookingCom.noLogs') }}
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
import { bookingComApi } from '@/api'
import { toast } from '@/utils/toast'

const pageError = ref('')
const pageSuccess = ref('')
const showPassword = ref(false)
const testing = ref(false)
const saving = ref(false)
const disconnecting = ref(false)
const syncingAvailability = ref(false)
const syncingRates = ref(false)
const pullingReservations = ref(false)
const syncResult = ref(null)
const logsLoading = ref(false)

const settings = reactive({
  hotel_id: '',
  api_password: '',
  auto_sync: false,
  sync_interval: '8',
  connected: false,
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
    const { data } = await bookingComApi.getSettings()
    Object.assign(settings, data.data || data)
  } catch (e) {
    pageError.value = e.response?.data?.message || 'Failed to load settings.'
  }
}

async function testConnection() {
  clearMessages()
  testing.value = true
  try {
    const { data } = await bookingComApi.testConnection()
    pageSuccess.value = data.message || 'Connection successful!'
    toast.success(data.message || 'Connection successful!')
  } catch (e) {
    pageError.value = e.response?.data?.message || 'Connection failed'
    toast.error(e.response?.data?.message || 'Connection failed')
  } finally {
    testing.value = false
  }
}

async function saveSettings() {
  clearMessages()
  saving.value = true
  try {
    const { data } = await bookingComApi.updateSettings({
      hotel_id: settings.hotel_id,
      api_password: settings.api_password,
      auto_sync: settings.auto_sync,
      sync_interval: settings.sync_interval,
    })
    Object.assign(settings, data.data || data)
    pageSuccess.value = 'Settings saved successfully'
    toast.success('Settings saved successfully')
  } catch (e) {
    pageError.value = e.response?.data?.message || 'Failed to save settings'
    toast.error(e.response?.data?.message || 'Failed to save settings')
  } finally {
    saving.value = false
  }
}

async function confirmDisconnect() {
  if (!window.confirm('Are you sure you want to disconnect from Booking.com?')) return
  disconnecting.value = true
  clearMessages()
  try {
    await bookingComApi.disconnect()
    settings.connected = false
    pageSuccess.value = 'Disconnected from Booking.com'
    toast.success('Disconnected from Booking.com')
  } catch (e) {
    pageError.value = e.response?.data?.message || 'Failed to disconnect'
    toast.error(e.response?.data?.message || 'Failed to disconnect')
  } finally {
    disconnecting.value = false
  }
}

async function pushAvailability() {
  syncResult.value = null
  syncingAvailability.value = true
  try {
    const { data } = await bookingComApi.syncAvailability({})
    syncResult.value = { success: true, message: data.message || 'Availability pushed successfully' }
    toast.success(data.message || 'Availability pushed successfully')
  } catch (e) {
    syncResult.value = { success: false, message: e.response?.data?.message || 'Failed to push availability' }
    toast.error(e.response?.data?.message || 'Failed to push availability')
  } finally {
    syncingAvailability.value = false
  }
}

async function pushRates() {
  syncResult.value = null
  syncingRates.value = true
  try {
    const { data } = await bookingComApi.syncRates({})
    syncResult.value = { success: true, message: data.message || 'Rates pushed successfully' }
    toast.success(data.message || 'Rates pushed successfully')
  } catch (e) {
    syncResult.value = { success: false, message: e.response?.data?.message || 'Failed to push rates' }
    toast.error(e.response?.data?.message || 'Failed to push rates')
  } finally {
    syncingRates.value = false
  }
}

async function pullReservations() {
  syncResult.value = null
  pullingReservations.value = true
  try {
    const { data } = await bookingComApi.pullReservations({})
    syncResult.value = { success: true, message: data.message || 'Reservations pulled successfully' }
    toast.success(data.message || 'Reservations pulled successfully')
  } catch (e) {
    syncResult.value = { success: false, message: e.response?.data?.message || 'Failed to pull reservations' }
    toast.error(e.response?.data?.message || 'Failed to pull reservations')
  } finally {
    pullingReservations.value = false
  }
}

async function fetchLogs(page = 1) {
  logsLoading.value = true
  try {
    const params = { page, ...logFilters }
    Object.keys(params).forEach((k) => { if (!params[k]) delete params[k] })
    const { data } = await bookingComApi.getLogs(params)
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
