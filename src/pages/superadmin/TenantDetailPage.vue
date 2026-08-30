<!--
  Tenant detail page (route: /superadmin/tenants/:id, name: superadmin-tenant-detail).
  Superadmin control panel for one tenant hotel: operational analytics,
  subscription plan/status editing, tax details with signature/stamp branding,
  owner assignment/creation, and accepted payment methods with account numbers.
-->
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
        <form class="code-form" @submit.prevent="saveCode">
          <label for="registration-code">{{ $t('superadmin.registrationCode') }}</label>
          <input
            id="registration-code"
            v-model.trim="codeForm.registration_code"
            type="text"
            maxlength="6"
            class="input input-sm code-input"
            :placeholder="$t('superadmin.registrationCodePlaceholder')"
          />
          <button class="btn btn-sm" :disabled="codeSaving">
            {{ codeSaving ? $t('common.saving') : $t('superadmin.saveCode') }}
          </button>
        </form>
      </div>
      <span class="badge" :class="statusBadge(tenant.status)">{{ tenant.status }}</span>
    </div>

    <div class="head-actions" style="margin-bottom: 1rem;">
      <button class="btn btn-secondary" @click="downloadBackup">
        <i class="fas fa-download"></i> {{ $t('superadmin.downloadBackup') }}
      </button>
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

    <!-- Hotel business details: the name and contact info shown to guests on
         the hotel's public pages (details, booking form, footer) -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-building"></i> {{ $t('hotelSettings.title') }}</h2>
      <p class="muted">{{ $t('hotelSettings.hint') }}</p>
      <form @submit.prevent="saveContact" class="sub-form">
        <div class="form-group">
          <label>{{ $t('hotelSettings.hotelName') }}</label>
          <input v-model.trim="contactForm.hotel_name" type="text" class="input" required />
        </div>
        <div class="form-group">
          <label>{{ $t('hotelSettings.contactPerson') }}</label>
          <input v-model.trim="contactForm.contact_person" type="text" class="input" />
        </div>
        <div class="form-group">
          <label>{{ $t('hotelSettings.email') }}</label>
          <input v-model.trim="contactForm.email" type="email" class="input" />
        </div>
        <div class="form-group">
          <label>{{ $t('hotelSettings.phone') }}</label>
          <input v-model.trim="contactForm.phone" type="text" class="input" />
        </div>
        <div class="form-group">
          <label>{{ $t('hotelSettings.city') }}</label>
          <input v-model.trim="contactForm.city" type="text" class="input" />
        </div>
        <div class="form-group">
          <label>{{ $t('hotelSettings.country') }}</label>
          <input v-model.trim="contactForm.country" type="text" class="input" />
        </div>
        <div class="form-group">
          <label>{{ $t('hotelSettings.address') }}</label>
          <input v-model.trim="contactForm.address" type="text" class="input" />
        </div>
        <button class="btn" :disabled="savingContact">
          {{ savingContact ? $t('common.saving') : $t('superadmin.updateTenant') }}
        </button>
      </form>
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

    <!-- Feature flags: check/uncheck individual features for this tenant -->
    <div class="card">
      <h2 class="card-title"><i class="fas fa-layer-group"></i> {{ $t('superadmin.featureManagement') }}</h2>
      <p class="muted">
        {{ $t('superadmin.featureHint') }}
      </p>
      <div v-if="planFeatureLabelsLoading" class="muted">{{ $t('superadmin.loadingFeatures') }}</div>
      <template v-else>
        <!-- Quick actions -->
        <div class="feature-quick-actions">
          <button type="button" class="btn btn-sm btn-secondary" @click="selectAllFeatures">
            <i class="fas fa-check-double"></i> {{ $t('superadmin.selectAll') }}
          </button>
          <button type="button" class="btn btn-sm btn-secondary" @click="deselectAllFeatures">
            <i class="fas fa-xmark"></i> {{ $t('superadmin.deselectAll') }}
          </button>
          <button type="button" class="btn btn-sm btn-secondary" @click="loadPlanFeatures">
            <i class="fas fa-rotate"></i> {{ $t('superadmin.resetToPlan') }}
          </button>
        </div>
        <!-- Grouped feature checkboxes -->
        <div class="feature-groups">
          <div v-for="(features, groupKey) in featureGroups" :key="groupKey" class="feature-group">
            <h3 class="feature-group-title">{{ groupKey }}</h3>
            <div class="feature-grid">
              <label v-for="feat in features" :key="feat.key" class="feature-toggle">
                <input
                  type="checkbox"
                  :value="feat.key"
                  v-model="selectedFeatures"
                  class="feature-checkbox"
                />
                <span class="feature-info">
                  <span class="feature-name">{{ feat.label }}</span>
                  <span class="feature-desc">{{ feat.description }}</span>
                </span>
              </label>
            </div>
          </div>
        </div>
        <p class="feature-count">
          {{ selectedFeatures.length }} {{ $t('superadmin.of') }} {{ allFeatureKeys.length }} {{ $t('superadmin.featuresEnabled') }}
          <template v-if="tenant.features === null"> {{ $t('superadmin.allFeaturesActive') }}</template>
        </p>
      </template>
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
              v-model="paymentForm.accounts[p].number"
              type="text"
              class="input"
              :placeholder="$t('superadmin.accountPlaceholder')"
            />
            <div v-if="MOBILE_MONEY_PROVIDERS.includes(p)" class="account-subfields">
              <label class="account-sublabel" :for="`lipa-${p}`">{{ $t('superadmin.lipaNumberLabel') }}</label>
              <input
                :id="`lipa-${p}`"
                v-model="paymentForm.accounts[p].lipa_number"
                type="text"
                class="input"
                :placeholder="$t('superadmin.lipaNumberPlaceholder')"
              />
              <label class="account-sublabel" :for="`rcvr-${p}`">{{ $t('superadmin.receiverNameLabel') }}</label>
              <input
                :id="`rcvr-${p}`"
                v-model="paymentForm.accounts[p].name"
                type="text"
                class="input"
                :placeholder="$t('superadmin.receiverNamePlaceholder')"
              />
            </div>
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
import { tenantApi, superadminReportApi, planApi } from '@/api'
import {
  ALL_PROVIDERS,
  METHOD_BANK,
  METHOD_MOBILE_MONEY,
  MOBILE_MONEY_PROVIDERS,
  PAYMENT_METHODS,
  normalizePaymentAccount,
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
const codeForm = ref({ registration_code: '' })
const codeSaving = ref(false)
const contactForm = ref({ hotel_name: '', contact_person: '', email: '', phone: '', address: '', city: '', country: '' })
const savingContact = ref(false)
const brandingFiles = ref({ signature: null, stamp: null })
const owners = ref([])
const ownerForm = ref({ owner_id: '' })
const newOwner = ref({ full_name: '', email: '' })
const savingOwner = ref(false)
const creatingOwner = ref(false)
const selectedFeatures = ref([])
const planFeatures = ref({})
const planFeatureLabels = ref({})
const planFeatureLabelsLoading = ref(true)

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

// Feature toggle logic.
const allFeatureKeys = computed(() => Object.keys(planFeatureLabels.value))

const featureGroups = computed(() => {
  const coreOps = t('superadmin.coreOperations')
  const fb = t('superadmin.foodAndBeverage')
  const ops = t('superadmin.operations')
  const proc = t('superadmin.procurement')
  const comm = t('superadmin.communication')
  const ent = t('superadmin.enterpriseGroup')
  const groups = {
    [coreOps]: [], [fb]: [], [ops]: [], [proc]: [], [comm]: [], [ent]: [],
  }
  const grouping = {
    reservations: coreOps, rooms: coreOps, guests: coreOps,
    payments: coreOps, booking_requisitions: coreOps, staff: coreOps,
    profile: coreOps, reports: coreOps, overview: coreOps,
    orders: fb, menu: fb,
    housekeeping: ops, laundry: ops, fun_games: ops,
    inventory: ops, suppliers: ops, accounting: ops,
    requisitions: proc, purchase_orders: proc, goods_received: proc,
    issue_reports: comm, messages: comm, statuses: comm,
    owner_portal: ent, multi_hotel: ent, advanced_analytics: ent,
  }
  allFeatureKeys.value.forEach((key) => {
    const group = grouping[key] || coreOps
    groups[group].push({ key, ...planFeatureLabels.value[key] })
  })
  return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length > 0))
})

