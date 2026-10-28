<!--
  StoreStockAdjustPage — stock adjustment sheets. Each sheet groups wastage,
  consumption or a manual stock reset under one sequential reference
  (AD-WS / AD-CM / AD) and can be viewed, printed, e-mailed or voided with a
  reason. The list replaces the old per-item workbench requested in the review.
-->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <CalendarInput v-model="businessDate" :clearable="false" @change="load" />
      <select v-model="typeFilter" class="sm-select" @change="load">
        <option value="">{{ $t('storeManager.adjustments.allTypes') }}</option>
        <option value="wastage">{{ $t('storeManager.adjustType.wastage') }}</option>
        <option value="consumption">{{ $t('storeManager.adjustType.consumption') }}</option>
        <option value="adjustment">{{ $t('storeManager.adjustType.adjustment') }}</option>
      </select>
      <div class="sm-search">
        <i class="fas fa-magnifying-glass"></i>
        <input v-model="search" type="text" :placeholder="$t('common.search')" @input="debouncedLoad" />
      </div>
      <div class="segmented">
        <button :class="{ active: voidFilter === 'all' }" @click="setVoidFilter('all')">
          {{ $t('storeManager.adjustments.filterAll') }}
        </button>
        <button :class="{ active: voidFilter === 'voided' }" @click="setVoidFilter('voided')">
          {{ $t('storeManager.adjustments.filterVoided') }}
        </button>
      </div>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.adjustments.add') }}</button>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
          <table class="sm-table" v-if="adjustments.length">
            <thead>
              <tr>
                <th>{{ $t('storeManager.adjustments.sn') }}</th>
                <th>{{ $t('common.date') }}</th>
                <th>{{ $t('storeManager.adjustments.type') }}</th>
                <th>{{ $t('common.items') }}</th>
                <th>{{ $t('storeManager.adjustments.costValue') }}</th>
                <th>{{ $t('common.status') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in adjustments" :key="row.adjustment_id">
                <td>
                  <button class="ref-link" @click="openDetail(row)">{{ row.adjustment_number }}</button>
                </td>
                <td>{{ fmtDate(row.business_date) }}</td>
                <td><span class="chip" :class="typeClass(row.type)">{{ typeLabel(row.type) }}</span></td>
                <td>{{ (row.items || []).length }}</td>
                <td><strong>{{ money(row.total_cost) }}</strong></td>
                <td>
                  <span class="chip" :class="{ voided: row.status === 'voided' }">{{ statusLabel(row.status) }}</span>
                  <small v-if="row.status === 'voided' && row.void_reason" class="void-reason">{{ row.void_reason }}</small>
                </td>
                <td class="actions-cell">
                  <button class="sm-btn sm ghost" :title="$t('common.view')" @click="openDetail(row)">
                    <i class="fas fa-eye"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty">{{ $t('storeManager.adjustments.empty') }}</p>
        </div>
        <div class="list-foot">
          <span>{{ $t('storeManager.adjustments.count', { count: adjustments.length }) }}</span>
        </div>
      </template>
    </section>

    <!-- Sheet viewer/creator -->
    <div v-if="sheetOpen" class="sm-modal-backdrop" @click.self="closeSheet">
      <div class="sm-modal wide adjust-modal">
        <div class="sm-modal-head">
          <h3>
            <i class="fas fa-sliders"></i>
            <template v-if="isNew">{{ $t('storeManager.adjustments.new') }}</template>
            <template v-else>{{ activeSheet.adjustment_number }}</template>
            <span v-if="!isNew" class="chip" :class="{ voided: activeSheet.status === 'voided' }">{{ statusLabel(activeSheet.status) }}</span>
          </h3>
          <button class="sm-modal-close" @click="closeSheet"><i class="fas fa-xmark"></i></button>
        </div>

        <div class="sheet-meta">
          <label class="fld">
            <span>{{ $t('storeManager.adjustments.type') }}</span>
            <select v-if="isNew" v-model="form.type" class="sm-select">
              <option value="wastage">{{ $t('storeManager.adjustType.wastage') }}</option>
              <option value="consumption">{{ $t('storeManager.adjustType.consumption') }}</option>
              <option value="adjustment">{{ $t('storeManager.adjustType.adjustment') }}</option>
            </select>
            <strong v-else>{{ typeLabel(activeSheet.type) }}</strong>
          </label>
          <div class="fld">
            <span>{{ $t('common.date') }}</span>
            <strong>{{ fmtDate(isNew ? businessDate : activeSheet.business_date) }}</strong>
          </div>
          <div class="fld">
            <span>{{ $t('storeManager.adjustments.createdBy') }}</span>
            <strong>{{ isNew ? currentUserName : (activeSheet.creator_name || '—') }}</strong>
          </div>
          <div class="fld">
            <span>{{ $t('storeManager.adjustments.costValue') }}</span>
            <strong>{{ money(isNew ? newTotal : activeSheet.total_cost) }}</strong>
          </div>
        </div>

        <p class="type-hint"><i class="fas fa-circle-info"></i> {{ typeHint }}</p>

        <div v-if="!isNew && activeSheet.status === 'voided'" class="void-banner">
          <strong>{{ $t('storeManager.adjustments.voidedBanner') }}</strong>
          <span>{{ activeSheet.void_reason }}</span>
        </div>

        <div class="sheet-tabs">
          <button :class="{ active: sheetTab === 'items' }" @click="sheetTab = 'items'">
            {{ $t('storeManager.adjustments.itemsTab') }}
          </button>
          <button :class="{ active: sheetTab === 'description' }" @click="sheetTab = 'description'">
            {{ $t('storeManager.adjustments.descriptionTab') }}
          </button>
        </div>

        <template v-if="sheetTab === 'items'">
          <div v-if="isNew" class="line-picker">
            <label class="fld grow">
              <span>{{ $t('inventory.itemName') }}</span>
              <SearchableSelect
                v-model="draft.item_id"
                :options="itemOptions"
                :placeholder="$t('inventory.selectItem')"
                force-search
              />
            </label>
            <label class="fld qty-fld">
              <span>{{ isReset ? $t('storeManager.adjustments.newLevel') : $t('storeManager.adjustments.quantityRemoved') }}</span>
              <input v-model.number="draft.quantity" type="number" min="0" step="0.01" class="sm-input" />
            </label>
            <div class="fld selected-stock" v-if="selectedItem">
              <span>{{ $t('storeManager.adjustments.currentLevel') }}</span>
              <strong>{{ selectedItem.quantity_in_stock }} {{ selectedItem.unit }}</strong>
            </div>
            <button type="button" class="sm-btn add-line" :disabled="!canAddLine" @click="addLine">
              <i class="fas fa-plus"></i> {{ $t('storeManager.adjustments.addLine') }}
            </button>
          </div>

          <div class="table-scroll">
            <table class="sm-table sheet-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{{ $t('inventory.itemName') }}</th>
                  <th>{{ $t('inventory.unit') }}</th>
                  <th>{{ isNew ? (isReset ? $t('storeManager.adjustments.newLevel') : $t('common.quantity')) : $t('storeManager.adjustments.before') }}</th>
                  <th v-if="!isNew">{{ $t('storeManager.adjustments.after') }}</th>
                  <th>{{ $t('inventory.unitCost') }}</th>
                  <th>{{ $t('storeManager.adjustments.costValue') }}</th>
                  <th v-if="isNew"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(line, idx) in shownLines" :key="line.item_id || line.adjustment_item_id">
                  <td>{{ idx + 1 }}</td>
                  <td>
                    <strong>{{ line.item_name || itemName(line.item_id) }}</strong>
                    <small v-if="line.note" class="line-note">{{ line.note }}</small>
                  </td>
                  <td>{{ line.unit || itemUnit(line.item_id) }}</td>
                  <td>{{ isNew ? (isReset ? line.quantity : itemStock(line.item_id)) : line.quantity_before }}</td>
                  <td v-if="!isNew">{{ line.quantity_after }}</td>
                  <td>{{ money(line.unit_cost ?? itemCost(line.item_id), 0) }}</td>
                  <td><strong>{{ money(line.total_cost ?? lineCost(line)) }}</strong></td>
                  <td v-if="isNew">
                    <button class="icon-btn" :title="$t('common.delete')" @click="removeLine(idx)">
                      <i class="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="!shownLines.length" class="empty">{{ $t('storeManager.adjustments.noLines') }}</p>
          </div>
        </template>

        <template v-else>
          <p class="tab-copy">{{ $t('storeManager.adjustments.descriptionHint') }}</p>
          <div v-if="!isNew" class="description-lines">
            <div v-for="line in shownLines" :key="line.adjustment_item_id" class="description-line">
              <strong>{{ line.item_name }}</strong>
              <span>{{ line.note || $t('storeManager.adjustments.noItemReason') }}</span>
            </div>
          </div>
          <label v-if="isNew" class="fld">
            <span>{{ $t('storeManager.adjustments.sheetDescription') }}</span>
            <textarea v-model="form.description" class="sm-textarea" rows="3" :placeholder="$t('storeManager.adjustments.descriptionPlaceholder')"></textarea>
          </label>
          <div v-if="isNew && form.lines.length" class="description-lines">
            <div v-for="line in form.lines" :key="line.item_id" class="description-line reason-row">
              <strong>{{ itemName(line.item_id) }}</strong>
              <input v-model="line.note" class="sm-input" :placeholder="$t('storeManager.adjustments.itemReasonPlaceholder')" />
            </div>
          </div>
          <div v-if="!isNew" class="description-box">
            <span>{{ $t('storeManager.adjustments.sheetDescription') }}</span>
            <p>{{ activeSheet.description || '—' }}</p>
          </div>
        </template>

        <p v-if="formError" class="sm-error">{{ formError }}</p>

        <div class="sm-modal-foot">
          <template v-if="isNew">
            <button class="sm-btn ghost" @click="closeSheet">{{ $t('common.cancel') }}</button>
            <button class="sm-btn" :disabled="saving || !form.lines.length" @click="saveSheet">
              <i class="fas fa-floppy-disk"></i> {{ saving ? $t('common.saving') : $t('common.save') }}
            </button>
          </template>
          <template v-else>
            <button class="sm-btn ghost" @click="printSheet(activeSheet)"><i class="fas fa-print"></i> {{ $t('common.print') }}</button>
            <button class="sm-btn ghost" @click="openEmail(activeSheet)"><i class="fas fa-share-nodes"></i> {{ $t('common.share') }}</button>
            <button
              v-if="activeSheet.status === 'saved'"
              class="sm-btn danger"
              @click="askVoid(activeSheet)"
            >
              <i class="fas fa-ban"></i> {{ $t('storeManager.common.void') }}
            </button>
            <button class="sm-btn" @click="closeSheet">{{ $t('common.close') }}</button>
          </template>
        </div>
      </div>
    </div>

    <!-- Void reason -->
    <div v-if="voidTarget" class="sm-modal-backdrop" @click.self="voidTarget = null">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ $t('storeManager.adjustments.voidTitle', { reference: voidTarget.adjustment_number }) }}</h3>
          <button class="sm-modal-close" @click="voidTarget = null"><i class="fas fa-xmark"></i></button>
        </div>
        <p class="tab-copy">{{ $t('storeManager.adjustments.voidHint') }}</p>
        <label class="fld">
          <span>{{ $t('storeManager.common.reason') }}</span>
          <textarea v-model="voidReason" class="sm-textarea" rows="3"></textarea>
        </label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="voidTarget = null">{{ $t('common.cancel') }}</button>
          <button class="sm-btn danger" :disabled="saving" @click="confirmVoid">
            {{ saving ? $t('common.saving') : $t('storeManager.common.void') }}
          </button>
        </div>
      </div>
    </div>

    <!-- E-mail sheet -->
    <div v-if="emailTarget" class="sm-modal-backdrop" @click.self="emailTarget = null">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ $t('storeManager.adjustments.emailTitle', { reference: emailTarget.adjustment_number }) }}</h3>
          <button class="sm-modal-close" @click="emailTarget = null"><i class="fas fa-xmark"></i></button>
        </div>
        <label class="fld">
          <span>{{ $t('storeManager.adjustments.emailAddress') }}</span>
          <input v-model="emailAddress" type="email" class="sm-input" placeholder="name@example.com" />
        </label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="emailTarget = null">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="sendEmail">
            <i class="fas fa-paper-plane"></i> {{ saving ? $t('common.saving') : $t('common.share') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryOpsApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import CalendarInput from '@/components/CalendarInput.vue'
import { useWorkingDateStore } from '@/stores/workingDate'
import { useAuthStore } from '@/stores/auth'
import { selectedOutlet } from '@/composables/useOutletContext'
import { fetchAllInventoryItems } from '@/utils/inventoryItems'
import { formatMoney } from '@/utils/currency'
import '@/pages/store/store-shared.css'

const { t } = useI18n()
const workingDateStore = useWorkingDateStore()
const auth = useAuthStore()

const adjustments = ref([])
const allItems = ref([])
const loading = ref(false)
const saving = ref(false)
const businessDate = ref('')
const typeFilter = ref('')
const voidFilter = ref('all')
const search = ref('')
const success = ref('')
const error = ref('')

const sheetOpen = ref(false)
const sheetTab = ref('items')
const activeSheet = ref(null)
const form = reactive({ type: 'wastage', description: '', lines: [] })
const draft = reactive({ item_id: null, quantity: 1 })
const formError = ref('')

const voidTarget = ref(null)
const voidReason = ref('')
const emailTarget = ref(null)
const emailAddress = ref('')

const isNew = computed(() => !activeSheet.value)
const isReset = computed(() => (isNew.value ? form.type : activeSheet.value?.type) === 'adjustment')
const currentUserName = computed(() => auth.user?.full_name || auth.user?.name || auth.user?.email || '—')
const itemOptions = computed(() =>
  allItems.value.map((item) => ({
    value: item.item_id,
    label: `${item.item_name} (${item.quantity_in_stock ?? 0} ${item.unit || ''})`,
  })),
)
const selectedItem = computed(() => allItems.value.find((item) => item.item_id === draft.item_id) || null)
const shownLines = computed(() => (isNew.value ? form.lines : (activeSheet.value?.items || [])))
const newTotal = computed(() =>
  form.lines.reduce((sum, line) => sum + Math.abs(Number(line.total_cost || lineCost(line))), 0),
)
const canAddLine = computed(() => {
  if (!draft.item_id || form.lines.some((line) => line.item_id === draft.item_id)) return false
  return isReset.value ? Number(draft.quantity) >= 0 : Number(draft.quantity) > 0
})
const typeHint = computed(() => {
  if (isReset.value) return t('storeManager.adjustments.hintAdjustment')
  return form.type === 'consumption' || activeSheet.value?.type === 'consumption'
    ? t('storeManager.adjustments.hintConsumption')
    : t('storeManager.adjustments.hintWastage')
})

function money(value, decimals = 2) {
  return formatMoney(value, decimals)
}
function fmtDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
function typeLabel(value) {
  return t(`storeManager.adjustType.${value}`)
}
function statusLabel(value) {
  return value === 'voided' ? t('common.voided') : t('storeManager.adjustments.saved')
}
function typeClass(value) {
  return { wastage: 'red', consumption: 'blue', adjustment: 'green' }[value] || ''
}
function itemName(id) {
  return allItems.value.find((item) => item.item_id === id)?.item_name || '—'
}
function itemUnit(id) {
  return allItems.value.find((item) => item.item_id === id)?.unit || '—'
}
function itemStock(id) {
  return allItems.value.find((item) => item.item_id === id)?.quantity_in_stock ?? '—'
}
function itemCost(id) {
  return allItems.value.find((item) => item.item_id === id)?.unit_cost ?? 0
}
function lineCost(line) {
  const item = allItems.value.find((row) => row.item_id === line.item_id)
  if (!item) return 0
  const before = Number(item.quantity_in_stock || 0)
  const quantity = Number(line.quantity || 0)
  const delta = isReset.value ? Math.abs(quantity - before) : quantity
  return delta * Number(item.unit_cost || 0)
}

let debounce
function debouncedLoad() {
  clearTimeout(debounce)
  debounce = setTimeout(load, 300)
}
function setVoidFilter(value) {
  voidFilter.value = value
  load()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { per_page: 250 }
    if (businessDate.value) params.date = businessDate.value
    if (typeFilter.value) params.type = typeFilter.value
    if (voidFilter.value === 'voided') params.voided = 1
    if (search.value.trim()) params.q = search.value.trim()
    const res = await inventoryOpsApi.stockAdjustments(params)
    adjustments.value = res.data.adjustments || []
  } catch (e) {
    adjustments.value = []
    error.value = e.response?.data?.message || t('common.error')
  } finally {
    loading.value = false
  }
}

async function loadItems() {
  try {
    allItems.value = await fetchAllInventoryItems()
  } catch {
    allItems.value = []
  }
}

function openCreate() {
  activeSheet.value = null
  Object.assign(form, { type: 'wastage', description: '', lines: [] })
  Object.assign(draft, { item_id: null, quantity: 1 })
  sheetTab.value = 'items'
  formError.value = ''
  sheetOpen.value = true
  if (!allItems.value.length) loadItems()
}

function openDetail(row) {
  activeSheet.value = row
  sheetTab.value = 'items'
  formError.value = ''
  sheetOpen.value = true
}

function closeSheet() {
  sheetOpen.value = false
  activeSheet.value = null
  formError.value = ''
}

function addLine() {
  if (!canAddLine.value) return
  const item = selectedItem.value
  const quantity = Number(draft.quantity)
  const before = Number(item.quantity_in_stock || 0)
  const totalCost = (isReset.value ? Math.abs(quantity - before) : quantity) * Number(item.unit_cost || 0)
  form.lines.push({
    item_id: item.item_id,
    item_name: item.item_name,
    unit: item.unit,
    quantity,
    quantity_before: before,
    unit_cost: Number(item.unit_cost || 0),
    total_cost: totalCost,
    note: '',
  })
  Object.assign(draft, { item_id: null, quantity: 1 })
}
function removeLine(index) {
  form.lines.splice(index, 1)
}

async function saveSheet() {
  formError.value = ''
  if (!form.lines.length) {
    formError.value = t('storeManager.adjustments.selectItemsError')
    sheetTab.value = 'items'
    return
  }
  saving.value = true
  try {
    const payload = {
      type: form.type,
      business_date: businessDate.value,
      description: form.description || null,
      outlet_id: selectedOutlet.value?.outlet_id || undefined,
      items: form.lines.map((line) => ({
        item_id: line.item_id,
        quantity: Number(line.quantity),
        note: line.note || null,
      })),
    }
    const res = await inventoryOpsApi.storeStockAdjustment(payload)
    success.value = t('storeManager.adjustments.savedMessage', {
      reference: res.data.adjustment?.adjustment_number || '',
    })
    setTimeout(() => (success.value = ''), 4000)
    closeSheet()
    await Promise.all([load(), loadItems()])
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

function askVoid(row) {
  voidTarget.value = row
  voidReason.value = ''
  formError.value = ''
}
async function confirmVoid() {
  if (!voidReason.value.trim()) {
    formError.value = t('storeManager.common.reasonRequired')
    return
  }
  saving.value = true
  formError.value = ''
  try {
    await inventoryOpsApi.voidStockAdjustment(voidTarget.value.adjustment_id, voidReason.value.trim())
    voidTarget.value = null
    closeSheet()
    success.value = t('storeManager.adjustments.voidedMessage')
    setTimeout(() => (success.value = ''), 4000)
    await Promise.all([load(), loadItems()])
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

function openEmail(row) {
  emailTarget.value = row
  emailAddress.value = ''
  formError.value = ''
}
async function sendEmail() {
  if (!emailAddress.value.trim()) {
    formError.value = t('storeManager.adjustments.emailRequired')
    return
  }
  saving.value = true
  formError.value = ''
  try {
    await inventoryOpsApi.emailStockAdjustment(emailTarget.value.adjustment_id, emailAddress.value.trim())
    emailTarget.value = null
    success.value = t('storeManager.adjustments.emailSent')
    setTimeout(() => (success.value = ''), 4000)
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
function printSheet(row) {
  const lines = (row.items || [])
    .map((line, idx) => `<tr><td>${idx + 1}</td><td>${escapeHtml(line.item_name)}</td><td>${escapeHtml(line.note || '—')}</td><td>${line.quantity_before}</td><td>${line.quantity_after}</td><td>${escapeHtml(line.unit || '')}</td><td>${money(line.unit_cost)}</td><td>${money(line.total_cost)}</td></tr>`)
    .join('')
  const voidBanner = row.status === 'voided'
    ? `<div class="voided">VOIDED — ${escapeHtml(row.void_reason || '')}</div>`
    : ''
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!doctype html><html><head><title>${escapeHtml(row.adjustment_number)}</title><style>
    body{font-family:Arial,sans-serif;padding:32px;color:#111827;font-size:12px}
    h2{margin:0 0 4px;font-size:18px} .muted{color:#64748b}
    .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0;border:1px solid #d1d5db;padding:10px}
    .meta span{display:block;font-size:10px;text-transform:uppercase;color:#64748b}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #d1d5db;padding:7px;text-align:left}
    th{background:#e8f1fa} .num{text-align:right}
    .sign{display:flex;gap:48px;margin-top:64px}
    .sign div{flex:1;border-top:1px solid #111;padding-top:6px}
    .voided{border:2px solid #b91c1c;color:#b91c1c;font-weight:700;padding:8px;margin-top:12px;text-transform:uppercase}
  </style></head><body>
    ${voidBanner}
    <h2>${escapeHtml(row.adjustment_number)}</h2>
    <div class="muted">${escapeHtml(typeLabel(row.type))} · ${escapeHtml(fmtDate(row.business_date))}</div>
    <div class="meta">
      <div><span>Status</span>${escapeHtml(statusLabel(row.status))}</div>
      <div><span>Created by</span>${escapeHtml(row.creator_name || '—')}</div>
      <div><span>Items</span>${(row.items || []).length}</div>
      <div><span>Total cost</span>${escapeHtml(money(row.total_cost))}</div>
    </div>
    <table><thead><tr><th>#</th><th>Item</th><th>Description</th><th>Before</th><th>After</th><th>Unit</th><th>Unit cost</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table>
    <p><strong>Description:</strong> ${escapeHtml(row.description || '—')}</p>
    <div class="sign"><div>Created by</div><div>Supervisor</div><div>Authorized by</div></div>
    <script>window.print()<\/script>
  </body></html>`)
  w.document.close()
}

onMounted(async () => {
  await workingDateStore.ensureLoaded()
  businessDate.value = workingDateStore.workingDate
  await Promise.all([load(), loadItems()])
})
</script>

<style scoped>
.alert { border-radius: 10px; padding: 10px 14px; font-size: 13px; }
.alert-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
.segmented { display: inline-flex; gap: 4px; background: #f1f5f9; border-radius: 8px; padding: 3px; }
.segmented button { border: 0; background: transparent; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; color: #475569; font-family: inherit; }
.segmented button.active { background: #fff; color: #0f172a; box-shadow: 0 1px 3px rgba(15,23,42,.12); font-weight: 700; }
.ref-link { border: 0; background: none; padding: 0; color: var(--mrk-blue); font-weight: 700; cursor: pointer; font-family: inherit; font-size: 13px; }
.ref-link:hover { text-decoration: underline; }
.chip.red { background: #fee2e2; color: #b91c1c; }
.chip.blue { background: var(--mrk-blue-pale); color: var(--mrk-blue); }
.chip.green { background: #dcfce7; color: #15803d; }
.chip.voided { background: #e2e8f0; color: #475569; }
.void-reason { display: block; color: #64748b; font-style: italic; margin-top: 2px; }
.actions-cell { text-align: right; }
.list-foot { display: flex; justify-content: flex-end; padding: 10px 18px 0; color: #64748b; font-size: 12px; }
.adjust-modal { max-width: 1180px; }
.sheet-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
.fld { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #475569; }
.fld > span { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
.fld > strong { color: #0f172a; font-size: 13px; padding: 10px 0; }
.type-hint { margin: 0 0 12px; background: var(--mrk-blue-pale); color: var(--mrk-blue-deep); padding: 9px 12px; border-radius: 8px; font-size: 12px; display: flex; gap: 8px; align-items: flex-start; }
.void-banner { display: flex; gap: 10px; align-items: center; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 8px; padding: 9px 12px; margin-bottom: 12px; font-size: 12px; }
.sheet-tabs { display: inline-flex; gap: 4px; background: #f1f5f9; border-radius: 8px; padding: 3px; margin-bottom: 12px; }
.sheet-tabs button { border: 0; background: transparent; padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; color: #475569; font-family: inherit; }
.sheet-tabs button.active { background: #fff; color: #0f172a; box-shadow: 0 1px 3px rgba(15,23,42,.12); font-weight: 700; }
.line-picker { display: flex; gap: 10px; align-items: flex-end; padding: 12px; border: 1px dashed #cbd5e1; border-radius: 10px; margin-bottom: 12px; background: #f8fafc; }
.line-picker .grow { flex: 1; min-width: 220px; }
.qty-fld { width: 170px; }
.selected-stock { width: 130px; }
.add-line { margin-bottom: 0; }
.sheet-table { min-width: 880px; }
.line-note { display: block; color: #64748b; font-size: 11px; margin-top: 2px; }
.icon-btn { border: 0; background: #fee2e2; color: #b91c1c; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; }
.tab-copy { color: #64748b; font-size: 12px; margin: 0 0 10px; }
.description-lines { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.description-line { display: flex; gap: 12px; align-items: center; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; }
.description-line strong { min-width: 220px; color: #0f172a; }
.description-line span { color: #64748b; }
.reason-row input { flex: 1; }
.description-box { margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
.description-box span { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; }
.description-box p { margin: 6px 0 0; color: #0f172a; font-size: 13px; white-space: pre-wrap; }
.sm-error { color: #b91c1c; font-size: 12px; margin: 0; }
@media (max-width: 760px) {
  .sheet-meta { grid-template-columns: 1fr 1fr; }
  .line-picker { flex-wrap: wrap; }
  .qty-fld, .selected-stock { width: calc(50% - 5px); }
}
</style>
