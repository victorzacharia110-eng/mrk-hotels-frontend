<!--
  Hotel Business Details page (route: /app/settings/hotel,
  name: hotel-settings).

  Manager review: "Where does hotel company data registered from? If we change
  the name of hotel and other info such as address will the adjustment appear on
  every panel and every invoice as well as all exportable reports including
  waiter receipts and kitchen order?"

  The API and the translations already existed, but there was no page, route or
  navigation entry to reach them — and the sidebar item labelled "Company Data"
  points at the corporate-creditor directory, which is a different feature. This
  page is the missing editor for the hotel's own registered details.

  Propagation is automatic because every consumer reads the single tenant
  record: TableExportButton fetches GET /hotel-settings for the CSV/XLSX/PDF
  letterhead, and the invoice, folio and receipt views read the tenant model
  directly. Nothing here needs to be pushed anywhere else.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('hotelSettings.title') }}</h1>
        <p class="muted">{{ $t('hotelSettings.hint') }}</p>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="!canEdit" class="alert alert-warning">
      {{ $t('hotelSettings.readOnlyHint') }}
    </div>

    <div v-if="loading" class="card"><p class="muted">{{ $t('common.loading') }}</p></div>

    <form v-else class="settings-form" @submit.prevent="save">
      <!-- ─── Registered identity ─────────────────────────────────────── -->
      <div class="card">
        <h3>{{ $t('hotelSettings.identitySection') }}</h3>

        <div class="filter-grid">
          <div class="form-group">
            <label for="hs-hotel-name">{{ $t('hotelSettings.hotelName') }}</label>
            <input
              id="hs-hotel-name"
              v-model.trim="form.hotel_name"
              type="text"
              class="input"
              :disabled="!canEdit"
              maxlength="255"
            />
          </div>

          <div class="form-group">
            <label for="hs-registration">{{ $t('hotelSettings.registrationCode') }}</label>
            <input
              id="hs-registration"
              v-model.trim="form.registration_code"
              type="text"
              class="input"
              :disabled="!canEdit"
              maxlength="6"
              :placeholder="$t('hotelSettings.registrationPlaceholder')"
            />
          </div>

          <div class="form-group">
            <label for="hs-contact">{{ $t('hotelSettings.contactPerson') }}</label>
            <input
              id="hs-contact"
              v-model.trim="form.contact_person"
              type="text"
              class="input"
              :disabled="!canEdit"
              maxlength="255"
            />
          </div>

          <div class="form-group">
            <label for="hs-email">{{ $t('hotelSettings.email') }}</label>
            <input
              id="hs-email"
              v-model.trim="form.email"
              type="email"
              class="input"
              :disabled="!canEdit"
            />
          </div>

          <div class="form-group">
            <label for="hs-phone">{{ $t('hotelSettings.phone') }}</label>
            <input
              id="hs-phone"
              v-model.trim="form.phone"
              type="tel"
              class="input"
              :disabled="!canEdit"
              maxlength="20"
            />
          </div>

          <div class="form-group">
            <label for="hs-city">{{ $t('hotelSettings.city') }}</label>
            <input
              id="hs-city"
              v-model.trim="form.city"
              type="text"
              class="input"
              :disabled="!canEdit"
              maxlength="100"
            />
          </div>

          <div class="form-group">
            <label for="hs-country">{{ $t('hotelSettings.country') }}</label>
            <input
              id="hs-country"
              v-model.trim="form.country"
              type="text"
              class="input"
              :disabled="!canEdit"
              maxlength="100"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="hs-address">{{ $t('hotelSettings.address') }}</label>
          <textarea
            id="hs-address"
            v-model.trim="form.address"
            class="input"
            rows="2"
            :disabled="!canEdit"
          ></textarea>
        </div>
      </div>

      <!-- ─── Tax registration ────────────────────────────────────────── -->
      <div class="card">
        <h3>{{ $t('hotelSettings.taxSection') }}</h3>
        <p class="muted">{{ $t('hotelSettings.taxHint') }}</p>

        <div class="filter-grid">
          <div class="form-group">
            <label for="hs-tin">{{ $t('hotelSettings.tin') }}</label>
            <input
              id="hs-tin"
              v-model.trim="form.tin"
              type="text"
              class="input"
              :disabled="!canEdit"
              maxlength="30"
            />
          </div>

          <div class="form-group">
            <label for="hs-vrn">{{ $t('hotelSettings.vrn') }}</label>
            <input
              id="hs-vrn"
              v-model.trim="form.vrn"
              type="text"
              class="input"
              :disabled="!canEdit"
              maxlength="30"
            />
          </div>

          <div class="form-group">
            <label for="hs-timezone">{{ $t('hotelSettings.timezone') }}</label>
            <input
              id="hs-timezone"
              v-model.trim="form.timezone"
              type="text"
              class="input"
              :disabled="!canEdit"
              list="hs-timezone-options"
              maxlength="50"
            />
            <datalist id="hs-timezone-options">
              <option v-for="zone in timezoneOptions" :key="zone" :value="zone" />
            </datalist>
            <small class="muted">{{ $t('hotelSettings.timezoneHint') }}</small>
          </div>
        </div>
      </div>

      <!-- ─── Logo ────────────────────────────────────────────────────── -->
      <div class="card">
        <h3>{{ $t('hotelSettings.logoSection') }}</h3>
        <p class="muted">{{ $t('hotelSettings.logoHint') }}</p>

        <div class="logo-row">
          <img
            v-if="logoUrl"
            :src="logoUrl"
            :alt="form.hotel_name || $t('hotelSettings.hotelName')"
            class="logo-preview"
          />
          <div v-else class="logo-preview logo-empty" aria-hidden="true">
            <i class="fas fa-hotel"></i>
          </div>

          <div class="logo-actions">
            <input
              ref="logoInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              class="visually-hidden-input"
              @change="onLogoSelected"
            />
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="!canEdit || logoFile"
              @click="logoInput?.click()"
            >
              <i class="fas fa-upload"></i> {{ $t('hotelSettings.logoChoose') }}
            </button>
            <button
              v-if="canEdit && logoUrl"
              type="button"
              class="btn btn-secondary btn-sm"
              :disabled="saving"
              @click="removeLogo"
            >
              <i class="fas fa-trash"></i> {{ $t('hotelSettings.logoRemove') }}
            </button>
            <span v-if="logoFile" class="muted">{{ logoFile.name }}</span>
          </div>
        </div>
      </div>

      <!-- ─── Payment methods and accounts ────────────────────────────── -->
      <div class="card">
        <h3>{{ $t('hotelSettings.paymentSection') }}</h3>

        <fieldset class="methods">
          <legend class="muted">{{ $t('hotelSettings.acceptedMethods') }}</legend>
          <label v-for="method in paymentMethods" :key="method.value" class="method-check">
            <input
              type="checkbox"
              :value="method.value"
              :disabled="!canEdit"
              :checked="form.payment_methods.includes(method.value)"
              @change="toggleMethod(method.value, $event.target.checked)"
            />
            <span>{{ $t(method.labelKey) }}</span>
          </label>
        </fieldset>

        <div
          v-for="provider in paymentProviders"
          :key="provider.value"
          class="provider-row"
          :class="{ 'provider-off': !providerEnabled(provider.value) }"
        >
          <div class="provider-head">
            <strong>{{ $t(provider.labelKey) }}</strong>
            <span class="muted">{{ $t(provider.hintKey) }}</span>
          </div>
          <div class="filter-grid">
            <div class="form-group">
              <label :for="`pa-number-${provider.value}`">{{ $t('hotelSettings.accountPlaceholder') }}</label>
              <input
                :id="`pa-number-${provider.value}`"
                :value="accountNumber(provider.value)"
                type="text"
                class="input"
                :disabled="!canEdit || !providerEnabled(provider.value)"
                maxlength="100"
                @input="setAccount(provider.value, 'number', $event.target.value)"
              />
            </div>
            <div class="form-group">
              <label :for="`pa-lipa-${provider.value}`">{{ $t('hotelSettings.lipaNumberLabel') }}</label>
              <input
                :id="`pa-lipa-${provider.value}`"
                :value="accountField(provider.value, 'lipa_number')"
                type="text"
                class="input"
                :disabled="!canEdit || !providerEnabled(provider.value)"
                maxlength="100"
                :placeholder="$t('hotelSettings.lipaNumberPlaceholder')"
                @input="setAccount(provider.value, 'lipa_number', $event.target.value)"
              />
            </div>
            <div class="form-group">
              <label :for="`pa-name-${provider.value}`">{{ $t('hotelSettings.receiverNameLabel') }}</label>
              <input
                :id="`pa-name-${provider.value}`"
                :value="accountField(provider.value, 'name')"
                type="text"
                class="input"
                :disabled="!canEdit || !providerEnabled(provider.value)"
                maxlength="190"
                :placeholder="$t('hotelSettings.receiverNamePlaceholder')"
                @input="setAccount(provider.value, 'name', $event.target.value)"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="!canEdit || saving">
          <i class="fas fa-floppy-disk"></i>
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="saving"
          @click="reset"
        >
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { hotelSettingsApi } from '@/api'
import { invalidateOfficialHeader } from '@/utils/officialHeader'

