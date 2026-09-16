import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cwd } from 'node:process'
import { mount } from '@vue/test-utils'
import ReportBrowserLayout from '@/components/reports/ReportBrowserLayout.vue'
import en from '@/locales/en.json'
import sw from '@/locales/sw.json'

const pagePath = `${cwd()}/src/pages/reports/PosReportBrowserPage.vue`
const pageSource = readFileSync(pagePath, 'utf8')

function hasKey(locale, path) {
  let node = locale.posReports
  for (const seg of path) {
    if (!node || typeof node !== 'object' || !(seg in node)) return false
    node = node[seg]
  }
  return true
}

describe('PosReportBrowserPage catalogue', () => {
  it('every posReports label referenced in the page resolves in en and sw', () => {
    const paths = [...pageSource.matchAll(/posReports\.([A-Za-z0-9_.]+)/g)]
      .map((m) => m[1])
      .filter((p) => !p.includes('${'))
      .map((p) => p.split('.').filter(Boolean))

    expect(paths.length).toBeGreaterThan(100)
    for (const path of paths) {
      const key = path.join('.')
      expect(hasKey(en, path), `en.json missing posReports.${key}`).toBe(true)
      expect(hasKey(sw, path), `sw.json missing posReports.${key}`).toBe(true)
    }
  })

  it('payment method options referenced by the Cashier Report filter exist', () => {
    expect(en.posReports.paymentMethods.card).toBe('Card')
    expect(en.posReports.paymentMethods.unpaid).toBe('Unpaid')
    expect(sw.posReports.paymentMethods.card).toBeTruthy()
    expect(sw.posReports.paymentMethods.unpaid).toBeTruthy()
  })

  it('window-fallback keys used by openWindow and printPosReceipt resolve', () => {
    expect(en.reportBrowser.posPrint).toBeTruthy()
    expect(sw.reportBrowser.posPrint).toBeTruthy()
    expect(en.reportBrowser.openWindowEmpty).toBeTruthy()
    expect(sw.reportBrowser.openWindowEmpty).toBeTruthy()
    expect(en.reportBrowser.openWindowBlocked).toBeTruthy()
    expect(sw.reportBrowser.openWindowBlocked).toBeTruthy()
  })

  it('labels each report key with a display name', () => {
    const keys = [...pageSource.matchAll(/key: '([a-z0-9-]+)'/g)].map((m) => m[1])
    expect(keys).toContain('menu-item-sales')
    expect(keys).toContain('menu-items-sales-detail')
    expect(keys).toContain('cashier-report')
    expect(keys).toContain('purchase-order-detail')
    expect(keys).toContain('stock-transfer-summary')
    expect(keys).toContain('audit-void-purchase-order')
    expect(keys).toContain('audit-trail')
  })
})

describe('ReportBrowserLayout POS-print button', () => {
  const mountLayout = (posPrint = false) =>
    mount(ReportBrowserLayout, {
      props: { categories: [], active: 'cashier-report', title: 'POS Reports', posPrint },
      global: { mocks: { $t: (key) => key } },
    })

  it('is hidden unless the active report asks for a POS printer', () => {
    expect(mountLayout(false).find('button[title="reportBrowser.posPrint"]').exists()).toBe(false)
    expect(mountLayout(true).find('button[title="reportBrowser.posPrint"]').exists()).toBe(true)
  })

  it('emits pos-print when clicked', async () => {
    const wrapper = mountLayout(true)
    await wrapper.find('button[title="reportBrowser.posPrint"]').trigger('click')
    expect(wrapper.emitted('pos-print')).toHaveLength(1)
  })
})