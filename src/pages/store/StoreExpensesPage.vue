<!-- StoreExpensesPage — expense tracking with categories and totals. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" @input="debouncedLoad" /></div>
    <input v-model="fromDate" type="date" class="sm-input" @change="load(1)" />
    <input v-model="toDate" type="date" class="sm-input" @change="load(1)" />
    <select v-model="catFilter" class="sm-select" @change="load(1)">
        <option value="">{{ $t('inventory.allCategories') }}</option>
        <option v-for="c in expenseCats" :key="c" :value="c">{{ $t('storeManager.expenses.cats.' + c) }}</option>
      </select>
      <span class="spacer"></span>
      <div class="kpi-inline"><span>{{ $t('storeManager.expenses.total') }}:</span> <strong>TZS {{ total.toLocaleString() }}</strong></div>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.expenses.add') }}</button>
    </div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="expenses.length">
          <thead><tr>
            <th>{{ $t('common.date') }}</th><th>{{ $t('common.description') }}</th>
            <th>{{ $t('inventory.category') }}</th><th>{{ $t('storeManager.expenses.amount') }}</th><th>{{ $t('common.actions') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="e in expenses" :key="e.id">
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
          <select v-model="form.category" class="sm-select">
            <option v-for="c in expenseCats" :key="c" :value="c">{{ $t('storeManager.expenses.cats.' + c) }}</option>
          </select>
        </label>
        <label class="fld"><span>{{ $t('storeManager.expenses.amount') }}</span><input v-model.number="form.amount" type="number" min="0" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="save">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeApi } from '../../api'
import PaginationBar from '@/components/store/PaginationBar.vue'

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
const expenseCats = ['supplies', 'utilities', 'maintenance', 'transport', 'salaries', 'other']
const form = reactive({ description: '', category: 'supplies', amount: 0 })
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
onMounted(load)
</script>
