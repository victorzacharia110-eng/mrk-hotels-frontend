<template>
  <SchemaCrudManager
    title="Media"
    :api="api"
    list-key="media"
    :fields="fields"
    :columns="columns"
    :multipart="true"
  />
</template>

<script setup>
import { marketingApi } from '@/api'
import SchemaCrudManager from './SchemaCrudManager.vue'

const api = marketingApi.media
const columns = [
  { key: 'original_name', label: 'Name' },
  { key: 'mime_type', label: 'Type' },
  { key: 'size', label: 'Size' },
  { key: 'alt_text', label: 'Alt text' },
]
const fields = [
  { key: 'file', label: 'File', type: 'file' },
  { key: 'alt_text', label: 'Alt text', type: 'text' },
  { key: 'original_name', label: 'Original name', type: 'text', hint: 'Optional override' },
]
</script>
