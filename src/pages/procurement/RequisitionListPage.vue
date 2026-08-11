<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('requisitions.title') }}</h1>
        <p class="muted">{{ $t('requisitions.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load"><i class="fas fa-rotate"></i> {{ $t('requisitions.refresh')
        }}</button>
        <button v-if="canOperate" class="btn btn-primary" @click="openCreate"><i class="fas fa-plus"></i> {{
          $t('requisitions.newRequisition') }}</button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('requisitions.status') }}</label>
          <SearchableSelect v-model="filters.status" :options="statusOptions" :empty-label="$t('common.all')"
            @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('requisitions.priority') }}</label>
          <SearchableSelect v-model="filters.priority" :options="priorityOptions" :empty-label="$t('common.all')"
            @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.department') }}</label>
          <input v-model="filters.department" type="text" class="input"
            :placeholder="$t('requisitions.departmentPlaceholder')" @input="triggerSearch" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters"><i class="fas fa-filter-circle-xmark"></i> {{
            $t('common.clear') }}</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('requisitions.loading') }}</div>

    <div v-else class="table-scroll">
      <table class="table">
      <thead>
        <tr>
          <th>{{ $t('requisitions.reference') }}</th>
          <th>{{ $t('common.department') }}</th>
          <th>{{ $t('requisitions.requestedBy') }}</th>
          <th>{{ $t('requisitions.items') }}</th>
          <th>{{ $t('requisitions.total') }}</th>
          <th>{{ $t('requisitions.priority') }}</th>
          <th>{{ $t('requisitions.status') }}</th>
          <th>{{ $t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="pr in requisitions" :key="pr.pr_id">
          <td><strong>{{ pr.pr_number }}</strong></td>
          <td class="capitalize">{{ pr.department }}</td>
          <td>{{ pr.requester?.full_name || '-' }}</td>
          <td>
            <button class="link-btn" @click="openDetail(pr)">{{ $t('requisitions.viewItems', {
              count: (pr.items ||
                []).length
            }) }}</button>
          </td>
          <td><span class="price">TZS {{ Number(pr.total_amount).toLocaleString() }}</span></td>
          <td><span class="badge" :class="priorityBadge(pr.priority)">{{ pr.priority }}</span></td>
          <td><span class="badge" :class="statusBadge(pr.status)">{{ pr.status }}</span></td>
          <td>
            <div class="actions">
              <button v-if="pr.status === 'pending' && canApprove" class="btn btn-sm btn-success" @click="approve(pr)">
                <i class="fas fa-check"></i> {{ $t('requisitions.approve') }}
              </button>
              <button v-if="pr.status === 'pending' && canApprove" class="btn btn-sm btn-danger"
                @click="openReject(pr)">
                <i class="fas fa-xmark"></i> {{ $t('requisitions.reject') }}
              </button>
              <button v-if="pr.status === 'pending' && canOperate" class="btn btn-sm btn-secondary" @click="cancel(pr)">{{
                $t('common.cancel') }}</button>
            </div>
          </td>
        </tr>
        <tr v-if="!requisitions.length && !loading">
          <td colspan="8" class="muted">{{ $t('requisitions.empty') }}</td>
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

    <!-- Create purchase-requisition modal with line items -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h2><i class="fas fa-file-signature"></i> {{ $t('requisitions.newRequisition') }}</h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('common.department') }} *</label>
              <input v-model="form.department" type="text" class="input" required
                :placeholder="$t('requisitions.departmentPlaceholder')" />
            </div>
            <div class="form-group">
              <label>{{ $t('requisitions.priority') }}</label>
              <SearchableSelect v-model="form.priority" :options="priorityOptions" />
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('requisitions.justification') }}</label>
            <textarea v-model="form.justification" rows="2" class="textarea"></textarea>
          </div>

          <div class="items-head">
            <h3>{{ $t('requisitions.items') }}</h3>
            <button type="button" class="btn btn-sm btn-secondary" @click="addItem"><i class="fas fa-plus"></i> {{
              $t('requisitions.addItem') }}</button>
          </div>

          <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
            <div class="item-grid">
              <div class="form-group">
                <label>{{ $t('requisitions.itemName') }}</label>
                <input v-model="item.item_name" type="text" class="input" required />
              </div>
              <div class="form-group">
                <label>{{ $t('common.description') }}</label>
                <input v-model="item.description" type="text" class="input" />
              </div>
              <div class="form-group">
                <label>{{ $t('requisitions.quantity') }}</label>
                <input v-model.number="item.quantity" type="number" min="0.01" step="0.01" class="input" required />
              </div>
              <div class="form-group">
                <label>{{ $t('common.unit') }}</label>
                <input v-model="item.unit" type="text" class="input"
                  :placeholder="$t('requisitions.unitPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ $t('requisitions.estPrice') }}</label>
                <input v-model.number="item.estimated_price" type="number" min="0" step="0.01" class="input" required />
              </div>
              <div class="form-group item-remove">
                <button type="button" class="btn btn-sm btn-danger" @click="removeItem(idx)"><i
                    class="fas fa-trash"></i></button>
              </div>
            </div>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i> {{ saving ? $t('common.saving') : $t('requisitions.saveRequisition') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Reject-with-comments modal -->
    <div v-if="showReject" class="modal-overlay" @click.self="showReject = false">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-xmark"></i> {{ $t('requisitions.rejectHeading', { reference: rejectPr?.pr_number }) }}
          </h2>
          <button class="modal-close" @click="showReject = false"><i class="fas fa-xmark"></i></button>
        </div>
        <form @submit.prevent="reject">
          <div class="form-group">
            <label>{{ $t('requisitions.comments') }}</label>
            <textarea v-model="rejectComments" rows="3" class="textarea"></textarea>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="showReject = false">{{ $t('common.cancel')
            }}</button>
            <button type="submit" class="btn btn-danger" :disabled="saving">
              <i class="fas fa-xmark"></i> {{ $t('requisitions.reject') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Requisition detail modal with item estimates and subtotals -->
    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = false">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h2><i class="fas fa-file-signature"></i> {{ detail?.pr_number }}</h2>
          <button class="modal-close" @click="showDetail = false"><i class="fas fa-xmark"></i></button>
        </div>
        <p class="muted">
          {{ detail?.department }} · {{ detail?.priority }} · {{ $t('requisitions.requestedByLabel') }} {{
            detail?.requester?.full_name || '-' }}
          <span v-if="detail?.justification"> · {{ detail.justification }}</span>
        </p>
        <div class="table-scroll">
          <table class="table">
          <thead>
            <tr>
              <th>{{ $t('requisitions.tableItem') }}</th>
              <th>{{ $t('requisitions.tableQty') }}</th>
              <th>{{ $t('requisitions.tableUnit') }}</th>
              <th>{{ $t('requisitions.tableEstPrice') }}</th>
              <th>{{ $t('requisitions.tableSubtotal') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in detail?.items || []" :key="item.pr_item_id">
              <td>
                <strong>{{ item.item_name }}</strong>
                <div v-if="item.description" class="muted">{{ item.description }}</div>
              </td>
              <td>{{ item.quantity }}</td>
              <td>{{ item.unit || '-' }}</td>
              <td>TZS {{ Number(item.estimated_price).toLocaleString() }}</td>
              <td><span class="price">TZS {{ Number(item.subtotal).toLocaleString() }}</span></td>
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
import { purchaseRequisitionApi } from '@/api'
import { useI18n } from 'vue-i18n'
import SearchableSelect from '@/components/SearchableSelect.vue'

const { t } = useI18n()

const authStore = useAuthStore()

// Permission gates: approval requires the manager permission; operating is general.
const canApprove = computed(() => authStore.can(80))
const canOperate = computed(() => authStore.canOperate)

// List state: requisitions, pagination, filters, and load flags/messages.
const requisitions = ref([])
const page = ref(1)
const meta = ref({ total: 0, per_page: 15, current_page: 1, last_page: 1, prev_page_url: null, next_page_url: null })
const filters = reactive({ status: '', priority: '', department: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

// Modal state: create form, reject modal, and detail view.
const showModal = ref(false)
const saving = ref(false)
const modalError = ref('')
const showReject = ref(false)
const rejectPr = ref(null)
const rejectComments = ref('')
const showDetail = ref(false)
const detail = ref(null)
const form = reactive({ department: '', priority: 'normal', justification: '', items: [] })

// Dropdown option lists for filters and the create form.
const statusOptions = computed(() => [
  { value: 'pending', label: t('requisitions.statusPending') },
  { value: 'approved', label: t('requisitions.statusApproved') },
  { value: 'rejected', label: t('requisitions.statusRejected') },
  { value: 'cancelled', label: t('requisitions.statusCancelled') },
])

const priorityOptions = computed(() => [
  { value: 'low', label: t('requisitions.priorityLow') },
  { value: 'normal', label: t('requisitions.priorityNormal') },
  { value: 'high', label: t('requisitions.priorityHigh') },
  { value: 'urgent', label: t('requisitions.priorityUrgent') },
])

/** Returns a fresh blank requisition line item. */
function emptyItem() {
  return { item_name: '', description: '', quantity: null, unit: '', estimated_price: null }
}

/** Maps a requisition status to its badge CSS class for the table. */
function statusBadge(s) {
  const map = { pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red', cancelled: 'badge-gray' }
  return map[s] || 'badge-gray'
}

/** Maps a priority level to its badge CSS class for the table. */
function priorityBadge(p) {
  const map = { urgent: 'badge-red', high: 'badge-yellow', normal: 'badge-blue', low: 'badge-gray' }
  return map[p] || 'badge-gray'
}

/** Fetches the paged requisition list using the current filters. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await purchaseRequisitionApi.index({
      status: filters.status,
      priority: filters.priority,
      department: filters.department,
      page: page.value,
      per_page: 15,
    })
    requisitions.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('requisitions.loadError')
  } finally {
    loading.value = false
  }
}

/** Moves to the given page and reloads. */
function goPage(p) {
  page.value = p
  load()
}

/** Resets all filters and reloads from the first page. */
function clearFilters() {
  page.value = 1
  filters.status = ''
  filters.priority = ''
  filters.department = ''
  load()
}

/** Opens the create-requisition modal with a fresh form and one blank line item. */
function openCreate() {
  modalError.value = ''
  form.department = ''
  form.priority = 'normal'
  form.justification = ''
  form.items = [emptyItem()]
  showModal.value = true
}

/** Adds an empty line item row to the requisition form. */
function addItem() {
  form.items.push(emptyItem())
}

/** Removes the line item at the given index. */
function removeItem(idx) {
  form.items.splice(idx, 1)
}

/** Closes the create-requisition modal. */
function closeModal() {
  showModal.value = false
}

/** Creates the requisition, sending only the filled-in line items. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    const res = await purchaseRequisitionApi.store({
      department: form.department,
      priority: form.priority,
      justification: form.justification,
      items: form.items.filter((i) => i.item_name),
    })
    success.value = res.data.message || t('requisitions.createSuccess')
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Shows the requisition detail modal for the selected record. */
function openDetail(pr) {
  detail.value = pr
  showDetail.value = true
}

/** Approves a pending requisition after confirmation. */
async function approve(pr) {
  if (!window.confirm(t('requisitions.approveConfirm', { reference: pr.pr_number }))) return
  error.value = ''
  try {
    const res = await purchaseRequisitionApi.approve(pr.pr_id)
    success.value = res.data.message || t('requisitions.approved')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Opens the reject modal pre-loaded for the given requisition. */
function openReject(pr) {
  rejectPr.value = pr
  rejectComments.value = ''
  showReject.value = true
}

/** Rejects the requisition with the supplied comments. */
async function reject() {
  error.value = ''
  saving.value = true
  try {
    const res = await purchaseRequisitionApi.reject(rejectPr.value.pr_id, { comments: rejectComments.value })
    success.value = res.data.message || t('requisitions.rejected')
    showReject.value = false
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Cancels a pending requisition after confirmation. */
async function cancel(pr) {
  if (!window.confirm(t('requisitions.cancelConfirm', { reference: pr.pr_number }))) return
  error.value = ''
  try {
    const res = await purchaseRequisitionApi.cancel(pr.pr_id)
    success.value = res.data.message || t('requisitions.cancelled')
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

.link-btn {
  color: #005EB8;
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
  color: #005EB8;
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

.modal-sm {
  max-width: 420px;
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
