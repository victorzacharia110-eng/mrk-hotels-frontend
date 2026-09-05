<!-- StoreExpensesPage — expense tracking with categories and totals. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" @input="debouncedLoad" /></div>
    <input v-model="fromDate" type="date" class="sm-input" @change="load(1)" />
    <input v-model="toDate" type="date" class="sm-input" @change="load(1)" />
    <SearchableSelect
        v-model="catFilter"
        :options="expenseCategoryOptions"
        :empty-label="$t('inventory.allCategories')"
        force-search
        @change="load(1)"
      />
      <span class="spacer"></span>
      <div class="kpi-inline"><span>{{ $t('storeManager.expenses.total') }}:</span> <strong>TZS {{ total.toLocaleString() }}</strong></div>
      <button v-if="bulk.selectedCount > 0" class="sm-btn danger" @click="showBulkDelete = true"><i class="fas fa-trash"></i> {{ $t('common.deleteSelected') }} ({{ bulk.selectedCount }})</button>
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
            <th>{{ $t('common.date') }}</th><th>{{ $t('common.description') }}</th>
            <th>{{ $t('inventory.category') }}</th><th>{{ $t('storeManager.expenses.amount') }}</th><th>{{ $t('common.actions') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="e in expenses" :key="e.id">
              <td class="bulk-col"><input type="checkbox" :checked="bulk.isSelected(e.id)" @change="bulk.toggle(e.id)" /></td>
              <td>{{ fmtDate(e.created_at || e.date) }}</td>
              <td>{{ e.description }}</td>
              <td><span class="chip">{{ e.category }}</span></td>
              <td><strong>TZS {{ Number(e.amount || 0).toLocaleString() }}</strong></td>
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
        <label class="fld"><span>{{ $t('inventory.category') }}</span>
          <SearchableSelect v-model="form.category" :options="expenseCategoryOptions" force-search />
        </label>
        <label class="fld"><span>{{ $t('storeManager.expenses.amount') }}</span><input v-model.number="form.amount" type="number" min="0" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="save">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </div>

    <!-- Confirmation modal for bulk deletion (type DELETE to confirm) -->
    <DeleteConfirmModal
      v-model="showBulkDelete"
      :count="bulk.selectedCount"
      :busy="deleting"
      @confirm="bulkDelete"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeApi } from '../../api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useCategoriesStore } from '@/stores/categories'
import { useBulkSelection } from '@/composables/useBulkSelection'

const { t } = useI18n()
const expenses = ref([])
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const catFilter = ref('')
const q = ref('')
const fromDate = ref('')
const toDate = ref('')
const meta = ref({ current_page: 1, last_page: 1 })
let debounce
function debouncedLoad() { clearTimeout(debounce); debounce = setTimeout(() => load(1), 300) }
const formError = ref('')
const success = ref('')
const error = ref('')
const categoriesStore = useCategoriesStore()
const expenseCategoryOptions = categoriesStore.expenseCategoryOptions
const form = reactive({ description: '', category: 'supplies', amount: 0 })

const bulk = useBulkSelection(() => expenses.value, { idKey: 'id' })
const showBulkDelete = ref(false)
const deleting = ref(false)
const total = computed(() => expenses.value.reduce((s, e) => s + Number(e.amount || 0), 0))  // current page only
function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : '-' }

async function load(page = 1) {
  loading.value = true
  try {
    const params = { per_page: 20, page }
    if (catFilter.value) params.category = catFilter.value
    if (fromDate.value) params.from = fromDate.value
    if (toDate.value) params.to = toDate.value
    if (q.value) params.q = q.value
    const res = await storeApi.expenses(params)
    const d = res.data
    expenses.value = d.data || d || []
    meta.value = d.meta || { current_page: d.current_page ?? 1, last_page: d.last_page ?? 1 }
  } catch { expenses.value = [] } finally { loading.value = false }
}
function openCreate() { Object.assign(form, { description: '', category: 'supplies', amount: 0 }); formError.value = ''; showForm.value = true }
async function save() {
  saving.value = true; formError.value = ''
  try { await storeApi.storeExpense(form); showForm.value = false; await load() }
  catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
async function remove(e) {
  if (!window.confirm(t('storeManager.expenses.deleteConfirm'))) return
  await storeApi.destroyExpense(e.id); await load()
}
async function bulkDelete() {
  error.value = ''
  deleting.value = true
  try {
    const { tried, failed } = await bulk.removeMany((id) => storeApi.destroyExpense(id))
    if (failed > 0) error.value = t('storeManager.expenses.bulkDeletePartial', { tried, failed })
    else if (tried > 0) success.value = t('storeManager.expenses.bulkDeleteSuccess', { count: tried })
    bulk.clear()
    showBulkDelete.value = false
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  } finally {
    deleting.value = false
  }
}
onMounted(load)
</script>

<style scoped>
.bulk-col {
  width: 40px;
}

.bulk-col input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
</style>
