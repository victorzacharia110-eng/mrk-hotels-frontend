<!--
  Company Data page (route: /app/payments/company-data,
  name: hotel-payments-company-data).
  The corporate-client directory — companies the front desk references when
  posting a stay to a company's credit. Companies carry a credit profile
  (available credit, current balance, status) driving the receivables.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('receptionPanel.companyData') }}</h1>
        <p class="muted">{{ $t('receptionPanel.companyDataSubtitle') }}</p>
      </div>
      <button class="btn btn-secondary" :disabled="companiesLoading" @click="reset">
        <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
      </button>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card" style="padding: 20px;">
      <div class="head-actions" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
        <div>
          <h3 style="margin: 0;">{{ $t('receptionPanel.corporateDirectory') }}</h3>
          <p class="muted" style="margin: 2px 0 0;">{{ $t('receptionPanel.corporateDirectorySubtitle') }}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input
            v-model="companySearch"
            type="search"
            class="input"
            :placeholder="$t('receptionPanel.searchCompanies')"
            style="min-width: 240px;"
          />
          <button v-if="canEdit" class="btn btn-primary" style="white-space: nowrap;" @click="openCompanyAdd">
            <i class="fas fa-plus"></i> {{ $t('receptionPanel.addCompany') }}
          </button>
        </div>
      </div>

      <div v-if="companiesLoading" class="alert alert-info" style="margin: 0;">{{ $t('common.loading') }}</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" :class="{ 'sortable-col': col.sortKey }" :style="col.sortKey ? 'cursor:pointer; user-select:none;' : ''" @click="col.sortKey && setSort(col.sortKey)">
              {{ $t(col.labelKey) }}
              <span v-if="col.sortKey && sortKey === col.sortKey" class="sort-caret">
                <i class="fas" :class="sortDir === 'asc' ? 'fa-caret-up' : 'fa-caret-down'"></i>
              </span>
            </th>
            <th v-if="canEdit"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in companies" :key="c.company_id">
            <td>
              <button type="button" class="btn btn-link" style="padding: 0;" :title="$t('receptionPanel.viewCompanyStatement')" @click="openPostings(c)">
                <i class="fas fa-building" aria-hidden="true"></i> {{ c.name }}
              </button>
            </td>
            <td>{{ c.contact_person || '—' }}</td>
            <td>{{ countryLabel(c.country_code) }}</td>
            <td>{{ c.email || '—' }}</td>
            <td>{{ c.phone || '—' }}</td>
            <td>
              <span class="badge" :class="statusBadge(c.status)">
                {{ statusLabel(c.status) }}
              </span>
            </td>
            <td class="nowrap">{{ tsh(c.available_credit) }}</td>
            <td class="nowrap">{{ tsh(c.current_balance) }}</td>
            <td v-if="canEdit">
              <div style="display: inline-flex; gap: 8px; align-items: center;">
                <button class="btn btn-sm btn-secondary" @click="openCompanyEdit(c)">
                  <i class="fas fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-danger" @click="askCompanyDelete(c)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!companies.length && !companiesLoading">
            <td :colspan="canEdit ? 9 : 8" class="muted">{{ $t('receptionPanel.noCompanies') }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="!companiesLoading && pagination.last_page > 1" class="pagination-row" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px;">
        <span class="muted">{{ $t('common.pageXOfY', { current: pagination.current_page, total: pagination.last_page }) }}</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm btn-secondary" :disabled="page <= 1 || companiesLoading" @click="goPage(page - 1)">
            <i class="fas fa-chevron-left"></i> {{ $t('common.previous') }}
          </button>
          <button class="btn btn-sm btn-secondary" :disabled="page >= pagination.last_page || companiesLoading" @click="goPage(page + 1)">
            {{ $t('common.next') }} <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Company posted-folio statement: date range, balance, settle (RECEIVE) -->
    <div v-if="postingsModal" class="modal-overlay" @click.self="closePostings">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h3>
            <i class="fas fa-building" aria-hidden="true"></i>
            {{ postingsCompany?.name || '' }}
            <span v-if="postingsBalance !== null" class="badge" :class="Number(postingsBalance) > 0 ? 'badge-warning' : 'badge-success'" style="margin-left: 8px;">
              {{ $t('receptionPanel.postedBalance') }}: {{ tsh(postingsBalance) }}
            </span>
          </h3>
          <button class="modal-close" :aria-label="$t('common.close')" @click="closePostings">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div style="display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;">
            <div class="form-group" style="margin: 0;">
              <label>{{ $t('receptionPanel.fromDate') }}</label>
              <input v-model="postingsFrom" type="date" class="input" @change="loadPostings" />
            </div>
            <div class="form-group" style="margin: 0;">
              <label>{{ $t('receptionPanel.toDate') }}</label>
              <input v-model="postingsTo" type="date" class="input" @change="loadPostings" />
            </div>
            <button class="btn btn-secondary" :disabled="postingsLoading" @click="loadPostings">
              <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
            </button>
            <div style="margin-left: auto; display: flex; align-items: center; gap: 10px;">
              <span v-if="selectedPostings.length" class="muted">{{ $t('receptionPanel.settlingBalance') }}: <strong>{{ tsh(selectedPostingsSum) }}</strong></span>
              <button class="btn btn-primary" :disabled="postingsLoading || !selectedPostings.length" @click="openReceive">
                <i class="fas fa-money-check-dollar"></i> {{ $t('receptionPanel.receive') }}
              </button>
            </div>
          </div>
          <div v-if="postingsError" class="alert alert-error" style="margin: 0 0 12px;">{{ postingsError }}</div>
          <div v-if="postingsLoading" class="alert alert-info" style="margin: 0;">{{ $t('common.loading') }}</div>
          <table v-else class="table">
            <thead>
              <tr>
                <th style="width: 44px;"></th>
                <th>{{ $t('receptionPanel.pDate') }}</th>
                <th>{{ $t('receptionPanel.pDescription') }}</th>
                <th>{{ $t('receptionPanel.pMeans') }}</th>
                <th>{{ $t('receptionPanel.pUser') }}</th>
                <th class="num">{{ $t('receptionPanel.pAmount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in postingsRows" :key="row.id" :class="{ 'row-muted': row.kind === 'payment' }">
                <td>
                  <input
                    v-if="row.kind === 'folio' && Number(row.amount) > 0"
                    v-model="selectedPostings"
                    type="checkbox"
                    :value="row.id"
                    :aria-label="$t('receptionPanel.selectFolio')"
                  />
                </td>
                <td class="nowrap">{{ row.date }}</td>
                <td>
                  <span v-if="row.kind === 'payment'" class="badge badge-success" style="margin-right: 6px;">{{ $t('receptionPanel.pPayment') }}</span>
                  {{ row.description }}
                </td>
                <td class="nowrap">{{ row.means || '—' }}</td>
                <td>{{ row.user }}</td>
                <td class="num">{{ tsh(row.amount) }}</td>
              </tr>
              <tr v-if="!postingsRows.length">
                <td colspan="6" class="muted">{{ $t('receptionPanel.noPostings') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-foot">
          <span class="muted" style="margin-right: auto;">
            {{ $t('receptionPanel.totalPosted') }}: {{ tsh(postingsTotalPosted) }}
            <span style="margin-left: 12px;">{{ $t('receptionPanel.totalReceived') }}: {{ tsh(postingsTotalReceived) }}</span>
          </span>
          <button class="btn btn-secondary" @click="closePostings">{{ $t('common.close') }}</button>
        </div>
      </div>
    </div>

    <!-- Receive settlement amount -->
    <div v-if="receiveModal" class="modal-overlay" @click.self="receiveModal = false">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ $t('receptionPanel.receivePayment') }}</h3>
          <button class="modal-close" :aria-label="$t('common.close')" @click="receiveModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <p class="muted" style="margin-top: 0;">{{ $t('receptionPanel.receiveFrom', { company: postingsCompany?.name || '' }) }}</p>
          <div class="form-group">
            <label>{{ $t('receptionPanel.settleAmount') }} *</label>
            <input v-model.number="receiveForm.amount" type="number" min="0.01" step="0.01" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('payments.method') }}</label>
            <select v-model="receiveForm.payment_method" class="input" @change="receiveMethodChanged">
              <option v-for="m in methodOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
          <div v-if="requiresProvider(receiveForm.payment_method)" class="form-group">
            <label>{{ $t('payments.provider') }}</label>
            <select v-model="receiveForm.payment_provider" class="input">
              <option v-for="p in providersFor(receiveForm.payment_method)" :key="p" :value="p">{{ p.replace('_', ' ') }}</option>
            </select>
          </div>
          <div v-if="receiveForm.payment_method === 'bank'" class="form-group">
            <label>{{ $t('payments.transactionReference') }}</label>
            <input v-model="receiveForm.transaction_reference" type="text" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('payments.paidBy') }}</label>
            <input v-model="receiveForm.paid_by" type="text" class="input" />
          </div>
          <p v-if="receiveError" class="alert alert-error" style="margin: 8px 0 0;">{{ receiveError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" @click="receiveModal = false">{{ $t('common.cancel') }}</button>
          <button class="btn btn-primary" :disabled="receiveSaving" @click="saveReceive">
            <i class="fas fa-save"></i> {{ receiveSaving ? $t('common.loading') : $t('receptionPanel.receive') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add / edit company modal -->
    <div v-if="companyModal" class="modal-overlay" @click.self="companyModal = false">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ editingCompany ? $t('receptionPanel.editCompany') : $t('receptionPanel.addCompany') }}</h3>
          <button class="modal-close" :aria-label="$t('common.close')" @click="companyModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>{{ $t('common.name') }} *</label>
            <input v-model="companyForm.name" type="text" class="input" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px;">
            <CountryCitySelect
              v-model:country-code="companyForm.country_code"
              v-model:country="companyForm.country"
              v-model:city="companyForm.city"
              city-as-dropdown
            />
            <div class="form-group">
              <label>{{ $t('receptionPanel.tinNumber') }}</label>
              <input v-model="companyForm.tin_number" type="text" class="input" />
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.companyAddress') }}</label>
            <textarea v-model="companyForm.address" class="input" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.contactPerson') }}</label>
            <input v-model="companyForm.contact_person" type="text" class="input" />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px;">
            <div class="form-group">
              <label>{{ $t('receptionPanel.companyPhone') }}</label>
              <PhoneInput v-model="companyForm.phone" v-model:countryCode="companyForm.country_code" :error="companyPhoneError" />
            </div>
            <div class="form-group">
              <label>{{ $t('receptionPanel.companyEmail') }}</label>
              <input v-model="companyForm.email" type="email" class="input" />
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 16px;">
            <div class="form-group">
              <label>{{ $t('receptionPanel.availableCredit') }}</label>
              <input v-model.number="companyForm.available_credit" type="number" min="0" step="0.01" class="input" />
              <small class="hint muted">{{ $t('receptionPanel.availableCreditHint') }}</small>
            </div>
            <div class="form-group">
              <label>{{ $t('receptionPanel.currentBalance') }}</label>
              <input v-model.number="companyForm.current_balance" type="number" min="0" step="0.01" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('receptionPanel.companyStatus') }}</label>
              <select v-model="companyForm.status" class="input">
                <option value="active">{{ $t('receptionPanel.statusActive') }}</option>
                <option value="inactive">{{ $t('receptionPanel.statusInactive') }}</option>
                <option value="blocked">{{ $t('receptionPanel.statusBlocked') }}</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.notes') }}</label>
            <textarea v-model="companyForm.notes" class="input" rows="2"></textarea>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" @click="companyModal = false">{{ $t('common.cancel') }}</button>
          <button class="btn btn-primary" :disabled="companySaving" @click="saveCompany">
            <i class="fas fa-save"></i> {{ companySaving ? $t('common.loading') : $t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { companyApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import PhoneInput from '@/components/PhoneInput.vue'
import CountryCitySelect from '@/components/CountryCitySelect.vue'
import { loadLocationData, getCountryName } from '@/utils/locations'
import { validatePhoneNumber } from '@/utils/phone'
import { METHOD_CASH, requiresProvider, providersFor } from '@/utils/payments'

const { t } = useI18n()
const authStore = useAuthStore()

const success = ref('')
const error = ref('')

function tsh(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return `TZS ${n.toLocaleString()}`
}

function isoDate(daysAgo = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

/* ----- Company posted-folio statement & settlement ----- */
const postingsModal = ref(false)
const postingsLoading = ref(false)
const postingsError = ref('')
const postingsCompany = ref(null)
const postingsFrom = ref(isoDate(30))
const postingsTo = ref(isoDate(0))
const postingsRows = ref([])
const postingsBalance = ref(null)
const postingsTotalPosted = ref(0)
const postingsTotalReceived = ref(0)
const selectedPostings = ref([])

const methodOptions = [
  { value: METHOD_CASH, label: t('paymentFields.methods.cash') },
  { value: 'mobile_money', label: t('paymentFields.methods.mobile_money') },
  { value: 'bank', label: t('paymentFields.methods.bank') || 'Bank transfer' },
  { value: 'card', label: t('paymentFields.methods.card') },
  { value: 'selcom', label: t('paymentFields.methods.selcom') },
  { value: 'clickpesa', label: 'ClickPesa' },
]

const selectedPostingsSum = computed(() => {
  const sum = postingsRows.value
    .filter((row) => row.kind === 'folio' && selectedPostings.value.includes(row.id))
    .reduce((total, row) => total + Number(row.amount || 0), 0)
  // Only the outstanding figure can be received; rows already settled
  // elsewhere (Cashiering Center) stay selectable but cannot be over-paid.
  return Math.min(sum, Number(postingsBalance.value || 0))
})

function openPostings(c) {
  postingsCompany.value = c
  postingsBalance.value = Number(c.current_balance ?? 0)
  postingsRows.value = []
  postingsTotalPosted.value = 0
  postingsTotalReceived.value = 0
  selectedPostings.value = []
  postingsFrom.value = isoDate(30)
  postingsTo.value = isoDate(0)
  postingsError.value = ''
  postingsModal.value = true
  loadPostings()
}

function closePostings() {
  if (postingsLoading.value || receiveSaving.value) return
  postingsModal.value = false
  postingsCompany.value = null
}

async function loadPostings() {
  if (!postingsCompany.value) return
  postingsLoading.value = true
  postingsError.value = ''
  selectedPostings.value = []
  try {
    const res = await companyApi.postings(postingsCompany.value.company_id, {
      from: postingsFrom.value || undefined,
      to: postingsTo.value || undefined,
    })
    const data = res.data || {}
    postingsRows.value = data.rows || []
    postingsBalance.value = Number(data.balance ?? postingsCompany.value.current_balance ?? 0)
    postingsTotalPosted.value = Number(data.total_posted ?? 0)
    postingsTotalReceived.value = Number(data.total_received ?? 0)
    if (data.company) {
      postingsCompany.value = data.company
    }
  } catch (err) {
    postingsError.value = err.response?.data?.message || t('common.loadError')
  } finally {
    postingsLoading.value = false
  }
}

// RECEIVE: settle the selected posted folios with the set amount.
const receiveModal = ref(false)
const receiveSaving = ref(false)
const receiveError = ref('')
const receiveForm = ref({ amount: null, payment_method: METHOD_CASH, payment_provider: null, transaction_reference: '', paid_by: '' })

function openReceive() {
  receiveError.value = ''
  receiveForm.value = {
    amount: selectedPostingsSum.value > 0 ? selectedPostingsSum.value : null,
    payment_method: METHOD_CASH,
    payment_provider: null,
    transaction_reference: '',
    paid_by: postingsCompany.value?.name || '',
  }
  receiveModal.value = true
}

function receiveMethodChanged() {
  receiveForm.value.payment_provider = null
  if (receiveForm.value.payment_method === METHOD_CASH) receiveForm.value.payment_provider = null
}

async function saveReceive() {
  const amount = Number(receiveForm.value.amount)
  if (!postingsCompany.value || !amount || amount <= 0) return
  receiveSaving.value = true
  receiveError.value = ''
  try {
    const res = await companyApi.settle(postingsCompany.value.company_id, {
      amount,
      payment_method: receiveForm.value.payment_method,
      payment_provider: receiveForm.value.payment_provider ?? undefined,
      transaction_reference: receiveForm.value.transaction_reference || undefined,
      paid_by: receiveForm.value.paid_by || undefined,
    })
    receiveModal.value = false
    success.value = t('receptionPanel.receiveSuccess')
    if (res.data?.company) {
      // Merge the fresh balance/name back into the directory row.
      const merged = companies.value.find((x) => x.company_id === res.data.company.company_id)
      if (merged) Object.assign(merged, res.data.company)
    }
    await loadPostings()
  } catch (err) {
    receiveError.value = err.response?.data?.message || t('common.error')
  } finally {
    receiveSaving.value = false
  }
}

/* ----- Refresh ----- */
function reset() {
  success.value = ''
  error.value = ''
  loadCompanies()
}

/* ----- Corporate-client directory ----- */
const canEdit = computed(() => authStore.can(80))

const columns = [
  { key: 'name', labelKey: 'common.name', sortKey: 'name' },
  { key: 'contact_person', labelKey: 'receptionPanel.contactPerson', sortKey: 'contact_person' },
  { key: 'country', labelKey: 'receptionPanel.country', sortKey: 'country_code' },
  { key: 'email', labelKey: 'receptionPanel.companyEmail' },
  { key: 'phone', labelKey: 'receptionPanel.companyPhone' },
  { key: 'status', labelKey: 'common.status', sortKey: 'status' },
  { key: 'available_credit', labelKey: 'receptionPanel.availableCredit', sortKey: 'available_credit' },
  { key: 'current_balance', labelKey: 'receptionPanel.balance', sortKey: 'current_balance' },
]

const companies = ref([])
const companiesLoading = ref(false)
const companySearch = ref('')
const sortKey = ref('name')
const sortDir = ref('asc')
const page = ref(1)
const pagination = ref({ current_page: 1, last_page: 1, total: 0, per_page: 20 })
let searchTimer = null

async function loadCompanies() {
  companiesLoading.value = true
  error.value = ''
  try {
    const res = await companyApi.index({
      per_page: 20,
      page: page.value,
      q: companySearch.value.trim() || undefined,
      sort_by: sortKey.value,
      sort_dir: sortDir.value,
    })
    companies.value = res.data?.companies || res.data?.data || []
    pagination.value = {
      current_page: res.data?.pagination?.current_page ?? page.value,
      last_page: res.data?.pagination?.last_page ?? 1,
      total: res.data?.pagination?.total ?? companies.value.length,
      per_page: res.data?.pagination?.per_page ?? 20,
    }
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    companiesLoading.value = false
  }
}

watch(companySearch, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadCompanies()
  }, 350)
})

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
  page.value = 1
  loadCompanies()
}

