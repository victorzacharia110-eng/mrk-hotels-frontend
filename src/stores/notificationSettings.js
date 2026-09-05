import { defineStore } from 'pinia'
import { ref } from 'vue'
import { normalizeAlertSettings, playReadyTone, READY_SOUNDS } from '@/utils/notificationTone'

/**
 * Per-device alert preferences for in-app sounds (e.g. the kitchen "order
 * ready" ringtone). Stored in localStorage like the other settings stores, so
 * every staff member tunes their own phone. Default: ringtone + vibration on.
 */
export const useNotificationSettingsStore = defineStore('notificationSettings', () => {
  const STORAGE_KEY = 'mrk_notification_settings'
  const RING_TTL_MS = 3 * 60 * 1000

  const settings = ref(normalizeAlertSettings(null))
  const sounds = READY_SOUNDS
  // Dedupe set of already-rung item keys (WebSocket + 30s poll can both fire
  // for the same item) with a rolling TTL.
  const recentRings = new Map() // key -> timestamp

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      settings.value = normalizeAlertSettings(raw ? JSON.parse(raw) : null)
    } catch {
      settings.value = normalizeAlertSettings(null)
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    } catch {
      /* Ignore storage failures. */
    }
  }

  function update(partial) {
    settings.value = normalizeAlertSettings({ ...settings.value, ...partial })
    save()
  }

  function pruneRings() {
    const now = Date.now()
    for (const [key, at] of recentRings) {
      if (now - at > RING_TTL_MS) recentRings.delete(key)
    }
  }

  /** Rings (once per item) when a kitchen-ready alert arrives. */
  function ring(key) {
    if (!settings.value.enabled) return
    if (key) {
      pruneRings()
      if (recentRings.has(key)) return
      recentRings.set(key, Date.now())
    }
    playReadyTone(settings.value)
  }

  function test() {
    playReadyTone(settings.value)
  }

  return { settings, sounds, load, save, update, ring, test }
})