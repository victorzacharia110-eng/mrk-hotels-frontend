<!--
  TrustedDevicesPage (route: /app/settings/trusted-devices).

  Lets hotel admins see every terminal/computer that is allowed to sign in
  with a 4-digit PIN and revoke the ones they no longer recognise. Revoking
  forces that device back through email + password + property code on its
  next sign-in.

  Access mirrors the backend: level:60 routes that additionally accept only
  hotel_admin / manager / owner roles.
-->

<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1><i class="fas fa-mobile-screen-button" aria-hidden="true"></i> {{ $t('trustedDevices.title') }}</h1>
        <p class="muted">{{ $t('trustedDevices.hint') }}</p>
      </div>
      <button class="btn btn-secondary" :disabled="loading" @click="load">
        <i class="fas fa-rotate" aria-hidden="true"></i> {{ $t('common.refresh') }}
      </button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="!canManage" class="alert alert-warning">{{ $t('trustedDevices.forbidden') }}</div>

    <div class="card">
      <div class="table-scroll">
        <SkeletonLoader v-if="loading" variant="table" :count="4" :cols="5" />
        <table v-else class="sm-table">
          <thead>
            <tr>
              <th>{{ $t('trustedDevices.device') }}</th>
              <th>{{ $t('trustedDevices.trustedUntil') }}</th>
              <th>{{ $t('trustedDevices.lastSeen') }}</th>
              <th>{{ $t('trustedDevices.status') }}</th>
              <th class="right">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="device in devices" :key="device.id">
              <td>
                <strong>{{ device.label || $t('trustedDevices.unknownDevice') }}</strong>
                <div class="muted">{{ fmtTime(device.created_at) }}</div>
              </td>
              <td>{{ fmtTime(device.trusted_until) }}</td>
              <td>{{ fmtTime(device.last_seen_at) }}</td>
              <td>
                <span v-if="device.is_locked" class="badge badge-danger">{{ $t('trustedDevices.locked') }}</span>
                <span v-else-if="device.is_expired" class="badge badge-warning">{{ $t('trustedDevices.expired') }}</span>
                <span v-else class="badge badge-success">{{ $t('trustedDevices.trusted') }}</span>
              </td>
              <td class="right">
                <button class="btn btn-sm btn-danger" :disabled="busy === device.id" @click="revoke(device)">
                  <i class="fas fa-ban" aria-hidden="true"></i>
                  {{ busy === device.id ? $t('common.saving') : $t('trustedDevices.revoke') }}
                </button>
              </td>
            </tr>
            <tr v-if="!devices.length && !loading">
              <td colspan="5" class="empty">
                <i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('trustedDevices.empty') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { deviceTrustApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const { t } = useI18n()
const authStore = useAuthStore()

const devices = ref([])
const loading = ref(false)
const busy = ref(null)
const error = ref('')
const success = ref('')

// Mirrors the backend role check on /auth/trusted-devices (level:60 + roles).
const canManage = computed(() => authStore.can?.(60) && ['hotel_admin', 'manager', 'owner'].includes(authStore.user?.user_role))

async function load() {
  if (!canManage.value) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await deviceTrustApi.list()
    devices.value = data.devices || []
  } catch (e) {
    error.value = e.response?.data?.message || t('common.actionFailed')
  } finally {
    loading.value = false
  }
}

async function revoke(device) {
  if (!window.confirm(t('trustedDevices.revokeConfirm', { device: device.label || t('trustedDevices.unknownDevice') }))) return
  busy.value = device.id
  error.value = ''
  success.value = ''
  try {
    const { data } = await deviceTrustApi.revoke(device.id)
    success.value = data.message || t('trustedDevices.revoked')
    devices.value = devices.value.filter((d) => d.id !== device.id)
  } catch (e) {
    error.value = e.response?.data?.message || t('common.actionFailed')
  } finally {
    busy.value = null
  }
}

function fmtTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

onMounted(load)
</script>

<style scoped>
.muted { font-size: 12px; color: #64748b; }
.right { text-align: right; }
.table-scroll { overflow-x: auto; }
.empty { text-align: center; color: #64748b; padding: 24px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.badge-success { background: #dcfce7; color: #166534; }
.badge-warning { background: #fef9c3; color: #854d0e; }
.badge-danger { background: #fee2e2; color: #991b1b; }
</style>
