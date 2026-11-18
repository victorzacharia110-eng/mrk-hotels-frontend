import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cwd } from 'node:process'
import en from '@/locales/en.json'
import sw from '@/locales/sw.json'

const storeReportsSource = readFileSync(`${cwd()}/src/pages/store/StoreReportsPage.vue`, 'utf8')
const posReportsSource = readFileSync(`${cwd()}/src/pages/reports/PosReportBrowserPage.vue`, 'utf8')

describe('store manager reports browser', () => {
  it('reuses the POS report browser in inventory scope', () => {
    expect(storeReportsSource).toContain("import PosReportBrowserPage from '@/pages/reports/PosReportBrowserPage.vue'")
    expect(storeReportsSource).toContain('scope="inventory"')
    expect(posReportsSource).toContain("scope: { type: String, default: 'pos' }")
    expect(posReportsSource).toContain("props.scope === 'inventory'")
  })

  it('offers the five report groups requested in the redesign', () => {
    const block = posReportsSource.match(/const PDF_INVENTORY_CATEGORIES = \[[\s\S]*?\n\]/)?.[0] || ''
    const groupKeys = [...block.matchAll(/ {4}key: '([^']+)'/g)].map((match) => match[1])
    expect(groupKeys).toEqual(['menu-item-sales', 'back-office', 'inventory', 'stock', 'audit'])
  })

  it('matches the PDF inventory report catalogue', () => {
    const block = posReportsSource.match(/const PDF_INVENTORY_CATEGORIES = \[[\s\S]*?\n\]/)?.[0] || ''
    const keys = [
      'menu-item-cost-detail', 'menu-item-cost-summary',
      'supplier-detail', 'supplier-summary',
      'purchase-order-register', 'purchase-order-detail',
      'goods-received-detail', 'goods-received-register',
      'physical-stock-detail', 'stock-adjustment-detail',
      'stock-transfer-detail', 'stock-transfer-summary',
      'requisition-detail', 'requisition-summary',
      'indent-forward-detail', 'indent-forward-summary',
      'stock-ledger', 'stock-ledger-summary', 'closing-stock', 'low-stock',
      'audit-void-purchase-order-summary', 'audit-void-purchase-order',
      'audit-void-goods-received-summary', 'audit-void-goods-received',
      'audit-void-physical-stock-summary', 'audit-void-physical-stock',
      'audit-void-stock-adjustment-summary', 'audit-void-stock-adjustment-detail',
      'audit-void-stock-transfer-summary', 'audit-void-stock-transfer-detail',
      'audit-void-indent-forward-summary', 'audit-void-indent-forward-detail',
    ]
    expect(block).toContain('posReports.catProductSales')
    for (const key of keys) {
      expect(block, `inventory catalogue missing ${key}`).toContain(`key: '${key}'`)
    }
    expect(block.match(/\{ key: '/g)).toHaveLength(keys.length)
    expect(block).not.toContain('creditors-summary')
    expect(block).not.toContain('goods-return-detail')
    expect(block).not.toContain('stock-movement-detail')
    expect(block).not.toContain('audit-void-requisitions')
    expect(block).not.toContain("'no-charge'")
    expect(block).not.toContain("'sales'")
    expect(block).not.toContain("'more'")

    const labelKeys = [...block.matchAll(/label: 'posReports\.([^']+)'/g)].map((match) => match[1])
    for (const key of labelKeys) {
      expect(en.posReports[key], `en.json missing posReports.${key}`).toBeTruthy()
      expect(sw.posReports[key], `sw.json missing posReports.${key}`).toBeTruthy()
    }
  })

  it('adds the store report filter controls', () => {
    expect(posReportsSource).toContain('usesIgnoreZero')
    expect(posReportsSource).toContain('usesInventoryItem')
    expect(posReportsSource).toContain('usesSupplier')
    expect(posReportsSource).toContain('usesVoidUser')
    expect(posReportsSource).toContain('usesOutletTo')
    expect(posReportsSource).toContain('usesAdjustmentType')
    expect(posReportsSource).toContain('filterValues.item_id')
    expect(posReportsSource).toContain("t('posReports.supplierRequired')")
  })

  it('has translations for the new store report filters', () => {
    const keys = [
      'supplier', 'voidUser', 'outletTo', 'adjustmentType', 'inventoryItem',
      'ignoreZero', 'adjustment', 'wastage', 'supplierRequired',
    ]
    for (const key of keys) {
      expect(en.posReports[key], `en.json missing posReports.${key}`).toBeTruthy()
      expect(sw.posReports[key], `sw.json missing posReports.${key}`).toBeTruthy()
    }
  })
})
