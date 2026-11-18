<template>
  <SchemaCrudManager
    title="Contact Submissions"
    :api="api"
    list-key="contact_submissions"
    :fields="fields"
    :columns="columns"
  />
</template>

<script setup>
import { marketingApi } from '@/api'
import SchemaCrudManager from './SchemaCrudManager.vue'

const api = marketingApi.contactSubmissions
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'business_name', label: 'Business' },
  { key: 'business_address', label: 'Address' },
]
const fields = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'business_name', label: 'Business name', type: 'text' },
  { key: 'business_address', label: 'Business address', type: 'textarea' },
]
</script>
