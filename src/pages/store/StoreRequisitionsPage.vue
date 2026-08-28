<!--
  StoreRequisitionsPage — purchase requisition workflow: list with status
  filter, multi-item create form, approve/reject/cancel actions and detail.
-->

<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <select v-model="statusFilter" class="sm-select" @change="load(1)">
        <option value="">{{ $t('common.allStatuses') }}</option>
        <option value="pending">{{ $t('common.pending') }}</option>
        <option value="approved">{{ $t('common.approved') }}</option>
        <option value="rejected">{{ $t('common.rejected') }}</option>
        <option value="cancelled">{{ $t('common.cancelled') }}</option>
      </select>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.dashboard.newRequisition') }}</button>
    </div>

    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="requisitions.length">
          <thead>
            <tr>
              <th>{{ $t('requisitions.number') }}</th>
              <th>{{ $t('requisitions.department') }}</th>
              <th>{{ $t('requisitions.priority') }}</th>
              <th>{{ $t('requisitions.items') }}</th>
              <th>{{ $t('common.status') }}</th>
              <th>{{ $t('common.date') }}</th>
              <th>{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="req in paged" :key="req.requisition_id">
              <td><strong>{{ req.requisition_number }}</strong></td>
              <td>{{ req.department }}</td>
              <td><span class="chip" :class="req.priority === 'urgent' ? 'failed' : ''">{{ req.priority }}</span></td>
              <td>{{ (req.items || []).length }}</td>
              <td><span class="chip" :class="req.status">{{ req.status }}</span></td>
              <td>{{ formatDate(req.created_at) }}</td>
              <td>
                <div class="row-actions">
                  <button class="sm-btn sm ghost" @click="openDetail(req)" :title="$t('common.view')"><i class="fas fa-eye"></i></button>
                  <template v-if="req.status === 'pending'">
                    <button class="sm-btn sm success" @click="approve(req)" :title="$t('common.approve')"><i class="fas fa-check"></i></button>
                    <button class="sm-btn sm danger" @click="openReject(req)" :title="$t('common.reject')"><i class="fas fa-xmark"></i></button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('requisitions.empty') }}</p>
      </div>
        <div class="sm-pagination" v-if="meta.last_page > 1">
          <button :disabled="meta.current_page <= 1" @click="go(meta.current_page - 1)">&laquo;</button>
          <span>{{ meta.current_page }} / {{ meta.last_page }}</span>
          <button :disabled="meta.current_page >= meta.last_page" @click="go(meta.current_page + 1)">&raquo;</button>
        </div>
      </template>
    </section>

    <!-- Create modal -->
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal wide">
        <div class="sm-modal-head">
          <h3>{{ $t('requisitions.create') }}</h3>
          <button class="sm-modal-close" @click="showForm = false"><i class="fas fa-xmark"></i></button>
        </div>
        <form class="sm-modal-body" @submit.prevent="save">
          <div class="form-grid">
            <div class="form-field"><label>{{ $t('requisitions.department') }}</label><input v-model="form.department" class="sm-input" required /></div>
            <div class="form-field">
              <label>{{ $t('requisitions.priority') }}</label>
              <select v-model="form.priority" class="sm-select" style="width:100%">
                <option value="low">{{ $t('common.low') }}</option>
                <option value="normal">{{ $t('common.normal') }}</option>
                <option value="high">{{ $t('common.high') }}</option>
                <option value="urgent">{{ $t('common.urgent') }}</option>
              </select>
            </div>
            <div class="form-field full"><label>{{ $t('requisitions.justification') }}</label><textarea v-model="form.justification" rows="2" class="sm-textarea"></textarea></div>
          </div>

          <div class="items-block">
            <div class="items-head">
              <strong>{{ $t('requisitions.items') }}</strong>
              <button type="button" class="sm-btn sm ghost" @click="form.items.push(emptyItem())"><i class="fas fa-plus"></i> {{ $t('requisitions.addItem') }}</button>
            </div>
            <div v-for="(item, idx) in form.items" :key="idx" class="item-grid">
              <input v-model="item.item_name" class="sm-input" :placeholder="$t('inventory.itemName')" required />
              <input v-model.number="item.quantity" type="number" min="1" class="sm-input" :placeholder="$t('inventory.quantity')" required />
              <input v-model="item.unit" class="sm-input" :placeholder="$t('inventory.unit')" />
              <input v-model.number="item.estimated_price" type="number" min="0" step="0.01" class="sm-input" :placeholder="$t('requisitions.estimatedPrice')" />
              <button type="button" class="sm-btn sm danger" @click="form.items.splice(idx, 1)" :disabled="form.items.length === 1"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="sm-modal-foot">
            <button type="button" class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
            <button type="submit" class="sm-btn" :disabled="saving">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Reject modal -->
    <div v-if="rejecting" class="sm-modal-backdrop" @click.self="rejecting = null">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ $t('requisitions.reject') }} — {{ rejecting.requisition_number }}</h3>
          <button class="sm-modal-close" @click="rejecting = null"><i class="fas fa-xmark"></i></button>
        </div>
        <form class="sm-modal-body" @submit.prevent="doReject">
          <div class="form-field"><label>{{ $t('requisitions.rejectReason') }}</label><textarea v-model="rejectReason" rows="3" class="sm-textarea" required></textarea></div>
          <div class="sm-modal-foot">
            <button type="button" class="sm-btn ghost" @click="rejecting = null">{{ $t('common.cancel') }}</button>
            <button type="submit" class="sm-btn danger" :disabled="saving">{{ $t('common.reject') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Detail modal -->
    <div v-if="detail" class="sm-modal-backdrop" @click.self="detail = null">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ detail.requisition_number }}</h3>
          <button class="sm-modal-close" @click="detail = null"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="sm-modal-body">
          <p><strong>{{ $t('requisitions.department') }}:</strong> {{ detail.department }}</p>
          <p><strong>{{ $t('common.status') }}:</strong> <span class="chip" :class="detail.status">{{ detail.status }}</span></p>
          <p v-if="detail.justification"><strong>{{ $t('requisitions.justification') }}:</strong> {{ detail.justification }}</p>
          <p v-if="detail.rejection_reason"><strong>{{ $t('requisitions.rejectReason') }}:</strong> {{ detail.rejection_reason }}</p>
          <div class="table-scroll">
        <table class="sm-table">
            <thead><tr><th>{{ $t('inventory.itemName') }}</th><th>{{ $t('inventory.quantity') }}</th><th>{{ $t('inventory.unit') }}</th><th>{{ $t('requisitions.estimatedPrice') }}</th></tr></thead>
            <tbody>
              <tr v-for="(item, i) in detail.items || []" :key="i">
                <td>{{ item.item_name }}</td><td>{{ item.quantity }}</td><td>{{ item.unit || '-' }}</td>
                <td>{{ item.estimated_price ? 'TZS ' + Number(item.estimated_price).toLocaleString() : '-' }}</td>
              </tr>
            </tbody>
          </table>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
      </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { purchaseRequisitionApi } from '@/api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import { useClientTable } from '@/composables/useClientTable.js'

