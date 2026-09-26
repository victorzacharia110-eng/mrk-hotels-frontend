import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/locales/i18n'

// Chart.js needs a real 2D canvas, which jsdom does not provide. The maths is
// tested directly below; here the chart is stubbed so the component's own
// wiring — metric choice, ordering, labels — is what gets exercised.
const ChartStub = {
  name: 'ChartStub',
  props: ['data', 'options'],
  template: '<div class="chart-stub" />',
}
vi.mock('vue-chartjs', () => ({ Bar: ChartStub, Line: ChartStub }))

const ReportCharts = (await import('@/components/reports/ReportCharts.vue')).default
const {
  num,
  lineRows,
  pickLabelKey,
  pickMetrics,
  buildEntries,
  shapeEntries,
  suggestType,
} = await import('@/components/reports/reportChartData')

const money = (v) => `TSh ${Number(v || 0).toLocaleString('en', { maximumFractionDigits: 2 })}`

const COLUMNS = [
  { key: 'item', label: 'Menu Item' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'amount', label: 'Amount', format: 'money' },
]

const mountCharts = (props) => mount(ReportCharts, { props, global: { plugins: [i18n] } })

/*
  Read the chart's live props rather than a value captured at creation: both
  Bar and Line resolve to the same stub here, so Vue reuses one instance
  across a type switch and a `created` hook would only ever fire once.
*/
const lastChart = (wrapper) => wrapper.findComponent(ChartStub).props('data')

describe('reportChartData — working out what is worth plotting', () => {
  it('reads a cell as a number only when it really is one', () => {
    expect(num(4000)).toBe(4000)
    expect(num('4,000')).toBe(4000)
    expect(num('TSh 1,200')).toBe(1200)
    expect(num('—')).toBeNull()
    expect(num(null)).toBeNull()
    expect(num('')).toBeNull()
    expect(num(true)).toBeNull()
    expect(num(['1', '2'])).toBeNull()
  })

  it('never treats band rows as line items', () => {
    const rows = [
      { item: 'Cola', amount: 4000 },
      { item: 'Drinks', band: 'category', amount: 4000 },
      { item: 'Drinks Total', band: 'grandtotal', amount: 4000 },
    ]
    expect(lineRows(rows).map((r) => r.item)).toEqual(['Cola'])
  })

  it('names rows by the first identity-looking column', () => {
    expect(pickLabelKey(COLUMNS)).toBe('item')
    expect(pickLabelKey([{ key: 'ordered_date' }, { key: 'amount' }])).toBe('ordered_date')
    // Nothing that looks like an identity: the first column does.
    expect(pickLabelKey([{ key: 'revenue' }, { key: 'adr' }])).toBe('revenue')
  })

  it('only offers a metric a real row carries a number for', () => {
    const rows = [{ item: 'Cola', quantity: '—', amount: 4000 }]
    const keys = pickMetrics(COLUMNS, rows, 'item').map((m) => m.key)
    expect(keys).toContain('amount')
    // Quantity holds no finite number on any real row, so it is not offered.
    expect(keys).not.toContain('quantity')
  })

  it('offers nothing at all for a text-only report', () => {
    const rows = [{ item: 'Cola', account: 'Staff meal' }]
    expect(pickMetrics([{ key: 'item' }, { key: 'account' }], rows, 'item')).toEqual([])
    expect(pickMetrics(COLUMNS, [], 'item')).toEqual([])
  })

  it('builds one point per row, skipping cells that are not numbers', () => {
    const entries = buildEntries({
      rows: [{ item: 'Cola', amount: 4000 }, { item: 'Water', amount: null }],
      labelKey: 'item',
      activeKey: 'amount',
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ label: 'Cola', value: 4000 })
  })

  it('sorts bars by magnitude but leaves a line in report order', () => {
    const entries = [
      { key: 'a', label: 'Cola', value: 4000 },
      { key: 'b', label: 'Burger', value: 9000 },
    ]
    expect(shapeEntries(entries, 12, { sort: true }).map((e) => e.label)).toEqual(['Burger', 'Cola'])
    // A line keeps the order the report gave it, or the trend becomes a zigzag.
    expect(shapeEntries(entries, 12, { sort: false }).map((e) => e.label)).toEqual(['Cola', 'Burger'])
  })

  it('folds the tail away past the limit', () => {
    const entries = Array.from({ length: 20 }, (_, i) => ({ key: `k${i}`, label: `L${i}`, value: i }))
    expect(shapeEntries(entries, 5)).toHaveLength(5)
  })

  it('reads a date axis as a series over time, and an item as a category', () => {
    expect(suggestType('ordered_date')).toBe('line')
    expect(suggestType('hour')).toBe('line')
    expect(suggestType('item')).toBe('bar')
    expect(suggestType('category')).toBe('bar')
  })
})

