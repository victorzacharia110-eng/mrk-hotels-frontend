<!--
  GoodsReceivedNoteListPage.vue
  Goods Received Notes (GRN) register for procurement. Staff filter by purchase
  order, inspection status and date range; new GRNs are captured in a modal whose
  line items auto-fill from the selected PO, and each GRN has a read-only detail
  view with received/rejected quantities. Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: refresh plus permission-gated "new entry" button -->
    <div class="page-head">
      <div>
        <h1>{{ $t('goodsReceived.title') }}</h1>
        <p class="muted">{{ $t('goodsReceived.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('goodsReceived.refresh') }}
        </button>
        <button v-if="canOperate" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('goodsReceived.newEntry') }}
        </button>
        <TableExportButton
          filename="goods-received-notes"
          :load-all="loadAllGrns"
          :title="$t('goodsReceived.title')"
        />
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filter bar: purchase order, inspection status and received-date range -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('goodsReceived.po') }}</label>
          <SearchableSelect
            v-model="filters.po_id"
            :options="purchaseOrderOptions"
            :empty-label="$t('goodsReceived.allPos')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('goodsReceived.inspectionStatus') }}</label>
          <SearchableSelect
            v-model="filters.inspection_status"
            :options="inspectionStatusOptions"
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

    <!-- Loading indicator shown while the list request is in flight -->
    <div v-if="loading" class="alert alert-info">{{ $t('goodsReceived.loading') }}</div>

    <!-- GRN table: reference, linked PO/supplier, received date and inspection badge -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('goodsReceived.reference') }}</th>
            <th scope="col">{{ $t('goodsReceived.po') }}</th>
            <th scope="col">{{ $t('goodsReceived.supplier') }}</th>
            <th scope="col">{{ $t('goodsReceived.statusReceived') }}</th>
            <th scope="col">{{ $t('goodsReceived.deliveryNote') }}</th>
            <th scope="col">{{ $t('goodsReceived.tableInspection') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="grn in grns" :key="grn.grn_id">
            <td>
              <strong>{{ grn.grn_number }}</strong>
            </td>
            <td>{{ grn.purchase_order?.po_number || '-' }}</td>
            <td>{{ grn.supplier?.supplier_name || '-' }}</td>
            <td>{{ formatDate(grn.received_date) }}</td>
            <td>{{ grn.delivery_note_number || '-' }}</td>
            <td>
              <span class="badge" :class="inspectionBadge(grn.inspection_status)">{{
                grn.inspection_status
              }}</span>
            </td>
            <td>
              <button class="btn btn-sm btn-secondary" @click="openDetail(grn)">
                <i class="fas fa-eye"></i> {{ $t('goodsReceived.view') }}
              </button>
            </td>
          </tr>
          <tr v-if="!grns.length && !loading">
            <td colspan="7" class="muted">{{ $t('goodsReceived.empty') }}</td>
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

    <!-- Create goods-received-note modal (items auto-filled from the selected PO) -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h2><i class="fas fa-clipboard-check"></i> {{ $t('goodsReceived.newEntry') }}</h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('goodsReceived.purchaseOrder') }} *</label>
              <SearchableSelect
                v-model="form.po_id"
                :options="eligiblePurchaseOrderOptions"
                :empty-label="$t('goodsReceived.selectPo')"
                required
                @change="onSelectPo"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('goodsReceived.inspectionStatus') }}</label>
              <SearchableSelect
                v-model="form.inspection_status"
                :options="inspectionStatusOptions"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('goodsReceived.receivedDate') }}</label>
              <input v-model="form.received_date" type="date" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('goodsReceived.deliveryNoteNumber') }}</label>
              <input v-model="form.delivery_note_number" type="text" class="input" />
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('common.notes') }}</label>
            <textarea v-model="form.notes" rows="2" class="textarea"></textarea>
          </div>

          <div v-if="form.items.length" class="items-head">
            <h3>{{ $t('goodsReceived.receivedItems') }}</h3>
          </div>

          <div v-for="item in form.items" :key="item.po_item_id" class="item-row">
            <div class="item-grid">
              <div class="form-group">
                <label>{{ $t('goodsReceived.item') }}</label>
                <input :value="item.item_name" type="text" class="input" disabled />
              </div>
              <div class="form-group">
                <label>{{ $t('common.unit') }}</label>
                <input :value="item.unit || '-'" type="text" class="input" disabled />
              </div>
              <div class="form-group">
                <label>{{ $t('goodsReceived.ordered') }}</label>
                <input :value="item.quantity_ordered" type="text" class="input" disabled />
              </div>
              <div class="form-group">
                <label>{{ $t('goodsReceived.qtyReceived') }}</label>
                <input
                  v-model.number="item.quantity_received"
                  type="number"
                  min="0"
                  step="0.01"
                  class="input"
                  required
                />
              </div>
              <div class="form-group">
                <label>{{ $t('goodsReceived.qtyRejected') }}</label>
                <input
                  v-model.number="item.quantity_rejected"
                  type="number"
                  min="0"
                  step="0.01"
                  class="input"
                />
              </div>
              <div class="form-group">
                <label>{{ $t('goodsReceived.rejectionReason') }}</label>
                <input v-model="item.rejection_reason" type="text" class="input" />
              </div>
            </div>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving || !form.items.length">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('goodsReceived.saveEntry') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Goods-received-note detail modal with received/rejected quantities -->
    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = false">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h2><i class="fas fa-clipboard-check"></i> {{ detail?.grn_number }}</h2>
          <button class="modal-close" @click="showDetail = false">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <p class="muted">
          {{ detail?.supplier?.supplier_name || '-' }} ·
          {{ $t('goodsReceived.poRef', { reference: detail?.purchase_order?.po_number || '-' }) }}
          <span v-if="detail?.delivery_note_number">
            · {{ $t('goodsReceived.deliveryNote') }} {{ detail.delivery_note_number }}</span
          >
        </p>
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">{{ $t('goodsReceived.item') }}</th>
                <th scope="col">{{ $t('common.unit') }}</th>
                <th scope="col">{{ $t('goodsReceived.ordered') }}</th>
                <th scope="col">{{ $t('goodsReceived.statusReceived') }}</th>
                <th scope="col">{{ $t('goodsReceived.rejected') }}</th>
                <th scope="col">{{ $t('goodsReceived.reason') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in detail?.items || []" :key="item.grn_item_id">
                <td>
                  <strong>{{ item.item_name }}</strong>
                </td>
                <td>{{ item.unit || '-' }}</td>
                <td>{{ item.quantity_ordered }}</td>
                <td>{{ item.quantity_received }}</td>
                <td>{{ item.quantity_rejected || 0 }}</td>
                <td>{{ item.rejection_reason || '-' }}</td>
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
import { goodsReceivedNoteApi, purchaseOrderApi } from '@/api'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import { collectAllRows } from '@/utils/export'

const { t } = useI18n()
const authStore = useAuthStore()

// Permission gate: whether the current user can operate on GRN records.
const canOperate = computed(() => authStore.canOperate)

// List state: GRNs, PO dropdown data, pagination, filters, and load flags/messages.
const grns = ref([])
const poOptions = ref([])
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({ po_id: '', inspection_status: '', from: '', to: '' })
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
  po_id: '',
  inspection_status: 'pending',
  received_date: '',
  delivery_note_number: '',
  notes: '',
  items: [],
})

