<template>
  <Teleport to="body">
    <Transition name="superadmin-result-fade">
      <div v-if="state.show" class="superadmin-result-overlay" @click.self="closeResult">
        <div class="superadmin-result-modal" :class="`superadmin-result-modal--${state.type}`" role="alertdialog"
          aria-modal="true" aria-live="polite">
          <div class="superadmin-result-icon" aria-hidden="true">
            <i :class="state.type === 'error' ? 'fas fa-circle-exclamation' : 'fas fa-check'"></i>
          </div>
          <h2 class="superadmin-result-title">{{ state.title || defaultTitle }}</h2>
          <p class="superadmin-result-message">{{ state.message }}</p>
          <button type="button" class="btn btn-primary" @click="closeResult">
            {{ t('common.gotIt') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSuperadminResult } from '@/composables/useSuperadminResult'

const { t } = useI18n()
const { state, closeResult } = useSuperadminResult()
const defaultTitle = computed(() => (
  state.type === 'error'
    ? t('superadmin.actionFailed')
    : t('superadmin.actionSuccess')
))
</script>

<style scoped>
.superadmin-result-overlay {
  position: fixed;
  inset: 0;
  z-index: 10020;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.56);
}

.superadmin-result-modal {
  width: 100%;
  max-width: 420px;
  padding: 28px 24px 22px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.32);
  text-align: center;
}

.superadmin-result-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  animation: superadmin-result-pop 0.3s ease;
}

.superadmin-result-modal--success .superadmin-result-icon {
  background: #dcfce7;
  color: #15803d;
}

.superadmin-result-modal--error .superadmin-result-icon {
  background: #fee2e2;
  color: #b91c1c;
}

.superadmin-result-title {
  margin: 0 0 8px;
  font-size: 20px;
  color: #0f172a;
}

.superadmin-result-message {
  margin: 0 0 22px;
  font-size: 14px;
  line-height: 1.55;
  color: #475569;
  white-space: pre-line;
}

.superadmin-result-modal--error .superadmin-result-title {
  color: #991b1b;
}

.superadmin-result-modal--success .superadmin-result-title {
  color: #166534;
}

html[data-theme='dark'] .superadmin-result-modal {
  background: #1e293b;
}

html[data-theme='dark'] .superadmin-result-title {
  color: #e2e8f0;
}

html[data-theme='dark'] .superadmin-result-message {
  color: #cbd5e1;
}

html[data-theme='dark'] .superadmin-result-modal--error .superadmin-result-title {
  color: #fca5a5;
}

html[data-theme='dark'] .superadmin-result-modal--success .superadmin-result-title {
  color: #86efac;
}

@keyframes superadmin-result-pop {
  from {
    transform: scale(0.7);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

.superadmin-result-fade-enter-active,
.superadmin-result-fade-leave-active {
  transition: opacity 0.2s ease;
}

.superadmin-result-fade-enter-active .superadmin-result-modal,
.superadmin-result-fade-leave-active .superadmin-result-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.superadmin-result-fade-enter-from,
.superadmin-result-fade-leave-to {
  opacity: 0;
}

.superadmin-result-fade-enter-from .superadmin-result-modal,
.superadmin-result-fade-leave-to .superadmin-result-modal {
  transform: scale(0.95) translateY(10px);
}
</style>
