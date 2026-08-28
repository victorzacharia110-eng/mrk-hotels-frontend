<!--
  PortalHotelPage — manage hotel business details (route: /portal/hotel).
-->
<template>
  <div class="portal-hotel">
    <div v-if="loading" class="loading-spinner"><div class="spinner"></div></div>
    <template v-else>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div v-if="saved" class="alert alert-success">Hotel details saved successfully.</div>

      <!-- Logo Section -->
      <div class="card">
        <h2 class="card-title"><i class="fas fa-image"></i> Hotel Logo</h2>
        <div class="logo-section">
          <div class="logo-preview">
            <img :src="logoPreview || defaultLogo" alt="Hotel Logo" />
          </div>
          <div class="logo-actions">
            <p class="logo-hint">Upload your hotel logo. This will appear on invoices, emails, and the guest portal.</p>
            <div class="logo-buttons">
              <label class="btn btn-outline btn-sm">
                <i class="fas fa-upload"></i> Choose Image
                <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" @change="onLogoSelect" hidden />
              </label>
              <button v-if="logoFile" class="btn btn-primary btn-sm" @click="uploadLogo" :disabled="uploadingLogo">
                <i v-if="uploadingLogo" class="fas fa-spinner fa-spin"></i>
                {{ uploadingLogo ? 'Uploading...' : 'Upload' }}
              </button>
              <button v-if="logoFile" class="btn btn-outline btn-sm" @click="cancelLogo">Cancel</button>
              <button v-if="currentLogoUrl && !logoFile" class="btn btn-danger btn-sm" @click="removeLogo" :disabled="uploadingLogo">
                <i class="fas fa-trash"></i> Remove
              </button>
            </div>
            <p v-if="logoError" class="field-error">{{ logoError }}</p>
          </div>
        </div>
      </div>

      <!-- Hotel Details -->
      <div class="card">
        <h2 class="card-title"><i class="fas fa-hotel"></i> Hotel Information</h2>
        <form @submit.prevent="save" class="settings-form">
          <div class="form-row">
            <div class="form-group">
              <label>Hotel Name</label>
              <input v-model="form.hotel_name" type="text" class="form-control" />
            </div>
            <div class="form-group">
              <label>Subdomain</label>
              <div class="input-with-suffix">
                <input v-model="form.subdomain" type="text" class="form-control" disabled />
                <span class="input-suffix">.tscl.app</span>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Contact Person</label>
              <input v-model="form.contact_person" type="text" class="form-control" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input v-model="form.email" type="email" class="form-control" disabled />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Phone</label>
              <input v-model="form.phone" type="tel" class="form-control" />
            </div>
            <div class="form-group">
              <label>City</label>
              <input v-model="form.city" type="text" class="form-control" />
            </div>
          </div>
          <div class="form-group">
            <label>Country</label>
            <input v-model="form.country" type="text" class="form-control" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>TIN Number</label>
              <input v-model="form.tin" type="text" class="form-control" placeholder="Tax Identification Number" />
            </div>
            <div class="form-group">
              <label>VRN Number</label>
              <input v-model="form.vrn" type="text" class="form-control" placeholder="VAT Registration Number" />
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i v-if="saving" class="fas fa-spinner fa-spin"></i>
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { hotelSettingsApi } from '@/api'

const authStore = useAuthStore()
const loading = ref(true)
const saving = ref(false)
const error = ref(null)
const saved = ref(false)

const form = reactive({
  hotel_name: '',
  subdomain: '',
  contact_person: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  tin: '',
  vrn: '',
})

// Logo state
const currentLogoUrl = ref(null)
const logoPreview = ref(null)
const logoFile = ref(null)
const uploadingLogo = ref(false)
const logoError = ref(null)
const defaultLogo = new URL('@/assets/default-hotel-logo.svg', import.meta.url).href

function onLogoSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  logoError.value = null
  if (file.size > 2 * 1024 * 1024) {
    logoError.value = 'Image must be under 2MB.'
    return
  }
  logoFile.value = file
  logoPreview.value = URL.createObjectURL(file)
}

