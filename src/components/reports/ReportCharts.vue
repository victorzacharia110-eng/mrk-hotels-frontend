<!--
  ReportCharts — visual summaries for the wired report tables.

  The report browser renders every report through one generic engine
  (columns + rows), so a report has no idea what its numbers mean. This
  component reads the same payload, works out which columns are worth
  plotting, and draws them with Chart.js.

  Chart.js is registered controller by controller rather than wholesale,
  so the bundle only carries the bar and line pieces actually used here.

  The maths lives in ./reportChartData.js so it can be tested without a
  canvas; this file is only the drawing.
-->
<template>
  <section v-if="metrics.length" class="rbc" :aria-label="$t('reportBrowser.charts')">
    <div class="rbc-head">
      <h3 class="rbc-title">
        <i class="fas fa-chart-bar" aria-hidden="true"></i>
        {{ $t('reportBrowser.charts') }}
      </h3>

      <div class="rbc-controls">
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

        <div class="rbc-types" role="group" :aria-label="$t('reportBrowser.chartStyle')">
          <button
            v-for="opt in TYPE_OPTIONS"
            :key="opt.value"
            type="button"
            class="rbc-chip"
            :class="{ active: chartType === opt.value }"
            :aria-pressed="chartType === opt.value"
            @click="chartType = opt.value"
          >
            <i :class="opt.icon" aria-hidden="true"></i>
            {{ $t(opt.label) }}
          </button>
        </div>
      </div>
    </div>

    <div class="rbc-summary">
      <span class="rbc-total-value">{{ formatValue(activeTotal, activeFormat) }}</span>
      <span class="rbc-total-label">
        {{ $t('reportBrowser.chartTotal', { label: columnLabel(activeKey, activeLabel) }) }}
      </span>
    </div>

    <div class="rbc-canvas">
      <component :is="chartComponent" :data="chartData" :options="chartOptions" />
    </div>

    <!--
      The canvas is opaque to assistive tech and to anyone whose browser
      cannot draw it, so the same figures are published as a table.
    -->
    <details class="rbc-figures">
      <summary>{{ $t('reportBrowser.chartFigures') }}</summary>
      <table class="rbc-table">
        <thead>
          <tr>
            <th scope="col">{{ $t('reportBrowser.chartLabel') }}</th>
            <th scope="col">{{ columnLabel(activeKey, activeLabel) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in points" :key="e.key">
            <th scope="row">{{ e.label }}</th>
            <td>{{ formatValue(e.value, activeFormat) }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line } from 'vue-chartjs'

import { buildEntries, pickLabelKey, pickMetrics, shapeEntries, suggestType } from './reportChartData'

ChartJS.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
)

const props = defineProps({
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  // How many points to draw before the tail is folded away.
  limit: { type: Number, default: 12 },
  // Currency formatter supplied by the page, so the chart matches the table's
  // money format exactly instead of inventing a second one.
  formatMoney: { type: Function, default: null },
})

const { t } = useI18n()

const TYPE_OPTIONS = [
  { value: 'bar', icon: 'fas fa-chart-column', label: 'reportBrowser.chartBar' },
  { value: 'line', icon: 'fas fa-chart-line', label: 'reportBrowser.chartLine' },
]

const BLUE = '#1d4e89'
const BLUE_SOFT = 'rgba(29, 78, 137, 0.18)'

const labelKey = computed(() => pickLabelKey(props.columns))
const metrics = computed(() => pickMetrics(props.columns, props.rows, labelKey.value))

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

/** A date or time axis is a series over time, so it opens as a line. */
const chartType = ref(suggestType(labelKey.value))
watch(labelKey, (k) => { chartType.value = suggestType(k) })

const chartComponent = computed(() => (chartType.value === 'line' ? Line : Bar))

/** Everything plotted, in report order — the table below the chart shows this. */
const entries = computed(() =>
  buildEntries({
    rows: props.rows,
    labelKey: labelKey.value,
    activeKey: activeKey.value,
    unnamedLabel: t('reportBrowser.chartUnnamed'),
  }),
)

const activeTotal = computed(() => entries.value.reduce((sum, e) => sum + e.value, 0))

// A line has to keep the order the report gave it, or the trend it exists to
// show turns into a zigzag. Bars read by magnitude, so those get sorted.
const points = computed(() =>
  shapeEntries(entries.value, props.limit, { sort: chartType.value !== 'line' }),
)

const chartData = computed(() => ({
  labels: points.value.map((p) => p.label),
  datasets: [
    {
      label: columnLabel(activeKey.value, activeLabel.value),
      data: points.value.map((p) => p.value),
      backgroundColor: chartType.value === 'line' ? BLUE_SOFT : BLUE,
      borderColor: BLUE,
      borderWidth: chartType.value === 'line' ? 2 : 0,
      borderRadius: chartType.value === 'line' ? 0 : 3,
      pointRadius: chartType.value === 'line' ? 3 : 0,
      pointBackgroundColor: BLUE,
      fill: false,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  // Bars are horizontal so a long item name stays readable.
  indexAxis: chartType.value === 'line' ? 'x' : 'y',
  animation: { duration: 0 },
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.dataset.label}: ${formatValue(ctx.parsed.y ?? ctx.parsed.x, activeFormat.value)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: '#e6ebf2' },
      ticks: { callback: (v) => formatValue(v, activeFormat.value), maxTicksLimit: 8 },
    },
    y: {
      grid: { display: chartType.value !== 'line' },
      ticks: { autoSkip: false },
    },
  },
}))

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
.rbc-controls {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.rbc-metrics,
.rbc-types {
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
  display: inline-flex;
  align-items: center;
  gap: 5px;
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
  margin: 12px 0 6px;
}
.rbc-total-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--mrk-dark, #062a52);
}
.rbc-total-label {
  font-size: 12px;
  color: #64748b;
}
.rbc-canvas {
  position: relative;
  height: 260px;
}
.rbc-figures {
  margin-top: 10px;
  font-size: 12px;
  color: #475569;
}
.rbc-figures summary { cursor: pointer; }
.rbc-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}
.rbc-table th,
.rbc-table td {
  border-bottom: 1px solid #e6ebf2;
  padding: 5px 8px;
  text-align: left;
  font-weight: 500;
}
.rbc-table td { text-align: right; }
@media print { .rbc-types { display: none; } }
</style>
