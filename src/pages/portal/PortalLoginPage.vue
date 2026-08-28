<!--
  PortalLoginPage — customer sign-in (route: /portal/login).
  Minimal Google-style layout: no cards, no backgrounds, just centered inputs.
-->
<template>
  <div class="auth-page">
    <div class="auth-content">
      <div class="auth-logo">
        <i class="fas fa-cloud"></i> TSCL
      </div>
      <h1>Sign in</h1>
      <p class="auth-subtitle">Use your TSCL account to continue</p>

      <div v-if="error" class="auth-error">{{ error }}</div>

      <form @submit.prevent="handleLogin" class="auth-form">
        <div class="input-group">
          <input
            v-model="email"
            type="email"
            class="auth-input"
            required
            placeholder="Email"
            autofocus
          />
        </div>
        <div class="input-group">
          <div class="password-wrap">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="auth-input"
              required
              placeholder="Password"
            />
            <button type="button" class="password-toggle" @click="showPassword = !showPassword">
              <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
            </button>
          </div>
        </div>
        <button type="submit" class="auth-submit" :disabled="submitting">
          {{ submitting ? 'Signing in...' : 'Continue' }}
        </button>
      </form>

      <div class="auth-links">
        <p><router-link to="/portal/forgot-password">Forgot password?</router-link></p>
        <p>Don't have an account? <router-link to="/portal/register">Create account</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref(null)
const submitting = ref(false)

async function handleLogin() {
  error.value = null
  submitting.value = true
  try {
    await authStore.login({ email: email.value, password: password.value })
    const role = authStore.user?.user_role
    if (role === 'superadmin') {
      router.push('/superadmin')
    } else if (role === 'owner') {
      router.push('/owner')
    } else if (authStore.user?.tenant?.self_service) {
      router.push('/portal')
    } else {
      router.push('/app')
    }
  } catch (e) {
    error.value = e.response?.data?.message || 'Login failed. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  padding: 40px 20px;
}

.auth-content {
  width: 100%;
  max-width: 400px;
}

.auth-logo {
  font-size: 22px;
  font-weight: 800;
  color: #3b82f6;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
}

h1 {
  font-size: 24px;
  font-weight: 400;
  color: #202124;
  margin: 0 0 4px;
}

.auth-subtitle {
  font-size: 14px;
  color: #5f6368;
  margin: 0 0 32px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  position: relative;
}

.auth-input {
  width: 100%;
  padding: 13px 15px;
  border: 1px solid #dadce0;
  border-radius: 4px;
  font-size: 14px;
  color: #202124;
  background: #fff;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.auth-input:focus {
  border-color: #1a73e8;
  box-shadow: none;
}

.auth-input::placeholder {
  color: #9aa0a6;
}

.password-wrap {
  position: relative;
}

.password-wrap .auth-input {
  padding-right: 44px;
}

.password-toggle {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #5f6368;
  cursor: pointer;
  padding: 4px;
  font-size: 14px;
}

.password-toggle:hover {
  color: #202124;
}

.auth-submit {
  width: 100%;
  padding: 10px 24px;
  margin-top: 8px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.auth-submit:hover {
  background: #1765cc;
}

.auth-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-error {
  background: #fce8e6;
  color: #c5221f;
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 20px;
  border: 1px solid #f5c6cb;
}

.auth-links {
  margin-top: 24px;
  text-align: center;
  font-size: 13px;
  color: #5f6368;
}

.auth-links a {
  color: #1a73e8;
  text-decoration: none;
  font-weight: 500;
}

.auth-links a:hover {
  text-decoration: underline;
}
</style>