function goPage(next) {
  if (next < 1 || next > pagination.value.last_page) return
  page.value = next
  loadCompanies()
}

function statusLabel(status) {
  if (status === 'blocked') return t('receptionPanel.statusBlocked')
  return status === 'active' ? t('receptionPanel.statusActive') : t('receptionPanel.statusInactive')
}

function statusBadge(status) {
  if (status === 'blocked') return 'badge-danger'
  return status === 'active' ? 'badge-success' : 'badge-muted'
}

function countryLabel(code) {
  if (!code) return '—'
  return getCountryName(code) || code
}

const companyModal = ref(false)
const editingCompany = ref(false)
const companySaving = ref(false)
const companyPhoneError = ref('')
const companyForm = ref(emptyCompany())
let currentCompany = null

function emptyCompany() {
  return {
    name: '',
    tin_number: '',
    address: '',
    city: '',
    country: '',
    country_code: 'TZ',
    phone: '',
    email: '',
    contact_person: '',
    notes: '',
    available_credit: 0,
    current_balance: 0,
    status: 'active',
  }
}

function openCompanyAdd() {
  editingCompany.value = false
  currentCompany = null
  companyForm.value = emptyCompany()
  error.value = ''
  companyPhoneError.value = ''
  companyModal.value = true
}

function openCompanyEdit(c) {
  editingCompany.value = true
  currentCompany = c
  companyForm.value = {
    name: c.name || '',
    tin_number: c.tin_number || '',
    address: c.address || '',
    city: c.city || '',
    country: c.country || '',
    country_code: c.country_code || 'TZ',
    phone: c.phone || '',
    email: c.email || '',
    contact_person: c.contact_person || '',
    notes: c.notes || '',
    available_credit: Number(c.available_credit ?? 0),
    current_balance: Number(c.current_balance ?? 0),
    status: c.status || (c.is_active ? 'active' : 'inactive'),
  }
  error.value = ''
  companyPhoneError.value = ''
  companyModal.value = true
}

