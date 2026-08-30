<!--
  OutletManagePage.vue
  Back-office list of the hotel's POS outlets (restaurant/bar) that cashiers
  pick from after login. The list comes from /v1/outlets; admins and managers
  create, rename, enable/disable and delete outlets here.
-->

<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('outlets.title') }}</h1>
        <p class="muted">{{ $t('outlets.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <button v-if="canEdit" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('outlets.newOutlet') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div v-if="loading" class="alert alert-info">{{ $t('common.loading') }}</div>

    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('outlets.name') }}</th>
            <th scope="col">{{ $t('outlets.type') }}</th>
            <th scope="col">{{ $t('common.status') }}</th>
            <th v-if="canEdit" scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="outlet in outlets" :key="outlet.outlet_id">
            <td>
              <strong>{{ outlet.name }}</strong>
            </td>
            <td class="capitalize">{{ typeLabel(outlet.type) }}</td>
            <td>
              <span class="badge" :class="outlet.is_active ? 'badge-green' : 'badge-red'">
                {{ outlet.is_active ? $t('outlets.statusActive') : $t('outlets.statusInactive') }}
              </span>
            </td>
            <td v-if="canEdit">
              <div class="actions">
                <button class="btn btn-sm btn-secondary" @click="toggleActive(outlet)">
                  {{ outlet.is_active ? $t('outlets.deactivate') : $t('outlets.activate') }}
                </button>
                <button class="btn btn-sm btn-secondary" @click="openEdit(outlet)">
                  <i class="fas fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-danger" @click="askDelete(outlet)">
                  <i class="fas fa-trash-can"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!outlets.length && !loading">
            <td colspan="4" class="muted">{{ $t('outlets.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-store"></i>
            {{ editing ? $t('outlets.editOutlet') : $t('outlets.newOutlet') }}
          </h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>{{ $t('outlets.name') }} *</label>
              <input v-model="form.name" type="text" class="input" required maxlength="100" />
            </div>
            <div class="form-group">
              <label>{{ $t('outlets.type') }}</label>
              <SearchableSelect v-model="form.type" :options="typeOptions" />
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i> {{ saving ? $t('common.saving') : $t('outlets.saveOutlet') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <DeleteConfirmModal
      v-model="showDelete"
      :title="t('outlets.deleteTitle')"
      :message="t('outlets.deleteMessage', { name: pendingDelete?.name })"
      :confirm-label="t('outlets.deleteConfirmLabel')"
      :busy="deleting"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { outletApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'

const { t } = useI18n()
const authStore = useAuthStore()

const canEdit = computed(() =>
  ['hotel_admin', 'manager'].includes(authStore.user?.user_role),
)

const typeOptions = computed(() => [
  { value: 'restaurant', label: t('outlets.typeRestaurant') },
  { value: 'bar', label: t('outlets.typeBar') },
])

function typeLabel(type) {
  return type === 'bar' ? t('outlets.typeBar') : t('outlets.typeRestaurant')
}

const outlets = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')

const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const form = reactive({ name: '', type: 'restaurant' })

const showDelete = ref(false)
const pendingDelete = ref(null)
const deleting = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await outletApi.index()
    outlets.value = res.data.outlets || []
  } catch (err) {
    error.value = err.response?.data?.message || t('outlets.loadError')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  modalError.value = ''
  editing.value = false
  editingId.value = null
  form.name = ''
  form.type = 'restaurant'
  showModal.value = true
}

function openEdit(outlet) {
  modalError.value = ''
  editing.value = true
  editingId.value = outlet.outlet_id
  form.name = outlet.name
  form.type = outlet.type || 'restaurant'
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function save() {
  const name = form.name.trim()
  if (!name) return
  modalError.value = ''
  saving.value = true
  try {
    if (editing.value) {
      await outletApi.update(editingId.value, form)
      success.value = t('outlets.updateSuccess')
    } else {
      await outletApi.store(form)
      success.value = t('outlets.createSuccess')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

async function toggleActive(outlet) {
  error.value = ''
  try {
    await outletApi.update(outlet.outlet_id, { is_active: !outlet.is_active })
    success.value = t('outlets.toggled', {
      name: outlet.name,
      status: outlet.is_active ? t('outlets.statusInactive') : t('outlets.statusActive'),
    })
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

function askDelete(outlet) {
  pendingDelete.value = outlet
  showDelete.value = true
}

async function confirmDelete() {
  if (!pendingDelete.value) return
  error.value = ''
  deleting.value = true
  try {
    await outletApi.destroy(pendingDelete.value.outlet_id)
    success.value = t('outlets.deleteSuccess', { name: pendingDelete.value.name })
    showDelete.value = false
    pendingDelete.value = null
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    deleting.value = false
  }
}

function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
}

onMounted(load)
</script>

<style scoped>
.dashboard-page {
  padding: 32px 20px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.page-head h1 {
  font-size: 28px;
  font-weight: 800;
  margin: 0;
}

.head-actions {
  display: flex;
  gap: 10px;
}

.muted {
  color: #757575;
  font-size: 12px;
  margin-top: 2px;
}

.capitalize {
  text-transform: capitalize;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: #fff;
  border-radius: 8px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.modal-head h2 {
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.modal-head h2 i {
  color: #005eb8;
}

.modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #757575;
  cursor: pointer;
  padding: 4px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.form-full {
  grid-column: 1 / -1;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 20px 16px;
  }

  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-full {
    grid-column: auto;
  }
}
</style>