<!--
  LaundryListPage.vue
  Guest laundry order management. Features: service/status/payment/date filters,
  order-number search, create/edit modal with dynamic line items and a live
  estimated charge, quick status transitions (pending → ready → delivered,
  cancel) and delete. Management actions gated by module 40 permissions.
  Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: refresh plus permission-gated "new order" button -->
    <div class="page-head">
      <div>
        <h1>{{ $t('laundry.title') }}</h1>
        <p class="muted">{{ $t('laundry.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('laundry.refresh') }}
        </button>
        <button v-if="canManage" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('laundry.newOrder') }}
        </button>
        <TableExportButton filename="laundry" :load-all="loadAllOrders" />
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filter bar: narrows orders by service, status, payment status, date or order number -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('laundry.service') }}</label>
          <SearchableSelect
            v-model="filters.service"
            :options="serviceOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('laundry.status') }}</label>
          <SearchableSelect
            v-model="filters.status"
            :options="statusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('orders.payment') }}</label>
          <SearchableSelect
            v-model="filters.payment_status"
            :options="paymentStatusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('laundry.orderDate') }}</label>
          <input v-model="filters.date" type="date" class="input" @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input
            v-model="filters.search"
            type="text"
            class="input"
            :placeholder="$t('laundry.orderNumber')"
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
    <div v-if="loading" class="alert alert-info">{{ $t('laundry.loading') }}</div>

    <!-- Orders table with status workflow actions and payment badges -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('laundry.orderNumber') }}</th>
            <th scope="col">{{ $t('laundry.guest') }}</th>
            <th scope="col">{{ $t('laundry.room') }}</th>
            <th scope="col">{{ $t('laundry.tableService') }}</th>
            <th scope="col">{{ $t('laundry.items') }}</th>
            <th scope="col">{{ $t('laundry.totalCharge') }}</th>
            <th scope="col">{{ $t('laundry.attendant') }}</th>
            <th scope="col">{{ $t('laundry.status') }}</th>
            <th scope="col">{{ $t('orders.payment') }}</th>
            <th scope="col">{{ $t('laundry.orderDate') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.laundry_order_id">
            <td>
              <strong>{{ order.order_number }}</strong>
            </td>
            <td>{{ order.guest_name || '-' }}</td>
            <td>{{ order.room_number || '-' }}</td>
            <td class="capitalize">{{ serviceLabel(order.service) }}</td>
            <td>{{ order.items_count || '-' }}</td>
            <td>
              <span class="price">TZS {{ Number(order.total_charge).toLocaleString() }}</span>
            </td>
            <td>{{ order.attendant?.full_name || '-' }}</td>
            <td>
              <span class="badge" :class="statusBadge(order.status)">{{
                statusLabel(order.status)
              }}</span>
              <div v-if="order.ready_at" class="muted">
                {{ $t('laundry.readyAt') }} {{ formatDateTime(order.ready_at) }}
              </div>
              <div v-if="order.delivered_at" class="muted">
                {{ $t('laundry.deliveredAt') }} {{ formatDateTime(order.delivered_at) }}
              </div>
            </td>
            <td>
              <span class="badge" :class="paymentBadge(order.payment_status)">{{
                order.payment_status.replace('_', ' ')
              }}</span>
            </td>
            <td>{{ order.order_date || '-' }}</td>
            <td>
              <div class="actions" v-if="canManage">
                <button
                  v-if="order.status === 'pending'"
                  class="btn btn-sm btn-secondary"
                  @click="setStatus(order, 'ready')"
                >
                  <i class="fas fa-check-double"></i> {{ $t('laundry.statusReady') }}
                </button>
                <button
                  v-if="order.status === 'ready'"
                  class="btn btn-sm btn-success"
                  @click="setStatus(order, 'delivered')"
                >
                  <i class="fas fa-truck"></i> {{ $t('laundry.statusDelivered') }}
                </button>
                <button
                  v-if="order.status === 'pending'"
                  class="btn btn-sm btn-danger"
                  @click="setStatus(order, 'cancelled')"
                >
                  <i class="fas fa-ban"></i> {{ $t('laundry.statusCancelled') }}
                </button>
                <button class="btn btn-sm btn-secondary" @click="openEdit(order)">
                  <i class="fas fa-pen"></i> {{ $t('common.edit') }}
                </button>
                <button class="btn btn-sm btn-danger" @click="remove(order)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
              <span v-else class="muted">—</span>
            </td>
          </tr>
          <tr v-if="!orders.length && !loading">
            <td colspan="11" class="muted">{{ $t('laundry.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination controls (shown when there is more than one page of orders) -->
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

    <!-- Create/edit order modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-jug-detergent"></i>
            {{ editing ? $t('laundry.editOrder') : $t('laundry.newOrder') }}
          </h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('laundry.guestName') }}</label>
              <input v-model="form.guest_name" type="text" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('laundry.service') }} *</label>
              <SearchableSelect v-model="form.service" :options="serviceOptions" required />
            </div>
            <div class="form-group">
              <label>{{ $t('laundry.room') }}</label>
              <input
                v-model="form.room_number"
                type="text"
                class="input"
                :placeholder="$t('laundry.roomNumberPlaceholder')"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('laundry.status') }}</label>
              <SearchableSelect v-model="form.status" :options="statusOptions" />
            </div>
            <div class="form-group">
              <label>{{ $t('laundry.orderDate') }}</label>
              <input v-model="form.order_date" type="date" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('laundry.paymentStatus') }}</label>
              <SearchableSelect v-model="form.payment_status" :options="paymentStatusOptions" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('laundry.attendant') }}</label>
              <SearchableSelect
                v-model="form.attendant_id"
                :options="userOptions"
                :empty-label="$t('common.none')"
              />
            </div>
          </div>

          <!-- Line items: repeatable rows of item name, quantity, unit price and a remove button -->
          <div class="items-head">
            <h3>{{ $t('laundry.lineItems') }}</h3>
            <button type="button" class="btn btn-sm btn-secondary" @click="addItem">
              <i class="fas fa-plus"></i> {{ $t('laundry.addItem') }}
            </button>
          </div>
          <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
            <div class="item-grid">
              <div class="form-group">
                <label>{{ $t('laundry.itemName') }}</label>
                <input v-model="item.item_name" type="text" class="input" required />
              </div>
              <div class="form-group">
                <label>{{ $t('orders.quantity') }}</label>
                <input
                  v-model.number="item.quantity"
                  type="number"
                  min="1"
                  class="input"
                  required
                />
              </div>
              <div class="form-group">
                <label>{{ $t('laundry.unitPrice') }}</label>
                <input
                  v-model.number="item.unit_price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="input"
                  required
                />
              </div>
              <div class="form-group item-remove">
                <button type="button" class="btn btn-sm btn-danger" @click="removeItem(idx)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
          <p v-if="form.items.length" class="muted">
            {{
              $t('laundry.estimatedCharge', { amount: Number(estimatedCharge).toLocaleString() })
            }}
          </p>

          <div class="form-group form-full">
            <label>{{ $t('laundry.notes') }}</label>
            <textarea v-model="form.notes" rows="2" class="textarea"></textarea>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{
                saving
                  ? $t('common.saving')
                  : editing
                    ? $t('laundry.updateOrder')
                    : $t('laundry.saveOrder')
              }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { laundryApi, userApi } from '@/api'
