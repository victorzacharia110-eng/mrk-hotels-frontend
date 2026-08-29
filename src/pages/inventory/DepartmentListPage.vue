<!--
  Departments page (route: /app/departments, name: hotel-departments).
  Simple CRUD list for inventory departments: name, status, create/edit/delete.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('departments.title') }}</h1>
        <p class="muted">{{ $t('departments.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <button
          v-if="canManage && bulk.selectedCount > 0"
          class="btn btn-danger"
          @click="showBulkDelete = true"
        >
          <i class="fas fa-trash"></i> {{ $t('common.deleteSelected') }} ({{ bulk.selectedCount }})
        </button>
        <button v-if="canManage" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('departments.newDepartment') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Search filter -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input v-model="search" type="text" class="input" :placeholder="$t('departments.searchPlaceholder')" @input="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.status') }}</label>
          <select v-model="statusFilter" class="input" @change="load">
            <option value="">{{ $t('common.all') }}</option>
            <option value="active">{{ $t('common.active') }}</option>
            <option value="inactive">{{ $t('common.inactive') }}</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('common.loading') }}</div>

    <!-- Departments table -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col" class="bulk-col">
              <input
                v-if="canManage"
                type="checkbox"
                :checked="bulk.allSelected"
                :indeterminate.prop="bulk.someSelected && !bulk.allSelected"
                :aria-label="$t('common.selectAll')"
                @change="bulk.toggleAll()"
              />
            </th>
            <th scope="col">#</th>
            <th scope="col">{{ $t('departments.name') }}</th>
            <th scope="col">{{ $t('common.status') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(dept, idx) in filtered" :key="dept.department_id">
            <td class="bulk-col">
              <input
                v-if="canManage"
                type="checkbox"
                :checked="bulk.isSelected(dept.department_id)"
                @change="bulk.toggle(dept.department_id)"
              />
            </td>
            <td>{{ idx + 1 }}</td>
            <td><strong>{{ dept.name }}</strong></td>
            <td>
              <span class="badge" :class="dept.status === 'active' ? 'badge-green' : 'badge-gray'">
                {{ dept.status }}
              </span>
            </td>
            <td>
              <div class="actions" v-if="canManage">
                <button class="btn btn-sm btn-secondary" @click="openEdit(dept)">
                  <i class="fas fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-danger" @click="remove(dept)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!filtered.length && !loading">
            <td colspan="5" class="muted">{{ $t('departments.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/edit modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-building"></i>
            {{ editing ? $t('departments.editDepartment') : $t('departments.newDepartment') }}
          </h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>{{ $t('departments.nameRequired') }}</label>
              <input v-model="form.name" type="text" class="input" required maxlength="100" />
            </div>
            <div class="form-group">
              <label>{{ $t('common.status') }}</label>
              <select v-model="form.status" class="input">
                <option value="active">{{ $t('common.active') }}</option>
                <option value="inactive">{{ $t('common.inactive') }}</option>
              </select>
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

    <!-- Confirmation modal for bulk deletion (type DELETE to confirm) -->
    <DeleteConfirmModal
      v-model="showBulkDelete"
      :count="bulk.selectedCount"
      :busy="deleting"
      @confirm="bulkDelete"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { inventoryOpsApi } from '@/api'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'
import { useBulkSelection } from '@/composables/useBulkSelection'

const { t } = useI18n()
const authStore = useAuthStore()
const canManage = computed(() => authStore.roleLevel >= 80)

const departments = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const search = ref('')
const statusFilter = ref('')

const bulk = useBulkSelection(() => filtered.value, { idKey: 'department_id' })
const showBulkDelete = ref(false)
const deleting = ref(false)

const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const form = reactive({ name: '', status: 'active' })

const filtered = computed(() => {
  let list = departments.value
  if (statusFilter.value) list = list.filter(d => d.status === statusFilter.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(d => d.name.toLowerCase().includes(q))
  }
  return list
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await inventoryOpsApi.departments()
    departments.value = res.data.departments || []
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
  form.name = ''
  form.status = 'active'
  showModal.value = true
}

function openEdit(dept) {
  modalError.value = ''
  editing.value = true
  editingId.value = dept.department_id
  form.name = dept.name
  form.status = dept.status
  showModal.value = true
}

function closeModal() { showModal.value = false }

async function save() {
  modalError.value = ''
  saving.value = true
  try {
    if (editing.value) {
      await inventoryOpsApi.updateDepartment(editingId.value, { ...form })
      success.value = t('departments.updateSuccess')
    } else {
      await inventoryOpsApi.createDepartment({ ...form })
      success.value = t('departments.createSuccess')
    }
    showModal.value = false
    await load()
  } catch (err) {
    const msgs = err.response?.data?.errors
    modalError.value = msgs ? Object.values(msgs).flat().join(' ') : err.response?.data?.message || t('common.actionFailed')
  } finally {
    saving.value = false
  }
}

async function remove(dept) {
  if (!window.confirm(t('departments.deleteMessage', { name: dept.name }))) return
  error.value = ''
  try {
    await inventoryOpsApi.deleteDepartment(dept.department_id)
    success.value = t('departments.deleted', { name: dept.name })
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.actionFailed')
  }
}

async function bulkDelete() {
  error.value = ''
  deleting.value = true
  try {
    const { tried, failed } = await bulk.removeMany((id) => inventoryOpsApi.deleteDepartment(id))
    if (failed > 0) {
      error.value = t('departments.bulkDeletePartial', { tried, failed })
    } else if (tried > 0) {
      success.value = t('departments.bulkDeleteSuccess', { count: tried })
    }
    bulk.clear()
    showBulkDelete.value = false
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    deleting.value = false
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
.filter-bar { margin-bottom: 16px; padding: 16px 20px; }
.filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: end; }
.actions { display: flex; gap: 6px; }
.bulk-col { width: 40px; }
.bulk-col input[type='checkbox'] { width: 16px; height: 16px; cursor: pointer; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal { background: #fff; border-radius: 8px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.modal-head h2 { font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.modal-head h2 i { color: #005eb8; }
.modal-close { background: none; border: none; font-size: 18px; color: #757575; cursor: pointer; }
.modal-close:hover { color: #333; }
.form-grid { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 16px; }
.form-full { grid-column: 1 / -1; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
@media (max-width: 768px) { .dashboard-page { padding: 20px 16px; } .page-head { flex-direction: column; align-items: flex-start; } .filter-grid { grid-template-columns: 1fr; } }
</style>