function selectAllFeatures() {
  selectedFeatures.value = [...allFeatureKeys.value]
}

function deselectAllFeatures() {
  selectedFeatures.value = []
}

async function loadPlanFeatures() {
  planFeatureLabelsLoading.value = true
  try {
    const { data } = await planApi.index()
    planFeatures.value = data.plans
    planFeatureLabels.value = data.feature_labels
  } catch { /* ignore */ }
  planFeatureLabelsLoading.value = false
}

function seedFeaturesFromTenant() {
  // If tenant has explicit features, use them; otherwise use all from the plan.
  if (tenant.value?.features && tenant.value.features.length) {
    selectedFeatures.value = [...tenant.value.features]
  } else {
    const planKey = tenant.value?.subscription_plan || 'enterprise'
    const planFeat = planFeatures.value[planKey]?.features || allFeatureKeys.value
    selectedFeatures.value = [...planFeat]
  }
}

/**
 * Returns a fresh copy of the default payment method list.
 * @returns {string[]} All supported payment method codes.
 */
function defaultPaymentMethods() {
  return PAYMENT_METHODS.slice()
}

/**
 * Builds the per-provider account form entries in the object shape (number /
 * lipa_number / name). Bank providers only use the number field.
 * @returns {Object<string, Object<string, string>>} Map of provider code to account fields.
 */
