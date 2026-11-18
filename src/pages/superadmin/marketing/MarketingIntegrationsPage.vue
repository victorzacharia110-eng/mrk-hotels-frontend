<template>
  <SchemaCrudManager
    title="Integrations"
    :api="api"
    list-key="integrations"
    :fields="fields"
    :columns="columns"
  />
</template>

<script setup>
import { marketingApi } from '@/api'
import SchemaCrudManager from './SchemaCrudManager.vue'

const api = marketingApi.integrations
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'slug', label: 'Slug' },
  { key: 'category', label: 'Category' },
  { key: 'sort_order', label: 'Sort' },
]
const fields = [
  { key: 'slug', label: 'Slug', type: 'text' },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'logo_url', label: 'Logo URL', type: 'text' },
  { key: 'external_url', label: 'External URL', type: 'text' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
]
</script>