function cancelLogo() {
  logoFile.value = null
  logoPreview.value = null
  logoError.value = null
}

async function uploadLogo() {
  if (!logoFile.value) return
  uploadingLogo.value = true
  logoError.value = null
  try {
    const fd = new FormData()
    fd.append('logo', logoFile.value)
    const { data } = await hotelSettingsApi.update(fd)
    currentLogoUrl.value = data.hotel?.logo_url || null
    logoFile.value = null
    logoPreview.value = null
  } catch (e) {
    logoError.value = e.response?.data?.message || 'Upload failed.'
  } finally {
    uploadingLogo.value = false
  }
}

async function removeLogo() {
  uploadingLogo.value = true
  try {
    await hotelSettingsApi.removeLogo()
    currentLogoUrl.value = null
  } catch (e) {
    logoError.value = e.response?.data?.message || 'Failed to remove logo.'
  } finally {
    uploadingLogo.value = false
  }
}

async function save() {
  saving.value = true
  error.value = null
  saved.value = false
  try {
    await hotelSettingsApi.update({
      hotel_name: form.hotel_name,
      contact_person: form.contact_person,
      phone: form.phone,
      city: form.city,
      country: form.country,
      tin: form.tin,
      vrn: form.vrn,
    })
    saved.value = true
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to save.'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const tenant = authStore.user?.tenant
    if (tenant) {
      Object.assign(form, {
        hotel_name: tenant.hotel_name || '',
        subdomain: tenant.subdomain || '',
        contact_person: tenant.contact_person || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        city: tenant.city || '',
        country: tenant.country || '',
        tin: tenant.tin || '',
        vrn: tenant.vrn || '',
      })
    }
    // Fetch logo URL from settings API.
    try {
      const { data } = await hotelSettingsApi.show()
      currentLogoUrl.value = data.hotel?.logo_url || null
    } catch {
      // logo is optional; the default continues to render
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.portal-hotel { max-width: 800px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
.card-title { font-size: 16px; font-weight: 700; margin: 0 0 20px; display: flex; align-items: center; gap: 8px; }
.card-title i { color: #3b82f6; }

.logo-section { display: flex; gap: 24px; align-items: flex-start; }
.logo-preview { width: 120px; height: 120px; border-radius: 12px; overflow: hidden; background: #f8fafc; border: 2px dashed #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.logo-preview img { width: 100%; height: 100%; object-fit: contain; }
.logo-actions { flex: 1; }
.logo-hint { font-size: 13px; color: #64748b; margin: 0 0 12px; }
.logo-buttons { display: flex; gap: 8px; flex-wrap: wrap; }

.settings-form { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { display: flex; flex-direction: column; }
.form-group label { font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 4px; }
.form-control { padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; background: #fff; }
.form-control:focus { outline: none; border-color: #3b82f6; }
.form-control:disabled { background: #f8fafc; color: #94a3b8; }
.input-with-suffix { display: flex; }
.input-with-suffix .form-control { border-top-right-radius: 0; border-bottom-right-radius: 0; flex: 1; }
.input-suffix { display: flex; align-items: center; padding: 0 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: none; border-radius: 0 8px 8px 0; font-size: 13px; color: #64748b; }

.form-actions { margin-top: 8px; }
.btn { padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
.btn-sm { padding: 6px 14px; font-size: 13px; }
.btn-primary { background: #3b82f6; color: #fff; }
.btn-primary:hover { background: #2563eb; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-outline { background: #fff; color: #334155; border: 1px solid #e2e8f0; }
.btn-outline:hover { background: #f8fafc; }
.btn-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.btn-danger:hover { background: #fee2e2; }

.field-error { font-size: 12px; color: #dc2626; margin-top: 6px; }
.alert-error { background: #fef2f2; color: #dc2626; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
.alert-success { background: #f0fdf4; color: #16a34a; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }

.loading-spinner { display: flex; justify-content: center; padding: 80px 20px; }
.spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } .logo-section { flex-direction: column; } }
</style>