function emptyAccounts() {
  return Object.fromEntries(
    ALL_PROVIDERS.map((p) => [
      p,
      MOBILE_MONEY_PROVIDERS.includes(p)
        ? { number: '', lipa_number: '', name: '' }
        : { number: '' },
    ]),
  )
}

/** Providers worth configuring, based on which methods the hotel enables. */
const accountProviders = computed(() => {
  const enabled = paymentForm.value.methods
  return ALL_PROVIDERS.filter((p) =>
    enabled.includes(MOBILE_MONEY_PROVIDERS.includes(p) ? METHOD_MOBILE_MONEY : METHOD_BANK),
  )
})

/**
 * Maps a tenant status to the CSS class used for its badge colour.
 * @param {string} s - The tenant status (active, pending, suspended, cancelled).
 * @returns {string} The badge CSS class.
 */
function statusBadge(s) {
  const map = { active: 'badge-green', pending: 'badge-yellow', suspended: 'badge-red', cancelled: 'badge-gray' }
  return map[s] || 'badge-gray'
}

/** Loads the tenant and its analytics, and seeds every edit form from the response. */
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
    codeForm.value.registration_code = tenant.value.registration_code || ''
    contactForm.value.hotel_name = tenant.value.hotel_name || ''
    contactForm.value.contact_person = tenant.value.contact_person || ''
    contactForm.value.email = tenant.value.email || ''
    contactForm.value.phone = tenant.value.phone || ''
    contactForm.value.address = tenant.value.address || ''
    contactForm.value.city = tenant.value.city || ''
    contactForm.value.country = tenant.value.country || ''
    ownerForm.value.owner_id = tenant.value.owner_id || ''
    paymentForm.value.methods =
      tenant.value.payment_methods && tenant.value.payment_methods.length
        ? tenant.value.payment_methods
        : defaultPaymentMethods()
    const accounts = tenant.value.payment_accounts || {}
    ALL_PROVIDERS.forEach((p) => {
      paymentForm.value.accounts[p] =
        normalizePaymentAccount(accounts[p]) ||
        (MOBILE_MONEY_PROVIDERS.includes(p) ? { number: '', lipa_number: '', name: '' } : { number: '' })
    })
    seedFeaturesFromTenant()
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

/** Persists the chosen subscription plan, status, and feature flags. */
async function updateSubscription() {
  saving.value = true
  error.value = ''
  try {
    const payload = { ...subForm.value, features: selectedFeatures.value }
    const res = await tenantApi.updateSubscription(route.params.id, payload)
    window.alert(res.data.message || t('superadmin.subscriptionUpdated'))
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.subscriptionUpdateError')
  } finally {
    saving.value = false
  }
}

