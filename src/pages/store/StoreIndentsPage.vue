<!-- StoreIndentsPage — department indents: request items from the store,
     approve/reject (level 70+) and cancel pending ones. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.indents.new') }}</button>
    </div>

    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="indents.length">
          <thead><tr>
            <th>{{ $t('common.date') }}</th><th>#</th><th>{{ $t('storeManager.indents.department') }}</th>
            <th>{{ $t('storeManager.sales.items') }}</th><th>{{ $t('common.status') }}</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-for="indent in paged" :key="indent.indent_id">
              <td>{{ fmtDate(indent.created_at) }}</td>
              <td>{{ indent.indent_number }}</td>
              <td>{{ indent.department?.name || '—' }}</td>
              <td>{{ lineSummary(indent.items) }}</td>
              <td><span class="chip" :class="{ danger: ['rejected', 'voided'].includes(indent.status) }">{{ indent.status }}</span></td>
              <td class="actions">
                <template v-if="indent.status === 'pending'">
                  <button class="sm-btn slim-btn ok" @click="act(approveIndent, indent)">{{ $t('storeManager.indents.approve') }}</button>
                  <button class="sm-btn ghost slim-btn" @click="askReason(rejectIndent, indent)">{{ $t('storeManager.indents.reject') }}</button>
                  <button class="sm-btn ghost slim-btn danger-text" @click="askReason(voidIndent, indent)">{{ $t('common.cancel') }}</button>
                </template>
                <button v-else-if="indent.status === 'approved'" class="sm-btn ghost slim-btn danger-text"
                  @click="askReason(voidIndent, indent)">{{ $t('common.cancel') }}</button>
                <span v-else-if="indent.void_reason" class="void-reason">{{ indent.void_reason }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.indents.empty') }}</p>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
      </div>
      </template>
    </section>

    <!-- New indent -->
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.indents.new') }}</h3><button class="x" @click="showForm = false">×</button></div>
        <label class="fld"><span>{{ $t('storeManager.indents.department') }}</span>
          <select v-model="form.department_id" class="sm-select">
            <option v-for="d in departments" :key="d.department_id" :value="d.department_id">{{ d.name }}</option>
          </select>
        </label>
        <div class="fld">
          <span>{{ $t('storeManager.sales.items') }}</span>
          <div v-for="(line, idx) in form.lines" :key="idx" class="ing-row">
            <select v-model="line.item_id" class="sm-select">
              <option v-for="i in items" :key="i.item_id" :value="i.item_id">{{ i.item_name }} ({{ i.quantity_in_stock }})</option>
            </select>
            <input v-model.number="line.quantity" type="number" min="1" class="sm-input slim" />
            <button class="x" @click="form.lines.splice(idx, 1)">×</button>
          </div>
          <button class="sm-btn ghost slim-btn" @click="form.lines.push({ item_id: items[0]?.item_id, quantity: 1 })">
            + {{ $t('storeManager.production.addIngredient') }}
          </button>
        </div>
        <label class="fld"><span>{{ $t('storeManager.common.notes') }}</span><input v-model="form.notes" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="save">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </div>

    <!-- Reason prompt (reject / void) -->
    <div v-if="reasonTarget" class="sm-modal-backdrop" @click.self="reasonTarget = null">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.common.reasonTitle') }}</h3><button class="x" @click="reasonTarget = null">×</button></div>
        <label class="fld"><span>{{ $t('storeManager.common.reason') }}</span><input v-model="reasonText" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="reasonTarget = null">{{ $t('common.cancel') }}</button>
          <button class="sm-btn danger" :disabled="saving" @click="confirmReason">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
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
const indents = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(indents, { pageSize: 15, searchFields: ['indent_id', 'status', (r) => r.department?.name, (r) => lineSummary(r)] })
const departments = ref([])
const items = ref([])
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const formError = ref('')
const reasonTarget = ref(null)
const reasonAction = ref(null)
const reasonText = ref('')
const form = reactive({ department_id: null, notes: '', lines: [{ item_id: null, quantity: 1 }] })

function fmtDate(v) { return v ? new Date(v).toLocaleDateString() : '-' }
function lineSummary(lines) {
  return (lines || []).map((l) => `${l.item?.item_name || '—'} ×${l.quantity}`).join(', ') || '—'
}

async function load() {
  loading.value = true
  try {
    const [ind, dp, it] = await Promise.allSettled([
      inventoryOpsApi.indents({ per_page: 50 }),
      inventoryOpsApi.departments(),
      inventoryApi.index({ per_page: 200 }),
    ])
    indents.value = ind.status === 'fulfilled' ? (ind.value.data.indents || []) : []
    departments.value = dp.status === 'fulfilled' ? (dp.value.data.departments || []) : []
    items.value = it.status === 'fulfilled' ? (it.value.data.data || it.value.data || []) : []
  } finally { loading.value = false }
}
function openCreate() {
  Object.assign(form, {
    department_id: departments.value[0]?.department_id || null,
    notes: '',
    lines: [{ item_id: items.value[0]?.item_id || null, quantity: 1 }],
  })
  formError.value = ''
  showForm.value = true
}
async function save() {
  saving.value = true; formError.value = ''
  try {
    await inventoryOpsApi.storeIndent({
      department_id: form.department_id,
      notes: form.notes,
      items: form.lines.filter((l) => l.item_id && l.quantity > 0),
    })
    showForm.value = false
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
async function act(action, indent) {
  saving.value = true; formError.value = ''
  try { await action(indent); await load() } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally { saving.value = false }
}
function askReason(action, target) {
  reasonAction.value = action
  reasonTarget.value = target
  reasonText.value = ''
  formError.value = ''
}
async function confirmReason() {
  if (!reasonText.value.trim()) { formError.value = t('storeManager.common.reasonRequired'); return }
  await act(() => reasonAction.value(reasonTarget.value, reasonText.value.trim()))
  reasonTarget.value = null
}
const approveIndent = (i) => inventoryOpsApi.approveIndent(i.indent_id)
const rejectIndent = (i, reason) => inventoryOpsApi.rejectIndent(i.indent_id, reason)
const voidIndent = (i, reason) => inventoryOpsApi.voidIndent(i.indent_id, reason)

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
