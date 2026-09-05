<!--
  StorePurchaseOrdersPage — purchase orders: list with status filter,
  multi-item create form (optionally linked to an approved requisition),
  approval actions and detail view.
-->

<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <select v-model="statusFilter" class="sm-select" @change="load(1)">
        <option value="">{{ $t('common.allStatuses') }}</option>
        <option value="pending">{{ $t('common.pending') }}</option>
        <option value="manager_approved">{{ $t('purchaseOrders.managerApproved') }}</option>
        <option value="approved">{{ $t('common.approved') }}</option>
        <option value="partially_received">{{ $t('purchaseOrders.partiallyReceived') }}</option>
        <option value="received">{{ $t('purchaseOrders.received') }}</option>
        <option value="cancelled">{{ $t('common.cancelled') }}</option>
        <option value="rejected">{{ $t('purchaseOrders.rejected') }}</option>
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
              <td>{{ po.delivery_date || '-' }}</td>
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
        <p v-else class="empty">{{ $t('purchaseOrders.empty') }}</p>
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
          <h3>{{ $t('purchaseOrders.create') }}</h3>
          <button class="sm-modal-close" @click="showForm = false"><i class="fas fa-xmark"></i></button>
        </div>
        <form class="sm-modal-body" @submit.prevent="save">
          <div class="form-grid">
            <div class="form-field">
              <label>{{ $t('goodsReceived.supplier') }}</label>
              <select v-model="form.supplier_id" class="sm-select" style="width:100%" required>
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
            <div class="form-field"><label>{{ $t('purchaseOrders.deliveryDate') }}</label><input v-model="form.delivery_date" type="date" class="sm-input" /></div>
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
                  <span>{{ option.label }} <small class="muted">{{ option.category }}</small></span>
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
            <button type="button" class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
            <button type="submit" class="sm-btn" :disabled="saving">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Detail modal -->
    <div v-if="detail" class="sm-modal-backdrop" @click.self="detail = null">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ detail.po_number }}</h3>
          <button class="sm-modal-close" @click="detail = null"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="sm-modal-body">
          <p><strong>{{ $t('goodsReceived.supplier') }}:</strong> {{ detail.supplier?.supplier_name || '-' }}</p>
          <p><strong>{{ $t('common.status') }}:</strong> <span class="chip" :class="detail.status">{{ detail.status.replaceAll('_', ' ') }}</span></p>
          <p v-if="detail.delivery_date"><strong>{{ $t('purchaseOrders.deliveryDate') }}:</strong> {{ detail.delivery_date }}</p>
          <p v-if="detail.notes"><strong>{{ $t('common.notes') }}:</strong> {{ detail.notes }}</p>
          <div class="table-scroll">
        <table class="sm-table">
            <thead><tr><th>{{ $t('inventory.itemName') }}</th><th>{{ $t('inventory.quantity') }}</th><th>{{ $t('inventory.unitCost') }}</th><th>{{ $t('purchaseOrders.total') }}</th></tr></thead>
            <tbody>
              <tr v-for="(item, i) in detail.items || []" :key="i">
                <td>{{ item.item_name }}</td><td>{{ item.quantity }}</td>
                <td>TZS {{ Number(item.unit_price || 0).toLocaleString() }}</td>
                <td>TZS {{ (Number(item.quantity || 0) * Number(item.unit_price || 0)).toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
      </div>
          <p class="po-total"><strong>{{ $t('purchaseOrders.total') }}: TZS {{ Number(detail.total_amount || 0).toLocaleString() }}</strong></p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { purchaseOrderApi, purchaseRequisitionApi, supplierApi, inventoryApi } from '@/api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useClientTable } from '@/composables/useClientTable.js'

const { t } = useI18n()

const orders = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(orders, { pageSize: 15, searchFields: ['po_number', 'supplier_name', 'status'] })
const suppliers = ref([])
const approvedReqs = ref([])
const inventoryItems = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const loading = ref(false)
const saving = ref(false)
const statusFilter = ref('')
const showForm = ref(false)
const detail = ref(null)
const formError = ref('')

const form = reactive({ supplier_id: '', pr_id: '', delivery_date: '', payment_terms: '', delivery_address: '', notes: '', items: [emptyItem()] })

function emptyItem() {
  return { item_id: '', item_name: '', description: '', quantity: null, unit: '', si_units: [], unit_price: null }
}

// Registered inventory items are the only orderable lines; picking one also
// carries its registered unit so receiving stocks the right record.
const itemOptions = computed(() =>
  inventoryItems.value.map((item) => ({
    value: item.item_id,
    label: `${item.item_name}${item.unit ? ` (${item.unit})` : ''}`,
    category: item.category,
    stock: item.quantity_in_stock,
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
  line.si_units = found?.si_units?.length ? [...found.si_units] : []
  if (found?.unit) line.unit = found.unit
}

const poTotal = computed(() =>
  form.items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_price || 0), 0)
)

async function load(page = meta.value.current_page) {
  loading.value = true
  try {
    const params = { page, per_page: 20 }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await purchaseOrderApi.index(params)
    orders.value = res.data.data || res.data || []
    meta.value = res.data.meta || { current_page: 1, last_page: 1 }
  } finally {
    loading.value = false
  }
}

function go(page) { load(page) }

async function openCreate() {
  Object.assign(form, { supplier_id: '', pr_id: '', delivery_date: '', payment_terms: '', delivery_address: '', notes: '', items: [emptyItem()] })
  formError.value = ''
  showForm.value = true
  const [sup, req, inv] = await Promise.allSettled([
    supplierApi.index({ per_page: 100 }),
    purchaseRequisitionApi.index({ status: 'approved', per_page: 100 }),
    inventoryApi.index({ per_page: 200 }),
  ])
  if (sup.status === 'fulfilled') suppliers.value = sup.value.data.data || sup.value.data || []
  if (req.status === 'fulfilled') approvedReqs.value = req.value.data.data || req.value.data || []
  if (inv.status === 'fulfilled') inventoryItems.value = inv.value.data.data || inv.value.data || []
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    await purchaseOrderApi.store({
      supplier_id: form.supplier_id,
      pr_id: form.pr_id || undefined,
      delivery_date: form.delivery_date || undefined,
      payment_terms: form.payment_terms || undefined,
      delivery_address: form.delivery_address || undefined,
      notes: form.notes || undefined,
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
  detail.value = res.data.data || res.data
}

onMounted(() => load(1))
</script>

<style scoped>
.items-block { display: flex; flex-direction: column; gap: 10px; }
.items-head { display: flex; align-items: center; justify-content: space-between; }
.item-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 8px; }
.po-total { text-align: right; color: #333333; margin: 4px 0 0; }
@media (max-width: 700px) { .item-grid { grid-template-columns: 1fr 1fr; } }
</style>
