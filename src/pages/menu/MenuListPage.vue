<!--
  MenuListPage.vue
  Admin list of restaurant/bar menu items with price, cost and margin display.
  Features: department/category/availability filters, search-as-you-type,
  create/edit modal, availability toggle and delete (edit actions are
  permission-gated via canEdit). Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: refresh plus permission-gated "new item" button -->
    <div class="page-head">
      <div>
        <h1>{{ $t('menu.title') }}</h1>
        <p class="muted">{{ $t('menu.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('menu.refresh') }}
        </button>
        <button v-if="canEdit" class="btn btn-secondary" @click="openCategories">
          <i class="fas fa-tags"></i> {{ $t('menu.manageCategories') }}
        </button>
        <button
          v-if="canEdit && bulk.selectedCount > 0"
          class="btn btn-danger"
          @click="showBulkDelete = true"
        >
          <i class="fas fa-trash"></i> {{ $t('common.deleteSelected') }} ({{ bulk.selectedCount }})
        </button>
        <button v-if="canEdit" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('menu.newItem') }}
        </button>
        <TableExportButton filename="menu" :load-all="loadAllMenuItems" />
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filter bar: department, category, availability and free-text search -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('common.department') }}</label>
          <SearchableSelect
            v-model="filters.department"
            :options="departmentOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('menu.category') }}</label>
          <input
            v-model="filters.category"
            type="text"
            class="input"
            list="menu-filter-categories"
            :placeholder="$t('menu.namePlaceholder')"
            @input="triggerSearch"
          />
          <datalist id="menu-filter-categories">
            <option v-for="c in filterCategoryOptions" :key="'f-' + c.category_id" :value="c.name">
              {{ c.name }}
            </option>
          </datalist>
        </div>
        <div class="form-group">
          <label>{{ $t('menu.available') }}</label>
          <SearchableSelect
            v-model="filters.is_available"
            :options="availabilityOptions"
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
            :placeholder="$t('menu.itemNamePlaceholder')"
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

    <!-- Loading indicator shown while the list request is in flight -->
    <div v-if="loading" class="alert alert-info">{{ $t('menu.loading') }}</div>

    <!-- Menu items table: name, category, department, price/cost/margin and status -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col" class="bulk-col">
              <input
                v-if="canEdit"
                type="checkbox"
                :checked="bulk.allSelected"
                :indeterminate.prop="bulk.someSelected && !bulk.allSelected"
                :aria-label="$t('common.selectAll')"
                @change="bulk.toggleAll()"
              />
            </th>
            <th scope="col">{{ $t('menu.tableItem') }}</th>
            <th scope="col">{{ $t('menu.category') }}</th>
            <th scope="col">{{ $t('common.department') }}</th>
            <th scope="col">{{ $t('menu.price') }}</th>
            <th scope="col">{{ $t('menu.tableCost') }}</th>
            <th scope="col">{{ $t('menu.margin') }}</th>
            <th scope="col">{{ $t('common.status') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.menu_item_id">
            <td class="bulk-col">
              <input
                v-if="canEdit"
                type="checkbox"
                :checked="bulk.isSelected(item.menu_item_id)"
                @change="bulk.toggle(item.menu_item_id)"
              />
            </td>
            <td>
              <strong>{{ item.item_name }}</strong>
              <div v-if="item.description" class="muted">{{ item.description }}</div>
              <div v-if="item.linked_item_name" class="muted sync-note">
                {{ $t('menu.syncedTo') }} {{ item.linked_item_name }}
              </div>
            </td>
            <td>{{ item.category || '-' }}</td>
            <td class="capitalize">{{ item.department }}</td>
            <td>
              <span class="price">TZS {{ Number(item.price).toLocaleString() }}</span>
            </td>
            <td>TZS {{ Number(item.cost || 0).toLocaleString() }}</td>
            <td>
              <span v-if="Number(item.cost) > 0">{{ margin(item) }}%</span>
              <span v-else>-</span>
            </td>
            <td>
              <span class="badge" :class="item.is_available ? 'badge-green' : 'badge-red'">
                {{ item.is_available ? $t('menu.available') : $t('menu.unavailable') }}
              </span>
              <span
                v-if="item.is_in_stock === false"
                class="badge badge-red stock-out-badge"
              >
                {{ $t('menu.outOfStock') }}
              </span>
            </td>
            <td>
              <!-- Row actions (availability toggle, edit, delete) only for users with edit rights -->
              <div class="actions">
                <template v-if="canEdit">
                  <button class="btn btn-sm btn-secondary" @click="toggleAvailability(item)">
                    {{ item.is_available ? $t('menu.disable') : $t('menu.enable') }}
                  </button>
                  <button class="btn btn-sm btn-secondary" @click="openEdit(item)">
                    <i class="fas fa-pen"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" @click="remove(item)">
                    <i class="fas fa-trash"></i>
                  </button>
                </template>
                <span v-else class="muted">-</span>
              </div>
            </td>
          </tr>
          <tr v-if="!items.length && !loading">
            <td colspan="9" class="muted">{{ $t('menu.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Server-side pagination controls -->
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

    <!-- Create / edit menu item modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-book-open"></i>
            {{ editing ? $t('menu.editItem') : $t('menu.newItem') }}
          </h2>
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
            <div class="form-group form-full">
              <label>{{ $t('menu.syncToStock') }}</label>
              <SearchableSelect
                v-model="form.inventory_item_id"
                :options="inventoryOptions"
                :empty-label="$t('menu.none')"
                :placeholder="$t('menu.searchItems')"
                force-search
              >
                <template #option="{ option }">
                  <span>{{ option.item_name }}</span>
                  <span class="muted">
                    · {{ option.category || $t('inventory.noCategory') }}
                    <template v-if="option.unit"> ({{ option.unit }})</template>
                  </span>
                </template>
              </SearchableSelect>
              <p class="muted">{{ $t('menu.syncToStockHint') }}</p>
            </div>
            <div class="form-group">
              <label>{{ $t('menu.category') }}</label>
              <input
                v-model="form.category"
                type="text"
                class="input"
                list="menu-form-categories"
                :placeholder="$t('menu.namePlaceholder')"
              />
              <datalist id="menu-form-categories">
                <option v-for="c in categoryOptions" :key="c.category_id" :value="c.name">
                  {{ c.name }}
                </option>
              </datalist>
            </div>
            <div class="form-group">
              <label>{{ $t('menu.priceTzs') }}</label>
              <input
                v-model.number="form.price"
                type="number"
                min="0"
                step="0.01"
                class="input"
                required
              />
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
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i> {{ saving ? $t('common.saving') : $t('menu.saveItem') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Menu category manager modal: per-department tags with order, rename, hide and delete -->
    <div v-if="showCategoryModal" class="modal-overlay" @click.self="closeCategories">
      <div class="modal categories-modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-tags"></i>
            {{ $t('menu.manageCategories') }}
          </h2>
          <button class="modal-close" @click="closeCategories"><i class="fas fa-xmark"></i></button>
        </div>
        <p class="muted">{{ $t('menu.categoriesHint') }}</p>

        <div v-if="categoryError" class="alert alert-error">{{ categoryError }}</div>
        <div v-if="categoryNotice" class="alert alert-success">{{ categoryNotice }}</div>

        <div class="cat-dept-toggle" role="group">
          <button
            v-for="d in departmentOptions"
            :key="d.value"
            type="button"
            :class="{ active: catDept === d.value }"
            @click="switchCatDept(d.value)"
          >
            {{ d.label }}
          </button>
        </div>

        <form class="cat-add" @submit.prevent="addCategory">
          <input
            v-model="catForm.name"
            type="text"
            class="input"
            maxlength="100"
            :placeholder="$t('menu.namePlaceholder')"
            required
          />
          <button type="submit" class="btn btn-primary" :disabled="savingCategory">
            {{ savingCategory ? $t('common.saving') : $t('menu.addCategory') }}
          </button>
        </form>

        <ul v-if="categories.length" class="cat-list">
          <li
            v-for="(c, i) in categories"
            :key="c.category_id"
            class="cat-row"
            :class="{ 'cat-inactive': !c.is_active }"
          >
            <div class="cat-move">
              <button
                type="button"
                class="icon-btn"
                :disabled="i === 0"
                :title="$t('menu.moveUp')"
                @click="moveCategory(i, -1)"
              >
                <i class="fas fa-chevron-up"></i>
              </button>
              <button
                type="button"
                class="icon-btn"
                :disabled="i === categories.length - 1"
                :title="$t('menu.moveDown')"
                @click="moveCategory(i, 1)"
              >
                <i class="fas fa-chevron-down"></i>
              </button>
            </div>

            <form
              v-if="editingCategoryId === c.category_id"
              class="cat-edit-name"
              @submit.prevent="saveCategoryRename(c)"
            >
              <input v-model="catEditName" type="text" class="input" maxlength="100" autofocus />
            </form>
            <div v-else class="cat-name">
              <strong>{{ c.name }}</strong>
              <span class="muted">· {{ c.item_count }} {{ $t('menu.itemsCount') }}</span>
            </div>

            <div class="cat-actions">
              <button
                v-if="editingCategoryId !== c.category_id"
                type="button"
                class="icon-btn"
                :title="$t('menu.renameCategory')"
                @click="startRename(c)"
              >
                <i class="fas fa-pen"></i>
              </button>
              <button
                v-else
                type="button"
                class="icon-btn"
                :title="$t('common.save')"
                @click="saveCategoryRename(c)"
              >
                <i class="fas fa-check"></i>
              </button>
              <button
                type="button"
                class="icon-btn"
                :title="c.is_active ? $t('menu.hideCategory') : $t('menu.showCategory')"
                @click="toggleCategory(c)"
              >
                <i class="fas" :class="c.is_active ? 'fa-eye' : 'fa-eye-slash'"></i>
              </button>
              <button
                type="button"
                class="icon-btn danger"
                :title="$t('menu.deleteCategory')"
                @click="removeCategory(c)"
              >
                <i class="fas fa-trash-can"></i>
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="muted">{{ $t('menu.categoriesEmpty') }}</p>
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
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { menuItemApi, menuCategoryApi, inventoryApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'
import { useBulkSelection } from '@/composables/useBulkSelection'
import { collectAllRows } from '@/utils/export'

const { t } = useI18n()
const authStore = useAuthStore()

// Permission gate: the menu is owned by admins, managers and kitchen
// (back-office work, unlike floor operations which exclude those roles).
const canEdit = computed(() =>
  ['hotel_admin', 'manager', 'kitchen'].includes(authStore.user?.user_role),
)

// Options for the availability field in the create/edit form.
const formAvailabilityOptions = computed(() => [
  { value: true, label: t('menu.available') },
  { value: false, label: t('menu.unavailable') },
])

// List state: items, pagination, filters, and load flags/messages.
const items = ref([])
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({ department: '', category: '', is_available: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

const bulk = useBulkSelection(() => items.value, { idKey: 'menu_item_id' })
const showBulkDelete = ref(false)
const deleting = ref(false)

// Modal state: create/edit form fields.
const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const form = reactive({
  item_name: '',
  category: '',
  department: 'restaurant',
  inventory_item_id: '',
  price: null,
  cost: null,
  description: '',
  is_available: true,
})

// Registered inventory items offered in the "sync to stock" picker so a
// beverage menu item's live quantity can gate waiter orders (best-effort).
const inventoryItems = ref([])
const inventoryOptions = computed(() =>
  inventoryItems.value.map((item) => ({
    value: item.item_id,
    item_name: item.item_name,
    label: item.item_name,
    category: item.category || '',
    unit: item.unit || '',
  })),
)

async function loadInventoryOptions() {
  try {
    const res = await inventoryApi.index({ per_page: 200 })
    inventoryItems.value = Array.isArray(res.data) ? res.data : res.data?.data || []
  } catch {
    inventoryItems.value = []
  }
}

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

function loadAllMenuItems() {
  return collectAllRows((page, perPage) =>
    menuItemApi.index({
      department: filters.department,
      category: filters.category,
      is_available: filters.is_available || undefined,
      search: filters.search,
      page,
      per_page: perPage,
    }),
  )
}

/** Moves to the given page and reloads. */
function goPage(page) {
  page.value = page
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
  form.inventory_item_id = ''
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
  loadCategories(form.department)
  loadInventoryOptions()
}

/** Opens the edit modal pre-filled with the selected item. */
function openEdit(item) {
  modalError.value = ''
  editing.value = true
  editingId.value = item.menu_item_id
  form.item_name = item.item_name
  form.category = item.category || ''
  form.department = item.department
  form.inventory_item_id = item.inventory_item_id || ''
  form.price = item.price
  form.cost = item.cost
  form.description = item.description || ''
  form.is_available = !!item.is_available
  showModal.value = true
  loadCategories(form.department)
  loadInventoryOptions()
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
    const payload = { ...form, inventory_item_id: form.inventory_item_id || null }
    if (editing.value) {
      await menuItemApi.update(editingId.value, payload)
      success.value = t('menu.updated')
    } else {
      await menuItemApi.store(payload)
      success.value = t('menu.created')
    }
    showModal.value = false
    await load()
    await loadCategories(form.department)
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
    success.value = t('menu.toggled', {
      name: item.item_name,
      status: item.is_available ? t('menu.unavailable') : t('menu.available'),
    })
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
    await loadCategories()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/**
 * Deletes every selected menu item; the typed-confirmation modal guards the action.
 */
async function bulkDelete() {
  error.value = ''
  deleting.value = true
  try {
    const { tried, failed } = await bulk.removeMany((id) => menuItemApi.destroy(id))
    if (failed > 0) {
      error.value = t('menu.bulkDeletePartial', { tried, failed })
    } else if (tried > 0) {
      success.value = t('menu.bulkDeleteSuccess', { count: tried })
    }
    bulk.clear()
    showBulkDelete.value = false
    await load()
    await loadCategories()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    deleting.value = false
  }
}

// ---- Managed menu categories -------------------------------------------------
// Categories are per-department tags the POS (waiter screen) uses as tappable
// buttons. Backend: GET/POST /menu-categories, PUT .../reorder, PUT/DELETE
// .../{category}. Free-text item categories are reconciled into these tags.

const categories = ref([])
const showCategoryModal = ref(false)
const catDept = ref('restaurant')
const catForm = ref({ name: '' })
const savingCategory = ref(false)
const categoryError = ref('')
const categoryNotice = ref('')
const editingCategoryId = ref(null)
const catEditName = ref('')

/** Category suggestions for the item form, matching its selected department. */
const categoryOptions = computed(() =>
  categories.value.filter((c) => c.department === form.department),
)

/** Category suggestions for the filter bar, any relevant department. */
const filterCategoryOptions = computed(() =>
  categories.value.filter((c) => !filters.department || c.department === filters.department),
)

/** Pulls the ordered category list for a department (best-effort). */
async function loadCategories(dept = catDept.value) {
  try {
    const res = await menuCategoryApi.index({ department: dept })
    categories.value = res.data.data || res.data || []
    categoryError.value = ''
  } catch {
    categories.value = []
  }
}

/** Opens the category manager modal for the field's current department. */
function openCategories() {
  categoryError.value = ''
  categoryNotice.value = ''
  editingCategoryId.value = null
  catDept.value = form.department
  catForm.value.name = ''
  showCategoryModal.value = true
  loadCategories(catDept.value)
}

/** Closes the category manager modal. */
function closeCategories() {
  showCategoryModal.value = false
  editingCategoryId.value = null
}

/** Switches the manager's department tab and reloads its tags. */
function switchCatDept(dept) {
  catDept.value = dept
  catForm.value.name = ''
  editingCategoryId.value = null
  loadCategories(dept)
}

/** Creates a category via the free-text field. */
async function addCategory() {
  const name = catForm.value.name.trim()
  if (!name) return
  savingCategory.value = true
  categoryError.value = ''
  try {
    await menuCategoryApi.store({ department: catDept.value, name })
    catForm.value.name = ''
    categoryNotice.value = t('menu.categoryCreated')
    await loadCategories(catDept.value)
  } catch (err) {
    categoryError.value = flattenError(err)
  } finally {
    savingCategory.value = false
  }
}

/** Opens the inline rename input for a category. */
function startRename(c) {
  editingCategoryId.value = c.category_id
  catEditName.value = c.name
}

/** Persists an inline rename (renames propagate to all linked items). */
async function saveCategoryRename(c) {
  const name = catEditName.value.trim()
  if (!name || name === c.name) {
    editingCategoryId.value = null
    return
  }
  categoryError.value = ''
  try {
    await menuCategoryApi.update(c.category_id, { name })
    editingCategoryId.value = null
    categoryNotice.value = t('menu.categoryRenamed')
    await loadCategories(catDept.value)
    await load()
  } catch (err) {
    categoryError.value = flattenError(err)
  }
}

/** Shows/hides a category (hidden tags stop appearing on the POS). */
async function toggleCategory(c) {
  categoryError.value = ''
  try {
    await menuCategoryApi.update(c.category_id, { is_active: !c.is_active })
    await loadCategories(catDept.value)
  } catch (err) {
    categoryError.value = flattenError(err)
  }
}

/** Swaps two categories and persists the new order. */
async function moveCategory(index, direction) {
  const target = index + direction
  if (target < 0 || target >= categories.value.length) return
  const moved = [...categories.value]
  ;[moved[index], moved[target]] = [moved[target], moved[index]]
  categories.value = moved
  try {
    await menuCategoryApi.reorder(
      catDept.value,
      categories.value.map((c) => c.category_id),
    )
  } catch (err) {
    categoryError.value = flattenError(err)
    await loadCategories(catDept.value)
  }
}

/** Deletes a category (linked items are ungrouped only, never removed). */
async function removeCategory(c) {
  if (
    !window.confirm(t('menu.deleteCategoryMessage', { name: c.name, count: c.item_count }))
  ) {
    return
  }
  categoryError.value = ''
  try {
    await menuCategoryApi.destroy(c.category_id)
    categoryNotice.value = t('menu.categoryDeleted')
    await loadCategories(catDept.value)
    await load()
  } catch (err) {
    categoryError.value = flattenError(err)
  }
}

/** Flattens Laravel-style validation errors into a single readable message. */
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
  color: #757575;
  font-size: 12px;
  margin-top: 2px;
}

.sync-note {
  color: #005eb8;
}

.stock-out-badge {
  margin-left: 6px;
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

.categories-modal {
  max-width: 560px;
}

.cat-dept-toggle {
  display: flex;
  gap: 8px;
  margin: 16px 0 12px;
}

.cat-dept-toggle button {
  padding: 6px 14px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: #fff;
  color: #555;
  font-weight: 600;
  cursor: pointer;
}

.cat-dept-toggle button.active {
  background: #005eb8;
  border-color: #005eb8;
  color: #fff;
}

.cat-add {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.cat-add .input {
  flex: 1;
}

.cat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  background: #fafafa;
}

.cat-row.cat-inactive {
  opacity: 0.55;
}

.cat-move {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.icon-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 6px;
  color: #555;
  cursor: pointer;
  font-size: 13px;
}

.icon-btn:hover:not(:disabled) {
  background: #eef3f8;
  border-color: #d8e3ee;
}

.icon-btn.danger:hover {
  background: #fdecea;
  border-color: #f5c6c0;
  color: #c0392b;
}

.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.cat-name {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-name .muted {
  font-size: 12px;
}

.cat-edit-name {
  flex: 1;
  margin: 0;
}

.cat-actions {
  display: flex;
  gap: 4px;
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
