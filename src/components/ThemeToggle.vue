<!--
  ThemeToggle — the shared light/dark switch for the panels that do not use
  StoreLayout's profile menu (cashier/bartender, store manager, superadmin,
  owner). It reads the one theme store, so every panel flips the same value and
  the choice is remembered for the browser. The label hides on narrow screens,
  leaving just the sun/moon icon.
-->
<template>
  <button
    type="button"
    class="theme-toggle-btn"
    :aria-pressed="themeStore.isDark"
    :title="themeStore.isDark ? $t('topBar.lightMode') : $t('topBar.darkMode')"
    @click="themeStore.toggleTheme()"
  >
    <i :class="themeStore.isDark ? 'fas fa-sun' : 'fas fa-moon'" aria-hidden="true"></i>
    <span class="theme-toggle-label">{{ themeStore.isDark ? $t('topBar.lightMode') : $t('topBar.darkMode') }}</span>
  </button>
</template>

<script setup>
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
</script>

<style scoped>
.theme-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.theme-toggle-btn i { font-size: 14px; }
.theme-toggle-btn:hover {
  border-color: var(--mrk-blue, #005eb8);
  color: var(--mrk-blue, #005eb8);
}
html[data-theme='dark'] .theme-toggle-btn {
  color: #e9edef;
  border-color: rgba(148, 163, 184, 0.35);
}
html[data-theme='dark'] .theme-toggle-btn:hover {
  color: #7cc0ff;
  border-color: #7cc0ff;
}
@media (max-width: 640px) {
  .theme-toggle-btn { width: 36px; padding: 0; justify-content: center; }
  .theme-toggle-label { display: none; }
}
</style>
