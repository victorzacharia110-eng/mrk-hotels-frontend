<!--
  LoginPage.vue
  Staff sign-in page for the MRK Hotels back-office (public route).
  Features: two switchable sign-in modes — the classic email + password form
  and an iPOS-style 4-digit PIN mode with an on-screen keypad that
  auto-submits once the PIN is complete — plus localized per-field
  validation, password visibility toggle, server-error surfacing, one-time
  password-rotation toast, and role-based redirects (superadmin / owner /
  staff) after a successful login.
-->

<template>
  <div class="auth-page">
    <div class="auth-card">
      <!-- Brand header: hotel logo and localized subtitle -->
      <div class="auth-header">
        <span class="logo-icon"><i class="fas fa-hotel"></i></span>
        <h1>MRK Hotels</h1>
        <p>{{ $t('auth.signInSubtitle') }}</p>
      </div>

      <!-- Sign-in mode switcher: classic password form vs. iPOS-style PIN keypad -->
      <div class="mode-switch">
        <button type="button" class="mode-btn" :class="{ active: mode === 'password' }" :disabled="loading"
          @click="switchMode('password')"><i class="fas fa-keyboard"></i> {{ $t('auth.modePassword') }}</button>
        <button type="button" class="mode-btn" :class="{ active: mode === 'pin' }" :disabled="loading"
          @click="switchMode('pin')"><i class="fas fa-calculator"></i> {{ $t('auth.modePin') }}</button>
      </div>

      <!-- Sign-in form: validates on blur/input, submits via handleLogin (browser validation disabled in favour of custom messages) -->
      <form v-if="mode === 'password'" @submit.prevent="handleLogin" novalidate>
        <!-- Email field; error appears only after the field is touched -->
        <div class="form-group" :class="{ 'has-error': errors.email }">
          <label>{{ $t('auth.email') }}</label>
          <input v-model="form.email" type="email" :placeholder="$t('auth.emailPlaceholder')" autocomplete="email"
            @blur="touch('email')" @input="validateField('email')" />
          <span class="field-error" v-if="errors.email"><i class="fas fa-exclamation-triangle"></i> {{
            errors.email }}</span>
        </div>

        <!-- Password field with show/hide visibility toggle -->
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

        <!-- Authentication failures returned by the API -->
        <div class="server-errors" v-if="serverErrors.length > 0">
          <div v-for="(msg, i) in serverErrors" :key="i" class="server-error"><i class="fas fa-exclamation-circle"></i>
            {{ msg }}</div>
        </div>

        <!-- Transient toast, e.g. showing the default password after a forced rotation -->
        <div v-if="toastMsg" class="password-toast"><i class="fas fa-key"></i> {{ toastMsg }}</div>

        <!-- Submit stays disabled while the login request is in flight -->
        <button type="submit" class="btn btn-primary full-width" :disabled="loading"><i
            class="fas fa-right-to-bracket"></i> {{ loading ? $t('auth.signInLoading') : $t('auth.signIn') }}</button>
      </form>

      <!-- PIN sign-in mode: identifier + 4-digit PIN entered via the on-screen keypad; auto-submits at 4 digits -->
      <div v-else class="pin-mode">
        <!-- Identifier accepts the user's username (email) or their registration number -->
        <div class="form-group" :class="{ 'has-error': errors.identifier }">
          <label>{{ $t('auth.identifier') }}</label>
          <input v-model="pinForm.identifier" type="text" :placeholder="$t('auth.identifierPlaceholder')"
            autocomplete="username" @blur="touch('identifier')" @input="validateField('identifier')" />
          <span class="field-error" v-if="errors.identifier"><i class="fas fa-exclamation-triangle"></i> {{
            errors.identifier }}</span>
        </div>

        <!-- 4-dot progress indicator; dots fill as PIN digits are entered -->
        <div class="pin-dots">
          <span v-for="i in 4" :key="i" class="pin-dot" :class="{ filled: pinForm.pin.length >= i }"></span>
        </div>
        <p class="pin-hint">{{ $t('auth.enterPin') }}</p>
        <span class="field-error pin-error" v-if="errors.pin"><i class="fas fa-exclamation-triangle"></i> {{
          errors.pin }}</span>

        <!-- PIN-mode authentication failures, surfaced in the same style as password-mode server errors -->
        <div class="server-errors" v-if="serverErrors.length > 0">
          <div v-for="(msg, i) in serverErrors" :key="i" class="server-error"><i class="fas fa-exclamation-circle"></i>
            {{ msg }}</div>
        </div>

        <!-- On-screen numeric keypad: 'C' empties the PIN, the delete key removes the last digit; disabled while signing in -->
        <div class="pin-keypad">
          <button v-for="digit in keypadDigits" :key="digit" type="button" class="pin-key" :disabled="loading"
            @click="pressDigit(digit)">{{ digit }}</button>
          <button type="button" class="pin-key pin-key-action" :disabled="loading" :aria-label="$t('auth.clearPin')"
            :title="$t('auth.clearPin')" @click="pressClear">C</button>
          <button type="button" class="pin-key" :disabled="loading" @click="pressDigit('0')">0</button>
          <button type="button" class="pin-key pin-key-action" :disabled="loading" :aria-label="$t('auth.backspacePin')"
            :title="$t('auth.backspacePin')" @click="pressBackspace"><i class="fas fa-delete-left"></i></button>
        </div>
      </div>

      <!-- Link back to the public landing page -->
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

// Sign-in mode: 'password' (classic form) or 'pin' (iPOS-style keypad).
const mode = ref('password')
// PIN-mode model: identifier (username/email or registration number) + the 4-digit PIN.
const pinForm = ref({ identifier: '', pin: '' })
// Keypad digit keys 1-9; the bottom row (clear, 0, backspace) is rendered separately.
const keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

