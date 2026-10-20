import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import en from '@/locales/en.json'
import sw from '@/locales/sw.json'

const menuPagePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../pages/menu/MenuListPage.vue',
)

/**
 * A menu item can be linked to a stock record ("sync to stock"). The unit
 * cost behind that link is maintained on the inventory panel and cannot be
 * edited anywhere else, so the add-item form must show it auto-filled and
 * read-only rather than as a second editable copy of the same number —
 * otherwise the menu margin would drift away from the stock ledger.
 */
describe('menu item cost is owned by the synced inventory record', () => {
  const source = readFileSync(menuPagePath, 'utf8')

  it('locks the cost box while the item is synced to stock', () => {
    const start = source.indexOf("$t('menu.cost'")
    // Everything up to the printer fieldset is the cost/availability row.
    const costField = source.slice(start, source.indexOf('printer-settings', start))

    expect(costField).toContain(':disabled="syncedToStock"')
    expect(costField).toContain('v-model.number="form.cost"')
    expect(costField).toContain('costSyncedHint')
  })

  it('fills the cost from the linked stock record', () => {
    const fill = source.slice(
      source.indexOf('function syncCostFromInventory'),
      source.indexOf('watch(() => form.inventory_item_id'),
    )

    expect(fill).toContain('form.inventory_item_id')
    expect(fill).toContain('unit_cost')
    expect(fill).toMatch(/form\.cost\s*=\s*Number\(stock\.unit_cost\)/)
  })

  it('re-reads the cost whenever the sync link changes', () => {
    expect(source).toContain('watch(() => form.inventory_item_id, syncCostFromInventory)')
    // The option list loads after the edit modal opens, so the same fill has
    // to run again once the record is actually in hand.
    expect(source).toMatch(/async function loadInventoryOptions[\s\S]{0,200}syncCostFromInventory\(\)/)
  })

  it('restores an editable cost when the link is removed', () => {
    expect(source).toMatch(/const syncedToStock = computed\(\(\) => Boolean\(form\.inventory_item_id\)\)/)
    expect(source).toMatch(/if \(!form\.inventory_item_id\) return/)
  })

  it('keeps filling the cost from the record behind the cursor', () => {
    // The picker only holds one page of stock items; a linked item beyond it
    // still has to land in the read-only box instead of staying blank.
    const fill = source.slice(
      source.indexOf('function syncCostFromInventory'),
      source.indexOf('watch(() => form.inventory_item_id'),
    )
    expect(fill).toContain('inventoryApi.show(form.inventory_item_id)')
  })

  it('translates the read-only hint into both shipped locales', () => {
    expect(en.menu.costSyncedHint, 'en.menu.costSyncedHint').toBeTruthy()
    expect(sw.menu.costSyncedHint, 'sw.menu.costSyncedHint').toBeTruthy()
    expect(en.menu.costSyncedHint).not.toBe(sw.menu.costSyncedHint)
  })

  it('searches stock on the server so items beyond the first page are reachable', () => {
    // A hotel with more than one page of stock would otherwise only ever see
    // the first 100 items in the picker, which is what made newly added stock
    // appear to be missing.
    const picker = source.slice(
      source.indexOf('v-model="form.inventory_item_id"'),
      source.indexOf('syncToStockHint'),
    )
    expect(picker).toContain(':searching="inventorySearching"')
    expect(picker).toContain('@search="searchInventory"')
  })

  it('debounces the stock search and restores the full catalogue on an empty query', () => {
    const search = source.slice(
      source.indexOf('function searchInventory'),
      source.indexOf('const syncedToStock'),
    )
    expect(search).toMatch(/setTimeout\([\s\S]*350\)/)
    expect(search).toMatch(/if \(!q\)[\s\S]{0,120}loadInventoryOptions\(\)/)
    expect(search).toContain('fetchAllInventory({ search: q })')
  })

  it('walks every inventory page so the full catalogue is in the picker', () => {
    // The list endpoint pages at 100 rows; loading one page hid every item
    // past the first hundred, which is what made added stock look missing.
    const fetchAll = source.slice(
      source.indexOf('async function fetchAllInventory'),
      source.indexOf('async function loadInventoryOptions'),
    )
    expect(fetchAll).toContain('per_page: INVENTORY_PAGE_SIZE')
    expect(fetchAll).toContain('meta?.last_page')
    expect(fetchAll).toMatch(/page \+= 1/)
    expect(source).toMatch(/loadInventoryOptions\(\)\s*\{[\s\S]{0,160}fetchAllInventory\(\)/)
  })
})
