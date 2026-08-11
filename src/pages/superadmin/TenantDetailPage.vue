<template>
  <div v-if="tenant">
    <router-link :to="{ name: 'superadmin-tenants' }" class="back-link">
      <i class="fas fa-arrow-left"></i> {{ $t('superadmin.backToHotels') }}
    </router-link>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Tenant header: identity, location, contact and status badge -->
    <div class="card detail-head">
      <div>
        <h1>{{ tenant.hotel_name }}</h1>
        <p class="muted">
          {{ tenant.subdomain }} &middot; {{ [tenant.city, tenant.country].filter(Boolean).join(', ') || $t('superadmin.locationNotSpecified') }}
        </p>
        <p class="muted">{{ tenant.email }} {{ tenant.phone ? '· ' + tenant.phone : '' }}</p>
      </div>
      <span class="badge" :class="statusBadge(tenant.status)">{{ tenant.status }}</span>
    </div>

    <!-- Operational analytics pulled from the reporting API -->
    <div class="stat-grid">
      <div class="stat-card">
        <p class="stat-label">{{ $t('superadmin.staff') }}</p>
        <p class="stat-value">{{ analytics?.staff_count ?? '-' }}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">{{ $t('superadmin.rooms') }}</p>
        <p class="stat-value">{{ analytics?.room_count ?? '-' }}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">{{ $t('superadmin.reservations') }}</p>
        <p class="stat-value">{{ analytics?.reservation_count ?? '-' }}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">{{ $t('superadmin.occupancy') }}</p>
        <p class="stat-value">{{ analytics?.occupancy_rate ?? '-' }}%</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">{{ $t('superadmin.revenue30d') }}</p>
        <p class="stat-value">TZS {{ (analytics?.revenue_30_days ?? 0).toLocaleString() }}</p>
      </div>
    </div>

    <!-- Subscription plan and status management -->
    <div class="card">
      <h2 class="card-title">{{ $t('superadmin.subscription') }}</h2>
      <p class="muted">
        {{ $t('superadmin.plan') }}: <strong>{{ tenant.subscription_plan }}</strong> &middot; {{ $t('superadmin.subscriptionStatus') }}:
        <strong>{{ tenant.subscription_status }}</strong>
        <template v-if="tenant.trial_ends_at"> &middot; {{ $t('superadmin.trialEnds') }}: {{ new Date(tenant.trial_ends_at).toLocaleDateString() }}</template>
      </p>
      <form @submit.prevent="updateSubscription" class="sub-form">
        <div class="form-group">
          <label>{{ $t('superadmin.plan') }}</label>
          <SearchableSelect v-model="subForm.subscription_plan" :options="planOptions" />
        </div>
        <div class="form-group">
          <label>{{ $t('superadmin.subscriptionStatus') }}</label>
          <SearchableSelect v-model="subForm.subscription_status" :options="subscriptionStatusOptions" />
        </div>
        <button class="btn" :disabled="saving">
          {{ saving ? $t('common.saving') : $t('superadmin.updateSubscription') }}
        </button>
      </form>
    </div>

    <!-- Tax details plus the signature and stamp images used on the hotel's documents -->
    <div class="card">
      <h2 class="card-title">{{ $t('superadmin.taxDetails') }}</h2>
      <p class="muted">{{ $t('superadmin.taxDetailsHint') }}</p>
      <form @submit.prevent="saveTaxDetails" class="sub-form">
        <div class="form-group">
          <label>{{ $t('superadmin.tin') }}</label>
          <input v-model.trim="taxForm.tin" type="text" class="input" :placeholder="$t('superadmin.tinPlaceholder')" />
        </div>
        <div class="form-group">
          <label>{{ $t('superadmin.vrn') }}</label>
          <input v-model.trim="taxForm.vrn" type="text" class="input" :placeholder="$t('superadmin.vrnPlaceholder')" />
        </div>
        <button class="btn" :disabled="savingTax">
          {{ savingTax ? $t('common.saving') : $t('superadmin.saveTaxDetails') }}
        </button>
      </form>

      <div class="branding-section">
        <h3 class="accounts-title">{{ $t('superadmin.signatureStamp') }}</h3>
        <p class="muted">{{ $t('superadmin.signatureStampHint') }}</p>
        <div class="branding-grid">
          <div class="branding-field">
            <label>{{ $t('superadmin.signatureImage') }}</label>
            <div v-if="tenant.signature_url" class="branding-preview">
              <img :src="tenant.signature_url" :alt="$t('superadmin.signatureImage')" />
              <button type="button" class="btn-link" @click="removeBranding('signature')">
                {{ $t('superadmin.removeImage') }}
              </button>
            </div>
            <input type="file" accept="image/png,image/jpeg" @change="onBrandingFile($event, 'signature')" />
          </div>
          <div class="branding-field">
            <label>{{ $t('superadmin.stampImage') }}</label>
            <div v-if="tenant.stamp_url" class="branding-preview">
              <img :src="tenant.stamp_url" :alt="$t('superadmin.stampImage')" />
              <button type="button" class="btn-link" @click="removeBranding('stamp')">
                {{ $t('superadmin.removeImage') }}
              </button>
            </div>
            <input type="file" accept="image/png,image/jpeg" @change="onBrandingFile($event, 'stamp')" />
          </div>
        </div>
        <button class="btn" :disabled="savingBranding || (!brandingFiles.signature && !brandingFiles.stamp)" @click="saveBranding">
          {{ savingBranding ? $t('common.saving') : $t('superadmin.uploadBranding') }}
        </button>
      </div>
    </div>

    <!-- Assign an existing owner or create a brand new owner account for the hotel -->
    <div class="card">
      <h2 class="card-title">{{ $t('superadmin.owner') }}</h2>
      <p class="muted">{{ $t('superadmin.ownerHint') }}</p>
      <form @submit.prevent="saveOwner" class="sub-form">
        <div class="form-group">
          <SearchableSelect v-model="ownerForm.owner_id" :options="ownerOptions" />
        </div>
        <button class="btn" :disabled="savingOwner">
          {{ savingOwner ? $t('common.saving') : $t('superadmin.saveOwner') }}
        </button>
      </form>

      <div class="branding-section">
        <h3 class="accounts-title">{{ $t('superadmin.newOwner') }}</h3>
        <form @submit.prevent="createOwner" class="sub-form">
          <div class="form-group">
            <input v-model.trim="newOwner.full_name" type="text" class="input" :placeholder="$t('superadmin.ownerNamePlaceholder')" required />
          </div>
          <div class="form-group">
            <input v-model.trim="newOwner.email" type="email" class="input" :placeholder="$t('superadmin.ownerEmailPlaceholder')" required />
          </div>
          <button class="btn" :disabled="creatingOwner">
            {{ creatingOwner ? $t('superadmin.creatingOwner') : $t('superadmin.createOwner') }}
          </button>
        </form>
      </div>
    </div>

    <!-- Payment methods the hotel accepts, and per-provider account numbers -->
    <div class="card">
      <h2 class="card-title">{{ $t('superadmin.paymentMethods') }}</h2>
      <p class="muted">
        {{ $t('superadmin.paymentMethodsHint') }}
      </p>
      <div class="method-grid">
        <label
          v-for="m in paymentMethods"
          :key="m"
          class="method-toggle"
          :class="{ checked: paymentForm.methods.includes(m) }"
        >
          <input v-model="paymentForm.methods" type="checkbox" :value="m" />
          <span>{{ $t(`paymentFields.methods.${m}`) }}</span>
        </label>
      </div>

      <!-- Account fields only for the providers matching the enabled payment methods -->
      <div v-if="accountProviders.length" class="accounts-section">
        <h3 class="accounts-title">{{ $t('superadmin.paymentAccounts') }}</h3>
        <p class="muted">{{ $t('superadmin.paymentAccountsHint') }}</p>
        <div class="accounts-grid">
          <div v-for="p in accountProviders" :key="p" class="account-field">
            <span class="provider-head">
              <ProviderLogo :provider="p" />
              <label :for="`acc-${p}`">{{ $t(`paymentFields.providers.${p}`) }}</label>
            </span>
            <input
              :id="`acc-${p}`"
              v-model="paymentForm.accounts[p]"
              type="text"
              class="input"
              :placeholder="$t('superadmin.accountPlaceholder')"
            />
          </div>
        </div>
      </div>

      <button class="btn" :disabled="savingPayment" @click="savePaymentMethods">
        {{ savingPayment ? $t('common.saving') : $t('superadmin.savePaymentMethods') }}
      </button>
    </div>
  </div>

  <div v-else-if="loading" class="alert alert-info">{{ $t('superadmin.loadingHotel') }}</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { tenantApi, superadminReportApi } from '@/api'
