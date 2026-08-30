<!--
  StoreInventoryPage — stock item management: searchable list with low-stock
  highlighting, create/edit modal, stock adjustment and movement history.
-->

<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <button class="sm-btn ghost dept-btn" @click="showDeptPicker = true">
        <i class="fas fa-warehouse"></i>
        {{ $t('storeManager.inventory.department') }}:
        <strong>{{ activeDepartmentName }}</strong>
      </button>
      <div class="sm-search">
        <i class="fas fa-magnifying-glass"></i>
        <input v-model="search" type="text" :placeholder="$t('common.search')" @input="debouncedLoad" />
      </div>
      <select v-model="category" class="sm-select" @change="load">
        <option value="">{{ $t('inventory.allCategories') }}</option>
        <option v-for="c in categories" :key="c" :value="c">{{ formatCategory(c) }}</option>
      </select>
      <select v-model="stockFilter" class="sm-select" @change="load">
        <option value="">{{ $t('storeManager.inventory.allStock') }}</option>
        <option value="low">{{ $t('storeManager.dashboard.lowStock') }}</option>
      </select>
      <span class="spacer"></span>
      <button v-if="bulk.selectedCount > 0" class="sm-btn danger" @click="showBulkDelete = true"><i class="fas fa-trash"></i> {{ $t('common.deleteSelected') }} ({{ bulk.selectedCount }})</button>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.dashboard.newItem') }}</button>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="items.length">
          <thead>
            <tr>
              <th class="bulk-col"><input type="checkbox" :checked="bulk.allSelected" :indeterminate.prop="bulk.someSelected && !bulk.allSelected" :aria-label="$t('common.selectAll')" @change="bulk.toggleAll()" /></th>
              <th>{{ $t('inventory.itemName') }}</th>
              <th>{{ $t('inventory.category') }}</th>
              <th>{{ $t('inventory.inStock') }}</th>
              <th>{{ $t('inventory.reorderLevel') }}</th>
              <th>{{ $t('inventory.unitCost') }}</th>
              <th>{{ $t('inventory.supplier') }}</th>
              <th>{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.item_id">
              <td class="bulk-col"><input type="checkbox" :checked="bulk.isSelected(item.item_id)" @change="bulk.toggle(item.item_id)" /></td>
              <td><strong>{{ item.item_name }}</strong><br /><small class="muted">{{ item.unit }}</small></td>
              <td><span class="chip">{{ formatCategory(item.category) }}</span></td>
              <td><span :class="isLow(item) ? 'stock-low' : 'stock-ok'">{{ item.quantity_in_stock }}</span></td>
              <td>{{ item.reorder_level }}</td>
              <td>TZS {{ Number(item.unit_cost || 0).toLocaleString() }}</td>
              <td>{{ item.supplier || '-' }}</td>
              <td>
                <div class="row-actions">
                  <button class="sm-btn sm ghost" @click="openAdjust(item)" :title="$t('inventory.adjustStock')"><i class="fas fa-arrow-trend-up"></i></button>
                  <button class="sm-btn sm ghost" @click="openEdit(item)"><i class="fas fa-pen"></i></button>
                  <button class="sm-btn sm danger" @click="remove(item)"><i class="fas fa-trash"></i></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('inventory.empty') }}</p>
      </div>
        <div class="sm-pagination" v-if="meta.last_page > 1">
          <button :disabled="meta.current_page <= 1" @click="go(meta.current_page - 1)">&laquo;</button>
          <span>{{ meta.current_page }} / {{ meta.last_page }}</span>
          <button :disabled="meta.current_page >= meta.last_page" @click="go(meta.current_page + 1)">&raquo;</button>
        </div>
      </template>
    </section>

    <!-- Create / edit modal -->
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ editing ? $t('inventory.editItem') : $t('inventory.addItem') }}</h3>
          <button class="sm-modal-close" @click="showForm = false"><i class="fas fa-xmark"></i></button>
        </div>
        <form class="sm-modal-body" @submit.prevent="save">
          <div class="form-grid">
            <div class="form-field full"><label>{{ $t('inventory.itemName') }}</label><input v-model="form.item_name" class="sm-input" required /></div>
            <div class="form-field">
              <label>{{ $t('inventory.category') }}</label>
              <select v-model="form.category" class="sm-select" style="width:100%" required>
                <option v-for="c in categories" :key="c" :value="c">{{ formatCategory(c) }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>{{ $t('storeManager.inventory.department') }}</label>
              <select v-model="form.department_id" class="sm-select" style="width:100%">
                <option value="">{{ $t('storeManager.inventory.allDepartments') }}</option>
                <option v-for="d in departments" :key="d.department_id" :value="d.department_id">{{ d.name }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>{{ $t('inventory.unit') }}</label>
              <select v-model="form.unit" class="sm-select" style="width:100%">
                <option value="" disabled>{{ $t('storeManager.inventory.pickUnit') }}</option>
                <option v-for="u in unitOptions" :key="u" :value="u">{{ u }}</option>
              </select>
              <button type="button" class="sm-btn sm ghost unit-manage-btn" @click="showUnitsModal = true">
                <i class="fas fa-gear"></i> {{ $t('storeManager.inventory.manageUnits') }}
              </button>
            </div>
            <div class="form-field" v-if="!editing"><label>{{ $t('inventory.openingStock') }}</label><input v-model.number="form.quantity_in_stock" type="number" min="0" class="sm-input" /></div>
            <div class="form-field"><label>{{ $t('inventory.reorderLevel') }}</label><input v-model.number="form.reorder_level" type="number" min="0" class="sm-input" /></div>
            <div class="form-field"><label>{{ $t('inventory.unitCost') }}</label><input v-model.number="form.unit_cost" type="number" min="0" step="0.01" class="sm-input" /></div>
            <div class="form-field">
              <label>{{ $t('inventory.supplier') }}</label>
              <select v-model="form.supplier" class="sm-select" style="width:100%">
                <option value="">{{ $t('storeManager.inventory.noSupplier') }}</option>
                <option v-for="s in supplierOptions" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div class="form-field full"><label>{{ $t('common.notes') }}</label><textarea v-model="form.notes" rows="2" class="sm-textarea"></textarea></div>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="sm-modal-foot">
            <button type="button" class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
            <button type="submit" class="sm-btn" :disabled="saving">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Stock adjustment modal -->
    <div v-if="adjusting" class="sm-modal-backdrop" @click.self="adjusting = null">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ $t('inventory.adjustStock') }} — {{ adjusting.item_name }}</h3>
          <button class="sm-modal-close" @click="adjusting = null"><i class="fas fa-xmark"></i></button>
        </div>
        <form class="sm-modal-body" @submit.prevent="saveAdjustment">
          <div class="form-grid">
            <div class="form-field">
              <label>{{ $t('inventory.adjustmentType') }}</label>
              <select v-model="adjustForm.type" class="sm-select" style="width:100%">
                <option value="in">{{ $t('inventory.stockIn') }}</option>
                <option value="out">{{ $t('inventory.stockOut') }}</option>
              </select>
            </div>
            <div class="form-field"><label>{{ $t('inventory.quantity') }}</label><input v-model.number="adjustForm.quantity" type="number" min="1" class="sm-input" required /></div>
            <div class="form-field full"><label>{{ $t('inventory.reason') }}</label><input v-model="adjustForm.reason" class="sm-input" required /></div>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="sm-modal-foot">
            <button type="button" class="sm-btn ghost" @click="adjusting = null">{{ $t('common.cancel') }}</button>
            <button type="submit" class="sm-btn" :disabled="saving">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
          </div>
        </form>
      </div>
    </div>
    <!-- Department scope picker (the reference system's shelf selector) -->
    <div v-if="showDeptPicker" class="sm-modal-backdrop" @click.self="showDeptPicker = false">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ $t('storeManager.inventory.pickDepartment') }}</h3>
          <button class="sm-modal-close" @click="showDeptPicker = false"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="sm-modal-body dept-list">
          <button class="dept-option" :class="{ active: departmentId === null }" @click="pickDepartment(null)">
            {{ $t('storeManager.inventory.allDepartments') }}
          </button>
          <button v-for="d in departments" :key="d.department_id" class="dept-option"
            :class="{ active: departmentId === d.department_id }" @click="pickDepartment(d.department_id)">
            <i class="fas fa-dolly"></i> {{ d.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation modal for bulk deletion (type DELETE to confirm) -->
    <DeleteConfirmModal
      v-model="showBulkDelete"
      :count="bulk.selectedCount"
      :busy="deleting"
      @confirm="bulkDelete"
    />

    <!-- Unit registry: register new (SI) units that feed the unit dropdown. -->
    <div v-if="showUnitsModal" class="sm-modal-backdrop" @click.self="showUnitsModal = false">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ $t('storeManager.inventory.manageUnits') }}</h3>
          <button class="sm-modal-close" @click="showUnitsModal = false"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="sm-modal-body">
          <div class="form-grid">
            <div class="form-field full">
              <label>{{ $t('storeManager.inventory.newUnit') }}</label>
              <div class="unit-add-row">
                <input v-model="newUnit" class="sm-input" :placeholder="$t('storeManager.inventory.unitPlaceholder')" @keyup.enter="addUnit" />
                <button type="button" class="sm-btn" @click="addUnit"><i class="fas fa-plus"></i> {{ $t('storeManager.inventory.register') }}</button>
              </div>
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
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { inventoryApi, inventoryOpsApi, supplierApi } from '@/api'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'
import { useBulkSelection } from '@/composables/useBulkSelection'
import { INVENTORY_CATEGORIES, formatCategory } from '@/utils/format'

