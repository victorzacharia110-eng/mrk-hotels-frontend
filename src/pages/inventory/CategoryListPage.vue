<!--
  Category manager page (route: /app/categories, name: hotel-categories).
  Single-source vocabulary for inventory, supplier and expense categories.
  Changes here update every dropdown and what backend validation accepts,
  because the catalog endpoint and Rule::in checks both read the same rows.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('categoryManager.title') }}</h1>
        <p class="muted">{{ $t('categoryManager.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <button v-if="canManage" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('categoryManager.newCategory') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Group tabs: each tab owns one vocabulary -->
    <div class="tabs">
      <button
        v-for="group in GROUPS"
        :key="group"
        class="tab"
        :class="{ active: activeGroup === group }"
        @click="activeGroup = group"
      >
        {{ $t(`categoryManager.group.${group}`) }}
        <span class="tab-count">{{ rowsByGroup(group).length }}</span>
      </button>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('common.loading') }}</div>

    <template v-else>
      <div class="card filter-bar">
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input v-model="search" type="text" class="input" :placeholder="$t('categoryManager.searchPlaceholder')" />
        </div>
      </div>

      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">{{ $t('categoryManager.label') }}</th>
              <th scope="col">{{ $t('categoryManager.value') }}</th>
              <th scope="col">{{ $t('common.status') }}</th>
              <th scope="col" class="actions-col">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.category_id">
              <td><strong>{{ row.label }}</strong></td>
              <td><code class="code">{{ row.value }}</code></td>
              <td>
                <span class="badge" :class="row.is_active ? 'badge-green' : 'badge-gray'">
                  {{ row.is_active ? $t('common.active') : $t('common.inactive') }}
                </span>
              </td>
              <td>
                <div class="actions">
                  <button class="btn btn-sm btn-secondary" @click="openEdit(row)">
                    <i class="fas fa-pen"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" @click="remove(row)">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredRows.length">
              <td colspan="4" class="muted">{{ $t('categoryManager.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Create/edit modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-tags"></i>
            {{ editing ? $t('categoryManager.editCategory') : $t('categoryManager.newCategory') }}
          </h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('categoryManager.group') }}</label>
              <select v-model="form.group" class="input" :disabled="editing">
                <option v-for="group in GROUPS" :key="group" :value="group">
                  {{ $t(`categoryManager.group.${group}`) }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>{{ $t('categoryManager.value') }}</label>
              <input
                v-model="form.value"
                type="text"
                class="input"
                required
                maxlength="60"
                :disabled="editing"
                :placeholder="$t('categoryManager.valuePlaceholder')"
                @input="normalizeValue"
              />
              <small class="help">{{ $t('categoryManager.valueHint') }}</small>
            </div>
            <div class="form-group form-full">
              <label>{{ $t('categoryManager.label') }}</label>
              <input v-model="form.label" type="text" class="input" required maxlength="120" />
            </div>
            <div class="form-group">
              <label class="checkbox-inline">
                <input v-model="form.is_active" type="checkbox" />
                {{ $t('common.active') }}
              </label>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('common.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryOpsApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useCategoriesStore } from '@/stores/categories'

const { t } = useI18n()
const authStore = useAuthStore()
const categoriesStore = useCategoriesStore()
const canManage = computed(() => authStore.roleLevel >= 80)

const GROUPS = ['inventory', 'supplier', 'expense']

const rows = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const activeGroup = ref('inventory')
const search = ref('')

const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const form = reactive({ group: 'inventory', value: '', label: '', is_active: true })

const rowsByGroup = (group) => rows.value.filter((row) => row.group === group)

const filteredRows = computed(() => {
  const list = rowsByGroup(activeGroup.value)
  const q = search.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((row) => row.label.toLowerCase().includes(q) || row.value.toLowerCase().includes(q))
})

/** Normalizes free-typed values to the back-end's lowercase snake_case shape. */
function normalizeValue() {
  form.value = form.value.toLowerCase().replace(/\s+/g, '_')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await inventoryOpsApi.categories()
    rows.value = res.data.data?.categories || []
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  modalError.value = ''
  editing.value = false
  editingId.value = null
  form.group = activeGroup.value
  form.value = ''
  form.label = ''
  form.is_active = true
  showModal.value = true
}

function openEdit(row) {
  modalError.value = ''
  editing.value = true
  editingId.value = row.category_id
  form.group = row.group
  form.value = row.value
  form.label = row.label
  form.is_active = Boolean(row.is_active)
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function save() {
  modalError.value = ''
  saving.value = true
  try {
    if (editing.value) {
      await inventoryOpsApi.updateCategory(editingId.value, { ...form })
      success.value = t('categoryManager.updateSuccess')
    } else {
      await inventoryOpsApi.createCategory({ ...form })
      success.value = t('categoryManager.createSuccess')
    }
    showModal.value = false
    await load()
    await categoriesStore.reload()
  } catch (err) {
    const msgs = err.response?.data?.errors
    modalError.value = msgs ? Object.values(msgs).flat().join(' ') : err.response?.data?.message || t('common.actionFailed')
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  if (!window.confirm(t('categoryManager.deleteMessage', { label: row.label }))) return
  error.value = ''
  try {
    await inventoryOpsApi.deleteCategory(row.category_id)
    success.value = t('categoryManager.deleted', { label: row.label })
    await load()
    await categoriesStore.reload()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.actionFailed')
  }
}

onMounted(load)
</script>

<style scoped>
.dashboard-page { padding: 32px 20px; }
.page-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
.page-head h1 { font-size: 28px; font-weight: 800; }
.head-actions { display: flex; gap: 10px; }
.muted { color: #757575; font-size: 12px; margin-top: 2px; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid #eee; }
.tab { background: none; border: none; padding: 12px 18px; font-size: 14px; font-weight: 600; color: #757575; cursor: pointer; border-bottom: 3px solid transparent; display: flex; align-items: center; gap: 8px; }
.tab:hover { color: #005eb8; }
.tab.active { color: #005eb8; border-bottom-color: #005eb8; }
.tab-count { background: #eef4fb; color: #005eb8; border-radius: 12px; font-size: 12px; padding: 1px 8px; }
.filter-bar { margin-bottom: 16px; padding: 16px 20px; }
.code { background: #f4f6f8; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
.actions { display: flex; gap: 6px; }
.actions-col { width: 120px; }
.help { display: block; color: #9aa0a6; font-size: 11px; margin-top: 4px; }
.checkbox-inline { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal { background: #fff; border-radius: 8px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.modal-head h2 { font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.modal-head h2 i { color: #005eb8; }
.modal-close { background: none; border: none; font-size: 18px; color: #757575; cursor: pointer; }
.modal-close:hover { color: #333; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
.form-full { grid-column: 1 / -1; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
@media (max-width: 768px) { .dashboard-page { padding: 20px 16px; } .page-head { flex-direction: column; align-items: flex-start; } .form-grid { grid-template-columns: 1fr; } }
</style>