<!--
  StorePurchaseOrdersPage — purchase orders: list with date/status filter,
  multi-item create/edit form (optionally linked to an approved requisition),
  approval actions and a full detail view with print / edit / receive / email /
  void actions.
-->

<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <input v-model="dateFilter" type="date" class="sm-input" style="max-width: 150px" @change="load(1)" />
      <select v-model="statusFilter" class="sm-select" @change="load(1)">
        <option value="">{{ $t('common.allStatuses') }}</option>
        <option value="pending">{{ $t('common.pending') }}</option>
        <option value="manager_approved">{{ $t('purchaseOrders.managerApproved') }}</option>
        <option value="approved">{{ $t('common.approved') }}</option>
        <option value="partially_received">{{ $t('purchaseOrders.partiallyReceived') }}</option>
        <option value="received">{{ $t('purchaseOrders.received') }}</option>
        <option value="cancelled">{{ $t('common.cancelled') }}</option>
        <option value="rejected">{{ $t('purchaseOrders.rejected') }}</option>
        <option value="voided">{{ $t('purchaseOrders.voided') }}</option>
      </select>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('purchaseOrders.create') }}</button>
    </div>

    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="orders.length">
          <thead>
            <tr>
              <th>{{ $t('purchaseOrders.number') }}</th>
              <th>{{ $t('goodsReceived.supplier') }}</th>
              <th>{{ $t('requisitions.items') }}</th>
              <th>{{ $t('purchaseOrders.total') }}</th>
              <th>{{ $t('purchaseOrders.deliveryDate') }}</th>
              <th>{{ $t('common.status') }}</th>
              <th>{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="po in paged" :key="po.po_id">
              <td><strong>{{ po.po_number }}</strong></td>
              <td>{{ po.supplier?.supplier_name || '-' }}</td>
              <td>{{ (po.items || []).length }}</td>
              <td>TZS {{ Number(po.total_amount || 0).toLocaleString() }}</td>
              <td>{{ formatDate(po.delivery_date) }}</td>
              <td><span class="chip" :class="po.status">{{ po.status.replaceAll('_', ' ') }}</span></td>
              <td>
                <div class="row-actions">
                  <button class="sm-btn sm ghost" @click="openDetail(po)"><i class="fas fa-eye"></i></button>
                  <button v-if="po.status === 'pending'" class="sm-btn sm success" @click="managerApprove(po)" :title="$t('purchaseOrders.managerApprove')"><i class="fas fa-check"></i></button>
                  <button v-if="['pending', 'manager_approved', 'approved'].includes(po.status)" class="sm-btn sm danger" @click="cancel(po)" :title="$t('common.cancel')"><i class="fas fa-ban"></i></button>
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

    <!-- Create / edit modal -->
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="closeForm">
      <div class="sm-modal wide">
        <div class="sm-modal-head">
          <h3>{{ editingId ? $t('purchaseOrders.editPurchaseOrder') : $t('purchaseOrders.create') }}</h3>
          <button class="sm-modal-close" @click="closeForm"><i class="fas fa-xmark"></i></button>
        </div>
        <form class="sm-modal-body" @submit.prevent="save">
          <div class="form-grid">
            <div class="form-field">
              <label>{{ $t('goodsReceived.supplier') }}</label>
              <select v-model="form.supplier_id" class="sm-select" style="width:100%" required :disabled="!!editingId">
                <option value="" disabled>{{ $t('common.select') }}</option>
                <option v-for="s in suppliers" :key="s.supplier_id" :value="s.supplier_id">{{ s.supplier_name }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>{{ $t('purchaseOrders.requisition') }}</label>
              <select v-model="form.pr_id" class="sm-select" style="width:100%">
                <option value="">-</option>
                <option v-for="r in approvedReqs" :key="r.requisition_id" :value="r.requisition_id">{{ r.requisition_number }}</option>
              </select>
            </div>
            <div class="form-field"><label>{{ $t('purchaseOrders.deliveryDate') }}</label><input v-model="form.delivery_date" type="date" class="sm-input" :min="todayStr" /></div>
            <div class="form-field"><label>{{ $t('suppliers.paymentTerms') }}</label><input v-model="form.payment_terms" class="sm-input" placeholder="Net 30" /></div>
            <div class="form-field full"><label>{{ $t('purchaseOrders.deliveryAddress') }}</label><input v-model="form.delivery_address" class="sm-input" /></div>
            <div class="form-field full"><label>{{ $t('common.notes') }}</label><textarea v-model="form.notes" rows="2" class="sm-textarea"></textarea></div>
          </div>

          <div class="items-block">
            <div class="items-head">
              <strong>{{ $t('requisitions.items') }}</strong>
              <button type="button" class="sm-btn sm ghost" @click="form.items.push(emptyItem())"><i class="fas fa-plus"></i> {{ $t('requisitions.addItem') }}</button>
            </div>
            <div v-for="(item, idx) in form.items" :key="idx" class="item-grid">
              <SearchableSelect
                v-model="item.item_id"
                :options="itemOptions"
                :placeholder="$t('inventory.searchItems')"
                :search-placeholder="$t('inventory.searchItems')"
                :empty-label="$t('inventory.selectItem')"
                required
                @change="onPickItem(item, $event)"
              >
                <template #option="{ option }">
                  <span>{{ option.label }} <small class="muted">{{ option.category }} · TZS {{ Number(option.unit_cost || 0).toLocaleString() }}</small></span>
                </template>
              </SearchableSelect>
              <input v-model.number="item.quantity" type="number" min="1" class="sm-input" :placeholder="$t('inventory.quantity')" required />
              <select v-model="item.unit" class="sm-input">
                <option v-for="u in unitOptionsFor(item)" :key="u" :value="u">{{ u }}</option>
              </select>
              <input v-model.number="item.unit_price" type="number" min="0" step="0.01" class="sm-input" :placeholder="$t('inventory.unitCost')" required />
              <button type="button" class="sm-btn sm danger" @click="form.items.splice(idx, 1)" :disabled="form.items.length === 1"><i class="fas fa-trash"></i></button>
            </div>
          </div>

          <p class="po-total"><strong>{{ $t('purchaseOrders.total') }}: TZS {{ poTotal.toLocaleString() }}</strong></p>
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="sm-modal-foot">
            <button type="button" class="sm-btn ghost" @click="closeForm">{{ $t('common.cancel') }}</button>
            <button type="submit" class="sm-btn" :disabled="saving || !form.items.length">{{ saving ? $t('common.saving') : (editingId ? $t('purchaseOrders.updatePurchaseOrder') : $t('common.save')) }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Detail modal -->
    <div v-if="detail" class="sm-modal-backdrop" @click.self="detail = null">
      <div class="sm-modal wide">
        <div class="sm-modal-head">
          <h3>{{ detail.po_number }}</h3>
          <button class="sm-modal-close" @click="detail = null"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="sm-modal-body">
          <div class="detail-actions">
            <button class="sm-btn sm ghost" @click="printDetail"><i class="fas fa-print"></i> {{ $t('common.print') }}</button>
            <button v-if="canEdit" class="sm-btn sm ghost" @click="startEdit"><i class="fas fa-pen"></i> {{ $t('common.edit') }}</button>
            <button v-if="['approved', 'partially_received', 'manager_approved'].includes(detail.status)" class="sm-btn sm primary" @click="receiveGoods"><i class="fas fa-box-open"></i> {{ $t('purchaseOrders.receiveGoods') }}</button>
            <button v-if="detail.supplier?.email" class="sm-btn sm ghost" @click="emailSupplier"><i class="fas fa-envelope"></i> {{ $t('common.email') }}</button>
            <button v-if="canVoid" class="sm-btn sm danger" @click="voidPo"><i class="fas fa-trash"></i> {{ $t('purchaseOrders.voided') }}</button>
          </div>
          <p v-if="detail.void_reason" class="void-note"><i class="fas fa-circle-info"></i> voided by {{ detail.voided_by }}: {{ detail.void_reason }}</p>
          <p v-if="detail.rejection_reason" class="void-note"><i class="fas fa-circle-info"></i> rejected: {{ detail.rejection_reason }}</p>
          <p><strong>{{ $t('goodsReceived.supplier') }}:</strong> {{ detail.supplier?.supplier_name || '-' }}</p>
          <p><strong>{{ $t('common.status') }}:</strong> <span class="chip" :class="detail.status">{{ detail.status.replaceAll('_', ' ') }}</span></p>
          <p v-if="detail.delivery_date"><strong>{{ $t('purchaseOrders.deliveryDate') }}:</strong> {{ formatDate(detail.delivery_date) }}</p>
          <p v-if="detail.delivery_address"><strong>{{ $t('purchaseOrders.deliveryAddress') }}:</strong> {{ detail.delivery_address }}</p>
          <p v-if="detail.notes"><strong>{{ $t('common.notes') }}:</strong> {{ detail.notes }}</p>
          <div class="table-scroll">
        <table class="sm-table">
            <thead><tr><th>{{ $t('inventory.itemName') }}</th><th>{{ $t('common.unit') }}</th><th>{{ $t('inventory.quantity') }}</th><th>{{ $t('inventory.unitCost') }}</th><th>{{ $t('purchaseOrders.total') }}</th></tr></thead>
            <tbody>
              <tr v-for="(item, i) in detail.items || []" :key="i">
                <td>{{ item.item_name }}</td><td>{{ item.unit || '-' }}</td><td>{{ item.quantity }}</td>
                <td>TZS {{ Number(item.unit_price || 0).toLocaleString() }}</td>
                <td>TZS {{ (Number(item.quantity || 0) * Number(item.unit_price || 0)).toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
      </div>
          <p class="po-total"><strong>{{ $t('purchaseOrders.total') }}: TZS {{ Number(detail.total_amount || 0).toLocaleString() }}</strong></p>
        </div>
      </div>
    </div>

    <!-- Printable PO document -->
    <div v-if="printData" class="print-area">
      <h2>{{ printData.po_number }}</h2>
      <table class="print-meta">
        <tbody>
          <tr><td><strong>{{ $t('goodsReceived.supplier') }}</strong></td><td>{{ printData.supplier?.supplier_name || '-' }}</td></tr>
          <tr><td><strong>{{ $t('purchaseOrders.deliveryDate') }}</strong></td><td>{{ formatDate(printData.delivery_date) }}</td></tr>
          <tr v-if="printData.delivery_address"><td><strong>{{ $t('purchaseOrders.deliveryAddress') }}</strong></td><td>{{ printData.delivery_address }}</td></tr>
          <tr><td><strong>{{ $t('common.status') }}</strong></td><td>{{ printData.status.replaceAll('_', ' ') }}</td></tr>
        </tbody>
      </table>
      <table class="print-table">
        <thead><tr><th>{{ $t('inventory.itemName') }}</th><th>{{ $t('common.unit') }}</th><th>{{ $t('inventory.quantity') }}</th><th>{{ $t('inventory.unitCost') }}</th><th>{{ $t('purchaseOrders.total') }}</th></tr></thead>
        <tbody>
          <tr v-for="(item, i) in printData.items || []" :key="i">
            <td>{{ item.item_name }}</td><td>{{ item.unit || '-' }}</td><td>{{ item.quantity }}</td>
            <td>{{ Number(item.unit_price || 0).toLocaleString() }}</td>
            <td>{{ (Number(item.quantity || 0) * Number(item.unit_price || 0)).toLocaleString() }}</td>
          </tr>
        </tbody>
        <tfoot><tr><th colspan="4">{{ $t('purchaseOrders.total') }}</th><th>{{ Number(printData.total_amount || 0).toLocaleString() }}</th></tr></tfoot>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { purchaseOrderApi, purchaseRequisitionApi, supplierApi, inventoryApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useClientTable } from '@/composables/useClientTable.js'

const { t } = useI18n()
const router = useRouter()

const orders = ref([])
const { q, status, statuses, paged } = useClientTable(orders, { pageSize: 15, searchFields: ['po_number', 'supplier_name', 'status'] })
const suppliers = ref([])
const approvedReqs = ref([])
const inventoryItems = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const loading = ref(false)
const saving = ref(false)
const statusFilter = ref('')
const dateFilter = ref(todayStr())
const showForm = ref(false)
const detail = ref(null)
const editingId = ref(null)
const formError = ref('')
const printData = ref(null)

const todayStr = () => {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const form = reactive({ supplier_id: '', pr_id: '', delivery_date: todayStr(), payment_terms: '', delivery_address: '', notes: '', items: [emptyItem()] })

function emptyItem() {
  return { item_id: '', item_name: '', description: '', quantity: null, unit: '', si_units: [], unit_price: null }
}

// Registered inventory items are the only orderable lines; picking one also
// carries its registered unit and cost so receiving stocks the right record.
const itemOptions = computed(() =>
  inventoryItems.value.map((item) => ({
    value: item.item_id,
    label: `${item.item_name}${item.unit ? ` (${item.unit})` : ''}`,
    category: item.category,
    stock: item.quantity_in_stock,
    unit_cost: item.unit_cost,
  })),
)

const STANDARD_UNITS = [
  'BTL', 'PCS', 'KG', 'L', 'GLN', 'BOX', 'CARTON', 'PKT', 'ROLL', 'DOZ', 'PAIR', 'SET', 'M', 'GM', 'ML', 'TIN', 'SACHET',
]

/** Unit choices for a line: the item's registered SI units, else common SI units. */
function unitOptionsFor(item) {
  const registered = (item.si_units || []).filter(Boolean)
  if (registered.length) return registered
  if (item.unit) return [item.unit]
  return STANDARD_UNITS
}

/** Applies a picked registered item to a PO line (id, name, units + default). */
function onPickItem(line, value) {
  const found = inventoryItems.value.find((i) => String(i.item_id) === String(value))
  line.item_id = value
  line.item_name = found?.item_name || ''
  line.si_units = (found?.si_units || [])
    .map((u) => (typeof u === 'string' ? u : u?.unit))
    .filter(Boolean)
  if (found?.unit) line.unit = found.unit
  if (found?.unit_cost) line.unit_price = Number(found.unit_cost)
}

const poTotal = computed(() =>
  form.items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_price || 0), 0)
)

const emptyText = computed(() => {
  if (dateFilter.value === todayStr()) return t('purchaseOrders.noPurchaseToday')
  if (dateFilter.value) return t('purchaseOrders.noPurchaseForDate')
  return t('purchaseOrders.empty')
})

const canEdit = computed(() => detail.value && ['pending', 'manager_approved'].includes(detail.value.status))
const canVoid = computed(() => detail.value && ['pending', 'manager_approved', 'approved'].includes(detail.value.status) && !detail.value.voided_by)

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

async function load(page = meta.value.current_page) {
  loading.value = true
  try {
    const params = { page, per_page: 20 }
    if (statusFilter.value) params.status = statusFilter.value
    if (dateFilter.value) params.date = dateFilter.value
    const res = await purchaseOrderApi.index(params)
    orders.value = res.data.data || res.data || []
    meta.value = res.data.meta || { current_page: 1, last_page: 1 }
  } finally {
    loading.value = false
  }
}

function go(page) { load(page) }

function closeForm() {
  showForm.value = false
  editingId.value = null
  formError.value = ''
}

async function primeForm() {
  const [sup, req, inv] = await Promise.allSettled([
    supplierApi.index({ per_page: 100 }),
    purchaseRequisitionApi.index({ status: 'approved', per_page: 100 }),
    inventoryApi.index({ per_page: 100 }),
  ])
  if (sup.status === 'fulfilled') suppliers.value = sup.value.data.data || sup.value.data || []
  if (req.status === 'fulfilled') approvedReqs.value = req.value.data.data || req.value.data || []
  if (inv.status === 'fulfilled') inventoryItems.value = inv.value.data.data || inv.value.data || []
}

async function openCreate() {
  editingId.value = null
  Object.assign(form, { supplier_id: '', pr_id: '', delivery_date: todayStr(), payment_terms: '', delivery_address: '', notes: '', items: [emptyItem()] })
  formError.value = ''
  showForm.value = true
  await primeForm()
}

async function startEdit() {
  const po = detail.value
  if (!po) return
  editingId.value = po.po_id
  Object.assign(form, {
    supplier_id: po.supplier_id || '',
    pr_id: po.pr_id || '',
    delivery_date: po.delivery_date || todayStr(),
    payment_terms: po.payment_terms || '',
    delivery_address: po.delivery_address || '',
    notes: po.notes || '',
    items: (po.items || []).map((item) => {
      const line = {
        item_id: item.item_id || '',
        item_name: item.item_name,
        description: item.description || '',
        quantity: item.quantity,
        unit: item.unit || '',
        si_units: [],
        unit_price: item.unit_price,
      }
      const catalog = inventoryItems.value.find((i) => String(i.item_id) === String(item.item_id))
      if (catalog) {
        line.si_units = (catalog.si_units || []).map((u) => (typeof u === 'string' ? u : u?.unit)).filter(Boolean)
        if (!line.unit) line.unit = catalog.unit
      }
      return line
    }),
  })
  if (form.items.length === 0) form.items.push(emptyItem())
  formError.value = ''
  showForm.value = true
  await primeForm()
}

async function save() {
  if (form.items.some((i) => !i.item_name || i.quantity == null)) {
    formError.value = t('inventory.selectItem')
    return
  }
  saving.value = true
  formError.value = ''
  const payload = {
    supplier_id: form.supplier_id,
    pr_id: form.pr_id || undefined,
    delivery_date: form.delivery_date || undefined,
    payment_terms: form.payment_terms || undefined,
    delivery_address: form.delivery_address || undefined,
    notes: form.notes || undefined,
    items: form.items.map((i) => ({ item_id: i.item_id, item_name: i.item_name, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price })).filter((i) => i.item_name),
  }
  try {
    const res = editingId.value
      ? await purchaseOrderApi.update(editingId.value, payload)
      : await purchaseOrderApi.store(payload)
    const saved = res.data.purchase_order || res.data.data || res.data
    closeForm()
    await load(1)
    if (detail.value) detail.value = saved
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

async function managerApprove(po) {
  if (!window.confirm(t('purchaseOrders.managerApproveConfirm', { reference: po.po_number }))) return
  await purchaseOrderApi.managerApprove(po.po_id)
  await load()
}

async function cancel(po) {
  if (!window.confirm(t('purchaseOrders.cancelConfirm', { reference: po.po_number }))) return
  await purchaseOrderApi.cancel(po.po_id)
  await load()
}

async function openDetail(po) {
  const res = await purchaseOrderApi.show(po.po_id)
  detail.value = res.data.purchase_order || res.data.data || res.data
}

function printDetail() {
  printData.value = detail.value
  setTimeout(() => window.print(), 60)
}

function receiveGoods() {
  router.push({ name: 'store-goods-received', query: { po_id: detail.value.po_id, create: '1' } })
}

function emailSupplier() {
  const po = detail.value
  const email = po.supplier?.email
  if (!email) {
    window.alert(t('purchaseOrders.noSupplierEmail'))
    return
  }
  const items = (po.items || []).map((i) => `- ${i.item_name} x ${i.quantity} ${i.unit || ''} @ TZS ${Number(i.unit_price || 0).toLocaleString()}`).join('\n')
  const body = `${t('goodsReceived.purchaseOrder')}: ${po.po_number}\n${t('purchaseOrders.deliveryDate')}: ${po.delivery_date || '-'}\n\n${items}\n\n${t('purchaseOrders.total')}: TZS ${Number(po.total_amount || 0).toLocaleString()}`
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(`PO ${po.po_number}`)}&body=${encodeURIComponent(body)}`
}

async function voidPo() {
  const po = detail.value
  if (!window.confirm(t('purchaseOrders.voidConfirm', { reference: po.po_number }))) return
  const reason = window.prompt(t('purchaseOrders.voidReason'))
  if (reason === null) return
  if (!reason.trim()) {
    formError.value = t('common.error')
    return
  }
  try {
    const res = await purchaseOrderApi.void(po.po_id, { reason: reason.trim() })
    detail.value = res.data.purchase_order || res.data.data || res.data
    await load()
  } catch (e) {
    window.alert(e.response?.data?.message || t('common.error'))
  }
}

onMounted(() => load(1))
</script>

<style scoped>
.items-block { display: flex; flex-direction: column; gap: 10px; }
.items-head { display: flex; align-items: center; justify-content: space-between; }
.item-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 8px; }
.po-total { text-align: right; color: #333333; margin: 4px 0 0; }
.detail-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.void-note { background: #fff4ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 8px; padding: 6px 10px; font-size: 13px; }
.print-area { display: none; }
@media (max-width: 700px) { .item-grid { grid-template-columns: 1fr 1fr; } }
@media print {
  html, body { background: #ffffff !important; }
  body * { visibility: hidden !important; }
  .print-area, .print-area * { visibility: visible !important; }
  .print-area { display: block; position: fixed; inset: 0; width: 100%; height: auto; background: #ffffff; padding: 28px; z-index: 99999; color: #111827; }
  .print-meta, .print-table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  .print-meta td, .print-table th, .print-table td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  .print-table th { background: #f3f4f6; }
  .print-table tfoot th { text-align: right; }
}
</style>