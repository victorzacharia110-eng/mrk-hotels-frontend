<!--
  Company Data page (route: /app/payments/company-data,
  name: hotel-payments-company-data).
  Edits the hotel's company profile: legal name, physical address and phone —
  the details printed on receipts and invoices (stored through hotel settings).
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
      <div v-if="loading" class="alert alert-info" style="margin: 0;">{{ $t('common.loading') }}</div>
      <form v-else @submit.prevent="save">
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
          <input v-model="form.phone" type="tel" class="input" />
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { hotelSettingsApi } from '@/api'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const success = ref('')
const error = ref('')

const empty = () => ({ hotel_name: '', address: '', phone: '', email: '' })
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

async function save() {
  saving.value = true
  error.value = ''
  try {
    await hotelSettingsApi.update(form.value)
    success.value = t('receptionPanel.companySaved')
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>