const route = useRoute()
const { t } = useI18n()

const items = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const loading = ref(false)
const saving = ref(false)
const search = ref('')
const category = ref('')
const stockFilter = ref(route.query.filter === 'low' ? 'low' : '')
const showForm = ref(false)
const editing = ref(null)
const adjusting = ref(null)
const formError = ref('')
const success = ref('')
const error = ref('')

const bulk = useBulkSelection(() => items.value, { idKey: 'item_id' })
const showBulkDelete = ref(false)
const deleting = ref(false)

// Department scope: the store keeper works one shelf at a time; the choice
// persists for the session like the reference system's department bar.
const departments = ref([])
const departmentId = ref(localStorage.getItem('store_dept_scope') || null)
const showDeptPicker = ref(false)

const activeDepartmentName = computed(() =>
  departments.value.find((d) => d.department_id === departmentId.value)?.name
  || t('storeManager.inventory.allDepartments'))

function pickDepartment(id) {
  departmentId.value = id
  if (id) localStorage.setItem('store_dept_scope', id)
  else localStorage.removeItem('store_dept_scope')
  showDeptPicker.value = false
  load(1)
}

const categories = INVENTORY_CATEGORIES

// Unit registry: common SI-ish units always available, plus user-registered
// units persisted per device (later swappable for a shared backend registry).
const DEFAULT_UNITS = ['kg', 'g', 'mg', 'L', 'mL', 'cm', 'm', 'ton', 'pcs', 'packet', 'box', 'carton', 'bottle', 'dozen', 'roll', 'pair']
const CUSTOM_UNITS_KEY = 'store_custom_units'
const customUnits = ref(loadCustomUnits())
const newUnit = ref('')
const showUnitsModal = ref(false)

