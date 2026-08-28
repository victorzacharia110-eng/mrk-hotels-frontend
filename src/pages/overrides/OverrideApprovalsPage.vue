<!--
  Override Approvals page (route: /app/overrides, name: override-approvals).
  Lets managers create time-limited check-in override approvals and review
  active overrides and full history.  Receptionists see a read-only view of
  active overrides.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('overrides.title') }}</h1>
        <p class="muted">{{ $t('overrides.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('reservations.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Create form (manager / hotel_admin only) -->
    <div v-if="canCreate" class="card" style="margin-bottom: 24px;">
      <h2 style="margin-bottom: 16px;"><i class="fas fa-plus-circle"></i> {{ $t('overrides.create') }}</h2>
      <form @submit.prevent="submitOverride">
        <div class="form-grid">
          <div class="form-group">
            <label>{{ $t('overrides.guestName') }}<span class="req">*</span></label>
            <input v-model="form.guest_name" type="text" class="input" required :placeholder="$t('overrides.guestNamePlaceholder')" />
          </div>
          <div class="form-group">
            <label>{{ $t('overrides.reservationId') }}</label>
            <input v-model="form.reservation_id" type="text" class="input" :placeholder="$t('overrides.reservationIdPlaceholder')" />
          </div>
          <div class="form-group">
            <label>{{ $t('overrides.balanceDue') }}<span class="req">*</span></label>
            <input v-model.number="form.balance_due" type="number" min="0" step="0.01" class="input" required :placeholder="$t('overrides.balanceDuePlaceholder')" />
          </div>
          <div class="form-group">
            <label>{{ $t('overrides.expiresIn') }}<span class="req">*</span></label>
            <SearchableSelect
              v-model="form.duration_seconds"
              :options="expiryOptions"
              :required="true"
            />
          </div>
          <div v-if="showCustomDuration" class="form-group">
            <label>Custom Duration (seconds)<span class="req">*</span></label>
            <div style="display: flex; gap: 8px;">
              <input v-model.number="customDuration" type="number" min="1" max="172800" class="input" placeholder="e.g. 45" style="flex: 1;" />
              <button type="button" class="btn btn-secondary" @click="form.duration_seconds = 3600; customDuration = ''">
                <i class="fas fa-arrow-left"></i> Back to presets
              </button>
            </div>
          </div>
          <div class="form-group form-full">
            <label>{{ $t('overrides.notes') }}</label>
            <textarea v-model="form.notes" rows="2" class="textarea" :placeholder="$t('overrides.notesPlaceholder')"></textarea>
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            <i class="fas fa-check"></i> {{ submitting ? $t('common.saving') : $t('overrides.submit') }}
          </button>
          <button type="button" class="btn btn-secondary" @click="resetForm">{{ $t('overrides.cancel') }}</button>
        </div>
      </form>
    </div>

    <!-- Stats row -->
    <div class="stats-grid" style="margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total_created }}</div>
        <div class="stat-label">{{ $t('overrides.totalCreated') }}</div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-value">{{ stats.active_count }}</div>
        <div class="stat-label">{{ $t('overrides.activeNow') }}</div>
      </div>
      <div class="stat-card stat-gray">
        <div class="stat-value">{{ stats.expired_count }}</div>
        <div class="stat-label">{{ $t('overrides.expiredCount') }}</div>
      </div>
      <div class="stat-card stat-red">
        <div class="stat-value">{{ stats.revoked_count }}</div>
        <div class="stat-label">{{ $t('overrides.revokedCount') }}</div>
      </div>
    </div>

    <!-- Active overrides -->
    <div class="card" style="margin-bottom: 24px;">
      <h2 style="margin-bottom: 12px;"><i class="fas fa-shield-halved"></i> {{ $t('overrides.activeOverrides') }}</h2>
      <div v-if="loading" class="alert alert-info">{{ $t('reservations.loading') }}</div>
      <div v-else-if="!activeOverrides.length" class="empty-state">
        <p>{{ $t('overrides.noActiveOverrides') }}</p>
        <p class="sub">{{ $t('overrides.createFirst') }}</p>
      </div>
      <div v-else class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>{{ $t('overrides.guestName') }}</th>
              <th>{{ $t('overrides.balance') }}</th>
              <th>{{ $t('overrides.createdBy') }}</th>
              <th>{{ $t('overrides.remainingTime') }}</th>
              <th>{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in activeOverrides" :key="o.id">
              <td>
                <strong>{{ o.guest_name }}</strong>
                <div v-if="o.notes" class="sub">{{ o.notes }}</div>
              </td>
              <td>TZS {{ Number(o.balance_due || 0).toLocaleString() }}</td>
              <td>{{ o.created_by?.full_name || '—' }}</td>
              <td>
                <span v-if="o.expires_at" :class="getExpiryClass(o.expires_at)">
                  <i class="fas fa-clock"></i> {{ getRemainingTime(o.expires_at) }}
                </span>
                <span v-else class="sub">—</span>
              </td>
              <td>
                <button v-if="canRevoke" class="btn btn-sm btn-danger" @click="revokeOverride(o)">
                  <i class="fas fa-ban"></i> {{ $t('overrides.revoke') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- History -->
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2><i class="fas fa-clock-rotate-left"></i> {{ $t('overrides.history') }}</h2>
        <div class="filter-tabs">
          <button
            v-for="f in historyFilters"
            :key="f.value"
            class="tab"
            :class="{ active: historyFilter === f.value }"
            @click="historyFilter = f.value; loadHistory()"
          >{{ f.label }}</button>
        </div>
      </div>
      <div v-if="loadingHistory" class="alert alert-info">{{ $t('reservations.loading') }}</div>
      <div v-else-if="!history.length" class="empty-state">
        <p>{{ $t('overrides.noHistory') }}</p>
      </div>
      <div v-else class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>{{ $t('overrides.guestName') }}</th>
              <th>{{ $t('overrides.balance') }}</th>
              <th>{{ $t('overrides.status') }}</th>
              <th>{{ $t('overrides.createdAt') }}</th>
              <th>{{ $t('overrides.expiresAt') }}</th>
              <th>{{ $t('overrides.createdBy') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in history" :key="o.id">
              <td>
                <strong>{{ o.guest_name }}</strong>
                <div v-if="o.notes" class="sub">{{ o.notes }}</div>
              </td>
              <td>TZS {{ Number(o.balance_due || 0).toLocaleString() }}</td>
              <td>
                <span class="badge" :class="statusBadge(o.status)">
                  {{ $t(`overrides.${o.status}`) }}
                </span>
              </td>
              <td>{{ formatDateTime(o.created_at) }}</td>
              <td>{{ formatDateTime(o.expires_at) }}</td>
              <td>{{ o.created_by?.full_name || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { checkinOverrideApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'

const { t } = useI18n()
const authStore = useAuthStore()

const canCreate = computed(() => authStore.roleLevel >= 80)
const canRevoke = computed(() => authStore.roleLevel >= 80)

const success = ref('')
const error = ref('')
const submitting = ref(false)
const loading = ref(false)
const loadingHistory = ref(false)

const activeOverrides = ref([])
const history = ref([])
const stats = reactive({ total_created: 0, active_count: 0, expired_count: 0, revoked_count: 0 })

const historyFilter = ref('all')
const historyFilters = computed(() => [
  { value: 'all', label: t('overrides.filterAll') },
  { value: 'pending', label: t('overrides.filterPending') },
  { value: 'approved', label: t('overrides.filterApproved') },
  { value: 'revoked', label: t('overrides.filterRevoked') },
  { value: 'expired', label: t('overrides.filterExpired') },
])

/** Override creation form. */
function blankForm() {
  return {
    guest_name: '',
    reservation_id: '',
    balance_due: null,
    duration_seconds: 3600,
    notes: '',
  }
}

const form = reactive(blankForm())

const expiryOptions = computed(() => [
  { value: 1, label: '1 second' },
  { value: 2, label: '2 seconds' },
  { value: 5, label: '5 seconds' },
  { value: 10, label: '10 seconds' },
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 7200, label: '2 hours' },
  { value: 14400, label: '4 hours' },
  { value: 28800, label: '8 hours' },
  { value: 86400, label: '24 hours' },
  { value: 'custom', label: '+ Custom' },
])

const customDuration = ref('')
const showCustomDuration = computed(() => form.duration_seconds === 'custom')
const effectiveDuration = computed(() => {
  if (form.duration_seconds === 'custom') return parseInt(customDuration.value, 10) || 0
  return Number(form.duration_seconds)
})

/** Formats a timestamp for display. */
function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Maps a status string to a badge CSS class. */
function statusBadge(status) {
  return (
    {
      pending: 'badge-yellow',
      approved: 'badge-green',
      revoked: 'badge-red',
      expired: 'badge-gray',
    }[status] || 'badge-gray'
  )
}

// ── Countdown timer ─────────────────────────────────────────────────────────

let countdownInterval = null

/** Forces reactive re-render every second when the page is open. */
function startCountdown() {
  stopCountdown()
  countdownInterval = setInterval(() => {
    // Trigger Vue reactivity by reassigning the same array reference.
    activeOverrides.value = [...activeOverrides.value]
  }, 1000)
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

/** Returns a human-readable remaining time string for a given expiry. */
function getRemainingTime(expiresAt) {
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now())
  if (diff <= 0) return t('overrides.expiredLabel')
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

/** Returns a CSS class depending on how much time is left. */
function getExpiryClass(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'expiry-expired'
  if (diff < 900000) return 'expiry-critical'  // < 15 min
  if (diff < 3600000) return 'expiry-warning'   // < 1 hour
  return 'expiry-ok'
}

// ── Data loading ────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [activeRes, statsRes] = await Promise.all([
      checkinOverrideApi.active(),
      checkinOverrideApi.stats(),
    ])
    activeOverrides.value = activeRes.data.data || []
    Object.assign(stats, statsRes.data.stats || {})
  } catch (err) {
    error.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  loadingHistory.value = true
  try {
    const params = {}
    if (historyFilter.value !== 'all') params.status = historyFilter.value
    const res = await checkinOverrideApi.list(params)
    history.value = res.data.data || []
  } catch {
    // Non-critical; keep the current history.
  } finally {
    loadingHistory.value = false
  }
}

async function submitOverride() {
  if (!form.guest_name || !form.balance_due) return
  if (effectiveDuration.value < 1 || effectiveDuration.value > 172800) {
    error.value = 'Duration must be between 1 second and 48 hours.'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await checkinOverrideApi.create({
      guest_name: form.guest_name,
      reservation_id: form.reservation_id || undefined,
      balance_due: form.balance_due,
      duration_seconds: effectiveDuration.value,
      notes: form.notes || undefined,
    })
    success.value = t('overrides.createSuccess')
    resetForm()
    await Promise.all([load(), loadHistory()])
  } catch (err) {
    error.value = err.response?.data?.message || t('overrides.createError')
  } finally {
    submitting.value = false
  }
}

async function revokeOverride(override) {
  if (!window.confirm(t('overrides.revokeConfirm'))) return
  error.value = ''
  try {
    await checkinOverrideApi.revoke(override.id)
    success.value = t('overrides.revokedSuccess')
    await Promise.all([load(), loadHistory()])
  } catch (err) {
    error.value = err.response?.data?.message || t('overrides.revokeError')
  }
}

function resetForm() {
  Object.assign(form, blankForm())
}

onMounted(() => {
  load()
  loadHistory()
  startCountdown()
})

onUnmounted(() => {
  stopCountdown()
})
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--muted, #64748b);
}

.empty-state .sub {
  margin-top: 4px;
  font-size: 13px;
  opacity: 0.7;
}

.filter-tabs {
  display: flex;
  gap: 4px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--brand-dark, #1a1a2e);
}

.stat-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--muted, #64748b);
  margin-top: 4px;
}

.stat-green .stat-value { color: #16a34a; }
.stat-gray .stat-value { color: #94a3b8; }
.stat-red .stat-value { color: #dc2626; }

.expiry-ok { color: #16a34a; font-weight: 600; }
.expiry-warning { color: #f59e0b; font-weight: 600; }
.expiry-critical { color: #dc2626; font-weight: 700; animation: pulse 1s infinite; }
.expiry-expired { color: #94a3b8; text-decoration: line-through; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.form-full {
  grid-column: 1 / -1;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .filter-tabs {
    flex-wrap: wrap;
  }
}
</style>
