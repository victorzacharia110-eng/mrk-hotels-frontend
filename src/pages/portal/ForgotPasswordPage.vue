<template>
  <div class="forgot-password-page">
    <div class="forgot-password-card">
      <div class="logo-section">
        <div class="auth-logo"><i class="fas fa-cloud"></i> TSCL</div>
        <h1>Forgot Password</h1>
        <p class="subtitle">Enter your email and we'll send you a reset link.</p>
      </div>

      <form v-if="!sent" @submit.prevent="handleSubmit" class="forgot-form">
        <div class="field">
          <label for="email">Email address</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            placeholder="you@example.com"
            required
            :disabled="loading"
          />
        </div>

        <div v-if="error" class="error-banner">{{ error }}</div>

        <button type="submit" class="btn-primary" :disabled="loading || !form.email">
          {{ loading ? 'Sending...' : 'Send Reset Link' }}
        </button>
      </form>

      <div v-else class="success-message">
        <div class="success-icon">✓</div>
        <h2>Check your email</h2>
        <p>If an account with <strong>{{ sentEmail }}</strong> exists, we've sent a password reset link.</p>
        <p class="hint">Didn't receive it? Check your spam folder or try again.</p>
        <button class="btn-secondary" @click="resetForm">Send again</button>
      </div>

      <div class="back-link">
        <router-link to="/portal/login">← Back to Sign In</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { authApi } from '@/api'

const form = reactive({ email: '' })
const loading = ref(false)
const error = ref('')
const sent = ref(false)
const sentEmail = ref('')

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    await authApi.forgotPassword(form.email)
    sentEmail.value = form.email
    sent.value = true
  } catch (e) {
    error.value = e.response?.data?.message || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

function resetForm() {
  sent.value = false
  form.email = ''
}
</script>

<style scoped>
.forgot-password-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  padding: 20px;
}

.forgot-password-card {
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

.forgot-form { text-align: left; }
.field { margin-bottom: 20px; }
.field label { display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin-bottom: 6px; }
.field input {
  width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 15px; outline: none; transition: border-color 0.2s;
}
.field input:focus { border-color: #3182ce; }
.field input:disabled { background: #f7fafc; }

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
  transition: background 0.2s;
}
.btn-secondary:hover { background: #e2e8f0; }

.success-message { padding: 20px 0; }
.success-icon {
  width: 56px; height: 56px; background: #c6f6d5; color: #276749;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 700; margin: 0 auto 16px;
}
.success-message h2 { font-size: 20px; color: #1a365d; margin: 0 0 12px; }
.success-message p { color: #4a5568; font-size: 14px; margin: 0 0 8px; line-height: 1.5; }
.hint { color: #718096; font-size: 13px; }

.back-link { margin-top: 24px; }
.back-link a { color: #3182ce; text-decoration: none; font-size: 14px; font-weight: 500; }
.back-link a:hover { text-decoration: underline; }
</style>