function loadCustomUnits() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_UNITS_KEY) || '[]') } catch { return [] }
}
function persistCustomUnits() {
  localStorage.setItem(CUSTOM_UNITS_KEY, JSON.stringify(customUnits.value))
}
const customUnitsSorted = computed(() => [...customUnits.value].sort())
const unitOptions = computed(() => {
  const all = [...DEFAULT_UNITS, ...customUnits.value]
  if (form.unit && !all.includes(form.unit)) all.push(form.unit)
  return all
})
function addUnit() {
  const u = newUnit.value.trim()
  if (!u) return
  if (!customUnits.value.includes(u)) customUnits.value.push(u)
  persistCustomUnits()
  newUnit.value = ''
}
function removeUnit(u) {
  customUnits.value = customUnits.value.filter((x) => x !== u)
  persistCustomUnits()
}

// Supplier directory feeds the supplier dropdown; legacy free-text suppliers
// on existing items stay selectable.
const suppliers = ref([])
const supplierOptions = computed(() => {
  const names = suppliers.value.map((s) => s.supplier_name)
  if (form.supplier && !names.includes(form.supplier)) names.push(form.supplier)
  return names
})

const form = reactive({ item_name: '', category: 'other', unit: '', quantity_in_stock: 0, reorder_level: 0, unit_cost: 0, supplier: '', notes: '', department_id: '' })
const adjustForm = reactive({ type: 'in', quantity: 1, reason: '' })

