<!-- StoreCashRegisterPage — open/close drawer and shift history. -->
<template>
  <div class="sm-page">
    <div class="kpi-grid">
      <div class="kpi">
        <span class="kpi-label">{{ $t('storeManager.register.status') }}</span>
        <span class="kpi-value" :class="register?.status === 'open' ? 'ok' : 'muted'">{{ register?.status ? $t('storeManager.register.' + register.status) : '—' }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">{{ $t('storeManager.register.openingFloat') }}</span>
        <span class="kpi-value">{{ curCode() }} {{ Number(register?.opening_float || 0).toLocaleString() }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">{{ $t('storeManager.register.floatAdded') }}</span>
        <span class="kpi-value">{{ curCode() }} {{ Number(register?.floats_total || 0).toLocaleString() }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">{{ $t('storeManager.register.cashExpenses') }}</span>
        <span class="kpi-value warn">{{ curCode() }} {{ Number(liveExpensesTotal).toLocaleString() }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">{{ $t('storeManager.register.remainingFloat') }}</span>
        <span class="kpi-value">{{ curCode() }} {{ Number(remainingFloat).toLocaleString() }}</span>
      </div>
    </div>
    <!-- Cash expenses drawn against the open float: visible as soon as the
         register is opened so the user can watch FLOAT − EXPENSES = REMAINING. -->
    <section v-if="register?.status === 'open'" class="panel">
      <div class="panel-head-row">
        <h3 class="panel-title">{{ $t('storeManager.register.cashExpenses') }} — {{ $t('storeManager.register.open') }}</h3>
        <CalendarInput v-model="businessDate" :clearable="false" @change="load" />
      </div>
      <div v-if="currentFloats.length" class="float-list">
        <span class="float-pill" v-for="f in currentFloats" :key="f.id">
          <i class="fas fa-plus-circle"></i> {{ f.reference }} · {{ curCode() }} {{ Number(f.amount || 0).toLocaleString() }}
        </span>
      </div>
      <div class="table-scroll">
        <table class="sm-table" v-if="currentExpenses.length">
          <thead><tr>
            <th>{{ $t('common.date') }}</th><th>{{ $t('common.description') }}</th>
            <th>{{ $t('inventory.category') }}</th><th>{{ $t('storeManager.expenses.amount') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="e in currentExpenses" :key="e.id">
              <td>{{ fmt(e.spent_at || e.created_at) }}</td>
              <td>{{ e.description }}</td>
              <td><span class="chip">{{ e.category }}</span></td>
              <td><strong>{{ curCode() }} {{ Number(e.amount || 0).toLocaleString() }}</strong></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align:right"><strong>{{ $t('storeManager.expenses.total') }}</strong></td>
              <td><strong>{{ curCode() }} {{ Number(liveExpensesTotal).toLocaleString() }}</strong></td>
            </tr>
          </tfoot>
        </table>
        <p v-else class="empty">{{ $t('storeManager.expenses.empty') }}</p>
      </div>
    </section>
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <button v-if="register?.status !== 'open'" class="sm-btn" @click="showOpen = true"><i class="fas fa-lock-open"></i> {{ $t('storeManager.register.open') }}</button>
      <template v-else>
        <button class="sm-btn ghost" @click="showFloat = true"><i class="fas fa-plus-circle"></i> {{ $t('storeManager.register.addFloat') }}</button>
        <button class="sm-btn danger-solid" @click="showClose = true"><i class="fas fa-lock"></i> {{ $t('storeManager.register.close') }}</button>
      </template>
    </div>
    <section class="panel">
      <h3 class="panel-title">{{ $t('storeManager.register.shifts') }}</h3>
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="shifts.length">
          <thead><tr>
            <th>{{ $t('storeManager.register.openedAt') }}</th><th>{{ $t('storeManager.register.closedAt') }}</th>
            <th>{{ $t('storeManager.register.openingFloat') }}</th><th>{{ $t('storeManager.register.salesTotal') }}</th>
            <th>{{ $t('storeManager.register.cashExpenses') }}</th>
            <th>{{ $t('storeManager.register.expected') }}</th><th>{{ $t('storeManager.register.counted') }}</th><th>{{ $t('storeManager.register.difference') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="s in paged" :key="s.id">
              <td>{{ fmt(s.opened_at) }}</td><td>{{ fmt(s.closed_at) }}</td>
              <td>{{ Number(s.opening_float || 0).toLocaleString() }}</td>
              <td>{{ Number(s.sales_total || 0).toLocaleString() }}</td>
              <td>{{ Number(s.expenses_total || 0).toLocaleString() }}</td>
              <td>{{ Number(s.expected_cash || 0).toLocaleString() }}</td>
              <td>{{ Number(s.counted_cash || 0).toLocaleString() }}</td>
              <td :class="Number(s.difference || 0) < 0 ? 'neg' : 'pos'">{{ Number(s.difference || 0).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.register.empty') }}</p>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
      </div>
      </template>
    </section>
    <div v-if="showOpen" class="sm-modal-backdrop" @click.self="showOpen = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.register.open') }}</h3><button class="x" @click="showOpen = false">×</button></div>
        <label class="fld"><span>{{ $t('storeManager.register.openingFloat') }}</span><input v-model.number="openFloat" type="number" min="0" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showOpen = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="openRegister">{{ $t('common.save') }}</button>
        </div>
      </div>
    </div>
    <div v-if="showFloat" class="sm-modal-backdrop" @click.self="showFloat = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.register.addFloat') }}</h3><button class="x" @click="showFloat = false">×</button></div>
        <label class="fld"><span>{{ $t('storeManager.register.floatAmount') }}</span><input v-model.number="floatAmount" type="number" min="0" class="sm-input" /></label>
        <label class="fld"><span>{{ $t('common.reference') }} <small>({{ $t('storeManager.register.optional') }})</small></span><input v-model="floatReference" class="sm-input" :placeholder="$t('storeManager.register.autoReference')" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showFloat = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="addFloat">{{ $t('common.save') }}</button>
        </div>
      </div>
    </div>
    <div v-if="showClose" class="sm-modal-backdrop" @click.self="showClose = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.register.close') }}</h3><button class="x" @click="showClose = false">×</button></div>
        <p class="float-summary">{{ $t('storeManager.register.remainingFloat') }}: <strong>{{ curCode() }} {{ Number(remainingFloat).toLocaleString() }}</strong></p>
        <label class="fld"><span>{{ $t('storeManager.register.counted') }}</span><input v-model.number="countedCash" type="number" min="0" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showClose = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="closeRegister">{{ $t('common.save') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeApi } from '../../api'
import CalendarInput from '@/components/CalendarInput.vue'
import PaginationBar from '@/components/store/PaginationBar.vue'
import { useClientTable } from '@/composables/useClientTable.js'
import { useWorkingDateStore } from '@/stores/workingDate'
import '@/pages/store/store-shared.css'

import { useTenantCurrency } from '@/utils/currency'

const { curCode } = useTenantCurrency()

const { t } = useI18n()
const register = ref(null)
const businessDate = ref('')
const workingDateStore = useWorkingDateStore()
const shifts = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(shifts, { pageSize: 15, searchFields: ['status', (s) => s.user?.name] })
const loading = ref(false)
const saving = ref(false)
const showOpen = ref(false)
const showClose = ref(false)
const showFloat = ref(false)
const floatAmount = ref(0)
const floatReference = ref('')
const openFloat = ref(0)
const countedCash = ref(0)
const formError = ref('')
function fmt(d) { return d ? new Date(d).toLocaleString() : '-' }

// Expenses booked against the currently open register. We list the store's
// expenses so the float math (FLOAT − EXPENSES = REMAINING) is transparent.
const currentExpenses = ref([])
const currentFloats = computed(() => register.value?.floats || [])

// Prefer the backend's float expenses total, but fall back to the sum of the
// expenses we loaded so the KPI never goes stale.
const liveExpensesTotal = computed(() => {
  const backend = Number(register.value?.expenses_total)
  if (Number.isFinite(backend) && backend > 0) return backend
  return currentExpenses.value.reduce((s, e) => s + Number(e.amount || 0), 0)
})

// REMAINING = FLOAT − EXPENSES. Use the backend value when present, otherwise
// derive it from the opening float minus live expenses.
const remainingFloat = computed(() => {
  const backend = Number(register.value?.remaining_float)
  if (Number.isFinite(backend) && backend > 0) return backend
  return Math.max(0, Number(register.value?.opening_float || 0) - liveExpensesTotal.value)
})

async function load() {
  loading.value = true
  try {
    const [reg, sh, ex] = await Promise.allSettled([
      storeApi.cashRegister(),
      storeApi.shifts({ per_page: 25 }),
      storeApi.expenses({ per_page: 100, ...(businessDate.value ? { date: businessDate.value } : {}) }),
    ])
    register.value = reg.status === 'fulfilled' ? (reg.value.data.data || reg.value.data) : null
    shifts.value = sh.status === 'fulfilled' ? (sh.value.data.data || sh.value.data || []) : []
    currentExpenses.value = ex.status === 'fulfilled' ? (ex.value.data.data || ex.value.data || []) : []
  } finally { loading.value = false }
}
async function addFloat() {
  saving.value = true; formError.value = ''
  try {
    await storeApi.addFloat({ amount: floatAmount.value, reference: floatReference.value || null })
    showFloat.value = false
    floatAmount.value = 0
    floatReference.value = ''
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
async function openRegister() {
  saving.value = true; formError.value = ''
  try { await storeApi.openRegister({ opening_float: openFloat.value }); showOpen.value = false; await load() }
  catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
async function closeRegister() {
  saving.value = true; formError.value = ''
  try { await storeApi.closeRegister({ counted_cash: countedCash.value }); showClose.value = false; await load() }
  catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
onMounted(async () => {
  await workingDateStore.ensureLoaded()
  businessDate.value = workingDateStore.workingDate
  await load()
})
</script>

<style scoped>
.neg { color: #dc2626; font-weight: 700; } .pos { color: #16a34a; font-weight: 700; }
.danger-solid { background: #dc2626; color: #fff; }
.float-summary { margin: 0 0 10px; font-size: 14px; color: #334155; }
.panel-head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.panel-head-row .panel-title { margin: 0; }
.float-list { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.float-pill { background: #eff6ff; color: #1e40af; border-radius: 999px; padding: 4px 10px; font-size: 12px; }
</style>
