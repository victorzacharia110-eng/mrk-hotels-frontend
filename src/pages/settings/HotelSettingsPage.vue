<!--
  Hotel Business Details page (route: /app/settings/hotel, name: hotel-settings).
  PDF-aligned: structured address, custom payment methods/providers/accounts,
  and 6-digit property/registration code with backward compatibility.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ paymentMethodsOnly ? $t('hotelSettings.paymentSection') : $t('hotelSettings.title') }}</h1>
        <p class="muted">{{ paymentMethodsOnly ? $t('hotelSettings.methodsHint', 'Add custom payment methods (name and description).') : $t('hotelSettings.hint') }}</p>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="!canEdit" class="alert alert-warning">
      {{ $t('hotelSettings.readOnlyHint') }}
    </div>

    <div v-if="loading" class="card"><p class="muted">{{ $t('common.loading') }}</p></div>

    <form v-else class="settings-form" @submit.prevent="save">
      <div v-if="!paymentMethodsOnly" class="card">
        <h3>{{ $t('hotelSettings.identitySection') }}</h3>

        <div class="filter-grid narrow-grid">
          <div class="form-group">
            <label for="hs-hotel-name">{{ $t('hotelSettings.hotelName') }}</label>
            <input id="hs-hotel-name" v-model.trim="form.hotel_name" type="text" class="input" :disabled="!canEdit" maxlength="255" />
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
              inputmode="numeric"
              pattern="[0-9]{6}"
              :placeholder="$t('hotelSettings.registrationPlaceholder') || '6-digit code'"
            />
            <small class="muted">{{ $t('hotelSettings.registrationHint', '6-digit property code (existing codes remain valid).') }}</small>
          </div>

          <div class="form-group">
            <label for="hs-contact">{{ $t('hotelSettings.contactPerson') }}</label>
            <input id="hs-contact" v-model.trim="form.contact_person" type="text" class="input" :disabled="!canEdit" maxlength="255" />
          </div>

          <div class="form-group">
            <label for="hs-email">{{ $t('hotelSettings.email') }}</label>
            <input id="hs-email" v-model.trim="form.email" type="email" class="input" :disabled="!canEdit" />
          </div>

          <div class="form-group">
            <label for="hs-phone">{{ $t('hotelSettings.phone') }}</label>
            <input id="hs-phone" v-model.trim="form.phone" type="tel" class="input" :disabled="!canEdit" maxlength="20" />
          </div>

          <div class="form-group">
            <label for="hs-city">{{ $t('hotelSettings.city') }}</label>
            <input id="hs-city" v-model.trim="form.city" type="text" class="input" :disabled="!canEdit" maxlength="100" />
          </div>

          <div class="form-group">
            <label for="hs-country">{{ $t('hotelSettings.country') }}</label>
            <input id="hs-country" v-model.trim="form.country" type="text" class="input" :disabled="!canEdit" maxlength="100" />
          </div>
        </div>

        <div class="address-block">
          <h4 class="subhead">{{ $t('hotelSettings.address') }}</h4>
          <div class="filter-grid narrow-grid">
            <div class="form-group">
              <label for="hs-coordinates">{{ $t('hotelSettings.addressCoordinates', 'Coordinates') }}</label>
              <input id="hs-coordinates" v-model.trim="form.address_coordinates" type="text" class="input" :disabled="!canEdit" placeholder="e.g. -6.7924, 39.2083" />
            </div>
            <div class="form-group">
              <label for="hs-pobox">{{ $t('hotelSettings.addressPoBox', 'P.O. Box') }}</label>
              <input id="hs-pobox" v-model.trim="form.address_po_box" type="text" class="input" :disabled="!canEdit" placeholder="P.O. Box" />
            </div>
            <div class="form-group form-wide">
              <label for="hs-street">{{ $t('hotelSettings.addressStreet', 'Street address') }}</label>
              <input id="hs-street" v-model.trim="form.address_street" type="text" class="input" :disabled="!canEdit" placeholder="Street address" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="!paymentMethodsOnly" class="card">
        <h3>{{ $t('hotelSettings.taxSection') }}</h3>
        <p class="muted">{{ $t('hotelSettings.taxHint') }}</p>

        <div class="filter-grid narrow-grid">
          <div class="form-group">
            <label for="hs-tin">{{ $t('hotelSettings.tin') }}</label>
            <input id="hs-tin" v-model.trim="form.tin" type="text" class="input" :disabled="!canEdit" maxlength="30" />
          </div>
          <div class="form-group">
            <label for="hs-vrn">{{ $t('hotelSettings.vrn') }}</label>
            <input id="hs-vrn" v-model.trim="form.vrn" type="text" class="input" :disabled="!canEdit" maxlength="30" />
          </div>
          <div class="form-group">
            <label for="hs-timezone">{{ $t('hotelSettings.timezone') }}</label>
            <input id="hs-timezone" v-model.trim="form.timezone" type="text" class="input" :disabled="!canEdit" list="hs-timezone-options" maxlength="50" />
            <datalist id="hs-timezone-options">
              <option v-for="zone in timezoneOptions" :key="zone" :value="zone" />
            </datalist>
            <small class="muted">{{ $t('hotelSettings.timezoneHint') }}</small>
          </div>
        </div>
      </div>

      <div v-if="!paymentMethodsOnly" class="card">
        <h3>{{ $t('hotelSettings.logoSection') }}</h3>
        <p class="muted">{{ $t('hotelSettings.logoHint') }}</p>

        <div class="logo-row">
          <img v-if="logoUrl" :src="logoUrl" :alt="form.hotel_name || $t('hotelSettings.hotelName')" class="logo-preview" />
          <div v-else class="logo-preview logo-empty" aria-hidden="true"><i class="fas fa-hotel"></i></div>

          <div class="logo-actions">
            <input ref="logoInput" type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" class="visually-hidden-input" @change="onLogoSelected" />
            <button type="button" class="btn btn-secondary btn-sm" :disabled="!canEdit || logoFile" @click="logoInput?.click()">
              <i class="fas fa-upload"></i> {{ $t('hotelSettings.logoChoose') }}
            </button>
            <button v-if="canEdit && logoUrl" type="button" class="btn btn-secondary btn-sm" :disabled="saving" @click="removeLogo">
              <i class="fas fa-trash"></i> {{ $t('hotelSettings.logoRemove') }}
            </button>
            <span v-if="logoFile" class="muted">{{ logoFile.name }}</span>
          </div>
        </div>
      </div>

      <div v-if="paymentMethodsEnabled" class="card">
        <h3>{{ $t('hotelSettings.paymentSection') }}</h3>

        <div class="subsection">
          <div class="subsection-head">
            <div>
              <h4 class="subhead">{{ $t('hotelSettings.acceptedMethods') }}</h4>
              <p class="muted small">{{ $t('hotelSettings.methodsHint', 'Add custom payment methods (name and description).') }}</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" :disabled="!canEdit" @click="addMethod">
              <i class="fas fa-plus"></i> {{ $t('hotelSettings.addMethod', 'Add method') }}
            </button>
          </div>

          <div v-if="form.payment_methods.length" class="custom-list">
            <div v-for="(method, idx) in form.payment_methods" :key="method._id || idx" class="custom-row method-row">
              <label class="method-check compact">
                <input type="checkbox" :disabled="!canEdit" v-model="method.enabled" />
                <span class="muted">{{ $t('hotelSettings.enabled', 'Enabled') }}</span>
              </label>
              <div class="form-group">
                <label>{{ $t('common.name', 'Name') }}</label>
                <input v-model.trim="method.label" type="text" class="input" :disabled="!canEdit" placeholder="e.g. CASH, DIGITAL WALLETS, BANKs, CARD, MOBILE MONEY" @input="syncMethodValue(method)" />
              </div>
              <div class="form-group">
                <label>{{ $t('common.description', 'Description') }}</label>
                <input v-model.trim="method.description" type="text" class="input" :disabled="!canEdit" placeholder="Description" />
              </div>
              <button type="button" class="btn btn-danger btn-sm icon-btn" :disabled="!canEdit" @click="removeMethod(idx)" :title="$t('common.remove', 'Remove')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <p v-else class="muted">{{ $t('hotelSettings.noMethods', 'No payment methods configured.') }}</p>
        </div>

        <div class="subsection">
          <div class="subsection-head">
            <div>
              <h4 class="subhead">{{ $t('hotelSettings.providersAccounts', 'Payment Providers & Accounts') }}</h4>
              <p class="muted small">{{ $t('hotelSettings.providersHint', 'Add provider/account details and link each to a registered payment method.') }}</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" :disabled="!canEdit" @click="addProviderAccount">
              <i class="fas fa-plus"></i> {{ $t('hotelSettings.addProvider', 'Add provider') }}
            </button>
          </div>

          <div v-if="form.payment_accounts_list.length" class="custom-list">
            <div v-for="(acc, idx) in form.payment_accounts_list" :key="acc._id || idx" class="custom-row provider-custom-row">
              <div class="form-group">
                <label>{{ $t('common.name', 'Name') }}</label>
                <input v-model.trim="acc.provider_name" type="text" class="input" :disabled="!canEdit" placeholder="Provider name" @input="syncAccountKey(acc)" />
              </div>
              <div class="form-group">
                <label>{{ $t('hotelSettings.accountPlaceholder') }}</label>
                <input v-model.trim="acc.number" type="text" class="input account-number-input" :disabled="!canEdit" :placeholder="$t('hotelSettings.accountPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ $t('hotelSettings.linkedMethod', 'Payment method') }}</label>
                <select v-model="acc.method" class="input" :disabled="!canEdit">
                  <option value="">{{ $t('common.select', 'Select') }}</option>
                  <option v-for="m in enabledMethodOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>{{ $t('hotelSettings.lipaNumberLabel') }}</label>
                <input v-model.trim="acc.lipa_number" type="text" class="input account-number-input" :disabled="!canEdit" :placeholder="$t('hotelSettings.lipaNumberPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ $t('hotelSettings.receiverNameLabel') }}</label>
                <input v-model.trim="acc.name" type="text" class="input" :disabled="!canEdit" :placeholder="$t('hotelSettings.receiverNamePlaceholder')" />
              </div>
              <button type="button" class="btn btn-danger btn-sm icon-btn" :disabled="!canEdit" @click="removeProviderAccount(idx)" :title="$t('common.remove', 'Remove')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <p v-else class="muted">{{ $t('hotelSettings.noProviders', 'No payment provider accounts configured.') }}</p>
        </div>
      </div>

      <div v-else-if="paymentMethodsOnly" class="card">
        <h3>{{ $t('hotelSettings.paymentSection') }}</h3>
        <div class="alert alert-warning">{{ $t('hotelSettings.paymentMethodsDisabled') }}</div>
      </div>

      <div v-if="!paymentMethodsOnly || paymentMethodsEnabled" class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="!canEdit || saving">
          <i class="fas fa-floppy-disk"></i>
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="saving" @click="reset">
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

