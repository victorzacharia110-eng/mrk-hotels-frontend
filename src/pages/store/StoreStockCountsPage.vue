<!-- StoreStockCountsPage — physical stock takes with the real API:
     open a count sheet, enter counted quantities, post to reconcile or void. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <span class="spacer"></span>
      <button class="sm-btn" @click="startCount"><i class="fas fa-clipboard-check"></i> {{ $t('storeManager.counts.new') }}</button>
    </div>

    <!-- Active count sheet -->
    <section v-if="activeTake" class="panel">
      <h3 class="panel-title">
        {{ $t('storeManager.counts.sheet') }}
        <span class="chip">{{ activeTake.take_number }}</span>
      </h3>
      <div class="table-scroll">
        <table class="sm-table">
        <thead><tr>
          <th>{{ $t('inventory.itemName') }}</th><th>{{ $t('storeManager.counts.system') }}</th>
          <th>{{ $t('storeManager.counts.counted') }}</th><th>{{ $t('storeManager.counts.variance') }}</th>
        </tr></thead>
        <tbody>
          <tr v-for="row in activeTake.items" :key="row.take_item_id">
            <td>{{ row.item?.item_name || '—' }}</td><td>{{ row.expected_qty }}</td>
            <td><input v-model.number="row.counted_qty" type="number" min="0" class="sm-input slim" /></td>
            <td :class="{ neg: Number(row.counted_qty) - Number(row.expected_qty) < 0 }">
              {{ round(Number(row.counted_qty) - Number(row.expected_qty)) }}
            </td>
          </tr>
        </tbody>
      </table>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
      </div>
      <p v-if="formError" class="sm-error">{{ formError }}</p>
      <div class="sm-modal-foot">
        <button class="sm-btn ghost" @click="activeTake = null">{{ $t('common.cancel') }}</button>
        <button class="sm-btn" :disabled="saving" @click="saveCounts">
          {{ saving ? $t('common.saving') : $t('storeManager.counts.saveCounts') }}
        </button>
        <button class="sm-btn primary" :disabled="saving" @click="postTake">
          {{ saving ? $t('common.saving') : $t('storeManager.counts.submit') }}
        </button>
      </div>
    </section>

    <!-- History -->
    <section class="panel" v-else>
      <h3 class="panel-title">{{ $t('storeManager.counts.history') }}</h3>
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="takes.length">
          <thead><tr>
            <th>{{ $t('common.date') }}</th><th>#</th><th>{{ $t('storeManager.sales.items') }}</th>
            <th>{{ $t('common.status') }}</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-for="take in paged" :key="take.take_id">
              <td>{{ fmtDate(take.created_at) }}</td>
              <td>{{ take.take_number }}</td>
              <td>{{ (take.items || []).length }}</td>
              <td><span class="chip" :class="{ danger: take.status === 'voided' }">{{ take.status }}</span></td>
              <td>
                <button v-if="take.status === 'open'" class="sm-btn ghost slim-btn" @click="resumeTake(take)">
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryOpsApi } from '../../api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import { useClientTable } from '@/composables/useClientTable.js'

const { t } = useI18n()
const takes = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(takes, { pageSize: 15, searchFields: ['take_number', 'status'] })
const activeTake = ref(null)
const loading = ref(false)
const saving = ref(false)
const formError = ref('')
const voidTarget = ref(null)
const voidReason = ref('')

function fmtDate(v) { return v ? new Date(v).toLocaleString() : '-' }
function round(v) { return Math.round(v * 100) / 100 }

async function load() {
  loading.value = true
  try {
    const res = await inventoryOpsApi.stockTakes({ per_page: 50 })
    takes.value = res.data.takes || []
    // Resume an open sheet automatically so counts are never lost.
    const open = takes.value.find((tk) => tk.status === 'open')
    if (open) activeTake.value = open
  } catch { takes.value = [] } finally { loading.value = false }
}
async function startCount() {
  formError.value = ''
  try {
    const res = await inventoryOpsApi.openStockTake({})
    activeTake.value = res.data.take
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') }
}
function resumeTake(take) {
  formError.value = ''
  activeTake.value = take
}
async function saveCounts() {
  saving.value = true; formError.value = ''
  try {
    await inventoryOpsApi.updateStockTakeCounts(
      activeTake.value.take_id,
      activeTake.value.items.map((r) => ({ take_item_id: r.take_item_id, counted_qty: r.counted_qty })),
    )
    formError.value = ''
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
async function postTake() {
  saving.value = true; formError.value = ''
  try {
    await inventoryOpsApi.updateStockTakeCounts(
      activeTake.value.take_id,
      activeTake.value.items.map((r) => ({ take_item_id: r.take_item_id, counted_qty: r.counted_qty })),
    )
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
onMounted(load)
</script>

<style scoped>
.slim { width: 90px; }
.neg { color: #dc2626; font-weight: 700; }
.panel-title { margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }
.danger { background: #fde8e8; color: #b91c1c; }
.slim-btn { padding: 4px 10px; font-size: 12px; }
.void-reason { font-size: 12px; color: #64748b; font-style: italic; }
</style>
