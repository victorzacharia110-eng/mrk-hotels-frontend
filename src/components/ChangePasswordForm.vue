<!--
  ChangePasswordForm — lets a signed-in user replace their password.
  Checks the new password against its confirmation locally, then delegates to
  the auth store; each field has a visibility toggle. Also serves the forced
  password-change flow after a reset (mustChangePassword).
-->

<template>
  <form @submit.prevent="submit">
    <!-- Feedback alerts for the last submit attempt. -->
    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <!-- Current password, with an eye toggle to reveal it. -->
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
    <!-- New password (minimum 8 characters), with an eye toggle. -->
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
    <!-- Confirmation must match the new password (checked in submit()). -->
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
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const { t } = useI18n()
// Form state: the three password fields, the saving flag, and the
// success/error messages shown as alerts, plus per-field visibility toggles.
const form = ref({ current_password: '', new_password: '', new_password_confirmation: '' })
const error = ref('')
const success = ref('')
const saving = ref(false)
const showCurrent = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)

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
</script>

<style scoped>
.password-input-wrap {
  position: relative;
}

.password-input-wrap .input {
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
</style>
