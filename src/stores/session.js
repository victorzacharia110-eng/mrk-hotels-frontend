/**
 * Session store: auto-logs-out an idle user back to the PIN sign-in page.
 *
 * The idle grace period comes from the persisted session settings store and
 * defaults to 15 minutes (per the store-keeper review). The countdown resets
 * on any user activity. Stepping away briefly (switching apps, minimising)
 * no longer kills the session instantly — when the page becomes visible again
 * the elapsed idle time is re-checked against the last-activity stamp, and the
 * session only ends once that grace period has actually been exceeded. Closing
 * the tab ends it because the token lives in sessionStorage.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useSessionSettingsStore } from "@/stores/sessionSettings";
import router from "@/router";

// Seconds before the deadline at which the expiry warning appears.
const WARNING_AT_SECONDS = 60;
// sessionStorage key holding the timestamp of the last user activity. Kept
// per-tab like the token: it survives a refresh and dies with the tab.
const LAST_ACTIVE_KEY = "session_last_active";

// Browser events that count as user activity and reset the idle timer.
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
  "wheel",
];

// Session store: auto-expires the login after inactivity or when the tab hides.
export const useSessionStore = defineStore("session", () => {
  const authStore = useAuthStore();
  const settingsStore = useSessionSettingsStore();

  // Seconds of inactivity before the session terminates (defaults to 15 min).
  const idleTimeoutSeconds = computed(() => settingsStore.idleTimeoutSeconds);

  // Seconds until the session expires.
  const remaining = ref(idleTimeoutSeconds.value);
  // Whether the expiry warning is currently visible.
  const showWarning = ref(false);
  // Seconds left, capped to the warning window, for the countdown display.
  const warningSeconds = computed(() => Math.max(0, Math.min(WARNING_AT_SECONDS, remaining.value)));

  // Interval handle for the per-second countdown tick.
  let timer = null;
  // Timestamp of the last sessionStorage activity write (throttle guard).
  let lastWrite = 0;
  // True once start() has armed the listeners.
  let running = false;
  // Guard so terminate() can't run twice while logging out.
  let terminating = false;

  /**
   * Persists the activity timestamp, throttled to once every 10 seconds.
   */
  function persistActivity() {
    const now = Date.now();
    if (now - lastWrite > 10000) {
      lastWrite = now;
      sessionStorage.setItem(LAST_ACTIVE_KEY, String(now));
    }
  }

  /**
   * Any user activity resets the idle countdown and hides the warning.
   */
  function handleActivity() {
    if (!running) return;
    persistActivity();
    remaining.value = idleTimeoutSeconds.value;
    showWarning.value = false;
  }

  /**
   * One-second countdown step; warns near the deadline and terminates at zero.
   */
  function tick() {
    if (!authStore.isAuthenticated) return;
    remaining.value -= 1;
    if (remaining.value <= WARNING_AT_SECONDS && remaining.value > 0) {
      showWarning.value = true;
    }
    if (remaining.value <= 0) {
      terminate();
    }
  }

  /**
   * Re-checks the idle deadline when the page comes back into view.
   *
   * Switching apps, minimising or changing tabs no longer logs the user out
   * on the spot. The last-activity stamp keeps the true deadline, so on return
   * we only end the sitting if the grace period was really exceeded meanwhile.
   */
  function onVisibilityChange() {
    if (!running) return;
    if (!document.hidden) {
      const lastRaw = sessionStorage.getItem(LAST_ACTIVE_KEY);
      const last = lastRaw ? Number(lastRaw) : 0;
      if (last) {
        const elapsed = Math.floor((Date.now() - last) / 1000);
        if (elapsed >= idleTimeoutSeconds.value) {
          terminate();
          return;
        }
        // The countdown ran while hidden; align it with the elapsed idle time.
        remaining.value = idleTimeoutSeconds.value - elapsed;
      }
    }
  }

  /**
   * Logs out and redirects to the login page.
   * @returns {Promise<void>}
   */
  async function terminate() {
    if (terminating) return;
    terminating = true;
    stop();
    try {
      await authStore.logout();
    } catch {
      // Server logout failed (e.g. offline) — still force local sign-out.
      authStore.$patch({ token: null, user: null, permissions: [], mustChangePassword: false });
      sessionStorage.removeItem("auth_token");
    } finally {
      router.push({ name: "login" });
    }
  }

  /**
   * Arms the idle timer and the activity/visibility listeners.
   */
  function start() {
    if (running) return;
    running = true;
    terminating = false;
    remaining.value = idleTimeoutSeconds.value;

    lastWrite = Date.now();
    sessionStorage.setItem(LAST_ACTIVE_KEY, String(lastWrite));
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);
    timer = setInterval(tick, 1000);
  }

  /**
   * Un-arms the idle timer and removes every listener.
   */
  function stop() {
    running = false;
    sessionStorage.removeItem(LAST_ACTIVE_KEY);
    ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handleActivity));
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    showWarning.value = false;
  }

  return {
    idleTimeoutSeconds,
    remaining,
    showWarning,
    warningSeconds,
    start,
    stop,
    // Exposed as `activity` so views can report activity the browser misses.
    activity: handleActivity,
  };
});
