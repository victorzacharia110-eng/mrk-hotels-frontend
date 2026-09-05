<!--
  Cashiering Center page (route: /app/payments/cashiering,
  name: hotel-payments-cashiering).
  Daily cashiering console for the receptionist: payments taken for a business
  date, grouped totals by method, record-payment form and verification of
  guest-pushed mobile money.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('receptionPanel.cashieringCenter') }}</h1>
        <p class="muted">{{ $t('receptionPanel.cashieringSubtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <button class="btn btn-primary" @click="openRecord">
          <i class="fas fa-plus"></i> {{ $t('payments.recordPayment') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card" style="padding: 14px 20px; margin-bottom: 16px;">
      <div class="form-group" style="margin: 0;">
        <label>{{ $t('nightAudit.businessDate') }}</label>
        <input v-model="selectedDate" type="date" class="input" style="max-width: 220px;" @change="load" />
      </div>
    </div>

    <div class="card" style="padding: 20px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px;"><i class="fas fa-money-bill-wave" style="color: var(--mrk-blue);"></i> {{ $t('receptionPanel.collectionsForDate') }}</h3>
      <div class="kpi-grid">
        <div v-for="(amount, method) in totals" :key="method" class="kpi">
          <span class="kpi-value">{{ fmt(amount) }}</span>
          <span class="kpi-label capitalize">{{ methodLabel(method) }}</span>
        </div>
        <div class="kpi total">
          <span class="kpi-value">{{ fmt(total) }}</span>
          <span class="kpi-label">{{ $t('receptionPanel.totalCollected') }}</span>
        </div>
      </div>
    </div>

    <div class="card" style="padding: 20px;">
      <h3 style="margin: 0 0 12px;"><i class="fas fa-list" style="color: var(--mrk-blue);"></i> {{ $t('payments.title') }}</h3>
      <div v-if="loading" class="alert alert-info" style="margin: 0;">{{ $t('common.loading') }}</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>{{ $t('payments.tablePayment') }}</th>
            <th>{{ $t('payments.guest') }}</th>
            <th>{{ $t('payments.amount') }}</th>
            <th>{{ $t('payments.method') }}</th>
            <th>{{ $t('payments.status') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in payments" :key="p.payment_id">
            <td>{{ p.paid_by || '—' }}</td>
            <td>{{ p.reservation?.guest_name || (p.payment_id ? p.reservation_id?.slice(0, 8) : '—') }}</td>
            <td>{{ fmt(p.amount) }}</td>
            <td class="capitalize">{{ methodLabel(p.payment_method) }}</td>
            <td>
              <span class="badge" :class="p.payment_status === 'completed' ? 'badge-success' : 'badge-warning'">
                {{ statusLabel(p.payment_status) }}
              </span>
            </td>
            <td>
              <button
                v-if="p.awaiting_confirmation"
                class="btn btn-sm btn-primary"
                :disabled="busy === p.payment_id"
                @click="confirmPayment(p)"
              >
                <i class="fas fa-check"></i> {{ $t('payments.actionConfirm') }}
              </button>
            </td>
          </tr>
          <tr v-if="!payments.length && !loading">
            <td colspan="6" class="muted">{{ $t('payments.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Record payment modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ $t('payments.recordPayment') }}</h3>
          <button class="modal-close" :aria-label="$t('common.close')" @click="showModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>{{ $t('payments.guest') }} *</label>
            <select v-model="form.reservation_id" class="input">
              <option v-for="r in reservations" :key="r.reservation_id" :value="r.reservation_id">
                {{ r.guest_name }} · {{ r.room?.room_number || r.room_number || '' }} · TZS {{ r.balance_due ?? r.balance ?? 0 }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('payments.amountTzs') }}</label>
            <input v-model.number="form.amount" type="number" min="0" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('payments.method') }}</label>
            <select v-model="form.payment_method" class="input" @change="methodChanged">
              <option v-for="m in methodOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
          <div v-if="requiresProvider(form.payment_method)" class="form-group">
            <label>{{ $t('payments.provider') }}</label>
            <select v-model="form.payment_provider" class="input">
              <option v-for="p in providersFor(form.payment_method)" :key="p" :value="p">{{ p.replace('_', ' ') }}</option>
            </select>
          </div>
          <div v-if="form.payment_method === 'bank'" class="form-group">
            <label>{{ $t('payments.transactionReference') }}</label>
            <input v-model="form.transaction_reference" type="text" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('payments.paidBy') }}</label>
            <input v-model="form.paid_by" type="text" class="input" />
          </div>
          <p v-if="error" class="alert alert-error" style="margin: 8px 0 0;">{{ error }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" @click="showModal = false">{{ $t('common.cancel') }}</button>
          <button class="btn btn-primary" :disabled="saving" @click="savePayment">
            <i class="fas fa-save"></i> {{ saving ? $t('common.loading') : $t('payments.savePayment') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { paymentApi, reservationApi } from '@/api'
import { METHOD_CASH, PAYMENT_METHODS, requiresProvider, providersFor } from '@/utils/payments'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()

const today = new Date().toISOString().slice(0, 10)
const selectedDate = ref(today)
const payments = ref([])
const reservations = ref([])
const loading = ref(false)
const saving = ref(false)
const busy = ref(null)
const success = ref('')
const error = ref('')
const showModal = ref(false)

const methodOptions = [
  { value: METHOD_CASH, label: t('paymentFields.methods.cash') },
  { value: 'mobile_money', label: t('paymentFields.methods.mobile_money') },
  { value: 'bank', label: t('paymentFields.methods.bank') || 'Bank transfer' },
  { value: 'card', label: t('paymentFields.methods.card') },
  { value: 'selcom', label: t('paymentFields.methods.selcom') },
  { value: 'clickpesa', label: 'ClickPesa' },
]

const form = ref({ reservation_id: null, amount: null, payment_method: METHOD_CASH, payment_provider: null, paid_by: '', transaction_reference: '' })

const totals = computed(() => {
  const map = {}
  for (const p of payments.value) {
    if (p.payment_status === 'completed' || p.payment_status === 'awaiting_confirmation') {
      map[p.payment_method] = (map[p.payment_method] || 0) + Number(p.amount)
    }
  }
  return map
})

const total = computed(() => Object.values(totals.value).reduce((a, b) => a + b, 0))

const fmt = (n) => 'TZS ' + Number(n || 0).toLocaleString()

function methodLabel(m) {
  const found = methodOptions.find((o) => o.value === m)
  return found ? found.label : String(m || '').replace(/_/g, ' ')
}

function statusLabel(s) {
  if (s === 'completed') return t('payments.statusCompleted')
  if (s === 'awaiting_confirmation') return t('payments.statusAwaiting')
  return String(s || '').replace(/_/g, ' ')
}

function methodChanged() {
  form.value.payment_provider = null
  if (form.value.payment_method === METHOD_CASH) form.value.payment_provider = null
}

function openRecord() {
  error.value = ''
  form.value = { reservation_id: reservations.value[0]?.reservation_id || null, amount: null, payment_method: METHOD_CASH, payment_provider: null, paid_by: '', transaction_reference: '' }
  showModal.value = true
}

async function load() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const [payRes, resRes] = await Promise.all([
      paymentApi.index({ from: selectedDate.value, to: selectedDate.value, per_page: 100 }),
      reservationApi.index({ per_page: 100 }),
    ])
    payments.value = Array.isArray(payRes.data) ? payRes.data : payRes.data?.data || []
    reservations.value = (resRes.data?.data || []).filter((r) => ['pending', 'confirmed', 'checked_in'].includes(r.status))
  } catch (err) {
    error.value = err.response?.data?.message || t('payments.loadError')
  } finally {
    loading.value = false
  }
}

async function savePayment() {
  if (!form.value.reservation_id || !form.value.amount) return
  saving.value = true
  error.value = ''
  try {
    await paymentApi.store({ ...form.value, payment_status: 'completed' })
    showModal.value = false
    success.value = t('payments.createSuccess')
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('payments.createError')
  } finally {
    saving.value = false
  }
}

async function confirmPayment(p) {
  busy.value = p.payment_id
  error.value = ''
  try {
    await paymentApi.confirm(p.payment_id, {})
    success.value = t('payments.confirmed')
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('payments.confirmReferencePrompt')
  } finally {
    busy.value = null
  }
}

onMounted(load)
</script>