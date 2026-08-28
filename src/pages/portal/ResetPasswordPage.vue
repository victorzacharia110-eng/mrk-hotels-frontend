<template>
  <div class="reset-password-page">
    <div class="reset-password-card">
      <div class="logo-section">
        <div class="auth-logo"><i class="fas fa-cloud"></i> TSCL</div>
        <h1>Reset Password</h1>
        <p class="subtitle">Enter your new password below.</p>
      </div>

      <div v-if="invalidToken" class="invalid-token">
        <div class="error-icon">✕</div>
        <h2>Invalid or expired link</h2>
        <p>This password reset link is invalid or has expired. Please request a new one.</p>
        <router-link to="/portal/forgot-password" class="btn-secondary">Request New Link</router-link>
      </div>

      <form v-else-if="!success" @submit.prevent="handleSubmit" class="reset-form">
        <div class="field">
          <label for="password">New Password</label>
          <div class="password-field">
            <input
              id="password"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Minimum 8 characters"
              required
              :disabled="loading"
            />
            <button type="button" class="toggle-password" @click="showPassword = !showPassword">
              {{ showPassword ? '🙈' : '👁' }}
            </button>
          </div>
        </div>

        <div class="field">
          <label for="password_confirmation">Confirm Password</label>
          <input
            id="password_confirmation"
            v-model="form.password_confirmation"
            type="password"
            placeholder="Repeat your password"
            required
            :disabled="loading"
          />
        </div>

        <div v-if="error" class="error-banner">{{ error }}</div>

        <button type="submit" class="btn-primary" :disabled="loading || !form.password || !form.password_confirmation">
          {{ loading ? 'Resetting...' : 'Reset Password' }}
        </button>
      </form>

      <div v-else class="success-message">
        <div class="success-icon">✓</div>
        <h2>Password Reset!</h2>
        <p>Your password has been updated. You can now sign in with your new password.</p>
        <router-link to="/portal/login" class="btn-primary" style="display:inline-block;text-decoration:none;margin-top:16px;">Sign In</router-link>
      </div>

      <div class="back-link">
        <router-link to="/portal/login">← Back to Sign In</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { authApi } from '@/api'

const route = useRoute()
const form = reactive({ password: '', password_confirmation: '' })
const loading = ref(false)
const error = ref('')
const success = ref(false)
const showPassword = ref(false)
const invalidToken = ref(false)

onMounted(() => {
  if (!route.query.token || !route.query.email) {
    invalidToken.value = true
  }
})

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    await authApi.resetPassword({
      token: route.query.token,
      email: route.query.email,
      password: form.password,
      password_confirmation: form.password_confirmation,
    })
    success.value = true
  } catch (e) {
    error.value = e.response?.data?.message || 'Invalid or expired reset token.'
    if (e.response?.status === 422) {
      invalidToken.value = true
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.reset-password-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  padding: 20px;
}

.reset-password-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  padding: 48px 40px;
  width: 100%;
  max-width: 420px;
  text-align: center;
}

.logo-section { margin-bottom: 32px; }
.auth-logo {
  font-size: 22px; font-weight: 800; color: #3b82f6;
  margin-bottom: 16px; display: flex; align-items: center; justify-content: center; gap: 6px;
}
.logo-section h1 { font-size: 24px; color: #1a365d; margin: 0 0 8px; }
.subtitle { color: #718096; font-size: 14px; margin: 0; }

.reset-form { text-align: left; }
.field { margin-bottom: 20px; }
.field label { display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px; }
.field input {
  width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 15px; outline: none; transition: border-color 0.2s;
}
.field input:focus { border-color: #3182ce; }
.field input:disabled { background: #f7fafc; }

.password-field { position: relative; }
.toggle-password {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px;
}

.error-banner {
  background: #fed7d7; color: #c53030; padding: 10px 14px; border-radius: 8px;
  font-size: 13px; margin-bottom: 16px;
}

.btn-primary {
  width: 100%; padding: 12px; background: #1a365d; color: #fff; border: none;
  border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover { background: #2c5282; }
.btn-primary:disabled { background: #a0aec0; cursor: not-allowed; }

.btn-secondary {
  padding: 10px 24px; background: #edf2f7; color: #1a365d; border: none;
  border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
  transition: background 0.2s; text-decoration: none; display: inline-block;
}
.btn-secondary:hover { background: #e2e8f0; }

.invalid-token { padding: 20px 0; }
.error-icon {
  width: 56px; height: 56px; background: #fed7d7; color: #c53030;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; margin: 0 auto 16px;
}
.invalid-token h2 { font-size: 20px; color: #1a365d; margin: 0 0 12px; }
.invalid-token p { color: #4a5568; font-size: 14px; margin: 0 0 16px; }

.success-message { padding: 20px 0; }
.success-icon {
  width: 56px; height: 56px; background: #c6f6d5; color: #276749;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; margin: 0 auto 16px;
}
.success-message h2 { font-size: 20px; color: #1a365d; margin: 0 0 12px; }
.success-message p { color: #4a5568; font-size: 14px; margin: 0; }

.back-link { margin-top: 24px; }
.back-link a { color: #3182ce; text-decoration: none; font-size: 14px; font-weight: 500; }
.back-link a:hover { text-decoration: underline; }
</style>