import {
  ALL_PROVIDERS,
  METHOD_BANK,
  METHOD_MOBILE_MONEY,
  MOBILE_MONEY_PROVIDERS,
  PAYMENT_METHODS,
} from '@/utils/payments'
import ProviderLogo from '@/components/ProviderLogo.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'

const route = useRoute()
const { t } = useI18n()
const tenant = ref(null)
const analytics = ref(null)
const loading = ref(false)
const saving = ref(false)
const savingPayment = ref(false)
const savingTax = ref(false)
const savingBranding = ref(false)
const error = ref('')
const subForm = ref({ subscription_plan: 'trial', subscription_status: 'active' })
const taxForm = ref({ tin: '', vrn: '' })
const brandingFiles = ref({ signature: null, stamp: null })
const owners = ref([])
const ownerForm = ref({ owner_id: '' })
const newOwner = ref({ full_name: '', email: '' })
const savingOwner = ref(false)
const creatingOwner = ref(false)

// Options for the subscription plan / status selects and the assign-owner select
const ownerOptions = computed(() => [
  { value: '', label: t('superadmin.noOwner') },
  ...owners.value.map((o) => ({ value: o.user_id, label: `${o.full_name} (${o.email})` })),
])

const planOptions = computed(() => [
  { value: 'trial', label: t('superadmin.planTrial') },
  { value: 'basic', label: t('superadmin.planBasic') },
  { value: 'premium', label: t('superadmin.planPremium') },
  { value: 'enterprise', label: t('superadmin.planEnterprise') },
])

