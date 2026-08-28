<!--
  RegisterPage.vue — Self-service hotel registration (route: /portal/register).
  Minimal Google-style layout. Legal registration fields instead of subdomain.
-->
<template>
  <div class="auth-page">
    <div class="auth-content">
      <div class="auth-logo">
        <i class="fas fa-cloud"></i> TSCL
      </div>
      <h1>Create your account</h1>
      <p v-if="selectedPlan" class="auth-subtitle">
        {{ selectedPlan.label }} plan — {{ selectedPlan.trial_days }}-day free trial
      </p>
      <p v-else class="auth-subtitle">Start managing your hotel today</p>

      <div v-if="error" class="auth-error">{{ error }}</div>
      <div v-if="success" class="auth-success">{{ success }}</div>

      <form v-if="!success" @submit.prevent="handleRegister" class="auth-form">
        <div class="input-group">
          <input v-model="form.hotel_name" type="text" class="auth-input" required placeholder="Hotel name" />
        </div>
        <div class="input-group">
          <input v-model="form.contact_person" type="text" class="auth-input" required placeholder="Full name" />
        </div>
        <div class="input-group">
          <input v-model="form.email" type="email" class="auth-input" required placeholder="Email address" />
        </div>
        <div class="input-group">
          <input v-model="form.phone" type="tel" class="auth-input" placeholder="Phone number" />
        </div>
        <div class="input-group">
          <input v-model="form.city" type="text" class="auth-input" placeholder="City" />
        </div>
        <div class="input-group">
          <input v-model="form.country" type="text" class="auth-input" required placeholder="Country" />
        </div>

        <!-- Legal / tax registration -->
        <div class="section-divider">
          <span>Legal & Tax Registration</span>
        </div>

        <div class="input-group">
          <input v-model="form.tin" type="text" class="auth-input" required placeholder="TIN number (Tax Identification Number)" />
        </div>
        <div class="input-group">
          <input v-model="form.vrn" type="text" class="auth-input" placeholder="VRN number (VAT Registration, if applicable)" />
        </div>
        <div class="input-group">
          <input v-model="form.business_registration_number" type="text" class="auth-input" required placeholder="Business Registration Number" />
        </div>
        <div class="input-group">
          <select v-model="form.registration_country" class="auth-input" required>
            <option value="" disabled>Country of registration</option>
            <option value="TZ">Tanzania (BRELA / TRA)</option>
            <option value="KE">Kenya</option>
            <option value="UG">Uganda</option>
            <option value="RW">Rwanda</option>
            <option value="NG">Nigeria</option>
            <option value="ZA">South Africa</option>
            <option value="GH">Ghana</option>
            <option value="OTHER">Other (International)</option>
          </select>
        </div>

        <!-- Password -->
        <div class="section-divider">
          <span>Security</span>
        </div>

        <div class="input-group">
          <div class="password-wrap">
            <input v-model="form.password" :type="showPassword ? 'text' : 'password'" class="auth-input" required minlength="8" placeholder="Password (min 8 characters)" />
            <button type="button" class="password-toggle" @click="showPassword = !showPassword">
              <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
            </button>
          </div>
        </div>
        <div class="input-group">
          <div class="password-wrap">
            <input v-model="form.password_confirmation" :type="showPasswordConfirm ? 'text' : 'password'" class="auth-input" required placeholder="Confirm password" />
            <button type="button" class="password-toggle" @click="showPasswordConfirm = !showPasswordConfirm">
              <i :class="showPasswordConfirm ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
            </button>
          </div>
        </div>

        <button type="submit" class="auth-submit" :disabled="submitting">
          {{ submitting ? 'Creating account...' : 'Create account' }}
        </button>
      </form>

      <div v-if="!success" class="auth-links">
        <p>Already have an account? <router-link to="/portal/login">Sign in</router-link></p>
      </div>

      <div v-if="success" class="auth-links">
        <router-link to="/portal/login" class="auth-submit" style="display:block;text-align:center;text-decoration:none;margin-top:16px">
          Go to sign in
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { planApi, authApi } from '@/api'

const route = useRoute()

const form = reactive({
  hotel_name: '',
  contact_person: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  tin: '',
  vrn: '',
  business_registration_number: '',
  registration_country: '',
  password: '',
  password_confirmation: '',
  plan: '',
})

const selectedPlan = ref(null)
const submitting = ref(false)
const showPassword = ref(false)
const showPasswordConfirm = ref(false)
const error = ref(null)
const success = ref(null)

async function handleRegister() {
  error.value = null
  success.value = null
  submitting.value = true

  try {
    const payload = { ...form }
    // Remove empty optional fields.
    for (const key of ['phone', 'city', 'vrn']) {
      if (!payload[key]) delete payload[key]
    }

    const { data } = await authApi.register(payload)
    success.value = data.message
  } catch (e) {
    const errors = e.response?.data?.errors
    if (errors) {
      error.value = Object.values(errors).flat().join('. ')
    } else {
      error.value = e.response?.data?.message || 'Registration failed. Please try again.'
    }
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  const planSlug = route.query.plan
  if (planSlug) {
    form.plan = planSlug
    try {
      const { data } = await planApi.publicIndex()
      const plans = Array.isArray(data.plans) ? data.plans : Object.values(data.plans)
      selectedPlan.value = plans.find((p) => p.slug === planSlug)
    } catch {
      // Plan badge won't show, registration still works.
    }
  }
})
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
  gap: 16px;
}

.section-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0 0;
}

.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e8eaed;
}

.section-divider span {
  font-size: 12px;
  font-weight: 500;
  color: #9aa0a6;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
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
  -webkit-appearance: none;
  appearance: none;
}

.auth-input:focus {
  border-color: #1a73e8;
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

select.auth-input {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%235f6368' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
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

.auth-success {
  background: #e6f4ea;
  color: #137333;
  padding: 10px 14px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 20px;
  border: 1px solid #ceead6;
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