describe('ReportCharts — chart over the wired report payload', () => {
  it('plots the rows and totals the chosen metric', () => {
    const wrapper = mountCharts({
      columns: COLUMNS,
      rows: [
        { item: 'Cola', quantity: 4, amount: 4000 },
        { item: 'Burger', quantity: 2, amount: 9000 },
      ],
      formatMoney: money,
    })

    // Bars are ordered by value, biggest first.
    expect(lastChart(wrapper).labels).toEqual(['Burger', 'Cola'])
    expect(lastChart(wrapper).datasets[0].data).toEqual([9000, 4000])

    // Money metric is the default (amount outranks quantity) and is summed.
    expect(wrapper.text()).toContain('TSh 13,000')
    expect(wrapper.text()).toContain('TSh 9,000')
  })

  it('never charts band rows, which would double-count the totals', () => {
    const wrapper = mountCharts({
      columns: COLUMNS,
      rows: [
        { item: 'Cola', quantity: 4, amount: 4000 },
        { item: 'Drinks', band: 'category', amount: 4000 },
        { item: 'Drinks Total', band: 'grandtotal', amount: 4000 },
      ],
      formatMoney: money,
    })

    expect(lastChart(wrapper).labels).toEqual(['Cola'])
    expect(wrapper.text()).toContain('TSh 4,000')
    expect(wrapper.text()).not.toContain('Drinks Total')
  })

  it('switches metric through the chips', async () => {
    const wrapper = mountCharts({
      columns: COLUMNS,
      rows: [{ item: 'Cola', quantity: 4, amount: 4000 }],
      formatMoney: money,
    })

    const chips = wrapper.findAll('.rbc-metrics .rbc-chip')
    expect(chips.length).toBe(2)

    const qty = chips.find((c) => c.text().toLowerCase().includes('quantity'))
    await qty.trigger('click')

    expect(lastChart(wrapper).datasets[0].data).toEqual([4])
    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).not.toContain('TSh')
  })

  it('switches a bar chart to a line, and then keeps report order', async () => {
    const wrapper = mountCharts({
      columns: COLUMNS,
      rows: [
        { item: 'Cola', quantity: 4, amount: 4000 },
        { item: 'Burger', quantity: 2, amount: 9000 },
      ],
      formatMoney: money,
    })
    expect(lastChart(wrapper).labels).toEqual(['Burger', 'Cola'])

    const lineBtn = wrapper.findAll('.rbc-types .rbc-chip').find((b) => b.text().toLowerCase().includes('line'))
    await lineBtn.trigger('click')

    // Order follows the report, not magnitude, once it is a line.
    expect(lastChart(wrapper).labels).toEqual(['Cola', 'Burger'])
  })

  it('publishes the figures as a table, since a canvas is opaque to readers', () => {
    const wrapper = mountCharts({
      columns: COLUMNS,
      rows: [{ item: 'Cola', quantity: 4, amount: 4000 }],
      formatMoney: money,
    })

    expect(wrapper.find('.rbc-figures').exists()).toBe(true)
    expect(wrapper.find('.rbc-table').text()).toContain('Cola')
  })

  it('renders nothing when the report has no plottable numbers', () => {
    const wrapper = mountCharts({
      columns: [{ key: 'item', label: 'Menu Item' }, { key: 'account', label: 'Account' }],
      rows: [{ item: 'Cola', account: 'Staff meal' }],
    })

    expect(wrapper.find('.rbc').exists()).toBe(false)
  })

  it('skips non-numeric cells instead of charting them as zero', () => {
    const wrapper = mountCharts({
      columns: COLUMNS,
      rows: [
        { item: 'Cola', quantity: '—', amount: 4000 },
        { item: 'Water', quantity: null, amount: 1000 },
      ],
      formatMoney: money,
    })

    // Both rows still chart on amount; the junk quantity never becomes a bar.
    expect(lastChart(wrapper).labels).toEqual(['Cola', 'Water'])
    expect(lastChart(wrapper).datasets[0].data).toEqual([4000, 1000])
  })
})

describe('ReportCharts — the Graphs and Charts report shape', () => {
  const TREND_COLUMNS = [
    { key: 'date', label: 'Date' },
    { key: 'revenue', label: 'Total Revenue', format: 'money' },
    { key: 'fnb_sales', label: 'F&B Sales', format: 'money' },
    { key: 'margin_per_day', label: 'F&B Margin / Day', format: 'money' },
  ]

  it('draws a date trend as a line, in the order the report gave it', () => {
    const wrapper = mountCharts({
      columns: TREND_COLUMNS,
      rows: [
        { date: '25 Sep 2026', revenue: 40000, fnb_sales: 20000, margin_per_day: 12000 },
        { date: '26 Sep 2026', revenue: 60000, fnb_sales: 30000, margin_per_day: 18000 },
      ],
      formatMoney: money,
    })

    // A date label is a series over time, so it opens as a line and keeps
    // the report's order rather than being sorted by size.
    const lineBtn = wrapper.findAll('.rbc-types .rbc-chip').find((b) => b.text().toLowerCase().includes('line'))
    expect(lineBtn.classes()).toContain('active')
    expect(lastChart(wrapper).labels).toEqual(['25 Sep 2026', '26 Sep 2026'])
  })

  it('plots money and totals it', () => {
    const wrapper = mountCharts({
      columns: TREND_COLUMNS,
      rows: [
        { date: '25 Sep 2026', revenue: 40000, fnb_sales: 20000, margin_per_day: 12000 },
        { date: '26 Sep 2026', revenue: 60000, fnb_sales: 30000, margin_per_day: 18000 },
      ],
      formatMoney: money,
    })

    // Revenue is the first measurement column, so it is the default metric.
    expect(lastChart(wrapper).datasets[0].data).toEqual([40000, 60000])
    expect(wrapper.text()).toContain('TSh 100,000')
  })

  it('can be switched to another measure on the report', async () => {
    const wrapper = mountCharts({
      columns: TREND_COLUMNS,
      rows: [{ date: '26 Sep 2026', revenue: 60000, fnb_sales: 30000, margin_per_day: 18000 }],
      formatMoney: money,
    })

    const marginChip = wrapper.findAll('.rbc-metrics .rbc-chip').find((c) => c.text().toLowerCase().includes('margin'))
    await marginChip.trigger('click')

    expect(lastChart(wrapper).datasets[0].data).toEqual([18000])
  })
})