const subscriptionStatusOptions = computed(() => [
  { value: 'active', label: t('superadmin.subscriptionActive') },
  { value: 'trial', label: t('superadmin.subscriptionTrial') },
  { value: 'past_due', label: t('superadmin.subscriptionPastDue') },
  { value: 'cancelled', label: t('superadmin.subscriptionCancelled') },
])
// Static payment configuration plus the form collecting enabled methods and accounts
const paymentMethods = PAYMENT_METHODS
const paymentForm = ref({ methods: defaultPaymentMethods(), accounts: emptyAccounts() })

// Returns a fresh copy of the default payment method list.
function defaultPaymentMethods() {
  return PAYMENT_METHODS.slice()
}

// Builds an accounts object with every provider keyed to an empty string.
function emptyAccounts() {
  return Object.fromEntries(ALL_PROVIDERS.map((p) => [p, '']))
}

/** Providers worth configuring, based on which methods the hotel enables. */
const accountProviders = computed(() => {
  const enabled = paymentForm.value.methods
  return ALL_PROVIDERS.filter((p) =>
    enabled.includes(MOBILE_MONEY_PROVIDERS.includes(p) ? METHOD_MOBILE_MONEY : METHOD_BANK),
  )
})

// Maps a tenant status to the CSS class used for its badge colour.
function statusBadge(s) {
  const map = { active: 'badge-green', pending: 'badge-yellow', suspended: 'badge-red', cancelled: 'badge-gray' }
  return map[s] || 'badge-gray'
}

// Loads the tenant and its analytics, and seeds every edit form from the response.
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await tenantApi.show(route.params.id)
    tenant.value = res.data.data || res.data.tenant || res.data
    subForm.value.subscription_plan = tenant.value.subscription_plan
    subForm.value.subscription_status = tenant.value.subscription_status
    taxForm.value.tin = tenant.value.tin || ''
    taxForm.value.vrn = tenant.value.vrn || ''
    ownerForm.value.owner_id = tenant.value.owner_id || ''
    paymentForm.value.methods =
      tenant.value.payment_methods && tenant.value.payment_methods.length
        ? tenant.value.payment_methods
        : defaultPaymentMethods()
    const accounts = tenant.value.payment_accounts || {}
    ALL_PROVIDERS.forEach((p) => {
      paymentForm.value.accounts[p] = accounts[p] || ''
    })
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.failedToLoad')
  }

  try {
    const res = await superadminReportApi.tenantAnalytics(route.params.id)
    analytics.value = res.data
  } catch {
    analytics.value = null
  }
  loading.value = false
}

// Persists the chosen subscription plan and status, then refreshes the tenant.
async function updateSubscription() {
  saving.value = true
  error.value = ''
  try {
    const res = await tenantApi.updateSubscription(route.params.id, subForm.value)
    window.alert(res.data.message || t('superadmin.subscriptionUpdated'))
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.subscriptionUpdateError')
  } finally {
    saving.value = false
  }
}

// Saves the hotel's TIN and VRN tax numbers.
async function saveTaxDetails() {
  savingTax.value = true
  error.value = ''
  try {
    const res = await tenantApi.update(route.params.id, {
      tin: taxForm.value.tin || null,
      vrn: taxForm.value.vrn || null,
    })
    tenant.value.tin = res.data.tenant?.tin ?? taxForm.value.tin
    tenant.value.vrn = res.data.tenant?.vrn ?? taxForm.value.vrn
    window.alert(res.data.message || t('superadmin.taxDetailsSaved'))
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.taxDetailsSaveError')
  } finally {
    savingTax.value = false
  }
}

