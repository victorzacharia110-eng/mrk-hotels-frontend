<!--
  InventoryListPage.vue
  Inventory/stock register for the hotel. Features: category, status and
  low-stock filters, search-as-you-type, create/edit item modal, stock
  adjustment modal (in / out / set absolute) and a detail modal with the
  full stock-movement history. Write actions gated by canOperate.
  Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: refresh plus permission-gated "new item" button -->
    <div class="page-head">
      <div>
        <h1>{{ $t('inventory.title') }}</h1>
        <p class="muted">{{ $t('inventory.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('inventory.refresh') }}
        </button>
        <button v-if="canOperate" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('inventory.newItem') }}
        </button>
        <TableExportButton filename="inventory" :load-all="loadAllItems" />
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filter bar: category, stock status, free-text search and low-stock-only toggle -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('inventory.category') }}</label>
          <SearchableSelect
            v-model="filters.category"
            :options="categoryOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('inventory.status') }}</label>
          <SearchableSelect
            v-model="filters.status"
            :options="stockStatusOptions"
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
            :placeholder="$t('inventory.namePlaceholder')"
            @input="triggerSearch"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('inventory.lowStockOnly') }}</label>
          <SearchableSelect
            v-model="filters.low_stock"
            :options="yesNoOptions"
            :empty-label="$t('common.no')"
            @change="load"
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
    <div v-if="loading" class="alert alert-info">{{ $t('inventory.loading') }}</div>

    <!-- Stock table: item, category, on-hand qty, reorder level, cost, supplier and status badge -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('inventory.tableItem') }}</th>
            <th scope="col">{{ $t('inventory.category') }}</th>
            <th scope="col">{{ $t('inventory.tableStock') }}</th>
            <th scope="col">{{ $t('inventory.tableReorder') }}</th>
            <th scope="col">{{ $t('inventory.tableUnitCost') }}</th>
            <th scope="col">{{ $t('inventory.tableSupplier') }}</th>
            <th scope="col">{{ $t('inventory.status') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.item_id">
            <td>
              <strong>{{ item.item_name }}</strong>
              <div class="muted">{{ item.unit || '-' }}</div>
            </td>
            <td class="capitalize">{{ item.category }}</td>
            <td>
              <strong>{{ Number(item.quantity_in_stock).toLocaleString() }}</strong>
            </td>
            <td>{{ Number(item.reorder_level).toLocaleString() }}</td>
            <td>TZS {{ Number(item.unit_cost).toLocaleString() }}</td>
            <td>{{ item.supplier || '-' }}</td>
            <td>
              <span class="badge" :class="stockBadge(item.status)">{{
                item.status.replace('_', ' ')
              }}</span>
            </td>
            <td>
              <div class="actions">
                <button class="btn btn-sm btn-secondary" @click="openDetail(item)">
                  <i class="fas fa-eye"></i>
                </button>
                <button
                  v-if="canOperate"
                  class="btn btn-sm btn-secondary"
                  @click="openAdjust(item)"
                >
                  <i class="fas fa-arrows-up-down"></i>
                </button>
                <button v-if="canOperate" class="btn btn-sm btn-secondary" @click="openEdit(item)">
                  <i class="fas fa-pen"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!items.length && !loading">
            <td colspan="8" class="muted">{{ $t('inventory.empty') }}</td>
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

    <!-- Create / edit item modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-box"></i>
            {{ editing ? $t('inventory.editItem') : $t('inventory.newItem') }}
          </h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>{{ $t('inventory.itemName') }}</label>
              <input v-model="form.item_name" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('inventory.category') }} *</label>
              <SearchableSelect v-model="form.category" :options="categoryOptions" required />
            </div>
            <div class="form-group">
              <label>{{ $t('inventory.unit') }}</label>
              <input
                v-model="form.unit"
                type="text"
                class="input"
                :placeholder="$t('inventory.unitPlaceholder')"
              />
            </div>
            <div v-if="!editing" class="form-group">
              <label>{{ $t('inventory.openingStock') }}</label>
              <input
                v-model.number="form.quantity_in_stock"
                type="number"
                min="0"
                step="0.01"
                class="input"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('inventory.reorderLevel') }}</label>
              <input
                v-model.number="form.reorder_level"
                type="number"
                min="0"
                step="0.01"
                class="input"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('inventory.unitCost') }}</label>
              <input
                v-model.number="form.unit_cost"
                type="number"
                min="0"
                step="0.01"
                class="input"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('common.supplier') }}</label>
              <input v-model="form.supplier" type="text" class="input" />
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
              {{ saving ? $t('common.saving') : $t('inventory.saveItem') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Stock adjustment modal (in/out/set absolute) -->
    <div v-if="showAdjust" class="modal-overlay" @click.self="showAdjust = false">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-arrows-up-down"></i> {{ $t('inventory.adjustStock') }}</h2>
          <button class="modal-close" @click="showAdjust = false">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <p class="muted">
          {{ adjustItem.item_name }} · {{ $t('inventory.currentStock') }}
          {{ Number(adjustItem.quantity_in_stock).toLocaleString() }}
        </p>
        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <form @submit.prevent="saveAdjust">
          <div class="form-group">
            <label>{{ $t('inventory.type') }}</label>
            <SearchableSelect v-model="adjustForm.type" :options="adjustmentTypeOptions" required />
          </div>
          <div class="form-group">
            <label>{{ $t('inventory.quantity') }} *</label>
            <input
              v-model.number="adjustForm.quantity"
              type="number"
              min="0"
              step="0.01"
              class="input"
              required
            />
          </div>
          <div class="form-group">
            <label>{{ $t('common.reference') }}</label>
            <SearchableSelect
              v-model="adjustForm.reference_type"
              :options="referenceTypeOptions"
              :empty-label="$t('common.none')"
            />
          </div>
          <div class="form-group">
            <label>{{ $t('common.notes') }}</label>
            <textarea v-model="adjustForm.notes" rows="2" class="textarea"></textarea>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="showAdjust = false">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('inventory.adjust') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Item detail modal with stock movement history -->
    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = false">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h2><i class="fas fa-box"></i> {{ detail?.item?.item_name }}</h2>
          <button class="modal-close" @click="showDetail = false">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <p class="muted">
          {{
            $t('inventory.detailSummary', {
              stock: Number(detail?.item?.quantity_in_stock).toLocaleString(),
              reorder: Number(detail?.item?.reorder_level).toLocaleString(),
              category: detail?.item?.category,
            })
          }}
        </p>
        <h3 class="sub-title">{{ $t('inventory.movements') }}</h3>
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">{{ $t('inventory.movementType') }}</th>
                <th scope="col">{{ $t('inventory.movementQty') }}</th>
                <th scope="col">{{ $t('common.reference') }}</th>
                <th scope="col">{{ $t('common.notes') }}</th>
                <th scope="col">{{ $t('inventory.movementWhen') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in detail?.movements || []" :key="m.movement_id">
                <td>
                  <span
                    class="badge"
                    :class="m.movement_type === 'out' ? 'badge-red' : 'badge-green'"
                    >{{ m.movement_type }}</span
                  >
                </td>
                <td>{{ Number(m.quantity).toLocaleString() }}</td>
                <td>{{ m.reference_type || '-' }}</td>
                <td>{{ m.notes || '-' }}</td>
                <td>{{ formatDate(m.created_at) }}</td>
              </tr>
              <tr v-if="!detail?.movements?.length">
                <td colspan="5" class="muted">{{ $t('inventory.noMovements') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { inventoryApi } from '@/api'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { collectAllRows } from '@/utils/export'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'

const { t } = useI18n()
const authStore = useAuthStore()

// Permission gate: whether the current user can operate on inventory records.
const canOperate = computed(() => authStore.canOperate)

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
const filters = reactive({ category: '', status: '', search: '', low_stock: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

// Modal state: create/edit form, stock adjustment, and item detail views.
const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const showAdjust = ref(false)
const adjustItem = ref(null)
const showDetail = ref(false)
const detail = ref(null)
const form = reactive({
  item_name: '',
  category: 'other',
  unit: '',
  quantity_in_stock: 0,
  reorder_level: 0,
  unit_cost: 0,
  supplier: '',
  notes: '',
})
const adjustForm = reactive({ type: 'in', quantity: 0, reference_type: '', notes: '' })

// Dropdown option lists for filters and forms.
const categoryOptions = computed(() => [
  { value: 'bar', label: t('inventory.categoryBar') },
  { value: 'restaurant', label: t('inventory.categoryRestaurant') },
  { value: 'housekeeping', label: t('inventory.categoryHousekeeping') },
  { value: 'maintenance', label: t('inventory.categoryMaintenance') },
  { value: 'procurement', label: t('inventory.categoryProcurement') },
  { value: 'other', label: t('inventory.categoryOther') },
])

const stockStatusOptions = computed(() => [
  { value: 'in_stock', label: t('inventory.statusInStock') },
  { value: 'low_stock', label: t('inventory.statusLowStock') },
  { value: 'out_of_stock', label: t('inventory.statusOutOfStock') },
])

const yesNoOptions = computed(() => [{ value: 'true', label: t('common.yes') }])

const adjustmentTypeOptions = computed(() => [
  { value: 'in', label: t('inventory.stockIn') },
  { value: 'out', label: t('inventory.stockOut') },
  { value: 'adjustment', label: t('inventory.setAbsolute') },
])

const referenceTypeOptions = computed(() => [
  { value: 'purchase', label: t('inventory.adjustmentTypePurchase') },
  { value: 'sale', label: t('inventory.adjustmentTypeSale') },
  { value: 'wastage', label: t('inventory.adjustmentTypeWastage') },
  { value: 'transfer', label: t('inventory.adjustmentTypeTransfer') },
  { value: 'adjustment', label: t('inventory.adjustmentTypeAdjustment') },
])

/** Maps a stock status to its badge CSS class for the table. */
function stockBadge(status) {
  const map = { in_stock: 'badge-green', low_stock: 'badge-yellow', out_of_stock: 'badge-red' }
  return map[status] || 'badge-gray'
}

/** Formats an ISO date/time into a short display string. */
function formatDate(date) {
  return date ? String(date).slice(0, 16).replace('T', ' ') : '-'
}

/** Fetches the paged item list using the current filters. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await inventoryApi.index({
      category: filters.category,
      status: filters.status,
      search: filters.search,
      low_stock: filters.low_stock || undefined,
      page: page.value,
      per_page: 15,
    })
    items.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('inventory.loadError')
  } finally {
    loading.value = false
  }
}

/** Fetches every inventory item page for export, honouring the active filters. */
const loadAllItems = () =>
  collectAllRows((page, perPage) =>
    inventoryApi.index({
      category: filters.category,
      status: filters.status,
      search: filters.search,
      low_stock: filters.low_stock || undefined,
      page,
      per_page: perPage,
    }),
  )

/** Moves to the given page and reloads. */
function goPage(page) {
  page.value = page
  load()
}

/** Resets all filters and reloads from the first page. */
function clearFilters() {
  page.value = 1
  filters.category = ''
  filters.status = ''
  filters.search = ''
  filters.low_stock = ''
  load()
}

/** Debounce-less search: reset to page 1 and reload as the user types. */
function triggerSearch() {
  page.value = 1
  load()
}

/** Resets the create/edit form back to its empty defaults. */
function resetForm() {
  editing.value = false
  editingId.value = null
  form.item_name = ''
  form.category = 'other'
  form.unit = ''
  form.quantity_in_stock = 0
  form.reorder_level = 0
  form.unit_cost = 0
  form.supplier = ''
  form.notes = ''
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
  editingId.value = item.item_id
  form.item_name = item.item_name
  form.category = item.category
  form.unit = item.unit || ''
  form.reorder_level = item.reorder_level
  form.unit_cost = item.unit_cost
  form.supplier = item.supplier || ''
  form.notes = item.notes || ''
  showModal.value = true
}

/** Closes all open modals. */
function closeModal() {
  showModal.value = false
  showAdjust.value = false
  showDetail.value = false
}

/** Creates or updates the inventory item depending on the editing flag. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    if (editing.value) {
      await inventoryApi.update(editingId.value, {
        item_name: form.item_name,
        category: form.category,
        unit: form.unit,
        reorder_level: form.reorder_level,
        unit_cost: form.unit_cost,
        supplier: form.supplier,
        notes: form.notes,
      })
      success.value = t('inventory.updateSuccess')
    } else {
      await inventoryApi.store(form)
      success.value = t('inventory.createSuccess')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Opens the stock-adjustment modal for the given item. */
function openAdjust(item) {
  modalError.value = ''
  adjustItem.value = item
  adjustForm.type = 'in'
  adjustForm.quantity = 0
  adjustForm.reference_type = ''
  adjustForm.notes = ''
  showAdjust.value = true
}

/** Submits the stock adjustment for the selected item. */
async function saveAdjust() {
  modalError.value = ''
  saving.value = true
  try {
    await inventoryApi.adjust(adjustItem.value.item_id, {
      type: adjustForm.type,
      quantity: adjustForm.quantity,
      reference_type: adjustForm.reference_type || undefined,
      notes: adjustForm.notes,
    })
    showAdjust.value = false
    success.value = t('inventory.adjusted')
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Fetches the full item detail (with movements) and shows it in a modal. */
async function openDetail(item) {
  modalError.value = ''
  try {
    const res = await inventoryApi.show(item.item_id)
    detail.value = res.data
    showDetail.value = true
  } catch (err) {
    error.value = flattenError(err)
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

.capitalize {
  text-transform: capitalize;
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

.sub-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #005eb8;
  margin: 16px 0 8px;
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

.modal-sm {
  max-width: 420px;
}

.modal-lg {
  max-width: 760px;
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
