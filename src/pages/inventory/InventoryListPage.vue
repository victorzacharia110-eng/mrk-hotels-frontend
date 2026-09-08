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
              <label>{{ $t('storeManager.inventory.department') }}</label>
              <div class="dept-multi">
                <button
                  v-for="d in departments"
                  :key="d.department_id"
                  type="button"
                  class="dept-chip"
                  :class="{ active: form.department_ids.includes(d.department_id) }"
                  @click="toggleDepartment(d.department_id)"
                >
                  {{ d.name }}
                </button>
                <span v-if="!departments.length" class="muted">{{ $t('storeManager.inventory.noDepartments') }}</span>
              </div>
            </div>
            <div class="form-group">
              <label>{{ $t('inventory.unit') }}</label>
              <select v-model="form.unit" class="input">
                <option value="" disabled>{{ $t('storeManager.inventory.pickUnit') }}</option>
                <option v-for="u in unitOptions" :key="u" :value="u">{{ u }}</option>
              </select>
              <button type="button" class="unit-manage-btn" @click="showUnitsModal = true">
                <i class="fas fa-gear"></i> {{ $t('storeManager.inventory.manageUnits') }}
              </button>
            </div>
            <div class="form-group form-full">
              <label>{{ $t('storeManager.inventory.siUnits') }}</label>
              <div class="dept-multi">
                <button
                  v-for="u in unitOptions"
                  :key="u"
                  type="button"
                  class="dept-chip"
                  :class="{ active: isSiUnitOn(u) }"
                  @click="toggleSiUnit(u)"
                >
                  {{ u }}
                </button>
              </div>
              <div v-if="form.si_units.length" class="si-factor-list">
                <div class="muted si-factor-hint">{{ $t('storeManager.inventory.siFactorHint') }}</div>
                <div v-for="s in form.si_units" :key="s.unit" class="si-factor-row">
                  <span class="si-factor-name">1 {{ s.unit }}</span>
                  <span class="si-factor-eq">=</span>
                  <input
                    v-model.number="s.factor"
                    type="number"
                    min="0.01"
                    step="0.01"
                    class="input si-factor-input"
                    :title="$t('storeManager.inventory.siFactorHint')"
                  />
                  <span class="si-factor-base">{{ form.unit || '…' }}</span>
                  <button type="button" class="si-factor-x" :title="$t('common.delete')" @click="removeSiUnit(s.unit)">
                    <i class="fas fa-xmark"></i>
                  </button>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>{{ $t('storeManager.inventory.currencyType') }}</label>
              <select v-model="form.currency_type" class="input">
                <option value="">{{ $t('storeManager.inventory.noCurrency') }}</option>
                <option v-for="c in CURRENCY_OPTIONS" :key="c" :value="c">{{ c }}</option>
              </select>
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

    <!-- Unit registry: register new (SI) units that feed the unit dropdown. -->
    <div v-if="showUnitsModal" class="modal-overlay" @click.self="showUnitsModal = false">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3><i class="fas fa-weights-horizontal"></i> {{ $t('storeManager.inventory.manageUnits') }}</h3>
          <button class="modal-close" @click="showUnitsModal = false"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>{{ $t('storeManager.inventory.newUnit') }}</label>
            <div class="unit-add-row">
              <input v-model="newUnit" class="input" :placeholder="$t('storeManager.inventory.unitPlaceholder')" @keyup.enter="addUnit" />
              <button type="button" class="btn btn-primary" @click="addUnit"><i class="fas fa-plus"></i> {{ $t('storeManager.inventory.register') }}</button>
            </div>
          </div>
          <div class="unit-list">
            <h4>{{ $t('storeManager.inventory.registeredUnits') }}</h4>
            <div class="unit-chip" v-for="u in customUnitsSorted" :key="u">
              <span>{{ u }}</span>
              <button class="unit-chip-x" @click="removeUnit(u)"><i class="fas fa-xmark"></i></button>
            </div>
            <p v-if="!customUnits.length" class="empty">{{ $t('storeManager.inventory.noCustomUnits') }}</p>
          </div>
        </div>
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
import { inventoryApi, inventoryOpsApi, unitsApi } from '@/api'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { collectAllRows } from '@/utils/export'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import { useCategoriesStore } from '@/stores/categories'

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
  si_units: [],
  currency_type: '',
  quantity_in_stock: 0,
  reorder_level: 0,
  unit_cost: 0,
  supplier: '',
  notes: '',
  department_ids: [],
})
const adjustForm = reactive({ type: 'in', quantity: 0, reference_type: '', notes: '' })

