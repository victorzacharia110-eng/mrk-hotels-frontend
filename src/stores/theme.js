/**
 * Theme store — the panel's light/dark mode, remembered per browser.
 *
 * The choice is a single string applied to <html data-theme="…">, which the
 * dark stylesheet (src/assets/theme.css) keys off. It is stored in localStorage
 * rather than sent to the API because it is a per-screen preference: a manager
 * who prefers a dark back office and a receptionist who prefers light both sign
 * in on the same account and each should keep their own.
 *
 * `resolveStoredTheme()` and `applyTheme()` are exported standalone so the app
 * can paint the stored theme before Vue mounts, which avoids a bright flash of
 * the light theme for someone who chose dark.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";

// localStorage key for the choice.
export const THEME_STORAGE_KEY = "mrk_theme";

// The only two themes the stylesheet knows about.
export const THEMES = ["light", "dark"];

/**
 * Reads the persisted theme, falling back to light.
 * Safe to call before the app mounts and anywhere localStorage is unavailable.
 * @returns {'light'|'dark'}
 */
export function resolveStoredTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch {
    /* private mode / storage disabled — default below */
  }
  return "light";
}

/**
 * Applies a theme to the document root.
 *
 * Sets `data-theme` (what the stylesheet targets) and `color-scheme` (so native
 * controls, scrollbars and form widgets follow), and updates the browser chrome
 * colour on supporting mobile browsers.
 * @param {'light'|'dark'} theme
 */
export function applyTheme(theme) {
  const next = THEMES.includes(theme) ? theme : "light";
  const root = document.documentElement;
  root.dataset.theme = next;
  // `color-scheme` drives the UA-painted surfaces (scrollbars, autofill, the
  // date picker) that CSS cannot reach on its own.
  root.style.colorScheme = next;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", next === "dark" ? "#0b1220" : "#005eb8");
}

export const useThemeStore = defineStore("theme", () => {
  // Read the stored value so the store and the pre-mount paint agree.
  const theme = ref(resolveStoredTheme());

  const isDark = computed(() => theme.value === "dark");

  /**
   * Switches to a specific theme, persists it and applies it immediately.
   * @param {'light'|'dark'} next
   */
  function setTheme(next) {
    theme.value = THEMES.includes(next) ? next : "light";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme.value);
    } catch {
      /* storage full / private mode — the choice just won't persist */
    }
    applyTheme(theme.value);
  }

  /** Flips between light and dark. */
  function toggleTheme() {
    setTheme(isDark.value ? "light" : "dark");
  }

  /** Re-applies the current theme, e.g. after the store is restored. */
  function initTheme() {
    applyTheme(theme.value);
  }

  return { theme, isDark, setTheme, toggleTheme, initTheme };
});
