<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('owner.marketingTitle') }}</h1>
        <p class="muted">{{ $t('owner.marketingSubtitle') }}</p>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card content-card">
      <h3>{{ $t('owner.marketingContent') }}</h3>
      <p class="muted">{{ $t('owner.marketingContentHint') }}</p>

      <p v-if="!hotels.length" class="muted">{{ $t('owner.marketingNoHotels') }}</p>

      <form v-else class="settings-form" @submit.prevent="saveContent">
        <div class="form-group">
          <label for="om-hotel">{{ $t('owner.marketingSelectHotel') }}</label>
          <select
            id="om-hotel"
            v-model="selectedHotel"
            class="input"
            :disabled="savingProfile"
            @change="loadProfile"
          >
            <option v-for="hotel in hotels" :key="hotel.tenant_id" :value="hotel.tenant_id">
              {{ hotel.hotel_name }}
            </option>
          </select>
        </div>

        <div class="editor-grid">
          <div class="form-group">
            <label for="om-tagline">{{ $t('hotelMarketing.tagline') }}</label>
            <input id="om-tagline" v-model.trim="profileForm.tagline" type="text" class="input" :disabled="savingProfile" />
          </div>
          <div class="form-group">
            <label for="om-website">{{ $t('hotelMarketing.websiteUrl') }}</label>
            <input id="om-website" v-model.trim="profileForm.website_url" type="url" class="input" :disabled="savingProfile" />
          </div>
          <div class="form-group">
            <label for="om-facebook">{{ $t('hotelMarketing.facebookUrl') }}</label>
            <input id="om-facebook" v-model.trim="profileForm.facebook_url" type="url" class="input" :disabled="savingProfile" />
          </div>
          <div class="form-group">
            <label for="om-instagram">{{ $t('hotelMarketing.instagramUrl') }}</label>
            <input id="om-instagram" v-model.trim="profileForm.instagram_url" type="url" class="input" :disabled="savingProfile" />
          </div>
          <div class="form-group">
            <label for="om-whatsapp">{{ $t('hotelMarketing.whatsappNumber') }}</label>
            <input id="om-whatsapp" v-model.trim="profileForm.whatsapp_number" type="tel" class="input" :disabled="savingProfile" />
          </div>
          <div class="form-group">
            <label for="om-email">{{ $t('hotelMarketing.contactEmail') }}</label>
            <input id="om-email" v-model.trim="profileForm.contact_email" type="email" class="input" :disabled="savingProfile" />
          </div>
          <div class="form-group">
            <label for="om-phone">{{ $t('hotelMarketing.contactPhone') }}</label>
            <input id="om-phone" v-model.trim="profileForm.contact_phone" type="tel" class="input" :disabled="savingProfile" />
          </div>
          <div class="form-group">
            <label for="om-hero">{{ $t('hotelMarketing.heroImageUrl') }}</label>
            <input id="om-hero" v-model.trim="profileForm.hero_image_url" type="url" class="input" :disabled="savingProfile" />
          </div>
        </div>

        <div class="form-group">
          <label for="om-description">{{ $t('hotelMarketing.description') }}</label>
          <textarea
            id="om-description"
            v-model.trim="profileForm.description"
            class="input"
            rows="3"
            :disabled="savingProfile"
          ></textarea>
        </div>

        <label class="checkbox-row">
          <input v-model="profileForm.is_published" type="checkbox" :disabled="savingProfile" />
          <span>{{ $t('hotelMarketing.isPublished') }}</span>
        </label>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="savingProfile || !selectedHotel">
            <i class="fas fa-floppy-disk"></i>
            {{ savingProfile ? $t('common.saving') : $t('common.save') }}
          </button>
          <button type="button" class="btn btn-secondary" :disabled="savingProfile" @click="loadProfile">
            <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
          </button>
        </div>
      </form>
    </div>

    <div class="card preferences-card">
      <h3>{{ $t('owner.marketingPreferences') }}</h3>
      <p class="muted">{{ $t('owner.marketingPreferencesHint') }}</p>
      <div class="preference-options">
        <button
          v-for="option in preferenceOptions"
          :key="option.value"
          type="button"
          class="btn btn-sm pref-btn"
          :class="{ active: preference === option.value }"
          :disabled="savingPreference"
          @click="setPreference(option.value)"
        >
          {{ $t(option.labelKey) }}
        </button>
      </div>
    </div>

    <div class="card requests-card">
      <div class="list-head">
        <h3>{{ $t('owner.marketingTitle') }}</h3>
        <div class="filter-buttons">
          <button
            type="button"
            class="btn btn-sm"
            :class="filter === 'pending' ? 'btn-primary' : 'btn-secondary'"
            @click="setFilter('pending')"
          >
            {{ $t('owner.marketingPendingFilter') }}
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="filter === 'all' ? 'btn-primary' : 'btn-secondary'"
            @click="setFilter('all')"
          >
            {{ $t('owner.marketingAllFilter') }}
          </button>
        </div>
      </div>

      <p v-if="loading" class="muted">{{ $t('common.loading') }}</p>
      <p v-else-if="!requests.length" class="muted">{{ $t('owner.marketingNoRequests') }}</p>

      <div v-for="request in requests" :key="request.id" class="request-item">
        <div class="request-head">
          <strong>#{{ request.id }}</strong>
          <span class="status-badge" :class="`status-${request.status}`">{{ request.status }}</span>
          <span><i class="fas fa-hotel"></i> {{ request.hotel_name || '—' }}</span>
          <span><i class="fas fa-user"></i> {{ request.requester_name || request.requested_by || '—' }}</span>
          <span><i class="fas fa-clock"></i> {{ formatDate(request.created_at) }}</span>
        </div>

        <div class="changes">
          <div v-for="(change, index) in request.changes || []" :key="index" class="diff-row">
            <span class="diff-label">{{ change.label || change.field }}</span>
            <span class="diff-from">{{ display(change.from) }}</span>
            <i class="fas fa-arrow-right" aria-hidden="true"></i>
            <span class="diff-to">{{ display(change.to) }}</span>
          </div>
        </div>

        <p v-if="request.decision_note" class="decision-note">
          {{ $t('owner.marketingDecisionNote') }}: {{ request.decision_note }}
        </p>

        <div v-if="request.status === 'pending'" class="request-actions">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="busyId === request.id"
            @click="approveRequest(request)"
          >
            <i class="fas fa-check"></i> {{ $t('owner.marketingApprove') }}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-secondary"
            :disabled="busyId === request.id"
            @click="rejectRequest(request)"
          >
            <i class="fas fa-xmark"></i> {{ $t('owner.marketingReject') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ownerApi, ownerMarketingApi } from '@/api'

const { t } = useI18n()

const preferenceOptions = [
  { value: 'email', labelKey: 'owner.marketingPreferenceEmail' },
  { value: 'sms', labelKey: 'owner.marketingPreferenceText' },
  { value: 'both', labelKey: 'owner.marketingPreferenceBoth' },
]

const FIELDS = [
  'tagline',
  'description',
  'website_url',
  'facebook_url',
  'instagram_url',
  'whatsapp_number',
  'contact_email',
  'contact_phone',
  'hero_image_url',
]

const blankProfile = () => ({
  tenant_id: '',
  tagline: '',
  description: '',
  website_url: '',
  facebook_url: '',
  instagram_url: '',
  whatsapp_number: '',
  contact_email: '',
  contact_phone: '',
  hero_image_url: '',
  is_published: false,
})

const hotels = ref([])
const selectedHotel = ref('')
const profileForm = reactive(blankProfile())
const savingProfile = ref(false)
const requests = ref([])
const filter = ref('pending')
const preference = ref('email')
const loading = ref(true)
const busyId = ref(null)
const savingPreference = ref(false)
const success = ref('')
const error = ref('')

function flattenError(err) {
  const fields = err?.response?.data?.errors
  if (fields) {
    return Object.values(fields).flat().join(' ')
  }
  return err?.response?.data?.message || t('owner.marketingLoadError')
}

function hydrateProfile(profile) {
  const merged = { ...blankProfile(), ...profile }
  for (const field of FIELDS) {
    profileForm[field] = merged[field] ?? ''
  }
  profileForm.tenant_id = merged.tenant_id || selectedHotel.value
  profileForm.is_published = Boolean(merged.is_published)
}

async function loadProfile() {
  if (!selectedHotel.value) return
  try {
    const res = await ownerMarketingApi.profile(selectedHotel.value)
    hydrateProfile(res.data?.profile || {})
  } catch (err) {
    error.value = err?.response?.data?.message || t('owner.marketingProfileLoadError')
  }
}

async function loadHotels() {
  try {
    const res = await ownerApi.hotels()
    const rows = res.data?.hotels
    hotels.value = Array.isArray(rows) ? rows : []
    if (hotels.value.length) {
      selectedHotel.value = String(hotels.value[0].tenant_id)
      await loadProfile()
    }
  } catch (err) {
    error.value = flattenError(err)
  }
}

async function saveContent() {
  if (!selectedHotel.value) return
  savingProfile.value = true
  success.value = ''
  error.value = ''
  try {
    const payload = { tenant_id: selectedHotel.value }
    for (const field of FIELDS) {
      payload[field] = profileForm[field]
    }
    payload.is_published = profileForm.is_published

    const res = await ownerMarketingApi.saveProfile(payload)
    hydrateProfile(res.data?.profile || payload)
    success.value = t('owner.marketingSaved')
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    savingProfile.value = false
  }
}

function display(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no')
  return String(value)
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = filter.value === 'pending' ? { status: 'pending' } : {}
    const res = await ownerMarketingApi.requests(params)
    const rows = res.data?.requests
    requests.value = Array.isArray(rows) ? rows : []
  } catch (err) {
    requests.value = []
    error.value = flattenError(err)
  } finally {
    loading.value = false
  }
}

