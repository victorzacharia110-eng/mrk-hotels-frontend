<!-- StoreMarketListsPage — the buyer's shopping list: standalone or raised
     from an approved indent, then submitted for procurement. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-basket-shopping"></i> {{ $t('storeManager.marketLists.new') }}</button>
    </div>

    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="lists.length">
          <thead><tr>
            <th>{{ $t('common.date') }}</th><th>#</th><th>{{ $t('storeManager.marketLists.fromIndent') }}</th>
            <th>{{ $t('storeManager.sales.items') }}</th><th>{{ $t('common.status') }}</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-for="list in paged" :key="list.market_list_id">
              <td>{{ fmtDate(list.created_at) }}</td>
              <td>{{ list.ml_number }}</td>
              <td>{{ list.indent?.indent_number || '—' }}</td>
              <td>{{ lineSummary(list.items) }}</td>
              <td><span class="chip" :class="{ danger: list.status === 'voided' }">{{ list.status }}</span></td>
              <td class="actions">
                <button v-if="list.status === 'draft'" class="sm-btn slim-btn ok" @click="submit(list)">
                  {{ $t('storeManager.marketLists.submit') }}
                </button>
                <button v-if="['draft', 'submitted'].includes(list.status)" class="sm-btn ghost slim-btn danger-text"
                  @click="askVoid(list)">{{ $t('storeManager.common.void') }}</button>
                <span v-else-if="list.status === 'voided'" class="void-reason">{{ list.void_reason }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.marketLists.empty') }}</p>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
      </div>
      </template>
    </section>

    <!-- New market list -->
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.marketLists.new') }}</h3><button class="x" @click="showForm = false">×</button></div>

        <label class="fld"><span>{{ $t('storeManager.marketLists.fromIndent') }}</span>
          <select v-model="form.indent_id" class="sm-select">
            <option :value="null">—</option>
            <option v-for="i in approvedIndents" :key="i.indent_id" :value="i.indent_id">
              {{ i.indent_number }} · {{ i.department?.name }}
            </option>
          </select>
        </label>

        <label class="fld" v-if="form.indent_id">
          <button class="sm-btn ghost slim-btn" @click="pullFromIndent">{{ $t('storeManager.marketLists.pullItems') }}</button>
        </label>

        <div class="fld">
          <span>{{ $t('storeManager.sales.items') }}</span>
          <div v-for="(line, idx) in form.lines" :key="idx" class="ing-row">
            <select v-model="line.item_id" class="sm-select">
              <option v-for="i in items" :key="i.item_id" :value="i.item_id">{{ i.item_name }}</option>
            </select>
            <input v-model.number="line.quantity" type="number" min="1" class="sm-input slim" />
            <input v-model="line.note" class="sm-input" :placeholder="$t('storeManager.common.notes')" />
            <button class="x" @click="form.lines.splice(idx, 1)">×</button>
          </div>
          <button class="sm-btn ghost slim-btn"
            @click="form.lines.push({ item_id: items[0]?.item_id, quantity: 1, note: '' })">
            + {{ $t('storeManager.production.addIngredient') }}
          </button>
        </div>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryApi, inventoryOpsApi } from '../../api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import { useClientTable } from '@/composables/useClientTable.js'

const { t } = useI18n()
const lists = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(lists, { pageSize: 15, searchFields: ['market_list_id', 'status', (r) => r.department?.name, (r) => lineSummary(r)] })
const indents = ref([])
const items = ref([])
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const formError = ref('')
const voidTarget = ref(null)
const voidReason = ref('')
const form = reactive({ indent_id: null, lines: [{ item_id: null, quantity: 1, note: '' }] })

const approvedIndents = computed(() => indents.value.filter((i) => i.status === 'approved'))
function fmtDate(v) { return v ? new Date(v).toLocaleDateString() : '-' }
function lineSummary(lines) {
  return (lines || []).map((l) => `${l.item?.item_name || '—'} ×${l.quantity}`).join(', ') || '—'
}

async function load() {
  loading.value = true
  try {
    const [ml, ind, it] = await Promise.allSettled([
      inventoryOpsApi.marketLists({ per_page: 50 }),
      inventoryOpsApi.indents({ per_page: 100 }),
      inventoryApi.index({ per_page: 100 }),
    ])
    lists.value = ml.status === 'fulfilled' ? (ml.value.data.market_lists || []) : []
    indents.value = ind.status === 'fulfilled' ? (ind.value.data.indents || []) : []
    items.value = it.status === 'fulfilled' ? (it.value.data.data || it.value.data || []) : []
  } finally { loading.value = false }
}
function openCreate() {
  Object.assign(form, { indent_id: null, lines: [{ item_id: items.value[0]?.item_id || null, quantity: 1, note: '' }] })
  formError.value = ''
  showForm.value = true
}
function pullFromIndent() {
  const indent = indents.value.find((i) => i.indent_id === form.indent_id)
  if (!indent) return
  form.lines = (indent.items || []).map((l) => ({
    item_id: l.item_id, quantity: Number(l.quantity), note: '',
  }))
}
async function save() {
  saving.value = true; formError.value = ''
  try {
    await inventoryOpsApi.storeMarketList({
      indent_id: form.indent_id,
      items: form.lines.filter((l) => l.item_id && l.quantity > 0),
    })
    showForm.value = false
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
async function submit(list) {
  saving.value = true; formError.value = ''
  try { await inventoryOpsApi.submitMarketList(list.market_list_id); await load() }
  catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
function askVoid(list) {
  voidReason.value = ''
  voidTarget.value = list
  formError.value = ''
}
async function confirmVoid() {
  if (!voidReason.value.trim()) { formError.value = t('storeManager.common.reasonRequired'); return }
  saving.value = true
  try {
    await inventoryOpsApi.voidMarketList(voidTarget.value.market_list_id, voidReason.value.trim())
    voidTarget.value = null
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
onMounted(load)
</script>

<style scoped>
.panel-title { margin: 0 0 12px; }
.danger { background: #fde8e8; color: #b91c1c; }
.danger-text { color: #b91c1c !important; }
.ok { background: #e7f6ec; color: #15803d; }
.slim-btn { padding: 4px 10px; font-size: 12px; }
.actions { display: flex; gap: 4px; flex-wrap: wrap; }
.void-reason { font-size: 12px; color: #64748b; font-style: italic; }
.ing-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.ing-row .slim { width: 80px; }
</style>