const props = defineProps({
  paymentMethodsOnly: { type: Boolean, default: false },
})

const { t } = useI18n()
const authStore = useAuthStore()

const canEdit = computed(() => authStore.can(80))
const paymentMethodsEnabled = computed(() => {
  const features = authStore.enabledFeatures
  return !features || features.includes('payment_methods')
})

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

const DEFAULT_METHODS = [
  { value: 'cash', label: 'CASH', description: '' },
  { value: 'mobile_money', label: 'MOBILE MONEY', description: '' },
  { value: 'bank', label: 'BANKs', description: '' },
  { value: 'card', label: 'CARD', description: '' },
  { value: 'digital_wallets', label: 'DIGITAL WALLETS', description: '' },
]

const timezoneOptions = TIMEZONES

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseAddress(raw) {
  if (raw && typeof raw === 'object') {
    return {
      coordinates: raw.coordinates || raw.coords || '',
      po_box: raw.po_box || raw.pobox || raw.poBox || '',
      street: raw.street || raw.street_address || raw.streetAddress || raw.address || '',
      legacy: raw.legacy || '',
    }
  }
  const text = String(raw || '').trim()
  if (!text) return { coordinates: '', po_box: '', street: '', legacy: '' }
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parseAddress(parsed)
    }
  } catch {
    // legacy plain text
  }
  return { coordinates: '', po_box: '', street: text, legacy: text }
}

