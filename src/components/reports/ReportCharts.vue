<!--
  ReportCharts — visual summaries for the wired report tables.

  The report browser renders every report through one generic engine
  (columns + rows), so a report has no idea what its numbers mean. This
  component reads the same payload, works out which columns are worth
  plotting, and draws a bar chart per metric without any charting
  dependency — the same hand-rolled approach the room tape chart uses.

  Rules it obeys:
  * band rows (category / subcategory / grand total) are never charted as
    if they were line items — they would double-count the figures;
  * a metric is only offered when at least one real row carries a finite
    number for it, so a text-only report renders nothing at all;
  * money is formatted with the report's own currency formatter.
-->
<template>
  <section v-if="metrics.length" class="rbc" :aria-label="$t('reportBrowser.charts')">
    <div class="rbc-head">
      <h3 class="rbc-title">
        <i class="fas fa-chart-bar" aria-hidden="true"></i>
        {{ $t('reportBrowser.charts') }}
      </h3>

      <div v-if="metrics.length > 1" class="rbc-metrics" role="tablist">
        <button
          v-for="m in metrics"
          :key="m.key"
          type="button"
          role="tab"
          class="rbc-chip"
          :class="{ active: m.key === activeKey }"
          :aria-selected="m.key === activeKey"
          @click="activeKey = m.key"
        >
          {{ columnLabel(m.key, m.label) }}
        </button>
      </div>
    </div>

    <div class="rbc-summary">
      <span class="rbc-total-value">{{ formatValue(activeTotal, activeFormat) }}</span>
      <span class="rbc-total-label">
        {{ $t('reportBrowser.chartTotal', { label: columnLabel(activeKey, activeLabel) }) }}
      </span>
    </div>

    <ul v-if="bars.length" class="rbc-bars">
      <li v-for="b in bars" :key="b.key" class="rbc-row">
        <span class="rbc-name" :title="b.label">{{ b.label }}</span>
        <span class="rbc-track">
          <span
            class="rbc-fill"
            :class="{ pct: activeFormat === 'pct' }"
            :style="{ width: `${b.pct}%` }"
          ></span>
        </span>
        <span class="rbc-val">{{ formatValue(b.value, activeFormat) }}</span>
      </li>
    </ul>

    <p v-else class="rbc-empty">{{ $t('reportBrowser.chartNoData') }}</p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  // How many bars to draw before the tail is folded away.
  limit: { type: Number, default: 12 },
  // Currency formatter supplied by the page, so the chart matches the table's
  // money format exactly instead of inventing a second one.
  formatMoney: { type: Function, default: null },
})

const { t } = useI18n()

/** Column keys that read as a row's identity rather than a measurement. */
const LABEL_HINTS = [
  'item', 'date', 'time', 'day', 'name', 'category', 'department', 'account',
  'user', 'staff', 'type', 'shift', 'terminal', 'table', 'room', 'guest',
  'supplier', 'reason', 'payment', 'method', 'order_number', 'invoice',
]

/** Measurement keys worth plotting first, in priority order. */
const METRIC_HINTS = [
  'amount', 'total_amount', 'final_total', 'net_amount', 'gross', 'revenue',
  'sales', 'value', 'cost', 'price', 'quantity', 'qty', 'count', 'margin',
]

const num = (v) => {
  if (v === null || v === undefined || v === '' || Array.isArray(v)) return null
  if (typeof v === 'boolean') return null
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]/g, '')
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Only real line items — band rows would double-count the totals. */
const lineRows = computed(() => (props.rows || []).filter((r) => r && !r.band))

const labelKey = computed(() => {
  const cols = props.columns || []
  const keys = cols.map((c) => String(c.key || '').toLowerCase())
  const hinted = keys.findIndex((k) => LABEL_HINTS.some((h) => k === h || k.includes(h)))
  return cols[hinted > -1 ? hinted : 0]?.key ?? null
})

