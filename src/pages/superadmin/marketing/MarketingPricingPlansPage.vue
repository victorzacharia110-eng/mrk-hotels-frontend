<template>
  <SchemaCrudManager
    title="Pricing Plans"
    :api="api"
    list-key="plans"
    :fields="fields"
    :columns="columns"
    :option-sources="optionSources"
  />
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { marketingApi } from '@/api'
import SchemaCrudManager from './SchemaCrudManager.vue'

const api = marketingApi.pricingPlans
const optionSources = ref({ products: [], features: [] })

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'product_slug', label: 'Product' },
  { key: 'currency_code', label: 'Currency' },
  { key: 'price_monthly', label: 'Monthly' },
  { key: 'price_yearly', label: 'Yearly' },
]
const fields = [
  { key: 'product_id', label: 'Product', type: 'select', optionsKey: 'products', nullable: true },
  { key: 'product_slug', label: 'Product slug', type: 'text' },
  { key: 'slug', label: 'Slug', type: 'text' },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'currency_code', label: 'Currency code', type: 'text' },
  { key: 'price_monthly', label: 'Price monthly', type: 'number', nullable: true },
  { key: 'price_yearly', label: 'Price yearly', type: 'number', nullable: true },
  { key: 'country_code', label: 'Country code', type: 'text' },
  { key: 'room_count_min', label: 'Room count min', type: 'number', nullable: true },
  { key: 'room_count_max', label: 'Room count max', type: 'number', nullable: true },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
  { key: 'feature_ids', label: 'Features', type: 'multiselect', optionsKey: 'features' },
]

onMounted(async () => {
  try {
    const [productsRes, featuresRes] = await Promise.all([
      marketingApi.pricingProducts.index(),
      marketingApi.pricingFeatures.index(),
    ])
    optionSources.value.products = (productsRes.data?.products || []).map((p) => ({ value: p.id, label: `${p.name} (${p.slug})` }))
    optionSources.value.features = (featuresRes.data?.features || []).map((f) => ({ value: f.id, label: f.label || f.key || `#${f.id}` }))
  } catch {
    optionSources.value = { products: [], features: [] }
  }
})
</script>
