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