/** Saves the hotel's TIN and VRN tax numbers. */
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

/** Saves the hotel's business name and public contact details. */
async function saveContact() {
  savingContact.value = true
  error.value = ''
  try {
    const res = await tenantApi.update(route.params.id, {
      hotel_name: contactForm.value.hotel_name || null,
      contact_person: contactForm.value.contact_person || null,
      email: contactForm.value.email || null,
      phone: contactForm.value.phone || null,
      address: contactForm.value.address || null,
      city: contactForm.value.city || null,
      country: contactForm.value.country || null,
    })
    const updated = res.data.tenant || res.data.data || res.data
    ;['hotel_name', 'contact_person', 'email', 'phone', 'address', 'city', 'country'].forEach((key) => {
      if (updated[key] !== undefined) tenant.value[key] = updated[key]
    })
    window.alert(res.data.message || t('superadmin.updateSuccess'))
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.updateError')
  } finally {
    savingContact.value = false
  }
}

/** Updates the hotel's registration code (the segment inside every document number). */
async function saveCode() {
  codeSaving.value = true
  error.value = ''
  try {
    const res = await tenantApi.update(route.params.id, {
      registration_code: codeForm.value.registration_code.toUpperCase(),
    })
    tenant.value.registration_code = res.data.tenant?.registration_code ?? codeForm.value.registration_code.toUpperCase()
    window.alert(res.data.message || t('superadmin.codeSaved'))
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.codeSaveError')
  } finally {
    codeSaving.value = false
  }
}

/** Downloads a JSON backup of this hotel's operational data. */
async function downloadBackup() {
  error.value = ''
  try {
    const res = await tenantApi.backup(route.params.id)
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-${tenant.value.hotel_name}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.backupFailed')
  }
}

/**
 * Stores the selected image file ('signature' or 'stamp') for the branding upload.
 * @param {Event} event - The file input change event.
 * @param {string} key - Which branding asset the input belongs to.
 */
function onBrandingFile(event, key) {
  brandingFiles.value[key] = event.target.files?.[0] || null
}

/** Uploads the signature/stamp images and updates their URLs on the tenant. */
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

/**
 * Removes one of the branding assets by telling the API to clear its image.
 * @param {string} asset - The asset to remove ('signature' or 'stamp').
 */
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

/** Assigns an existing owner account to this tenant. */
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

/** Creates a new owner account, reloads the owner list and selects the new owner. */
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

/** Loads the pool of owners available for assignment. */
async function loadOwners() {
  try {
    const res = await tenantApi.owners()
    owners.value = res.data.owners || []
  } catch {
    owners.value = []
  }
}

/** Persists the enabled payment methods and their (non-empty) account details. */
async function savePaymentMethods() {
  savingPayment.value = true
  error.value = ''
  try {
    const accounts = Object.fromEntries(
      ALL_PROVIDERS.map((p) => [p, normalizePaymentAccount(paymentForm.value.accounts[p])]).filter(
        ([, v]) => !!v,
      ),
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

onMounted(async () => {
  await Promise.all([loadPlanFeatures(), load()])
  seedFeaturesFromTenant()
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

.code-form {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.code-form label {
  font-size: 13px;
  font-weight: 600;
  color: #888;
}

.code-input {
  width: 90px;
  text-transform: uppercase;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 700;
  letter-spacing: 1px;
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

.account-subfields {
  display: grid;
  gap: 4px;
}

.account-sublabel {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
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

/* Feature toggles */
.feature-quick-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.feature-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feature-group-title {
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e2e8f0;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
}

.feature-toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  background: #fff;
}

.feature-toggle:hover {
  border-color: #93c5fd;
  background: #f0f7ff;
}

.feature-toggle:has(.feature-checkbox:checked) {
  border-color: #3b82f6;
  background: #eff6ff;
}

.feature-checkbox {
  margin-top: 2px;
  width: 16px;
  height: 16px;
  accent-color: #2563eb;
  flex-shrink: 0;
}

.feature-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feature-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.feature-desc {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.4;
}

.feature-count {
  margin-top: 16px;
  font-size: 13px;
  color: #64748b;
}
</style>
