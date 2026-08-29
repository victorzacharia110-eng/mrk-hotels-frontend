<!--
  StoreGoodsReceivedPage — goods received notes: list, and a record-GRN
  modal that pulls the selected purchase order's items for receipt capture.
-->

<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
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
              <td><span class="chip" :class="grn.inspection_status">{{ grn.inspection_status }}</span></td>
              <td>
                <div class="row-actions">
                  <button class="sm-btn sm ghost" @click="openDetail(grn)"><i class="fas fa-eye"></i></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('goodsReceived.empty') }}</p>
      </div>
        <div class="sm-pagination" v-if="meta.last_page > 1">
          <button :disabled="meta.current_page <= 1" @click="go(meta.current_page - 1)">&laquo;</button>
          <span>{{ meta.current_page }} / {{ meta.last_page }}</span>
          <button :disabled="meta.current_page >= meta.last_page" @click="go(meta.current_page + 1)">&raquo;</button>
        </div>
      </template>
    </section>

    <!-- Record GRN modal -->
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal wide">
        <div class="sm-modal-head">
          <h3>{{ $t('goodsReceived.create') }}</h3>
          <button class="sm-modal-close" @click="showForm = false"><i class="fas fa-xmark"></i></button>
        </div>
        <form class="sm-modal-body" @submit.prevent="save">
          <div class="form-grid">
            <div class="form-field">
              <label>{{ $t('goodsReceived.purchaseOrder') }}</label>
              <select v-model="form.po_id" class="sm-select" style="width:100%" required @change="loadPoItems">
                <option value="" disabled>{{ $t('common.select') }}</option>
                <option v-for="po in receivableOrders" :key="po.po_id" :value="po.po_id">{{ po.po_number }} — {{ po.supplier?.supplier_name || '' }}</option>
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

          <div class="table-scroll">
        <table class="sm-table" v-if="form.items.length">
            <thead>
              <tr>
                <th>{{ $t('inventory.itemName') }}</th>
                <th>{{ $t('goodsReceived.ordered') }}</th>
                <th>{{ $t('goodsReceived.received') }}</th>
                <th>{{ $t('goodsReceived.rejected') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in form.items" :key="item.po_item_id">
                <td>{{ item.item_name }}</td>
                <td>{{ item.quantity_ordered }}</td>
                <td><input v-model.number="item.quantity_received" type="number" min="0" :max="item.quantity_ordered" class="sm-input" style="width:90px" /></td>
                <td><input v-model.number="item.quantity_rejected" type="number" min="0" class="sm-input" style="width:90px" /></td>
              </tr>
            </tbody>
          </table>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
      </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="sm-modal-foot">
            <button type="button" class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
            <button type="submit" class="sm-btn" :disabled="saving || !form.items.length">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Detail modal -->
    <div v-if="detail" class="sm-modal-backdrop" @click.self="detail = null">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ detail.grn_number }}</h3>
          <button class="sm-modal-close" @click="detail = null"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="sm-modal-body">
          <p><strong>{{ $t('goodsReceived.purchaseOrder') }}:</strong> {{ detail.purchase_order?.po_number || '-' }}</p>
          <p><strong>{{ $t('goodsReceived.supplier') }}:</strong> {{ detail.supplier?.supplier_name || '-' }}</p>
          <p><strong>{{ $t('goodsReceived.inspection') }}:</strong> <span class="chip" :class="detail.inspection_status">{{ detail.inspection_status }}</span></p>
          <p v-if="detail.notes"><strong>{{ $t('common.notes') }}:</strong> {{ detail.notes }}</p>
          <div class="table-scroll">
        <table class="sm-table">
            <thead><tr><th>{{ $t('inventory.itemName') }}</th><th>{{ $t('goodsReceived.ordered') }}</th><th>{{ $t('goodsReceived.received') }}</th><th>{{ $t('goodsReceived.rejected') }}</th></tr></thead>
            <tbody>
              <tr v-for="(item, i) in detail.items || []" :key="i">
                <td>{{ item.item_name || item.purchase_order_item?.item_name || '-' }}</td>
                <td>{{ item.quantity_ordered ?? '-' }}</td>
                <td>{{ item.quantity_received }}</td>
                <td>{{ item.quantity_rejected || 0 }}</td>
              </tr>
            </tbody>
          </table>
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
import { goodsReceivedNoteApi, purchaseOrderApi } from '@/api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import { useClientTable } from '@/composables/useClientTable.js'

const route = useRoute()
const { t } = useI18n()

const grns = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(grns, { pageSize: 15, searchFields: ['grn_number', 'status', (r) => r.po?.po_number] })
const receivableOrders = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const detail = ref(null)
const formError = ref('')

const form = reactive({ po_id: '', inspection_status: 'pending', received_date: '', delivery_note_number: '', notes: '', items: [] })

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

async function load(page = meta.value.current_page) {
  loading.value = true
  try {
    const res = await goodsReceivedNoteApi.index({ page, per_page: 20 })
    grns.value = res.data.data || res.data || []
    meta.value = res.data.meta || { current_page: 1, last_page: 1 }
  } finally {
    loading.value = false
  }
}

function go(page) { load(page) }

async function openCreate() {
  Object.assign(form, { po_id: '', inspection_status: 'pending', received_date: new Date().toISOString().slice(0, 10), delivery_note_number: '', notes: '', items: [] })
  formError.value = ''
  showForm.value = true
  try {
    const res = await purchaseOrderApi.index({ per_page: 100 })
    const all = res.data.data || res.data || []
    receivableOrders.value = all.filter((po) => ['approved', 'partially_received'].includes(po.status))
  } catch {
    receivableOrders.value = []
  }
}

async function loadPoItems() {
  form.items = []
  if (!form.po_id) return
  const res = await purchaseOrderApi.show(form.po_id)
  const po = res.data.purchase_order
  form.items = (po.items || []).map((item) => ({
    po_item_id: item.po_item_id,
    item_name: item.item_name,
    quantity_ordered: item.quantity,
    quantity_received: item.quantity,
    quantity_rejected: 0,
  }))
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    await goodsReceivedNoteApi.store({
      po_id: form.po_id,
      inspection_status: form.inspection_status,
      received_date: form.received_date || undefined,
      delivery_note_number: form.delivery_note_number || undefined,
      notes: form.notes || undefined,
      items: form.items.map((item) => ({
        po_item_id: item.po_item_id,
        quantity_received: item.quantity_received,
        quantity_rejected: item.quantity_rejected || undefined,
      })),
    })
    showForm.value = false
    await load(1)
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

onMounted(async () => {
  await load(1)
  if (route.query.create === '1') openCreate()
})
</script>