function askCompanyDelete(c) {
  if (!confirm(t('receptionPanel.confirmDeleteCompany', { name: c.name }))) return
  deleteCompany(c)
}

watch(
  () => [companyForm.value.phone, companyForm.value.country_code],
  () => {
    companyPhoneError.value = ''
  },
)

async function saveCompany() {
  if (!companyForm.value.name?.trim()) return
  companySaving.value = true
  error.value = ''
  companyPhoneError.value = ''
  if (companyForm.value.phone) {
    const res = validatePhoneNumber(companyForm.value.phone, companyForm.value.country_code || 'TZ')
    if (!res.valid) {
      companyPhoneError.value =
        res.reason === 'too_long' ? t('validations.phoneTooLong') : t('validations.phoneInvalid')
    }
  }
  if (companyPhoneError.value) {
    companySaving.value = false
    return
  }
  const payload = {
    name: companyForm.value.name,
    tin_number: companyForm.value.tin_number,
    address: companyForm.value.address,
    city: companyForm.value.city,
    country_code: companyForm.value.country_code,
    phone: companyForm.value.phone,
    email: companyForm.value.email,
    contact_person: companyForm.value.contact_person,
    notes: companyForm.value.notes,
    available_credit: Number(companyForm.value.available_credit || 0),
    current_balance: Number(companyForm.value.current_balance || 0),
    status: companyForm.value.status,
  }
  try {
    if (editingCompany.value && currentCompany) {
      await companyApi.update(currentCompany.company_id, payload)
      success.value = t('common.updateSuccess') || 'Updated.'
    } else {
      await companyApi.store(payload)
      success.value = t('common.createSuccess') || 'Added.'
    }
    companyModal.value = false
    await loadCompanies()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  } finally {
    companySaving.value = false
  }
}

async function deleteCompany(c) {
  try {
    await companyApi.destroy(c.company_id)
    success.value = t('common.deleteSuccess') || 'Removed.'
    await loadCompanies()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  }
}

onMounted(async () => {
  loadCompanies()
  loadLocationData().catch(() => {})
})
</script>