<!--
  ChangePasswordForm — lets a signed-in user replace their password.
  Checks the new password against its confirmation locally, then delegates to
  the auth store; each field has a visibility toggle. Also serves the forced
  password-change flow after a reset (mustChangePassword).
-->

<template>
  <div>
    <div class="cp-mode-switch">
      <button type="button" class="cp-mode-btn" :class="{ active: mode === 'password' }" @click="setMode('password')">
        {{ $t('changePassword.passwordMode') }}
      </button>
      <button type="button" class="cp-mode-btn" :class="{ active: mode === 'pin' }" @click="setMode('pin')">
        {{ $t('changePassword.pinMode') }}
      </button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <form v-if="mode === 'password'" @submit.prevent="submit">
      <div class="form-group">
        <label for="current_password">{{ $t('changePassword.currentPassword') }}</label>
        <div class="password-input-wrap">
          <input id="current_password" v-model="form.current_password" :type="showCurrent ? 'text' : 'password'"
            class="input" autocomplete="current-password" required />
          <button type="button" class="pw-toggle" @click="showCurrent = !showCurrent">
            <i :class="showCurrent ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
          </button>
        </div>
      </div>
      <div class="form-group">
        <label for="new_password">{{ $t('changePassword.newPassword') }}</label>
        <div class="password-input-wrap">
          <input id="new_password" v-model="form.new_password" :type="showNew ? 'text' : 'password'" class="input"
            autocomplete="new-password" required minlength="8" />
          <button type="button" class="pw-toggle" @click="showNew = !showNew">
            <i :class="showNew ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
          </button>
        </div>
      </div>
      <div class="form-group">
        <label for="new_password_confirmation">{{ $t('changePassword.confirmNewPassword') }}</label>
        <div class="password-input-wrap">
          <input id="new_password_confirmation" v-model="form.new_password_confirmation"
            :type="showConfirm ? 'text' : 'password'" class="input" autocomplete="new-password" required />
          <button type="button" class="pw-toggle" @click="showConfirm = !showConfirm">
            <i :class="showConfirm ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
          </button>
        </div>
      </div>

      <button class="btn" :disabled="saving">
        {{ saving ? $t('common.saving') : $t('changePassword.submit') }}
      </button>
    </form>

    <form v-else @submit.prevent="submitPin">
      <div class="form-group">
        <label for="pin_current_password">{{ $t('changePassword.currentPassword') }}</label>
        <div class="password-input-wrap">
          <input id="pin_current_password" v-model="pinForm.current_password" :type="showCurrent ? 'text' : 'password'"
            class="input" autocomplete="current-password" required />
          <button type="button" class="pw-toggle" @click="showCurrent = !showCurrent">
            <i :class="showCurrent ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
          </button>
        </div>
      </div>
      <p class="cp-pin-hint">{{ $t('changePassword.pinHint') }}</p>
      <div class="cp-pin-field">
        <label>{{ $t(pinStage === 'new' ? 'changePassword.newPin' : 'changePassword.confirmPin') }}</label>
        <span class="cp-pin-dots">
          <i v-for="i in 4" :key="i" :class="{ filled: activePin.length >= i }"></i>
        </span>
      </div>
      <div class="cp-keypad">
        <button v-for="digit in keypadDigits" :key="digit" type="button" class="cp-key" :disabled="saving"
          @click="pressDigit(digit)">{{ digit }}</button>
        <button type="button" class="cp-key" :disabled="saving" @click="clearPin">C</button>
        <button type="button" class="cp-key" :disabled="saving" @click="pressDigit('0')">0</button>
        <button type="button" class="cp-key" :disabled="saving" @click="backspace"><i class="fas fa-delete-left"></i></button>
      </div>
      <button class="btn" :disabled="saving || pinForm.confirm.length !== 4">
        {{ saving ? $t('common.saving') : $t('changePassword.submit') }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const { t } = useI18n()
const form = ref({ current_password: '', new_password: '', new_password_confirmation: '' })
const pinForm = ref({ current_password: '', pin: '', confirm: '' })
const mode = ref('password')
const pinStage = ref('new')
const keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const activePin = computed(() => (pinStage.value === 'new' ? pinForm.value.pin : pinForm.value.confirm))
const error = ref('')
const success = ref('')
const saving = ref(false)
const showCurrent = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)

