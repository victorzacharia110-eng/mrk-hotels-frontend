<!--
  CashierShiftManagerPage — the cashier's cash-drawer shift screen.
  Start a shift with a float, watch sales land on the open register, then end
  the shift against the counted cash (the variance is recorded for the manager).
-->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-cash-register" aria-hidden="true"></i> {{ $t('cashier.shift.title') }}</h2>
        <span class="hotel-name"><i class="fas fa-hotel" aria-hidden="true"></i> {{ hotelName }}</span>
      </div>

      <!-- Current register state -->
      <div class="panel-body">
        <div v-if="loading && !current" class="shift-skeleton">
          <div class="sm-skeleton sk-line"></div>
          <div class="sm-skeleton sk-line"></div>
        </div>
        <div v-else-if="isOpen" class="shift-card open">
          <div class="shift-card-head">
            <span class="shift-badge open"><i class="fas fa-arrow-trend-up" aria-hidden="true"></i> {{ $t('cashier.shift.open') }}</span>
            <button class="sm-btn ghost" :disabled="busy" @click="openEndModal">
              <i class="fas fa-flag-checkered" aria-hidden="true"></i> {{ $t('cashier.shift.endShift') }}
            </button>
          </div>
          <div class="shift-stats">
            <div class="stat"><span>{{ $t('cashier.shift.openingFloat') }}</span><strong>TZS {{ fmtNum(current.opening_float) }}</strong></div>
            <div class="stat"><span>{{ $t('cashier.shift.sales') }}</span><strong>TZS {{ fmtNum(current.sales_total) }}</strong></div>
            <div class="stat"><span>{{ $t('cashier.shift.expected') }}</span><strong>TZS {{ fmtNum(current.expected_amount) }}</strong></div>
            <div class="stat"><span>{{ $t('cashier.shift.openedBy') }}</span><strong>{{ current.opened_by_name || '—' }}</strong></div>
            <div class="stat"><span>{{ $t('cashier.shift.openedAt') }}</span><strong>{{ fmtTime(current.opened_at) }}</strong></div>
          </div>
        </div>
        <div v-else class="shift-card closed">
          <div class="shift-card-head">
            <span class="shift-badge closed"><i class="fas fa-moon" aria-hidden="true"></i> {{ $t('cashier.shift.closed') }}</span>
            <button class="sm-btn" :disabled="busy" @click="openStartModal">
              <i class="fas fa-play" aria-hidden="true"></i> {{ $t('cashier.shift.startShift') }}
            </button>
          </div>
          <p class="shift-hint">{{ $t('cashier.shift.closedHint') }}</p>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-clock-rotate-left" aria-hidden="true"></i> {{ $t('cashier.shift.history') }}</h2>
        <span class="hotel-name">{{ $t('cashier.shift.records', { n: meta.total }) }}</span>
      </div>
      <div class="table-scroll">
        <SkeletonLoader v-if="loading" variant="table" :count="5" :cols="7" />
        <table v-else class="sm-table">
          <thead>
            <tr>
              <th>{{ $t('cashier.shift.openedAt') }}</th>
              <th>{{ $t('cashier.shift.openedBy') }}</th>
              <th class="num">{{ $t('cashier.shift.openingFloat') }}</th>
              <th class="num">{{ $t('cashier.shift.sales') }}</th>
              <th class="num">{{ $t('cashier.shift.expected') }}</th>
              <th class="num">{{ $t('cashier.shift.counted') }}</th>
              <th class="num">{{ $t('cashier.shift.variance') }}</th>
              <th>{{ $t('common.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="shift in shifts" :key="shift.id">
              <td>{{ fmtTime(shift.opened_at) }}</td>
              <td>{{ shift.opener?.full_name || '—' }}</td>
              <td class="num">{{ fmtNum(shift.opening_float) }}</td>
              <td class="num">{{ fmtNum(shift.sales_total) }}</td>
              <td class="num">{{ fmtNum(shift.expected_amount) }}</td>
              <td class="num">{{ fmtNum(shift.closing_float) }}</td>
              <td class="num" :class="varianceClass(shift.variance)">{{ fmtSigned(shift.variance) }}</td>
              <td><span class="status-badge" :class="shift.status">{{ $t(`cashier.shift.${shift.status}`) }}</span></td>
            </tr>
            <tr v-if="!shifts.length && !loading">
              <td colspan="8" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('common.noData') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="meta.total > meta.per_page" class="pagination">
        <button class="btn btn-sm btn-secondary" :disabled="meta.current_page <= 1" @click="goPage(meta.current_page - 1)">
          {{ $t('common.previous') }}
        </button>
        <span class="muted">{{ $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page }) }}</span>
        <button class="btn btn-sm btn-secondary" :disabled="meta.current_page >= meta.last_page" @click="goPage(meta.current_page + 1)">
          {{ $t('common.next') }}
        </button>
      </div>
    </section>

    <!-- Start / End shift float prompt -->
    <div v-if="floatModal" class="sm-modal-backdrop" @click.self="floatModal = null">
      <div class="sm-modal float-dialog" role="dialog" aria-modal="true">
        <div class="sm-modal-head">
          <h3>{{ floatModal === 'start' ? $t('cashier.shift.startShift') : $t('cashier.shift.endShift') }}</h3>
        </div>
        <button class="modal-close" @click="floatModal = null"><i class="fas fa-xmark"></i></button>
        <p class="rq-hint">{{ floatModal === 'start' ? $t('cashier.shift.startHint') : $t('cashier.shift.endHint') }}</p>
        <div class="float-row">
          <span class="fld-label">{{ $t('cashier.shift.floatLabel') }}</span>
          <div class="amount-wrap">
            <span class="currency">TZS</span>
            <input v-model.number="floatAmount" class="sm-input" type="number" min="0" step="any" />
          </div>
        </div>
        <p v-if="error" class="rq-error">{{ error }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" :disabled="busy" @click="floatModal = null">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="busy || !(floatAmount >= 0)" @click="confirmFloat">
            <i class="fas fa-check" aria-hidden="true"></i> {{ busy ? $t('common.saving') : $t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { posApi } from '@/api'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import '@/pages/store/store-shared.css'

const { t } = useI18n()
const authStore = useAuthStore()

const current = ref(null)
const shifts = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 10 })
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const floatModal = ref(null)
const floatAmount = ref(null)

const hotelName = computed(() => authStore.tenant?.hotel_name || '')
const isOpen = computed(() => current.value?.status === 'open')

async function load() {
  loading.value = true
  try {
    const [{ data: cur }, { data: list }] = await Promise.all([
      posApi.shiftCurrent(),
      posApi.shifts({ per_page: 10, page: meta.value.current_page }),
    ])
    current.value = cur.data
    shifts.value = list.data || []
    meta.value = {
      current_page: list.current_page,
      last_page: list.last_page,
      total: list.total,
      per_page: list.per_page,
    }
  } finally {
    loading.value = false
  }
}

function goPage(page) {
  meta.value.current_page = page
  load()
}

function openStartModal() {
  error.value = ''
  floatAmount.value = null
  floatModal.value = 'start'
}

function openEndModal() {
  error.value = ''
  floatAmount.value = null
  floatModal.value = 'end'
}

async function confirmFloat() {
  busy.value = true
  error.value = ''
  try {
    const payload = { [floatModal.value === 'start' ? 'opening_float' : 'closing_float']: floatAmount.value }
    await (floatModal.value === 'start' ? posApi.shiftOpen(payload) : posApi.shiftClose(payload))
    floatModal.value = null
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || t('common.actionFailed')
  } finally {
    busy.value = false
  }
}

function fmtTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function fmtNum(n) {
  return Number(n ?? 0).toLocaleString()
}

function fmtSigned(n) {
  if (n == null) return '—'
  const signed = Number(n) > 0 ? '+' : ''
  return `${signed}${Number(n).toLocaleString()}`
}

function varianceClass(variance) {
  if (variance == null) return ''
  return Number(variance) > 0 ? 'up' : Number(variance) < 0 ? 'down' : ''
}

onMounted(load)
</script>

<style scoped>
.hotel-name { font-size: 12px; color: #64748b; font-weight: 600; }
.shift-skeleton { display: flex; flex-direction: column; gap: 10px; }
.shift-card { border-radius: 12px; padding: 18px 20px; border: 1px solid #e2e8f0; }
.shift-card.open { background: linear-gradient(135deg, #e8f1fa, #f8fbff); border-color: var(--mrk-blue-tint, #b0cde9); }
.shift-card.closed { background: #f8fafc; }
.shift-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.shift-badge {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
  border-radius: 999px; padding: 6px 14px;
}
.shift-badge.open { background: #dcfce7; color: #15803d; }
.shift-badge.closed { background: #e2e8f0; color: #64748b; }
.shift-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
.stat { display: flex; flex-direction: column; gap: 4px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
.stat span { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
.stat strong { font-size: 15px; color: var(--mrk-charcoal, #333); }
.shift-hint { color: #64748b; font-size: 13px; margin: 0; }
.table-scroll { overflow-x: auto; }
.num { text-align: right; }
td.num { font-variant-numeric: tabular-nums; }
.status-badge { font-size: 11px; font-weight: 800; text-transform: uppercase; border-radius: 999px; padding: 3px 10px; }
.status-badge.open { background: #dcfce7; color: #15803d; }
.status-badge.closed { background: #e2e8f0; color: #64748b; }
.up { color: #15803d; }
.down { color: #dc2626; }
.pagination { padding: 12px 16px; border-top: 1px solid #e2e8f0; }
.float-row { display: flex; flex-direction: column; gap: 6px; margin: 4px 0 14px; }
.amount-wrap { display: flex; align-items: center; gap: 8px; }
.currency { font-size: 13px; font-weight: 800; color: var(--mrk-blue, #005eb8); }
.rq-error { color: #dc2626; font-size: 13px; margin: 0 0 12px; }
.float-dialog { max-width: 460px; }
</style>