// PO options, filtered to those that can still receive goods.
const eligiblePos = computed(() =>
  poOptions.value.filter((po) =>
    ['approved', 'partially_received', 'received'].includes(po.status),
  ),
)

// All loaded POs as dropdown options (used by the filter bar).
const purchaseOrderOptions = computed(() =>
  poOptions.value.map((po) => ({ value: po.po_id, label: po.po_number })),
)

// Only goods-receivable POs as dropdown options (used by the create form).
const eligiblePurchaseOrderOptions = computed(() =>
  eligiblePos.value.map((po) => ({ value: po.po_id, label: po.po_number })),
)

// Inspection status options with translated labels (filter bar and form).
const inspectionStatusOptions = computed(() => [
  { value: 'pending', label: t('goodsReceived.statusPending') },
  { value: 'passed', label: t('goodsReceived.inspectionPassed') },
  { value: 'failed', label: t('goodsReceived.inspectionFailed') },
  { value: 'partial', label: t('goodsReceived.inspectionPartial') },
])

/** Maps an inspection status to its badge CSS class for the table. */
function inspectionBadge(status) {
  const map = {
    pending: 'badge-yellow',
    passed: 'badge-green',
    failed: 'badge-red',
    partial: 'badge-yellow',
  }
  return map[status] || 'badge-gray'
}

