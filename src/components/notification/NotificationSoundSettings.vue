<template>
  <div class="nss">
    <div class="nss-row">
      <label class="nss-toggle">
        <input type="checkbox" v-model="enabled" @change="update({ enabled })" />
        <span>{{ $t('notificationSound.enabled') }}</span>
      </label>
    </div>

    <div class="nss-row">
      <label class="nss-field">
        <span class="nss-label">{{ $t('notificationSound.ringtone') }}</span>
        <select v-model="sound" class="nss-select" :disabled="!enabled" @change="update({ sound })">
          <option v-for="s in sounds" :key="s.id" :value="s.id">
            {{ $t(`notificationSound.${s.id}`) }}
          </option>
        </select>
      </label>
    </div>

    <div class="nss-row">
      <label class="nss-toggle">
        <input type="checkbox" v-model="vibration" :disabled="!enabled" @change="update({ vibration })" />
        <span>{{ $t('notificationSound.vibration') }}</span>
      </label>
    </div>

    <button type="button" class="nss-test" :disabled="!enabled" @click="test">
      <i class="fas fa-volume-up"></i> {{ $t('notificationSound.test') }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useNotificationSettingsStore } from '@/stores/notificationSettings'

const store = useNotificationSettingsStore()

const sounds = computed(() => store.sounds)
const enabled = computed({
  get: () => store.settings.enabled,
  set: (v) => store.update({ enabled: v }),
})
const sound = computed({
  get: () => store.settings.sound,
  set: (v) => store.update({ sound: v }),
})
const vibration = computed({
  get: () => store.settings.vibration,
  set: (v) => store.update({ vibration: v }),
})

function update(partial) {
  store.update(partial)
}
function test() {
  store.test()
}
</script>

<style scoped>
.nss { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
.nss-row { display: flex; align-items: center; }
.nss-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; cursor: pointer; }
.nss-toggle input { width: 16px; height: 16px; accent-color: #3b82f6; cursor: pointer; }
.nss-field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.nss-label { font-size: 12px; color: #64748b; }
.nss-select { width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; color: #334155; background: #fff; }
.nss-test { align-self: flex-start; padding: 6px 12px; border: none; border-radius: 6px; background: #3b82f6; color: #fff; font-size: 12px; cursor: pointer; }
.nss-test:disabled { background: #cbd5e1; cursor: not-allowed; }
</style>