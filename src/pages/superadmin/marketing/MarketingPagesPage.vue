<template>
  <SchemaCrudManager
    title="Pages"
    :api="api"
    list-key="pages"
    :fields="fields"
    :columns="columns"
  />
</template>

<script setup>
import { marketingApi } from '@/api'
import SchemaCrudManager from './SchemaCrudManager.vue'

const api = marketingApi.pages
const columns = [
  { key: 'title', label: 'Title' },
  { key: 'slug', label: 'Slug' },
  { key: 'nav_label', label: 'Nav label' },
  { key: 'show_in_nav', label: 'In nav', format: 'bool' },
  { key: 'is_active', label: 'Active', format: 'bool' },
]
const fields = [
  { key: 'slug', label: 'Slug', type: 'text' },
  { key: 'title', label: 'Title', type: 'text' },
  { key: 'nav_label', label: 'Nav label', type: 'text' },
  { key: 'meta_title', label: 'Meta title', type: 'text' },
  { key: 'meta_description', label: 'Meta description', type: 'textarea' },
  { key: 'show_in_nav', label: 'Show in nav', type: 'checkbox' },
  { key: 'is_active', label: 'Active', type: 'checkbox' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
]
</script>