// Timer handle for the temporary password-rotation toast.
let toastTimer = null

// When redirected here after a forced password rotation, surface the new default password once.
onMounted(() => {
  if (route.query.rotated) {
    showToast(`${t('auth.passwordRotated')} ${route.query.default_password || ''}`)
  }
})

/**
 * Shows a transient toast message that clears itself after 6 seconds.
 * @param {string} msg - Text to display inside the toast.
 */
function showToast(msg) {
  toastMsg.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 6000)
}

/**
 * Marks a form field as touched (so its errors show once blurred).
 * @param {string} field - Key of the form model ('email' | 'password').
 */
function touch(field) {
  touched.value[field] = true
}

/**
 * Validates a single field when it has been touched or already contains a value.
 * Skips untouched, empty fields so the form does not scream errors on first paint.
 * @param {string} field - Key of the form model to validate ('email' | 'password' | 'identifier').
 */
function validateField(field) {
  // The PIN-mode identifier lives in pinForm; everything else in the password form model.
  const value = field === 'identifier' ? pinForm.value.identifier : form.value[field]
  if (!touched.value[field] && !value) return

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
    case 'identifier':
      if (!pinForm.value.identifier.trim()) errors.value.identifier = t('auth.validation.identifierRequired')
      else delete errors.value.identifier
      break
  }
}

/**
 * Validates every field and returns true only when the whole form is valid.
 * Forces all fields to "touched" so every error becomes visible on submit.
 * @returns {boolean} True when neither email nor password has an error.
 */
function validateAll() {
  ;['email', 'password'].forEach((f) => {
    touched.value[f] = true
    validateField(f)
  })
  return !errors.value.email && !errors.value.password
}

/**
 * Performs the login, redirecting by role and surfacing API/server errors.
 * Honours the ?redirect= query param first, then falls back to role-based
 * landing pages; also starts the inactivity session timer on success.
 * @returns {Promise<void>}
 */
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

/**
 * Switches between password and PIN sign-in modes. Clears validation errors,
 * server errors and any in-progress PIN so no state leaks across modes.
 * @param {string} m - The mode to activate ('password' | 'pin').
 */
function switchMode(m) {
  if (mode.value === m || loading.value) return
  mode.value = m
  errors.value = {}
  serverErrors.value = []
  pinForm.value.pin = ''
}

/**
 * Appends a keypad digit to the PIN and auto-submits once it reaches 4 digits
 * (iPOS-style: no separate submit button). Ignored while a login is in flight.
 * @param {string} digit - Single digit ('0'-'9') pressed on the keypad.
 */
function pressDigit(digit) {
  if (loading.value || pinForm.value.pin.length >= 4) return
  pinForm.value.pin += digit
  // A new digit supersedes any previous PIN validation error.
  delete errors.value.pin
  if (pinForm.value.pin.length === 4) submitPin()
}

/** Removes the last entered PIN digit (keypad backspace key). */
function pressBackspace() {
  if (loading.value) return
  pinForm.value.pin = pinForm.value.pin.slice(0, -1)
}

/** Empties the whole PIN so the user can start over (keypad clear key). */
function pressClear() {
  if (loading.value) return
  pinForm.value.pin = ''
}

/**
 * Performs the PIN sign-in, mirroring handleLogin's redirect and error
 * handling. Requires a non-empty identifier and a complete 4-digit PIN; on
 * failure the server message is surfaced and the PIN reset so it has to be
 * re-entered from scratch (iPOS behaviour).
 * @returns {Promise<void>}
 */
async function submitPin() {
  serverErrors.value = []
  // Force the identifier error visible even when the field was never touched.
  touched.value.identifier = true
  validateField('identifier')
  if (errors.value.identifier) {
    // The user must fix the identifier first; drop the entered PIN as well.
    pinForm.value.pin = ''
    return
  }
  if (pinForm.value.pin.length !== 4) {
    errors.value.pin = t('auth.validation.pinInvalid')
    return
  }

  loading.value = true
  try {
    await authStore.loginPin({ identifier: pinForm.value.identifier.trim(), pin: pinForm.value.pin })
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
  } catch (e) {
    if (e.response?.data?.message) {
      serverErrors.value = [e.response.data.message]
    } else {
      serverErrors.value = [t('auth.validation.connectionFailed')]
    }
    // A failed attempt always restarts with an empty PIN.
    pinForm.value.pin = ''
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

/* Segmented sign-in mode switcher (Password / PIN) */
.mode-switch {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 20px;
  background: #f3f4f6;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}

.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b7280;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.mode-btn.active {
  background: #fff;
  color: var(--brand);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.mode-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* PIN dots indicator: dots fill with the brand colour as digits are entered */
.pin-dots {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin: 20px 0 8px;
}

.pin-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #e0e0e0;
  background: #fff;
  transition: background 0.15s, border-color 0.15s;
}

.pin-dot.filled {
  background: var(--brand);
  border-color: var(--brand);
}

.pin-hint {
  text-align: center;
  color: #6b7280;
  font-size: 13px;
  margin-bottom: 14px;
}

.pin-error {
  justify-content: center;
}

/* On-screen numeric keypad: 3x4 grid of digit keys plus clear/backspace */
.pin-keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  max-width: 280px;
  margin: 0 auto;
}

.pin-key {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 0;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}

.pin-key:hover:not(:disabled) {
  border-color: var(--brand);
  color: var(--brand);
}

.pin-key:active:not(:disabled) {
  background: #f0f7ff;
}

.pin-key:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Clear/backspace keys read as secondary actions rather than digits */
.pin-key-action {
  color: #6b7280;
  font-size: 16px;
}
</style>
