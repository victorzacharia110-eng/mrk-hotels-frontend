<template>
  <SchemaCrudManager
    title="Pricing Features"
    :api="api"
    list-key="features"
    :fields="fields"
    :columns="columns"
  />
</template>

<script setup>
import { marketingApi } from '@/api'
import SchemaCrudManager from './SchemaCrudManager.vue'

const api = marketingApi.pricingFeatures
const columns = [
  { key: 'label', label: 'Label' },
  { key: 'key', label: 'Key' },
  { key: 'sort_order', label: 'Sort' },
]
const fields = [
  { key: 'key', label: 'Key', type: 'text' },
  { key: 'label', label: 'Label', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'icon', label: 'Icon', type: 'text' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
]
</script>
