import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/pages/menu/MenuListPage.vue'), 'utf8')

function bodyOf(marker, nextMarker) {
  const at = source.indexOf(marker)
  expect(at, `${marker} not found`).toBeGreaterThan(-1)
  return source.slice(at, source.indexOf(nextMarker, at))
}

describe('menu item reorder level', () => {
  it('is a blank numeric setting on new items, independent from store inventory', () => {
    const field = bodyOf("$t('menu.reorderLevel')", 'printer-settings')
    expect(field).toContain('v-model.number="form.reorder_level"')
    expect(field).toContain('type="number"')
    expect(field).toContain('min="0"')
    expect(field).toContain("$t('menu.reorderLevelHint')")
    expect(bodyOf('const form = reactive', 'const printerStationOptions')).toContain('reorder_level: null')
  })

  it('clears a previously edited value when the manager opens a new-item form', () => {
    const reset = bodyOf('function resetForm', 'function onFormDepartmentChange')
    expect(reset).toContain('form.reorder_level = null')
  })

  it('loads the menu item own value for editing and includes it in the saved payload', () => {
    expect(source).toContain('form.reorder_level = item.reorder_level ?? null')
    const payload = bodyOf('async function save()', 'async function toggleAvailability')
    expect(payload).toContain('...form')
    expect(payload).toContain('menuItemApi.update(editingId.value, payload)')
    expect(payload).toContain('menuItemApi.store(payload)')
  })
})