async function loadPreferences() {
  try {
    const res = await ownerMarketingApi.preferences()
    const channels = Array.isArray(res.data?.channels) ? res.data.channels : []
    preference.value = channels.includes('email') && channels.includes('sms')
      ? 'both'
      : channels.includes('sms') ? 'sms' : 'email'
  } catch {
    preference.value = 'email'
  }
}

function setFilter(value) {
  filter.value = value
  load()
}

async function setPreference(value) {
  savingPreference.value = true
  success.value = ''
  error.value = ''
  try {
    const channels = value === 'both' ? ['email', 'sms'] : [value]
    await ownerMarketingApi.updatePreferences({ channels })
    preference.value = value
    success.value = t('owner.marketingPreferencesSaved')
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    savingPreference.value = false
  }
}

async function decide(request, action, note = '') {
  busyId.value = request.id
  success.value = ''
  error.value = ''
  try {
    const res = action === 'approve'
      ? await ownerMarketingApi.approve(request.id)
        : await ownerMarketingApi.reject(request.id, { note })

    const updated = res.data?.request
    if (updated) {
      const index = requests.value.findIndex((row) => row.id === request.id)
      if (index !== -1) requests.value.splice(index, 1, updated)
    } else {
      request.status = action === 'approve' ? 'approved' : 'rejected'
      request.decision_note = note
    }
    success.value = action === 'approve'
      ? t('owner.marketingApproved')
      : t('owner.marketingRejected')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    busyId.value = null
  }
}