const { t } = useI18n()
const authStore = useAuthStore()

// Mirrors the backend `level:80` guard on PUT /hotel-settings.
const canEdit = computed(() => authStore.can(80))

const TIMEZONES = [
  'Africa/Dar_es_Salaam',
  'Africa/Nairobi',
  'Africa/Kampala',
  'Africa/Kigali',
  'Africa/Bujumbura',
  'Africa/Lusaka',
  'Africa/Harare',
  'Africa/Johannesburg',
  'Africa/Accra',
  'Africa/Lagos',
  'Africa/Cairo',
]

const PAYMENT_METHODS = [
  { value: 'cash', labelKey: 'hotelSettings.methodCash' },
  { value: 'mobile_money', labelKey: 'hotelSettings.methodMobileMoney' },
  { value: 'bank', labelKey: 'hotelSettings.methodBank' },
  { value: 'selcom', labelKey: 'hotelSettings.methodSelcom' },
  { value: 'card', labelKey: 'hotelSettings.methodCard' },
  { value: 'clickpesa', labelKey: 'hotelSettings.methodClickPesa' },
]

// Mirrors PaymentOptions::MOBILE_MONEY_PROVIDERS / BANK_PROVIDERS.
const PAYMENT_PROVIDERS = [
  { value: 'airtel_money', labelKey: 'hotelSettings.providerAirtel', hintKey: 'hotelSettings.providerMobileHint' },
  { value: 'mpesa', labelKey: 'hotelSettings.providerMpesa', hintKey: 'hotelSettings.providerMobileHint' },
  { value: 'mixx_by_yas', labelKey: 'hotelSettings.providerMixxByYas', hintKey: 'hotelSettings.providerMobileHint' },
  { value: 'halopesa', labelKey: 'hotelSettings.providerHalopesa', hintKey: 'hotelSettings.providerMobileHint' },
  { value: 'crdb', labelKey: 'hotelSettings.providerCrdb', hintKey: 'hotelSettings.providerBankHint' },
  { value: 'nmb', labelKey: 'hotelSettings.providerNmb', hintKey: 'hotelSettings.providerBankHint' },
  { value: 'nbc', labelKey: 'hotelSettings.providerNbc', hintKey: 'hotelSettings.providerBankHint' },
  { value: 'other', labelKey: 'hotelSettings.providerOtherBank', hintKey: 'hotelSettings.providerBankHint' },
]

