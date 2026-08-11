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

      <p v-if="message" class="alert" :class="error ? 'alert-error' : 'alert-success'">{{ message }}</p>

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
            <PhoneInput v-model="form.phone" v-model:countryCode="form.country_code" />
          </div>
          <div class="form-group">
            <label>{{ $t('profile.idType') }}</label>
            <select v-model="form.id_type" class="input">
              <option value="">{{ $t('common.none') }}</option>
              <option v-for="t in idTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('profile.idNumber') }}</label>
            <input v-model="form.id_number" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('profile.position') }}</label>
            <input v-model="form.position" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('profile.profilePhoto') }}</label>
            <input type="file" accept="image/*" class="input" @change="onPhoto" />
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
          <input :value="$t('superadmin.title')" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.roleLevel') }}</label>
          <input :value="authStore.user?.role_level ?? '-'" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('common.department') }}</label>
          <input :value="authStore.user?.department || '-'" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.hotel') }}</label>
          <input :value="authStore.user?.tenant?.hotel_name || '-'" class="input" disabled />
        </div>
        <div class="form-group">
          <label>{{ $t('profile.subManager') }}</label>
          <input
            :value="authStore.user?.is_sub_manager ? $t('profile.yes') : $t('profile.no')"
            class="input"
            disabled
          />
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
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api'
import ChangePasswordForm from '@/components/ChangePasswordForm.vue'
import PhoneInput from '@/components/PhoneInput.vue'

const { t } = useI18n()
const authStore = useAuthStore()

// Allowed identification document types and the editable profile fields
const idTypes = ['national_id', 'passport']
const form = reactive({
  first_name: '',
  last_name: '',
  full_name: '',
  email: '',
  phone: '',
  country_code: '',
  id_type: '',
  id_number: '',
  position: '',
})
const photo = ref(null)
const saving = ref(false)
const message = ref('')
const error = ref(false)

// Copies the current user from the auth store into the editable form fields.
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
  form.position = u.position || ''
}

// Stores the selected profile picture file, if any, from the file input.
function onPhoto(e) {
  photo.value = e.target.files?.[0] || null
}

// Submits the profile as multipart form data, then refreshes the store and form.
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
    fd.append('position', form.position || '')
    if (photo.value) fd.append('profile_picture', photo.value)

    const { data } = await authApi.updateProfile(fd)
    authStore.user = data.user
    fillForm()
    photo.value = null
    message.value = data.message || t('profile.saved')
  } catch (err) {
    error.value = true
    message.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

// Formats an ISO date-time string for display, truncating to minutes.
function formatDateTime(d) {
  return d ? String(d).slice(0, 16).replace('T', ' ') : '-'
}

// Formats an ISO date string for display, keeping only the date part.
function formatDate(d) {
  return d ? String(d).slice(0, 10) : '-'
}

// Flattens a validation-error object (or fallback message) into a single readable string.
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