// Stores the selected image file ('signature' or 'stamp') for the branding upload.
function onBrandingFile(event, key) {
  brandingFiles.value[key] = event.target.files?.[0] || null
}

// Uploads the signature/stamp images and updates their URLs on the tenant.
async function saveBranding() {
  savingBranding.value = true
  error.value = ''
  try {
    const fd = new FormData()
    if (brandingFiles.value.signature) fd.append('signature', brandingFiles.value.signature)
    if (brandingFiles.value.stamp) fd.append('stamp', brandingFiles.value.stamp)
    const res = await tenantApi.uploadBranding(route.params.id, fd)
    tenant.value.signature_url = res.data.tenant?.signature_url ?? null
    tenant.value.stamp_url = res.data.tenant?.stamp_url ?? null
    brandingFiles.value = { signature: null, stamp: null }
    window.alert(res.data.message || t('superadmin.brandingSaved'))
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.brandingSaveError')
  } finally {
    savingBranding.value = false
  }
}

// Removes one of the branding assets by telling the API to clear its image.
async function removeBranding(asset) {
  savingBranding.value = true
  error.value = ''
  try {
    const fd = new FormData()
    fd.append(`remove_${asset}`, '1')
    const res = await tenantApi.uploadBranding(route.params.id, fd)
    tenant.value.signature_url = res.data.tenant?.signature_url ?? null
    tenant.value.stamp_url = res.data.tenant?.stamp_url ?? null
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.brandingSaveError')
  } finally {
    savingBranding.value = false
  }
}

// Assigns an existing owner account to this tenant.
async function saveOwner() {
  savingOwner.value = true
  error.value = ''
  try {
    const res = await tenantApi.update(route.params.id, { owner_id: ownerForm.value.owner_id || null })
    tenant.value.owner_id = res.data.tenant?.owner_id ?? ownerForm.value.owner_id
    window.alert(res.data.message || t('superadmin.ownerSaved'))
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.ownerSaveError')
  } finally {
    savingOwner.value = false
  }
}

// Creates a new owner account, reloads the owner list and selects the new owner.
async function createOwner() {
  creatingOwner.value = true
  error.value = ''
  try {
    const res = await tenantApi.createOwner(newOwner.value)
    newOwner.value = { full_name: '', email: '' }
    await loadOwners()
    if (res.data.owner?.user_id) {
      ownerForm.value.owner_id = res.data.owner.user_id
    }
    window.alert(res.data.message || '')
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.ownerCreateError')
  } finally {
    creatingOwner.value = false
  }
}

// Loads the pool of owners available for assignment.
async function loadOwners() {
  try {
    const res = await tenantApi.owners()
    owners.value = res.data.owners || []
  } catch {
    owners.value = []
  }
}

// Persists the enabled payment methods and their (non-empty) account numbers.
async function savePaymentMethods() {
  savingPayment.value = true
  error.value = ''
  try {
    const accounts = Object.fromEntries(
      Object.entries(paymentForm.value.accounts).filter(([, v]) => v && v.trim()),
    )
    const res = await tenantApi.update(route.params.id, {
      payment_methods: paymentForm.value.methods,
      payment_accounts: accounts,
    })
    tenant.value.payment_methods = paymentForm.value.methods
    tenant.value.payment_accounts = res.data.tenant?.payment_accounts || accounts
    window.alert(res.data.message || t('superadmin.paymentMethodsSaved'))
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.paymentMethodsSaveError')
  } finally {
    savingPayment.value = false
  }
}

onMounted(() => {
  load()
  loadOwners()
})
</script>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: #0e7490;
  font-weight: 600;
  margin-bottom: 16px;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.muted {
  color: #64748b;
  font-size: 13px;
}

.sub-form {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  align-items: end;
}

.method-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  margin: 16px 0;
}

.method-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.method-toggle.checked {
  border-color: #005EB8;
  background: #f0f7ff;
}

.method-toggle input {
  accent-color: #005EB8;
}

.accounts-section {
  margin: 20px 0;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.accounts-title {
  font-size: 15px;
  margin: 0 0 4px;
}

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  margin: 14px 0;
}

.account-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.provider-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 13px;
}

.branding-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.branding-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin: 14px 0;
}

.branding-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.branding-preview {
  display: flex;
  align-items: center;
  gap: 12px;
}

.branding-preview img {
  height: 56px;
  padding: 6px;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #fff;
}

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: #b91c1c;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
}
</style>
