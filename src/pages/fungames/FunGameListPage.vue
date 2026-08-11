<!--
  FunGameListPage.vue
  Manages fun-game (activities) orders booked by guests. Features: status/date/
  supervisor filters, search-as-you-type, create/edit modal with supervisor
  assignment, quick complete/cancel actions and delete. All write actions are
  gated by the canOperate permission. Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: refresh plus permission-gated "new order" button -->
    <div class="page-head">
      <div>
        <h1>{{ $t('funGames.title') }}</h1>
        <p class="muted">{{ $t('funGames.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load"><i class="fas fa-rotate"></i> {{ $t('funGames.refresh') }}</button>
        <button v-if="canOperate" class="btn btn-primary" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('funGames.newOrder') }}</button>
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filter bar: narrows orders by status, booking date, supervisor or game name -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('funGames.status') }}</label>
          <SearchableSelect v-model="filters.status" :options="statusOptions" :empty-label="$t('common.all')"
            @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('funGames.bookingDate') }}</label>
          <input v-model="filters.date" type="date" class="input" @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('funGames.supervisor') }}</label>
          <SearchableSelect v-model="filters.supervisor_id" :options="userOptions" :empty-label="$t('common.all')"
            @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input v-model="filters.search" type="text" class="input" :placeholder="$t('funGames.gameName')"
            @input="triggerSearch" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters"><i class="fas fa-filter-circle-xmark"></i> {{ $t('common.clear') }}</button>
        </div>
      </div>
    </div>

    <!-- Loading indicator shown while the list request is in flight -->
    <div v-if="loading" class="alert alert-info">{{ $t('funGames.loading') }}</div>

    <!-- Orders table with status workflow actions and price badges -->
    <div v-else class="table-scroll">
      <table class="table">
      <thead>
        <tr>
          <th>{{ $t('funGames.orderNumber') }}</th>
          <th>{{ $t('funGames.game') }}</th>
          <th>{{ $t('funGames.guest') }}</th>
          <th>{{ $t('funGames.supervisor') }}</th>
          <th>{{ $t('funGames.bookingDate') }}</th>
          <th>{{ $t('funGames.arrivalTime') }}</th>
          <th>{{ $t('funGames.totalCharge') }}</th>
          <th>{{ $t('funGames.status') }}</th>
          <th>{{ $t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="order in orders" :key="order.fun_game_order_id">
          <td><strong>{{ order.order_number }}</strong></td>
          <td>{{ order.game_name || '-' }}</td>
          <td>{{ order.guest_name || '-' }}</td>
          <td>{{ order.supervisor?.full_name || '-' }}</td>
          <td>{{ order.booking_date || '-' }}</td>
          <td>{{ order.arrival_time || '-' }}</td>
          <td><span class="price">TZS {{ Number(order.total_charge).toLocaleString() }}</span></td>
          <td><span class="badge" :class="statusBadge(order.status)">{{ statusLabel(order.status) }}</span></td>
          <td>
            <div class="actions" v-if="canOperate">
              <button v-if="order.status === 'pending'" class="btn btn-sm btn-success" @click="setStatus(order, 'completed')">
                <i class="fas fa-check"></i> {{ $t('funGames.statusCompleted') }}
              </button>
              <button v-if="order.status === 'pending'" class="btn btn-sm btn-danger" @click="setStatus(order, 'cancelled')">
                <i class="fas fa-xmark"></i> {{ $t('funGames.statusCancelled') }}
              </button>
              <button class="btn btn-sm btn-secondary" @click="openEdit(order)"><i class="fas fa-pen"></i> {{ $t('common.edit') }}</button>
              <button class="btn btn-sm btn-danger" @click="remove(order)"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>
        <tr v-if="!orders.length && !loading">
          <td colspan="9" class="muted">{{ $t('funGames.empty') }}</td>
        </tr>
      </tbody>
    </table>
    </div>

    <!-- Pagination controls (shown when there is more than one page of orders) -->
    <div v-if="meta.total > meta.per_page" class="pagination">
      <button class="btn btn-sm btn-secondary" :disabled="!meta.prev_page_url" @click="goPage(meta.current_page - 1)">{{ $t('common.previous') }}</button>
      <span class="muted">{{ $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page }) }}</span>
      <button class="btn btn-sm btn-secondary" :disabled="!meta.next_page_url" @click="goPage(meta.current_page + 1)">{{ $t('common.next') }}</button>
    </div>

    <!-- Create/edit fun-game order modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2><i class="fas fa-gamepad"></i> {{ editing ? $t('funGames.editOrder') : $t('funGames.newOrder') }}</h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('funGames.gameName') }}</label>
              <input v-model="form.game_name" type="text" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('funGames.guestName') }}</label>
              <input v-model="form.guest_name" type="text" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('funGames.bookingDate') }} *</label>
              <input v-model="form.booking_date" type="date" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('funGames.arrivalTime') }} *</label>
              <input v-model="form.arrival_time" type="time" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('funGames.totalCharge') }} *</label>
              <input v-model.number="form.total_charge" type="number" min="0" step="0.01" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('funGames.status') }}</label>
              <SearchableSelect v-model="form.status" :options="statusOptions" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('funGames.supervisor') }}</label>
              <SearchableSelect v-model="form.supervisor_id" :options="userOptions" :empty-label="$t('common.none')" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('funGames.notes') }}</label>
              <textarea v-model="form.notes" rows="2" class="textarea"></textarea>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i> {{ saving ? $t('common.saving') : (editing ? $t('funGames.updateOrder') : $t('funGames.saveOrder')) }}
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
import { funGameApi, userApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'

const { t } = useI18n()
const authStore = useAuthStore()
// Permission flag: order management requires the ability to operate the module.
const canOperate = computed(() => authStore.canOperate)

// List/table state: order rows, user lookups, pagination, filters and UI flags.
const orders = ref([])
const users = ref([])
const page = ref(1)
const meta = ref({ total: 0, per_page: 15, current_page: 1, last_page: 1, prev_page_url: null, next_page_url: null })
const filters = reactive({ status: '', date: '', supervisor_id: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

// Create/edit modal state.
const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
// Form model bound to the order modal fields.
const form = reactive({ game_name: '', guest_name: '', booking_date: '', arrival_time: '', total_charge: null, status: 'pending', supervisor_id: '', notes: '' })

// Order status options used by both the filter bar and the modal form.
const statusOptions = [
  { value: 'pending', label: t('funGames.statusPending') },
  { value: 'completed', label: t('funGames.statusCompleted') },
  { value: 'cancelled', label: t('funGames.statusCancelled') },
]

// Supervisor dropdown options derived from the loaded user list.
const userOptions = computed(() => users.value.map((u) => ({ value: u.user_id, label: u.full_name })))

/** Maps an order status key to its translated display label. */
function statusLabel(s) {
  const map = { pending: t('funGames.statusPending'), completed: t('funGames.statusCompleted'), cancelled: t('funGames.statusCancelled') }
  return map[s] || s
}

/** Returns the CSS badge class for the given order status. */
function statusBadge(s) {
  const map = { pending: 'badge-yellow', completed: 'badge-green', cancelled: 'badge-red' }
  return map[s] || 'badge-gray'
}

/**
 * Fetches the paginated fun-game order list using the current filters and page.
 * Stores the rows and pagination meta, surfacing errors via the error banner.
 */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await funGameApi.index({
      status: filters.status,
      date: filters.date,
      supervisor_id: filters.supervisor_id,
      search: filters.search,
      page: page.value,
      per_page: 15,
    })
    orders.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('funGames.loadError')
  } finally {
    loading.value = false
  }
}

/** Loads the list of users for the supervisor selector; failures are silently ignored. */
async function loadUsers() {
  try {
    users.value = (await userApi.index({ per_page: 100 })).data.data || []
  } catch {
    // ignore
  }
}

/** Sets the page number and reloads the order list. */
function goPage(p) {
  page.value = p
  load()
}

/** Resets all filter criteria and reloads the list from page 1. */
function clearFilters() {
  page.value = 1
  filters.status = ''
  filters.date = ''
  filters.supervisor_id = ''
  filters.search = ''
  load()
}

/** Resets to page 1 and reloads on search input. */
function triggerSearch() {
  page.value = 1
  load()
}

/** Restores the order form to its default empty state. */
function resetForm() {
  form.game_name = ''
  form.guest_name = ''
  form.booking_date = ''
  form.arrival_time = ''
  form.total_charge = null
  form.status = 'pending'
  form.supervisor_id = ''
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
  editingId.value = order.fun_game_order_id
  form.game_name = order.game_name || ''
  form.guest_name = order.guest_name || ''
  form.booking_date = order.booking_date || ''
  form.arrival_time = order.arrival_time || ''
  form.total_charge = order.total_charge
  form.status = order.status
  form.supervisor_id = order.supervisor_id || ''
  form.notes = order.notes || ''
  showModal.value = true
}

/** Hides the create/edit modal. */
function closeModal() {
  showModal.value = false
}

/** Creates or updates the order via the API and refreshes the list on success. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    if (editing.value) {
      await funGameApi.update(editingId.value, form)
      success.value = t('funGames.updated')
    } else {
      await funGameApi.store(form)
      success.value = t('funGames.created')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Updates an order's status directly from the table (e.g. completed/cancelled) and reloads. */
async function setStatus(order, status) {
  error.value = ''
  try {
    await funGameApi.update(order.fun_game_order_id, { status })
    success.value = t('funGames.statusChanged', { status: statusLabel(status) })
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
    await funGameApi.destroy(order.fun_game_order_id)
    success.value = t('funGames.deleteSuccess')
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
  return messages ? Object.values(messages).flat().join(' ') : err.response?.data?.message || t('common.actionFailed')
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
