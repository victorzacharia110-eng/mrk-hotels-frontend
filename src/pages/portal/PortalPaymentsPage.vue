<!--
  PortalPaymentsPage — payment history and new payment (route: /portal/payments).
  Supports mobile money (M-Pesa, Tigo Pesa, Airtel Money) and bank transfers.
-->
<template>
  <div class="portal-payments">
    <div class="page-header">
      <h1>Payments</h1>
      <button class="btn btn-primary" @click="showPayModal = true">
        <i class="fas fa-plus"></i> New Payment
      </button>
    </div>

    <!-- Summary cards -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-icon summary-icon--green"><i class="fas fa-check-circle"></i></div>
        <div>
          <span class="summary-value">TZS {{ totalPaid.toLocaleString() }}</span>
          <span class="summary-label">Total Paid</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-icon summary-icon--amber"><i class="fas fa-clock"></i></div>
        <div>
          <span class="summary-value">TZS {{ totalPending.toLocaleString() }}</span>
          <span class="summary-label">Pending</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-icon summary-icon--blue"><i class="fas fa-calendar"></i></div>
        <div>
          <span class="summary-value">TZS {{ monthlyTotal.toLocaleString() }}</span>
          <span class="summary-label">This Month</span>
        </div>
      </div>
    </div>

    <!-- Search & filter -->
    <div class="filters-bar card">
      <div class="search-input">
        <i class="fas fa-search"></i>
        <input v-model="search" type="text" placeholder="Search by reference, method..." @input="debouncedSearch" />
        <button v-if="search" class="search-clear" @click="search = ''; fetchPayments()"><i class="fas fa-times"></i></button>
      </div>
      <select v-model="statusFilter" class="filter-select" @change="fetchPayments()">
        <option value="">All Status</option>
        <option value="confirmed">Confirmed</option>
        <option value="pending">Pending</option>
        <option value="failed">Failed</option>
      </select>
      <select v-model="methodFilter" class="filter-select" @change="fetchPayments()">
        <option value="">All Methods</option>
        <option value="mobile_money">Mobile Money</option>
        <option value="bank_transfer">Bank Transfer</option>
      </select>
    </div>

    <div v-if="loading" class="loading-spinner"><div class="spinner"></div></div>

    <template v-else>
      <div class="card table-card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in payments" :key="p.id || p.payment_id">
                <td>{{ formatDate(p.created_at) }}</td>
                <td class="ref-cell">{{ p.reference_number || p.transaction_reference || '—' }}</td>
                <td>
                  <span class="method-badge" :class="`method-badge--${methodKey(p.payment_method)}`">
                    <i :class="methodIcon(p.payment_method)"></i> {{ p.payment_method || '—' }}
                  </span>
                </td>
                <td class="amount-cell">TZS {{ Number(p.amount || 0).toLocaleString() }}</td>
                <td>
                  <span class="status-pill" :class="`status-pill--${p.status}`">{{ p.status }}</span>
                </td>
                <td>{{ p.description || p.purpose || '—' }}</td>
              </tr>
              <tr v-if="!payments.length">
                <td colspan="6" class="empty-cell">No payments found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="btn btn-sm btn-secondary" :disabled="page <= 1" @click="page--; fetchPayments()">
          <i class="fas fa-chevron-left"></i> Previous
        </button>
        <span class="page-info">Page {{ page }} of {{ totalPages }}</span>
        <button class="btn btn-sm btn-secondary" :disabled="page >= totalPages" @click="page++; fetchPayments()">
          Next <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </template>

    <!-- New Payment Modal -->
    <div v-if="showPayModal" class="modal-overlay" @click.self="showPayModal = false">
      <div class="modal-content">
        <h2>Make a Payment</h2>
        <div v-if="payError" class="auth-error">{{ payError }}</div>
        <div v-if="paySuccess" class="auth-success">{{ paySuccess }}</div>

        <form v-if="!paySuccess" @submit.prevent="initiatePayment" class="auth-form">
          <div class="input-group">
            <label>Amount (TZS)</label>
            <input v-model.number="payForm.amount" type="number" class="auth-input" required min="100" placeholder="Enter amount" />
          </div>

          <div class="input-group">
            <label>Payment Method</label>
            <div class="method-selector">
              <button type="button"
                class="method-option"
                :class="{ active: payForm.payment_method === 'mobile_money' }"
                @click="payForm.payment_method = 'mobile_money'"
              >
                <i class="fas fa-mobile-alt"></i>
                <span>Mobile Money</span>
              </button>
              <button type="button"
                class="method-option"
                :class="{ active: payForm.payment_method === 'selcom' }"
                @click="payForm.payment_method = 'selcom'"
              >
                <i class="fas fa-qrcode"></i>
                <span>Selcom</span>
              </button>
              <button type="button"
                class="method-option"
                :class="{ active: payForm.payment_method === 'bank_transfer' }"
                @click="payForm.payment_method = 'bank_transfer'"
              >
                <i class="fas fa-university"></i>
                <span>Bank Transfer</span>
              </button>
            </div>
          </div>

          <!-- Mobile money specific fields -->
          <template v-if="payForm.payment_method === 'mobile_money'">
            <div class="input-group">
              <label>Provider</label>
              <select v-model="payForm.provider" class="auth-input" required>
                <option value="" disabled>Select provider</option>
                <option value="mpesa">M-Pesa</option>
                <option value="tigopesa">Tigo Pesa</option>
                <option value="airtelmoney">Airtel Money</option>
                <option value="halopesa">HaloPesa</option>
                <option value="ezypesa">EzyPesa</option>
              </select>
            </div>
            <div class="input-group">
              <label>Phone Number</label>
              <input v-model="payForm.phone" type="tel" class="auth-input" required placeholder="+255 712 345 678" />
            </div>
          </template>

          <!-- Selcom USSD push fields -->
          <template v-if="payForm.payment_method === 'selcom'">
            <div class="input-group">
              <label>Phone Number</label>
              <input v-model="payForm.phone" type="tel" class="auth-input" required placeholder="+255 712 345 678" />
              <p class="input-hint">A USSD prompt will be sent to this number via Selcom.</p>
            </div>
          </template>

          <!-- Bank transfer specific fields -->
          <template v-if="payForm.payment_method === 'bank_transfer'">
            <div class="input-group">
              <label>Bank Name</label>
              <select v-model="payForm.bank_name" class="auth-input" required>
                <option value="" disabled>Select bank</option>
                <option value="crdb">CRDB Bank</option>
                <option value="nmb">NMB Bank</option>
                <option value="stanbic">Stanbic Bank</option>
                <option value="absa">ABSA Bank</option>
                <option value="ncba">NCBA Bank</option>
                <option value="Equity">Equity Bank</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="input-group">
              <label>Account Number (from)</label>
              <input v-model="payForm.account_number" type="text" class="auth-input" required placeholder="Your bank account number" />
            </div>
            <div class="input-group">
              <label>Transaction Reference</label>
              <input v-model="payForm.transaction_reference" type="text" class="auth-input" required placeholder="Bank reference / receipt number" />
            </div>
          </template>

          <div class="input-group">
            <label>Description (optional)</label>
            <input v-model="payForm.description" type="text" class="auth-input" placeholder="e.g. Subscription payment" />
          </div>

          <button type="submit" class="auth-submit" :disabled="paySubmitting">
            {{ paySubmitting ? 'Processing...' : 'Pay Now' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { portalPaymentApi } from '@/api'

const payments = ref([])
const loading = ref(true)
const search = ref('')
const statusFilter = ref('')
const methodFilter = ref('')
const page = ref(1)
const perPage = 15
const total = ref(0)
const totalPages = ref(0)

const showPayModal = ref(false)
const paySubmitting = ref(false)
const payError = ref(null)
const paySuccess = ref(null)
const payForm = reactive({
  amount: null,
  payment_method: 'mobile_money',
  provider: '',
  phone: '',
  bank_name: '',
  account_number: '',
  transaction_reference: '',
  description: '',
})

let searchTimeout = null
function debouncedSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { page.value = 1; fetchPayments() }, 300)
}

