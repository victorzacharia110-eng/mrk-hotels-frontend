<!--
  IntegrationStatusCell.vue — Renders connection status for a single integration
  (Booking.com or QuickBooks) inside the superadmin integration dashboard table.
-->
<template>
  <div class="int-cell" :class="`int-cell--${statusColor}`">
    <div class="int-cell-top">
      <span class="int-status-dot"></span>
      <span class="int-status-text">{{ statusText }}</span>
    </div>
    <div v-if="data.company_name || data.organisation_name || data.hotel_id" class="int-detail">
      {{ data.company_name || data.organisation_name || data.hotel_id }}
    </div>
    <div v-if="data.last_sync_at" class="int-detail">
      Last sync: {{ formatTime(data.last_sync_at) }}
    </div>
    <div v-if="data.last_error" class="int-error">
      <i class="fas fa-exclamation-circle"></i> {{ data.last_error }}
    </div>
    <div v-if="data.token_expired" class="int-warning">
      <i class="fas fa-clock"></i> Token expired
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Object, required: true },
  name: { type: String, required: true },
})

const statusColor = computed(() => {
  if (props.data.last_error) return 'error'
  if (props.data.token_expired) return 'warning'
  if (props.data.connected) return 'connected'
  if (props.data.configured) return 'configured'
  return 'none'
})

const statusText = computed(() => {
  if (props.data.last_error) return 'Error'
  if (props.data.token_expired) return 'Token Expired'
  if (props.data.connected) return 'Connected'
  if (props.data.configured) return 'Configured (Off)'
  return 'Not Connected'
})

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.int-cell { font-size: 12px; }
.int-cell-top { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.int-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.int-cell--connected .int-status-dot { background: #10b981; }
.int-cell--connected .int-status-text { color: #059669; font-weight: 600; }
.int-cell--configured .int-status-dot { background: #f59e0b; }
.int-cell--configured .int-status-text { color: #d97706; font-weight: 500; }
.int-cell--error .int-status-dot { background: #ef4444; }
.int-cell--error .int-status-text { color: #dc2626; font-weight: 600; }
.int-cell--warning .int-status-dot { background: #f59e0b; }
.int-cell--warning .int-status-text { color: #d97706; font-weight: 500; }
.int-cell--none .int-status-dot { background: #e2e8f0; }
.int-cell--none .int-status-text { color: #94a3b8; }
.int-detail { color: #64748b; margin-top: 2px; font-size: 11px; }
.int-error { color: #dc2626; margin-top: 4px; font-size: 11px; }
.int-warning { color: #d97706; margin-top: 4px; font-size: 11px; }
</style>
