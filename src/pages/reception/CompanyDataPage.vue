<!--
  Company Data page (route: /app/payments/company-data,
  name: hotel-payments-company-data).
  Two parts:
  1. Hotel profile — legal name, physical address and phone printed on
     receipts and invoices (stored through hotel settings).
  2. Corporate clients — the company directory front desk references when
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
      <button class="btn btn-secondary" :disabled="loading || companiesLoading" @click="reset">
        <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
      </button>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card" style="padding: 24px; max-width: 720px;">
      <h3 style="margin-top: 0;">{{ $t('receptionPanel.hotelProfile') }}</h3>
      <div v-if="loading" class="alert alert-info" style="margin: 0;">{{ $t('common.loading') }}</div>
      <form v-else @submit.prevent="saveProfile">
        <div class="form-group">
          <label>{{ $t('receptionPanel.companyName') }}</label>
          <input v-model="form.hotel_name" type="text" class="input" />
        </div>
        <div class="form-group">
          <label>{{ $t('receptionPanel.companyAddress') }}</label>
          <textarea v-model="form.address" class="input" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>{{ $t('receptionPanel.companyPhone') }}</label>
          <PhoneInput v-model="form.phone" v-model:countryCode="form.country_code" :error="profilePhoneError" />
        </div>
        <div class="form-group">
          <label>{{ $t('receptionPanel.companyEmail') }}</label>
          <input v-model="form.email" type="email" class="input" />
        </div>
        <button class="btn btn-primary" :disabled="saving" type="submit">
          <i class="fas fa-save"></i> {{ saving ? $t('common.loading') : $t('common.save') }}
        </button>
      </form>
    </div>

    <div class="card" style="padding: 20px; margin-top: 20px;">
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
            <td>{{ c.name }}</td>
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
import { hotelSettingsApi, companyApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import PhoneInput from '@/components/PhoneInput.vue'
import CountryCitySelect from '@/components/CountryCitySelect.vue'
import { loadLocationData, getCountryName } from '@/utils/locations'
import { validatePhoneNumber } from '@/utils/phone'

const { t } = useI18n()
const authStore = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const success = ref('')
const error = ref('')

function tsh(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return `TZS ${n.toLocaleString()}`
}

/* ----- Hotel profile ----- */
const empty = () => ({ hotel_name: '', address: '', phone: '', email: '', country_code: '' })
const form = ref(empty())

async function load() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const res = await hotelSettingsApi.show()
    const data = res.data?.hotel || res.data?.data || res.data || {}
    form.value = {
      hotel_name: data.hotel_name || '',
      address: data.address || '',
      phone: data.phone || '',
      email: data.email || '',
      country_code: data.country_code || '',
    }
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

function reset() {
  form.value = empty()
  load()
  loadCompanies()
}

const profilePhoneError = ref('')

async function saveProfile() {
  saving.value = true
  error.value = ''
  profilePhoneError.value = ''
  if (form.value.phone) {
    const res = validatePhoneNumber(form.value.phone, form.value.country_code || 'TZ')
    if (!res.valid) {
      profilePhoneError.value =
        res.reason === 'too_long' ? t('validations.phoneTooLong') : t('validations.phoneInvalid')
    }
  }
  if (profilePhoneError.value) {
    saving.value = false
    return
  }
  try {
    await hotelSettingsApi.update({
      hotel_name: form.value.hotel_name,
      address: form.value.address,
      phone: form.value.phone,
      email: form.value.email,
    })
    success.value = t('receptionPanel.companySaved')
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
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
  () => [form.value.phone, form.value.country_code],
  () => {
    profilePhoneError.value = ''
  },
)
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
  load()
  loadCompanies()
  loadLocationData().catch(() => {})
})
</script>