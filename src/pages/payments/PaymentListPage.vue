<!--
  Payments page (route: /app/payments, name: hotel-payments).
  Hotel staff view of payments: a filterable paginated list with confirm/reject,
  refund, delete and invoice-download actions, plus a record-payment modal.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('payments.title') }}</h1>
        <p class="muted">{{ $t('payments.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('payments.refresh') }}
        </button>
        <button
          v-if="canOperate && bulk.selectedCount > 0"
          class="btn btn-danger"
          @click="showBulkDelete = true"
        >
          <i class="fas fa-trash"></i> {{ $t('common.deleteSelected') }} ({{ bulk.selectedCount }})
        </button>
        <button v-if="canOperate" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('payments.recordPayment') }}
        </button>
        <TableExportButton
          filename="payments"
          :load-all="loadAllPayments"
          :columns="[
            { key: 'transaction_reference', label: $t('payments.tablePayment') },
            { key: 'created_at', label: $t('common.date') },
            { key: 'paid_by', label: $t('payments.tablePayer') },
            { key: 'amount', label: $t('payments.amount') },
            { key: 'payment_method', label: $t('payments.method') },
            { key: 'payment_status', label: $t('common.status') },
          ]"
        />
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Status/method/date-range filters; each change reloads the list -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('common.status') }}</label>
          <SearchableSelect
            v-model="filters.status"
            :options="paymentStatusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('payments.method') }}</label>
          <SearchableSelect
            v-model="filters.method"
            :options="paymentMethodOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('common.from') }}</label>
          <input v-model="filters.from" type="date" class="input" @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.to') }}</label>
          <input v-model="filters.to" type="date" class="input" @change="load" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters">
            <i class="fas fa-filter-circle-xmark"></i> {{ $t('common.clear') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('payments.loading') }}</div>

    <!-- Payment table with per-row confirm/reject/refund/delete/invoice actions -->
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
            <th scope="col">{{ $t('payments.tablePayment') }}</th>
            <th scope="col">{{ $t('payments.reservation') }}</th>
            <th scope="col">{{ $t('payments.tablePayer') }}</th>
            <th scope="col">{{ $t('payments.amount') }}</th>
            <th scope="col">{{ $t('payments.method') }}</th>
            <th scope="col">{{ $t('common.status') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in payments" :key="p.payment_id">
            <td class="bulk-col">
              <input
                v-if="canOperate"
                type="checkbox"
                :checked="bulk.isSelected(p.payment_id)"
                @change="bulk.toggle(p.payment_id)"
              />
            </td>
            <td>
              <strong class="mono">{{
                p.transaction_reference || p.payment_id.slice(0, 8)
              }}</strong>
              <div class="muted">{{ formatDate(p.created_at) }}</div>
            </td>
            <td>
              <span v-if="p.reservation"
                >{{ p.reservation.guest_name }} ·
                {{
                  $t('payments.roomN', {
                    number: p.reservation.room?.room_number || '-',
                  })
                }}</span
              >
              <span v-else class="muted">-</span>
            </td>
            <td>{{ p.paid_by || '-' }}</td>
            <td>
              <span class="price">TZS {{ Number(p.amount).toLocaleString() }}</span>
            </td>
            <td>
              <span class="provider-cell" :class="{ 'is-bank': p.payment_method === 'bank' }">
                <span v-if="p.payment_provider">
                  <ProviderLogo :provider="p.payment_provider" />
                  <span class="capitalize">{{ providerLabel(p.payment_provider) }}</span>
                </span>
                <span v-else class="capitalize">{{ methodLabel(p.payment_method) }}</span>
              </span>
            </td>
            <td>
              <span class="badge" :class="statusBadge(p.payment_status)">{{
                p.payment_status
              }}</span>
            </td>
            <td>
              <div class="actions">
                <button
                  v-if="isConfirmable(p) && canOperate"
                  class="btn btn-sm btn-success"
                  @click="confirmPayment(p)"
                >
                  <i class="fas fa-check"></i> {{ $t('payments.actionConfirm') }}
                </button>
                <button
                  v-if="isConfirmable(p) && canOperate"
                  class="btn btn-sm btn-danger"
                  @click="rejectPayment(p)"
                >
                  <i class="fas fa-xmark"></i> {{ $t('payments.actionReject') }}
                </button>
                <button
                  v-if="p.reservation_id"
                  class="btn btn-sm btn-secondary"
                  :disabled="invoiceFor === p.payment_id"
                  @click="downloadInvoice(p)"
                >
                  <i class="fas fa-file-invoice"></i> {{ $t('invoices.download') }}
                </button>
                <button
                  v-if="p.payment_status === 'completed' && canOperate"
                  class="btn btn-sm btn-secondary"
                  @click="refund(p)"
                >
                  <i class="fas fa-rotate-left"></i> {{ $t('payments.actionRefund') }}
                </button>
                <button
                  v-if="isDeletable(p) && canOperate"
                  class="btn btn-sm btn-secondary"
                  @click="remove(p)"
                >
                  <i class="fas fa-trash"></i> {{ $t('common.delete') }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!payments.length && !loading">
            <td colspan="8" class="muted">{{ $t('payments.empty') }}</td>
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

    <!-- Record a new payment against a reservation modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2><i class="fas fa-money-bill-wave"></i> {{ $t('payments.recordPayment') }}</h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('payments.reservation') }}</label>
              <SearchableSelect
                v-model="form.reservation_id"
                :options="reservationOptions"
                :empty-label="$t('common.none')"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('payments.amountTzs') }}</label>
              <input
                v-model.number="form.amount"
                type="number"
                min="0.01"
                step="0.01"
                class="input"
                required
              />
            </div>
            <PaymentMethodSelect
              v-model:method="form.payment_method"
              v-model:provider="form.payment_provider"
            />
            <!-- Cash has no receipt reference; bank and mobile money quote the
                 guest's so the money can be matched later. -->
            <div v-if="requiresProvider(form.payment_method)" class="form-group">
              <label>{{ $t('payments.transactionReference') }}</label>
              <input v-model="form.transaction_reference" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('payments.paidBy') }}</label>
              <input v-model="form.paid_by" type="text" class="input" />
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
              {{ saving ? $t('common.saving') : $t('payments.savePayment') }}
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
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { invoiceApi, paymentApi, reservationApi } from '@/api'
import { saveBlob } from '@/utils/download'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'
import { useBulkSelection } from '@/composables/useBulkSelection'
import { collectAllRows } from '@/utils/export'
import PaymentMethodSelect from '@/components/PaymentMethodSelect.vue'
import ProviderLogo from '@/components/ProviderLogo.vue'
import { METHOD_CASH, PAYMENT_METHODS, requiresProvider } from '@/utils/payments'