function serializeAddress(form) {
  const payload = {
    coordinates: (form.address_coordinates || '').trim(),
    po_box: (form.address_po_box || '').trim(),
    street: (form.address_street || '').trim(),
  }
  if (!payload.coordinates && !payload.po_box && !payload.street) return ''
  return JSON.stringify(payload)
}

function normalizeMethodEntry(entry) {
  if (typeof entry === 'string') {
    const value = slugify(entry) || entry
    return {
      _id: uid('m'),
      enabled: true,
      value,
      label: entry.toUpperCase?.() || entry,
      description: '',
    }
  }
  if (entry && typeof entry === 'object') {
    const label = String(entry.label || entry.name || entry.value || entry.key || '').trim()
    const value = slugify(entry.value || entry.key || label)
    return {
      _id: uid('m'),
      enabled: entry.enabled !== false,
      value: value || label || uid('method'),
      label: label || value || 'METHOD',
      description: String(entry.description || '').trim(),
    }
  }
  return null
}

function normalizeMethods(methods) {
  const list = Array.isArray(methods) ? methods : []
  const out = []
  const seen = new Set()
  for (const item of list) {
    const m = normalizeMethodEntry(item)
    if (!m) continue
    const key = slugify(m.value || m.label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    m.value = key
    out.push(m)
  }
  if (!out.length) {
    return DEFAULT_METHODS.map((m) => ({ _id: uid('m'), enabled: true, ...m }))
  }
  return out
}

function normalizeAccountsList(accounts) {
  const list = []
  if (Array.isArray(accounts)) {
    for (const a of accounts) {
      if (!a || typeof a !== 'object') continue
      const key = String(a.key || a.provider || slugify(a.provider_name || a.name || '')).trim()
      list.push({
        _id: uid('a'),
        key: key || uid('provider'),
        provider_name: String(a.provider_name || a.name || a.provider || a.key || '').trim(),
        number: String(a.number || a.account_number || '').trim(),
        lipa_number: String(a.lipa_number || '').trim(),
        name: String(a.name || a.receiver_name || '').trim(),
        method: String(a.method || a.payment_method || '').trim(),
        description: String(a.description || '').trim(),
      })
    }
    return list
  }
  if (accounts && typeof accounts === 'object') {
    for (const [key, value] of Object.entries(accounts)) {
      if (!value) continue
      if (typeof value === 'string') {
        list.push({ _id: uid('a'), key, provider_name: key.replace(/_/g, ' ').toUpperCase(), number: value, lipa_number: '', name: '', method: '', description: '' })
        continue
      }
      if (typeof value === 'object') {
        list.push({
          _id: uid('a'),
          key: String(key),
          provider_name: String(value.provider_name || key.replace(/_/g, ' ').toUpperCase()).trim(),
          number: String(value.number || '').trim(),
          lipa_number: String(value.lipa_number || '').trim(),
          name: String(value.name || '').trim(),
          method: String(value.method || value.payment_method || '').trim(),
          description: String(value.description || '').trim(),
        })
      }
    }
  }
  return list
}

const blankForm = () => ({
  hotel_name: '',
  registration_code: '',
  contact_person: '',
  email: '',
  phone: '',
  address_coordinates: '',
  address_po_box: '',
  address_street: '',
  city: '',
  country: '',
  tin: '',
  vrn: '',
  timezone: 'Africa/Dar_es_Salaam',
  payment_methods: DEFAULT_METHODS.map((m) => ({ _id: uid('m'), enabled: true, ...m })),
  payment_accounts_list: [],
})

const form = reactive(blankForm())
const logoUrl = ref('')
const logoFile = ref(null)
const logoInput = ref(null)
const loading = ref(true)
const saving = ref(false)
const success = ref('')
const error = ref('')

const enabledMethodOptions = computed(() =>
  (form.payment_methods || [])
    .filter((m) => m.enabled && (m.label || m.value))
    .map((m) => ({ value: slugify(m.value || m.label), label: m.label || m.value })),
)

function flattenError(err) {
  const fields = err?.response?.data?.errors
  if (fields) return Object.values(fields).flat().join(' ')
  return err?.response?.data?.message || t('hotelSettings.loadError')
}

function hydrate(hotel) {
  const merged = { ...blankForm(), ...hotel }
  const addr = parseAddress(merged.address)
  form.hotel_name = merged.hotel_name || ''
  form.registration_code = merged.registration_code || ''
  form.contact_person = merged.contact_person || ''
  form.email = merged.email || ''
  form.phone = merged.phone || ''
  form.address_coordinates = addr.coordinates || ''
  form.address_po_box = addr.po_box || ''
  form.address_street = addr.street || ''
  form.city = merged.city || ''
  form.country = merged.country || ''
  form.tin = merged.tin || ''
  form.vrn = merged.vrn || ''
  form.timezone = merged.timezone || 'Africa/Dar_es_Salaam'
  form.payment_methods = normalizeMethods(merged.payment_method_definitions || merged.payment_methods)
  form.payment_accounts_list = normalizeAccountsList(merged.payment_accounts_list || merged.payment_accounts)
  logoUrl.value = merged.logo_url || ''
  logoFile.value = null
}

function addMethod() {
  form.payment_methods.push({ _id: uid('m'), enabled: true, value: '', label: '', description: '' })
}

function removeMethod(idx) {
  form.payment_methods.splice(idx, 1)
}

function syncMethodValue(method) {
  if (!method._touchedValue) {
    method.value = slugify(method.label)
  }
}

function addProviderAccount() {
  form.payment_accounts_list.push({
    _id: uid('a'),
    key: '',
    provider_name: '',
    number: '',
    lipa_number: '',
    name: '',
    method: enabledMethodOptions.value[0]?.value || '',
    description: '',
  })
}

function removeProviderAccount(idx) {
  form.payment_accounts_list.splice(idx, 1)
}

function syncAccountKey(acc) {
  if (!acc._touchedKey) {
    acc.key = slugify(acc.provider_name) || uid('provider')
  }
}

function serializeMethods() {
  const out = []
  const seen = new Set()
  for (const m of form.payment_methods) {
    const label = String(m.label || '').trim()
    const value = slugify(m.value || label)
    if (!label && !value) continue
    const key = value || slugify(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({
      value: key,
      label: label || key.toUpperCase(),
      description: String(m.description || '').trim(),
      enabled: !!m.enabled,
    })
  }
  // Only persist enabled methods for compatibility with consumers expecting active list.
  return out.filter((m) => m.enabled).map((m) => ({ value: m.value, label: m.label, description: m.description }))
}

function serializeAccounts() {
  const out = {}
  for (const acc of form.payment_accounts_list) {
    const providerName = String(acc.provider_name || '').trim()
    const key = slugify(acc.key || providerName)
    const number = String(acc.number || '').trim()
    const lipa = String(acc.lipa_number || '').trim()
    const receiver = String(acc.name || '').trim()
    const method = String(acc.method || '').trim()
    const description = String(acc.description || '').trim()
    if (!key && !providerName && !number && !lipa && !receiver && !method) continue
    const finalKey = key || uid('provider')
    const entry = {}
    if (number) entry.number = number
    if (lipa) entry.lipa_number = lipa
    if (receiver) entry.name = receiver
    if (providerName) entry.provider_name = providerName
    if (method) entry.method = method
    if (description) entry.description = description
    if (Object.keys(entry).length) out[finalKey] = entry
  }
  return out
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
    if (!props.paymentMethodsOnly) {
      payload.append('hotel_name', form.hotel_name)
      payload.append('registration_code', String(form.registration_code || '').replace(/\D/g, '').slice(0, 6))
      payload.append('contact_person', form.contact_person)
      payload.append('email', form.email)
      payload.append('phone', form.phone)
      payload.append('address', serializeAddress(form))
      payload.append('city', form.city)
      payload.append('country', form.country)
      payload.append('tin', form.tin)
      payload.append('vrn', form.vrn)
      payload.append('timezone', form.timezone)
    }
    if (paymentMethodsEnabled.value) {
      payload.append('payment_methods', JSON.stringify(serializeMethods()))
      payload.append('payment_accounts', JSON.stringify(serializeAccounts()))
    }
    if (!props.paymentMethodsOnly && logoFile.value) payload.append('logo', logoFile.value)

    const res = await hotelSettingsApi.update(payload)
    hydrate(res.data?.hotel || {})
    success.value = t('hotelSettings.saved')
    invalidateOfficialHeader()
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
.settings-form { display: flex; flex-direction: column; gap: 16px; }
.card h3 { margin: 0 0 12px 0; }
.subhead { margin: 0; font-size: 1rem; }
.small { font-size: 0.85rem; }
.narrow-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 320px)); gap: 12px; }
.form-group .input, .form-group select.input { max-width: 420px; width: 100%; }
.form-wide { grid-column: span 2; }
.address-block { margin-top: 8px; }
.subsection { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border, #e4e4e7); }
.subsection-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.custom-list { display: flex; flex-direction: column; gap: 12px; }
.custom-row { display: grid; gap: 10px; align-items: end; padding: 12px; border: 1px solid var(--border, #e4e4e7); border-radius: 8px; }
.method-row { grid-template-columns: auto minmax(180px, 280px) minmax(220px, 1fr) auto; }
.provider-custom-row { grid-template-columns: repeat(3, minmax(180px, 280px)) auto; }
.provider-custom-row .form-group:nth-child(4), .provider-custom-row .form-group:nth-child(5) { grid-column: span 1; }
.method-check { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.method-check.compact { padding-bottom: 8px; }
.account-number-input { max-width: 320px; }
.icon-btn { height: 38px; align-self: end; }
.logo-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.logo-preview { width: 96px; height: 96px; object-fit: contain; border: 1px solid var(--border, #d4d4d8); border-radius: 8px; background: #fff; padding: 6px; }
.logo-empty { display: flex; align-items: center; justify-content: center; font-size: 28px; color: var(--muted, #a1a1aa); }
.logo-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.visually-hidden-input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.form-actions { display: flex; gap: 10px; flex-wrap: wrap; }
@media (max-width: 900px) {
  .form-wide { grid-column: span 1; }
  .method-row, .provider-custom-row { grid-template-columns: 1fr; }
  .icon-btn { width: fit-content; }
}
</style>
