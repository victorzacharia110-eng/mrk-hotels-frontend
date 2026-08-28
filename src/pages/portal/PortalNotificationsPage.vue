<!--
  PortalNotificationsPage — manage email/SMS notification preferences (route: /portal/notifications).
-->
<template>
  <div class="portal-notifications">
    <div class="card">
      <h2 class="card-title"><i class="fas fa-bell"></i> Notification Preferences</h2>
      <p class="card-desc">Choose which notifications you receive via email and SMS. Changes take effect immediately.</p>

      <div v-if="loading" class="loading-spinner"><div class="spinner"></div></div>
      <template v-else>
        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <div v-if="saved" class="alert alert-success">Settings saved successfully.</div>

        <div class="pref-table">
          <div class="pref-header">
            <span class="pref-event">Notification</span>
            <span class="pref-channel"><i class="fas fa-envelope"></i> Email</span>
            <span class="pref-channel"><i class="fas fa-sms"></i> SMS</span>
          </div>
          <div v-for="(info, event) in settings" :key="event" class="pref-row">
            <span class="pref-event">{{ info.label }}</span>
            <label class="toggle-wrap">
              <input type="checkbox" v-model="info.email" @change="markDirty" />
              <span class="toggle-slider"></span>
            </label>
            <label class="toggle-wrap">
              <input type="checkbox" v-model="info.sms" @change="markDirty" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="form-actions" v-if="dirty">
          <button class="btn btn-primary" @click="save" :disabled="saving">
            <i v-if="saving" class="fas fa-spinner fa-spin"></i>
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
          <button class="btn btn-outline" @click="reset" :disabled="saving">Cancel</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { portalNotificationSettingsApi } from '@/api'

const loading = ref(true)
const saving = ref(false)
const error = ref(null)
const saved = ref(false)
const dirty = ref(false)
const settings = ref({})

function markDirty() { dirty.value = true; saved.value = false }

async function loadSettings() {
  loading.value = true
  try {
    const { data } = await portalNotificationSettingsApi.index()
    settings.value = data.settings
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to load settings.'
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  error.value = null
  saved.value = false
  try {
    const payload = {}
    for (const [event, info] of Object.entries(settings.value)) {
      payload[event] = { email: info.email, sms: info.sms }
    }
    await portalNotificationSettingsApi.update({ settings: payload })
    saved.value = true
    dirty.value = false
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to save.'
  } finally {
    saving.value = false
  }
}

function reset() { loadSettings(); dirty.value = false }

onMounted(loadSettings)
</script>

<style scoped>
.portal-notifications { max-width: 700px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
.card-title { font-size: 16px; font-weight: 700; margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
.card-title i { color: #3b82f6; }
.card-desc { font-size: 13px; color: #64748b; margin: 0 0 20px; }

.pref-table { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
.pref-header { display: grid; grid-template-columns: 1fr 80px 80px; padding: 10px 16px; background: #f8fafc; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
.pref-row { display: grid; grid-template-columns: 1fr 80px 80px; padding: 12px 16px; border-top: 1px solid #f1f5f9; align-items: center; }
.pref-event { font-size: 13px; color: #334155; }
.pref-channel { text-align: center; }

.toggle-wrap { position: relative; display: inline-block; width: 36px; height: 20px; margin: 0 auto; }
.toggle-wrap input { opacity: 0; width: 0; height: 0; }
.toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #cbd5e1; border-radius: 20px; transition: 0.2s; }
.toggle-slider::before { content: ''; position: absolute; height: 16px; width: 16px; left: 2px; bottom: 2px; background: #fff; border-radius: 50%; transition: 0.2s; }
.toggle-wrap input:checked + .toggle-slider { background: #3b82f6; }
.toggle-wrap input:checked + .toggle-slider::before { transform: translateX(16px); }

.form-actions { margin-top: 16px; display: flex; gap: 8px; }
.btn { padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
.btn-primary { background: #3b82f6; color: #fff; }
.btn-primary:hover { background: #2563eb; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-outline { background: #fff; color: #334155; border: 1px solid #e2e8f0; }

.alert-error { background: #fef2f2; color: #dc2626; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
.alert-success { background: #f0fdf4; color: #16a34a; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }

.loading-spinner { display: flex; justify-content: center; padding: 40px 20px; }
.spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