const { t } = useI18n()
const authStore = useAuthStore()

// Permission gate: whether the current user can operate on payments.
const canOperate = computed(() => authStore.canOperate)

// List state: payments, reservations, pagination, filters, and load flags/messages.
const payments = ref([])
const reservations = ref([])
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({ status: '', method: '', from: '', to: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

const bulk = useBulkSelection(() => payments.value, { idKey: 'payment_id' })
const showBulkDelete = ref(false)
const deleting = ref(false)

// Modal state: record-payment form and the invoice download tracker.
const showModal = ref(false)
const saving = ref(false)
const modalError = ref('')
const invoiceFor = ref('')

/** Downloads the folio invoice of the reservation this payment belongs to. */
async function downloadInvoice(payment) {
  invoiceFor.value = payment.payment_id
  error.value = ''
  success.value = ''
  try {
    const gen = await invoiceApi.generate(payment.reservation_id)
    const invoice = gen.data.invoice
    const res = await invoiceApi.download(invoice.invoice_id)
    saveBlob(res.data, `${invoice.invoice_number}.pdf`)
    success.value = t('invoices.downloaded', { number: invoice.invoice_number })
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    invoiceFor.value = ''
  }
}

// Record-payment form fields.
const form = reactive({
  reservation_id: '',
  amount: null,
  payment_method: 'cash',
  payment_provider: '',
  transaction_reference: '',
  paid_by: '',
  notes: '',
})

// A reference only means something for bank and mobile money; drop it if the
// receptionist switches the method to cash.
watch(
  () => form.payment_method,
  (method) => {
    if (method === METHOD_CASH) form.transaction_reference = ''
  },
)

// Dropdown option lists for the payment filters.
const paymentStatusOptions = computed(() => [
  { value: 'pending', label: t('payments.statusPending') },
  { value: 'awaiting_confirmation', label: t('payments.statusAwaiting') },
  { value: 'completed', label: t('payments.statusCompleted') },
  { value: 'failed', label: t('payments.statusFailed') },
  { value: 'refunded', label: t('payments.statusRefunded') },
])

const paymentMethodOptions = computed(() =>
  PAYMENT_METHODS.map((method) => ({ value: method, label: t(`paymentFields.methods.${method}`) })),
)

/** Confirmed reservations as selectable options, showing their balance. */
const reservationOptions = computed(() =>
  reservations.value.map((reservation) => ({
    value: reservation.reservation_id,
    label: `${reservation.guest_name} · TZS ${Number(reservation.balance).toLocaleString()} ${t('payments.balance')}`,
  })),
)

/** Maps a payment status to its badge CSS class for the table. */
function statusBadge(status) {
  const map = {
    pending: 'badge-yellow',
    awaiting_confirmation: 'badge-yellow',
    completed: 'badge-green',
    failed: 'badge-red',
    refunded: 'badge-gray',
  }
  return map[status] || 'badge-gray'
}

/** Whether a payment is still waiting to be confirmed or rejected. */
function isConfirmable(payment) {
  return ['pending', 'awaiting_confirmation'].includes(payment.payment_status)
}

/** Whether a payment can still be deleted (not completed or refunded). */
function isDeletable(payment) {
  return !['completed', 'refunded'].includes(payment.payment_status)
}

/** Formats an ISO date/time into a short display string. */
function formatDate(date) {
  return date ? String(date).slice(0, 16).replace('T', ' ') : '-'
}

/** Fetches the paged payment list using the current filters. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await paymentApi.index({
      status: filters.status,
      method: filters.method,
      from: filters.from,
      to: filters.to,
      page: page.value,
      per_page: 15,
    })
    payments.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('payments.loadError')
  } finally {
    loading.value = false
  }
}

/** Loads the confirmed reservations available for a new payment. */
async function loadReservations() {
  try {
    const res = await reservationApi.index({ status: 'confirmed', per_page: 100 })
    reservations.value = res.data.data || []
  } catch {
    // ignore
  }
}

function loadAllPayments() {
  return collectAllRows((page, perPage) =>
    paymentApi.index({
      status: filters.status,
      method: filters.method,
      from: filters.from,
      to: filters.to,
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
  filters.status = ''
  filters.method = ''
  filters.from = ''
  filters.to = ''
  load()
}

/** Opens the record-payment modal with a fresh form. */
function openCreate() {
  modalError.value = ''
  form.reservation_id = ''
  form.amount = null
  form.payment_method = 'cash'
  form.payment_provider = ''
  form.transaction_reference = ''
  form.paid_by = ''
  form.notes = ''
  showModal.value = true
}

/** Translates a payment method code into its display label. */
function methodLabel(method) {
  return t(`paymentFields.methods.${method}`)
}

/** Translates a payment provider code into its display label. */
function providerLabel(provider) {
  return t(`paymentFields.providers.${provider}`)
}

/** Closes the record-payment modal. */
function closeModal() {
  showModal.value = false
}

/** Records a new payment against the selected reservation. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    const res = await paymentApi.store({
      ...form,
      reservation_id: form.reservation_id || undefined,
      payment_provider: form.payment_provider || undefined,
    })
    success.value = res.data.message || t('payments.recorded')
    showModal.value = false
    await Promise.all([load(), loadReservations()])
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Refunds a completed payment after confirmation. */
async function refund(payment) {
  if (
    !window.confirm(
      t('payments.refundConfirm', { amount: Number(payment.amount).toLocaleString() }),
    )
  )
    return
  error.value = ''
  try {
    const res = await paymentApi.refund(payment.payment_id, {})
    success.value = res.data.message || t('payments.refunded')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Confirms a pending payment, prompting for the transaction reference. */
async function confirmPayment(payment) {
  const reference = window.prompt(
    t('payments.confirmReferencePrompt'),
    payment.transaction_reference || '',
  )
  if (reference === null) return
  error.value = ''
  try {
    const res = await paymentApi.confirm(payment.payment_id, {
      transaction_reference: reference || undefined,
    })
    success.value = res.data.message || t('payments.confirmed')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Rejects a pending payment after confirmation. */
async function rejectPayment(payment) {
  if (!window.confirm(t('payments.rejectConfirm'))) return
  error.value = ''
  try {
    const res = await paymentApi.reject(payment.payment_id, {})
    success.value = res.data.message || t('payments.rejected')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Deletes a deletable payment after confirmation. */
async function remove(payment) {
  if (
    !window.confirm(
      t('payments.deleteConfirm', { amount: Number(payment.amount).toLocaleString() }),
    )
  )
    return
  error.value = ''
  try {
    const res = await paymentApi.destroy(payment.payment_id)
    success.value = res.data.message || t('payments.deleted')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/**
 * Deletes every selected payment; the typed-confirmation modal guards the action.
 */
async function bulkDelete() {
  error.value = ''
  deleting.value = true
  try {
    const { tried, failed } = await bulk.removeMany((id) => paymentApi.destroy(id))
    if (failed > 0) {
      error.value = t('payments.bulkDeletePartial', { tried, failed })
    } else if (tried > 0) {
      success.value = t('payments.bulkDeleteSuccess', { count: tried })
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

/** Flattens Laravel-style validation errors into a single readable message. */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
}

onMounted(() => {
  load()
  loadReservations()
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

.mono {
  font-family: monospace;
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

.provider-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
