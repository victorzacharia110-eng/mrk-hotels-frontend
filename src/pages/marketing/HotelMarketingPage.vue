<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('hotelMarketing.title') }}</h1>
        <p class="muted">{{ $t('hotelMarketing.subtitle') }}</p>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="!canEdit" class="alert alert-warning">
      {{ $t('hotelMarketing.readOnlyHint') }}
    </div>

    <div v-if="loading" class="card"><p class="muted">{{ $t('common.loading') }}</p></div>

    <template v-else>
      <form v-if="canEdit" class="settings-form" @submit.prevent="submitProposal">
        <div class="card">
          <h3>{{ $t('hotelMarketing.sectionProfile') }}</h3>
          <p class="muted">{{ $t('hotelMarketing.tenantId') }}: {{ form.tenant_id || '—' }}</p>

          <div class="filter-grid">
            <div class="form-group">
              <label for="hm-tagline">{{ $t('hotelMarketing.tagline') }}</label>
              <input
                id="hm-tagline"
                v-model.trim="form.tagline"
                type="text"
                class="input"
                :disabled="saving"
              />
            </div>
            <div class="form-group">
              <label for="hm-website">{{ $t('hotelMarketing.websiteUrl') }}</label>
              <input
                id="hm-website"
                v-model.trim="form.website_url"
                type="url"
                class="input"
                :disabled="saving"
              />
            </div>
            <div class="form-group">
              <label for="hm-facebook">{{ $t('hotelMarketing.facebookUrl') }}</label>
              <input
                id="hm-facebook"
                v-model.trim="form.facebook_url"
                type="url"
                class="input"
                :disabled="saving"
              />
            </div>
            <div class="form-group">
              <label for="hm-instagram">{{ $t('hotelMarketing.instagramUrl') }}</label>
              <input
                id="hm-instagram"
                v-model.trim="form.instagram_url"
                type="url"
                class="input"
                :disabled="saving"
              />
            </div>
            <div class="form-group">
              <label for="hm-whatsapp">{{ $t('hotelMarketing.whatsappNumber') }}</label>
              <input
                id="hm-whatsapp"
                v-model.trim="form.whatsapp_number"
                type="tel"
                class="input"
                :disabled="saving"
              />
            </div>
            <div class="form-group">
              <label for="hm-email">{{ $t('hotelMarketing.contactEmail') }}</label>
              <input
                id="hm-email"
                v-model.trim="form.contact_email"
                type="email"
                class="input"
                :disabled="saving"
              />
            </div>
            <div class="form-group">
              <label for="hm-phone">{{ $t('hotelMarketing.contactPhone') }}</label>
              <input
                id="hm-phone"
                v-model.trim="form.contact_phone"
                type="tel"
                class="input"
                :disabled="saving"
              />
            </div>
            <div class="form-group">
              <label for="hm-hero">{{ $t('hotelMarketing.heroImageUrl') }}</label>
              <input
                id="hm-hero"
                v-model.trim="form.hero_image_url"
                type="url"
                class="input"
                :disabled="saving"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="hm-description">{{ $t('hotelMarketing.description') }}</label>
            <textarea
              id="hm-description"
              v-model.trim="form.description"
              class="input"
              rows="3"
              :disabled="saving"
            ></textarea>
          </div>

          <label class="checkbox-row">
            <input v-model="form.is_published" type="checkbox" :disabled="saving" />
            <span>{{ $t('hotelMarketing.isPublished') }}</span>
          </label>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="saving || !canEdit">
            <i class="fas fa-paper-plane"></i>
            {{ saving ? $t('hotelMarketing.submitting') : $t('hotelMarketing.submit') }}
          </button>
          <button type="button" class="btn btn-secondary" :disabled="saving" @click="load">
            <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
          </button>
        </div>
      </form>

      <div class="card requests-card">
        <h3>{{ $t('hotelMarketing.requestsTitle') }}</h3>
        <p v-if="!requests.length" class="muted">{{ $t('hotelMarketing.noRequests') }}</p>
        <div v-for="request in requests" :key="request.id" class="request-item">
          <div class="request-head">
            <strong>#{{ request.id }}</strong>
            <span class="status-badge" :class="`status-${request.status}`">{{ request.status }}</span>
            <span class="muted">{{ formatDate(request.created_at) }}</span>
          </div>
          <p v-if="request.requester_name" class="muted">
            {{ $t('hotelMarketing.requestedBy') }}: {{ request.requester_name }}
          </p>
          <div v-for="(change, index) in request.changes" :key="index" class="diff-row">
            <span class="diff-label">{{ change.label || change.field }}</span>
            <span class="diff-from">{{ display(change.from) }}</span>
            <i class="fas fa-arrow-right" aria-hidden="true"></i>
            <span class="diff-to">{{ display(change.to) }}</span>
          </div>
          <p v-if="request.decision_note" class="decision-note">
            {{ $t('hotelMarketing.decisionNote') }}: {{ request.decision_note }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { hotelMarketingApi } from '@/api'

const { t } = useI18n()
const authStore = useAuthStore()
const canEdit = computed(() => authStore.can(80))

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

const blankForm = () => ({
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

const form = reactive(blankForm())
const requests = ref([])
const loading = ref(true)
const saving = ref(false)
const success = ref('')
const error = ref('')

function hydrate(profile) {
  const merged = { ...blankForm(), ...profile }
  form.tenant_id = merged.tenant_id || ''
  for (const field of FIELDS) {
    form[field] = merged[field] ?? ''
  }
  form.is_published = Boolean(merged.is_published)
}

function flattenError(err) {
  const fields = err?.response?.data?.errors
  if (fields) {
    return Object.values(fields).flat().join(' ')
  }
  return err?.response?.data?.message || t('hotelMarketing.loadError')
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
    const [profileRes, requestsRes] = await Promise.all([
      hotelMarketingApi.profile(),
      hotelMarketingApi.requests(),
    ])
    hydrate(profileRes.data?.profile || profileRes.data?.data || {})
    const rows = requestsRes.data?.requests
    requests.value = Array.isArray(rows) ? rows : []
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    loading.value = false
  }
}

async function submitProposal() {
  if (!canEdit.value) return
  saving.value = true
  success.value = ''
  error.value = ''
  try {
    const payload = { tenant_id: form.tenant_id }
    for (const field of FIELDS) {
      payload[field] = form[field]
    }
    payload.is_published = form.is_published

    const res = await hotelMarketingApi.propose(payload)
    const channels = res.data?.notification?.channels
    success.value = channels?.length
      ? t('hotelMarketing.notifiedVia', { channels: channels.join(', ') })
      : t('hotelMarketing.submitted')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    saving.value = false
  }
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

.checkbox-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  cursor: pointer;
}

.checkbox-row input {
  width: 16px;
  height: 16px;
}

.requests-card {
  margin-top: 16px;
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
  gap: 12px;
  flex-wrap: wrap;
  font-size: 14px;
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

.diff-row {
  display: grid;
  grid-template-columns: 180px 1fr 24px 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-top: 1px solid #f2f2f2;
  font-size: 13px;
}

.diff-row:first-of-type {
  margin-top: 10px;
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

@media (max-width: 767px) {
  .diff-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .diff-row i {
    display: none;
  }
}
</style>
