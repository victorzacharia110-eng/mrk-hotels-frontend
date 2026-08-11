import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import '@fortawesome/fontawesome-free/css/all.min.css'
import './assets/base.css'

import App from './App.vue'
import router from './router'
import i18n from './locales/i18n'

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
