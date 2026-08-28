<!-- StoreSalesPage — sales history with filters and detail receipt view. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="filters.q" type="text" :placeholder="$t('common.search')" @input="debouncedLoad" /></div>
      <input v-model="filters.from" type="date" class="sm-input" @change="load(1)" />
      <input v-model="filters.to" type="date" class="sm-input" @change="load(1)" />
      <select v-model="filters.method" class="sm-select" @change="load(1)">
        <option value="">{{ $t('storeManager.sales.allMethods') }}</option>
        <option value="cash">{{ $t('storeManager.pos.cash') }}</option>
        <option value="card">{{ $t('storeManager.pos.card') }}</option>
        <option value="mobile_money">{{ $t('storeManager.pos.mobileMoney') }}</option>
      </select>
      <select v-model="filters.status" class="sm-select" @change="load(1)">
        <option value="">{{ $t('common.status') }}</option>
        <option value="completed">{{ $t('storeManager.sales.completed') }}</option>
        <option value="voided">{{ $t('storeManager.sales.voided') }}</option>
      </select>
      <span class="spacer"></span>
      <div class="kpi-inline"><span>{{ $t('storeManager.sales.totalSales') }}:</span> <strong>TZS {{ totalAmount.toLocaleString() }}</strong></div>
    </div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="sales.length">
          <thead><tr>
            <th>{{ $t('storeManager.sales.receiptNo') }}</th><th>{{ $t('common.date') }}</th>
            <th>{{ $t('storeManager.sales.items') }}</th><th>{{ $t('storeManager.pos.paymentMethod') }}</th>
            <th>{{ $t('storeManager.pos.total') }}</th><th>{{ $t('common.actions') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="s in sales" :key="s.sale_id || s.id">
              <td>#{{ s.sale_id || s.id }}</td>
              <td>{{ fmtDate(s.created_at) }}</td>
              <td>{{ s.items_count ?? (s.items || []).length }}</td>
              <td><span class="chip">{{ s.payment_method }}</span></td>
              <td><strong>TZS {{ Number(s.total || 0).toLocaleString() }}</strong></td>
              <td><button class="sm-btn sm ghost" @click="view(s)"><i class="fas fa-eye"></i></button></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.sales.empty') }}</p>
      </div>
        <div class="sm-pagination" v-if="meta.last_page > 1">
          <button :disabled="meta.current_page <= 1" @click="load(meta.current_page - 1)">&laquo;</button>
          <span>{{ meta.current_page }} / {{ meta.last_page }}</span>
          <button :disabled="meta.current_page >= meta.last_page" @click="load(meta.current_page + 1)">&raquo;</button>
        </div>
      </template>
    </section>
    <div v-if="detail" class="sm-modal-backdrop" @click.self="detail = null">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.sales.saleDetail') }} #{{ detail.sale_id || detail.id }}</h3><button class="x" @click="detail = null">×</button></div>
        <div class="table-scroll">
        <table class="sm-table">
          <thead><tr><th>{{ $t('inventory.itemName') }}</th><th>{{ $t('storeManager.sales.qty') }}</th><th>{{ $t('storeManager.pos.total') }}</th></tr></thead>
          <tbody>
            <tr v-for="(l, i) in detail.items || []" :key="i">
              <td>{{ l.item_name || l.name }}</td><td>{{ l.quantity || l.qty }}</td>
              <td>TZS {{ Number((l.unit_price || l.price || 0) * (l.quantity || l.qty || 1)).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { storeApi } from '../../api'

const sales = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const loading = ref(false)
const detail = ref(null)
const filters = reactive({ from: '', to: '', method: '', status: '', q: '' })
let debounce
function debouncedLoad() { clearTimeout(debounce); debounce = setTimeout(() => load(1), 300) }
const totalAmount = computed(() => sales.value.reduce((s, x) => s + Number(x.total || 0), 0))

function fmtDate(d) { return d ? new Date(d).toLocaleString() : '-' }
async function load(page = 1) {
  loading.value = true
  try {
    const params = { page, per_page: 20 }
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    if (filters.method) params.payment_method = filters.method
    if (filters.status) params.status = filters.status
    if (filters.q) params.q = filters.q
    const res = await storeApi.sales(params)
    sales.value = res.data.data || res.data || []
    meta.value = res.data.meta || { current_page: res.data.current_page ?? 1, last_page: res.data.last_page ?? 1 }
  } catch { sales.value = [] } finally { loading.value = false }
}
async function view(s) {
  try { const res = await storeApi.showSale(s.sale_id || s.id); detail.value = res.data.data || res.data } catch { detail.value = s }
}
onMounted(() => load(1))
</script>

<style scoped>
.kpi-inline { display: flex; gap: 6px; align-items: center; font-size: 14px; }
</style>
