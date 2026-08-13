/**
 * Session store: auto-logs-out an idle or departed user.
 *
 * A five-minute countdown resets on any user activity, shows a warning during
 * the final minute and terminates the session at zero. Hiding the tab
 * (switching away or minimising) ends the session immediately; closing the
 * tab ends it because the token lives in sessionStorage. A refresh keeps the
 * session and restarts the idle countdown — browsers hand reloads a fresh
 * sessionStorage, so the idle deadline cannot be carried across them.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import router from "@/router";

// Idle countdown before a session is auto-terminated (5 minutes).
const IDLE_TIMEOUT_SECONDS = 5 * 60;
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

  // Seconds until the session expires.
  const remaining = ref(IDLE_TIMEOUT_SECONDS);
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
    // Hiding the page (switching tab, minimising the window) ends the session
    // immediately — returning requires a fresh sign-in. A refresh does not
    // hide the page, and a closed tab loses the sessionStorage token anyway,
    // so no pagehide handler is needed for those cases.
    if (document.hidden) {
      terminate();
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
    remaining.value = IDLE_TIMEOUT_SECONDS;

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
    remaining,
    showWarning,
    warningSeconds,
    start,
    stop,
    // Exposed as `activity` so views can report activity the browser misses.
    activity: handleActivity,
  };
});
