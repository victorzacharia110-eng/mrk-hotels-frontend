<!--
  Business Source page (route: /app/payments/business-source,
  name: hotel-payments-business-source).
  Displays the hotel's distribution channel list. Receptionists can reference
  the sources when recording the booking origin; managers can add, reorder
  and edit the channel list.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('receptionPanel.businessSource') }}</h1>
        <p class="muted">{{ $t('receptionPanel.businessSourceSubtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <button v-if="canEdit" class="btn btn-primary" @click="openAdd">
          <i class="fas fa-plus"></i> {{ $t('receptionPanel.addSource') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card" style="padding: 20px;">
      <div v-if="loading" class="alert alert-info" style="margin: 0;">{{ $t('common.loading') }}</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>{{ $t('common.name') }}</th>
            <th>{{ $t('common.status') }}</th>
            <th v-if="canEdit"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sources" :key="s.source_id">
            <td>{{ s.name || s.source_id }}</td>
            <td>
              <span class="badge" :class="s.is_active ? 'badge-success' : 'badge-muted'">
                {{ s.is_active ? $t('distribution.active') || 'Active' : $t('distribution.inactive') || 'Inactive' }}
              </span>
            </td>
            <td v-if="canEdit">
              <button class="btn btn-sm btn-secondary" @click="openEdit(s)">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-sm btn-danger" @click="askDelete(s)">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
          <tr v-if="!sources.length && !loading">
            <td :colspan="canEdit ? 3 : 2" class="muted">{{ $t('receptionPanel.noSources') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add / edit modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ editing ? $t('receptionPanel.editSource') : $t('receptionPanel.addSource') }}</h3>
          <button class="modal-close" :aria-label="$t('common.close')" @click="showModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>{{ $t('common.name') }} *</label>
            <input v-model="form.name" type="text" class="input" />
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" @click="showModal = false">{{ $t('common.cancel') }}</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">
            <i class="fas fa-save"></i> {{ saving ? $t('common.loading') : $t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { distributionSourceApi } from '@/api'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()

const sources = ref([])
const loading = ref(false)
const saving = ref(false)
const success = ref('')
const error = ref('')
const showModal = ref(false)
const editing = ref(false)
const form = ref({ name: '' })
let current = null

const canEdit = computed(() => ['hotel_admin', 'manager'].includes(authStore.user?.user_role))

function openAdd() {
  editing.value = false
  current = null
  form.value = { name: '' }
  error.value = ''
  showModal.value = true
}

function openEdit(s) {
  editing.value = true
  current = s
  form.value = { name: s.name }
  error.value = ''
  showModal.value = true
}

function askDelete(s) {
  if (!confirm(t('receptionPanel.confirmDeleteSource', { name: s.name }))) return
  deleteSource(s)
}

async function load() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const res = await distributionSourceApi.index()
    sources.value = res.data?.sources || res.data?.data || []
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!form.value.name) return
  saving.value = true
  error.value = ''
  try {
    if (editing.value && current) {
      await distributionSourceApi.update(current.source_id, { name: form.value.name, is_active: !!current.is_active })
      success.value = t('common.updateSuccess') || 'Updated.'
    } else {
      await distributionSourceApi.store({ name: form.value.name })
      success.value = t('common.createSuccess') || 'Added.'
    }
    showModal.value = false
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

async function deleteSource(s) {
  try {
    await distributionSourceApi.destroy(s.source_id)
    success.value = t('common.deleteSuccess') || 'Removed.'
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  }
}

onMounted(load)
</script>