/** Formats an ISO date into a short YYYY-MM-DD display string. */
function formatDate(date) {
  return date ? String(date).slice(0, 10) : '-'
}

/** Fetches the paged GRN list using the current filters. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await goodsReceivedNoteApi.index({
      po_id: filters.po_id,
      inspection_status: filters.inspection_status,
      from: filters.from,
      to: filters.to,
      page: page.value,
      per_page: 15,
    })
    grns.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('goodsReceived.loadError')
  } finally {
    loading.value = false
  }
}

const loadAllGrns = () =>
  collectAllRows((page, perPage) =>
    goodsReceivedNoteApi.index({
      po_id: filters.po_id,
      inspection_status: filters.inspection_status,
      from: filters.from,
      to: filters.to,
      page,
      per_page: perPage,
    }),
  )

/** Loads the purchase orders for the filter and form dropdowns. */
async function loadOptions() {
  try {
    const res = await purchaseOrderApi.index({ per_page: 100 })
    poOptions.value = res.data.data || []
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
  filters.po_id = ''
  filters.inspection_status = ''
  filters.from = ''
  filters.to = ''
  load()
}

/** Opens the create-GRN modal with a fresh form. */
function openCreate() {
  modalError.value = ''
  form.po_id = ''
  form.inspection_status = 'pending'
  form.received_date = ''
  form.delivery_note_number = ''
  form.notes = ''
  form.items = []
  showModal.value = true
}

/** Pre-fills the line items from the selected purchase order. */
async function onSelectPo() {
  form.items = []
  if (!form.po_id) return
  modalError.value = ''
  try {
    const res = await purchaseOrderApi.show(form.po_id)
    const po = res.data.purchase_order
    form.items = (po.items || []).map((item) => ({
      po_item_id: item.po_item_id,
      item_id: item.item_id || undefined,
      item_name: item.item_name,
      unit: item.unit,
      quantity_ordered: item.quantity,
      quantity_received: 0,
      quantity_rejected: 0,
      rejection_reason: '',
    }))
  } catch (err) {
    modalError.value = flattenError(err)
  }
}

/** Closes the create-GRN modal. */
function closeModal() {
  showModal.value = false
}

/** Creates the GRN with received/rejected quantities per item. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    const res = await goodsReceivedNoteApi.store({
      po_id: form.po_id,
      inspection_status: form.inspection_status,
      received_date: form.received_date || undefined,
      delivery_note_number: form.delivery_note_number,
      notes: form.notes,
      items: form.items.map((item) => ({
        po_item_id: item.po_item_id,
        item_id: item.item_id || undefined,
        quantity_received: item.quantity_received,
        quantity_rejected: item.quantity_rejected || undefined,
        rejection_reason: item.rejection_reason || undefined,
      })),
    })
    success.value = res.data.message || t('goodsReceived.createSuccess')
    showModal.value = false
    await Promise.all([load(), loadOptions()])
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Shows the GRN detail modal for the selected record. */
function openDetail(grn) {
  detail.value = grn
  showDetail.value = true
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
  grid-template-columns: 2fr 0.6fr 1fr 1fr 1fr 1fr;
  gap: 10px;
  align-items: end;
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