import { collectAllRows } from '@/utils/export'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'

const { t } = useI18n()
const authStore = useAuthStore()
// Permission flag: laundry management requires module 40 access plus the ability to operate.
const canManage = computed(() => authStore.can(40) && authStore.canOperate)

// List/table state: order rows, user lookups, pagination, filters and UI flags.
const orders = ref([])
const users = ref([])
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({ service: '', status: '', payment_status: '', date: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

// Create/edit modal state.
const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
// Form model bound to the order modal, including dynamic line items.
const form = reactive({
  guest_name: '',
  service: 'wash',
  room_number: '',
  items: [],
  status: 'pending',
  payment_status: 'unpaid',
  order_date: '',
  attendant_id: '',
  notes: '',
})

// Laundry service types offered to guests (filter bar and form).
const serviceOptions = [
  { value: 'wash', label: t('laundry.serviceWash') },
  { value: 'iron', label: t('laundry.serviceIron') },
  { value: 'dry_clean', label: t('laundry.serviceDryClean') },
]

// Order workflow statuses (filter bar and form).
const statusOptions = [
  { value: 'pending', label: t('laundry.statusPending') },
  { value: 'ready', label: t('laundry.statusReady') },
  { value: 'delivered', label: t('laundry.statusDelivered') },
  { value: 'cancelled', label: t('laundry.statusCancelled') },
]

// Payment statuses shared with the F&B orders module (labels come from orders.*).
const paymentStatusOptions = [
  { value: 'unpaid', label: t('orders.paymentUnpaid') },
  { value: 'paid', label: t('orders.paymentPaid') },
  { value: 'billed_to_room', label: t('orders.paymentBilledToRoom') },
]

// Attendant dropdown options derived from the loaded user list.
const userOptions = computed(() =>
  users.value.map((user) => ({ value: user.user_id, label: user.full_name })),
)

/** Maps an order status key to its translated display label. */
function statusLabel(status) {
  const map = {
    pending: t('laundry.statusPending'),
    ready: t('laundry.statusReady'),
    delivered: t('laundry.statusDelivered'),
    cancelled: t('laundry.statusCancelled'),
  }
  return map[status] || status
}

/** Returns the CSS badge class for the given order status. */
function statusBadge(status) {
  const map = {
    pending: 'badge-yellow',
    ready: 'badge-blue',
    delivered: 'badge-green',
    cancelled: 'badge-red',
  }
  return map[status] || 'badge-gray'
}

/** Returns the CSS badge class for the given payment status. */
function paymentBadge(status) {
  const map = { unpaid: 'badge-red', paid: 'badge-green', billed_to_room: 'badge-blue' }
  return map[status] || 'badge-gray'
}

/** Maps a laundry service key to its translated display label. */
function serviceLabel(service) {
  const map = {
    wash: t('laundry.serviceWash'),
    iron: t('laundry.serviceIron'),
    dry_clean: t('laundry.serviceDryClean'),
  }
  return map[service] || service
}

/** Formats an ISO datetime string for display, or '-' when absent. */
function formatDateTime(date) {
  return date ? String(date).slice(0, 16).replace('T', ' ') : '-'
}

/** Creates a blank line-item object for the items list. */
function emptyItem() {
  return { item_name: '', quantity: 1, unit_price: 0 }
}

/** Appends a blank line item to the form. */
function addItem() {
  form.items.push(emptyItem())
}

/** Removes the line item at the given index from the form. */
function removeItem(idx) {
  form.items.splice(idx, 1)
}

/** Computes the estimated total charge from the entered line items. */
const estimatedCharge = computed(() =>
  form.items.reduce(
    (sum, item) => sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 0),
    0,
  ),
)

/**
 * Fetches the paginated laundry order list using the current filters and page.
 * Stores the rows and pagination meta, surfacing errors via the error banner.
 */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await laundryApi.index({
      service: filters.service,
      status: filters.status,
      payment_status: filters.payment_status,
      date: filters.date,
      search: filters.search,
      page: page.value,
      per_page: 15,
    })
    orders.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('laundry.loadError')
  } finally {
    loading.value = false
  }
}

