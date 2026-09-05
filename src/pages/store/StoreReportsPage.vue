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
      <select v-model="departmentId" class="sm-select">
        <option :value="null">{{ $t('storeManager.inventory.allDepartments') }}</option>
        <option v-for="d in departments" :key="d.department_id" :value="d.department_id">{{ d.name }}</option>
      </select>
      <select v-model="category" class="sm-select">
        <option :value="null">{{ $t('storeManager.reports.allOutlets') }}</option>
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ categoryLabel(c) }}</option>
      </select>
      <button class="sm-btn" @click="generate"><i class="fas fa-chart-line"></i> {{ $t('storeManager.reports.generate') }}</button>
      <button v-if="data" class="sm-btn ghost" @click="openReportWindow"><i class="fas fa-window-restore"></i> {{ $t('storeManager.reports.openWindow') }}</button>
      <button v-if="data" class="sm-btn ghost" @click="printReport"><i class="fas fa-print"></i> {{ $t('common.print') }}</button>
      <button v-if="data && isThermalReport" class="sm-btn ghost" @click="printToMachine" title="Print to the connected receipt/printer machine">
        <i class="fas fa-print"></i> {{ $t('storeManager.reports.printMachine') }}
      </button>
    </div>

    <section v-if="loading" class="panel"><div class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div></section>

    <div v-if="data" id="sm-report-print" class="sm-report-print">
      <header class="report-print-head">
        <div class="report-brand">
          <img v-if="logoUrl" :src="logoUrl" class="report-logo" alt="" />
          <h2>{{ hotelName }}</h2>
        </div>
        <h3 class="report-title">{{ $t(REPORT_CONFIG[type].labelKey) }}</h3>
        <span v-if="type === 'closing-stock'" class="report-period">{{ $t('storeManager.reports.asOf') }}: {{ to || from }}</span>
        <span v-else class="report-period">{{ from || '—' }} → {{ to || '—' }}</span>
      </header>

      <section class="panel">
        <div class="table-scroll">
        <table class="sm-table ezee-table" v-if="rows.length">
          <thead>
            <tr><th v-for="col in cols" :key="col.field">{{ col.label }}</th></tr>
          </thead>
          <tbody>
            <template v-for="(group, gi) in groupedRows" :key="gi">
              <tr v-if="group.title" class="ezee-group-row">
                <td :colspan="cols.length"><strong>{{ group.title }}</strong></td>
              </tr>
              <tr v-for="(r, i) in group.rows" :key="i">
                <td v-for="col in cols" :key="col.field">
                  <template v-if="col.money || col.num">{{ fmtNum(r[col.field]) }}</template>
                  <template v-else>{{ r[col.field] ?? '—' }}</template>
                </td>
              </tr>
            </template>
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

      <footer class="report-print-foot">
        {{ $t('storeManager.reports.printedBy') }}: {{ userName }} · {{ printedAt }}
      </footer>
    </div>

    <section v-else-if="!loading" class="panel"><p class="empty">{{ $t('storeManager.reports.pick') }}</p></section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { reportApi, hotelSettingsApi, inventoryOpsApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { printToPrinter, restorePrinter, buildReportLines } from '@/utils/printer'

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()

const hotelName = computed(() => authStore.user?.tenant?.hotel_name || 'MRK Hotels')
const userName = computed(() => authStore.user?.name || authStore.user?.full_name || '—')
const logoUrl = ref('')

const REPORT_CONFIG = {
  'ledger-summary': {
    labelKey: 'storeManager.reports.stockLedger',
    rows: 'items',
    cols: [
      { field: 'item_name', label: 'Item' },
      { field: 'unit', label: 'Unit' },
      { field: 'department', label: 'Department' },
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
      { field: 'category', label: 'Outlet' },
      { field: 'department', label: 'Department' },
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
  'stock-adjustment-report': {
    labelKey: 'storeManager.reports.stockAdjustment',
    rows: 'items',
    cols: [
      { field: 'date', label: 'Date' },
      { field: 'item_name', label: 'Item' },
      { field: 'category', label: 'Outlet' },
      { field: 'department', label: 'Department' },
      { field: 'quantity', label: 'Qty', num: true },
      { field: 'direction', label: 'Direction' },
      { field: 'unit_cost', label: 'Unit cost (TZS)', num: true, money: true },
      { field: 'value', label: 'Value (TZS)', num: true, money: true },
      { field: 'recorded_by', label: 'Recorded by' },
    ],
    totals: ['value'],
  },
}

const from = ref(new Date().toISOString().slice(0, 10))
const to = ref(new Date().toISOString().slice(0, 10))
const type = ref('ledger-summary')
const data = ref(null)
const loading = ref(false)

// Report filters: department (inventory scope) and category/outlet.
const departments = ref([])
const departmentId = ref(null)
const category = ref(null)

const CATEGORIES = ['bar', 'restaurant', 'food', 'beverage', 'housekeeping', 'maintenance', 'procurement', 'other']
function categoryLabel(c) {
  return c.charAt(0).toUpperCase() + c.slice(1)
}

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

// Reports that carry a category column (e.g. closing-stock) are split into
// Ezee-style group headers by category, with a final ungrouped total row.
const groupBy = computed(() => (cfg.value?.group ?? '') || cols.value.some((c) => c.field === 'category') ? 'category' : '')
const groupedRows = computed(() => {
  const all = rows.value
  if (!groupBy.value) return [{ title: '', rows: all }]
  const groups = {}
  for (const r of all) {
    const key = r[groupBy.value] || '—'
    ;(groups[key] = groups[key] || []).push(r)
  }
  const out = []
  for (const [title, gr] of Object.entries(groups)) {
    out.push({ title, rows: gr })
  }
  return out
})

// Timestamp captured each time a report is generated, shown in the footer.
const printedAt = new Date().toLocaleString()

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
    if (departmentId.value) params.department_id = departmentId.value
    if (category.value) params.category = category.value
    const res = await reportApi.inventoryReport(type.value, params)
    data.value = res.data
  } catch {
    data.value = { [cfg.value.rows]: [], totals: {} }
  } finally {
    loading.value = false
  }
}

function printReport() { window.print() }

/** Opens the current report in a second window, Ezee-style, ready to print. */
function openReportWindow() {
  if (!data.value) return
  const win = window.open('', '_blank')
  if (!win) return
  win.document.open()
  win.document.write(buildReportHtml())
  win.document.close()
}

/** Escapes text so report data can't break the standalone HTML window. */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Renders the loaded report as a standalone printable HTML page. */
function buildReportHtml() {
  const title = t(cfg.value.labelKey)
  const period = type.value === 'closing-stock'
    ? `${t('storeManager.reports.asOf')}: ${to.value || from.value}`
    : `${from.value || '—'} → ${to.value || '—'}`
  const stamp = new Date().toLocaleString()
  const logo = logoUrl.value ? `<img class="rpt-logo" src="${esc(logoUrl.value)}" alt="" />` : ''

  const thead = cols.value
    .map((c) => `<th class="${c.num || c.money ? 'num' : ''}">${esc(c.label)}</th>`)
    .join('')

  const tbody = groupedRows.value
    .map((group) => {
      const rowsHtml = group.rows
        .map(
          (r) => `<tr>${cols.value
            .map((c) => {
              const cls = c.num || c.money ? ' class="num"' : ''
              const val = c.num || c.money ? fmtNum(r[c.field]) : r[c.field] ?? '—'
              return `<td${cls}>${esc(val)}</td>`
            })
            .join('')}</tr>`,
        )
        .join('')
      const head = group.title
        ? `<tr class="cat"><td colspan="${cols.value.length}">${esc(group.title.toUpperCase())}</td></tr>`
        : ''
      return head + rowsHtml
    })
    .join('')

  const tfoot = totals.value.length
    ? `<tr class="totals"><td colspan="${cols.value.length - totals.value.length}">${esc(t('inventory.totals'))}</td>${totals.value
        .map((key) => `<td class="num">${esc(fmtNum(data.value.totals?.[key]))}</td>`)
        .join('')}</tr>`
    : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; margin: 0; }
  .rpt-bar { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 12px; background: #eef1f6; }
  .rpt-bar button { border: 1px solid #0b1f33; background: #0b1f33; color: #fff; border-radius: 5px; padding: 8px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
  .rpt-bar button:hover { background: #00468c; }
  .rpt-head { text-align: center; margin: 10px 0 2px; }
  .rpt-brand { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .rpt-logo { height: 42px; max-width: 160px; object-fit: contain; }
  .rpt-hotel { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
  .rpt-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #00468c; margin-top: 2px; }
  .rpt-period { font-size: 11px; color: #444; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #999; padding: 5px 8px; text-align: left; }
  th { background: #0b1f33; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
  td.num, th.num { text-align: right; }
  tr.cat td { background: #e6eee6; font-weight: 700; letter-spacing: .05em; }
  tr.totals td { font-weight: 700; background: #f0f0f0; }
  .rpt-foot { margin-top: 12px; font-size: 11px; color: #444; }
</style></head><body>
  <div class="rpt-bar"><button onclick="window.print()">${esc(t('common.print'))}</button></div>
  <div class="rpt-head">
    <div class="rpt-brand">${logo}<span class="rpt-hotel">${esc(hotelName.value)}</span></div>
    <div class="rpt-title">${esc(title)}</div>
    <div class="rpt-period">${esc(period)}</div>
  </div>
  <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody>${tfoot}</table>
  <div class="rpt-foot">${esc(t('storeManager.reports.printedBy'))}: ${esc(userName.value)} · ${esc(stamp)}</div>
 <script>window.onload = function () { setTimeout(function () { window.print() }, 350) }</${'script'}>
</body></html>`
}

// Small reports that fit a 58/80mm thermal roll and print to the till machine.
const THERMAL_TYPES = ['transfer-register', 'movement-detail', 'stock-adjustment-report', 'goods-return-register']
const isThermalReport = computed(() => THERMAL_TYPES.includes(type.value))

// Build the narrow thermal lines for the current small report.
function buildThermalLines() {
  const rows = data.value?.[cfg.value.rows] || []
  const title = t(cfg.value.labelKey)
  const period = type.value === 'closing-stock'
    ? `${t('storeManager.reports.asOf')}: ${to.value || from.value}`
    : `${from.value || '—'} → ${to.value || '—'}`
  const report = { hotel: hotelName.value, title, period, printedBy: `${t('storeManager.reports.printedBy')}: ${userName.value}`, rows: [] }
  const money = (v) => (v == null || v === '' ? '' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }))

  for (const r of rows) {
    switch (type.value) {
      case 'transfer-register':
        report.rows.push({ label: r.transfer_number, right: r.status }, { label: ` ${r.date}  ${r.from_department} → ${r.to_department}` })
        break
      case 'movement-detail':
        report.rows.push({ label: r.date, right: r.direction }, { label: ` ${r.item_name}  (${r.transaction})`, right: money(r.quantity) }, { label: `  Bal ${money(r.balance_after)}  ·  ${money(r.value)}` })
        break
      case 'stock-adjustment-report':
        report.rows.push({ label: r.date, right: r.direction }, { label: ` ${r.item_name}  (${r.category}/${r.department})`, right: money(r.quantity) }, { label: `  ${money(r.quantity) || ''} × ${money(r.unit_cost)} = ${money(r.value)}` })
        break
      case 'goods-return-register':
        report.rows.push({ label: r.return_number, right: r.status }, { label: ` ${r.date}  ${r.reason}`, right: money(r.quantity) }, { label: `  Value: ${money(r.value)}` })
        break
    }
    report.rows.push({ separator: true })
  }

  if ((data.value?.totals?.value ?? data.value?.totals?.quantity) !== undefined) {
    report.rows.push({ label: 'TOTAL', right: money(data.value.totals.value ?? data.value.totals.quantity), bold: true })
  }
  return report
}

async function printToMachine() {
  const sent = await printToPrinter(buildReportLines(buildThermalLines()), { logo: logoUrl.value })
  if (!sent) printReport()
}

// Load the inventory departments available for filtering and the hotel logo.
async function loadReportData() {
  try {
    const [dRes] = await Promise.allSettled([inventoryOpsApi.departments()])
    if (dRes.status === 'fulfilled') {
      departments.value = dRes.value?.data?.departments || []
    }
  } catch {
    departments.value = []
  }
  await loadLogo()
}

async function loadLogo() {
  try {
    const res = await hotelSettingsApi.show()
    logoUrl.value = res?.data?.hotel?.logo_url || ''
  } catch {
    logoUrl.value = ''
  }
}

onMounted(() => {
  loadReportData()
  restorePrinter()
  if (!route.query.view) generate()
})

// Sidebar submenu links arrive as ?view=<report-key>; preselect that report.
watch(() => route.query.view, (view) => {
  if (view && REPORT_CONFIG[view]) {
    type.value = view
    generate()
  }
}, { immediate: true })
</script>

<style scoped>
.report-print-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-bottom: 14px;
  text-align: center;
}
.report-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.report-logo {
  height: 40px;
  max-width: 160px;
  object-fit: contain;
}
.report-brand h2 {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #0b1f33;
}
.report-title {
  margin: 0;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #00468c;
}
.report-period {
  font-size: 12px;
  color: #555;
}
.totals-label { font-weight: 700; text-align: right; }
.totals-value { font-weight: 700; }

/* Ezee-style report table: vertically ruled columns with a line between
   every row and a bold category group header row. */
.ezee-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ezee-table th {
  border: 1px solid #222;
  background: #0b1f33;
  color: #fff;
  padding: 6px 8px;
  text-align: left;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.ezee-table td {
  border: 1px solid #999;
  padding: 5px 8px;
}
.ezee-table tbody tr:not(.ezee-group-row) {
  border-bottom: 1px solid #666;
}
.ezee-table .ezee-group-row td {
  border: 1px solid #222;
  background: #e6eee6;
}
.ezee-table .ezee-group-row strong {
  text-transform: uppercase;
  font-size: 12px;
}
.ezee-table tfoot td {
  border: 1px solid #222;
  font-weight: 700;
  background: #f0f0f0;
}
.report-print-foot {
  margin-top: 14px;
  font-size: 12px;
  color: #555;
}
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