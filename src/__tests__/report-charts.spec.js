import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import i18n from '@/locales/i18n'
import ReportCharts from '@/components/reports/ReportCharts.vue'

const money = (v) => `TSh ${Number(v || 0).toLocaleString('en', { maximumFractionDigits: 2 })}`

const COLUMNS = [
  { key: 'item', label: 'Menu Item' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'amount', label: 'Amount', format: 'money' },
]

const mountCharts = (props) => mount(ReportCharts, { props, global: { plugins: [i18n] } })

describe('ReportCharts — bar charts over the wired report payload', () => {
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
    const names = wrapper.findAll('.rbc-name').map((n) => n.text())
    expect(names).toEqual(['Burger', 'Cola'])

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

    // Only the one real line item is plotted, and the band rows are absent.
    expect(wrapper.findAll('.rbc-row')).toHaveLength(1)
    expect(wrapper.findAll('.rbc-name').map((n) => n.text())).toEqual(['Cola'])
    expect(wrapper.text()).toContain('TSh 4,000')
    expect(wrapper.text()).not.toContain('Drinks Total')
  })

  it('switches metric through the chips', async () => {
    const wrapper = mountCharts({
      columns: COLUMNS,
      rows: [{ item: 'Cola', quantity: 4, amount: 4000 }],
      formatMoney: money,
    })

    const chips = wrapper.findAll('.rbc-chip')
    expect(chips.length).toBe(2)

    const qty = chips.find((c) => c.text().toLowerCase().includes('quantity'))
    await qty.trigger('click')

    expect(wrapper.text()).toContain('4')
    expect(wrapper.text()).not.toContain('TSh')
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
    expect(wrapper.findAll('.rbc-row')).toHaveLength(2)
  })
})
