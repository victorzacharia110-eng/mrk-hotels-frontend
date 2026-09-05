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

import App from './App.vue'
import router from './router'
import i18n from './locales/i18n'
import { initA11y } from './utils/a11y'
import './utils/toast'

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