function approveRequest(request) {
  return decide(request, 'approve')
}

function rejectRequest(request) {
  const note = window.prompt(t('owner.marketingRejectNotePrompt'), '')
  if (note === null) return undefined
  return decide(request, 'reject', note)
}

onMounted(() => {
  load()
  loadPreferences()
  loadHotels()
})
</script>

<style scoped>
.content-card,
.preferences-card {
  margin-bottom: 16px;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.checkbox-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preferences-card h3 {
  margin: 0 0 6px 0;
}

.preference-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.pref-btn.active {
  background: #005eb8;
  color: #fff;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.list-head h3 {
  margin: 0;
}

.filter-buttons {
  display: flex;
  gap: 8px;
}

.request-item {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 14px;
  margin-top: 12px;
}

.request-head {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #555;
}

.request-head i {
  color: #005eb8;
  margin-right: 4px;
}

.status-badge {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: capitalize;
  background: #f0f2f5;
  color: #555;
}

.status-badge.status-pending {
  background: #fff4e5;
  color: #a85d00;
}

.status-badge.status-approved {
  background: #eafaf1;
  color: #1e8449;
}

.status-badge.status-rejected {
  background: #fdecea;
  color: #c0392b;
}

.changes {
  margin-top: 10px;
}

.diff-row {
  display: grid;
  grid-template-columns: 180px 1fr 24px 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-top: 1px solid #f2f2f2;
  font-size: 13px;
}

.diff-label {
  font-weight: 600;
}

.diff-from {
  color: #888;
  text-decoration: line-through;
  overflow-wrap: anywhere;
}

.diff-to {
  color: #1e8449;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.decision-note {
  margin-top: 8px;
  font-size: 13px;
  color: #666;
}

.request-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

@media (max-width: 767px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }

  .diff-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .diff-row i {
    display: none;
  }
}
</style>
