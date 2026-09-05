<!--
  StoreGoodsReceivedPage — goods received notes: date/status-filtered list, a
  record-GRN modal (with per-line new cost, rejection reasons and delivery-note
  attachments) that pulls the selected purchase order's items, and a full detail
  view with print / recall / void / email actions.
-->

<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <input v-model="dateFilter" type="date" class="sm-input" style="max-width: 150px" @change="load(1)" />
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.dashboard.recordGrn') }}</button>
    </div>

    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="grns.length">
          <thead>
            <tr>
              <th>{{ $t('goodsReceived.number') }}</th>
              <th>{{ $t('goodsReceived.purchaseOrder') }}</th>
              <th>{{ $t('goodsReceived.supplier') }}</th>
              <th>{{ $t('goodsReceived.receivedDate') }}</th>
              <th>{{ $t('goodsReceived.deliveryNote') }}</th>
              <th>{{ $t('goodsReceived.attachments') }}</th>
              <th>{{ $t('goodsReceived.inspection') }}</th>
              <th>{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="grn in paged" :key="grn.grn_id">
              <td><strong>{{ grn.grn_number }}</strong></td>
              <td>{{ grn.purchase_order?.po_number || '-' }}</td>
              <td>{{ grn.supplier?.supplier_name || '-' }}</td>
              <td>{{ formatDate(grn.received_date) }}</td>
              <td>{{ grn.delivery_note_number || '-' }}</td>
              <td>
                <span v-if="(grn.attachments || []).length" class="paperclip" :title="grn.attachments.length + ' file(s)'">
                  <i class="fas fa-paperclip"></i> {{ grn.attachments.length }}
                </span>
                <span v-else>-</span>
              </td>
              <td><span class="chip" :class="grn.inspection_status">{{ grn.inspection_status }}</span></td>
              <td>
                <div class="row-actions">
                  <button class="sm-btn sm ghost" @click="openDetail(grn)"><i class="fas fa-eye"></i></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty"><i class="fas fa-inbox"></i> {{ emptyText }}</p>
      </div>
        <div class="sm-pagination" v-if="meta.last_page > 1">
          <button :disabled="meta.current_page <= 1" @click="go(meta.current_page - 1)">&laquo;</button>
          <span>{{ meta.current_page }} / {{ meta.last_page }}</span>
          <button :disabled="meta.current_page >= meta.last_page" @click="go(meta.current_page + 1)">&raquo;</button>
        </div>
      </template>
    </section>

    <!-- Record / recall GRN modal -->
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="closeForm">
      <div class="sm-modal wide">
        <div class="sm-modal-head">
          <h3>{{ editingGrnId ? $t('goodsReceived.editEntry') : $t('goodsReceived.create') }}</h3>
          <button class="sm-modal-close" @click="closeForm"><i class="fas fa-xmark"></i></button>
        </div>
        <form class="sm-modal-body" @submit.prevent="save">
          <div class="form-grid">
            <div class="form-field">
              <label>{{ $t('goodsReceived.purchaseOrder') }}</label>
              <select v-model="form.po_id" class="sm-select" style="width:100%" :disabled="!!editingGrnId" @change="loadPoItems">
                <option value="" disabled>{{ $t('common.select') }}</option>
                <option v-for="po in poOptions" :key="po.po_id" :value="po.po_id">{{ po.po_number }} — {{ po.supplier?.supplier_name || '' }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>{{ $t('goodsReceived.inspection') }}</label>
              <select v-model="form.inspection_status" class="sm-select" style="width:100%">
                <option value="pending">{{ $t('common.pending') }}</option>
                <option value="passed">{{ $t('goodsReceived.passed') }}</option>
                <option value="partial">{{ $t('goodsReceived.partial') }}</option>
                <option value="failed">{{ $t('goodsReceived.failed') }}</option>
              </select>
            </div>
            <div class="form-field"><label>{{ $t('goodsReceived.receivedDate') }}</label><input v-model="form.received_date" type="date" class="sm-input" /></div>
            <div class="form-field"><label>{{ $t('goodsReceived.deliveryNote') }}</label><input v-model="form.delivery_note_number" class="sm-input" /></div>
            <div class="form-field full"><label>{{ $t('common.notes') }}</label><textarea v-model="form.notes" rows="2" class="sm-textarea"></textarea></div>
          </div>

          <div v-if="!editingGrnId" class="delivery-files">
            <label class="file-label">
              <i class="fas fa-paperclip"></i> {{ $t('goodsReceived.deliveryNoteFiles') }}
              <input type="file" multiple accept=".jpg,.jpeg,.png,.pdf" @change="onFilesChange" />
            </label>
            <ul v-if="form.delivery_notes.length" class="file-list">
              <li v-for="(file, i) in form.delivery_notes" :key="i">
                <i class="fas fa-file"></i> {{ file.name }} <small>{{ formatBytes(file.size) }}</small>
                <button type="button" class="sm-btn sm danger" @click="form.delivery_notes.splice(i, 1)"><i class="fas fa-xmark"></i></button>
              </li>
            </ul>
          </div>

          <div class="table-scroll">
        <table class="sm-table" v-if="form.items.length">
            <thead>
              <tr>
                <th>{{ $t('inventory.itemName') }}</th>
                <th>{{ $t('common.unit') }}</th>
                <th>{{ $t('goodsReceived.ordered') }}</th>
                <th>{{ $t('goodsReceived.received') }}</th>
                <th>{{ $t('goodsReceived.rejected') }}</th>
                <th>{{ $t('goodsReceived.poUnitPrice') }}</th>
                <th>{{ $t('goodsReceived.newCost') }}</th>
                <th>{{ $t('goodsReceived.priceDiff') }}</th>
                <th>{{ $t('goodsReceived.rejectionReason') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in form.items" :key="item.po_item_id || item.grn_item_id">
                <td>{{ item.item_name }}</td>
                <td>{{ item.unit || '-' }}</td>
                <td>{{ item.quantity_ordered }}</td>
                <td><input v-model.number="item.quantity_received" type="number" min="0" :max="item.quantity_ordered" class="sm-input" style="width:80px" required /></td>
                <td><input v-model.number="item.quantity_rejected" type="number" min="0" class="sm-input" style="width:70px" /></td>
                <td>TZS {{ formatMoney(item.unit_price) }}</td>
                <td><input v-model.number="item.unit_cost" type="number" min="0" step="0.01" class="sm-input" style="width:90px" :placeholder="String(formatMoney(item.unit_price))" /></td>
                <td>
                  <span v-if="priceDiff(item)" class="price-diff" :class="priceDiff(item) !== 0 ? (priceDiff(item) > 0 ? 'up' : 'down') : ''">
                    {{ priceDiff(item) > 0 ? '+' : '' }}{{ formatMoney(priceDiff(item)) }}
                  </span>
                  <span v-else>-</span>
                </td>
                <td><input v-model="item.rejection_reason" class="sm-input" style="width:120px" /></td>
              </tr>
            </tbody>
          </table>
      </div>

          <p v-if="editingGrnId" class="void-note"><i class="fas fa-triangle-exclamation"></i> {{ $t('goodsReceived.businessDayNote') }}</p>
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="sm-modal-foot">
            <button type="button" class="sm-btn ghost" @click="closeForm">{{ $t('common.cancel') }}</button>
            <button type="submit" class="sm-btn" :disabled="saving || !form.items.length">{{ saving ? $t('common.saving') : (editingGrnId ? $t('goodsReceived.recall') : $t('common.save')) }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Detail modal -->
    <div v-if="detail" class="sm-modal-backdrop" @click.self="detail = null">
      <div class="sm-modal wide">
        <div class="sm-modal-head">
          <h3>{{ detail.grn_number }}</h3>
          <button class="sm-modal-close" @click="detail = null"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="sm-modal-body">
          <div class="detail-actions">
            <button class="sm-btn sm ghost" @click="printDetail"><i class="fas fa-print"></i> {{ $t('common.print') }}</button>
            <button v-if="canRecall" class="sm-btn sm primary" @click="startRecall"><i class="fas fa-pen"></i> {{ $t('goodsReceived.recall') }}</button>
            <button v-if="canVoidGrn" class="sm-btn sm danger" @click="voidGrn"><i class="fas fa-trash"></i> {{ $t('goodsReceived.voided') }}</button>
            <button v-if="detail.supplier?.email" class="sm-btn sm ghost" @click="emailSupplier"><i class="fas fa-envelope"></i> {{ $t('common.email') }}</button>
          </div>
          <p v-if="detail.voided_by" class="void-note"><i class="fas fa-circle-info"></i> {{ $t('goodsReceived.voided') }}: {{ detail.void_reason }}</p>
          <p v-if="detail.recalled_by" class="recall-note"><i class="fas fa-circle-info"></i> {{ $t('goodsReceived.recalled') }}: {{ detail.recall_reason }}</p>
          <p v-if="!detail.voided_by && !sameDay(detail.received_date)" class="hint-note"><i class="fas fa-triangle-exclamation"></i> {{ $t('goodsReceived.businessDayNote') }}</p>
          <p><strong>{{ $t('goodsReceived.purchaseOrder') }}:</strong> {{ detail.purchase_order?.po_number || '-' }}</p>
          <p><strong>{{ $t('goodsReceived.supplier') }}:</strong> {{ detail.supplier?.supplier_name || '-' }}</p>
          <p><strong>{{ $t('goodsReceived.inspection') }}:</strong> <span class="chip" :class="detail.inspection_status">{{ detail.inspection_status }}</span></p>
          <p v-if="detail.delivery_note_number"><strong>{{ $t('goodsReceived.deliveryNote') }}:</strong> {{ detail.delivery_note_number }}</p>
          <p v-if="detail.notes"><strong>{{ $t('common.notes') }}:</strong> {{ detail.notes }}</p>

          <div class="attachments">
            <p class="attachments-title"><i class="fas fa-paperclip"></i> {{ $t('goodsReceived.attachments') }}</p>
            <ul v-if="(detail.attachments || []).length" class="file-list">
              <li v-for="a in detail.attachments" :key="a.grn_attachment_id">
                <i class="fas fa-file"></i> {{ a.original_name }} <small>{{ formatBytes(a.size) }}</small>
                <a class="dl-link" :href="a.url" target="_blank" rel="noopener"><i class="fas fa-download"></i> {{ $t('common.download') }}</a>
              </li>
            </ul>
            <p v-else class="muted">{{ $t('goodsReceived.noAttachments') }}</p>
          </div>

          <div class="table-scroll">
        <table class="sm-table">
            <thead>
              <tr>
                <th>{{ $t('inventory.itemName') }}</th>
                <th>{{ $t('common.unit') }}</th>
                <th>{{ $t('goodsReceived.ordered') }}</th>
                <th>{{ $t('goodsReceived.received') }}</th>
                <th>{{ $t('goodsReceived.rejected') }}</th>
                <th>{{ $t('goodsReceived.poUnitPrice') }}</th>
                <th>{{ $t('goodsReceived.newCost') }}</th>
                <th>{{ $t('goodsReceived.rejectionReason') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in detail.items || []" :key="i">
                <td>{{ item.item_name }}</td>
                <td>{{ item.unit || '-' }}</td>
                <td>{{ item.quantity_ordered ?? '-' }}</td>
                <td>{{ item.quantity_received }}</td>
                <td>{{ item.quantity_rejected || 0 }}</td>
                <td>TZS {{ formatMoney(item.unit_price) }}</td>
                <td>TZS {{ formatMoney(item.unit_cost) }}</td>
                <td>{{ item.rejection_reason || '-' }}</td>
              </tr>
            </tbody>
          </table>
      </div>
        </div>
      </div>
    </div>

    <!-- Printable GRN document -->
    <div v-if="printData" class="print-area">
      <h2>{{ printData.grn_number }}</h2>
      <table class="print-meta">
        <tbody>
          <tr><td><strong>{{ $t('goodsReceived.purchaseOrder') }}</strong></td><td>{{ printData.purchase_order?.po_number || '-' }}</td></tr>
          <tr><td><strong>{{ $t('goodsReceived.supplier') }}</strong></td><td>{{ printData.supplier?.supplier_name || '-' }}</td></tr>
          <tr><td><strong>{{ $t('goodsReceived.receivedDate') }}</strong></td><td>{{ formatDate(printData.received_date) }}</td></tr>
          <tr v-if="printData.delivery_note_number"><td><strong>{{ $t('goodsReceived.deliveryNote') }}</strong></td><td>{{ printData.delivery_note_number }}</td></tr>
        </tbody>
      </table>
      <table class="print-table">
        <thead>
          <tr><th>{{ $t('inventory.itemName') }}</th><th>{{ $t('common.unit') }}</th><th>{{ $t('goodsReceived.ordered') }}</th><th>{{ $t('goodsReceived.received') }}</th><th>{{ $t('goodsReceived.rejected') }}</th><th>{{ $t('goodsReceived.poUnitPrice') }}</th><th>{{ $t('goodsReceived.newCost') }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(item, i) in printData.items || []" :key="i">
            <td>{{ item.item_name }}</td><td>{{ item.unit || '-' }}</td><td>{{ item.quantity_ordered ?? '-' }}</td>
            <td>{{ item.quantity_received }}</td><td>{{ item.quantity_rejected || 0 }}</td>
            <td>{{ formatMoney(item.unit_price) }}</td><td>{{ formatMoney(item.unit_cost) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { goodsReceivedNoteApi, purchaseOrderApi } from '@/api'
import { useClientTable } from '@/composables/useClientTable.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const grns = ref([])
const { q, status, statuses, paged } = useClientTable(grns, { pageSize: 15, searchFields: ['grn_number', 'status', (r) => r.po?.po_number] })
const poOptions = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const detail = ref(null)
const editingGrnId = ref(null)
const formError = ref('')
const dateFilter = ref(todayStr())
const printData = ref(null)

const form = reactive({ po_id: '', inspection_status: 'pending', received_date: todayStr(), delivery_note_number: '', notes: '', items: [], delivery_notes: [] })

const todayStr = () => {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const emptyText = computed(() => {
  if (dateFilter.value === todayStr()) return t('goodsReceived.noGrnToday')
  if (dateFilter.value) return t('goodsReceived.noGrnForDate')
  return t('goodsReceived.empty')
})

const canRecall = computed(() => detail.value && !detail.value.voided_by)
const canVoidGrn = computed(() => detail.value && !detail.value.voided_by && !detail.value.recalled_by)

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function sameDay(d) {
  if (!d) return true
  return String(d).slice(0, 10) === todayStr()
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatBytes(n) {
  const bytes = Number(n || 0)
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

function priceDiff(item) {
  const base = Number(item.unit_price || 0)
  const cost = item.unit_cost == null || item.unit_cost === '' ? base : Number(item.unit_cost)
  return Math.round((cost - base) * 100) / 100
}

async function load(page = meta.value.current_page) {
  loading.value = true
  try {
    const params = { page, per_page: 20 }
    if (dateFilter.value) params.date = dateFilter.value
    const res = await goodsReceivedNoteApi.index(params)
    grns.value = res.data.data || res.data || []
    meta.value = res.data.meta || { current_page: 1, last_page: 1 }
  } finally {
    loading.value = false
  }
}

function go(page) { load(page) }

function closeForm() {
  showForm.value = false
  editingGrnId.value = null
  formError.value = ''
}

function onFilesChange(e) {
  const files = Array.from(e.target.files || [])
  files.forEach((f) => {
    if (form.delivery_notes.length >= 5) return
    form.delivery_notes.push(f)
  })
  e.target.value = ''
}

async function openCreate() {
  editingGrnId.value = null
  Object.assign(form, { po_id: '', inspection_status: 'pending', received_date: todayStr(), delivery_note_number: '', notes: '', items: [], delivery_notes: [] })
  formError.value = ''
  showForm.value = true
  try {
    const res = await purchaseOrderApi.index({ per_page: 100 })
    const all = res.data.data || res.data || []
    poOptions.value = all.filter((po) => ['approved', 'partially_received'].includes(po.status))
  } catch {
    poOptions.value = []
  }
  const preselected = route.query.po_id
  if (preselected) {
    form.po_id = preselected
    await loadPoItems()
    if (route.query.create !== '1') router.replace({ query: {} })
  }
}

async function startRecall() {
  const grn = detail.value
  if (!grn || !grn.items?.length) return
  editingGrnId.value = grn.grn_id
  Object.assign(form, {
    po_id: grn.po_id || '',
    inspection_status: grn.inspection_status || 'passed',
    received_date: (grn.received_date || todayStr()).slice(0, 10),
    delivery_note_number: grn.delivery_note_number || '',
    notes: grn.notes || '',
    items: (grn.items || []).map((i) => ({
      grn_item_id: i.grn_item_id,
      po_item_id: i.po_item_id,
      item_id: i.item_id,
      item_name: i.item_name,
      unit: i.unit,
      quantity_ordered: i.quantity_ordered,
      quantity_received: Number(i.quantity_received),
      quantity_rejected: Number(i.quantity_rejected || 0),
      rejection_reason: i.rejection_reason || '',
      unit_price: Number(i.unit_price || 0),
      unit_cost: i.unit_cost == null ? i.unit_price : Number(i.unit_cost),
    })),
    delivery_notes: [],
  })
  formError.value = ''
  const po = grn.purchase_order
  if (po && !poOptions.value.some((p) => p.po_id === po.po_id)) poOptions.value = [...poOptions.value, po]
  showForm.value = true
}

async function loadPoItems() {
  form.items = []
  if (!form.po_id) return
  const res = await purchaseOrderApi.show(form.po_id)
  const po = res.data.purchase_order || res.data.data || res.data
  form.items = (po.items || []).map((item) => {
    const remaining = Math.max((item.quantity || 0) - (item.quantity_received || 0), 0)
    return {
      po_item_id: item.po_item_id,
      item_id: item.item_id || undefined,
      item_name: item.item_name,
      unit: item.unit,
      quantity_ordered: item.quantity,
      quantity_received: remaining,
      quantity_rejected: 0,
      rejection_reason: '',
      unit_price: Number(item.unit_price || 0),
      unit_cost: Number(item.unit_price || 0),
    }
  })
}

async function save() {
  const reason = editingGrnId.value ? window.prompt(t('goodsReceived.recallReason')) : null
  if (editingGrnId.value) {
    if (reason === null) return
    if (!reason.trim()) {
      formError.value = t('common.error')
      return
    }
  }
  if (form.items.some((i) => i.quantity_received == null || i.quantity_received < 0)) {
    formError.value = t('common.error')
    return
  }
  saving.value = true
  formError.value = ''
  try {
    if (editingGrnId.value) {
      await goodsReceivedNoteApi.update(editingGrnId.value, {
        reason: reason.trim(),
        received_date: form.received_date || undefined,
        delivery_note_number: form.delivery_note_number || undefined,
        inspection_status: form.inspection_status,
        notes: form.notes || undefined,
        items: form.items.map((i) => ({
          grn_item_id: i.grn_item_id,
          quantity_received: i.quantity_received,
          quantity_rejected: i.quantity_rejected || undefined,
          rejection_reason: i.rejection_reason || undefined,
          unit_cost: i.unit_cost == null || i.unit_cost === '' ? undefined : i.unit_cost,
        })),
      })
      const id = editingGrnId.value
      closeForm()
      await load()
      await refreshDetail(id)
    } else {
      const fd = new FormData()
      fd.append('po_id', form.po_id)
      fd.append('inspection_status', form.inspection_status)
      if (form.received_date) fd.append('received_date', form.received_date)
      if (form.delivery_note_number) fd.append('delivery_note_number', form.delivery_note_number)
      if (form.notes) fd.append('notes', form.notes)
      form.items.forEach((item, idx) => {
        fd.append(`items[${idx}][po_item_id]`, item.po_item_id)
        if (item.item_id) fd.append(`items[${idx}][item_id]`, item.item_id)
        fd.append(`items[${idx}][quantity_received]`, item.quantity_received)
        if (item.quantity_rejected) fd.append(`items[${idx}][quantity_rejected]`, item.quantity_rejected)
        if (item.rejection_reason) fd.append(`items[${idx}][rejection_reason]`, item.rejection_reason)
        if (item.unit_cost != null) fd.append(`items[${idx}][unit_cost]`, String(item.unit_cost))
      })
      form.delivery_notes.forEach((file, i) => fd.append(`delivery_notes[${i}]`, file))
      const res = await goodsReceivedNoteApi.store(fd)
      closeForm()
      await load()
      refreshDetail(res.data.grn.grn_id)
    }
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

async function openDetail(grn) {
  const res = await goodsReceivedNoteApi.show(grn.grn_id)
  detail.value = res.data.grn
}

async function refreshDetail(id) {
  if (!detail.value || detail.value.grn_id !== id) return
  const res = await goodsReceivedNoteApi.show(id)
  detail.value = res.data.grn
}

function printDetail() {
  printData.value = detail.value
  setTimeout(() => window.print(), 60)
}

function emailSupplier() {
  const grn = detail.value
  const email = grn.supplier?.email
  if (!email) return
  const items = (grn.items || []).map((i) => `- ${i.item_name} x ${i.quantity_received} ${i.unit || ''}`).join('\n')
  const body = `${t('goodsReceived.purchaseOrder')}: ${grn.purchase_order?.po_number || ''}\n\n${items}`
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(`GRN ${grn.grn_number}`)}&body=${encodeURIComponent(body)}`
}

async function voidGrn() {
  const grn = detail.value
  if (!window.confirm(t('goodsReceived.voidConfirm', { reference: grn.grn_number }))) return
  const reason = window.prompt(t('goodsReceived.voidReason'))
  if (reason === null) return
  if (!reason.trim()) {
    window.alert(t('common.error'))
    return
  }
  try {
    await goodsReceivedNoteApi.void(grn.grn_id, { reason: reason.trim() })
    await load()
    await refreshDetail(grn.grn_id)
  } catch (e) {
    window.alert(e.response?.data?.message || t('common.error'))
  }
}

onMounted(async () => {
  await load(1)
  if (route.query.po_id || route.query.create === '1') openCreate()
})
</script>

<style scoped>
.detail-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.paperclip { color: #475569; font-size: 12px; }
.delivery-files { display: flex; flex-direction: column; gap: 8px; margin: 6px 0; }
.file-label { display: inline-flex; align-items: center; gap: 8px; color: var(--mrk-blue); font-weight: 600; font-size: 13px; cursor: pointer; width: fit-content; }
.file-label input { display: none; }
.file-list { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.file-list li { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; font-size: 13px; }
.file-list small, .muted { color: #64748b; }
.file-list .sm-btn { margin-left: auto; }
.dl-link { color: var(--mrk-blue); text-decoration: none; margin-left: auto; font-size: 12px; font-weight: 600; }
.attachments { margin: 10px 0; }
.attachments-title { font-weight: 600; margin: 0 0 6px; font-size: 13px; color: #334155; }
.price-diff { font-weight: 700; font-size: 12px; }
.price-diff.up { color: #dc2626; }
.price-diff.down { color: #16a34a; }
.void-note { background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; border-radius: 8px; padding: 6px 10px; font-size: 13px; }
.recall-note { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; border-radius: 8px; padding: 6px 10px; font-size: 13px; }
.hint-note { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; border-radius: 8px; padding: 6px 10px; font-size: 13px; }
.print-area { display: none; }
@media print {
  html, body { background: #ffffff !important; }
  body * { visibility: hidden !important; }
  .print-area, .print-area * { visibility: visible !important; }
  .print-area { display: block; position: fixed; inset: 0; width: 100%; height: auto; background: #ffffff; padding: 28px; z-index: 99999; color: #111827; }
  .print-meta, .print-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  .print-meta td, .print-table th, .print-table td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; }
  .print-table th { background: #f3f4f6; }
}
</style>