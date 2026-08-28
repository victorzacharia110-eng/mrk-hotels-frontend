<!--
  PortalProfilePage — customer's account profile (route: /portal/profile).
  Editable personal info, read-only hotel/account details, superadmin contact,
  and a password change form.
-->
<template>
  <div class="portal-profile">
    <div v-if="loading" class="loading-spinner"><div class="spinner"></div></div>
    <template v-else>
      <!-- Account card -->
      <div class="card">
        <h2 class="card-title"><i class="fas fa-id-card"></i> {{ $t('profile.account') }}</h2>
        <div class="profile-header">
          <div class="avatar">
            <img
              v-if="authStore.user?.profile_picture"
              :src="authStore.user.profile_picture"
              :alt="authStore.user?.full_name"
            />
            <i v-else class="fas fa-user"></i>
          </div>
          <div class="profile-header-info">
            <span class="profile-name">{{ form.full_name }}</span>
            <span class="profile-sub">{{ authStore.user?.user_role }}</span>
            <span class="badge" :class="authStore.user?.is_active ? 'badge-green' : 'badge-red'">
              {{ authStore.user?.is_active ? $t('profile.active') : $t('profile.inactive') }}
            </span>
          </div>
        </div>

        <p v-if="message" class="alert" :class="error ? 'alert-error' : 'alert-success'">
          {{ message }}
        </p>

        <form @submit.prevent="save">
          <h3 class="form-section-title"><i class="fas fa-pen"></i> {{ $t('profile.personalInfo') }}</h3>
          <div class="profile-grid">
            <div class="form-group">
              <label>{{ $t('profile.firstName') }}</label>
              <input v-model="form.first_name" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('profile.lastName') }}</label>
              <input v-model="form.last_name" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('profile.email') }}</label>
              <input v-model="form.email" type="email" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('profile.phone') }}</label>
              <input v-model="form.phone" type="tel" class="input" />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-save"></i> {{ saving ? $t('common.saving') : $t('common.save') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Hotel account details (read-only) -->
      <div class="card">
        <h2 class="card-title"><i class="fas fa-building"></i> {{ $t('portalProfile.hotelAccount') }}</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">{{ $t('portalProfile.hotelName') }}</span>
            <span class="info-value">{{ tenant?.hotel_name || '—' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('portalProfile.plan') }}</span>
            <span class="info-value plan-badge" :class="`plan-badge--${tenant?.subscription_plan}`">
              {{ tenant?.subscription_plan }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('portalProfile.status') }}</span>
            <span class="info-value">
              <span class="status-dot" :class="`status-dot--${tenant?.subscription_status}`"></span>
              {{ tenant?.subscription_status }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('portalProfile.subdomain') }}</span>
            <span class="info-value">{{ tenant?.subdomain }}.tscl.app</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('portalProfile.email') }}</span>
            <span class="info-value">{{ authStore.user?.email }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ $t('portalProfile.memberSince') }}</span>
            <span class="info-value">{{ formatDate(authStore.user?.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- Superadmin contact card -->
      <div class="card contact-card">
        <h2 class="card-title"><i class="fas fa-headset"></i> {{ $t('portalProfile.supportContact') }}</h2>
        <p class="contact-desc">{{ $t('portalProfile.supportDesc') }}</p>
        <div class="contact-grid">
          <div class="contact-item">
            <i class="fas fa-envelope"></i>
            <div>
              <span class="contact-label">{{ $t('portalProfile.email') }}</span>
              <a href="mailto:support@tscl.app" class="contact-value">support@tscl.app</a>
            </div>
          </div>
          <div class="contact-item">
            <i class="fas fa-phone"></i>
            <div>
              <span class="contact-label">{{ $t('portalProfile.phone') }}</span>
              <a href="tel:+255742606001" class="contact-value">+255 742 606 001</a>
            </div>
          </div>
          <div class="contact-item">
            <i class="fas fa-clock"></i>
            <div>
              <span class="contact-label">{{ $t('portalProfile.supportHours') }}</span>
              <span class="contact-value">{{ $t('portalProfile.supportHoursValue') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Password change -->
      <div class="card">
        <h2 class="card-title"><i class="fas fa-lock"></i> {{ $t('profile.changePassword') }}</h2>
        <ChangePasswordForm />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { authApi, hotelSettingsApi } from '@/api'
import ChangePasswordForm from '@/components/ChangePasswordForm.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const error = ref(false)
const tenant = ref(null)

const form = reactive({
  first_name: '',
  last_name: '',
  full_name: '',
  email: '',
  phone: '',
})

function fillForm() {
  const u = authStore.user || {}
  form.first_name = u.first_name || ''
  form.last_name = u.last_name || ''
  form.full_name = u.full_name || ''
  form.email = u.email || ''
  form.phone = u.phone || ''
}

async function save() {
  saving.value = true
  message.value = ''
  error.value = false
  try {
    const fd = new FormData()
    fd.append('first_name', form.first_name || '')
    fd.append('last_name', form.last_name || '')
    fd.append('email', form.email || '')
    fd.append('phone', form.phone || '')
    const { data } = await authApi.updateProfile(fd)
    authStore.user = data.user
    fillForm()
    message.value = data.message || t('profile.saved')
  } catch (err) {
    error.value = true
    message.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

function formatDate(d) {
  return d ? String(d).slice(0, 10) : '-'
}

function flattenError(err) {
  const msgs = err.response?.data?.errors
  return msgs ? Object.values(msgs).flat().join(' ') : err.response?.data?.message || t('common.actionFailed')
}

onMounted(async () => {
  try {
    tenant.value = authStore.user?.tenant
    try {
      const { data } = await hotelSettingsApi.show()
      tenant.value = { ...tenant.value, ...data.hotel }
    } catch { /* optional */ }
  } finally {
    fillForm()
    loading.value = false
  }
})
</script>

<style scoped>
.portal-profile { max-width: 900px; }

.profile-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.avatar { width: 64px; height: 64px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; overflow: hidden; flex-shrink: 0; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.profile-header-info { display: flex; flex-direction: column; gap: 4px; }
.profile-name { font-size: 17px; font-weight: 600; color: #0f172a; }
.profile-sub { font-size: 13px; color: #64748b; text-transform: capitalize; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.badge-green { background: #d1fae5; color: #059669; }
.badge-red { background: #fee2e2; color: #b91c1c; }

.profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.form-section-title { margin: 20px 0 10px; font-size: 15px; color: #334155; }
.form-actions { margin-top: 14px; display: flex; gap: 10px; }

.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.info-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; margin-bottom: 4px; }
.info-value { font-size: 14px; color: #1e293b; font-weight: 500; display: flex; align-items: center; gap: 6px; }

.plan-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: capitalize; }
.plan-badge--starter { background: #dbeafe; color: #2563eb; }
.plan-badge--growth { background: #d1fae5; color: #059669; }
.plan-badge--enterprise { background: #ede9fe; color: #7c3aed; }
.plan-badge--trial { background: #fef3c7; color: #d97706; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.status-dot--active { background: #10b981; }
.status-dot--trial { background: #f59e0b; }
.status-dot--pending { background: #f59e0b; }
.status-dot--suspended { background: #ef4444; }

.contact-card { background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%); border-color: #bfdbfe; }
.contact-desc { font-size: 13px; color: #64748b; margin: 0 0 16px; }
.contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.contact-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border-radius: 10px; border: 1px solid #e2e8f0; }
.contact-item > i { font-size: 18px; color: #3b82f6; width: 24px; text-align: center; flex-shrink: 0; }
.contact-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8; margin-bottom: 2px; }
.contact-value { font-size: 14px; font-weight: 600; color: #1e293b; text-decoration: none; }
a.contact-value:hover { color: #3b82f6; }

.loading-spinner { display: flex; justify-content: center; padding: 80px 20px; }
.spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
