<template>
  <SchemaCrudManager
    title="Team Members"
    :api="api"
    list-key="team_members"
    :fields="fields"
    :columns="columns"
  />
</template>

<script setup>
import { marketingApi } from '@/api'
import SchemaCrudManager from './SchemaCrudManager.vue'

const api = marketingApi.teamMembers
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'sort_order', label: 'Sort' },
]
const fields = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'role', label: 'Role', type: 'text' },
  { key: 'bio', label: 'Bio', type: 'textarea' },
  { key: 'photo_url', label: 'Photo URL', type: 'text' },
  { key: 'sort_order', label: 'Sort order', type: 'number' },
]
</script>