const paymentMethods = PAYMENT_METHODS
const paymentProviders = PAYMENT_PROVIDERS
const timezoneOptions = TIMEZONES

const blankForm = () => ({
  hotel_name: '',
  registration_code: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  country: '',
  tin: '',
  vrn: '',
  timezone: 'Africa/Dar_es_Salaam',
  payment_methods: [],
  payment_accounts: {},
})

const form = reactive(blankForm())
const logoUrl = ref('')
const logoFile = ref(null)
const logoInput = ref(null)
const loading = ref(true)
const saving = ref(false)
const success = ref('')
const error = ref('')

/** Flattens a Laravel 422 payload into one readable line. */
function flattenError(err) {
  const fields = err?.response?.data?.errors
  if (fields) {
    return Object.values(fields)
      .flat()
      .join(' ')
  }
  return err?.response?.data?.message || t('hotelSettings.loadError')
}

/** Fills the form from the API payload, tolerating nulls. */
function hydrate(hotel) {
  const merged = { ...blankForm(), ...hotel }
  form.hotel_name = merged.hotel_name || ''
  form.registration_code = merged.registration_code || ''
  form.contact_person = merged.contact_person || ''
  form.email = merged.email || ''
  form.phone = merged.phone || ''
  form.address = merged.address || ''
  form.city = merged.city || ''
  form.country = merged.country || ''
  form.tin = merged.tin || ''
  form.vrn = merged.vrn || ''
  form.timezone = merged.timezone || 'Africa/Dar_es_Salaam'
  form.payment_methods = Array.isArray(merged.payment_methods) ? [...merged.payment_methods] : []
  form.payment_accounts = { ...merged.payment_accounts }
  logoUrl.value = merged.logo_url || ''
  logoFile.value = null
}

/**
 * A provider's row is enabled when its owning method is accepted, or when the
 * hotel has already recorded an account for it.
 * @param {string} provider Provider key, e.g. `mpesa`.
 * @returns {boolean} Whether the account inputs are editable.
 */
