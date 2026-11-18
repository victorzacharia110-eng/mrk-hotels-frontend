<template>
  <SchemaCrudManager
    title="Pricing Products"
    :api="api"
    list-key="products"
    :fields="fields"
    :columns="columns"
  />
</template>

<script setup>
import { marketingApi } from '@/api'
import SchemaCrudManager from './SchemaCrudManager.vue'

const api = marketingApi.pricingProducts
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'slug', label: 'Slug' },
  { key: 'sort_order', label: 'Sort' },
]
const fields = [
  { key: 'slug', label: 'Slug', type: 'text' },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
]
</script>
