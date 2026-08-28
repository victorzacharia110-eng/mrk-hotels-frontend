<!--
  GuestLoginPage — hotel guest self-service login (route: /guest/login).
  Authenticates by booking reference + phone number (no account needed).
-->
<template>
  <div class="guest-login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="brand-icon">🏨</div>
        <h1>Guest Portal</h1>
        <p>View your booking, folio and service requests.</p>
      </div>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div v-if="error" class="alert alert--error">{{ error }}</div>
        <div v-if="success" class="alert alert--success">{{ success }}</div>

        <div class="input-group">
          <label for="booking_reference">Booking Reference</label>
          <input
            id="booking_reference"
            v-model="form.booking_reference"
            type="text"
            class="auth-input"
            required
            placeholder="e.g. BK-2026-00123"
          />
        </div>

        <div class="input-group">
          <label for="phone">Phone Number</label>
          <input
            id="phone"
            v-model="form.phone"
            type="tel"
            class="auth-input"
            required
            placeholder="+255 712 345 678"
          />
          <p class="input-hint">The phone number used when booking.</p>
        </div>

        <button type="submit" class="auth-submit" :disabled="loading">
          {{ loading ? 'Checking...' : 'Access My Booking' }}
        </button>
      </form>

      <div class="login-footer">
        <router-link to="/" class="back-link">← Back to hotels</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { guestPortalApi } from '@/api'

const router = useRouter()
const loading = ref(false)
const error = ref(null)
const success = ref(null)

const form = reactive({
  booking_reference: '',
  phone: '',
})

async function handleSubmit() {
  error.value = null
  success.value = null
  loading.value = true
  try {
    const data = await guestPortalApi.authenticate({
      booking_reference: form.booking_reference.trim(),
      phone: form.phone.trim(),
    })
    sessionStorage.setItem('guest_token', data.token)
    sessionStorage.setItem('guest_booking', JSON.stringify(data.booking))
    router.push({ name: 'guest-booking' })
  } catch (e) {
    error.value = e.response?.data?.message || 'Could not find your booking. Please check your details.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.guest-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8edf5 100%);
  font-family: 'Inter', system-ui, sans-serif;
  padding: 24px;
}

.login-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  padding: 40px;
  width: 100%;
  max-width: 420px;
}

.login-header { text-align: center; margin-bottom: 32px; }
.brand-icon { font-size: 48px; margin-bottom: 12px; }
.login-header h1 { font-size: 24px; font-weight: 800; color: #1a1a2e; margin: 0 0 8px; }
.login-header p { color: #5f6368; font-size: 14px; margin: 0; }

.login-form { display: flex; flex-direction: column; gap: 16px; }

.input-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.auth-input {
  width: 100%; padding: 12px 14px;
  border: 1.5px solid #d1d5db; border-radius: 8px;
  font-size: 14px; color: #111827; background: #fff;
  outline: none; transition: border-color 0.15s ease;
}
.auth-input:focus { border-color: #2563eb; }
.input-hint { font-size: 12px; color: #9ca3af; margin-top: 4px; }

.alert { padding: 10px 14px; border-radius: 8px; font-size: 13px; }
.alert--error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.alert--success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

.auth-submit {
  width: 100%; padding: 12px 24px; margin-top: 8px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #fff; border: none; border-radius: 8px;
  font-size: 15px; font-weight: 600; cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.auth-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
.auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }

.login-footer { text-align: center; margin-top: 24px; }
.back-link { color: #6b7280; text-decoration: none; font-size: 13px; }
.back-link:hover { color: #2563eb; }
</style>