function setMode(next) {
  mode.value = next
  error.value = ''
  success.value = ''
}

function pressDigit(digit) {
  if (saving.value || activePin.value.length >= 4) return
  if (pinStage.value === 'new') {
    pinForm.value.pin += digit
    if (pinForm.value.pin.length === 4) pinStage.value = 'confirm'
  } else {
    pinForm.value.confirm += digit
  }
}

function backspace() {
  if (saving.value) return
  if (pinStage.value === 'confirm' && pinForm.value.confirm.length) pinForm.value.confirm = pinForm.value.confirm.slice(0, -1)
  else if (pinForm.value.pin.length) pinForm.value.pin = pinForm.value.pin.slice(0, -1)
}

function clearPin() {
  if (saving.value) return
  pinForm.value.pin = ''
  pinForm.value.confirm = ''
  pinStage.value = 'new'
}

/**
 * Submits the change-password request to the auth store. Validates that the
 * new password matches its confirmation locally, then delegates to the store
 * and surfaces either a success message (resetting the form) or a combined
 * server-side error message.
 *
 * @returns {Promise<void>}
 */
async function submit() {
  error.value = ''
  success.value = ''
  if (form.value.new_password !== form.value.new_password_confirmation) {
    error.value = t('changePassword.mismatch')
    return
  }
  saving.value = true
  try {
    await authStore.changePassword({
      current_password: form.value.current_password,
      new_password: form.value.new_password,
      new_password_confirmation: form.value.new_password_confirmation,
    })
    success.value = t('changePassword.success')
    form.value.current_password = ''
    form.value.new_password = ''
    form.value.new_password_confirmation = ''
  } catch (err) {
    const messages = err.response?.data?.errors
    error.value = messages ? Object.values(messages).flat().join(' ') : err.response?.data?.message || t('changePassword.error')
  } finally {
    saving.value = false
  }
}

async function submitPin() {
  error.value = ''
  success.value = ''
  if (pinForm.value.pin.length !== 4 || pinForm.value.confirm.length !== 4 || pinForm.value.pin !== pinForm.value.confirm) {
    error.value = t('changePassword.pinMismatch')
    return
  }
  saving.value = true
  try {
    await authStore.changePin({
      current_password: pinForm.value.current_password,
      pin: pinForm.value.pin,
      pin_confirmation: pinForm.value.confirm,
    })
    success.value = t('changePassword.pinSuccess')
    pinForm.value = { current_password: '', pin: '', confirm: '' }
    pinStage.value = 'new'
  } catch (err) {
    const messages = err.response?.data?.errors
    error.value = messages ? Object.values(messages).flat().join(' ') : err.response?.data?.message || t('changePassword.error')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.password-input-wrap {
  position: relative;
  max-width: 420px;
}

.password-input-wrap .input {
  width: 100%;
  padding-right: 44px;
}

.pw-toggle {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pw-toggle:hover {
  color: #333;
}

.cp-mode-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.cp-mode-btn {
  border: 1px solid #d6d6d6;
  border-radius: 999px;
  background: #fff;
  color: #555;
  cursor: pointer;
  padding: 7px 14px;
}

.cp-mode-btn.active {
  background: #0b5fff;
  border-color: #0b5fff;
  color: #fff;
}

.cp-pin-hint {
  color: #666;
  font-size: 13px;
  margin: -4px 0 12px;
}

.cp-pin-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 260px;
  margin-bottom: 12px;
}

.cp-pin-dots {
  display: flex;
  gap: 10px;
}

.cp-pin-dots i {
  border: 1px solid #bbb;
  border-radius: 50%;
  display: inline-block;
  height: 14px;
  width: 14px;
}

.cp-pin-dots i.filled {
  background: #0b5fff;
  border-color: #0b5fff;
}

.cp-keypad {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, 54px);
  margin-bottom: 16px;
  max-width: 180px;
}

.cp-key {
  background: #f7f7f7;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-size: 17px;
  height: 46px;
}

.cp-key:hover {
  background: #ececec;
}

.cp-key:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
