/**
 * Application entry point.
 *
 * Builds the root Vue app, registers Pinia (with persisted state), the router
 * and vue-i18n, then mounts on #app. Global styles (Font Awesome + base.css)
 * are imported here so every page shares them.
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import '@fortawesome/fontawesome-free/css/all.min.css'
import './assets/base.css'
import './assets/skeleton.css'
import './assets/theme.css'

import App from './App.vue'
import router from './router'
import i18n from './locales/i18n'
import { initA11y } from './utils/a11y'
import './utils/toast'
import { primeNotificationAudio } from './utils/notificationTone'
import { applyTheme, resolveStoredTheme } from './stores/theme'
import { watchForUpdates } from './utils/versionCheck'
import { printerState } from './utils/printer'

// Paint the remembered theme before the first render, so a dark-mode user does
// not see a flash of the light theme while the app boots.
applyTheme(resolveStoredTheme())

// Root Vue application instance.
const app = createApp(App)

// Pinia store registry with persistence enabled for chosen state.
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)
app.use(i18n)

// Mount the app into the #app element from index.html.
app.mount('#app')

// Global accessibility behaviours (modal focus trap, Escape-to-close, ARIA
// dialog semantics). Runs after mount so the initial DOM exists.
initA11y()
// One-time audio unlock so in-app ringtones can play after the first tap.
primeNotificationAudio()

// Reload the tab when a newer deploy lands, so no till keeps running a stale
// bundle (a stale bundle is what makes QZ Tray show the wrong certificate).
// Never reload while a print job is in flight.
watchForUpdates({ isSafeToReload: () => !printerState.printing })
