<!-- StoreTransfersPage — stock transfers between outlets (real API). -->
<template>
  <div class="sm-page">
    <div v-if="!canTransfer" class="alert alert-info">
      <i class="fas fa-circle-info"></i> {{ $t('storeManager.transfers.multiOutletOnly') }}
    </div>
    <div v-else class="sm-toolbar">
      <CalendarInput v-model="businessDate" :clearable="false" />
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ statusLabel(s) }}</option></select>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.transfers.add') }}</button>
    </div>
    <section v-if="canTransfer" class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="transfers.length">
          <thead><tr>
            <th>S/N</th><th>{{ $t('common.reference') }}</th><th>{{ $t('common.date') }}</th><th>{{ $t('inventory.itemName') }}</th>
            <th>{{ $t('storeManager.transfers.from') }}</th><th>{{ $t('storeManager.transfers.to') }}</th>
            <th>{{ $t('storeManager.sales.qty') }}</th><th>{{ $t('storeManager.transfers.costValue') }}</th>
            <th>{{ $t('common.status') }}</th><th>{{ $t('common.actions') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="(tr, idx) in paged" :key="tr.transfer_id">
              <td>{{ (page - 1) * 15 + idx + 1 }}</td>
              <td><strong>{{ tr.transfer_number }}</strong></td>
              <td>{{ fmtDate(tr.business_date || tr.created_at) }}</td>
              <td>{{ lineSummary(tr) }}</td>
              <td>{{ fromName(tr) }}</td>
              <td>{{ toName(tr) }}</td>
              <td>{{ totalQty(tr) }}</td>
              <td>{{ money(tr.total_cost) }}</td>
              <td><span class="chip" :class="{ danger: tr.status === 'voided' }">{{ statusLabel(tr.status) }}</span></td>
              <td>
                <div class="row-actions">
                  <button class="sm-btn sm ghost" :title="$t('common.print')" @click="printTransfer(tr)"><i class="fas fa-print"></i></button>
                  <button class="sm-btn sm ghost" :title="$t('common.share')" @click="shareTransfer(tr)"><i class="fas fa-share-nodes"></i></button>
                  <button v-if="tr.status === 'draft'" class="sm-btn sm primary" :title="$t('storeManager.transfers.send')" @click="sendTransfer(tr)"><i class="fas fa-paper-plane"></i></button>
                  <button v-if="tr.status === 'draft' || tr.status === 'sent' || tr.status === 'completed'" class="sm-btn sm danger" :title="$t('storeManager.common.void')" @click="askVoid(tr)"><i class="fas fa-ban"></i></button>
                  <span v-if="tr.status === 'voided'" class="void-reason">{{ tr.void_reason }}</span>
                </div>
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
      <div class="sm-modal wide">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.transfers.add') }}</h3><button class="x" @click="showForm = false">×</button></div>
        <div class="transfer-grid">
          <label class="fld"><span>{{ $t('storeManager.transfers.from') }}</span>
            <SearchableSelect v-model="form.from_outlet_id" :options="outletOptions" :force-search="true" />
          </label>
          <label class="fld"><span>{{ $t('storeManager.transfers.to') }}</span>
            <SearchableSelect v-model="form.to_outlet_id" :options="outletOptions" :force-search="true" />
          </label>
        </div>
        <label class="fld"><span>{{ $t('inventory.itemName') }}</span>
          <SearchableSelect v-model="form.item_id" :options="itemOptions" :force-search="true" @change="onPickItem">
            <template #option="{ option }">
              <span>{{ option.label }} <small class="muted">{{ option.category }} · {{ option.stock }} {{ option.unit }} · {{ curCode() }} {{ Number(option.unit_cost || 0).toLocaleString() }}</small></span>
            </template>
          </SearchableSelect>
        </label>
        <div class="transfer-grid">
          <label class="fld"><span>{{ $t('inventory.unit') }}</span>
            <select v-model="form.unit" class="sm-input">
              <option v-for="u in unitOptions" :key="u" :value="u">{{ u }}</option>
            </select>
          </label>
          <label class="fld"><span>{{ $t('storeManager.sales.qty') }}</span><input v-model.number="form.quantity" type="number" min="1" step="0.01" class="sm-input" /></label>
        </div>
        <div v-if="selectedItem" class="transfer-preview">
          <span>{{ $t('storeManager.transfers.onShelf', { qty: baseQuantity, unit: selectedItem.unit || '—' }) }}</span>
          <strong>{{ curCode() }} {{ lineCost.toLocaleString() }}</strong>
        </div>
        <label class="fld"><span>{{ $t('storeManager.common.notes') }}</span><input v-model="form.notes" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn ghost" :disabled="saving" @click="save(false)">{{ saving ? $t('common.saving') : $t('storeManager.transfers.saveDraft') }}</button>
          <button class="sm-btn" :disabled="saving" @click="save(true)"><i class="fas fa-paper-plane"></i> {{ saving ? $t('common.saving') : $t('storeManager.transfers.saveSend') }}</button>
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
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryOpsApi } from '../../api'
import CalendarInput from '@/components/CalendarInput.vue'
import { useOutletContext } from '@/composables/useOutletContext'
import { useWorkingDateStore } from '@/stores/workingDate'
import SearchableSelect from '@/components/SearchableSelect.vue'
import PaginationBar from '@/components/store/PaginationBar.vue'
import { useClientTable } from '@/composables/useClientTable.js'
import { fetchAllInventoryItems } from '@/utils/inventoryItems.js'
import { useTenantCurrency } from '@/utils/currency'

const { t } = useI18n()
const { curCode } = useTenantCurrency()
const workingDateStore = useWorkingDateStore()
const { outlets, selectedOutlet, loadOutlets } = useOutletContext()
const canTransfer = computed(() => outlets.value.length > 1)
const businessDate = ref('')
const loadedDate = ref('')
const transfers = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(transfers, {
  pageSize: 15,
  searchFields: [
    'transfer_number', 'transfer_id', 'status',
    (r) => fromName(r),
    (r) => toName(r),
    (r) => lineSummary(r),
  ],
})
const items = ref([])
const itemOptions = computed(() => items.value.map((i) => ({
  value: i.item_id,
  label: `${i.item_name}${i.unit ? ` (${i.unit})` : ''}`,
  category: i.category,
  unit: i.unit,
  stock: i.quantity_in_stock ?? 0,
  unit_cost: i.unit_cost,
})))
const outletOptions = computed(() => outlets.value.map((o) => ({
  value: o.outlet_id,
  label: o.stock_department ? o.name : `${o.name} (${t('storeManager.transfers.noShelf')})`,
})))
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const formError = ref('')
const voidTarget = ref(null)
const voidReason = ref('')
const form = reactive({
  item_id: null,
  from_outlet_id: null,
  to_outlet_id: null,
  unit: '',
  quantity: 1,
  notes: '',
})

const selectedItem = computed(() => items.value.find((i) => String(i.item_id) === String(form.item_id)) || null)
const unitOptions = computed(() => {
  const item = selectedItem.value
  if (!item) return []
  const names = []
  if (item.unit) names.push(item.unit)
  for (const entry of item.si_units || []) {
    const name = typeof entry === 'string' ? entry : entry?.unit
    if (name && !names.includes(name)) names.push(name)
  }
  return names.length ? names : ['PCS']
})
const unitFactor = computed(() => {
  const item = selectedItem.value
  if (!item || !form.unit || form.unit === item.unit) return 1
  for (const entry of item.si_units || []) {
    const name = typeof entry === 'string' ? entry : entry?.unit
    if (name === form.unit) return Number(typeof entry === 'string' ? 1 : entry?.factor ?? 1) || 1
  }
  return 1
})
const baseQuantity = computed(() => Math.round(Number(form.quantity || 0) * unitFactor.value * 100) / 100)
const lineCost = computed(() => Math.round(baseQuantity.value * Number(selectedItem.value?.unit_cost || 0) * 100) / 100)

function fmtDate(v) { return v ? new Date(v).toLocaleDateString() : '-' }
function money(v) { return `${curCode()} ${Number(v || 0).toLocaleString()}` }
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}
function statusLabel(v) {
  return ({ draft: t('storeManager.transfers.draft'), sent: t('storeManager.transfers.sent'), completed: t('storeManager.transfers.sent'), voided: t('storeManager.common.voided') })[v] || v
}
function outletName(id) { return outlets.value.find((o) => o.outlet_id === id)?.name || '—' }
function fromName(tr) { return tr.from_outlet?.name || outletName(tr.from_outlet_id) || tr.from_department?.name || '—' }
function toName(tr) { return tr.to_outlet?.name || outletName(tr.to_outlet_id) || tr.to_department?.name || '—' }
function lineSummary(tr) {
  const lines = tr.items || []
  if (!lines.length) return '—'
  return lines.map((l) => l.item?.item_name || l.item_name).filter(Boolean).join(', ') || '—'
}
function totalQty(tr) {
  return (tr.items || []).reduce((sum, l) => sum + Number(l.quantity || 0), 0) || '—'
}
function onPickItem(hit) {
  const id = hit?.value ?? hit
  form.item_id = id ?? null
  const found = items.value.find((i) => String(i.item_id) === String(id))
  form.unit = found?.unit || ''
}