// Dropdown option lists for filters and forms (shared category catalog).
const categoriesStore = useCategoriesStore()
const categoryOptions = categoriesStore.inventoryCategoryOptions

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

// Department list for the multi-department assignment on each item.
const departments = ref([])

// Unit registry: common SI-ish units always available, plus the shared
// backend registry (and a per-device fallback). These feed the primary unit
// picker and the multi-SI-unit selector on each item.
const DEFAULT_UNITS = ['kg', 'g', 'mg', 'L', 'mL', 'cm', 'm', 'ton', 'pcs', 'packet', 'box', 'carton', 'bottle', 'dozen', 'roll', 'pair']
const CUSTOM_UNITS_KEY = 'inventory_custom_units'
const customUnits = ref(loadCustomUnits())
const registeredUnits = ref([])
const newUnit = ref('')
const showUnitsModal = ref(false)

// Currency types offered on item master data (mirrors the finance registry).
const CURRENCY_OPTIONS = ['TZS', 'USD', 'EUR', 'GBP', 'KES', 'UGX', 'RWF', 'ZAR', 'CNY']

function loadCustomUnits() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_UNITS_KEY) || '[]') } catch { return [] }
}
function persistCustomUnits() {
  localStorage.setItem(CUSTOM_UNITS_KEY, JSON.stringify(customUnits.value))
}

/** Pulls the shared SI-unit registry so every device sees the same units. */
async function refreshUnits() {
  try {
    const res = await unitsApi.index()
    registeredUnits.value = res.data.units || []
  } catch {
    registeredUnits.value = []
  }
}

const customUnitsSorted = computed(() =>
  Array.from(new Set([...registeredUnits.value.map((r) => r.unit), ...customUnits.value])).sort(),
)
const unitOptions = computed(() => {
  const all = new Set([...DEFAULT_UNITS, ...registeredUnits.value.map((r) => r.unit), ...customUnits.value])
  if (form.unit) all.add(form.unit)
  return Array.from(all)
})

async function addUnit() {
  const u = newUnit.value.trim()
  if (!u) return
  customUnits.value = Array.from(new Set([...customUnits.value, u]))
  persistCustomUnits()
  try {
    await unitsApi.store({ unit: u })
    await refreshUnits()
  } catch {
    // Local fallback already applied; the registry write needs elevated scope.
  }
  newUnit.value = ''
}

async function removeUnit(u) {
  customUnits.value = customUnits.value.filter((x) => String(x).toUpperCase() !== String(u).toUpperCase())
  persistCustomUnits()
  const reg = registeredUnits.value.find((r) => String(r.unit).toUpperCase() === String(u).toUpperCase())
  try {
    if (reg) await unitsApi.destroy(reg.unit_id)
  } catch {
    // ignore
  }
  registeredUnits.value = registeredUnits.value.filter((r) => r.unit_id !== reg?.unit_id)
}

/** Toggles an SI unit in the item's multi-SI-unit list. */
function toggleSiUnit(unit) {
  const idx = form.si_units.findIndex((s) => s.unit === unit)
  if (idx >= 0) form.si_units.splice(idx, 1)
  else form.si_units.push({ unit, factor: 1 })
}

/** Whether the given unit is currently part of the item's SI-unit list. */
function isSiUnitOn(unit) {
  return form.si_units.some((s) => s.unit === unit)
}