/** Fetches every laundry order page for export, honouring the active filters. */
const loadAllOrders = () =>
  collectAllRows((page, perPage) =>
    laundryApi.index({
      service: filters.service,
      status: filters.status,
      payment_status: filters.payment_status,
      date: filters.date,
      search: filters.search,
      page,
      per_page: perPage,
    }),
  )

/** Loads the list of users for the attendant selector; failures are silently ignored. */
async function loadUsers() {
  try {
    users.value = (await userApi.index({ per_page: 100 })).data.data || []
  } catch {
    // ignore
  }
}

/** Sets the page number and reloads the order list. */
function goPage(page) {
  page.value = page
  load()
}

/** Resets all filter criteria and reloads the list from page 1. */
function clearFilters() {
  page.value = 1
  filters.service = ''
  filters.status = ''
  filters.payment_status = ''
  filters.date = ''
  filters.search = ''
  load()
}

/** Debounces search input by resetting to page 1 and reloading. */
function triggerSearch() {
  page.value = 1
  load()
}

/** Restores the order form to its default empty state with one blank line item. */
function resetForm() {
  form.guest_name = ''
  form.service = 'wash'
  form.room_number = ''
  form.items = [emptyItem()]
  form.status = 'pending'
  form.payment_status = 'unpaid'
  form.order_date = ''
  form.attendant_id = ''
  form.notes = ''
}