const route = useRoute()
const { t } = useI18n()

const requisitions = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(requisitions, { pageSize: 15, searchFields: ['requisition_id', 'status', 'department', (r) => lineSummary(r)] })
const meta = ref({ current_page: 1, last_page: 1 })
const loading = ref(false)
const saving = ref(false)
const statusFilter = ref(route.query.status || '')
const showForm = ref(false)
const rejecting = ref(null)
const rejectReason = ref('')
const detail = ref(null)
const formError = ref('')

const form = reactive({ department: '', priority: 'normal', justification: '', items: [emptyItem()] })

function emptyItem() {
  return { item_name: '', description: '', quantity: null, unit: '', estimated_price: null }
}

function lineSummary(pr) {
  const lines = pr.items || []
  if (!lines.length) return '—'
  return lines
    .map((l) => `${l.item_name || '—'}${l.quantity ? ` ×${l.quantity}` : ''}`.trim())
    .filter(Boolean)
    .join(', ') || '—'
}

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

async function load(page = meta.value.current_page) {
  loading.value = true
  try {
    const params = { page, per_page: 20 }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await purchaseRequisitionApi.index(params)
    requisitions.value = res.data.data || res.data || []
    meta.value = res.data.meta || { current_page: 1, last_page: 1 }
  } finally {
    loading.value = false
  }
}

function go(page) { load(page) }

function openCreate() {
  Object.assign(form, { department: '', priority: 'normal', justification: '', items: [emptyItem()] })
  formError.value = ''
  showForm.value = true
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    await purchaseRequisitionApi.store({
      department: form.department,
      priority: form.priority,
      justification: form.justification,
      items: form.items.filter((i) => i.item_name),
    })
    showForm.value = false
    await load(1)
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

async function approve(req) {
  if (!window.confirm(t('requisitions.approveConfirm', { reference: req.requisition_number }))) return
  await purchaseRequisitionApi.approve(req.requisition_id)
  await load()
}

function openReject(req) {
  rejecting.value = req
  rejectReason.value = ''
}

async function doReject() {
  saving.value = true
  try {
    await purchaseRequisitionApi.reject(rejecting.value.requisition_id, { reason: rejectReason.value })
    rejecting.value = null
    await load()
  } finally {
    saving.value = false
  }
}

async function openDetail(req) {
  const res = await purchaseRequisitionApi.show(req.requisition_id)
  detail.value = res.data.data || res.data
}

onMounted(async () => {
  await load(1)
  if (route.query.create === '1') openCreate()
})
</script>

<style scoped>
.items-block { display: flex; flex-direction: column; gap: 10px; }
.items-head { display: flex; align-items: center; justify-content: space-between; }
.item-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 8px; }
@media (max-width: 700px) { .item-grid { grid-template-columns: 1fr 1fr; } }
</style>
