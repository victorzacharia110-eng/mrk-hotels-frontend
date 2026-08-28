<!--
  Night Audit — Insert Transaction page (route: /app/night-audit/transactions,
  name: hotel-night-audit-transactions).
  Posts a manual transaction (room/F&B/laundry/fun-game/misc charge) against a
  business date that is still open for the night audit. Live tax/total preview,
  and a list of the transactions already posted for the selected date.
  Future dates and already-closed days are rejected by the backend.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('nightAudit.insertTitle') }}</h1>
        <p class="muted">{{ $t('nightAudit.insertSubtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="two-col">
      <!-- Transaction details / rate -->
      <div class="card" style="padding: 20px;">
        <h3 style="margin: 0 0 16px;"><i class="fas fa-file-invoice" style="color: var(--mrk-blue);"></i> {{ $t('nightAudit.transactionDetails') }}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>{{ $t('nightAudit.businessDate') }} *</label>
            <input v-model="form.audit_date" type="date" class="input" :max="todayStr" />
          </div>
          <div class="form-group">
            <label>{{ $t('nightAudit.chargeType') }} *</label>
            <select v-model="form.charge_type" class="input">
              <option v-for="(label, key) in chargeTypeLabels" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('nightAudit.reservationNo') }}</label>
            <input v-model="form.reservation_id" type="text" class="input" :placeholder="t('nightAudit.reservationNoPlaceholder')" />
          </div>
          <div class="form-group">
            <label>{{ $t('nightAudit.roomNo') }}</label>
            <input v-model="form.room_number" type="text" class="input" />
          </div>
        </div>

        <h3 style="margin: 20px 0 16px;"><i class="fas fa-calculator" style="color: var(--mrk-blue);"></i> {{ $t('nightAudit.rateAndBilling') }}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>{{ $t('nightAudit.amount') }} (TSh, {{ $t('nightAudit.taxExcl') }}) *</label>
            <input v-model.number="form.amount" type="number" min="0" class="input" @input="recalc" />
          </div>
          <div class="form-group">
            <label>{{ $t('nightAudit.taxPercent') }} (%)</label>
            <input v-model.number="form.tax_percent" type="number" min="0" max="100" class="input" @input="recalc" />
          </div>
          <div class="form-group">
            <label>{{ $t('nightAudit.taxAmount') }}</label>
            <input :value="fmtMoney(taxAmount)" class="input" readonly />
          </div>
          <div class="form-group">
            <label>{{ $t('nightAudit.totalAmount') }}</label>
            <input :value="fmtMoney(totalAmount)" class="input strong-input" readonly />
          </div>
        </div>

        <!-- Billing summary -->
        <div class="billing-summary">
          <h4>{{ $t('nightAudit.billingSummary') }}</h4>
          <div class="billing-row"><span>{{ $t('nightAudit.roomCharges') }}</span><span>{{ fmtMoney(amount) }}</span></div>
          <div class="billing-row"><span>{{ $t('nightAudit.taxes') }}</span><span>{{ fmtMoney(taxAmount) }}</span></div>
          <div class="billing-row total"><span>{{ $t('nightAudit.dueAmount') }}</span><span>{{ fmtMoney(totalAmount) }}</span></div>
        </div>

        <h3 style="margin: 20px 0 16px;"><i class="fas fa-user" style="color: var(--mrk-blue);"></i> {{ $t('nightAudit.guestInfo') }}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>{{ $t('nightAudit.guestName') }}</label>
            <input v-model="form.guest_name" type="text" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('nightAudit.description') }}</label>
            <input v-model="form.description" type="text" class="input" :placeholder="t('nightAudit.descriptionPlaceholder')" />
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" :disabled="submitting || closed" @click="submit">
            <i class="fas fa-circle-plus"></i>
            {{ submitting ? $t('common.saving') : $t('nightAudit.insert') }}
          </button>
          <span v-if="closed" class="closed-note"><i class="fas fa-lock"></i> {{ $t('nightAudit.dayClosedNote') }}</span>
        </div>
      </div>

      <!-- Posted transactions for this date -->
      <div class="card" style="padding: 20px; align-self: start;">
        <h3 style="margin: 0 0 16px;"><i class="fas fa-list" style="color: var(--mrk-blue);"></i> {{ $t('nightAudit.postedTransactions') }}</h3>
        <div v-if="!transactions.length" class="muted" style="text-align: center; padding: 20px;">
          {{ $t('nightAudit.noTransactions') }}
        </div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>{{ $t('nightAudit.chargeType') }}</th>
              <th>{{ $t('nightAudit.description') }}</th>
              <th>{{ $t('nightAudit.totalAmount') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="txn in transactions" :key="txn.adjustment_id">
              <td class="capitalize">{{ chargeTypeLabels[txn.charge_type] || txn.charge_type }}</td>
              <td>{{ txn.description || '—' }}</td>
              <td>{{ fmtMoney(txn.total_amount) }}</td>
              <td>
                <button class="btn-danger-mini" :disabled="deleting === txn.adjustment_id" @click="askDelete(txn)">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ConfirmModal
      :show="showDelete"
      :title="t('nightAudit.deleteConfirmTitle')"
      :body="t('nightAudit.deleteConfirmBody', { description: (txnToDelete?.description || txnToDelete?.charge_type || '') })"
      danger
      :busy="!!deleting"
      :confirm-label="t('common.delete')"
      @confirm="confirmDelete"
      @cancel="showDelete = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { nightAuditApi } from '@/api'
import { useI18n } from 'vue-i18n'
import ConfirmModal from '@/components/ConfirmModal.vue'

const { t } = useI18n()

const todayStr = new Date().toISOString().slice(0, 10)

const form = ref({
  audit_date: todayStr,
  charge_type: 'room',
  reservation_id: '',
  room_number: '',
  amount: 0,
  tax_percent: 18,
  guest_name: '',
  description: '',
})

const chargeTypeLabels = computed(() => ({
  room: t('nightAudit.chargeRoom'),
  fnb: t('nightAudit.chargeFnb'),
  laundry: t('nightAudit.chargeLaundry'),
  fun_games: t('nightAudit.chargeFunGames'),
  misc: t('nightAudit.chargeMisc'),
}))

const transactions = ref([])
const closed = ref(false)
const loading = ref(false)
const submitting = ref(false)
const deleting = ref('')
const showDelete = ref(false)
const txnToDelete = ref(null)
const error = ref('')
const success = ref('')

const amount = computed(() => Number(form.value.amount) || 0)
const taxPercent = computed(() => Number(form.value.tax_percent) || 0)
const taxAmount = computed(() => Math.round(amount.value * taxPercent.value) / 100)
const totalAmount = computed(() => Math.round((amount.value + taxAmount.value) * 100) / 100)

function recalc() {
  void (0)
}

function fmtMoney(v) {
  return v != null ? `TZS ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0 })}` : '—'
}

function resetForm() {
  form.value = {
    audit_date: todayStr,
    charge_type: 'room',
    reservation_id: '',
    room_number: '',
    amount: 0,
    tax_percent: 18,
    guest_name: '',
    description: '',
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { date: form.value.audit_date }
    const res = await nightAuditApi.transactions(params)
    transactions.value = res.data.adjustments || []
    closed.value = false
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
    transactions.value = []
  } finally {
    loading.value = false
  }
}

async function checkClosed() {
  try {
    const res = await nightAuditApi.report({ date: form.value.audit_date })
    closed.value = !!res.data.closed
    if (closed.value) {
      error.value = t('nightAudit.dayClosedNote')
    } else {
      error.value = ''
    }
  } catch (err) {
    closed.value = false
    error.value = err.response?.data?.message || ''
  }
}

async function submit() {
  if (!form.value.audit_date || amount.value <= 0) {
    error.value = t('nightAudit.requiredFields')
    return
  }
  submitting.value = true
  error.value = ''
  success.value = ''
  try {
    await nightAuditApi.insertTransaction({
      audit_date: form.value.audit_date,
      charge_type: form.value.charge_type,
      amount: amount.value,
      tax_percent: taxPercent.value,
      reservation_id: form.value.reservation_id || undefined,
      room_number: form.value.room_number || undefined,
      guest_name: form.value.guest_name || undefined,
      description: form.value.description || undefined,
    })
    success.value = t('nightAudit.insertSuccess')
    resetForm()
    await load()
    await checkClosed()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    submitting.value = false
  }
}

function askDelete(txn) {
  error.value = ''
  txnToDelete.value = txn
  showDelete.value = true
}

async function confirmDelete() {
  const txn = txnToDelete.value
  if (!txn) return
  deleting.value = txn.adjustment_id
  success.value = ''
  error.value = ''
  try {
    await nightAuditApi.deleteTransaction(txn.adjustment_id)
    showDelete.value = false
    txnToDelete.value = null
    success.value = t('nightAudit.deleteSuccess')
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    deleting.value = ''
  }
}

onMounted(async () => {
  await checkClosed()
  await load()
})
</script>

<style scoped>
.dashboard-page { padding: 32px 20px; }
.page-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
.page-head h1 { font-size: 28px; font-weight: 800; }
.muted { color: #757575; font-size: 12px; margin-top: 2px; }
.two-col { display: grid; grid-template-columns: 1fr 380px; gap: 16px; align-items: start; }
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.strong-input { font-weight: 700; color: #005EB8; background: #f0f7ff; }
.billing-summary { margin-top: 16px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
.billing-summary h4 { margin: 0 0 10px; font-size: 14px; color: #334155; }
.billing-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; color: #475569; }
.billing-row.total { border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 10px; font-weight: 800; color: #062A52; font-size: 16px; }
.form-actions { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
.closed-note { color: #b45309; font-size: 13px; }
.btn-danger-mini { background: #fee2e2; color: #b91c1c; border: none; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
.btn-danger-mini:hover { background: #fecaca; }
.capitalize { text-transform: capitalize; }
@media (max-width: 992px) { .two-col { grid-template-columns: 1fr; } }
@media (max-width: 768px) {
  .dashboard-page { padding: 20px 16px; }
  .page-head { flex-direction: column; align-items: flex-start; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
