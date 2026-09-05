<!--
  PurchaseOrderListPage.vue
  Purchase order register with a two-stage approval workflow (manager approval
  via permission 80, then finance approval via permission 70). Features:
  status/supplier filters, debounced search, create modal with dynamic line
  items and optional linked requisition, and a read-only detail modal.
  Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: refresh plus permission-gated "new purchase order" button -->
    <div class="page-head">
      <div>
        <h1>{{ $t('purchaseOrders.title') }}</h1>
        <p class="muted">{{ $t('purchaseOrders.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('purchaseOrders.refresh') }}
        </button>
        <button v-if="canOperate" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('purchaseOrders.newPurchaseOrder') }}
        </button>
        <TableExportButton filename="purchase-orders" :load-all="loadAllOrders" :title="$t('purchaseOrders.title')" />
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filter bar: free-text search (debounced), status and supplier -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input v-model="filters.search" type="text" class="input"
            :placeholder="$t('purchaseOrders.searchPlaceholder')" @input="triggerSearch" />
        </div>
        <div class="form-group">
          <label>{{ $t('purchaseOrders.status') }}</label>
          <SearchableSelect v-model="filters.status" :options="statusOptions" :empty-label="$t('common.all')"
            @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('purchaseOrders.supplier') }}</label>
          <SearchableSelect v-model="filters.supplier_id" :options="supplierOptions"
            :empty-label="$t('purchaseOrders.allSuppliers')" @change="load" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters">
            <i class="fas fa-filter-circle-xmark"></i> {{ $t('common.clear') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading indicator shown while the list request is in flight -->
    <div v-if="loading" class="alert alert-info">{{ $t('purchaseOrders.loading') }}</div>

    <!-- PO table: reference, supplier, item count link, total, delivery date and status badge -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('purchaseOrders.reference') }}</th>
            <th scope="col">{{ $t('purchaseOrders.supplier') }}</th>
            <th scope="col">{{ $t('common.items') }}</th>
            <th scope="col">{{ $t('purchaseOrders.total') }}</th>
            <th scope="col">{{ $t('purchaseOrders.delivery') }}</th>
            <th scope="col">{{ $t('purchaseOrders.status') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="po in orders" :key="po.po_id">
            <td>
              <strong>{{ po.po_number }}</strong>
            </td>
            <td>{{ po.supplier?.supplier_name || '-' }}</td>
            <td>
              <button class="link-btn" @click="openDetail(po)">
                {{
                  $t('purchaseOrders.viewItems', {
                    count: (po.items || []).length,
                  })
                }}
              </button>
            </td>
            <td>
              <span class="price">TZS {{ Number(po.total_amount).toLocaleString() }}</span>
            </td>
            <td>{{ po.delivery_date || '-' }}</td>
            <td>
              <span class="badge" :class="statusBadge(po.status)">{{
                po.status.replace('_', ' ')
                }}</span>
            </td>
            <td>
              <!-- Approval workflow actions, each gated by status and permission -->
              <div class="actions">
                <button v-if="po.status === 'pending' && canManagerApprove" class="btn btn-sm btn-success"
                  @click="managerApprove(po)">
                  <i class="fas fa-check"></i> {{ $t('purchaseOrders.managerApprove') }}
                </button>
                <button v-if="po.status === 'manager_approved' && canApprove" class="btn btn-sm btn-success"
                  @click="approve(po)">
                  <i class="fas fa-check"></i> {{ $t('purchaseOrders.financeApprove') }}
                </button>
                <button v-if="['pending', 'manager_approved'].includes(po.status) && canManagerApprove" class="btn btn-sm btn-danger"
                  @click="rejectPo(po)">
                  <i class="fas fa-xmark"></i> {{ $t('purchaseOrders.reject') }}
                </button>
                <button v-if="
                  ['pending', 'manager_approved', 'approved'].includes(po.status) && canOperate
                " class="btn btn-sm btn-danger" @click="cancel(po)">
                  <i class="fas fa-ban"></i> {{ $t('common.cancel') }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!orders.length && !loading">
            <td colspan="7" class="muted">{{ $t('purchaseOrders.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Server-side pagination controls -->
    <div v-if="meta.total > meta.per_page" class="pagination">
      <button class="btn btn-sm btn-secondary" :disabled="!meta.prev_page_url" @click="goPage(meta.current_page - 1)">
        {{ $t('common.previous') }}
      </button>
      <span class="muted">{{
        $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page })
        }}</span>
      <button class="btn btn-sm btn-secondary" :disabled="!meta.next_page_url" @click="goPage(meta.current_page + 1)">
        {{ $t('common.next') }}
      </button>
    </div>

    <!-- Create purchase-order modal (optional linked requisition, line items) -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h2><i class="fas fa-file-invoice"></i> {{ $t('purchaseOrders.newPurchaseOrder') }}</h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('purchaseOrders.supplier') }} *</label>
              <SearchableSelect v-model="form.supplier_id" :options="supplierOptions"
                :empty-label="$t('purchaseOrders.selectSupplier')" required />
            </div>
            <div class="form-group">
              <label>{{ $t('purchaseOrders.linkedRequisition') }}</label>
              <SearchableSelect v-model="form.pr_id" :options="requisitionOptions" :empty-label="$t('common.none')" />
            </div>
            <div class="form-group">
              <label>{{ $t('purchaseOrders.deliveryDate') }}</label>
              <input v-model="form.delivery_date" type="date" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('purchaseOrders.paymentTerms') }}</label>
              <input v-model="form.payment_terms" type="text" class="input"
                :placeholder="$t('purchaseOrders.paymentTermsPlaceholder')" />
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('purchaseOrders.deliveryAddress') }}</label>
            <input v-model="form.delivery_address" type="text" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.notes') }}</label>
            <textarea v-model="form.notes" rows="2" class="textarea"></textarea>
          </div>

          <div class="items-head">
            <h3>{{ $t('common.items') }}</h3>
            <button type="button" class="btn btn-sm btn-secondary" @click="addItem">
              <i class="fas fa-plus"></i> {{ $t('purchaseOrders.addItem') }}
            </button>
          </div>

          <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
            <div class="item-grid">
              <div class="form-group">
                <label>{{ $t('purchaseOrders.itemName') }} *</label>
                <SearchableSelect
                  v-model="item.item_id"
                  :options="itemOptions"
                  :placeholder="$t('inventory.searchItems')"
                  :search-placeholder="$t('inventory.searchItems')"
                  :empty-label="$t('inventory.selectItem')"
                  required
                  @change="onPickItem(idx, $event)"
                >
                  <template #option="{ option }">
                    <span>{{ option.label }} <small class="muted">{{ option.category }}</small></span>
                  </template>
                </SearchableSelect>
              </div>
              <div class="form-group">
                <label>{{ $t('common.description') }}</label>
                <input v-model="item.description" type="text" class="input" />
              </div>
              <div class="form-group">
                <label>{{ $t('purchaseOrders.quantity') }}</label>
                <input v-model.number="item.quantity" type="number" min="0.01" step="0.01" class="input" required />
              </div>
              <div class="form-group">
                <label>{{ $t('common.unit') }}</label>
                <SearchableSelect
                  v-model="item.unit"
                  :options="unitOptionsFor(item)"
                  :searchable="false"
                  :placeholder="$t('purchaseOrders.unitPlaceholder')"
                />
              </div>
              <div class="form-group">
                <label>{{ $t('purchaseOrders.unitPrice') }}</label>
                <input v-model.number="item.unit_price" type="number" min="0" step="0.01" class="input" required />
              </div>
              <div class="form-group item-remove">
                <button type="button" class="btn btn-sm btn-danger" @click="removeItem(idx)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('purchaseOrders.savePurchaseOrder') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Purchase-order detail modal with item quantities and subtotals -->
    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = false">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h2><i class="fas fa-file-invoice"></i> {{ detail?.po_number }}</h2>
          <button class="modal-close" @click="showDetail = false">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <p class="muted">
          {{ detail?.supplier?.supplier_name || '-' }}
          <span v-if="detail?.requisition">
            · {{ $t('common.from') }} {{ detail.requisition.pr_number }}</span>
          <span v-if="detail?.delivery_date">
            · {{ $t('purchaseOrders.deliverBy') }} {{ detail.delivery_date }}</span>
        </p>
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">{{ $t('purchaseOrders.tableItem') }}</th>
                <th scope="col">{{ $t('purchaseOrders.tableQty') }}</th>
                <th scope="col">{{ $t('common.unit') }}</th>
                <th scope="col">{{ $t('purchaseOrders.tableUnitPrice') }}</th>
                <th scope="col">{{ $t('purchaseOrders.statusReceived') }}</th>
                <th scope="col">{{ $t('purchaseOrders.tableSubtotal') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in detail?.items || []" :key="item.po_item_id">
                <td>
                  <strong>{{ item.item_name }}</strong>
                  <div v-if="item.description" class="muted">{{ item.description }}</div>
                </td>
                <td>{{ item.quantity }}</td>
                <td>{{ item.unit || '-' }}</td>
                <td>TZS {{ Number(item.unit_price).toLocaleString() }}</td>
                <td>{{ item.quantity_received }}</td>
                <td>
                  <span class="price">TZS {{ Number(item.subtotal).toLocaleString() }}</span>
                </td>
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
import { useAuthStore } from '@/stores/auth'
import { purchaseOrderApi, purchaseRequisitionApi, supplierApi, inventoryApi } from '@/api'
import { useI18n } from 'vue-i18n'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import { collectAllRows } from '@/utils/export'

const { t } = useI18n()

const authStore = useAuthStore()

// Permission gates for the two-stage approval workflow (manager then finance).
const canManagerApprove = computed(() => authStore.can(80))
const canApprove = computed(() => authStore.can(70))
const canOperate = computed(() => authStore.canOperate)

// List state: POs, supplier/PR/inventory dropdown data, pagination, filters, and load flags/messages.
const orders = ref([])
const suppliers = ref([])
const approvedPrs = ref([])
const inventoryItems = ref([])
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({ status: '', supplier_id: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

// Modal state: create form and detail view.
const showModal = ref(false)
const saving = ref(false)
const modalError = ref('')
const showDetail = ref(false)
const detail = ref(null)
const form = reactive({
  supplier_id: '',
  pr_id: '',
  delivery_date: '',
  delivery_address: '',
  payment_terms: '',
  notes: '',
  items: [],
})

// Dropdown option lists for filters and the create form.
const statusOptions = computed(() => [
  { value: 'pending', label: t('purchaseOrders.statusPending') },
  { value: 'manager_approved', label: t('purchaseOrders.statusManagerApproved') },
  { value: 'approved', label: t('purchaseOrders.statusApproved') },
  { value: 'partially_received', label: t('purchaseOrders.statusPartiallyReceived') },
  { value: 'received', label: t('purchaseOrders.statusReceived') },
  { value: 'cancelled', label: t('purchaseOrders.statusCancelled') },
  { value: 'rejected', label: t('purchaseOrders.statusRejected') },
])

const supplierOptions = computed(() =>
  suppliers.value.map((supplier) => ({
    value: supplier.supplier_id,
    label: supplier.supplier_name,
  })),
)

const requisitionOptions = computed(() =>
  approvedPrs.value.map((pr) => ({ value: pr.pr_id, label: pr.pr_number })),
)

// Registered inventory items become the only selectable line items, so an
// order can only raise registered goods (linkage fixes stock-in on receiving).
const itemOptions = computed(() =>
  inventoryItems.value.map((item) => ({
    value: item.item_id,
    label: `${item.item_name}${item.unit ? ` (${item.unit})` : ''}`,
    category: item.category,
    stock: item.quantity_in_stock,
  })),
)

// Common SI units offered when the picked item registers no units.
const STANDARD_UNITS = [
  'BTL', 'PCS', 'KG', 'L', 'GLN', 'BOX', 'CARTON', 'PKT', 'ROLL', 'DOZ', 'PAIR', 'SET', 'M', 'GM', 'ML', 'TIN', 'SACHET',
]

/**
 * Units shown for a line: the selected item's registered SI units (or its
 * primary unit when it has none), else the common SI-unit list.
 *
 * @param {object} item - The PO line item.
 * @returns {Array<{value: string, label: string}>} Unit dropdown options.
 */
function unitOptionsFor(item) {
  const units = new Set()
  const registered = (item.si_units || []).filter(Boolean)
  if (registered.length) {
    registered.forEach((u) => units.add(u))
  } else if (item.unit) {
    units.add(item.unit)
  } else {
    STANDARD_UNITS.forEach((u) => units.add(u))
  }
  return Array.from(units).map((u) => ({ value: u, label: u }))
}

/**
 * Applies a picked registered inventory item to a PO line: captures its
 * id, name, registered SI units and default unit so the backend can
 * stock-in the right record.
 *
 * @param {number} idx - Index of the line item in the form.
 * @param {string} value - The chosen inventory item id.
 */
function onPickItem(idx, value) {
  const line = form.items[idx]
  const found = inventoryItems.value.find((i) => String(i.item_id) === String(value))
  line.item_id = value
  line.item_name = found?.item_name || ''
  line.si_units = found?.si_units?.length ? [...found.si_units] : []
  if (found?.unit) line.unit = found.unit
}

/** Returns a fresh blank PO line item. */
function emptyItem() {
  return { item_id: '', item_name: '', description: '', quantity: null, unit: '', si_units: [], unit_price: null }
}

/** Maps a PO status to its badge CSS class for the table. */
function statusBadge(status) {
  const map = {
    pending: 'badge-yellow',
    manager_approved: 'badge-blue',
    approved: 'badge-green',
    partially_received: 'badge-yellow',
    received: 'badge-green',
    cancelled: 'badge-red',
    rejected: 'badge-red',
  }
  return map[status] || 'badge-gray'
}

// Debounce timer for the search input.
let searchTimeout = null

/** Fetches the paged PO list using the current filters. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await purchaseOrderApi.index({
      status: filters.status,
      supplier_id: filters.supplier_id,
      search: filters.search || undefined,
      page: page.value,
      per_page: 15,
    })
    orders.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('purchaseOrders.loadError')
  } finally {
    loading.value = false
  }
}

const loadAllOrders = () =>
  collectAllRows((page, perPage) =>
    purchaseOrderApi.index({
      status: filters.status,
      supplier_id: filters.supplier_id,
      search: filters.search || undefined,
      page,
      per_page: perPage,
    }),
  )

/** Debounced search: waits for a pause in typing before reloading. */
function triggerSearch() {
  page.value = 1
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    load()
  }, 250)
}

/** Loads the suppliers, approved requisitions and inventory for the dropdowns. */
async function loadOptions() {
  try {
    const [s, pr, inv] = await Promise.all([
      supplierApi.index({ per_page: 100 }),
      purchaseRequisitionApi.index({ status: 'approved', per_page: 100 }),
      inventoryApi.index({ per_page: 200 }),
    ])
    suppliers.value = s.data.data || []
    approvedPrs.value = pr.data.data || []
    inventoryItems.value = inv.data.data || []
  } catch {
    // ignore
  }
}

/** Moves to the given page and reloads. */
function goPage(page) {
  page.value = page
  load()
}

/** Resets all filters and reloads from the first page. */
function clearFilters() {
  page.value = 1
  filters.status = ''
  filters.supplier_id = ''
  filters.search = ''
  load()
}

/** Opens the create-PO modal with a fresh form and one blank line item. */
function openCreate() {
  modalError.value = ''
  form.supplier_id = ''
  form.pr_id = ''
  form.delivery_date = ''
  form.delivery_address = ''
  form.payment_terms = ''
  form.notes = ''
  form.items = [emptyItem()]
  showModal.value = true
}

/** Adds an empty line item row to the PO form. */
function addItem() {
  form.items.push(emptyItem())
}

/** Removes the line item at the given index. */
function removeItem(idx) {
  form.items.splice(idx, 1)
}

/** Closes the create-PO modal. */
function closeModal() {
  showModal.value = false
}

/** Creates the PO, sending only the filled-in line items. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    const res = await purchaseOrderApi.store({
      ...form,
      pr_id: form.pr_id || undefined,
      items: form.items.filter((item) => item.item_name),
    })
    success.value = res.data.message || t('purchaseOrders.createSuccess')
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Shows the PO detail modal for the selected order. */
function openDetail(po) {
  detail.value = po
  showDetail.value = true
}

/** Moves a pending PO to manager approval after confirmation. */
async function managerApprove(po) {
  if (!window.confirm(t('purchaseOrders.managerApproveConfirm', { reference: po.po_number })))
    return
  error.value = ''
  try {
    const res = await purchaseOrderApi.managerApprove(po.po_id)
    success.value = res.data.message || t('purchaseOrders.managerApproved')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Finance approval of a manager-approved PO after confirmation. */
async function approve(po) {
  if (!window.confirm(t('purchaseOrders.financeApproveConfirm', { reference: po.po_number })))
    return
  error.value = ''
  try {
    const res = await purchaseOrderApi.approve(po.po_id)
    success.value = res.data.message || t('purchaseOrders.approved')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Rejects a pending PO (leader sign-off) with an optional reason. */
async function rejectPo(po) {
  const reason = window.prompt(t('purchaseOrders.rejectReason'), '')
  if (reason === null) return
  if (!window.confirm(t('purchaseOrders.rejectConfirm', { reference: po.po_number }))) return
  error.value = ''
  try {
    const res = await purchaseOrderApi.reject(po.po_id, { reason })
    success.value = res.data.message || t('purchaseOrders.rejected')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Cancels an unapproved PO after confirmation. */
async function cancel(po) {
  if (!window.confirm(t('purchaseOrders.cancelConfirm', { reference: po.po_number }))) return
  error.value = ''
  try {
    const res = await purchaseOrderApi.cancel(po.po_id)
    success.value = res.data.message || t('purchaseOrders.cancelled')
    await load()
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
  loadOptions()
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
  grid-template-columns: repeat(2, 1fr) auto;
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

.price {
  font-weight: 700;
  color: #005eb8;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.link-btn {
  color: #005eb8;
  font-weight: 600;
  background: none;
  border: none;
  padding: 0;
  font-size: 13px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.items-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 18px 0 12px;
}

.items-head h3 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #005eb8;
}

.item-row {
  border: 1px solid #f1f1f1;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
}

.item-grid {
  display: grid;
  grid-template-columns: 2fr 2fr 1fr 1fr 1fr auto;
  gap: 10px;
  align-items: end;
}

.item-remove {
  padding-bottom: 1px;
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

.modal-lg {
  max-width: 820px;
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

  .item-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
