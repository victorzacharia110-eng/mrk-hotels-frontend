<!--
  Owner profile page (route: /owner/profile, name: owner-profile).
  The owner's own account: editable personal info with photo upload,
  read-only system attributes and a password change form.
-->
<template>
  <div>
    <div class="page-head">
      <h1>{{ $t('profile.title') }}</h1>
    </div>

    <div class="card">
      <h2 class="card-title"><i class="fas fa-id-card"></i> {{ $t('profile.account') }}</h2>
      <!-- Avatar and summary of the logged-in user pulled from the auth store -->
      <div class="profile-header">
        <div class="avatar">
          <img
            v-if="avatarSrc"
            :src="avatarSrc"
            :alt="form.full_name || authStore.user?.full_name || 'Profile'"
          />
          <span v-else class="avatar-initials">{{ avatarInitials }}</span>
        </div>
        <div class="profile-header-info">
          <span class="profile-name">{{ form.full_name || [form.first_name, form.last_name].filter(Boolean).join(' ') }}</span>
          <span class="profile-sub">{{ authStore.user?.user_role }}</span>
          <span class="badge" :class="authStore.user?.is_active ? 'badge-green' : 'badge-red'">
            {{ authStore.user?.is_active ? $t('profile.active') : $t('profile.inactive') }}
          </span>
        </div>
      </div>

      <p v-if="message" class="alert" :class="error ? 'alert-error' : 'alert-success'">{{ message }}</p>

      <!-- Editable personal information form -->
      <form @submit.prevent="save">
        <h3 class="form-section-title"><i class="fas fa-pen"></i> {{ $t('profile.personalInfo') }}</h3>
        <div class="profile-grid profile-form-grid">
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
            <PhoneInput v-model="form.phone" v-model:countryCode="form.country_code" />
          </div>
          <div class="form-group">
            <label>{{ $t('profile.idType') }}</label>
            <select v-model="form.id_type" class="input">
              <option value="">{{ $t('common.none') }}</option>
              <option v-for="opt in idTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('profile.idNumber') }}</label>
            <input v-model="form.id_number" class="input" />
          </div>
          <div class="form-group form-full">
            <label>{{ $t('profile.profilePhoto') }}</label>
            <input ref="photoInput" type="file" accept="image/*" class="input" @change="onPhoto" />
            <small v-if="photo" class="muted">{{ photo.name }}</small>
            <button v-if="avatarSrc" type="button" class="btn btn-danger btn-sm" :disabled="saving" @click="removePhoto">
              <i class="fas fa-trash"></i> {{ $t('profile.removePhoto') }}
            </button>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <i class="fas fa-save"></i> {{ saving ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </form>

      <!-- Read-only system attributes supplied by the backend, shown for reference -->
      <h3 class="form-section-title"><i class="fas fa-lock"></i> {{ $t('profile.systemInfo') }}</h3>
      <p class="muted">{{ $t('profile.systemInfoHint') }}</p>
      <div class="profile-grid">
        <div class="form-group">
          <label>{{ $t('profile.registrationNumber') }}</label>
          <input :value="authStore.user?.registration_number || '-'" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.role') }}</label>
          <input :value="$t('owner.title')" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.lastLogin') }}</label>
          <input :value="formatDateTime(authStore.user?.last_login)" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.memberSince') }}</label>
          <input :value="formatDate(authStore.user?.created_at)" class="input" disabled />
        </div>
      </div>
    </div>

    <!-- Password change section delegated to a shared form component -->
    <div class="card">
      <h2 class="card-title">{{ $t('profile.changePassword') }}</h2>
      <ChangePasswordForm />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { avatarUrl } from '@/utils/format'
import { authApi } from '@/api'
import ChangePasswordForm from '@/components/ChangePasswordForm.vue'
import PhoneInput from '@/components/PhoneInput.vue'

const { t } = useI18n()
const authStore = useAuthStore()

// Allowed identification document types and the editable profile fields
const idTypeOptions = computed(() => [
  { value: 'national_id', label: t('profile.idTypes.national_id') },
  { value: 'passport', label: t('profile.idTypes.passport') },
  { value: 'drivers_license', label: t('profile.idTypes.drivers_license') },
])
const form = reactive({
  first_name: '',
  last_name: '',
  full_name: '',
  email: '',
  phone: '',
  country_code: '',
  id_type: '',
  id_number: '',
})
const photo = ref(null)
const photoInput = ref(null)
const photoPreview = ref('')
const saving = ref(false)
const message = ref('')
const error = ref(false)

const avatarSrc = computed(() => photoPreview.value || avatarUrl(authStore.user?.profile_picture))
const avatarInitials = computed(() => {
  const parts = [form.first_name || authStore.user?.first_name, form.last_name || authStore.user?.last_name].filter(Boolean)
  const initials = parts.map((p) => String(p)[0]?.toUpperCase() || '').join('').slice(0, 2)
  return initials || 'U'
})

/** Copies the current user from the auth store into the editable form fields. */
function fillForm() {
  const u = authStore.user || {}
  form.first_name = u.first_name || ''
  form.last_name = u.last_name || ''
  form.full_name = u.full_name || ''
  form.email = u.email || ''
  form.phone = u.phone || ''
  form.country_code = u.country_code || ''
  form.id_type = u.id_type || ''
  form.id_number = u.id_number || ''
}

/**
 * Stores the selected profile picture file, if any, from the file input.
 * @param {Event} e - The file input change event.
 */
function onPhoto(e) {
  photo.value = e.target.files?.[0] || null
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photoPreview.value = photo.value ? URL.createObjectURL(photo.value) : ''
}

async function removePhoto() {
  saving.value = true
  message.value = ''
  error.value = false
  try {
    const fd = new FormData()
    fd.append('remove_profile_picture', '1')

    const { data } = await authApi.updateProfile(fd)
    authStore.user = data.user
    await authStore.fetchProfile().catch(() => {})
    photo.value = null
    if (photoInput.value) photoInput.value.value = ''
    if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
    photoPreview.value = ''
    message.value = t('profile.photoRemoved')
  } catch (err) {
    error.value = true
    message.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Submits the profile as multipart form data, then refreshes the store and form. */
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
    fd.append('country_code', form.country_code || '')
    fd.append('id_type', form.id_type || '')
    fd.append('id_number', form.id_number || '')
    if (photo.value) fd.append('profile_picture', photo.value)

    const { data } = await authApi.updateProfile(fd)
    authStore.user = data.user
    await authStore.fetchProfile().catch(() => {})
    fillForm()
    photo.value = null
    if (photoInput.value) photoInput.value.value = ''
    if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
    photoPreview.value = ''
    message.value = data.message || t('profile.saved')
  } catch (err) {
    error.value = true
    message.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/**
 * Formats an ISO date-time string for display, truncating to minutes.
 * @param {string} d - The ISO date-time string.
 * @returns {string} The formatted value, or '-' when absent.
 */
function formatDateTime(d) {
  return d ? String(d).slice(0, 16).replace('T', ' ') : '-'
}

/**
 * Formats an ISO date string for display, keeping only the date part.
 * @param {string} d - The ISO date string.
 * @returns {string} The formatted value, or '-' when absent.
 */
function formatDate(d) {
  return d ? String(d).slice(0, 10) : '-'
}

/**
 * Flattens a validation-error object (or fallback message) into a single readable string.
 * @param {Error} err - The thrown request error.
 * @returns {string} A space-joined error message or the generic failure text.
 */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages ? Object.values(messages).flat().join(' ') : err.response?.data?.message || t('common.actionFailed')
}

onMounted(fillForm)
</script>

<style scoped>
.profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.form-section-title {
  margin: 20px 0 10px;
  font-size: 15px;
  color: #334155;
}

.form-actions {
  margin-top: 14px;
  display: flex;
  gap: 10px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #005eb8;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-initials { font-size: 22px; font-weight: 700; letter-spacing: .5px; }
.profile-form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

.profile-header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-name {
  font-size: 17px;
  font-weight: 600;
  color: #0f172a;
}

.profile-sub {
  font-size: 13px;
  color: #64748b;
  text-transform: capitalize;
}
</style>
