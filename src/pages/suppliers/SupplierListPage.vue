<!--
  Suppliers page (route: /app/suppliers, name: hotel-suppliers).
  Supplier records for a hotel: a filterable paginated list with balance and
  rating columns plus a create/edit/delete modal (permission-gated).
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('suppliers.title') }}</h1>
        <p class="muted">{{ $t('suppliers.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('suppliers.refresh') }}
        </button>
        <button
          v-if="canOperate && bulk.selectedCount > 0"
          class="btn btn-danger"
          @click="showBulkDelete = true"
        >
          <i class="fas fa-trash"></i> {{ $t('common.deleteSelected') }} ({{ bulk.selectedCount }})
        </button>
        <button v-if="canOperate" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('suppliers.newSupplier') }}
        </button>
        <TableExportButton filename="suppliers" :load-all="loadAllSuppliers" />
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Status/category/search filters; each change reloads the list -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('suppliers.status') }}</label>
          <SearchableSelect
            v-model="filters.status"
            :options="supplierStatusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('suppliers.category') }}</label>
          <SearchableSelect
            v-model="filters.category"
            :options="categoryOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input
            v-model="filters.search"
            type="text"
            class="input"
            :placeholder="$t('suppliers.namePlaceholder')"
            @input="triggerSearch"
          />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters">
            <i class="fas fa-filter-circle-xmark"></i> {{ $t('common.clear') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('suppliers.loading') }}</div>

    <!-- Supplier table with per-row edit/delete actions -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col" class="bulk-col">
              <input
                v-if="canOperate"
                type="checkbox"
                :checked="bulk.allSelected"
                :indeterminate.prop="bulk.someSelected && !bulk.allSelected"
                :aria-label="$t('common.selectAll')"
                @change="bulk.toggleAll()"
              />
            </th>
            <th scope="col">{{ $t('suppliers.tableSupplier') }}</th>
            <th scope="col">{{ $t('suppliers.tableContact') }}</th>
            <th scope="col">{{ $t('suppliers.category') }}</th>
            <th scope="col">{{ $t('suppliers.tableTerms') }}</th>
            <th scope="col">{{ $t('suppliers.tableBalance') }}</th>
            <th scope="col">{{ $t('suppliers.tableRating') }}</th>
            <th scope="col">{{ $t('suppliers.status') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in suppliers" :key="s.supplier_id">
            <td class="bulk-col">
              <input
                v-if="canOperate"
                type="checkbox"
                :checked="bulk.isSelected(s.supplier_id)"
                @change="bulk.toggle(s.supplier_id)"
              />
            </td>
            <td>
              <strong>{{ s.supplier_name }}</strong>
              <div class="muted">{{ s.address || '-' }}</div>
            </td>
            <td>
              <div>{{ s.contact_person || '-' }}</div>
              <div class="muted">{{ s.email || s.phone || '-' }}</div>
            </td>
            <td class="capitalize">{{ s.category.replace('_', ' ') }}</td>
            <td>{{ s.payment_terms || '-' }}</td>
            <td>
              <span class="price">TZS {{ Number(s.current_balance || 0).toLocaleString() }}</span>
            </td>
            <td>{{ stars(s.rating) }}</td>
            <td>
              <span class="badge" :class="statusBadge(s.status)">{{ s.status }}</span>
            </td>
            <td>
              <div class="actions">
                <button v-if="canOperate" class="btn btn-sm btn-secondary" @click="openEdit(s)">
                  <i class="fas fa-pen"></i>
                </button>
                <button v-if="canOperate" class="btn btn-sm btn-danger" @click="remove(s)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!suppliers.length && !loading">
            <td colspan="9" class="muted">{{ $t('suppliers.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination controls, only shown when there is more than one page -->
    <div v-if="meta.total > meta.per_page" class="pagination">
      <button
        class="btn btn-sm btn-secondary"
        :disabled="!meta.prev_page_url"
        @click="goPage(meta.current_page - 1)"
      >
        {{ $t('common.previous') }}
      </button>
      <span class="muted">{{
        $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page })
      }}</span>
      <button
        class="btn btn-sm btn-secondary"
        :disabled="!meta.next_page_url"
        @click="goPage(meta.current_page + 1)"
      >
        {{ $t('common.next') }}
      </button>
    </div>

    <!-- Create/edit supplier modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-truck"></i>
            {{ editing ? $t('suppliers.editSupplier') : $t('suppliers.newSupplier') }}
          </h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>{{ $t('suppliers.supplierName') }}</label>
              <input v-model="form.supplier_name" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('suppliers.contactPerson') }}</label>
              <input v-model="form.contact_person" type="text" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('suppliers.categoryRequired') }}</label>
              <SearchableSelect v-model="form.category" :options="categoryOptions" required />
            </div>
            <div class="form-group">
              <label>{{ $t('suppliers.email') }}</label>
              <input v-model="form.email" type="email" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('suppliers.phone') }}</label>
              <PhoneInput v-model="form.phone" v-model:countryCode="form.country_code" />
            </div>
            <div class="form-group">
              <label>{{ $t('suppliers.paymentTerms') }}</label>
              <input
                v-model="form.payment_terms"
                type="text"
                class="input"
                :placeholder="$t('suppliers.paymentTermsPlaceholder')"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('suppliers.creditLimit') }}</label>
              <input
                v-model.number="form.credit_limit"
                type="number"
                min="0"
                step="0.01"
                class="input"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('suppliers.rating') }}</label>
              <input
                v-model.number="form.rating"
                type="number"
                min="0"
                max="5"
                step="0.5"
                class="input"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('suppliers.status') }}</label>
              <SearchableSelect v-model="form.status" :options="supplierStatusOptions" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('common.address') }}</label>
              <input v-model="form.address" type="text" class="input" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('common.notes') }}</label>
              <textarea v-model="form.notes" rows="2" class="textarea"></textarea>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('suppliers.saveSupplier') }}
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
import { ref, reactive, onMounted, computed } from 'vue'
import { supplierApi } from '@/api'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import PhoneInput from '@/components/PhoneInput.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'
import { useCategoriesStore } from '@/stores/categories'
import { useBulkSelection } from '@/composables/useBulkSelection'
import { collectAllRows } from '@/utils/export'
import { normalizePhoneNumber } from '@/utils/phone'