const totalPaid = computed(() => payments.value.filter((p) => p.status === 'confirmed').reduce((s, p) => s + Number(p.amount || 0), 0))
const totalPending = computed(() => payments.value.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0))
const monthlyTotal = computed(() => {
  const now = new Date()
  return payments.value
    .filter((p) => {
      const d = new Date(p.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && p.status === 'confirmed'
    })
    .reduce((s, p) => s + Number(p.amount || 0), 0)
})

async function fetchPayments() {
  loading.value = true
  try {
    const params = { page: page.value, per_page: perPage }
    if (search.value) params.search = search.value
    if (statusFilter.value) params.status = statusFilter.value
    if (methodFilter.value) params.payment_method = methodFilter.value
    const { data } = await portalPaymentApi.index(params)
    payments.value = data.data || data.payments || data
    total.value = data.total || payments.value.length
    totalPages.value = data.last_page || Math.ceil(total.value / perPage)
  } catch {
    payments.value = []
  } finally {
    loading.value = false
  }
}

async function initiatePayment() {
  payError.value = null
  paySuccess.value = null
  paySubmitting.value = true
  try {
    const payload = {
      amount: payForm.amount,
      payment_method: payForm.payment_method,
      description: payForm.description || 'Subscription payment',
    }
    if (payForm.payment_method === 'mobile_money') {
      payload.phone = payForm.phone
    } else if (payForm.payment_method === 'selcom') {
      payload.phone = payForm.phone
    } else if (payForm.payment_method === 'bank_transfer') {
      payload.bank_name = payForm.bank_name
      payload.account_number = payForm.account_number
      payload.transaction_reference = payForm.transaction_reference
    }
    await portalPaymentApi.initiate(payload)
    if (payForm.payment_method === 'mobile_money' || payForm.payment_method === 'selcom') {
      paySuccess.value = 'Payment request sent. Confirm the prompt on your phone.'
    } else {
      paySuccess.value = 'Bank transfer recorded. It will be confirmed once verified by our team.'
    }
    fetchPayments()
    setTimeout(() => { showPayModal.value = false; paySuccess.value = null }, 2500)
  } catch (e) {
    payError.value = e.response?.data?.message || 'Payment failed. Please try again.'
  } finally {
    paySubmitting.value = false
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function methodKey(method) {
  if (!method) return 'other'
  const m = method.toLowerCase()
  if (m.includes('mpesa') || m.includes('tigo') || m.includes('airtel') || m.includes('halo') || m.includes('ezy') || m === 'mobile_money' || m === 'selcom') return 'mobile'
  if (m.includes('bank') || m === 'bank_transfer') return 'bank'
  if (m.includes('card')) return 'card'
  return 'other'
}

function methodIcon(method) {
  const k = methodKey(method)
  return { mobile: 'fas fa-mobile-alt', bank: 'fas fa-university', card: 'fas fa-credit-card', other: 'fas fa-money-bill' }[k]
}

onMounted(fetchPayments)
</script>

<style scoped>
.portal-payments { max-width: 1100px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h1 { font-size: 24px; font-weight: 800; margin: 0; }

/* Summary */
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
.summary-card { display: flex; align-items: center; gap: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
.summary-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.summary-icon--green { background: #d1fae5; color: #059669; }
.summary-icon--amber { background: #fef3c7; color: #d97706; }
.summary-icon--blue { background: #dbeafe; color: #2563eb; }
.summary-value { display: block; font-size: 20px; font-weight: 800; color: #1e293b; }
.summary-label { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }

/* Filters */
.filters-bar { display: flex; gap: 12px; padding: 12px 16px; margin-bottom: 16px; }
.search-input { display: flex; align-items: center; gap: 8px; flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 12px; }
.search-input i { color: #94a3b8; font-size: 13px; }
.search-input input { flex: 1; border: none; background: transparent; padding: 8px 0; font-size: 13px; outline: none; }
.search-clear { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 12px; }
.filter-select { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; background: #fff; min-width: 120px; }

/* Table */
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
.table-card { padding: 0; overflow: hidden; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
.data-table thead th { background: #f8fafc; font-weight: 600; color: #334155; }
.data-table tbody tr:hover { background: #f8fafc; }
.empty-cell { text-align: center; color: #94a3b8; padding: 32px 16px !important; }
.ref-cell { font-family: monospace; font-size: 12px; }
.amount-cell { font-weight: 600; }

.method-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
.method-badge--mobile { background: #d1fae5; color: #059669; }
.method-badge--bank { background: #dbeafe; color: #2563eb; }
.method-badge--card { background: #ede9fe; color: #7c3aed; }
.method-badge--other { background: #f1f5f9; color: #475569; }

.status-pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
.status-pill--confirmed { background: #d1fae5; color: #059669; }
.status-pill--pending { background: #fef3c7; color: #d97706; }
.status-pill--failed { background: #fee2e2; color: #dc2626; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-content { background: #fff; border-radius: 12px; padding: 32px; width: 90%; max-width: 480px; max-height: 85vh; overflow-y: auto; }
.modal-content h2 { font-size: 20px; font-weight: 700; margin: 0 0 20px; }

.method-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.method-option { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; cursor: pointer; font-size: 12px; color: #475569; transition: border-color 0.15s; }
.method-option:hover { border-color: #3b82f6; }
.method-option.active { border-color: #3b82f6; background: #eff6ff; color: #2563eb; }
.method-option i { font-size: 18px; }

/* Google-style form (shared) */
.auth-form { display: flex; flex-direction: column; gap: 16px; }
.input-group label { display: block; font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 4px; }
.auth-input { width: 100%; padding: 11px 14px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px; color: #202124; background: #fff; outline: none; box-sizing: border-box; }
.auth-input:focus { border-color: #1a73e8; }
.auth-submit { width: 100%; padding: 10px 24px; background: #1a73e8; color: #fff; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; }
.auth-submit:hover { background: #1765cc; }
.auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.auth-error { background: #fce8e6; color: #c5221f; padding: 10px 14px; border-radius: 4px; font-size: 13px; margin-bottom: 16px; }
.auth-success { background: #e6f4ea; color: #137333; padding: 10px 14px; border-radius: 4px; font-size: 13px; margin-bottom: 16px; }
.input-hint { font-size: 12px; color: #5f6368; margin-top: 4px; }

/* Pagination */
.pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
.page-info { font-size: 13px; color: #64748b; }
.btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
.btn-primary { background: #3b82f6; color: #fff; }
.btn-primary:hover { background: #2563eb; }
.btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 6px 12px; font-size: 12px; }

.loading-spinner { display: flex; justify-content: center; padding: 40px 20px; }
.spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .summary-grid { grid-template-columns: 1fr; }
  .filters-bar { flex-direction: column; }
  .method-selector { grid-template-columns: 1fr; }
}
</style>
