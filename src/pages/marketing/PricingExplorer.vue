<template>
  <div>
    <div class="mrk-pricing-toolbar">
      <div class="mrk-field">
        <label for="pricing-product">Product</label>
        <select id="pricing-product" v-model="filters.product" class="mrk-select">
          <option value="">All products</option>
          <option v-for="p in products" :key="p.id || p.slug" :value="p.slug">{{ p.name }}</option>
        </select>
      </div>
      <div class="mrk-field">
        <label for="pricing-country">Country</label>
        <select id="pricing-country" v-model="filters.country" class="mrk-select">
          <option value="">All countries</option>
          <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.name }}</option>
        </select>
      </div>
      <div class="mrk-field">
        <label for="pricing-rooms">Rooms</label>
        <input id="pricing-rooms" v-model.number="filters.rooms" type="number" min="0" class="mrk-input" placeholder="Number of rooms" />
      </div>
      <div class="mrk-field">
        <label>Billing</label>
        <div class="mrk-toggle" role="group" aria-label="Billing period">
          <button type="button" :class="{ active: filters.billing === 'monthly' }" @click="filters.billing = 'monthly'">Monthly</button>
          <button type="button" :class="{ active: filters.billing === 'annual' }" @click="filters.billing = 'annual'">Annual</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="mrk-empty">Loading pricing...</div>
    <div v-else-if="error" class="mrk-empty">Pricing is unavailable.</div>
    <div v-else-if="!plans.length" class="mrk-empty">No plans available for the selected filters.</div>
    <div v-else class="mrk-grid mrk-grid-3">
      <article v-for="plan in plans" :key="plan.id || plan.slug" class="mrk-card">
        <span v-if="productName(plan)" class="mrk-pill">{{ productName(plan) }}</span>
        <h3 style="margin-top:12px;">{{ plan.name }}</h3>
        <p v-if="plan.description">{{ plan.description }}</p>
        <div class="mrk-price">{{ formatPrice(plan) }}</div>
        <p class="mrk-muted" style="font-size:13px;">{{ roomRange(plan) }}</p>
        <ul v-if="plan.features?.length" class="mrk-feature-list">
          <li v-for="feature in plan.features" :key="feature.id || feature.key || feature.label">
            <i class="fas fa-check" aria-hidden="true"></i>
            <span>{{ feature.label || feature.name || feature.key }}</span>
          </li>
        </ul>
        <div class="mrk-actions" style="margin-top:20px;">
          <a v-if="isContactSales(plan)" href="#contact" class="mrk-btn mrk-btn-primary">Contact sales</a>
          <a v-else href="/portal/pricing" class="mrk-btn mrk-btn-primary">Get started</a>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { publicMarketingApi } from '@/api'
import { useMarketingContent } from '@/composables/useMarketingContent'
import { getCountries, loadLocationData } from '@/utils/locations'

const { bootstrap } = useMarketingContent()
const filters = reactive({
  product: '',
  country: '',
  billing: 'monthly',
  rooms: '',
})

const loading = ref(false)
const error = ref('')
const pricing = ref({ products: [], features: [], plans: [] })

const products = computed(() => pricing.value.products || bootstrap.value?.pricing?.products || [])
const plans = computed(() => pricing.value.plans || [])
const countryOptions = ref([])
const countries = computed(() => {
  const values = new Map()
  for (const country of countryOptions.value) {
    values.set(country.code, country)
  }
  for (const plan of [...(bootstrap.value?.pricing?.plans || []), ...(plans.value || [])]) {
    if (plan.country_code && !values.has(plan.country_code)) {
      values.set(plan.country_code, { code: plan.country_code, name: plan.country_code })
    }
  }
  return Array.from(values.values()).sort((a, b) => a.name.localeCompare(b.name))
})

async function loadPricing() {
  loading.value = true
  error.value = ''
  try {
    const params = {}
    if (filters.product) params.product = filters.product
    if (filters.country) params.country = filters.country
    if (filters.billing) params.billing = filters.billing
    if (filters.rooms !== '' && filters.rooms !== null && filters.rooms !== undefined) params.rooms = filters.rooms
    const res = await publicMarketingApi.pricing(params)
    pricing.value = res.data || { products: [], features: [], plans: [] }
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to load pricing'
    pricing.value = bootstrap.value?.pricing || { products: [], features: [], plans: [] }
  } finally {
    loading.value = false
  }
}

function amount(plan) {
  return filters.billing === 'annual' ? plan.price_yearly : plan.price_monthly
}

function isContactSales(plan) {
  const value = amount(plan)
  return value === null || value === undefined || value === '' || Number(value) === 0
}

function formatPrice(plan) {
  if (isContactSales(plan)) return 'Contact sales'
  const value = Number(amount(plan))
  if (Number.isNaN(value)) return 'Contact sales'
  const currency = plan.currency_code || ''
  const period = filters.billing === 'annual' ? '/year' : '/month'
  return `${currency ? currency + ' ' : ''}${value.toLocaleString()}${period}`
}

function roomRange(plan) {
  const min = plan.room_count_min
  const max = plan.room_count_max
  if (min == null && max == null) return 'Room range not specified'
  if (min != null && max != null) return `${min}–${max} rooms`
  if (min != null) return `${min}+ rooms`
  return `Up to ${max} rooms`
}

function productName(plan) {
  if (plan.product_slug) {
    const match = products.value.find((p) => p.slug === plan.product_slug)
    if (match?.name) return match.name
  }
  return ''
}

let timer = null
watch(filters, () => {
  clearTimeout(timer)
  timer = setTimeout(loadPricing, 250)
}, { deep: true })

onMounted(async () => {
  loadPricing()
  try {
    await loadLocationData()
    countryOptions.value = getCountries().map((country) => ({ code: country.code, name: country.name }))
  } catch {
    countryOptions.value = []
  }
})
</script>
