<template>
  <SchemaCrudManager
    title="Contact Submissions"
    description="Replies are emailed to the customer immediately."
    :api="api"
    list-key="contact_submissions"
    :fields="fields"
    :columns="columns"
    :can-create="false"
    :can-delete="false"
    item-label="submission"
    edit-label="Reply"
    save-label="Send reply"
    success-message="Reply sent to the customer."
  />
</template>

<script setup>
import { marketingApi } from '@/api'
import SchemaCrudManager from './SchemaCrudManager.vue'

const api = {
  index: (...args) => marketingApi.contactSubmissions.index(...args),
  update: (id, data) => marketingApi.contactSubmissions.reply(id, data),
}
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'business_name', label: 'Business' },
  { key: 'status', label: 'Status' },
  { key: 'reply_body', label: 'Reply' },
  { key: 'notes', label: 'Notes' },
  { key: 'replied_at', label: 'Replied' },
]
const fields = [
  {
    key: 'reply_body',
    label: 'Reply message',
    type: 'textarea',
    required: true,
    placeholder: 'Type the reply to send to this customer...',
  },
]
</script>
