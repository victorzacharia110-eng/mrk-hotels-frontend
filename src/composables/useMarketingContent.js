import { computed, ref, unref } from 'vue'
import i18n from '@/locales/i18n'
import swMessages from '@/locales/sw.json'
import { publicMarketingApi } from '@/api'

const rawBootstrap = ref(null)
const loading = ref(false)
const error = ref('')
let inflight = null

function normalizeBootstrap(payload) {
  const data = payload || {}
  const pages = Array.isArray(data.pages)
    ? data.pages.map((p) => ({
        ...p,
        sections: Array.isArray(p.sections) ? p.sections.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : [],
      })).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    : []
  return {
    settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
    pages,
    integrations: Array.isArray(data.integrations) ? data.integrations : [],
    faqs: Array.isArray(data.faqs) ? data.faqs : [],
    team_members: Array.isArray(data.team_members) ? data.team_members : [],
    media: Array.isArray(data.media) ? data.media : [],
    pricing:
      data.pricing && typeof data.pricing === 'object'
        ? {
            products: Array.isArray(data.pricing.products) ? data.pricing.products : [],
            features: Array.isArray(data.pricing.features) ? data.pricing.features : [],
            plans: Array.isArray(data.pricing.plans) ? data.pricing.plans : [],
          }
        : { products: [], features: [], plans: [] },
  }
}

export function translateMarketing(value) {
  if (typeof value !== 'string' || unref(i18n.global.locale) !== 'sw') return value
  const strings = swMessages.marketingContent?.strings || {}
  return strings[value] ?? value
}

function localizeDeep(value) {
  if (typeof value === 'string') return translateMarketing(value)
  if (Array.isArray(value)) return value.map(localizeDeep)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localizeDeep(item)]))
  }
  return value
}

function localizeMarketingSection(section) {
  if (!section) return section
  return {
    ...section,
    heading: translateMarketing(section.heading),
    subheading: translateMarketing(section.subheading),
    body_json: localizeDeep(section.body_json),
  }
}

export function localizeMarketingPage(page) {
  if (!page) return page
  return {
    ...page,
    title: translateMarketing(page.title),
    nav_label: translateMarketing(page.nav_label),
    meta_title: translateMarketing(page.meta_title),
    meta_description: translateMarketing(page.meta_description),
    sections: Array.isArray(page.sections) ? page.sections.map(localizeMarketingSection) : [],
  }
}

function localizeMarketingBootstrap(payload) {
  if (!payload) return payload
  return {
    ...payload,
    settings: localizeDeep(payload.settings),
    pages: (payload.pages || []).map(localizeMarketingPage),
    integrations: localizeDeep(payload.integrations),
    faqs: localizeDeep(payload.faqs),
    team_members: localizeDeep(payload.team_members),
    media: localizeDeep(payload.media),
    pricing: localizeDeep(payload.pricing),
  }
}

const bootstrap = computed(() => localizeMarketingBootstrap(rawBootstrap.value))

async function loadBootstrap(force = false) {
  if (rawBootstrap.value && !force) return bootstrap.value
  if (inflight) return inflight
  loading.value = true
  error.value = ''
  inflight = publicMarketingApi
    .bootstrap()
    .then((res) => {
      rawBootstrap.value = normalizeBootstrap(res.data || {})
      return bootstrap.value
    })
    .catch((err) => {
      error.value = err?.response?.data?.message || i18n.global.t('marketingCopy.marketingUnavailable')
      rawBootstrap.value = null
      throw err
    })
    .finally(() => {
      loading.value = false
      inflight = null
    })
  return inflight
}

function getSetting(key, fallback = undefined) {
  if (!bootstrap.value?.settings) return fallback
  const value = bootstrap.value.settings[key]
  return value === undefined || value === null ? fallback : value
}

function getPage(slug) {
  return bootstrap.value?.pages?.find((p) => p.slug === slug) || null
}

function clearBootstrap() {
  rawBootstrap.value = null
  error.value = ''
}

export function useMarketingContent() {
  return {
    bootstrap,
    loading,
    error,
    loadBootstrap,
    getSetting,
    getPage,
    clearBootstrap,
    translateMarketing,
    localizeMarketingPage,
  }
}
