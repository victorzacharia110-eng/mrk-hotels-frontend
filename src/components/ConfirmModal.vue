<!--
  ConfirmModal — Reusable animated confirmation dialog with Confirm/Cancel
  actions, used in place of native window.confirm alerts.

  Props:
    show       — Boolean controlling visibility.
    title      — Modal heading.
    body       — Descriptive text or a renderable string (supports {name}).
    error      — Optional error message shown inside the dialog after a failed action.
    success    — Optional success heading. Replaces the body and actions with a
                 centred success state; the caller decides when to close it.
    confirmLabel — Optional override for the confirm button text.
    cancelLabel  — Optional override for the cancel button text.
    danger     — Renders the confirm button with a destructive style.
    busy       — Disables the confirm button while an async action runs.
    autoCloseMs — Optional. Milliseconds before the dialog dismisses itself.
                  0 (default) disables it, so dialogs that guard a destructive
                  or financial action keep waiting for a deliberate answer.
    type       — 'danger' | 'info' (controls the icon accent).
  Events:
    confirm    — Emitted when the user confirms.
    cancel     — Emitted when the user cancels or closes.
-->
<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="confirm-modal-overlay" @click.self="onCancel">
        <div class="confirm-modal" role="dialog" aria-modal="true" :aria-labelledby="headingId">
          <div class="confirm-modal-head" :class="headClass">
            <span class="confirm-modal-icon" aria-hidden="true">
              <i :class="iconClass"></i>
            </span>
            <h2 :id="headingId" class="confirm-modal-title">{{ title }}</h2>
            <button class="confirm-modal-close" @click="onCancel" :aria-label="cancelLabelText">
              <i class="fas fa-xmark"></i>
            </button>
          </div>
          <div v-if="success" class="confirm-modal-body confirm-modal-body--success">
            <div class="confirm-modal-success" role="status" aria-live="polite">
              <span class="confirm-modal-success-icon" aria-hidden="true">
                <i class="fas fa-check"></i>
              </span>
              <h3>{{ success }}</h3>
              <p v-if="body">{{ body }}</p>
            </div>
          </div>
          <div v-else class="confirm-modal-body">
            <p class="confirm-modal-message">{{ body }}</p>
            <div v-if="error" class="confirm-modal-error" role="alert">
              <i class="fas fa-circle-exclamation" aria-hidden="true"></i>
              <span>{{ error }}</span>
            </div>
            <p v-if="remaining !== null" class="confirm-modal-hint">{{ t('common.autoClosesIn', { seconds: remaining }) }}</p>
          </div>
          <div v-if="!success" class="confirm-modal-foot">
            <button class="btn btn-secondary" @click="onCancel" :disabled="busy">{{ cancelLabelText }}</button>
            <button class="btn" :class="danger ? 'btn-danger' : 'btn-primary'" @click="$emit('confirm')" :disabled="busy">
              <i v-if="busy" class="fas fa-spinner fa-spin"></i>
              <i v-else :class="confirmIcon"></i>
              {{ confirmLabelText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  body: { type: String, default: '' },
  error: { type: String, default: '' },
  success: { type: String, default: '' },
  confirmLabel: { type: String, default: '' },
  cancelLabel: { type: String, default: '' },
  danger: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  autoCloseMs: { type: Number, default: 0 },
})

const emit = defineEmits(['confirm', 'cancel'])
const { t } = useI18n()

const headingId = computed(() => `confirm-modal-${Math.random().toString(36).slice(2, 8)}`)

const confirmLabelText = computed(() => props.confirmLabel || t('common.confirm'))
const cancelLabelText = computed(() => props.cancelLabel || t('common.cancel'))

const headClass = computed(() => {
  if (props.success) return 'confirm-modal-head--success'
  return props.danger ? 'confirm-modal-head--danger' : 'confirm-modal-head--info'
})

const iconClass = computed(() => {
  if (props.success) return 'fas fa-check'
  return props.danger ? 'fas fa-triangle-exclamation' : 'fas fa-circle-question'
})

const confirmIcon = computed(() => (props.danger ? 'fas fa-trash' : 'fas fa-check'))

function onCancel() {
  if (props.busy) return
  emit('cancel')
}

/*
  Opt-in self-dismissal.

  Only ever armed when `autoCloseMs` is set, so the delete and payment dialogs
  that use this component are unaffected: dismissing a confirmation without
  answering it is fine, but it must never happen to a dialog nobody opted into.

  Two rules keep it honest. The timer is stopped while `busy`, so a dialog can
  never vanish out from under a request that is already running. And it restarts
  from the top each time the dialog opens rather than resuming a stale one.
*/
const remaining = ref(null)
let ticker = null

function stopTicker() {
  if (ticker) clearInterval(ticker)
  ticker = null
  remaining.value = null
}

function startTicker() {
  stopTicker()
  if (!props.autoCloseMs || props.busy || props.success) return

  let left = Math.ceil(props.autoCloseMs / 1000)
  remaining.value = left
  ticker = setInterval(() => {
    left -= 1
    if (left <= 0) {
      stopTicker()
      onCancel()
      return
    }
    remaining.value = left
  }, 1000)
}

watch(
  () => [props.show, props.autoCloseMs, props.busy, props.success],
  ([show]) => {
    if (show && !props.busy) startTicker()
    else stopTicker()
  },
  { immediate: true },
)

onBeforeUnmount(stopTicker)
</script>

<style scoped>
.confirm-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
}

.confirm-modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.confirm-modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.confirm-modal-head--info {
  background: linear-gradient(135deg, #e0e7ff, #a5b4fc);
}

.confirm-modal-head--danger {
  background: linear-gradient(135deg, #fee2e2, #fca5a5);
}

.confirm-modal-icon {
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

.confirm-modal-head--info .confirm-modal-icon { background: #6366f1; }
.confirm-modal-head--danger .confirm-modal-icon { background: #dc2626; }
.confirm-modal-head--success { background: linear-gradient(135deg, #dcfce7, #86efac); }
.confirm-modal-head--success .confirm-modal-icon { background: #16a34a; }

.confirm-modal-title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.confirm-modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.confirm-modal-close:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #1e293b;
}

.confirm-modal-body {
  padding: 20px;
}

.confirm-modal-message {
  margin: 0;
  font-size: 14px;
  color: #334155;
  line-height: 1.5;
}

.confirm-modal-body--success { padding: 28px 24px; }
.confirm-modal-success {
  min-height: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}
.confirm-modal-success-icon {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #dcfce7;
  color: #16a34a;
  font-size: 32px;
  animation: confirm-success-pop 0.35s ease;
}
.confirm-modal-success h3 {
  margin: 0;
  font-size: 22px;
  color: #166534;
}
.confirm-modal-success p {
  margin: 0;
  max-width: 320px;
  font-size: 14px;
  color: #475569;
  line-height: 1.5;
}
@keyframes confirm-success-pop {
  from { transform: scale(0.7); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.confirm-modal-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 14px 0 0;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 13px;
  line-height: 1.5;
}

.confirm-modal-error i {
  margin-top: 2px;
  color: #dc2626;
}

.confirm-modal-hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: #64748b;
}

.confirm-modal-foot {
  padding: 12px 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-modal-foot .btn {
  min-width: 96px;
}

/* Transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-active .confirm-modal,
.modal-fade-leave-active .confirm-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .confirm-modal {
  transform: scale(0.95) translateY(10px);
}

.modal-fade-leave-to .confirm-modal {
  transform: scale(0.95) translateY(-10px);
}
</style>
