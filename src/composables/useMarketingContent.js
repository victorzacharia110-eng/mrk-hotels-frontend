import { ref } from 'vue'
import { publicMarketingApi } from '@/api'

const bootstrap = ref(null)
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

async function loadBootstrap(force = false) {
  if (bootstrap.value && !force) return bootstrap.value
  if (inflight) return inflight
  loading.value = true
  error.value = ''
  inflight = publicMarketingApi
    .bootstrap()
    .then((res) => {
      bootstrap.value = normalizeBootstrap(res.data || {})
      return bootstrap.value
    })
    .catch((err) => {
      error.value = err?.response?.data?.message || err?.message || 'Failed to load marketing content'
      bootstrap.value = null
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
  bootstrap.value = null
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
  }
}
