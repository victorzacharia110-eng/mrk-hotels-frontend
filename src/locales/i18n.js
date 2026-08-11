/**
 * vue-i18n configuration.
 *
 * English is the default and fallback locale; Swahili is fully supported.
 * `legacy: false` enables the Composition API (useI18n) used throughout the
 * app, and the chosen locale persists in localStorage across visits.
 */

import { createI18n } from 'vue-i18n'
import en from './en.json'
import sw from './sw.json'

// Vue i18n instance: English by default, Swahili supported, persisted in localStorage.
const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'en',
  fallbackLocale: 'en',
  messages: { en, sw },
})

export default i18n
