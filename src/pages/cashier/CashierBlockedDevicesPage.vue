<!--
  CashierBlockedDevicesPage — devices taken out of POS service.
  Lists every blocked terminal with when/who blocked it and lets the cashier
  push a device back into service with one click. Matches the client's
  "Blocked Devices" screen (Device Name list + empty state).
-->

<template>
  <div class="sm-page">
    <section class="panel">
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
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { posApi } from '@/api'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import '@/pages/store/store-shared.css'

const { t } = useI18n()

const devices = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 25 })
const loading = ref(false)
const busy = ref(null)

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

onMounted(load)
</script>

<style scoped>
.muted { font-size: 12px; color: #64748b; }
.right { text-align: right; }
.table-scroll { overflow-x: auto; }
.pagination { padding: 12px 16px; border-top: 1px solid #e2e8f0; }
</style>