let debounce
function debouncedLoad() {
  clearTimeout(debounce)
  debounce = setTimeout(() => load(1), 300)
}

function isLow(item) {
  return Number(item.quantity_in_stock) <= Number(item.reorder_level || 0)
}

async function load(page = meta.value.current_page) {
  loading.value = true
  try {
    const params = { page, per_page: 20 }
    if (search.value) params.search = search.value
    if (category.value) params.category = category.value
    if (departmentId.value) params.department_id = departmentId.value
    const res = await inventoryApi.index(params)
    let data = res.data.data || res.data || []
    if (stockFilter.value === 'low') data = data.filter(isLow)
    items.value = data
    meta.value = res.data.meta || { current_page: 1, last_page: 1 }
  } finally {
    loading.value = false
  }
}

function go(page) { load(page) }

function openCreate() {
  editing.value = null
  Object.assign(form, { item_name: '', category: 'other', unit: '', quantity_in_stock: 0, reorder_level: 0, unit_cost: 0, supplier: '', notes: '', department_id: '' })
  formError.value = ''
  showForm.value = true
}

function openEdit(item) {
  editing.value = item
  Object.assign(form, {
    item_name: item.item_name, category: item.category, unit: item.unit || '',
    quantity_in_stock: item.quantity_in_stock, reorder_level: item.reorder_level,
    unit_cost: item.unit_cost, supplier: item.supplier || '', notes: item.notes || '',
    department_id: item.department_id || '',
  })
  formError.value = ''
  showForm.value = true
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    const payload = { ...form }
    if (editing.value) {
      delete payload.quantity_in_stock
      await inventoryApi.update(editing.value.item_id, payload)
    } else {
      await inventoryApi.store(payload)
    }
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

function openAdjust(item) {
  adjusting.value = item
  Object.assign(adjustForm, { type: 'in', quantity: 1, reason: '' })
  formError.value = ''
}

async function saveAdjustment() {
  saving.value = true
  formError.value = ''
  try {
    // Backend contract: type (in|out), non-negative quantity, notes.
    await inventoryApi.adjust(adjusting.value.item_id, {
      type: adjustForm.type,
      quantity: Math.abs(adjustForm.quantity),
      notes: adjustForm.reason,
    })
    adjusting.value = null
    await load()
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

async function remove(item) {
  if (!window.confirm(t('inventory.deleteConfirm', { name: item.item_name }))) return
  await inventoryApi.destroy(item.item_id)
  await load()
}

async function bulkDelete() {
  error.value = ''
  deleting.value = true
  try {
    const { tried, failed } = await bulk.removeMany((id) => inventoryApi.destroy(id))
    if (failed > 0) error.value = t('inventory.bulkDeletePartial', { tried, failed })
    else if (tried > 0) success.value = t('inventory.bulkDeleteSuccess', { count: tried })
    bulk.clear()
    showBulkDelete.value = false
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  inventoryOpsApi.departments().then((res) => { departments.value = res.data.departments || [] }).catch(() => {})
  supplierApi.index({ per_page: 100 }).then((res) => { suppliers.value = res.data.data || res.data || [] }).catch(() => {})
  await load(1)
  if (route.query.create === '1') openCreate()
})
</script>

<style scoped>
.dept-btn strong { margin-left: 4px; }
.bulk-col {
  width: 40px;
}

.bulk-col input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
.dept-list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
.dept-option {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px;
  background: #fff; cursor: pointer; text-align: left; font-size: 14px; color: #1e293b;
}
.dept-option:hover { background: #f1f5f9; }
.dept-option.active { background: var(--sm-blue, #1f6ea8); color: #fff; border-color: var(--sm-blue, #1f6ea8); }
.unit-manage-btn { margin-top: 6px; width: 100%; }
.unit-add-row { display: flex; gap: 8px; }
.unit-add-row .sm-input { flex: 1; }
.unit-list { margin-top: 14px; }
.unit-list h4 { font-size: 13px; color: var(--sm-muted, #64748b); margin-bottom: 8px; }
.unit-chip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 5px 10px; border-radius: 999px; background: var(--sm-blue-light, #e8f1fa);
  color: var(--sm-blue-dark, #00468c); font-size: 13px; margin: 0 6px 6px 0;
}
.unit-chip-x { border: none; background: none; color: inherit; cursor: pointer; padding: 0; font-size: 12px; }
</style>
