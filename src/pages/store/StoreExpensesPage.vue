<!-- StoreExpensesPage — expense tracking with categories and totals. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" @input="debouncedLoad" /></div>
    <CalendarInput v-model="businessDate" :clearable="false" @change="load(1)" />
    <SearchableSelect
        v-model="catFilter"
        :options="expenseCategoryOptions"
        :empty-label="$t('inventory.allCategories')"
        force-search
        @change="load(1)"
      />
      <span class="spacer"></span>
      <div class="kpi-inline"><span>{{ $t('storeManager.expenses.total') }}:</span> <strong>{{ curCode() }} {{ total.toLocaleString() }}</strong></div>
      <button v-if="bulk.selectedCount > 0" class="sm-btn danger" @click="openBulkVoid"><i class="fas fa-trash"></i> {{ $t('common.deleteSelected') }} ({{ bulk.selectedCount }})</button>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.expenses.add') }}</button>
    </div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="expenses.length">
          <thead><tr>
            <th class="bulk-col"><input type="checkbox" :checked="bulk.allSelected" :indeterminate.prop="bulk.someSelected && !bulk.allSelected" :aria-label="$t('common.selectAll')" @change="bulk.toggleAll()" /></th>
            <th>{{ $t('common.date') }}</th><th>{{ $t('common.reference') }}</th><th>{{ $t('common.description') }}</th>
            <th>{{ $t('storeManager.expenses.particular') }}</th>
            <th>{{ $t('inventory.category') }}</th><th>{{ $t('storeManager.expenses.amount') }}</th><th>{{ $t('common.actions') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="e in expenses" :key="e.id">
              <td class="bulk-col"><input type="checkbox" :checked="bulk.isSelected(e.id)" @change="bulk.toggle(e.id)" /></td>
              <td>{{ fmtDate(e.spent_at || e.created_at) }}</td>
              <td class="ref-cell">{{ e.reference || '-' }}</td>
              <td>{{ e.description }}</td>
              <td>{{ e.particular || '-' }}</td>
              <td><span class="chip">{{ e.category }}</span></td>
              <td><strong>{{ curCode() }} {{ Number(e.amount || 0).toLocaleString() }}</strong></td>
              <td><button class="sm-btn sm danger" @click="remove(e)"><i class="fas fa-trash"></i></button></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.expenses.empty') }}</p>
        <PaginationBar :page="meta.current_page" :last-page="meta.last_page" @change="load($event)" />
      </div>
      </template>
    </section>
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.expenses.add') }}</h3><button class="x" @click="showForm = false">×</button></div>
        <label class="fld"><span>{{ $t('common.description') }}</span><input v-model="form.description" class="sm-input" /></label>
        <label class="fld"><span>{{ $t('storeManager.expenses.particular') }}</span><input v-model="form.particular" class="sm-input" /></label>
        <label class="fld"><span>{{ $t('inventory.category') }}</span>
          <SearchableSelect v-model="form.category" :options="expenseCategoryOptions" force-search />
          <button type="button" class="link-btn" @click="createCategory"><i class="fas fa-plus"></i> {{ $t('storeManager.expenses.newCategory') }}</button>
        </label>
        <label class="fld"><span>{{ $t('storeManager.expenses.amount') }}</span><input v-model.number="form.amount" type="number" min="0" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="save">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </div>

    <div v-if="voiding" class="sm-modal-backdrop" @click.self="closeVoid">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.expenses.voidTitle') }}</h3><button class="x" @click="closeVoid">×</button></div>
        <p class="void-copy">{{ $t('storeManager.expenses.voidMessage', { count: voidIds.length }) }}</p>
        <label class="fld"><span>{{ $t('storeManager.expenses.voidReason') }}</span><textarea v-model="voidReason" class="sm-input" rows="3" :placeholder="$t('storeManager.expenses.voidReasonPlaceholder')"></textarea></label>
        <p v-if="voidError" class="sm-error">{{ voidError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" :disabled="deleting" @click="closeVoid">{{ $t('common.cancel') }}</button>
          <button class="sm-btn danger" :disabled="deleting || !voidReason.trim()" @click="confirmVoid">{{ deleting ? $t('common.saving') : $t('storeManager.expenses.voidAction') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeApi, inventoryOpsApi } from '../../api'
import CalendarInput from '@/components/CalendarInput.vue'
import PaginationBar from '@/components/store/PaginationBar.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useCategoriesStore } from '@/stores/categories'
import { useBulkSelection } from '@/composables/useBulkSelection'
import { useWorkingDateStore } from '@/stores/workingDate'
import '@/pages/store/store-shared.css'

import { useTenantCurrency } from '@/utils/currency'

const { curCode } = useTenantCurrency()

const { t } = useI18n()
const expenses = ref([])
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const catFilter = ref('')
const q = ref('')
const businessDate = ref('')
const workingDateStore = useWorkingDateStore()
const meta = ref({ current_page: 1, last_page: 1 })
let debounce
function debouncedLoad() { clearTimeout(debounce); debounce = setTimeout(() => load(1), 300) }
const formError = ref('')
const success = ref('')
const error = ref('')
const categoriesStore = useCategoriesStore()
const expenseCategoryOptions = categoriesStore.expenseCategoryOptions
const form = reactive({ description: '', particular: '', category: 'supplies', amount: 0 })

const bulk = useBulkSelection(() => expenses.value, { idKey: 'id' })
const voiding = ref(false)
const voidIds = ref([])
const voidReason = ref('')
const voidError = ref('')
const deleting = ref(false)
const total = computed(() => expenses.value.reduce((s, e) => s + Number(e.amount || 0), 0))  // current page only
function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : '-' }

async function load(page = 1) {
  loading.value = true
  try {
    const params = { per_page: 20, page }
    if (catFilter.value) params.category = catFilter.value
    if (businessDate.value) params.date = businessDate.value
    if (q.value) params.q = q.value
    const res = await storeApi.expenses(params)
    const d = res.data
    expenses.value = d.data || d || []
    meta.value = d.meta || { current_page: d.current_page ?? 1, last_page: d.last_page ?? 1 }
  } catch { expenses.value = [] } finally { loading.value = false }
}
function openCreate() { Object.assign(form, { description: '', particular: '', category: 'supplies', amount: 0 }); formError.value = ''; showForm.value = true }
async function save() {
  saving.value = true; formError.value = ''
  try { await storeApi.storeExpense({ ...form, spent_at: businessDate.value || undefined }); showForm.value = false; await load() }
  catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
function remove(e) {
  voidIds.value = [e.id]
  voidReason.value = ''
  voidError.value = ''
  voiding.value = true
}
function openBulkVoid() {
  voidIds.value = [...bulk.selectedIds]
  voidReason.value = ''
  voidError.value = ''
  voiding.value = true
}
function closeVoid() {
  if (deleting.value) return
  voiding.value = false
}
async function confirmVoid() {
  const reason = voidReason.value.trim()
  if (!reason) return
  deleting.value = true
  voidError.value = ''
  try {
    for (const id of voidIds.value) {
      await storeApi.destroyExpense(id, { reason })
    }
    success.value = t('storeManager.expenses.voidSuccess', { count: voidIds.value.length })
    bulk.clear()
    voiding.value = false
    await load()
  } catch (err) {
    voidError.value = err.response?.data?.message || t('common.error')
  } finally {
    deleting.value = false
  }
}
async function createCategory() {
  const label = window.prompt(t('storeManager.expenses.categoryPrompt'))
  if (!label?.trim()) return
  const clean = label.trim()
  const value = clean.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  try {
    await inventoryOpsApi.createCategory({ group: 'expense', value, label: clean, is_active: true })
    await categoriesStore.reload()
    form.category = value
  } catch (err) {
    formError.value = err.response?.data?.message || t('common.error')
  }
}
onMounted(async () => {
  await categoriesStore.ensureLoaded()
  await workingDateStore.ensureLoaded()
  businessDate.value = workingDateStore.workingDate
  load(1)
})
</script>

<style scoped>
.link-btn { margin-top: 6px; background: none; border: 0; color: #1d4ed8; font-size: 12px; cursor: pointer; padding: 0; }
.void-copy { color: #4b5563; margin-bottom: 12px; }
.ref-cell { font-family: monospace; font-size: 12px; color: #6b7280; }
.bulk-col {
  width: 40px;
}

.bulk-col input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
</style>
