<!--
  StoreReportsPage — store manager reports. Offers the six client-requested
  reports with a time period: Stock Ledger, Stock Transfer Summary, Stock
  Movement Detail, Physical Stock Taking, Closing Stock and Goods Returns.
  A `?view=` query (from the sidebar) preselects a report type.
-->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <input v-model="from" type="date" class="sm-input" />
      <input v-model="to" type="date" class="sm-input" />
      <select v-model="type" class="sm-select" @change="generate">
        <option v-for="(cfg, key) in REPORT_CONFIG" :key="key" :value="key">{{ $t(cfg.labelKey) }}</option>
      </select>
      <button class="sm-btn" @click="generate"><i class="fas fa-chart-line"></i> {{ $t('storeManager.reports.generate') }}</button>
      <button v-if="data" class="sm-btn ghost" @click="printReport"><i class="fas fa-print"></i> {{ $t('common.print') }}</button>
    </div>

    <section v-if="loading" class="panel"><div class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div></section>

    <div v-if="data" id="sm-report-print" class="sm-report-print">
      <header class="report-print-head">
        <h2>{{ $t(REPORT_CONFIG[type].labelKey) }}</h2>
        <span v-if="type === 'closing-stock'">{{ $t('storeManager.reports.asOf') }}: {{ to || from }}</span>
        <span v-else>{{ from || '—' }} → {{ to || '—' }}</span>
      </header>

      <section class="panel">
        <div class="table-scroll">
        <table class="sm-table" v-if="rows.length">
          <thead>
            <tr><th v-for="col in cols" :key="col.field">{{ col.label }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="i">
              <td v-for="col in cols" :key="col.field">
                <template v-if="col.money || col.num">{{ fmtNum(r[col.field]) }}</template>
                <template v-else>{{ r[col.field] ?? '—' }}</template>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="totals.length">
            <tr>
              <td :colspan="cols.length - totals.length" class="totals-label">{{ $t('inventory.totals') }}</td>
              <td v-for="key in totals" :key="key" class="totals-value">{{ fmtNum(data.totals?.[key]) }}</td>
            </tr>
          </tfoot>
        </table>
        <p v-else class="empty">{{ $t('common.noResults') }}</p>
      </div>
      </section>
    </div>

    <section v-else-if="!loading" class="panel"><p class="empty">{{ $t('storeManager.reports.pick') }}</p></section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { reportApi } from '@/api'

const { t } = useI18n()
const route = useRoute()

const REPORT_CONFIG = {
  'ledger-summary': {
    labelKey: 'storeManager.reports.stockLedger',
    rows: 'items',
    cols: [
      { field: 'item_name', label: 'Item' },
      { field: 'unit', label: 'Unit' },
      { field: 'opening_stock', label: 'Opening', num: true },
      { field: 'received', label: 'Received', num: true },
      { field: 'issued', label: 'Issued', num: true },
      { field: 'closing_stock', label: 'Closing', num: true },
      { field: 'closing_value', label: 'Closing value (TZS)', num: true, money: true },
    ],
    totals: ['received_value', 'issued_value', 'closing_value'],
  },
  'transfer-register': {
    labelKey: 'storeManager.reports.transferSummary',
    rows: 'transfers',
    cols: [
      { field: 'transfer_number', label: 'Transfer #' },
      { field: 'date', label: 'Date' },
      { field: 'from_department', label: 'From' },
      { field: 'to_department', label: 'To' },
      { field: 'status', label: 'Status' },
    ],
  },
  'movement-detail': {
    labelKey: 'storeManager.reports.movementDetail',
    rows: 'movements',
    cols: [
      { field: 'date', label: 'Date' },
      { field: 'item_name', label: 'Item' },
      { field: 'direction', label: 'Direction' },
      { field: 'transaction', label: 'Transaction' },
      { field: 'quantity', label: 'Qty', num: true },
      { field: 'balance_after', label: 'Balance after', num: true },
      { field: 'value', label: 'Value (TZS)', num: true, money: true },
      { field: 'recorded_by', label: 'Recorded by' },
    ],
  },
  'stock-take-detail': {
    labelKey: 'storeManager.reports.physicalStock',
    rows: 'takes',
    cols: [
      { field: 'take_number', label: 'Take #' },
      { field: 'date', label: 'Date' },
      { field: 'counted_by', label: 'Counted by' },
      { field: 'lines_count', label: 'Items counted', num: true },
      { field: 'variance_qty', label: 'Variance qty', num: true },
      { field: 'status', label: 'Status' },
    ],
    totals: ['variance_qty'],
  },
  'closing-stock': {
    labelKey: 'storeManager.reports.closingStock',
    rows: 'items',
    cols: [
      { field: 'item_name', label: 'Item' },
      { field: 'category', label: 'Category' },
      { field: 'closing_stock', label: 'Qty on hand', num: true },
      { field: 'unit', label: 'Unit' },
      { field: 'unit_cost', label: 'Unit cost (TZS)', num: true, money: true },
      { field: 'closing_value', label: 'Value (TZS)', num: true, money: true },
    ],
    totals: ['closing_value'],
  },
  'goods-return-register': {
    labelKey: 'storeManager.reports.goodsReturns',
    rows: 'returns',
    cols: [
      { field: 'return_number', label: 'Return #' },
      { field: 'date', label: 'Date' },
      { field: 'reason', label: 'Reason' },
      { field: 'quantity', label: 'Qty', num: true },
      { field: 'value', label: 'Value (TZS)', num: true, money: true },
      { field: 'status', label: 'Status' },
    ],
    totals: ['quantity', 'value'],
  },
}

const from = ref(new Date().toISOString().slice(0, 10))
const to = ref(new Date().toISOString().slice(0, 10))
const type = ref('ledger-summary')
const data = ref(null)
const loading = ref(false)

const cfg = computed(() => REPORT_CONFIG[type.value])
const cols = computed(() => cfg.value?.cols || [])
const totals = computed(() => cfg.value?.totals || [])
const rows = computed(() => {
  const payload = data.value
  if (!payload) return []
  const rowsKey = cfg.value?.rows || 'rows'
  return (payload[rowsKey] || []).map((row) => ({
    ...row,
    lines_count: Array.isArray(row.lines) ? row.lines.length : undefined,
    variance_qty: Array.isArray(row.lines) && row.lines.some((l) => l.variance !== undefined)
      ? Math.round(row.lines.reduce((sum, l) => sum + Number(l.variance || 0), 0) * 100) / 100
      : undefined,
  }))
})

function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '—'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

async function generate() {
  loading.value = true
  try {
    const params = {}
    if (type.value === 'closing-stock') params.as_of = to.value || from.value
    else {
      params.from = from.value
      params.to = to.value
    }
    const res = await reportApi.inventoryReport(type.value, params)
    data.value = res.data
  } catch {
    data.value = { [cfg.value.rows]: [], totals: {} }
  } finally {
    loading.value = false
  }
}

function printReport() { window.print() }

// Sidebar submenu links arrive as ?view=<report-key>; preselect that report.
watch(() => route.query.view, (view) => {
  if (view && REPORT_CONFIG[view]) {
    type.value = view
    generate()
  }
}, { immediate: true })

onMounted(() => {
  if (!route.query.view) generate()
})
</script>

<style scoped>
.report-print-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.report-print-head h2 { margin: 0; font-size: 17px; color: var(--sm-blue-dark, #00468c); }
.totals-label { font-weight: 700; text-align: right; }
.totals-value { font-weight: 700; }
</style>

<style>
/* Print: keep only the report table, drop the sidebar/topbar/toolbar. */
@media print {
  body * { visibility: hidden; }
  #sm-report-print, #sm-report-print * { visibility: visible; }
  #sm-report-print {
    position: absolute;
    inset: 0;
    width: 100%;
  }
  .sm-toolbar, .sm-topbar, .sm-sidebar, .alert, .sm-backdrop { display: none !important; }
  #sm-report-print .panel { border: none; box-shadow: none; }
  @page { size: A4 landscape; margin: 10mm; }
}
</style>