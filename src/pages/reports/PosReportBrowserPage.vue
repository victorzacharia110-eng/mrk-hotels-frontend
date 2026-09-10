<!--
  PosReportBrowserPage — the IPOS-style Food & Beverage Report Browser.

  Recreates the client's reference layout (WhatsApp screenshot, Sept 2026):
  a left tree grouped under "Recommended Reports" with the ten F&B report
  types, and a right content area showing Mandatory Fields (dates + outlet),
  Filter Options (Business Source + Sub Category), a custom-report builder
  (pick a source, trim its columns) and the generic wired-engine renderer.

  Every report maps to a live backend builder under GET /reports/wired/{key}.
-->
<template>
  <ReportBrowserLayout
    :categories="categories"
    :active="activeReport"
    :title="$t('posReports.title')"
    :subtitle="windowLabel"
    :exporting="exporting"
    @select="selectReport"
    @print="printReport"
    @export="exportTable"
  >
    <template #toolbar>
      <div class="posr-toolbar">
        <div class="posr-block">
          <div class="posr-block-title">
            <i class="fas fa-key" aria-hidden="true"></i> {{ $t('posReports.mandatoryFields') }}
          </div>
          <div class="posr-grid">
            <label class="posr-field">
              <span>{{ $t('posReports.fromDate') }}</span>
              <input v-model="filterValues.from" type="date" class="rb-input" />
            </label>
            <label class="posr-field">
              <span>{{ $t('posReports.toDate') }}</span>
              <input v-model="filterValues.to" type="date" class="rb-input" />
            </label>
            <label class="posr-field">
              <span>{{ $t('posReports.outlet') }}</span>
              <select v-model="filterValues.outlet_id" class="rb-input rb-select" :disabled="outletsLoading">
                <option value="">{{ $t('posReports.all') }}</option>
                <option v-for="o in outlets" :key="o.outlet_id" :value="String(o.outlet_id)">{{ o.outlet_name }}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="posr-block">
          <div class="posr-block-title">
            <i class="fas fa-sliders" aria-hidden="true"></i> {{ $t('posReports.filterOptions') }}
          </div>
          <div class="posr-grid">
            <label class="posr-field">
              <span>{{ $t('posReports.businessSource') }}</span>
              <select v-model="filterValues.business_source" class="rb-input rb-select">
                <option value="">{{ $t('posReports.all') }}</option>
                <option v-for="(label, value) in businessSources" :key="value" :value="value">{{ label }}</option>
              </select>
            </label>
            <label class="posr-field">
              <span>{{ $t('posReports.subCategory') }}</span>
              <select v-model="filterValues.sub_category" class="rb-input rb-select" :disabled="!subCategoryOptions.length">
                <option value="">{{ $t('posReports.all') }}</option>
                <option v-for="c in subCategoryOptions" :key="c" :value="c">{{ c }}</option>
              </select>
            </label>
          </div>
        </div>

        <div class="posr-run">
          <button type="button" class="rb-btn rb-btn-primary" :disabled="loading || (activeReport === 'custom' && !customSource)" @click="run">
            <i v-if="loading" class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            <i v-else class="fas fa-play" aria-hidden="true"></i>
            {{ $t('posReports.run') }}
          </button>
        </div>
      </div>
    </template>

    <!-- ── Custom Report builder (pick a source, trim its columns) ── -->
    <div v-if="activeReport === 'custom'" class="posr-builder">
      <div class="posr-block-title">
        <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> {{ $t('posReports.customBuilder') }}
      </div>
      <div class="posr-builder-row">
        <label class="posr-field posr-source">
          <span>{{ $t('posReports.dataSource') }}</span>
          <select v-model="customSource" class="rb-input rb-select" :disabled="loading">
            <option value="" disabled>{{ $t('posReports.chooseSource') }}</option>
            <option v-for="s in customSources" :key="s.key" :value="s.key">{{ $t(s.label) }}</option>
          </select>
        </label>
        <div v-if="engine?.columns?.length" class="posr-cols">
          <span class="posr-col-caption">
            <i class="fas fa-table-columns" aria-hidden="true"></i> {{ $t('posReports.columns') }}
          </span>
          <label v-for="col in engine.columns" :key="col.key" class="posr-col">
            <input type="checkbox" :checked="customCols.includes(col.key)" @change="toggleColumn(col.key)" />
            {{ columnLabel(col.key, col.label) }}
          </label>
        </div>
      </div>
    </div>

    <!-- ── Generic wired engine output for every report type ── -->
    <div v-if="loading" class="rb-loading">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> {{ $t('reportBrowser.loading') }}
    </div>
    <div v-else-if="error" class="rb-error">{{ error }}</div>

    <template v-else>
      <div class="rb-report-card">
        <div class="rb-report-head">
          <h2>{{ activeLabel }}</h2>
        </div>

        <p v-if="engine?.legend" class="rb-legend">
          <i class="fas fa-circle-info" aria-hidden="true"></i> {{ engine.legend }}
        </p>

        <div v-if="engine?.summary?.length" class="rb-kpi-grid">
          <div v-for="(kpi, i) in engine.summary" :key="i" class="rb-kpi">
            <span class="rb-kpi-value">{{ summaryValue(kpi.value) }}</span>
            <span class="rb-kpi-label">{{ columnLabel(kpi.label, kpi.label) }}</span>
          </div>
        </div>

        <template v-if="engine?.wired !== false">
          <div v-if="engine?.columns?.length" class="table-scroll">
            <table class="rb-table rb-table-wide">
              <thead>
                <tr>
                  <th v-for="col in engine.columns" :key="col.key">{{ columnLabel(col.key, col.label) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in engine.rows" :key="i">
                  <td
                    v-for="col in engine.columns"
                    :key="col.key"
                    :class="{ num: col.format === 'money' || col.format === 'pct' }"
                  >
                    {{ formatCell(row[col.key], col.format) }}
                  </td>
                </tr>
                <tr v-if="!engine.rows.length">
                  <td :colspan="engine.columns.length" class="rb-empty">{{ $t('reportBrowser.noRows') }}</td>
                </tr>
              </tbody>
              <tfoot v-if="engine.totals?.length">
                <tr>
                  <td v-for="col in engine.columns" :key="col.key">
                    <template v-if="totalFor(col.key, col.format)">
                      <span v-if="totalFor(col.key, col.format).label" class="rb-total-label">
                        {{ totalFor(col.key, col.format).label }}:
                      </span>
                      <strong>{{ totalFor(col.key, col.format).value }}</strong>
                    </template>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </template>

        <div v-else class="rb-empty">
          <i class="fas fa-info-circle" aria-hidden="true"></i> {{ engine.legend || $t('posReports.noDataYet') }}
        </div>
      </div>
    </template>
  </ReportBrowserLayout>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ReportBrowserLayout from '@/components/reports/ReportBrowserLayout.vue'
import { reportApi, outletApi } from '@/api'
import { exportCSV } from '@/utils/export'

const { t, te } = useI18n()

const ACTIVE_REPORTS = [
  { key: 'custom', label: 'posReports.custom' },
  { key: 'menu-item-sales', label: 'posReports.menuItemSales' },
  { key: 'sales', label: 'posReports.sales' },
  { key: 'no-charge', label: 'posReports.noCharge' },
  { key: 'back-office', label: 'posReports.backOffice' },
  { key: 'statistical', label: 'posReports.statistical' },
  { key: 'inventory', label: 'posReports.inventory' },
  { key: 'stock', label: 'posReports.stock' },
  { key: 'audit', label: 'posReports.audit' },
  { key: 'user-terminal', label: 'posReports.userTerminal' },
]

const REPORT_ICONS = [
  'fas fa-wand-magic-sparkles',
  'fas fa-burger',
  'fas fa-cash-register',
  'fas fa-shirt',
  'fas fa-briefcase',
  'fas fa-chart-column',
  'fas fa-boxes-stacked',
  'fas fa-warehouse',
  'fas fa-file-pen',
  'fas fa-desktop',
]

const categories = [
  {
    key: 'recommended',
    label: 'posReports.recommendedGroup',
    icon: 'fas fa-bolt',
    reports: ACTIVE_REPORTS.map((r, i) => ({ ...r, icon: REPORT_ICONS[i] })),
  },
]

const customSources = ACTIVE_REPORTS.filter((r) => r.key !== 'custom')

const activeReport = ref('menu-item-sales')
const customSource = ref('menu-item-sales')
const customCols = ref([])

const engine = ref(null)
const loading = ref(false)
const exporting = ref(false)
const error = ref('')

const outlets = ref([])
const outletsLoading = ref(false)

const filterValues = reactive({
  from: daysAgoIso(30),
  to: todayIso(),
  outlet_id: '',
  business_source: '',
  sub_category: '',
})

const activeLabel = computed(() => {
  const cfg = ACTIVE_REPORTS.find((r) => r.key === activeReport.value)
  return cfg ? t(cfg.label) : ''
})

const windowLabel = computed(() => {
  const from = prettyDate(filterValues.from)
  const to = prettyDate(filterValues.to)
  return `${activeLabel.value} · ${from} → ${to}`
})

const subCategoryOptions = computed(() => {
  const isCategoryReport =
    activeReport.value === 'menu-item-sales' ||
    activeReport.value === 'inventory' ||
    activeReport.value === 'stock'
  if (!isCategoryReport) return []
  return engine.value?.filters?.categories || []
})

const businessSources = computed(() => {
  const orderTypes = {
    dine_in: t('posReports.orderTypes.dine_in'),
    at_bar: t('posReports.orderTypes.at_bar'),
    hotel_menu: t('posReports.orderTypes.hotel_menu'),
    takeaway: t('posReports.orderTypes.takeaway'),
    room_service: t('posReports.orderTypes.room_service'),
    delivery: t('posReports.orderTypes.delivery'),
    no_charge: t('posReports.orderTypes.no_charge'),
  }
  return orderTypes
})

function columnLabel(key, fallback) {
  if (te(`reportColumns.${key}`)) return t(`reportColumns.${key}`)
  if (te(`posReports.columns.${String(key).replace(/-/g, '_')}`)) return t(`posReports.columns.${String(key).replace(/-/g, '_')}`)
  return fallback || String(key).replace(/_/g, ' ')
}

function formatCell(value, format) {
  if (value === null || value === undefined || value === '') return '—'
  if (format === 'money' && typeof value === 'number') return money(value)
  if (format === 'pct') return `${value}%`
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.join(', ') || '—'
  return String(value)
}

function totalFor(key, format) {
  const total = (engine.value?.totals || []).find((t) => t.key === key)
  if (!total) return null
  return { label: total.label || null, value: formatCell(total.value, format) }
}

function summaryValue(value) {
  if (typeof value === 'number' && !Number.isInteger(value)) return money(value)
  return value === null || value === undefined ? '—' : String(value)
}

function toggleColumn(key) {
  if (customCols.value.includes(key)) {
    customCols.value = customCols.value.filter((c) => c !== key)
  } else {
    customCols.value = [...customCols.value, key]
  }
  run()
}

function selectReport(key) {
  activeReport.value = key
  engine.value = null
  error.value = ''
  if (key === 'custom') {
    customSource.value = 'menu-item-sales'
    customCols.value = []
  }
  run()
}

async function run() {
  loading.value = true
  error.value = ''
  engine.value = null
  try {
    const params = {
      from: filterValues.from || undefined,
      to: filterValues.to || undefined,
      outlet_id: filterValues.outlet_id || undefined,
      business_source: filterValues.business_source || undefined,
      category: filterValues.sub_category || undefined,
    }
    const isCustom = activeReport.value === 'custom'
    if (isCustom) {
      params.source = customSource.value
      if (customCols.value.length) params.cols = customCols.value.join(',')
    }
    const res = await reportApi.wired(isCustom ? 'custom' : activeReport.value, params)
    engine.value = res.data.data
    if (isCustom && res.data.data?.columns?.length) {
      customCols.value = res.data.data.columns.map((c) => c.key)
    }
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

function printReport() {
  window.print()
}

async function exportTable() {
  if (!engine.value?.columns?.length) return
  exporting.value = true
  try {
    await new Promise((r) => setTimeout(r, 250))
    exportCSV(activeReport.value, engine.value.rows || [], engine.value.columns || [])
  } finally {
    exporting.value = false
  }
}

async function loadOutlets() {
  outletsLoading.value = true
  try {
    const res = await outletApi.index()
    outlets.value = res.data?.data ?? res.data ?? []
  } catch {
    outlets.value = []
  } finally {
    outletsLoading.value = false
  }
}

watch(activeReport, () => {
  filterValues.sub_category = ''
})

onMounted(() => {
  loadOutlets()
  run()
})

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function prettyDate(iso) {
  if (!iso) return '—'
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y}`
}

const money = (v) => {
  const num = Number(v || 0)
  return `TSh ${num.toLocaleString('en', { maximumFractionDigits: 2 })}`
}
</script>

<style scoped>
/* Reference toolbar: Mandatory Fields + Filter Options cards. */
.posr-toolbar {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.posr-block {
  flex: 1 1 240px;
  background: #fff;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  padding: 12px 14px;
  box-shadow: 0 1px 3px rgba(16, 42, 67, 0.08);
}
.posr-block-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--mrk-blue, #005eb8);
  margin-bottom: 10px;
}
.posr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.posr-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.posr-field > span,
.posr-col-caption {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.posr-run {
  display: flex;
  align-items: flex-end;
  align-self: stretch;
}
/* Custom report builder. */
.posr-builder {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fff;
  border: 1px solid #dbe4ef;
  border-left: 3px solid var(--mrk-blue, #005eb8);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(16, 42, 67, 0.08);
}
.posr-builder-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.posr-source {
  min-width: 220px;
}
.posr-cols {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1 1 260px;
}
.posr-col {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #334155;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 3px 10px;
  cursor: pointer;
  user-select: none;
}
.posr-col input {
  accent-color: var(--mrk-blue, #005eb8);
}
/* Engine output (match the PMS Report Browser paper). */
.rb-report-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.rb-report-head h2 {
  margin: 0;
  font-size: 18px;
  color: var(--mrk-dark, #062a52);
}
.rb-legend {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #f7fafd;
  border: 1px solid #e6ebf2;
  border-left: 3px solid var(--mrk-blue, #005eb8);
  color: #475569;
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 6px;
  margin: 0 0 16px;
}
.rb-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
.rb-kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #f7fafd;
  border: 1px solid #e6ebf2;
  padding: 10px 14px;
  border-radius: 8px;
}
.rb-kpi-value {
  font-size: 17px;
  font-weight: 700;
  color: var(--mrk-dark, #062a52);
}
.rb-kpi-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.rb-loading,
.rb-error,
.rb-empty {
  padding: 24px;
  text-align: center;
  color: #64748b;
}
.rb-error {
  color: #dc2626;
}
.rb-input {
  padding: 7px 10px;
  border: 1px solid #cdd6e2;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  color: #1e293b;
}
.rb-select {
  min-width: 120px;
  cursor: pointer;
}
.rb-btn {
  padding: 7px 14px;
  border: 1px solid var(--mrk-blue, #005eb8);
  background: var(--mrk-blue, #005eb8);
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rb-btn-primary {
  margin-top: 14px;
  align-self: flex-end;
}
.rb-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.rb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.rb-table-wide {
  min-width: 680px;
}
.rb-table th {
  text-align: left;
  padding: 8px 10px;
  background: var(--mrk-pale, #e8f1fa);
  color: var(--mrk-dark, #062a52);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border: 1px solid #dbe4ef;
}
.rb-table td {
  padding: 8px 10px;
  border: 1px solid #e6ebf2;
}
.rb-table .num {
  text-align: right;
}
.rb-total-label {
  font-weight: 600;
  color: #64748b;
}
.rb-table tfoot td {
  font-weight: 700;
  background: #f7fafd;
}
.table-scroll {
  overflow-x: auto;
}
</style>