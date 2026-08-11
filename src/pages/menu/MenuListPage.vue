<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('menu.title') }}</h1>
        <p class="muted">{{ $t('menu.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load"><i class="fas fa-rotate"></i> {{ $t('menu.refresh') }}</button>
        <button v-if="canEdit" class="btn btn-primary" @click="openCreate"><i class="fas fa-plus"></i> {{
          $t('menu.newItem')
        }}</button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('common.department') }}</label>
          <SearchableSelect v-model="filters.department" :options="departmentOptions" :empty-label="$t('common.all')"
            @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('menu.category') }}</label>
          <input v-model="filters.category" type="text" class="input" :placeholder="$t('menu.namePlaceholder')"
            @input="triggerSearch" />
        </div>
        <div class="form-group">
          <label>{{ $t('menu.available') }}</label>
          <SearchableSelect v-model="filters.is_available" :options="availabilityOptions" :empty-label="$t('common.all')"
            @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input v-model="filters.search" type="text" class="input" :placeholder="$t('menu.itemNamePlaceholder')"
            @input="triggerSearch" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters"><i class="fas fa-filter-circle-xmark"></i> {{
            $t('common.clear') }}</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('menu.loading') }}</div>

    <div v-else class="table-scroll">
      <table class="table">
      <thead>
        <tr>
          <th>{{ $t('menu.tableItem') }}</th>
          <th>{{ $t('menu.category') }}</th>
          <th>{{ $t('common.department') }}</th>
          <th>{{ $t('menu.price') }}</th>
          <th>{{ $t('menu.tableCost') }}</th>
          <th>{{ $t('menu.margin') }}</th>
          <th>{{ $t('common.status') }}</th>
          <th>{{ $t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.menu_item_id">
          <td>
            <strong>{{ item.item_name }}</strong>
            <div v-if="item.description" class="muted">{{ item.description }}</div>
          </td>
          <td>{{ item.category || '-' }}</td>
          <td class="capitalize">{{ item.department }}</td>
          <td><span class="price">TZS {{ Number(item.price).toLocaleString() }}</span></td>
          <td>TZS {{ Number(item.cost || 0).toLocaleString() }}</td>
          <td>
            <span v-if="Number(item.cost) > 0">{{ margin(item) }}%</span>
            <span v-else>-</span>
          </td>
          <td>
            <span class="badge" :class="item.is_available ? 'badge-green' : 'badge-red'">
              {{ item.is_available ? $t('menu.available') : $t('menu.unavailable') }}
            </span>
          </td>
          <td>
            <div class="actions">
              <template v-if="canEdit">
                <button class="btn btn-sm btn-secondary" @click="toggleAvailability(item)">
                  {{ item.is_available ? $t('menu.disable') : $t('menu.enable') }}
                </button>
                <button class="btn btn-sm btn-secondary" @click="openEdit(item)"><i class="fas fa-pen"></i></button>
                <button class="btn btn-sm btn-danger" @click="remove(item)"><i class="fas fa-trash"></i></button>
              </template>
              <span v-else class="muted">-</span>
            </div>
          </td>
        </tr>
        <tr v-if="!items.length && !loading">
          <td colspan="8" class="muted">{{ $t('menu.empty') }}</td>
        </tr>
      </tbody>
    </table>
    </div>

    <div v-if="meta.total > meta.per_page" class="pagination">
      <button class="btn btn-sm btn-secondary" :disabled="!meta.prev_page_url" @click="goPage(meta.current_page - 1)">{{
        $t('common.previous') }}</button>
      <span class="muted">{{ $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page }) }}</span>
      <button class="btn btn-sm btn-secondary" :disabled="!meta.next_page_url" @click="goPage(meta.current_page + 1)">{{
        $t('common.next') }}</button>
    </div>

    <!-- Create / edit menu item modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2><i class="fas fa-book-open"></i> {{ editing ? $t('menu.editItem') : $t('menu.newItem') }}</h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>{{ $t('menu.itemName') }}</label>
              <input v-model="form.item_name" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('common.department') }} *</label>
              <SearchableSelect v-model="form.department" :options="departmentOptions" required />
            </div>
            <div class="form-group">
              <label>{{ $t('menu.category') }}</label>
              <input v-model="form.category" type="text" class="input" :placeholder="$t('menu.namePlaceholder')" />
            </div>
            <div class="form-group">
              <label>{{ $t('menu.priceTzs') }}</label>
              <input v-model.number="form.price" type="number" min="0" step="0.01" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('menu.cost') }}</label>
              <input v-model.number="form.cost" type="number" min="0" step="0.01" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('menu.available') }}</label>
              <SearchableSelect v-model="form.is_available" :options="formAvailabilityOptions" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('menu.description') }}</label>
              <textarea v-model="form.description" rows="2" class="textarea"></textarea>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i> {{ saving ? $t('common.saving') : $t('menu.saveItem') }}
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
import { useAuthStore } from '@/stores/auth'
import { menuItemApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'

const { t } = useI18n()
const authStore = useAuthStore()

// Permission gate: menu editing requires both the permission and operate rights.
const canEdit = computed(() => authStore.can(40) && authStore.canOperate)

// Options for the availability field in the create/edit form.
const formAvailabilityOptions = computed(() => [
  { value: true, label: t('menu.available') },
  { value: false, label: t('menu.unavailable') },
])

// List state: items, pagination, filters, and load flags/messages.
const items = ref([])
const page = ref(1)
const meta = ref({ total: 0, per_page: 15, current_page: 1, last_page: 1, prev_page_url: null, next_page_url: null })
const filters = reactive({ department: '', category: '', is_available: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

// Modal state: create/edit form fields.
const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const form = reactive({ item_name: '', category: '', department: 'restaurant', price: null, cost: null, description: '', is_available: true })

// Static dropdown options for department and availability filters.
const departmentOptions = [
  { value: 'restaurant', label: t('common.departments.restaurant') },
  { value: 'bar', label: t('common.departments.bar') },
]

const availabilityOptions = [
  { value: 'true', label: t('menu.available') },
  { value: 'false', label: t('menu.unavailable') },
]

/** Fetches the paged menu item list using the current filters. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await menuItemApi.index({
      department: filters.department,
      category: filters.category,
      is_available: filters.is_available || undefined,
      search: filters.search,
      page: page.value,
      per_page: 15,
    })
    items.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('menu.loadError')
  } finally {
    loading.value = false
  }
}

/** Computes the gross profit margin percentage for a menu item.
 * @returns {number} rounded margin percent, or 0 when price is missing
 */
function margin(item) {
  const price = Number(item.price)
  const cost = Number(item.cost)
  if (!price || price <= 0) return 0
  return Math.round(((price - cost) / price) * 100)
}

/** Moves to the given page and reloads. */
function goPage(p) {
  page.value = p
  load()
}

/** Resets all filters and reloads from the first page. */
function clearFilters() {
  page.value = 1
  filters.department = ''
  filters.category = ''
  filters.is_available = ''
  filters.search = ''
  load()
}

/** Search as the user types: reset to page 1 and reload. */
function triggerSearch() {
  page.value = 1
  load()
}

/** Resets the create/edit form back to its empty defaults. */
function resetForm() {
  editing.value = false
  editingId.value = null
  form.item_name = ''
  form.category = ''
  form.department = 'restaurant'
  form.price = null
  form.cost = null
  form.description = ''
  form.is_available = true
}

/** Opens the create-item modal with a fresh form. */
function openCreate() {
  modalError.value = ''
  resetForm()
  showModal.value = true
}

/** Opens the edit modal pre-filled with the selected item. */
function openEdit(item) {
  modalError.value = ''
  editing.value = true
  editingId.value = item.menu_item_id
  form.item_name = item.item_name
  form.category = item.category || ''
  form.department = item.department
  form.price = item.price
  form.cost = item.cost
  form.description = item.description || ''
  form.is_available = !!item.is_available
  showModal.value = true
}

/** Closes the create/edit modal. */
function closeModal() {
  showModal.value = false
}

/** Creates or updates the menu item depending on the editing flag. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    if (editing.value) {
      await menuItemApi.update(editingId.value, form)
      success.value = t('menu.updated')
    } else {
      await menuItemApi.store(form)
      success.value = t('menu.created')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Flips the availability flag of a menu item. */
async function toggleAvailability(item) {
  error.value = ''
  try {
    await menuItemApi.update(item.menu_item_id, { ...item, is_available: !item.is_available })
    success.value = t('menu.toggled', { name: item.item_name, status: item.is_available ? t('menu.unavailable') : t('menu.available') })
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Deletes a menu item after confirmation. */
async function remove(item) {
  if (!window.confirm(t('menu.deleteMessage', { name: item.item_name }))) return
  error.value = ''
  try {
    await menuItemApi.destroy(item.menu_item_id)
    success.value = t('menu.deleted', { name: item.item_name })
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Flattens Laravel-style validation errors into a single readable message. */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages ? Object.values(messages).flat().join(' ') : err.response?.data?.message || t('common.actionFailed')
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
  grid-template-columns: repeat(4, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.filter-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 1px;
}

.muted {
  color: #888;
  font-size: 12px;
  margin-top: 2px;
}

.capitalize {
  text-transform: capitalize;
}

.price {
  font-weight: 700;
  color: #005EB8;
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
  color: #005EB8;
}

.modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #999;
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
