<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <span class="logo-icon"><i class="fas fa-hotel"></i></span>
        <h1>MRK Hotels</h1>
        <p>{{ $t('auth.signInSubtitle') }}</p>
      </div>

      <form @submit.prevent="handleLogin" novalidate>
        <div class="form-group" :class="{ 'has-error': errors.email }">
          <label>{{ $t('auth.email') }}</label>
          <input v-model="form.email" type="email" :placeholder="$t('auth.emailPlaceholder')" autocomplete="email"
            @blur="touch('email')" @input="validateField('email')" />
          <span class="field-error" v-if="errors.email"><i class="fas fa-exclamation-triangle"></i> {{
            errors.email }}</span>
        </div>

        <div class="form-group" :class="{ 'has-error': errors.password }">
          <label>{{ $t('common.password') }}</label>
          <div class="password-input-wrap">
            <input v-model="form.password" :type="showPw ? 'text' : 'password'"
              :placeholder="$t('auth.passwordPlaceholder')" autocomplete="current-password" @blur="touch('password')"
              @input="validateField('password')" />
            <button type="button" class="pw-toggle" @click="showPw = !showPw"><i
                :class="showPw ? 'fas fa-eye-slash' : 'fas fa-eye'"></i></button>
          </div>
          <span class="field-error" v-if="errors.password"><i class="fas fa-exclamation-triangle"></i> {{
            errors.password }}</span>
        </div>

        <div class="server-errors" v-if="serverErrors.length > 0">
          <div v-for="(msg, i) in serverErrors" :key="i" class="server-error"><i class="fas fa-exclamation-circle"></i>
            {{ msg }}</div>
        </div>

        <div v-if="toastMsg" class="password-toast"><i class="fas fa-key"></i> {{ toastMsg }}</div>

        <button type="submit" class="btn btn-primary full-width" :disabled="loading"><i
            class="fas fa-right-to-bracket"></i> {{ loading ? $t('auth.signInLoading') : $t('auth.signIn') }}</button>
      </form>

      <p class="auth-link home-link"><router-link to="/"><i class="fas fa-arrow-left"></i> {{ $t('common.backToHome')
      }}</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const sessionStore = useSessionStore()

// Login form model, per-field validation errors, server errors and UI flags.
const form = ref({ email: '', password: '' })
const errors = ref({})
const serverErrors = ref([])
const touched = ref({})
const loading = ref(false)
const showPw = ref(false)
const toastMsg = ref('')

// Timer handle for the temporary password-rotation toast.
let toastTimer = null

onMounted(() => {
  if (route.query.rotated) {
    showToast(`${t('auth.passwordRotated')} ${route.query.default_password || ''}`)
  }
})

/** Shows a transient toast message that clears itself after 6 seconds. */
function showToast(msg) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 6000)
}

/** Marks a form field as touched (so its errors show once blurred). */
function touch(field) {
  touched.value[field] = true
}

/** Validates a single field when it has been touched or already contains a value. */
function validateField(field) {
  if (!touched.value[field] && !form.value[field]) return

  switch (field) {
    case 'email':
      if (!form.value.email.trim()) errors.value.email = t('auth.validation.emailRequired')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) errors.value.email = t('auth.validation.emailInvalid')
      else delete errors.value.email
      break
    case 'password':
      if (!form.value.password) errors.value.password = t('auth.validation.passwordRequired')
      else delete errors.value.password
      break
  }
}

/** Validates every field and returns true only when the whole form is valid. */
function validateAll() {
  ;['email', 'password'].forEach((f) => {
    touched.value[f] = true
    validateField(f)
  })
  return !errors.value.email && !errors.value.password
}

/** Performs the login, redirecting by role and surfacing API/server errors. */
async function handleLogin() {
  serverErrors.value = []
  if (!validateAll()) return

  loading.value = true
  try {
    const data = await authStore.login(form.value)
    sessionStore.start()
    const redirect = route.query.redirect
    if (redirect) {
      router.push(redirect)
    } else if (authStore.isSuperadmin) {
      router.push('/superadmin')
    } else if (authStore.user?.user_role === 'owner') {
      router.push('/owner')
    } else {
      router.push('/app')
    }
    if (data?.password_rotated) {
      showToast(`${t('auth.passwordRotated')} ${data.default_password}`)
    }
  } catch (e) {
    if (e.response?.data?.message) {
      serverErrors.value = [e.response.data.message]
    } else {
      serverErrors.value = [t('auth.validation.connectionFailed')]
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: transparent;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
}

.auth-header {
  text-align: center;
  margin-bottom: 28px;
}

.auth-header .logo-icon {
  display: inline-flex;
  background: url('/MRK_logo_transparent.png') center/contain no-repeat;
  justify-content: center;
  align-items: center;
  width: 170px;
  height: 56px;
  font-size: 24px;
  margin-bottom: 16px;
}

.auth-header .logo-icon i {
  opacity: 0;
}

.auth-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.auth-header p {
  color: #6b7280;
  font-size: 14px;
}

.full-width {
  width: 100%;
  justify-content: center;
  padding: 14px;
  margin-top: 8px;
}

.auth-link {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #888;
}

.auth-link a {
  color: var(--brand);
  font-weight: 600;
}

.home-link {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--brand);
}

.form-group.has-error input {
  border-color: #e74c3c;
  background: #fef8f8;
}

.password-input-wrap {
  position: relative;
}

.password-input-wrap input {
  padding-right: 44px;
}

.pw-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
}

.pw-toggle:hover {
  color: #333;
}

.field-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: #e74c3c;
  font-weight: 500;
}

.field-error i {
  font-size: 11px;
}

.server-errors {
  margin-bottom: 12px;
}

.server-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fef5f5;
  border: 1px solid #fdd;
  border-radius: 6px;
  color: #c0392b;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
}

.server-error i {
  font-size: 12px;
  flex-shrink: 0;
}

.password-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fef9e7;
  border: 1px solid #f3e5ab;
  border-radius: 6px;
  color: #7d6608;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 12px;
}

.password-toast i {
  color: #005EB8;
}
</style>
