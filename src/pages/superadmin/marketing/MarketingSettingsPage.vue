<template>
  <div class="settings-page">
    <div class="crud-head">
      <div>
        <h2>Settings</h2>
        <p class="muted">Edit marketing settings as a JSON object and save with PUT /settings.</p>
      </div>
      <div class="crud-head-actions">
        <button type="button" class="btn btn-secondary" @click="load" :disabled="loading">Reload</button>
        <button type="button" class="btn btn-primary" @click="save" :disabled="saving">{{ saving ? 'Saving...' : 'Save settings' }}</button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">
      <div>{{ error }}</div>
      <ul v-if="errorDetails.length" class="error-list">
        <li v-for="(msg, i) in errorDetails" :key="i">{{ msg }}</li>
      </ul>
    </div>

    <div class="card">
      <label for="marketing-settings-json"><strong>Settings JSON</strong></label>
      <textarea id="marketing-settings-json" v-model="jsonText" class="input json-area" rows="22" spellcheck="false"></textarea>
      <small class="muted">Example keys: nav, footer, copyright, legal. Save sends <code>{ settings: { ... } }</code>.</small>
    </div>

    <div class="card" style="margin-top:16px;">
      <h3>Delete a setting key</h3>
      <div class="delete-row">
        <input v-model.trim="deleteKey" type="text" class="input" placeholder="Key to delete" />
        <button type="button" class="btn btn-danger" @click="removeKey" :disabled="!deleteKey || deleting">
          {{ deleting ? 'Deleting...' : 'Delete key' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { marketingApi } from '@/api'
import { useSuperadminResult } from '@/composables/useSuperadminResult'

const { showSuccess, showError, actionError } = useSuperadminResult()
const jsonText = ref('{}')
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const error = ref('')
const errorDetails = ref([])
const success = ref('')
const deleteKey = ref('')

function extractErrors(err) {
  const data = err?.response?.data
  if (data?.errors && typeof data.errors === 'object') {
    return Object.values(data.errors).flat().filter(Boolean).map(String)
  }
  return []
}

async function load() {
  loading.value = true
  error.value = ''
  errorDetails.value = []
  success.value = ''
  try {
    const res = await marketingApi.settings.index()
    const settings = res.data?.settings ?? res.data ?? {}
    jsonText.value = JSON.stringify(settings && typeof settings === 'object' ? settings : {}, null, 2)
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to load settings'
    errorDetails.value = extractErrors(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  error.value = ''
  errorDetails.value = []
  success.value = ''
  try {
    const parsed = JSON.parse(jsonText.value || '{}')
    await marketingApi.settings.update({ settings: parsed })
    success.value = 'Settings saved.'
    showSuccess(success.value)
    await load()
  } catch (err) {
    if (err instanceof SyntaxError) {
      error.value = 'Settings JSON is invalid.'
    } else {
      error.value = actionError(err, 'Failed to save settings')
      errorDetails.value = extractErrors(err)
    }
    showError(error.value)
  } finally {
    saving.value = false
  }
}

async function removeKey() {
  if (!deleteKey.value) return
  deleting.value = true
  error.value = ''
  errorDetails.value = []
  success.value = ''
  try {
    await marketingApi.settings.destroy(deleteKey.value)
    success.value = `Deleted setting "${deleteKey.value}".`
    showSuccess(success.value)
    deleteKey.value = ''
    await load()
  } catch (err) {
    error.value = actionError(err, 'Failed to delete setting')
    errorDetails.value = extractErrors(err)
    showError(error.value)
  } finally {
    deleting.value = false
  }
}

load()
</script>

<style scoped>
.crud-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
.crud-head-actions { display: flex; gap: 8px; }
.json-area { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; margin-top: 8px; }
.delete-row { display: flex; gap: 8px; align-items: center; max-width: 520px; }
.error-list { margin: 8px 0 0; padding-left: 18px; }
@media (max-width: 767px) { .crud-head, .delete-row { flex-direction: column; align-items: stretch; } }
</style>
