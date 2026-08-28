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
        <span class="kpi-value">TZS {{ Number(register?.opening_float || 0).toLocaleString() }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">{{ $t('storeManager.register.currentCash') }}</span>
        <span class="kpi-value">TZS {{ Number(register?.current_cash || 0).toLocaleString() }}</span>
      </div>
    </div>
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <button v-if="register?.status !== 'open'" class="sm-btn" @click="showOpen = true"><i class="fas fa-lock-open"></i> {{ $t('storeManager.register.open') }}</button>
      <button v-else class="sm-btn danger-solid" @click="showClose = true"><i class="fas fa-lock"></i> {{ $t('storeManager.register.close') }}</button>
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
            <th>{{ $t('storeManager.register.expected') }}</th><th>{{ $t('storeManager.register.counted') }}</th><th>{{ $t('storeManager.register.difference') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="s in paged" :key="s.id">
              <td>{{ fmt(s.opened_at) }}</td><td>{{ fmt(s.closed_at) }}</td>
              <td>{{ Number(s.opening_float || 0).toLocaleString() }}</td>
              <td>{{ Number(s.sales_total || 0).toLocaleString() }}</td>
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
    <div v-if="showClose" class="sm-modal-backdrop" @click.self="showClose = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.register.close') }}</h3><button class="x" @click="showClose = false">×</button></div>
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeApi } from '../../api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import { useClientTable } from '@/composables/useClientTable.js'

const { t } = useI18n()
const register = ref(null)
const shifts = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(shifts, { pageSize: 15, searchFields: ['status', (s) => s.user?.name] })
const loading = ref(false)
const saving = ref(false)
const showOpen = ref(false)
const showClose = ref(false)
const openFloat = ref(0)
const countedCash = ref(0)
const formError = ref('')
function fmt(d) { return d ? new Date(d).toLocaleString() : '-' }

async function load() {
  loading.value = true
  try {
    const [reg, sh] = await Promise.allSettled([storeApi.cashRegister(), storeApi.shifts({ per_page: 25 })])
    register.value = reg.status === 'fulfilled' ? (reg.value.data.data || reg.value.data) : null
    shifts.value = sh.status === 'fulfilled' ? (sh.value.data.data || sh.value.data || []) : []
  } finally { loading.value = false }
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
onMounted(load)
</script>

<style scoped>
.neg { color: #dc2626; font-weight: 700; } .pos { color: #16a34a; font-weight: 700; }
.danger-solid { background: #dc2626; color: #fff; }
</style>