/** Prepares the modal for creating a brand-new order. */
function openCreate() {
  resetForm()
  modalError.value = ''
  editing.value = false
  editingId.value = null
  showModal.value = true
}

/** Fills the form with an existing order's data and opens the modal in edit mode. */
function openEdit(order) {
  modalError.value = ''
  editing.value = true
  editingId.value = order.laundry_order_id
  form.guest_name = order.guest_name || ''
  form.service = order.service
  form.room_number = order.room_number || ''
  form.items = (order.items || []).map((item) => ({
    item_name: item.item_name,
    quantity: item.quantity,
    unit_price: Number(item.unit_price),
  }))
  form.status = order.status
  form.payment_status = order.payment_status || 'unpaid'
  form.order_date = order.order_date || ''
  form.attendant_id = order.attendant_id || ''
  form.notes = order.notes || ''
  showModal.value = true
}

/** Hides the create/edit modal. */
function closeModal() {
  showModal.value = false
}

/**
 * Builds the API payload from the form, dropping blank line items and empty optional fields.
 * @returns {object} The payload for create/update requests.
 */
function buildPayload() {
  return {
    guest_name: form.guest_name,
    service: form.service,
    room_number: form.room_number,
    items: form.items
      .filter((item) => item.item_name)
      .map((item) => ({
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    status: form.status,
    payment_status: form.payment_status,
    order_date: form.order_date,
    attendant_id: form.attendant_id || undefined,
    notes: form.notes,
  }
}

/** Creates or updates the order via the API and refreshes the list on success. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    const payload = buildPayload()
    if (editing.value) {
      await laundryApi.update(editingId.value, payload)
      success.value = t('laundry.updated')
    } else {
      await laundryApi.store(payload)
      success.value = t('laundry.created')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Updates an order's status directly from the table (e.g. ready/delivered/cancelled) and reloads. */
async function setStatus(order, status) {
  error.value = ''
  try {
    await laundryApi.update(order.laundry_order_id, { status })
    success.value = t('laundry.statusChanged', { status: statusLabel(status) })
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Deletes an order after a confirmation prompt, then reloads the list. */
async function remove(order) {
  if (!window.confirm(t('common.delete'))) return
  error.value = ''
  try {
    await laundryApi.destroy(order.laundry_order_id)
    success.value = t('laundry.deleteSuccess')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/**
 * Flattens a validation/API error into a single readable message string.
 * @param {Error} err - The thrown request error.
 * @returns {string} A space-joined error message or the generic failure text.
 */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
}

onMounted(() => {
  load()
  loadUsers()
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
  grid-template-columns: repeat(5, 1fr) auto;
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
  grid-template-columns: 3fr 1fr 1fr auto;
  gap: 10px;
  align-items: end;
}

.item-remove {
  padding-bottom: 1px;
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
