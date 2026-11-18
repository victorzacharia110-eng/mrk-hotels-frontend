<template>
  <SchemaCrudManager
    title="FAQs"
    :api="api"
    list-key="faqs"
    :fields="fields"
    :columns="columns"
  />
</template>

<script setup>
import { marketingApi } from '@/api'
import SchemaCrudManager from './SchemaCrudManager.vue'

const api = marketingApi.faqs
const columns = [
  { key: 'question', label: 'Question' },
  { key: 'category', label: 'Category' },
  { key: 'sort_order', label: 'Sort' },
]
const fields = [
  { key: 'question', label: 'Question', type: 'textarea' },
  { key: 'answer', label: 'Answer', type: 'textarea' },
  { key: 'category', label: 'Category', type: 'text' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
]
</script>
