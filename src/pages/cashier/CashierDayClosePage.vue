<!--
  CashierDayClosePage — closes the F&B business day for the CASHIER / BAR /
  INVENTORY panels and manages the hotel's standard time.

  A date can only be closed once its day has fully ended in the hotel's own
  timezone (midnight rollover) AND every order on it is settled and finished.
  The page therefore offers the previous ended day ("date to close") plus the
  current open business date the panels operate on. Closing a date freezes its
  snapshot and the panels keep running on the open date.
-->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-calendar-check" aria-hidden="true"></i> {{ $t('cashier.dayClose.title') }}</h2>
        <span class="hotel-name"><i class="fas fa-earth-africa" aria-hidden="true"></i> {{ timezoneLabel }}</span>
      </div>

      <div class="panel-body">
        <div v-if="loading" class="dc-skeleton">
          <div class="sm-skeleton sk-line"></div>
          <div class="sm-skeleton sk-line"></div>
        </div>

        <template v-else>
          <div class="dc-grid">
            <div class="dc-status-card" :class="closable ? 'ok' : 'blocked'">
              <div class="dc-date">
                <span class="dc-date-label">{{ $t('cashier.dayClose.dateToClose') }}</span>
                <strong>{{ formatDate(status.close_date) }}</strong>
                <span class="dc-date-sub">{{ $t('cashier.dayClose.openDate') }}: {{ formatDate(status.open_date) }}</span>
              </div>
              <div class="dc-stats">
                <div class="stat">
                  <span>{{ $t('cashier.dayClose.runningOrders') }}</span>
                  <strong :class="{ warn: status.running_orders_count > 0 }">{{ status.running_orders_count }}</strong>
                </div>
                <div class="stat">
                  <span>{{ $t('cashier.dayClose.unsettledOrders') }}</span>
                  <strong :class="{ warn: status.unsettled_orders_count > 0 }">{{ status.unsettled_orders_count }}</strong>
                </div>
              </div>
              <div class="dc-status-note">
                <i class="fas" :class="closable ? 'fa-circle-check' : 'fa-circle-exclamation'" aria-hidden="true"></i>
                <span v-if="closable">{{ $t('cashier.dayClose.canCloseHint') }}</span>
                <span v-else-if="!dayEnded">{{ $t('cashier.dayClose.notEndedHint', { timezone: timezoneLabel }) }}</span>
                <span v-else>{{ $t('cashier.dayClose.blockedHint') }}</span>
              </div>
            </div>
          </div>

          <div class="dc-actions">
            <button class="sm-btn" :disabled="busy || !closable" @click="confirmClose">
              <i class="fas fa-lock" aria-hidden="true"></i> {{ $t('cashier.dayClose.closeDay') }}
            </button>
            <button class="sm-btn ghost" :disabled="busy" @click="refetch">
              <i class="fas fa-rotate" aria-hidden="true"></i> {{ $t('common.refresh') }}
            </button>
          </div>

          <p v-if="error" class="sm-error">{{ error }}</p>
          <p v-if="success" class="sm-ok">{{ success }}</p>
        </template>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-clock" aria-hidden="true"></i> {{ $t('cashier.dayClose.standardTime') }}</h2>
      </div>
      <div class="panel-body st-grid">
        <div class="st-live-clock">
          <span class="fld-label">{{ $t('cashier.dayClose.liveHotelTime') }}</span>
          <strong class="st-clock">{{ hotelNow }}</strong>
          <span class="st-zone">{{ timezoneLabel }}</span>
        </div>
        <div class="st-form">
          <label class="fld-label" for="dc-timezone">{{ $t('cashier.dayClose.timezone') }}</label>
          <select id="dc-timezone" v-model="tzSelect" class="sm-input">
            <option v-for="tz in timezoneOptions" :key="tz.value" :value="tz.value">{{ tz.label }}</option>
          </select>
          <p class="fld-hint"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.dayClose.standardTimeHint') }}</p>
          <p v-if="tzError" class="form-error">{{ tzError }}</p>
          <p v-if="tzOk && !tzError" class="sm-ok">{{ tzOk }}</p>
          <div class="dc-actions">
            <button class="sm-btn" :disabled="savingTz || tzSelect === timezoneRaw" @click="saveTimezone">
              <i class="fas fa-floppy-disk" aria-hidden="true"></i> {{ savingTz ? $t('common.saving') : $t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-clock-rotate-left" aria-hidden="true"></i> {{ $t('cashier.dayClose.history') }}</h2>
        <span class="hotel-name">{{ $t('cashier.dayClose.records', { n: history.length }) }}</span>
      </div>
      <div class="table-scroll">
        <SkeletonLoader v-if="loadingHistory" variant="table" :count="4" :cols="5" />
        <table v-else class="sm-table">
          <thead>
            <tr>
              <th>{{ $t('cashier.dayClose.closeDate') }}</th>
              <th>{{ $t('cashier.dayClose.closedBy') }}</th>
              <th>{{ $t('cashier.dayClose.closedAt') }}</th>
              <th class="num">{{ $t('cashier.dayClose.runningOrders') }}</th>
              <th>{{ $t('common.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dc in history" :key="dc.fb_day_close_id">
              <td>{{ formatDate(dc.close_date) }}</td>
              <td>{{ dc.closed_by?.name || dc.closed_by?.full_name || dc.closed_by_user || '—' }}</td>
              <td>{{ formatTime(dc.closed_at) }}</td>
              <td class="num">{{ dc.running_orders_count }}</td>
              <td><span class="status-badge success">{{ $t('cashier.dayClose.closed') }}</span></td>
            </tr>
            <tr v-if="!history.length && !loadingHistory">
              <td colspan="5" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('common.noData') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="confirmOpen" class="sm-modal-backdrop">
      <div class="sm-modal" role="dialog" aria-modal="true">
        <div class="sm-modal-head">
          <h3><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> {{ $t('cashier.dayClose.confirmTitle') }}</h3>
        </div>
        <p class="dc-confirm-text">{{ $t('cashier.dayClose.confirmText', { date: formatDate(status.close_date) }) }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" :disabled="busy" @click="confirmOpen = false">
            <i class="fas fa-xmark" aria-hidden="true"></i> {{ $t('common.cancel') }}
          </button>
          <button class="sm-btn" :disabled="busy" @click="doClose">
            <i class="fas fa-lock" aria-hidden="true"></i> {{ busy ? $t('common.loading') : $t('cashier.dayClose.closeDay') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fbDayCloseApi } from '@/api'
import { useWorkingDateStore } from '@/stores/workingDate'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const { t } = useI18n()
const workingDateStore = useWorkingDateStore()

const loading = ref(false)
const loadingHistory = ref(false)
const busy = ref(false)
const error = ref('')
const success = ref('')
const status = ref({ open_date: '', close_date: '', timezone: 'Africa/Dar_es_Salaam', running_orders_count: 0, unsettled_orders_count: 0, can_close: false, close_day_has_ended: false, latest_closed_date: null })
const history = ref([])
const confirmOpen = ref(false)

const savingTz = ref(false)
const tzSelect = ref('Africa/Dar_es_Salaam')
const tzError = ref('')
const tzOk = ref('')

const nowTick = ref(new Date())
let clockTimer = null

const dayEnded = computed(() => status.value.close_day_has_ended === true)
const closable = computed(() => status.value.can_close === true)

/** The hotel's standard timezone identifier as stored (e.g. Africa/Dar_es_Salaam). */
const timezoneRaw = computed(() => status.value.timezone || 'Africa/Dar_es_Salaam')

/** A human-friendly timezone name — underscores replaced with spaces. */
const timezoneLabel = computed(() => prettyTimezone(timezoneRaw.value))

function prettyTimezone(tz) {
  return String(tz || '').replaceAll('_', ' ')
}

/** Common hotel timezones with their runtime GMT offset. */
const TIMEZONES = [
  'Africa/Dar_es_Salaam',
  'Africa/Nairobi',
  'Africa/Kampala',
  'Africa/Addis_Ababa',
  'Africa/Maputo',
  'Africa/Johannesburg',
  'Africa/Lusaka',
  'Africa/Lagos',
  'Africa/Accra',
  'Africa/Cairo',
  'Europe/London',
  'UTC',
]

function formatOffset(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date())
    const name = parts.find((p) => p.type === 'timeZoneName')?.value
    return name ? ` (${name.replace('GMT', 'GMT')})` : ''
  } catch {
    return ''
  }
}

const timezoneOptions = computed(() =>
  TIMEZONES.map((value) => ({ value, label: `${prettyTimezone(value)}${formatOffset(value)}` })),
)

const hotelNow = computed(() => {
  try {
    const fmt = new Intl.DateTimeFormat(undefined, {
      timeZone: timezoneRaw.value,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    return fmt.format(nowTick.value)
  } catch {
    return nowTick.value.toLocaleString()
  }
})

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value + 'T00:00:00')
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await fbDayCloseApi.index()
    status.value = data || status.value
    if (data?.timezone) tzSelect.value = data.timezone
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  loadingHistory.value = true
  try {
    const { data } = await fbDayCloseApi.history()
    history.value = data?.day_closes || data?.data || []
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loadingHistory.value = false
  }
}

async function refetch() {
  await load()
  await loadHistory()
}

function confirmClose() {
  if (!closable.value) return
  error.value = ''
  success.value = ''
  confirmOpen.value = true
}

async function doClose() {
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    const { data } = await fbDayCloseApi.store({ date: status.value.close_date })
    success.value = data?.message || t('cashier.dayClose.closedSuccess')
    confirmOpen.value = false
    await workingDateStore.reload()
    await load()
    await loadHistory()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
    confirmOpen.value = false
  } finally {
    busy.value = false
  }
}

async function saveTimezone() {
  savingTz.value = true
  tzError.value = ''
  tzOk.value = ''
  try {
    await fbDayCloseApi.updateTimezone({ timezone: tzSelect.value })
    tzOk.value = t('cashier.dayClose.timezoneSaved')
    await refetch()
    await workingDateStore.reload()
  } catch (err) {
    tzError.value = err.response?.data?.message || t('common.error')
  } finally {
    savingTz.value = false
  }
}

onMounted(() => {
  load()
  loadHistory()
  clockTimer = setInterval(() => {
    nowTick.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<style scoped>
.dc-skeleton { display: flex; flex-direction: column; gap: 12px; }
.dc-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.dc-status-card {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 18px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-wrap: wrap;
  width: 100%;
}
.dc-status-card.ok { border-color: #bbf7d0; background: #f0fdf4; }
.dc-status-card.blocked { border-color: #fecaca; background: #fef2f2; }
.dc-date { display: flex; flex-direction: column; }
.dc-date-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
.dc-date strong { font-size: 24px; color: #1f2937; margin-top: 2px; }
.dc-date-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
.dc-stats { display: flex; gap: 20px; }
.dc-stats .stat { display: flex; flex-direction: column; }
.dc-stats .stat span { font-size: 12px; color: #64748b; }
.dc-stats .stat strong { font-size: 20px; color: #1f2937; }
.dc-stats .stat strong.warn { color: #b45309; }
.dc-status-note {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #334155;
  background: #fff;
  border-radius: 999px;
  padding: 8px 14px;
  border: 1px solid #e2e8f0;
  max-width: 100%;
}
.dc-status-card.ok .dc-status-note { color: #166534; border-color: #bbf7d0; }
.dc-status-card.blocked .dc-status-note { color: #b91c1c; border-color: #fecaca; }
.dc-actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }

.st-grid { display: grid; grid-template-columns: auto 1fr; gap: 24px; align-items: start; }
@media (max-width: 720px) { .st-grid { grid-template-columns: 1fr; } }
.st-live-clock { display: flex; flex-direction: column; gap: 4px; padding-right: 18px; border-right: 1px dashed #e2e8f0; }
@media (max-width: 720px) { .st-live-clock { border-right: none; padding-right: 0; } }
.st-clock { font-size: 26px; font-variant-numeric: tabular-nums; color: #00468c; letter-spacing: 0.03em; }
.st-zone { font-size: 12px; color: #64748b; }
.st-form { display: flex; flex-direction: column; gap: 6px; max-width: 460px; }
.fld-label { font-size: 12px; font-weight: 600; color: #475569; }
.fld-hint { margin: 0; font-size: 11.5px; color: #94a3b8; display: flex; align-items: center; gap: 4px; }
.form-error { color: #dc2626; font-size: 13px; margin: 0; }
.dc-confirm-text { color: #475569; margin: 6px 0 16px; }
</style>