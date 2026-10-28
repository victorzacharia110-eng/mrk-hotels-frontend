<!-- StoreStockCountsPage — physical stock takes with the real API:
     open a count sheet, enter counted quantities, post to reconcile or void. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <CalendarInput v-model="businessDate" :clearable="false" />
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <SearchableSelect v-model="catFilter" :options="categoryOptions" :empty-label="$t('inventory.allCategories')" force-search />
      <span class="spacer"></span>
      <button class="sm-btn" :disabled="!isCurrentDay" :title="!isCurrentDay ? $t('storeManager.counts.currentDayOnly') : ''" @click="startCount"><i class="fas fa-clipboard-check"></i> {{ $t('storeManager.counts.new') }}</button>
    </div>

    <!-- Active count sheet -->
    <section v-if="activeTake" class="panel">
      <h3 class="panel-title">
        {{ $t('storeManager.counts.sheet') }}
        <span class="chip">{{ activeTake.take_number }}</span>
        <span class="autosave" :class="{ saved: autosavedAt }">
          <i class="fas" :class="autosavedAt ? 'fa-circle-check' : 'fa-clock'"></i>
          {{ autosavedAt ? $t('storeManager.counts.autosaved', { time: autosavedAt }) : $t('storeManager.counts.autosaveHint') }}
        </span>
      </h3>
      <div class="sheet-tabs">
        <button :class="{ active: sheetTab === 'all' }" @click="sheetTab = 'all'">{{ $t('storeManager.counts.allRows') }}</button>
        <button :class="{ active: sheetTab === 'variance' }" @click="sheetTab = 'variance'">{{ $t('storeManager.counts.varianceTab') }}</button>
        <button :class="{ active: sheetTab === 'description' }" @click="sheetTab = 'description'">{{ $t('storeManager.counts.descriptionTab') }}</button>
      </div>
      <div class="sheet-tools">
        <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="itemQ" type="text" :placeholder="$t('inventory.searchItems')" /></div>
        <span class="muted-cell">{{ pagedActiveRows.length }} / {{ activeRows.length }}</span>
      </div>
      <div class="table-scroll">
        <table class="sm-table">
        <thead><tr>
          <th>{{ $t('inventory.itemName') }}</th><th>{{ $t('inventory.category') }}</th><th>{{ $t('common.description') }}</th><th>{{ $t('storeManager.counts.system') }}</th>
          <th>{{ $t('storeManager.counts.counted') }}</th><th>{{ $t('storeManager.counts.variance') }}</th>
          <th v-if="sheetTab === 'description'">{{ $t('storeManager.counts.varianceReason') }}</th>
        </tr></thead>
        <tbody>
          <tr v-for="row in pagedActiveRows" :key="row.take_item_id">
            <td>{{ row.item?.item_name || '—' }}</td>
            <td>{{ row.item?.category || row.category || '—' }}</td>
            <td class="muted-cell">{{ row.item?.description || '—' }}</td>
            <td>{{ row.expected_qty }}</td>
            <td><input v-model.number="row.counted_qty" type="number" min="0" class="sm-input slim" :data-row="row.take_item_id" @input="markDirty" @keydown.enter.prevent="focusNextCount($event)" /></td>
            <td :class="{ neg: Number(row.counted_qty) - Number(row.expected_qty) < 0 }">
              {{ round(Number(row.counted_qty) - Number(row.expected_qty)) }}
            </td>
            <td v-if="sheetTab === 'description'">
              <input v-model="row.variance_reason" type="text" class="sm-input reason-input" :placeholder="$t('storeManager.counts.reasonPlaceholder')" @input="markDirty" />
            </td>
          </tr>
        </tbody>
      </table>
      <PaginationBar :page="sheetPage" :last-page="sheetLastPage" @change="sheetPage = $event" />
      </div>
      <p v-if="formError" class="sm-error">{{ formError }}</p>
      <div class="sm-modal-foot">
        <button class="sm-btn ghost" @click="activeTake = null">{{ $t('common.cancel') }}</button>
        <button class="sm-btn" :disabled="saving || !dirty" :title="!dirty ? $t('storeManager.counts.nothingToSave') : ''" @click="saveCounts">
          {{ saving ? $t('common.saving') : $t('storeManager.counts.saveCounts') }}
        </button>
        <button class="sm-btn primary" :disabled="saving" @click="postTake">
          {{ saving ? $t('common.saving') : $t('storeManager.counts.submit') }}
        </button>
      </div>
    </section>

    <!-- History -->
    <section class="panel" v-else>
      <div class="history-head">
        <h3 class="panel-title">{{ $t('storeManager.counts.history') }}</h3>
        <div class="segmented">
          <button :class="{ active: historyTab === 'saved' }" @click="historyTab = 'saved'">{{ $t('storeManager.counts.saved') }}</button>
          <button :class="{ active: historyTab === 'submitted' }" @click="historyTab = 'submitted'">{{ $t('storeManager.counts.submitted') }}</button>
        </div>
      </div>
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="historyRows.length">
          <thead><tr>
            <th>{{ $t('common.date') }}</th><th>#</th><th>{{ $t('storeManager.sales.items') }}</th>
            <th>{{ $t('common.status') }}</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-for="take in historyRows" :key="take.take_id">
              <td>{{ fmtDate(take.business_date || take.created_at) }}</td>
              <td>{{ take.take_number }}</td>
              <td>{{ (take.items || []).length }}</td>
              <td><span class="chip" :class="{ danger: take.status === 'voided' }">{{ take.status }}</span></td>
              <td>
                <button v-if="take.status === 'open' && isCurrentDay" class="sm-btn ghost slim-btn" @click="resumeTake(take)">
                  {{ $t('storeManager.counts.resume') }}
                </button>
                <button v-else-if="take.status === 'posted'" class="sm-btn ghost slim-btn" @click="askVoid(take)">
                  {{ $t('storeManager.common.void') }}
                </button>
                <span v-else-if="take.status === 'voided'" class="void-reason">{{ take.void_reason }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.counts.empty') }}</p>
      </div>
      </template>
    </section>

    <div v-if="voidTarget" class="sm-modal-backdrop" @click.self="voidTarget = null">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.common.voidTitle') }}</h3><button class="x" @click="voidTarget = null">×</button></div>
        <label class="fld"><span>{{ $t('storeManager.common.reason') }}</span><input v-model="voidReason" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="voidTarget = null">{{ $t('common.cancel') }}</button>
          <button class="sm-btn danger" :disabled="saving" @click="confirmVoid">
            {{ saving ? $t('common.saving') : $t('storeManager.common.void') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryOpsApi } from '../../api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import CalendarInput from '@/components/CalendarInput.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useCategoriesStore } from '@/stores/categories'
import { useWorkingDateStore } from '@/stores/workingDate'
import { useClientTable } from '@/composables/useClientTable.js'
import '@/pages/store/store-shared.css'

const { t } = useI18n()
const takes = ref([])
const { q, page, lastPage } = useClientTable(takes, { pageSize: 15, searchFields: ['take_number', 'status'] })
const categoriesStore = useCategoriesStore()
const workingDateStore = useWorkingDateStore()
const businessDate = ref('')
const loadedDate = ref('')
const isCurrentDay = computed(() => !businessDate.value || businessDate.value === workingDateStore.workingDate)
const catFilter = ref('')
const categoryOptions = computed(() => categoriesStore.inventoryCategoryOptions)
const sheetTab = ref('all')
const historyTab = ref('saved')
const autosavedAt = ref('')
const activeTake = ref(null)
const loading = ref(false)
const saving = ref(false)
const dirty = ref(false)
const itemQ = ref('')
const sheetPage = ref(1)
const sheetPageSize = 20
const formError = ref('')
const voidTarget = ref(null)
const voidReason = ref('')

function isVariance(row) {
  return Number(row.counted_qty ?? row.expected_qty) !== Number(row.expected_qty)
}

const activeRows = computed(() => {
  const rows = activeTake.value?.items || []
  let list = catFilter.value ? rows.filter((r) => (r.item?.category || r.category) === catFilter.value) : rows
  if (sheetTab.value === 'variance' || sheetTab.value === 'description') {
    list = list.filter(isVariance)
  }
  const needle = itemQ.value.trim().toLowerCase()
  if (needle) {
    list = list.filter((r) => `${r.item?.item_name || ''} ${r.item?.category || r.category || ''} ${r.item?.description || ''}`
      .toLowerCase()
      .includes(needle))
  }
  return list
})
const sheetLastPage = computed(() => Math.max(1, Math.ceil(activeRows.value.length / sheetPageSize)))
const pagedActiveRows = computed(() => {
  const p = Math.min(sheetPage.value, sheetLastPage.value)
  return activeRows.value.slice((p - 1) * sheetPageSize, p * sheetPageSize)
})
watch([sheetTab, catFilter, itemQ], () => { sheetPage.value = 1 })
const historyRows = computed(() => {
  let list
  if (historyTab.value === 'submitted') {
    list = takes.value.filter((tk) => tk.status === 'posted' || tk.status === 'voided')
  } else if (!isCurrentDay.value) {
    // A closed business day is history: list every count done that day.
    list = takes.value
  } else {
    list = takes.value.filter((tk) => tk.status === 'open')
  }
  const p = Math.min(page.value, lastPage.value)
  return list.slice((p - 1) * 15, p * 15)
})
function focusNextCount(event) {
  const inputs = [...event.target.closest('table').querySelectorAll('input[type="number"]')]
  const idx = inputs.indexOf(event.target)
  inputs[idx + 1]?.focus()
}
function fmtDate(v) { return v ? new Date(v).toLocaleString() : '-' }
function round(v) { return Math.round(v * 100) / 100 }
function markDirty() { dirty.value = true; autosavedAt.value = '' }

async function load() {
  loading.value = true
  try {
    const date = businessDate.value
    const res = await inventoryOpsApi.stockTakes({ per_page: 50, date })
    takes.value = res.data.takes || []
    loadedDate.value = date
    // Resume an open sheet only on the current business day. An earlier date
    // is history: it must show the sheets done that day, not reopen one.
    const currentDay = !date || date === workingDateStore.workingDate
    const open = currentDay ? takes.value.find((tk) => tk.status === 'open') : null
    activeTake.value = open || null
    dirty.value = false
  } catch { takes.value = []; activeTake.value = null } finally { loading.value = false }
}
async function startCount() {
  formError.value = ''
  try {
    const res = await inventoryOpsApi.openStockTake({ business_date: businessDate.value })
    activeTake.value = res.data.take
    dirty.value = false
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') }
}
function resumeTake(take) {
  formError.value = ''
  activeTake.value = take
  dirty.value = false
}
function countPayload() {
  return activeTake.value.items.map((r) => ({
    take_item_id: r.take_item_id,
    counted_qty: r.counted_qty,
    variance_reason: r.variance_reason || null,
  }))
}
async function saveCounts(showError = true) {
  if (!activeTake.value || !dirty.value) return
  if (showError) saving.value = true; formError.value = ''
  try {
    await inventoryOpsApi.updateStockTakeCounts(activeTake.value.take_id, countPayload())
    dirty.value = false
    formError.value = ''
  } catch (e) { if (showError) formError.value = e.response?.data?.message || t('common.error'); throw e } finally { if (showError) saving.value = false }
}
async function postTake() {
  saving.value = true; formError.value = ''
  try {
    if (dirty.value) {
      await inventoryOpsApi.updateStockTakeCounts(activeTake.value.take_id, countPayload())
      dirty.value = false
    }
    await inventoryOpsApi.postStockTake(activeTake.value.take_id)
    activeTake.value = null
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
function askVoid(take) {
  voidReason.value = ''
  voidTarget.value = take
  formError.value = ''
}
async function confirmVoid() {
  if (!voidReason.value.trim()) { formError.value = t('storeManager.common.reasonRequired'); return }
  saving.value = true
  try {
    await inventoryOpsApi.voidStockTake(voidTarget.value.take_id, voidReason.value.trim())
    voidTarget.value = null
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
let autosaveTimer = null
async function autosave() {
  if (!activeTake.value || saving.value || !dirty.value) return
  try {
    await saveCounts(false)
    autosavedAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { /* keep the manual error for the user */ }
}
watch(businessDate, async (date) => {
  if (!date || date === loadedDate.value) return
  if (activeTake.value && dirty.value) {
    try { await saveCounts(false) } catch { /* leave the selected date to load */ }
  }
  activeTake.value = null
  itemQ.value = ''
  sheetTab.value = 'all'
  await load()
})
onMounted(async () => {
  await Promise.all([categoriesStore.ensureLoaded(), workingDateStore.ensureLoaded()])
  businessDate.value = workingDateStore.workingDate
  loadedDate.value = businessDate.value
  await load()
  autosaveTimer = setInterval(autosave, 15000)
})
onUnmounted(() => clearInterval(autosaveTimer))
</script>

<style scoped>
.slim { width: 90px; }
.neg { color: #dc2626; font-weight: 700; }
.panel-title { margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
.danger { background: #fde8e8; color: #b91c1c; }
.slim-btn { padding: 4px 10px; font-size: 12px; }
.void-reason { font-size: 12px; color: #64748b; font-style: italic; }
.autosave { margin-left: auto; font-size: 12px; color: #64748b; display: inline-flex; gap: 6px; align-items: center; }
.autosave.saved { color: #15803d; }
.sheet-tabs, .segmented { display: inline-flex; gap: 4px; background: #f1f5f9; border-radius: 8px; padding: 3px; margin-bottom: 10px; }
.sheet-tabs button, .segmented button { border: 0; background: transparent; padding: 5px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; color: #475569; }
.sheet-tabs button.active, .segmented button.active { background: #fff; color: #0f172a; box-shadow: 0 1px 3px rgba(15,23,42,.12); font-weight: 700; }
.sheet-tools { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.sheet-tools .sm-search { max-width: 320px; flex: 1; }
.reason-input { width: 100%; min-width: 220px; }
.history-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.history-head .panel-title { margin: 0; }
.muted-cell { color: #64748b; font-size: 12px; max-width: 220px; }
</style>