function providerEnabled(provider) {
  const isMobile = ['airtel_money', 'mpesa', 'mixx_by_yas', 'halopesa'].includes(provider)
  const methodOn = isMobile
    ? form.payment_methods.includes('mobile_money')
    : form.payment_methods.includes('bank')
  return methodOn || Boolean(form.payment_accounts[provider] && Object.keys(form.payment_accounts[provider]).length)
}

/**
 * Reads one field of a provider account.
 * @param {string} provider Provider key.
 * @param {string} field `number`, `lipa_number` or `name`.
 * @returns {string} The stored value, or an empty string.
 */
function accountField(provider, field) {
  return form.payment_accounts[provider]?.[field] || ''
}

/**
 * The generic account number, falling back to the Lipa number so a legacy
 * account stored only as `lipa_number` still shows in the main box.
 * @param {string} provider Provider key.
 * @returns {string} The account number to display.
 */
function accountNumber(provider) {
  return accountField(provider, 'number') || accountField(provider, 'lipa_number')
}

/**
 * Writes one field of a provider account, dropping the entry when it empties so
 * the API stores only populated accounts.
 * @param {string} provider Provider key.
 * @param {string} field Field name.
 * @param {string} value New value.
 */
function setAccount(provider, field, value) {
  const current = { ...form.payment_accounts[provider] }
  const trimmed = value.trim()
  if (trimmed === '') {
    delete current[field]
  } else {
    current[field] = trimmed
  }

  if (Object.keys(current).length === 0) {
    delete form.payment_accounts[provider]
  } else {
    form.payment_accounts[provider] = current
  }
}

/**
 * Adds or removes an accepted payment method.
 * @param {string} method Method key, e.g. `cash`.
 * @param {boolean} on Whether it is now checked.
 */
function toggleMethod(method, on) {
  if (on) {
    if (!form.payment_methods.includes(method)) form.payment_methods.push(method)
  } else {
    form.payment_methods = form.payment_methods.filter((m) => m !== method)
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await hotelSettingsApi.show()
    hydrate(res.data?.hotel || res.data?.data || {})
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  success.value = ''
  error.value = ''
  try {
    const payload = new FormData()
    payload.append('hotel_name', form.hotel_name)
    payload.append('registration_code', form.registration_code)
    payload.append('contact_person', form.contact_person)
    payload.append('email', form.email)
    payload.append('phone', form.phone)
    payload.append('address', form.address)
    payload.append('city', form.city)
    payload.append('country', form.country)
    payload.append('tin', form.tin)
    payload.append('vrn', form.vrn)
    payload.append('timezone', form.timezone)
    payload.append('payment_methods', JSON.stringify(form.payment_methods))
    payload.append('payment_accounts', JSON.stringify(form.payment_accounts))
    if (logoFile.value) payload.append('logo', logoFile.value)

    const res = await hotelSettingsApi.update(payload)
    hydrate(res.data?.hotel || {})
    success.value = t('hotelSettings.saved')
    // Exports cache the letterhead for the session, so the cache has to be
    // dropped here or a renamed hotel keeps printing its old name on every
    // PDF and CSV until the browser restarts.
    invalidateOfficialHeader()
    // Panels read the name/address off the profile, so that has to be refetched.
    await authStore.fetchProfile()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

async function removeLogo() {
  saving.value = true
  error.value = ''
  try {
    await hotelSettingsApi.removeLogo()
    logoUrl.value = ''
    logoFile.value = null
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

function onLogoSelected(event) {
  const file = event.target.files?.[0]
  if (file) {
    logoFile.value = file
    logoUrl.value = URL.createObjectURL(file)
  }
}

function reset() {
  load()
}

onMounted(load)
</script>

<style scoped>
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card h3 {
  margin: 0 0 12px 0;
}

.logo-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.logo-preview {
  width: 96px;
  height: 96px;
  object-fit: contain;
  border: 1px solid var(--border, #d4d4d8);
  border-radius: 8px;
  background: #fff;
  padding: 6px;
}

.logo-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: var(--muted, #a1a1aa);
}

.logo-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Keeps the file input out of the layout but still keyboard reachable. */
.visually-hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.methods {
  border: 0;
  padding: 0;
  margin: 0 0 16px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: center;
}

.methods legend {
  padding: 0;
  margin: 0 0 4px 0;
  font-size: 0.85rem;
}

.method-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.provider-row {
  border-top: 1px solid var(--border, #e4e4e7);
  padding-top: 12px;
  margin-top: 12px;
}

/* A provider whose method is switched off reads as unavailable. */
.provider-off {
  opacity: 0.55;
}

.provider-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.form-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
