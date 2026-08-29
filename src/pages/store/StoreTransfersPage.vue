<!-- StoreTransfersPage — stock transfers between departments (real API). -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.transfers.add') }}</button>
    </div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="transfers.length">
          <thead><tr>
            <th>{{ $t('common.date') }}</th><th>{{ $t('inventory.itemName') }}</th>
            <th>{{ $t('storeManager.transfers.from') }}</th><th>{{ $t('storeManager.transfers.to') }}</th>
            <th>{{ $t('storeManager.sales.qty') }}</th><th>{{ $t('common.status') }}</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-for="tr in paged" :key="tr.transfer_id">
              <td>{{ fmtDate(tr.created_at) }}</td>
              <td><strong>{{ lineSummary(tr) }}</strong></td>
              <td>{{ deptName(tr.from_department_id) }}</td>
              <td>{{ deptName(tr.to_department_id) }}</td>
              <td>{{ totalQty(tr) }}</td>
              <td><span class="chip" :class="{ danger: tr.status === 'voided' }">{{ tr.status }}</span></td>
              <td>
                <button v-if="tr.status === 'completed'" class="sm-btn ghost slim-btn"
                  @click="askVoid(tr)">{{ $t('storeManager.common.void') }}</button>
                <span v-else-if="tr.status === 'voided'" class="void-reason">{{ tr.void_reason }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.transfers.empty') }}</p>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
      </div>
      </template>
    </section>
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.transfers.add') }}</h3><button class="x" @click="showForm = false">×</button></div>
        <label class="fld"><span>{{ $t('storeManager.transfers.from') }}</span>
          <select v-model="form.from_department_id" class="sm-select">
            <option v-for="d in departments" :key="d.department_id" :value="d.department_id">{{ d.name }}</option>
          </select>
        </label>
        <label class="fld"><span>{{ $t('storeManager.transfers.to') }}</span>
          <select v-model="form.to_department_id" class="sm-select">
            <option v-for="d in departments" :key="d.department_id" :value="d.department_id">{{ d.name }}</option>
          </select>
        </label>
        <label class="fld"><span>{{ $t('inventory.itemName') }}</span>
          <select v-model="form.item_id" class="sm-select">
            <option v-for="i in items" :key="i.item_id" :value="i.item_id">{{ i.item_name }} ({{ i.quantity_in_stock }})</option>
          </select>
        </label>
        <label class="fld"><span>{{ $t('storeManager.sales.qty') }}</span><input v-model.number="form.quantity" type="number" min="1" class="sm-input" /></label>
        <label class="fld"><span>{{ $t('storeManager.common.notes') }}</span><input v-model="form.notes" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="save">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </div>
    <div v-if="voidTarget" class="sm-modal-backdrop" @click.self="voidTarget = null">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.common.voidTitle') }}</h3><button class="x" @click="voidTarget = null">×</button></div>
        <label class="fld"><span>{{ $t('storeManager.common.reason') }}</span><input v-model="voidReason" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="voidTarget = null">{{ $t('common.cancel') }}</button>
          <button class="sm-btn danger" :disabled="saving" @click="confirmVoid">{{ saving ? $t('common.saving') : $t('storeManager.common.void') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryApi, inventoryOpsApi } from '../../api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import { useClientTable } from '@/composables/useClientTable.js'

const { t } = useI18n()
const transfers = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(transfers, { pageSize: 15, searchFields: ['transfer_id', 'status', (r) => deptName(r.from_department_id), (r) => deptName(r.to_department_id)] })
const departments = ref([])
const items = ref([])
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const formError = ref('')
const voidTarget = ref(null)
const voidReason = ref('')
const form = reactive({ item_id: null, from_department_id: null, to_department_id: null, quantity: 1, notes: '' })

function fmtDate(v) { return v ? new Date(v).toLocaleDateString() : '-' }
function deptName(id) { return departments.value.find((d) => d.department_id === id)?.name || '—' }
function lineSummary(tr) {
  const lines = tr.items || []
  if (!lines.length) return '—'
  return lines.map((l) => l.item?.item_name || l.item_name).filter(Boolean).join(', ') || '—'
}
function totalQty(tr) {
  return (tr.items || []).reduce((sum, l) => sum + Number(l.quantity || 0), 0) || '—'
}

async function load() {
  loading.value = true
  try {
    const [tr, dp, it] = await Promise.allSettled([
      inventoryOpsApi.transfers({ per_page: 50 }),
      inventoryOpsApi.departments(),
      inventoryApi.index({ per_page: 100 }),
    ])
    transfers.value = tr.status === 'fulfilled' ? (tr.value.data.transfers || []) : []
    departments.value = dp.status === 'fulfilled' ? (dp.value.data.departments || []) : []
    items.value = it.status === 'fulfilled' ? (it.value.data.data || it.value.data || []) : []
  } finally { loading.value = false }
}
function openCreate() {
  Object.assign(form, {
    item_id: items.value[0]?.item_id || null,
    from_department_id: departments.value[0]?.department_id || null,
    to_department_id: departments.value[1]?.department_id || null,
    quantity: 1, notes: '',
  })
  formError.value = ''
  showForm.value = true
}
async function save() {
  saving.value = true; formError.value = ''
  try {
    await inventoryOpsApi.storeTransfer({ ...form, items: [{ item_id: form.item_id, quantity: form.quantity }] })
    showForm.value = false
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
function askVoid(tr) {
  voidReason.value = ''
  voidTarget.value = tr
  formError.value = ''
}
async function confirmVoid() {
  if (!voidReason.value.trim()) { formError.value = t('storeManager.common.reasonRequired'); return }
  saving.value = true
  try {
    await inventoryOpsApi.voidTransfer(voidTarget.value.transfer_id, voidReason.value.trim())
    voidTarget.value = null
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
onMounted(load)
</script>

<style scoped>
.danger { background: #fde8e8; color: #b91c1c; }
.slim-btn { padding: 4px 10px; font-size: 12px; }
.void-reason { font-size: 12px; color: #64748b; font-style: italic; }
</style>
