<!--
  AlertModal — Reusable dashboard alert modal for payment confirmations,
  approval requests, and other urgent notifications.

  Props:
    show     — Boolean controlling visibility.
    title    — Modal heading.
    body     — Descriptive text.
    details  — Array of { label, value } pairs to display.
    timestamp — ISO datetime string for when the alert was created.
    type     — 'payment' | 'approval' | 'info' (controls icon/color).
  Events:
    dismiss  — Emitted when the user clicks "Got it" or the close button.
-->
<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="alert-modal-overlay" @click.self="$emit('dismiss')">
        <div class="alert-modal" role="dialog" aria-modal="true" :aria-labelledby="headingId">
          <div class="alert-modal-head" :class="`alert-modal-head--${type}`">
            <span class="alert-modal-icon" aria-hidden="true">
              <i :class="iconClass"></i>
            </span>
            <h2 :id="headingId" class="alert-modal-title">{{ title }}</h2>
            <button class="alert-modal-close" @click="$emit('dismiss')" :aria-label="$t('common.close')">
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div class="alert-modal-body">
            <p class="alert-modal-message">{{ body }}</p>
            <div v-if="details && details.length" class="alert-modal-details">
              <div v-for="(d, i) in details" :key="i" class="alert-modal-detail-row">
                <span class="alert-modal-detail-label">{{ d.label }}</span>
                <span class="alert-modal-detail-value">{{ d.value }}</span>
              </div>
            </div>
            <p v-if="timestamp" class="alert-modal-time">
              <i class="fas fa-clock" aria-hidden="true"></i>
              {{ formatTime(timestamp) }}
            </p>
          </div>
          <div class="alert-modal-foot">
            <button class="btn btn-primary" @click="$emit('dismiss')">
              {{ $t('common.gotIt') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  body: { type: String, default: '' },
  details: { type: Array, default: () => [] },
  timestamp: { type: String, default: '' },
  type: { type: String, default: 'info' },
})

defineEmits(['dismiss'])

const headingId = computed(() => `alert-modal-${Math.random().toString(36).slice(2, 8)}`)

const iconClass = computed(() => {
  switch (props.type) {
    case 'payment': return 'fas fa-money-bill-wave'
    case 'approval': return 'fas fa-clipboard-check'
    case 'reservation': return 'fas fa-calendar-check'
    default: return 'fas fa-bell'
  }
})

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.alert-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.alert-modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.alert-modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.alert-modal-head--payment {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
}

.alert-modal-head--approval {
  background: linear-gradient(135deg, #dbeafe, #93c5fd);
}

.alert-modal-head--reservation {
  background: linear-gradient(135deg, #d1fae5, #6ee7b7);
}

.alert-modal-head--info {
  background: linear-gradient(135deg, #e0e7ff, #a5b4fc);
}

.alert-modal-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
  background: rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.alert-modal-head--payment .alert-modal-icon { background: #f59e0b; }
.alert-modal-head--approval .alert-modal-icon { background: #3b82f6; }
.alert-modal-head--reservation .alert-modal-icon { background: #10b981; }
.alert-modal-head--info .alert-modal-icon { background: #6366f1; }

.alert-modal-title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.alert-modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.alert-modal-close:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #1e293b;
}

.alert-modal-body {
  padding: 20px;
}

.alert-modal-message {
  margin: 0 0 16px;
  font-size: 14px;
  color: #334155;
  line-height: 1.5;
}

.alert-modal-details {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.alert-modal-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.alert-modal-detail-row + .alert-modal-detail-row {
  border-top: 1px solid #e2e8f0;
}

.alert-modal-detail-label {
  font-size: 13px;
  color: #64748b;
}

.alert-modal-detail-value {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.alert-modal-time {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 4px;
}

.alert-modal-foot {
  padding: 12px 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

/* Transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-active .alert-modal,
.modal-fade-leave-active .alert-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .alert-modal {
  transform: scale(0.95) translateY(10px);
}

.modal-fade-leave-to .alert-modal {
  transform: scale(0.95) translateY(-10px);
}
</style>
