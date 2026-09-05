/**
 * Session settings store — front-desk auto sign-out behaviour.
 *
 * The staff panel returns to the PIN sign-in page after a period of inactivity.
 * The reviewer asked for that grace period to be set to 15 minutes instead of
 * the old aggressive 5-minute (and immediate tab-hide) auto logout, stored as
 * a per-browser setting so a manager can raise/lower it.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";

// localStorage key for the whole settings blob.
const STORAGE_KEY = "mrk_session_settings";

const DEFAULTS = {
  // Minutes of inactivity before the session ends and the user must sign in
  // again with their PIN.
  idleTimeoutMinutes: 15,
};

function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed && typeof parsed === "object") {
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    /* corrupted storage — fall back to defaults */
  }
  return { ...DEFAULTS };
}

function clamp(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n)) return DEFAULTS.idleTimeoutMinutes;
  return Math.min(120, Math.max(1, Math.round(n)));
}

export const useSessionSettingsStore = defineStore("sessionSettings", () => {
  const settings = ref(loadSaved());

  const idleTimeoutMinutes = computed(() => clamp(settings.value.idleTimeoutMinutes));

  /** Seconds of inactivity before the session auto-terminates. */
  const idleTimeoutSeconds = computed(() => idleTimeoutMinutes.value * 60);

  function saveSettings(next) {
    const cleaned = { ...next };
    if (cleaned.idleTimeoutMinutes !== undefined) {
      cleaned.idleTimeoutMinutes = clamp(cleaned.idleTimeoutMinutes);
    }
    settings.value = { ...settings.value, ...cleaned };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value));
    } catch {
      /* storage full / private mode — the setting just won't persist */
    }
  }

  function reset() {
    settings.value = { ...DEFAULTS };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return {
    settings,
    idleTimeoutMinutes,
    idleTimeoutSeconds,
    saveSettings,
    reset,
  };
});