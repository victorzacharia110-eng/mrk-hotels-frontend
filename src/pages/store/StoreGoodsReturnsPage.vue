<!-- StoreGoodsReturnsPage — items going back to suppliers (damaged, expired,
     wrong delivery). Posting decrements stock; voiding restores it. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-rotate-left"></i> {{ $t('storeManager.returns.new') }}</button>
    </div>

    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="returns.length">
          <thead><tr>
            <th>{{ $t('common.date') }}</th><th>#</th><th>{{ $t('storeManager.sales.items') }}</th>
            <th>{{ $t('storeManager.counts.totalVariance') }}</th><th>{{ $t('common.status') }}</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-for="ret in paged" :key="ret.goods_return_id">
              <td>{{ fmtDate(ret.created_at) }}</td>
              <td>{{ ret.return_number }}</td>
              <td>{{ lineSummary(ret.items) }}</td>
              <td>{{ totalQty(ret) }}</td>
              <td><span class="chip" :class="{ danger: ret.status === 'voided' }">{{ ret.status }}</span></td>
              <td>
                <button v-if="ret.status === 'completed'" class="sm-btn ghost slim-btn" @click="askVoid(ret)">
                  {{ $t('storeManager.common.void') }}
                </button>
                <span v-else-if="ret.status === 'voided'" class="void-reason">{{ ret.void_reason }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.returns.empty') }}</p>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
      </div>
      </template>
    </section>

    <!-- New return -->
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.returns.new') }}</h3><button class="x" @click="showForm = false">×</button></div>
        <div class="fld">
          <span>{{ $t('storeManager.sales.items') }}</span>
          <div v-for="(line, idx) in form.lines" :key="idx" class="ing-row">
            <select v-model="line.item_id" class="sm-select">
              <option v-for="i in items" :key="i.item_id" :value="i.item_id">{{ i.item_name }} ({{ i.quantity_in_stock }})</option>
            </select>
            <input v-model.number="line.quantity" type="number" min="1" class="sm-input slim" />
            <button class="x" @click="form.lines.splice(idx, 1)">×</button>
          </div>
          <button class="sm-btn ghost slim-btn"
            @click="form.lines.push({ item_id: items[0]?.item_id, quantity: 1 })">
            + {{ $t('storeManager.production.addIngredient') }}
          </button>
        </div>
        <label class="fld"><span>{{ $t('storeManager.common.reason') }}</span><input v-model="form.reason" class="sm-input" /></label>
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
const returns = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(returns, { pageSize: 15, searchFields: ['goods_return_id', 'status', (r) => lineSummary(r)] })
const items = ref([])
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const formError = ref('')
const voidTarget = ref(null)
const voidReason = ref('')
const form = reactive({ reason: '', lines: [{ item_id: null, quantity: 1 }] })

function fmtDate(v) { return v ? new Date(v).toLocaleDateString() : '-' }
function lineSummary(lines) {
  return (lines || []).map((l) => `${l.item?.item_name || '—'} ×${l.quantity}`).join(', ') || '—'
}
function totalQty(ret) {
  return (ret.items || []).reduce((sum, l) => sum + Number(l.quantity || 0), 0)
}

async function load() {
  loading.value = true
  try {
    const [rt, it] = await Promise.allSettled([
      inventoryOpsApi.goodsReturns({ per_page: 50 }),
      inventoryApi.index({ per_page: 100 }),
    ])
    returns.value = rt.status === 'fulfilled' ? (rt.value.data.returns || []) : []
    items.value = it.status === 'fulfilled' ? (it.value.data.data || it.value.data || []) : []
  } finally { loading.value = false }
}
function openCreate() {
  Object.assign(form, { reason: '', lines: [{ item_id: items.value[0]?.item_id || null, quantity: 1 }] })
  formError.value = ''
  showForm.value = true
}
async function save() {
  saving.value = true; formError.value = ''
  try {
    await inventoryOpsApi.storeGoodsReturn({
      reason: form.reason,
      items: form.lines.filter((l) => l.item_id && l.quantity > 0),
    })
    showForm.value = false
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
function askVoid(ret) {
  voidReason.value = ''
  voidTarget.value = ret
  formError.value = ''
}
async function confirmVoid() {
  if (!voidReason.value.trim()) { formError.value = t('storeManager.common.reasonRequired'); return }
  saving.value = true
  try {
    await inventoryOpsApi.voidGoodsReturn(voidTarget.value.goods_return_id, voidReason.value.trim())
    voidTarget.value = null
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
onMounted(load)
</script>

<style scoped>
.panel-title { margin: 0 0 12px; }
.danger { background: #fde8e8; color: #b91c1c; }
.slim-btn { padding: 4px 10px; font-size: 12px; }
.void-reason { font-size: 12px; color: #64748b; font-style: italic; }
.ing-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.ing-row .slim { width: 80px; }
</style>