async function loadTransfers() {
  loading.value = true
  try {
    const res = await inventoryOpsApi.transfers({ per_page: 50, date: businessDate.value })
    transfers.value = res.data.transfers || []
    loadedDate.value = businessDate.value
  } catch {
    transfers.value = []
  } finally { loading.value = false }
}
async function loadItems() {
  try { items.value = await fetchAllInventoryItems() } catch { items.value = [] }
}
async function load() {
  await Promise.all([loadTransfers(), loadItems()])
}
function openCreate() {
  const first = selectedOutlet.value?.outlet_id || outlets.value[0]?.outlet_id || null
  const second = outlets.value.find((o) => o.outlet_id !== first)?.outlet_id || null
  Object.assign(form, {
    item_id: items.value[0]?.item_id || null,
    from_outlet_id: first,
    to_outlet_id: second,
    unit: items.value[0]?.unit || '',
    quantity: 1,
    notes: '',
  })
  formError.value = ''
  showForm.value = true
}
async function save(send = true) {
  formError.value = ''
  if (!form.from_outlet_id || !form.to_outlet_id || form.from_outlet_id === form.to_outlet_id) {
    formError.value = t('storeManager.transfers.sameOutlet')
    return
  }
  if (!form.item_id) {
    formError.value = t('storeManager.transfers.itemRequired')
    return
  }
  if (!(baseQuantity.value > 0)) {
    formError.value = t('storeManager.transfers.quantityRequired')
    return
  }
  saving.value = true
  try {
    await inventoryOpsApi.storeTransfer({
      from_outlet_id: form.from_outlet_id,
      to_outlet_id: form.to_outlet_id,
      business_date: businessDate.value,
      notes: form.notes,
      send,
      items: [{ item_id: form.item_id, quantity: baseQuantity.value }],
    })
    showForm.value = false
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
async function sendTransfer(tr) {
  try {
    await inventoryOpsApi.sendTransfer(tr.transfer_id)
    await load()
  } catch (e) { window.alert(e.response?.data?.message || t('common.error')) }
}
function printTransfer(tr) {
  const rows = (tr.items || []).map((l) => {
    const qty = Number(l.quantity || 0)
    const cost = Number(l.item?.unit_cost || 0)
    return `<tr><td>${esc(l.item?.item_name || l.item_name || '-')}</td><td>${qty} ${esc(l.item?.unit || '')}</td><td>${money(cost)}</td><td>${money(qty * cost)}</td></tr>`
  }).join('')
  const total = Number(tr.total_cost || (tr.items || []).reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.item?.unit_cost || 0), 0))
  const voided = tr.status === 'voided'
    ? `<div class="voided">VOIDED${tr.void_reason ? ` — ${esc(tr.void_reason)}` : ''}</div>`
    : ''
  const w = window.open('', '_blank')
  if (!w) return
  const closeScript = '</' + 'script>'
  w.document.write(`<html><head><title>${esc(tr.transfer_number)}</title><style>
    body{font-family:Arial,sans-serif;padding:32px;color:#111827}
    h2{margin:0 0 4px} .muted{color:#64748b}
    .voided{margin:12px 0;padding:8px 12px;border:2px solid #b91c1c;color:#b91c1c;font-weight:700;letter-spacing:1px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #d1d5db;padding:8px;text-align:left}
    tfoot td{font-weight:700}.sign{display:flex;gap:48px;margin-top:60px}
    .sign div{flex:1;border-top:1px solid #111;padding-top:6px}
  </style></head><body>
    <h2>${esc(tr.transfer_number)}</h2>
    <p>${esc(fromName(tr))} → ${esc(toName(tr))} · ${esc(statusLabel(tr.status))}<br><span class="muted">${fmtDate(tr.business_date || tr.created_at)}</span></p>
    ${voided}
    <table><thead><tr><th>Item</th><th>Quantity</th><th>Unit cost</th><th>Cost</th></tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><td colspan="3">Total</td><td>${money(total)}</td></tr></tfoot></table>
    <div class="sign"><div>${esc(t('storeManager.transfers.creator'))}</div><div>${esc(t('storeManager.transfers.supervisor'))}</div><div>${esc(t('storeManager.transfers.authorizedBy'))}</div></div>
    <script>window.print()${closeScript}</body></html>`)
  w.document.close()
}
async function shareTransfer(tr) {
  const text = `${tr.transfer_number}: ${lineSummary(tr)} (${fromName(tr)} → ${toName(tr)}) · ${money(tr.total_cost)}`
  if (navigator.share) { try { await navigator.share({ title: tr.transfer_number, text }) } catch { /* cancelled */ } }
  else window.location.href = `mailto:?subject=${encodeURIComponent(tr.transfer_number)}&body=${encodeURIComponent(text)}`
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
watch(businessDate, async (date) => {
  if (!date || date === loadedDate.value) return
  await loadTransfers()
})
onMounted(async () => {
  await Promise.all([loadOutlets(), workingDateStore.ensureLoaded()])
  businessDate.value = workingDateStore.workingDate
  loadedDate.value = businessDate.value
  await load()
})
</script>

<style scoped>
.danger { background: #fde8e8; color: #b91c1c; }
.slim-btn { padding: 4px 10px; font-size: 12px; }
.void-reason { font-size: 12px; color: #64748b; font-style: italic; }
.alert-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 14px; display: flex; gap: 8px; align-items: center; }
.row-actions { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.transfer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.transfer-preview { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 4px 0 12px; padding: 9px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; color: #1e40af; font-size: 13px; }
.transfer-preview strong { font-size: 14px; }
</style>