const metrics = computed(() => {
  const rows = lineRows.value
  if (!rows.length) return []

  const usable = (props.columns || []).filter((col) => {
    const key = col?.key
    if (!key || key === labelKey.value) return false
    return rows.some((r) => num(r[key]) !== null)
  })
  if (!usable.length) return []

  const rank = (c) => {
    const k = String(c.key).toLowerCase()
    const i = METRIC_HINTS.findIndex((h) => k === h || k.includes(h))
    return i === -1 ? METRIC_HINTS.length : i
  }
  return usable
    .map((c) => ({ key: c.key, label: c.label, format: c.format }))
    .sort((a, b) => rank(a) - rank(b))
})

const activeKey = ref(null)
watch(
  metrics,
  (list) => {
    if (!list.length) {
      activeKey.value = null
      return
    }
    // Keep the current choice when it survives, otherwise fall to the best metric.
    if (!list.some((m) => m.key === activeKey.value)) activeKey.value = list[0].key
  },
  { immediate: true },
)

const active = computed(() => metrics.value.find((m) => m.key === activeKey.value) || null)
const activeLabel = computed(() => active.value?.label || '')
const activeFormat = computed(() => active.value?.format || '')

const entries = computed(() => {
  const key = activeKey.value
  if (!key) return []
  return lineRows.value
    .map((r, i) => {
      const value = num(r[key])
      if (value === null) return null
      const raw = r[labelKey.value]
      const label =
        raw === null || raw === undefined || raw === ''
          ? t('reportBrowser.chartUnnamed')
          : Array.isArray(raw)
            ? raw.join(', ')
            : String(raw)
      return { key: `${key}-${i}`, label, value }
    })
    .filter(Boolean)
})

const activeTotal = computed(() => entries.value.reduce((sum, e) => sum + e.value, 0))

const bars = computed(() => {
  const list = [...entries.value].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  const top = list.slice(0, Math.max(1, props.limit))
  const peak = top.reduce((m, e) => Math.max(m, Math.abs(e.value)), 0)
  return top.map((e) => ({ ...e, pct: peak > 0 ? Math.max(2, (Math.abs(e.value) / peak) * 100) : 0 }))
})

function columnLabel(key, fallback) {
  const k = String(key || '').replace(/-/g, '_')
  if (t(`posReports.columns.${k}`) !== `posReports.columns.${k}`) return t(`posReports.columns.${k}`)
  if (t(`posReports.${k}`) !== `posReports.${k}`) return t(`posReports.${k}`)
  return fallback || key
}

function formatValue(value, format) {
  if (format === 'money') {
    return props.formatMoney ? props.formatMoney(Number(value) || 0) : String(Number(value) || 0)
  }
  if (format === 'pct') return `${Number(value) || 0}%`
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(value) || 0)
}
</script>

<style scoped>
.rbc {
  background: #f7fafd;
  border: 1px solid #e6ebf2;
  border-radius: 8px;
  padding: 14px 16px 16px;
  margin-bottom: 16px;
}
.rbc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.rbc-title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--mrk-dark, #062a52);
}
.rbc-metrics {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.rbc-chip {
  border: 1px solid #d7e0ec;
  background: #fff;
  color: #475569;
  border-radius: 999px;
  padding: 4px 11px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  text-transform: capitalize;
}
.rbc-chip:hover { border-color: #9db4d0; }
.rbc-chip.active {
  background: var(--mrk-dark, #062a52);
  border-color: var(--mrk-dark, #062a52);
  color: #fff;
}
.rbc-summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 12px 0 10px;
}
.rbc-total-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--mrk-dark, #062a52);
}
.rbc-total-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.rbc-bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rbc-row {
  display: grid;
  grid-template-columns: minmax(90px, 22%) 1fr auto;
  align-items: center;
  gap: 10px;
}
.rbc-name {
  font-size: 12px;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rbc-track {
  background: #e8eef6;
  border-radius: 999px;
  height: 14px;
  overflow: hidden;
}
.rbc-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #1d4ed8, #3b82f6);
}
.rbc-fill.pct { background: linear-gradient(90deg, #047857, #10b981); }
.rbc-val {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
}
.rbc-empty {
  margin: 8px 0 0;
  font-size: 12px;
  color: #64748b;
}
/* Charts are a screen affordance — the printed sheet carries the table only. */
@media print {
  .rbc { display: none !important; }
}
</style>
