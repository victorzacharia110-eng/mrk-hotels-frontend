<!-- StoreReportsPage — date-range sales and inventory reports. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <input v-model="from" type="date" class="sm-input" />
      <input v-model="to" type="date" class="sm-input" />
      <select v-model="type" class="sm-select">
        <option value="sales">{{ $t('storeManager.reports.salesReport') }}</option>
        <option value="inventory">{{ $t('storeManager.reports.inventoryReport') }}</option>
        <option value="expenses">{{ $t('storeManager.reports.expenseReport') }}</option>
      </select>
      <button class="sm-btn" @click="generate"><i class="fas fa-chart-line"></i> {{ $t('storeManager.reports.generate') }}</button>
      <button v-if="report" class="sm-btn ghost" @click="printReport"><i class="fas fa-print"></i> {{ $t('common.print') }}</button>
    </div>
    <section v-if="loading" class="panel"><div class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div></section>
    <template v-else-if="report">
      <div class="kpi-grid">
        <div class="kpi" v-for="(v, k) in report.summary || {}" :key="k">
          <span class="kpi-label">{{ k }}</span>
          <span class="kpi-value">{{ typeof v === 'number' ? v.toLocaleString() : v }}</span>
        </div>
      </div>
      <section class="panel">
        <div class="table-scroll">
        <table class="sm-table" v-if="(report.rows || []).length">
          <thead><tr><th v-for="h in reportHeaders" :key="h">{{ h }}</th></tr></thead>
          <tbody><tr v-for="(r, i) in report.rows" :key="i"><td v-for="h in reportHeaders" :key="h">{{ r[h] ?? '—' }}</td></tr></tbody>
        </table>
        <p v-else class="empty">{{ $t('common.noResults') }}</p>
      </div>
      </section>
    </template>
    <section v-else class="panel"><p class="empty">{{ $t('storeManager.reports.pick') }}</p></section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storeApi } from '../../api'

const from = ref(new Date().toISOString().slice(0, 10))
const to = ref(new Date().toISOString().slice(0, 10))
const type = ref('sales')
const report = ref(null)
const loading = ref(false)
const reportHeaders = computed(() => (report.value?.rows?.length ? Object.keys(report.value.rows[0]) : []))

async function generate() {
  loading.value = true
  try {
    const res = await storeApi.reports({ from: from.value, to: to.value, type: type.value })
    report.value = res.data.data || res.data
  } catch { report.value = { summary: {}, rows: [] } } finally { loading.value = false }
}
function printReport() { window.print() }
</script>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }
</style>