/** Removes an SI unit (and its conversion factor) from the item. */
function removeSiUnit(unit) {
  const idx = form.si_units.findIndex((s) => s.unit === unit)
  if (idx >= 0) form.si_units.splice(idx, 1)
}

/** Toggles a department in the item's multi-department list. */
function toggleDepartment(id) {
  const idx = form.department_ids.indexOf(id)
  if (idx >= 0) form.department_ids.splice(idx, 1)
  else form.department_ids.push(id)
}

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
  form.si_units = []
  form.currency_type = ''
  form.quantity_in_stock = 0
  form.reorder_level = 0
  form.unit_cost = 0
  form.supplier = ''
  form.notes = ''
  form.department_ids = []
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
  form.si_units = Array.isArray(item.si_units)
    ? item.si_units.map((entry) =>
        typeof entry === 'string'
          ? { unit: entry, factor: 1 }
          : { unit: entry?.unit, factor: Number(entry?.factor || 1) },
      )
    : (item.unit ? [{ unit: item.unit, factor: 1 }] : [])
  form.currency_type = item.currency_type || ''
  form.reorder_level = item.reorder_level
  form.unit_cost = item.unit_cost
  form.supplier = item.supplier || ''
  form.notes = item.notes || ''
  form.department_ids = (item.departments || []).map((d) => d.department_id)
    || (item.department_id ? [item.department_id] : [])
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
    const payload = {
      item_name: form.item_name,
      category: form.category,
      unit: form.unit,
      si_units: (form.si_units || [])
        .filter((s) => s && s.unit)
        .map((s) => ({ unit: s.unit, factor: Number(s.factor || 1) })),
      currency_type: form.currency_type || null,
      reorder_level: form.reorder_level,
      unit_cost: form.unit_cost,
      supplier: form.supplier,
      notes: form.notes,
      department_ids: form.department_ids,
      department_id: form.department_ids[0] || null,
    }
    if (editing.value) {
      await inventoryApi.update(editingId.value, payload)
      success.value = t('inventory.updateSuccess')
    } else {
      await inventoryApi.store({ ...payload, quantity_in_stock: form.quantity_in_stock })
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

onMounted(() => {
  load()
  inventoryOpsApi.departments().then((res) => { departments.value = res.data.departments || res.data.data || [] }).catch(() => { departments.value = [] })
  refreshUnits()
})
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

.dept-multi {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dept-chip {
  border: 1px solid #d4d4d4;
  background: #fff;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #424242;
  cursor: pointer;
}
.dept-chip:hover { border-color: #1e7e34; }
.dept-chip.active { background: #eafaf1; border-color: #1e7e34; color: #1e7e34; }
.si-factor-list { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.si-factor-hint { font-size: 12px; }
.si-factor-row { display: flex; align-items: center; gap: 8px; }
.si-factor-name { font-size: 13px; font-weight: 700; color: #1e293b; min-width: 60px; }
.si-factor-eq { color: #94a3b8; }
.si-factor-input { width: 90px; }
.si-factor-base { font-size: 13px; font-weight: 700; color: #475569; }
.si-factor-x {
  border: none;
  background: none;
  color: #b91c1c;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
}
.unit-manage-btn {
  margin-top: 6px;
  border: none;
  background: none;
  color: #00468c;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}
.unit-add-row { display: flex; gap: 8px; }
.unit-add-row .input { flex: 1; }
.unit-list { margin-top: 16px; }
.unit-list h4 { margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #757575; text-transform: uppercase; letter-spacing: 0.4px; }
.unit-chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #e0e0e0; border-radius: 999px; padding: 4px 10px; margin: 0 6px 6px 0; font-size: 13px; background: #fafafa; }
.unit-chip-x { border: none; background: none; color: #b91c1c; cursor: pointer; font-size: 12px; }
.unit-chip-x:hover { color: #7f1d1d; }
.modal-body .empty { font-size: 13px; color: #757575; margin: 6px 0 0; }

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