const { t } = useI18n()
const authStore = useAuthStore()
const canOperate = computed(() => authStore.canOperate)

// List state: supplier rows, pagination, filters and feedback flags.
const suppliers = ref([])
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({ status: '', category: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

const bulk = useBulkSelection(() => suppliers.value, { idKey: 'supplier_id' })
const showBulkDelete = ref(false)
const deleting = ref(false)

// Modal state: visibility, edit target, in-flight flag, errors and the form fields.
const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const form = reactive({
  supplier_name: '',
  contact_person: '',
  email: '',
  phone: '',
  country_code: 'TZ',
  address: '',
  category: 'other',
  payment_terms: '',
  credit_limit: 0,
  rating: 0,
  status: 'active',
  notes: '',
})

// Translated option lists for the status and category dropdowns.
const supplierStatusOptions = computed(() => [
  { value: 'active', label: t('suppliers.active') },
  { value: 'inactive', label: t('suppliers.inactive') },
  { value: 'blocked', label: t('suppliers.statusBlocked') },
])

const categoriesStore = useCategoriesStore()
const categoryOptions = categoriesStore.supplierCategoryOptions

/**
 * Maps a supplier status to the CSS class used for its badge colour.
 * @param {string} status - The supplier status (active, inactive, blocked).
 * @returns {string} The badge CSS class.
 */
function statusBadge(status) {
  const map = { active: 'badge-green', inactive: 'badge-gray', blocked: 'badge-red' }
  return map[status] || 'badge-gray'
}

/**
 * Renders a 0-5 rating as a string of filled/empty star characters.
 * @param {number} rating - The supplier rating.
 * @returns {string} Five star characters, e.g. "★★★☆☆".
 */
function stars(rating) {
  const n = Number(rating) || 0
  let out = ''
  for (let i = 0; i < 5; i++) out += i < n ? '★' : '☆'
  return out
}

/** Fetches the current page of suppliers, honouring the active filters. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await supplierApi.index({
      status: filters.status,
      category: filters.category,
      search: filters.search,
      page: page.value,
      per_page: 15,
    })
    suppliers.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('suppliers.loadError')
  } finally {
    loading.value = false
  }
}

function loadAllSuppliers() {
  return collectAllRows((page, perPage) =>
    supplierApi.index({
      status: filters.status,
      category: filters.category,
      search: filters.search,
      page,
      per_page: perPage,
    }),
  )
}

/**
 * Moves to the given page and reloads the list.
 * @param {number} page - The 1-based page number.
 */
function goPage(page) {
  page.value = page
  load()
}

/** Resets all filters and reloads from the first page. */
function clearFilters() {
  page.value = 1
  filters.status = ''
  filters.category = ''
  filters.search = ''
  load()
}

/** Restarts the search from page one whenever the search text changes. */
function triggerSearch() {
  page.value = 1
  load()
}

/** Resets the modal form to its defaults for a fresh create. */
function resetForm() {
  editing.value = false
  editingId.value = null
  form.supplier_name = ''
  form.contact_person = ''
  form.email = ''
  form.phone = ''
  form.country_code = 'TZ'
  form.address = ''
  form.category = 'other'
  form.payment_terms = ''
  form.credit_limit = 0
  form.rating = 0
  form.status = 'active'
  form.notes = ''
}

/** Opens the modal in create mode with a blank form. */
function openCreate() {
  modalError.value = ''
  resetForm()
  showModal.value = true
}

/**
 * Opens the modal in edit mode, copying the supplier's data into the form.
 * @param {Object} supplier - The supplier row being edited.
 */
function openEdit(supplier) {
  modalError.value = ''
  editing.value = true
  editingId.value = supplier.supplier_id
  form.supplier_name = supplier.supplier_name
  form.contact_person = supplier.contact_person || ''
  form.email = supplier.email || ''
  form.phone = supplier.phone || ''
  form.country_code = 'TZ'
  form.address = supplier.address || ''
  form.category = supplier.category
  form.payment_terms = supplier.payment_terms || ''
  form.credit_limit = supplier.credit_limit
  form.rating = supplier.rating
  form.status = supplier.status
  form.notes = supplier.notes || ''
  showModal.value = true
}

/** Closes the create/edit modal. */
function closeModal() {
  showModal.value = false
}

/** Creates or updates the supplier (normalising the phone number) and reloads. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    if (editing.value) {
      await supplierApi.update(editingId.value, {
        ...form,
        phone: normalizePhoneNumber(form.phone, form.country_code || 'TZ'),
      })
      success.value = t('suppliers.updateSuccess')
    } else {
      await supplierApi.store({
        ...form,
        phone: normalizePhoneNumber(form.phone, form.country_code || 'TZ'),
      })
      success.value = t('suppliers.createSuccess')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/**
 * Deletes a supplier after a confirmation prompt.
 * @param {Object} supplier - The supplier row to delete.
 */
async function remove(supplier) {
  if (!window.confirm(t('suppliers.deleteMessage', { name: supplier.supplier_name }))) return
  error.value = ''
  try {
    await supplierApi.destroy(supplier.supplier_id)
    success.value = t('suppliers.deleted', { name: supplier.supplier_name })
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/**
 * Deletes every selected supplier; the typed-confirmation modal guards the action.
 */
async function bulkDelete() {
  error.value = ''
  deleting.value = true
  try {
    const { tried, failed } = await bulk.removeMany((id) => supplierApi.destroy(id))
    if (failed > 0) {
      error.value = t('suppliers.bulkDeletePartial', { tried, failed })
    } else if (tried > 0) {
      success.value = t('suppliers.bulkDeleteSuccess', { count: tried })
    }
    bulk.clear()
    showBulkDelete.value = false
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    deleting.value = false
  }
}

/**
 * Flattens Laravel-style validation errors into a single readable message.
 * @param {Error} err - The thrown request error.
 * @returns {string} A space-joined error message or the generic failure text.
 */
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
}

.head-actions {
  display: flex;
  gap: 10px;
}

.filter-bar {
  margin-bottom: 16px;
  padding: 16px 20px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.filter-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 1px;
}

.muted {
  color: #757575;
  font-size: 12px;
  margin-top: 2px;
}

.capitalize {
  text-transform: capitalize;
}

.bulk-col {
  width: 40px;
}

.bulk-col input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.price {
  font-weight: 700;
  color: #005eb8;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
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
  max-width: 640px;
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

.modal-close:hover {
  color: #333;
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

  .filter-grid {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-full {
    grid-column: auto;
  }
}
</style>
