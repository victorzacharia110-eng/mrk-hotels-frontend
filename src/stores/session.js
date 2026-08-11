/**
 * Session store: auto-logs-out an idle or departed user.
 *
 * A five-minute countdown resets on any user activity, shows a warning during
 * the final minute and terminates the session at zero. Hiding or closing the
 * tab ends the session immediately — coming back always requires a sign-in.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import router from "@/router";

// Idle countdown before a session is auto-terminated (5 minutes).
const IDLE_TIMEOUT_SECONDS = 5 * 60;
// Seconds before the deadline at which the expiry warning appears.
const WARNING_AT_SECONDS = 60;
// localStorage key holding the timestamp of the last user activity.
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

// Session store: auto-expires the login after inactivity and on page leave.
export const useSessionStore = defineStore("session", () => {
  const authStore = useAuthStore();

  // Seconds until the session expires.
  const remaining = ref(IDLE_TIMEOUT_SECONDS);
  // Whether the expiry warning is currently visible.
  const showWarning = ref(false);
  // Seconds left, capped to the warning window, for the countdown display.
  const warningSeconds = computed(() => Math.max(0, Math.min(WARNING_AT_SECONDS, remaining.value)));

  // Interval handle for the per-second countdown tick.
  let timer = null;
  // Timestamp of the last localStorage activity write (throttle guard).
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
      localStorage.setItem(LAST_ACTIVE_KEY, String(now));
    }
  }

  /**
   * Any user activity resets the idle countdown and hides the warning.
   */
  function handleActivity() {
    if (!running) return;
    persistActivity();
    remaining.value = IDLE_TIMEOUT_SECONDS;
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
   * Ends the session immediately when the page is hidden.
   */
  function onVisibilityChange() {
    if (!running) return;
    // Leaving the page (switching tab, minimising, closing the window) ends
    // the session immediately — returning requires a fresh sign-in.
    if (document.hidden) {
      terminate();
    }
  }

  /**
   * Clears persisted credentials synchronously when the tab is closed.
   */
  // Closing the tab fires pagehide before unload, but async network calls are
  // not guaranteed to complete — clear the persisted credentials synchronously
  // so the next visit always starts from the login screen.
  function onPageHide() {
    if (!running) return;
    stop();
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth");
    localStorage.removeItem(LAST_ACTIVE_KEY);
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
      localStorage.removeItem("auth_token");
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
    remaining.value = IDLE_TIMEOUT_SECONDS;

    const lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || "0", 10);
    if (lastActive && Date.now() - lastActive > IDLE_TIMEOUT_SECONDS * 1000) {
      // A leftover stamp from a session that never ran its cleanup (e.g. the
      // tab was closed) must not kill a brand new login, so treat it as none.
      localStorage.removeItem(LAST_ACTIVE_KEY);
    }

    lastWrite = Date.now();
    localStorage.setItem(LAST_ACTIVE_KEY, String(lastWrite));
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    timer = setInterval(tick, 1000);
  }

  /**
   * Un-arms the idle timer and removes every listener.
   */
  function stop() {
    running = false;
    localStorage.removeItem(LAST_ACTIVE_KEY);
    ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handleActivity));
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    showWarning.value = false;
  }

  return {
    remaining,
    showWarning,
    warningSeconds,
    start,
    stop,
    // Exposed as `activity` so views can report activity the browser misses.
    activity: handleActivity,
  };
});
