<!-- StoreTransfersPage — stock transfers between outlets (real API). -->
<template>
  <div class="sm-page">
    <div v-if="!canTransfer" class="alert alert-info">
      <i class="fas fa-circle-info"></i> {{ $t('storeManager.transfers.multiOutletOnly') }}
    </div>
    <div v-else class="sm-toolbar">
      <CalendarInput v-model="businessDate" :clearable="false" @change="loadTransfers" />
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-model="statusFilter" class="sm-select">
        <option value="">{{ $t('common.allStatuses') }}</option>
        <option value="draft">{{ $t('storeManager.transfers.draft') }}</option>
        <option value="sent">{{ $t('storeManager.transfers.sent') }}</option>
      </select>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.transfers.add') }}</button>
    </div>
    <section v-if="canTransfer" class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
          <table class="sm-table" v-if="filteredTransfers.length">
            <thead><tr>
              <th>S/N</th>
              <th>{{ $t('storeManager.transfers.from') }}</th>
              <th>{{ $t('storeManager.transfers.to') }}</th>
              <th>{{ $t('storeManager.transfers.manager') }}</th>
              <th>{{ $t('storeManager.transfers.recordedAt') }}</th>
              <th>{{ $t('common.status') }}</th>
              <th>{{ $t('storeManager.transfers.costValue') }}</th>
            </tr></thead>
            <tbody>
              <tr v-for="tr in pagedTransfers" :key="tr.transfer_id">
                <td><button class="ref-link" @click="openDetail(tr)">{{ tr.transfer_number }}</button></td>
                <td>{{ fromName(tr) }}</td>
                <td>{{ toName(tr) }}</td>
                <td>{{ managerName(tr) }}</td>
                <td>{{ fmtDateTime(tr.created_at) }}</td>
                <td><span class="chip" :class="{ danger: tr.status === 'voided' }">{{ statusLabel(tr.status) }}</span></td>
                <td><strong>{{ money(tr.total_cost) }}</strong></td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty">{{ $t('storeManager.transfers.empty') }}</p>
          <PaginationBar :page="Math.min(page, lastPage)" :last-page="lastPage" @change="page = $event" />
        </div>
      </template>
    </section>

    <!-- New transfer: same item-line layout as purchase orders. -->
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal wide">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.transfers.add') }}</h3><button class="x" @click="showForm = false">×</button></div>
        <form class="sm-modal-body" @submit.prevent="save(true)">
          <div class="transfer-grid">
            <label class="fld"><span>{{ $t('storeManager.transfers.from') }}</span>
              <SearchableSelect v-model="form.from_outlet_id" :options="outletOptions" :force-search="true" />
            </label>
            <label class="fld"><span>{{ $t('storeManager.transfers.to') }}</span>
              <SearchableSelect v-model="form.to_outlet_id" :options="outletOptions" :force-search="true" />
            </label>
          </div>

          <div class="items-block">
            <div class="items-head">
              <strong>{{ $t('common.items') }}</strong>
              <button type="button" class="sm-btn sm ghost" @click="form.items.push(emptyLine())">
                <i class="fas fa-plus"></i> {{ $t('requisitions.addItem') }}
              </button>
            </div>
            <div v-for="(line, idx) in form.items" :key="idx" class="item-grid">
              <SearchableSelect
                v-model="line.item_id"
                :options="itemOptions"
                :placeholder="$t('inventory.searchItems')"
                :search-placeholder="$t('inventory.searchItems')"
                :empty-label="$t('inventory.selectItem')"
                required
                @change="onPickItem(line, $event)"
              >
                <template #option="{ option }">
                  <span>{{ option.label }} <small class="muted">{{ option.category }} · {{ option.stock }} {{ option.unit }} · {{ curCode() }} {{ Number(option.unit_cost || 0).toLocaleString() }}</small></span>
                </template>
              </SearchableSelect>
              <input v-model.number="line.quantity" type="number" min="0.01" step="0.01" class="sm-input" :placeholder="$t('storeManager.sales.qty')" required />
              <select v-model="line.unit" class="sm-input">
                <option v-for="u in unitOptionsFor(line)" :key="u" :value="u">{{ u }}</option>
              </select>
              <input :value="money(unitCostFor(line))" class="sm-input" readonly :title="$t('inventory.unitCost', { currency: curCode() })" />
              <button type="button" class="sm-btn sm danger" :disabled="form.items.length === 1" @click="form.items.splice(idx, 1)">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>

          <div class="transfer-preview">
            <span>{{ $t('storeManager.transfers.totalCost') }}</span>
            <strong>{{ money(transferTotal) }}</strong>
          </div>
          <label class="fld"><span>{{ $t('storeManager.common.notes') }}</span><input v-model="form.notes" class="sm-input" /></label>
          <p v-if="formError" class="sm-error">{{ formError }}</p>
          <div class="sm-modal-foot">
            <button type="button" class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
            <button type="button" class="sm-btn ghost" :disabled="saving" @click="save(false)">
              {{ saving ? $t('common.saving') : $t('storeManager.transfers.saveDraft') }}
            </button>
            <button type="submit" class="sm-btn" :disabled="saving">
              <i class="fas fa-paper-plane"></i> {{ saving ? $t('common.saving') : $t('storeManager.transfers.saveSend') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Transfer detail: all commands live here, not in the list row. -->
    <div v-if="detailTransfer" class="sm-modal-backdrop" @click.self="detailTransfer = null">
      <div class="sm-modal wide">
        <div class="sm-modal-head">
          <h3>{{ detailTransfer.transfer_number }}</h3>
          <button class="sm-modal-close" @click="detailTransfer = null"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="sm-modal-body">
          <div class="detail-actions">
            <button class="sm-btn sm ghost" @click="printTransfer(detailTransfer)"><i class="fas fa-print"></i> {{ $t('common.print') }}</button>
            <button class="sm-btn sm ghost" @click="shareTransfer(detailTransfer)"><i class="fas fa-share-nodes"></i> {{ $t('common.share') }}</button>
            <button v-if="detailTransfer.status === 'draft'" class="sm-btn sm primary" @click="sendTransfer(detailTransfer)">
              <i class="fas fa-paper-plane"></i> {{ $t('storeManager.transfers.send') }}
            </button>
            <button v-if="['draft', 'sent', 'completed'].includes(detailTransfer.status)" class="sm-btn sm danger" @click="askVoid(detailTransfer)">
              <i class="fas fa-ban"></i> {{ $t('storeManager.common.void') }}
            </button>
          </div>
          <p v-if="detailTransfer.void_reason" class="void-note"><i class="fas fa-circle-info"></i> {{ detailTransfer.void_reason }}</p>
          <div class="transfer-meta">
            <p><strong>{{ $t('storeManager.transfers.from') }}:</strong> {{ fromName(detailTransfer) }}</p>
            <p><strong>{{ $t('storeManager.transfers.to') }}:</strong> {{ toName(detailTransfer) }}</p>
            <p><strong>{{ $t('common.date') }}:</strong> {{ fmtDate(detailTransfer.business_date || detailTransfer.created_at) }}</p>
            <p><strong>{{ $t('storeManager.transfers.movedBy') }}:</strong> {{ managerName(detailTransfer) }}</p>
            <p><strong>{{ $t('storeManager.transfers.recordedAt') }}:</strong> {{ fmtDateTime(detailTransfer.created_at) }}</p>
            <p><strong>{{ $t('common.status') }}:</strong> <span class="chip" :class="{ danger: detailTransfer.status === 'voided' }">{{ statusLabel(detailTransfer.status) }}</span></p>
          </div>
          <p v-if="detailTransfer.notes"><strong>{{ $t('common.notes') }}:</strong> {{ detailTransfer.notes }}</p>
          <p v-if="formError" class="sm-error">{{ formError }}</p>
          <div class="table-scroll">
            <table class="sm-table">
              <thead><tr>
                <th>{{ $t('inventory.itemName') }}</th>
                <th>{{ $t('storeManager.sales.qty') }}</th>
                <th>{{ $t('common.unit') }}</th>
                <th>{{ $t('inventory.unitCost', { currency: curCode() }) }}</th>
                <th>{{ $t('storeManager.transfers.costValue') }}</th>
              </tr></thead>
              <tbody>
                <tr v-for="line in detailTransfer.items || []" :key="line.transfer_item_id">
                  <td>{{ line.item?.item_name || line.item_name || '—' }}</td>
                  <td>{{ line.quantity }}</td>
                  <td>{{ line.item?.unit || '—' }}</td>
                  <td>{{ money(line.item?.unit_cost) }}</td>
                  <td><strong>{{ money(Number(line.quantity || 0) * Number(line.item?.unit_cost || 0)) }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="transfer-total"><strong>{{ $t('storeManager.transfers.totalCost') }}: {{ money(detailTransfer.total_cost) }}</strong></p>
          <div class="sm-modal-foot">
            <button class="sm-btn" @click="detailTransfer = null">{{ $t('common.close') }}</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="confirmSend" class="sm-modal-backdrop" @click.self="closeConfirm">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ confirmSend.mode === 'draft' ? $t('storeManager.transfers.confirmDraftTitle') : $t('storeManager.transfers.confirmTitle') }}</h3>
          <button class="x" @click="closeConfirm">×</button>
        </div>
        <div class="sm-modal-body">
          <p class="confirm-intro">
            {{ confirmSend.mode === 'draft'
              ? $t('storeManager.transfers.confirmDraftIntro', { number: confirmSend.number })
              : $t('storeManager.transfers.confirmIntro') }}
          </p>
          <div class="transfer-meta">
            <p><strong>{{ $t('storeManager.transfers.from') }}:</strong> {{ confirmSend.from }}</p>
            <p><strong>{{ $t('storeManager.transfers.to') }}:</strong> {{ confirmSend.to }}</p>
            <p><strong>{{ $t('storeManager.transfers.movedBy') }}:</strong> {{ confirmSend.manager }}</p>
            <p><strong>{{ $t('storeManager.transfers.recordedAt') }}:</strong> {{ fmtDateTime(confirmSend.at) }}</p>
          </div>
          <div class="table-scroll">
            <table class="sm-table">
              <thead><tr>
                <th>{{ $t('inventory.itemName') }}</th>
                <th>{{ $t('storeManager.sales.qty') }}</th>
                <th>{{ $t('common.unit') }}</th>
              </tr></thead>
              <tbody>
                <tr v-for="(line, idx) in confirmSend.lines" :key="idx">
                  <td>{{ line.name }}</td>
                  <td>{{ line.quantity }}</td>
                  <td>{{ line.unit || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="transfer-total"><strong>{{ $t('storeManager.transfers.totalCost') }}: {{ money(confirmSend.total) }}</strong></p>
          <p v-if="formError" class="sm-error">{{ formError }}</p>
          <div class="sm-modal-foot">
            <button class="sm-btn ghost" :disabled="saving" @click="closeConfirm">{{ $t('storeManager.transfers.confirmBack') }}</button>
            <button class="sm-btn" :disabled="saving" @click="confirmMovement">
              <i class="fas fa-check"></i>
              {{ saving ? $t('storeManager.transfers.confirmSending') : $t('storeManager.transfers.confirmSend') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="successInfo" class="sm-modal-backdrop" @click.self="successInfo = null">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3><i class="fas fa-circle-check"></i> {{ $t('storeManager.transfers.successTitle') }}</h3>
          <button class="x" @click="successInfo = null">×</button>
        </div>
        <div class="sm-modal-body">
          <p>{{ $t('storeManager.transfers.successMessage') }}</p>
          <div class="transfer-meta">
            <p><strong>{{ $t('storeManager.transfers.from') }}:</strong> {{ successInfo.from }}</p>
            <p><strong>{{ $t('storeManager.transfers.to') }}:</strong> {{ successInfo.to }}</p>
            <p><strong>{{ $t('storeManager.transfers.movedBy') }}:</strong> {{ successInfo.manager }}</p>
            <p><strong>{{ $t('storeManager.transfers.recordedAt') }}:</strong> {{ fmtDateTime(successInfo.at) }}</p>
          </div>
          <p v-if="successInfo.number" class="transfer-total">
            <strong>{{ $t('storeManager.transfers.successRef') }}: {{ successInfo.number }}</strong>
          </p>
          <p class="transfer-total">
            <strong>{{ $t('storeManager.transfers.totalCost') }}: {{ money(successInfo.total) }}</strong>
          </p>
          <div class="sm-modal-foot">
            <button class="sm-btn ghost" @click="successInfo = null">{{ $t('storeManager.transfers.done') }}</button>
            <button v-if="successInfo.transferId" class="sm-btn" @click="viewSuccessTransfer">
              {{ $t('storeManager.transfers.viewTransfer') }}
            </button>
          </div>
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
import { fetchAllInventoryItems, stockOnShelf } from '@/utils/inventoryItems.js'
import { useTenantCurrency } from '@/utils/currency'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const { curCode } = useTenantCurrency()
const workingDateStore = useWorkingDateStore()
const authStore = useAuthStore()
const { outlets, selectedOutlet, selectedStore, mainStore, loadOutlets } = useOutletContext()
const transferableOutlets = computed(() => outlets.value.filter((outlet) => outlet.stock_department))
/** Stock transfers follow the selected store, falling back to the outlet. */
const stockOutletId = computed(() => selectedStore.value?.outlet_id || selectedOutlet.value?.outlet_id || undefined)
const canTransfer = computed(() => transferableOutlets.value.length > 1)
const businessDate = ref('')
const loadedDate = ref('')
const transfers = ref([])
const q = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = 15
const items = ref([])
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const formError = ref('')
const voidTarget = ref(null)
const voidReason = ref('')
const detailTransfer = ref(null)
const confirmSend = ref(null)
const successInfo = ref(null)
const form = reactive({
  from_outlet_id: null,
  to_outlet_id: null,
  notes: '',
  items: [],
})

/** Items are read from the transfer's source shelf, not hotel-wide stock. */
const formShelfId = computed(() => {
  const from = transferableOutlets.value.find((outlet) => outlet.outlet_id === form.from_outlet_id)
  return from?.stock_department?.department_id
    || selectedStore.value?.stock_department?.department_id
    || selectedOutlet.value?.stock_department?.department_id
    || undefined
})

const itemOptions = computed(() => items.value.map((i) => ({
  value: i.item_id,
  label: `${i.item_name}${i.unit ? ` (${i.unit})` : ''}`,
  category: i.category,
  unit: i.unit,
  stock: stockOnShelf(i, formShelfId.value),
  unit_cost: i.unit_cost,
})))

const outletOptions = computed(() => transferableOutlets.value.map((o) => {
  const main = mainStore.value?.outlet_id === o.outlet_id ? ` · ${t('outlet.mainStore')}` : ''
  return {
    value: o.outlet_id,
    label: `${o.name} · ${o.stock_department?.name || ''}${main}`.replace(/ · $/, ''),
  }
}))

const filteredTransfers = computed(() => {
  let rows = transfers.value
  if (statusFilter.value === 'draft') rows = rows.filter((tr) => tr.status === 'draft')
  if (statusFilter.value === 'sent') rows = rows.filter((tr) => ['sent', 'completed'].includes(tr.status))
  const needle = q.value.trim().toLowerCase()
  if (needle) {
    rows = rows.filter((tr) => [
      tr.transfer_number,
      tr.status,
      fromName(tr),
      toName(tr),
      managerName(tr),
      lineSummary(tr),
    ].some((value) => String(value ?? '').toLowerCase().includes(needle)))
  }
  return rows
})
const lastPage = computed(() => Math.max(1, Math.ceil(filteredTransfers.value.length / pageSize)))
const pagedTransfers = computed(() => {
  const current = Math.min(page.value, lastPage.value)
  return filteredTransfers.value.slice((current - 1) * pageSize, current * pageSize)
})
watch([q, statusFilter], () => { page.value = 1 })

function emptyLine() {
  return {
    item_id: '',
    item_name: '',
    quantity: 1,
    unit: '',
    si_units: [],
    si_factors: {},
    base_unit: '',
    base_cost: 0,
  }
}

function fmtDate(v) { return v ? new Date(v).toLocaleDateString() : '-' }
function fmtDateTime(v) {
  return v
    ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '—'
}
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
function managerName(tr) {
  return tr?.creator?.full_name || tr?.creator?.name || tr?.created_by_name || '—'
}
function lineSummary(tr) {
  const lines = tr.items || []
  if (!lines.length) return '—'
  return lines.map((l) => l.item?.item_name || l.item_name).filter(Boolean).join(', ') || '—'
}

function normalizeSiUnits(found) {
  const names = []
  const factors = {}
  for (const raw of found?.si_units || []) {
    const name = typeof raw === 'string' ? raw : raw?.unit
    if (!name) continue
    names.push(name)
    factors[name] = Number(typeof raw === 'string' ? 1 : raw?.factor ?? 1) || 1
  }
  return { names, factors }
}

function unitOptionsFor(line) {
  const names = []
  if (line.base_unit) names.push(line.base_unit)
  for (const name of line.si_units || []) {
    if (name && !names.includes(name)) names.push(name)
  }
  return names.length ? names : ['PCS']
}

function unitFactorFor(line) {
  if (!line.unit || line.unit === line.base_unit) return 1
  return Number(line.si_factors?.[line.unit] ?? 1) || 1
}

function baseQuantity(line) {
  return Math.round(Number(line.quantity || 0) * unitFactorFor(line) * 100) / 100
}

function unitCostFor(line) {
  return Math.round(Number(line.base_cost || 0) * unitFactorFor(line) * 100) / 100
}

function lineCost(line) {
  return Math.round(baseQuantity(line) * Number(line.base_cost || 0) * 100) / 100
}

const transferTotal = computed(() =>
  form.items.reduce((sum, line) => sum + lineCost(line), 0),
)

function onPickItem(line, hit) {
  const id = hit?.value ?? hit
  const found = items.value.find((i) => String(i.item_id) === String(id))
  if (found && form.items.some((other) => other !== line && String(other.item_id) === String(found.item_id))) {
    formError.value = t('storeManager.transfers.itemRequired')
    line.item_id = ''
    line.item_name = ''
    return
  }
  formError.value = ''
  line.item_id = id ?? ''
  line.item_name = found?.item_name || ''
  line.base_unit = found?.unit || ''
  line.base_cost = Number(found?.unit_cost || 0)
  const { names, factors } = normalizeSiUnits(found)
  line.si_units = names
  line.si_factors = factors
  line.unit = found?.unit || ''
}

async function loadTransfers() {
  loading.value = true
  try {
    const res = await inventoryOpsApi.transfers({
      per_page: 50,
      date: businessDate.value,
      outlet_id: stockOutletId.value,
    })
    transfers.value = res.data.transfers || []
    loadedDate.value = businessDate.value
  } catch {
    transfers.value = []
  } finally { loading.value = false }
}
async function loadItems() {
  try {
    items.value = await fetchAllInventoryItems({ department_id: formShelfId.value })
  } catch { items.value = [] }
}
async function load() {
  await Promise.all([loadTransfers(), loadItems()])
}

function openCreate() {
  const first = stockOutletId.value && transferableOutlets.value.some((o) => o.outlet_id === stockOutletId.value)
    ? stockOutletId.value
    : transferableOutlets.value[0]?.outlet_id || null
  // Default the destination to the main store so moving stock back to the
  // store that holds the hotel's data is one click, not a hunt through a list.
  const second = mainStore.value?.outlet_id && mainStore.value.outlet_id !== first
    ? mainStore.value.outlet_id
    : transferableOutlets.value.find((o) => o.outlet_id !== first)?.outlet_id || null
  Object.assign(form, {
    from_outlet_id: first,
    to_outlet_id: second,
    notes: '',
    items: [emptyLine()],
  })
  formError.value = ''
  showForm.value = true
  loadItems()
}

function openDetail(tr) {
  formError.value = ''
  detailTransfer.value = tr
}

async function save(send = true) {
  formError.value = ''
  if (!form.from_outlet_id || !form.to_outlet_id || form.from_outlet_id === form.to_outlet_id) {
    formError.value = t('storeManager.transfers.sameOutlet')
    return
  }
  const lines = form.items.filter((line) => line.item_id)
  if (!lines.length) {
    formError.value = t('storeManager.transfers.itemRequired')
    return
  }
  if (lines.some((line) => !(baseQuantity(line) > 0))) {
    formError.value = t('storeManager.transfers.quantityRequired')
    return
  }
  const payload = {
    from_outlet_id: form.from_outlet_id,
    to_outlet_id: form.to_outlet_id,
    business_date: businessDate.value,
    notes: form.notes,
    send,
    items: lines.map((line) => ({ item_id: line.item_id, quantity: baseQuantity(line) })),
  }

  if (!send) {
    saving.value = true
    try {
      await inventoryOpsApi.storeTransfer(payload)
      showForm.value = false
      await load()
    } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
    return
  }

  // Sending changes stock on both shelves, so show a receipt-style check first.
  confirmSend.value = {
    mode: 'create',
    payload,
    number: null,
    from: outletName(form.from_outlet_id),
    to: outletName(form.to_outlet_id),
    lines: lines.map((line) => ({
      name: line.item_name || '—',
      quantity: baseQuantity(line),
      unit: line.unit,
    })),
    total: transferTotal.value,
    manager: authStore.user?.full_name || authStore.user?.name || '—',
    at: new Date().toISOString(),
  }
}

function sendTransfer(tr) {
  formError.value = ''
  const lines = tr.items || []
  confirmSend.value = {
    mode: 'draft',
    transfer: tr,
    number: tr.transfer_number,
    from: fromName(tr),
    to: toName(tr),
    lines: lines.map((line) => ({
      name: line.item?.item_name || line.item_name || '—',
      quantity: Number(line.quantity || 0),
      unit: line.item?.unit || '',
    })),
    total: Number(tr.total_cost || lines.reduce(
      (sum, line) => sum + Number(line.quantity || 0) * Number(line.item?.unit_cost || 0),
      0,
    )),
    manager: authStore.user?.full_name || authStore.user?.name || '—',
    at: new Date().toISOString(),
  }
}

function closeConfirm() {
  confirmSend.value = null
  formError.value = ''
}

async function confirmMovement() {
  const summary = confirmSend.value
  if (!summary) return
  saving.value = true
  formError.value = ''
  try {
    let transfer
    if (summary.mode === 'draft') {
      const res = await inventoryOpsApi.sendTransfer(summary.transfer.transfer_id)
      transfer = res.data?.transfer || summary.transfer
    } else {
      const res = await inventoryOpsApi.storeTransfer(summary.payload)
      transfer = res.data?.transfer || {}
    }
    confirmSend.value = null
    showForm.value = false
    detailTransfer.value = null
    successInfo.value = {
      transferId: transfer?.transfer_id || summary.transfer?.transfer_id || null,
      number: transfer?.transfer_number || summary.number || '',
      from: summary.from,
      to: summary.to,
      manager: summary.manager,
      at: summary.at,
      total: transfer?.total_cost ?? summary.total,
    }
    await load()
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally { saving.value = false }
}

function viewSuccessTransfer() {
  const transfer = transfers.value.find((row) => row.transfer_id === successInfo.value?.transferId)
  successInfo.value = null
  if (transfer) openDetail(transfer)
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
    <p>${esc(fromName(tr))} → ${esc(toName(tr))} · ${esc(statusLabel(tr.status))}<br>
    <span class="muted">${fmtDate(tr.business_date || tr.created_at)} · ${esc(t('storeManager.transfers.movedBy'))}: ${esc(managerName(tr))} · ${esc(t('storeManager.transfers.recordedAt'))}: ${esc(fmtDateTime(tr.created_at))}</span></p>
    ${voided}
    <table><thead><tr><th>Item</th><th>Quantity</th><th>Unit cost</th><th>Cost</th></tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><td colspan="3">Total</td><td>${money(total)}</td></tr></tfoot></table>
    <div class="sign"><div>${esc(t('storeManager.transfers.creator'))}</div><div>${esc(t('storeManager.transfers.supervisor'))}</div><div>${esc(t('storeManager.transfers.authorizedBy'))}</div></div>
    <script>window.print()${closeScript}</body></html>`)
  w.document.close()
}
async function shareTransfer(tr) {
  const text = `${tr.transfer_number}: ${lineSummary(tr)} (${fromName(tr)} → ${toName(tr)}) · ${money(tr.total_cost)} · ${managerName(tr)} · ${fmtDateTime(tr.created_at)}`
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
    detailTransfer.value = null
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
watch(businessDate, async (date) => {
  if (!date || date === loadedDate.value) return
  await loadTransfers()
})
watch(() => form.from_outlet_id, (id, previous) => {
  if (!showForm.value || !id || !previous || id === previous) return
  form.items = [emptyLine()]
  loadItems()
})
watch(stockOutletId, async () => {
  showForm.value = false
  detailTransfer.value = null
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
.transfer-preview { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 10px 0 12px; padding: 9px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; color: #1e40af; font-size: 13px; }
.transfer-preview strong { font-size: 14px; }
.items-block { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.items-head { display: flex; align-items: center; justify-content: space-between; }
.item-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 8px; }
.detail-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.void-note { background: #fff4ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 8px; padding: 6px 10px; font-size: 13px; }
.transfer-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 16px; margin-bottom: 10px; }
.transfer-meta p { margin: 0; font-size: 13px; }
.confirm-intro { margin: 0 0 12px; color: #475569; font-size: 13px; line-height: 1.5; }
.transfer-total { text-align: right; margin: 10px 0 0; }
.ref-link { border: 0; background: none; padding: 0; color: var(--mrk-blue); font-weight: 700; cursor: pointer; font-family: inherit; font-size: 13px; }
.ref-link:hover { text-decoration: underline; }
@media (max-width: 700px) {
  .item-grid, .transfer-grid { grid-template-columns: 1fr 1fr; }
  .transfer-meta { grid-template-columns: 1fr; }
}
</style>
