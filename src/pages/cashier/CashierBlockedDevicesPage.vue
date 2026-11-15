<!--
  CashierBlockedDevicesPage — devices taken out of POS service.
  Lists every blocked terminal with when/who blocked it and lets the cashier
  push a device back into service with one click. Matches the client's
  "Blocked Devices" screen (Device Name list + empty state).
-->

<template>
  <div class="sm-page">
    <div class="toggle-bar">
      <div class="toggle-copy">
        <strong>{{ $t('cashier.devices.toggleLabel') }}</strong>
        <small>{{ enabled ? $t('cashier.devices.onHint') : $t('cashier.devices.offHint') }}</small>
        <small v-if="!canToggle">{{ $t('cashier.devices.managedByManager') }}</small>
      </div>
      <button
        v-if="canToggle"
        type="button"
        class="sm-btn toggle-btn"
        :class="{ ghost: !enabled }"
        :aria-pressed="enabled"
        :disabled="saving || settingsLoading"
        @click="toggleEnabled"
      >
        <i :class="enabled ? 'fas fa-toggle-on' : 'fas fa-toggle-off'" aria-hidden="true"></i>
        {{ saving ? $t('common.saving') : (enabled ? $t('cashier.devices.on') : $t('cashier.devices.off')) }}
      </button>
      <span v-else class="toggle-state" :class="{ on: enabled }">
        {{ enabled ? $t('cashier.devices.on') : $t('cashier.devices.off') }}
      </span>
    </div>

    <section v-if="enabled" class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-shield-halved" aria-hidden="true"></i> {{ $t('cashier.devices.title') }}</h2>
        <span class="muted">{{ $t('cashier.devices.records', { n: meta.total }) }}</span>
      </div>

      <div class="table-scroll">
        <SkeletonLoader v-if="loading" variant="table" :count="5" :cols="4" />
        <table v-else class="sm-table">
          <thead>
            <tr>
              <th>{{ $t('cashier.devices.deviceName') }}</th>
              <th>{{ $t('cashier.devices.blockedAt') }}</th>
              <th>{{ $t('cashier.devices.blockedBy') }}</th>
              <th class="right">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="device in devices" :key="device.id">
              <td><strong>{{ device.device_name }}</strong></td>
              <td>{{ fmtTime(device.blocked_at) }}</td>
              <td>{{ device.blocker?.full_name || '—' }}</td>
              <td class="right">
                <button class="sm-btn ghost" :disabled="busy === device.id" @click="unblock(device)">
                  <i class="fas fa-rotate-left" aria-hidden="true"></i> {{ busy === device.id ? $t('common.saving') : $t('cashier.devices.unblock') }}
                </button>
              </td>
            </tr>
            <tr v-if="!devices.length && !loading">
              <td colspan="4" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.devices.noData') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="meta.total > meta.per_page" class="pagination">
        <button class="btn btn-sm btn-secondary" :disabled="meta.current_page <= 1" @click="goPage(meta.current_page - 1)">
          {{ $t('common.previous') }}
        </button>
        <span class="muted">{{ $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page }) }}</span>
        <button class="btn btn-sm btn-secondary" :disabled="meta.current_page >= meta.last_page" @click="goPage(meta.current_page + 1)">
          {{ $t('common.next') }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { hotelSettingsApi, posApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import '@/pages/store/store-shared.css'

const { t } = useI18n()
const authStore = useAuthStore()

const canToggle = computed(() => ['hotel_admin', 'manager'].includes(authStore.user?.user_role))
const enabled = ref(false)
const settingsLoading = ref(true)
const saving = ref(false)
const devices = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 25 })
const loading = ref(false)
const busy = ref(null)

async function loadSettings() {
  settingsLoading.value = true
  try {
    const { data } = await hotelSettingsApi.show()
    enabled.value = !!data.hotel?.blocked_devices_enabled
    if (enabled.value) load()
  } catch {
    enabled.value = false
  } finally {
    settingsLoading.value = false
  }
}

async function toggleEnabled() {
  if (!canToggle.value || saving.value) return
  saving.value = true
  const next = !enabled.value
  try {
    await hotelSettingsApi.update({ blocked_devices_enabled: next })
    enabled.value = next
    if (next) load()
  } catch (e) {
    window.alert(e.response?.data?.message || t('common.actionFailed'))
  } finally {
    saving.value = false
  }
}

async function load() {
  loading.value = true
  try {
    const { data } = await posApi.devices({ status: 'blocked', per_page: meta.value.per_page, page: meta.value.current_page })
    devices.value = data.data || []
    meta.value = {
      current_page: data.current_page,
      last_page: data.last_page,
      total: data.total,
      per_page: data.per_page,
    }
  } finally {
    loading.value = false
  }
}

function goPage(page) {
  meta.value.current_page = page
  load()
}

async function unblock(device) {
  busy.value = device.id
  try {
    await posApi.unblockDevice(device.id)
    devices.value = devices.value.filter((d) => d.id !== device.id)
    meta.value.total = Math.max(0, meta.value.total - 1)
  } catch {
    window.alert(t('common.actionFailed'))
  } finally {
    busy.value = null
  }
}

function fmtTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

onMounted(loadSettings)
</script>

<style scoped>
.muted { font-size: 12px; color: #64748b; }
.right { text-align: right; }
.table-scroll { overflow-x: auto; }
.pagination { padding: 12px 16px; border-top: 1px solid #e2e8f0; }
.toggle-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 12px 16px; margin-bottom: 12px; background: #fff;
  border: 1px solid #e2e8f0; border-radius: 10px;
}
.toggle-copy strong { display: block; font-size: 14px; color: #1e293b; }
.toggle-copy small { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }
.toggle-btn { min-width: 96px; justify-content: center; }
.toggle-state {
  flex: none; min-width: 72px; padding: 7px 12px; border-radius: 8px;
  background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 800;
  text-align: center; letter-spacing: 0.04em;
}
.toggle-state.on { background: #e8f1fa; color: var(--mrk-blue-deep, #00468c); }
</style>