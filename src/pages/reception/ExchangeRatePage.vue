<!--
  Exchange Rate page (route: /app/payments/exchange-rate,
  name: hotel-payments-exchange-rate).
  Maintains the foreign-currency / TZS rates used for guest settlements.
  Rates are a simple list; editing is open to managers and above.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('receptionPanel.exchangeRate') }}</h1>
        <p class="muted">{{ $t('receptionPanel.exchangeRateSubtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <button v-if="canEdit" class="btn btn-primary" @click="openAdd">
          <i class="fas fa-plus"></i> {{ $t('receptionPanel.addRate') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card" style="padding: 20px;">
      <div v-if="loading" class="alert alert-info" style="margin: 0;">{{ $t('common.loading') }}</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>{{ $t('receptionPanel.currency') }}</th>
            <th>{{ $t('receptionPanel.symbol') }}</th>
            <th>{{ $t('receptionPanel.ratePerTzs') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rates" :key="r.rate_id">
            <td>{{ r.currency_name }} <span class="muted">({{ r.currency_code }})</span></td>
            <td>{{ r.symbol }}</td>
            <td>{{ r.rate_to_tzs }}</td>
            <td v-if="canEdit">
              <button class="btn btn-sm btn-secondary" @click="openEdit(r)">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-sm btn-danger" @click="askDelete(r)">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
          <tr v-if="!rates.length && !loading">
            <td colspan="4" class="muted">{{ $t('receptionPanel.noRates') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ editing ? $t('receptionPanel.editRate') : $t('receptionPanel.addRate') }}</h3>
          <button class="modal-close" :aria-label="$t('common.close')" @click="showModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>{{ $t('receptionPanel.currencyCode') }} *</label>
            <input v-model="form.currency_code" type="text" class="input" maxlength="3" placeholder="USD" :disabled="editing" />
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.currencyName') }}</label>
            <input v-model="form.currency_name" type="text" class="input" placeholder="US Dollar" />
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.symbol') }}</label>
            <input v-model="form.symbol" type="text" class="input" placeholder="$" />
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.rateToTzs') }} *</label>
            <input v-model.number="form.rate_to_tzs" type="number" min="0" step="0.0001" class="input" />
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" @click="showModal = false">{{ $t('common.cancel') }}</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">
            <i class="fas fa-save"></i> {{ saving ? $t('common.loading') : $t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { currencyRateApi } from '@/api'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()

const rates = ref([])
const loading = ref(false)
const saving = ref(false)
const success = ref('')
const error = ref('')
const showModal = ref(false)
const editing = ref(false)
const form = ref({})
let current = null

const canEdit = computed(() => ['hotel_admin', 'manager'].includes(authStore.user?.user_role))

function openAdd() {
  editing.value = false
  current = null
  form.value = { currency_code: '', currency_name: '', symbol: '', rate_to_tzs: null }
  error.value = ''
  showModal.value = true
}

function openEdit(r) {
  editing.value = true
  current = r
  form.value = {
    currency_code: r.currency_code,
    currency_name: r.currency_name,
    symbol: r.symbol,
    rate_to_tzs: r.rate_to_tzs,
  }
  error.value = ''
  showModal.value = true
}

function askDelete(r) {
  if (!confirm(`${t('receptionPanel.confirmDeleteRate', { code: r.currency_code })}`)) return
  remove(r)
}

async function load() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const res = await currencyRateApi.index()
    rates.value = res.data?.data || res.data?.rates || []
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!form.value.currency_code || !form.value.rate_to_tzs) return
  saving.value = true
  error.value = ''
  try {
    const payload = { ...form.value }
    if (editing.value && current) {
      await currencyRateApi.update(current.rate_id, payload)
      success.value = t('common.updateSuccess')
    } else {
      await currencyRateApi.store(payload)
      success.value = t('common.createSuccess')
    }
    showModal.value = false
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

async function remove(r) {
  try {
    await currencyRateApi.destroy(r.rate_id)
    success.value = t('common.deleteSuccess')
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  }
}

onMounted(load)
</script>