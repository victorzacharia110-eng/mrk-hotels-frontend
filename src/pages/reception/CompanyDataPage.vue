<!--
  Company Data page (route: /app/payments/company-data,
  name: hotel-payments-company-data).
  Two parts:
  1. Hotel profile — legal name, physical address and phone printed on
     receipts and invoices (stored through hotel settings).
  2. Corporate clients — the company directory front desk can reference when
     recording a booking's origin (stored through the companies endpoint).
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('receptionPanel.companyData') }}</h1>
        <p class="muted">{{ $t('receptionPanel.companyDataSubtitle') }}</p>
      </div>
      <button class="btn btn-secondary" :disabled="loading" @click="reset">
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
          <PhoneInput v-model="form.phone" v-model:countryCode="form.country_code" />
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
      <div class="head-actions" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px;">
        <div>
          <h3 style="margin: 0;">{{ $t('receptionPanel.corporateDirectory') }}</h3>
          <p class="muted" style="margin: 2px 0 0;">{{ $t('receptionPanel.corporateDirectorySubtitle') }}</p>
        </div>
        <button v-if="canEdit" class="btn btn-primary" @click="openCompanyAdd">
          <i class="fas fa-plus"></i> {{ $t('receptionPanel.addCompany') }}
        </button>
      </div>

      <div v-if="companiesLoading" class="alert alert-info" style="margin: 0;">{{ $t('common.loading') }}</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>{{ $t('common.name') }}</th>
            <th>{{ $t('receptionPanel.tinNumber') }}</th>
            <th>{{ $t('receptionPanel.contactPerson') }}</th>
            <th>{{ $t('receptionPanel.city') }}</th>
            <th>{{ $t('receptionPanel.companyPhone') }}</th>
            <th>{{ $t('common.status') }}</th>
            <th v-if="canEdit"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in companies" :key="c.company_id">
            <td>{{ c.name }}</td>
            <td>{{ c.tin_number || '—' }}</td>
            <td>{{ c.contact_person || '—' }}</td>
            <td>{{ c.city || '—' }}</td>
            <td>{{ c.phone || '—' }}</td>
            <td>
              <span class="badge" :class="c.is_active ? 'badge-success' : 'badge-muted'">
                {{ c.is_active ? $t('distribution.active') || 'Active' : $t('distribution.inactive') || 'Inactive' }}
              </span>
            </td>
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
            <td :colspan="canEdit ? 7 : 6" class="muted">{{ $t('receptionPanel.noCompanies') }}</td>
          </tr>
        </tbody>
      </table>
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
          <div class="form-group">
            <label>{{ $t('receptionPanel.tinNumber') }}</label>
            <input v-model="companyForm.tin_number" type="text" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.contactPerson') }}</label>
            <input v-model="companyForm.contact_person" type="text" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.companyAddress') }}</label>
            <textarea v-model="companyForm.address" class="input" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.city') }}</label>
            <input v-model="companyForm.city" type="text" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.companyPhone') }}</label>
            <PhoneInput v-model="companyForm.phone" v-model:countryCode="companyForm.country_code" />
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.companyEmail') }}</label>
            <input v-model="companyForm.email" type="email" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.notes') }}</label>
            <textarea v-model="companyForm.notes" class="input" rows="2"></textarea>
          </div>
          <label class="check-row" style="display: flex; align-items: center; gap: 8px;">
            <input v-model="companyForm.is_active" type="checkbox" />
            <span>{{ $t('distribution.active') || 'Active' }}</span>
          </label>
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
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { hotelSettingsApi, companyApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import PhoneInput from '@/components/PhoneInput.vue'
import { normalizePhoneNumber } from '@/utils/phone'

const { t } = useI18n()
const authStore = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const success = ref('')
const error = ref('')

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
}

async function saveProfile() {
  saving.value = true
  error.value = ''
  try {
    await hotelSettingsApi.update({
      hotel_name: form.value.hotel_name,
      address: form.value.address,
      phone: normalizePhoneNumber(form.value.phone, form.value.country_code || 'TZ'),
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

const companies = ref([])
const companiesLoading = ref(false)
const companyModal = ref(false)
const editingCompany = ref(false)
const companySaving = ref(false)
const companyForm = ref(emptyCompany())
let currentCompany = null

function emptyCompany() {
  return {
    name: '',
    tin_number: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    contact_person: '',
    notes: '',
    is_active: true,
    country_code: '',
  }
}

async function loadCompanies() {
  companiesLoading.value = true
  error.value = ''
  try {
    const res = await companyApi.index({ per_page: 100 })
    companies.value = res.data?.companies || res.data?.data || []
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    companiesLoading.value = false
  }
}

function openCompanyAdd() {
  editingCompany.value = false
  currentCompany = null
  companyForm.value = emptyCompany()
  error.value = ''
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
    phone: c.phone || '',
    email: c.email || '',
    contact_person: c.contact_person || '',
    notes: c.notes || '',
    is_active: !!c.is_active,
    country_code: c.country_code || '',
  }
  error.value = ''
  companyModal.value = true
}

function askCompanyDelete(c) {
  if (!confirm(t('receptionPanel.confirmDeleteCompany', { name: c.name }))) return
  deleteCompany(c)
}

async function saveCompany() {
  if (!companyForm.value.name?.trim()) return
  companySaving.value = true
  error.value = ''
  const payload = {
    name: companyForm.value.name,
    tin_number: companyForm.value.tin_number,
    address: companyForm.value.address,
    city: companyForm.value.city,
    phone: normalizePhoneNumber(companyForm.value.phone, companyForm.value.country_code || 'TZ'),
    email: companyForm.value.email,
    contact_person: companyForm.value.contact_person,
    notes: companyForm.value.notes,
    is_active: companyForm.value.is_active,
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

onMounted(() => {
  load()
  loadCompanies()
})
</script>