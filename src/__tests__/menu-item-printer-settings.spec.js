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
 * Manager review item 4:
 *
 *   "Upon registering an item there should be a must select
 *      1. ITEM NAME 2. CATEGORY 3. SUB CATEGORY 4. PRICE
 *      5. PRINTER SETTINGS
 *          A. Print on receipt
 *          B. Print on Order
 *          C. Which printer should the order come from either KITCHEN PRINTER
 *             OR BAR PRINTER"
 *
 * The backend fields and the migration that back them are covered by
 * tests/Feature/MenuItemPrinterSettingsTest.php. This file covers the form the
 * manager actually fills in.
 */
describe('manager review: menu item printer settings', () => {
  const source = readFileSync(menuPagePath, 'utf8')

  it('offers both print switches and a printer choice on the item form', () => {
    // A, B and C are all mandatory per the review, so all three have to be on
    // the registration form rather than buried elsewhere.
    expect(source).toContain('v-model="form.print_on_receipt"')
    expect(source).toContain('v-model="form.print_on_order"')
    expect(source).toContain('v-model="form.printer_station"')
  })

  it('defaults every new item to printing on receipt, printing on order, kitchen printer', () => {
    // The defaults must match how items printed before the setting existed, so
    // adding the field cannot silently change anyone's behaviour.
    expect(source).toMatch(/form\.print_on_receipt\s*=\s*true/)
    expect(source).toMatch(/form\.print_on_order\s*=\s*true/)
    expect(source).toMatch(/form\.printer_station\s*=\s*'kitchen'/)
  })

  it('keeps printer_station independent of the service line', () => {
    // The review is explicit that sending a ticket to the bar printer does not
    // make the item a bar sale, so the printer cannot be derived from the
    // service line the way the old restaurant|bar enum used to imply.
    expect(source).not.toMatch(/printer_station:\s*form\.department/)
    expect(source).not.toMatch(/form\.printer_station\s*=\s*form\.department/)
  })

  it('offers exactly the two printers the review names', () => {
    const stationOptions = source.slice(source.indexOf('printerStationOptions'))
    expect(stationOptions).toContain("value: 'kitchen'")
    expect(stationOptions).toContain("value: 'bar'")
  })

  it('disables the printer choice when the item does not print on order', () => {
    // Picking a printer for an item that never reaches a printer is a
    // contradiction, so the control follows the switch it depends on.
    const fieldset = source.slice(source.indexOf('printer-settings'), source.indexOf('</fieldset>'))
    expect(fieldset).toContain(':disabled="!form.print_on_order"')
  })

  it('pre-fills the printer settings when editing an existing item', () => {
    const openEdit = source.slice(source.indexOf('function openEdit'), source.indexOf('function closeModal'))
    expect(openEdit).toContain('form.print_on_receipt')
    expect(openEdit).toContain('form.print_on_order')
    expect(openEdit).toContain('form.printer_station')
  })

  it('translates every printer label into both shipped locales', () => {
    // A key present in English but missing in Swahili renders as the raw key in
    // the field label, which is worse than no feature at all for the waiters.
    for (const key of [
      'printerSettings',
      'printOnReceipt',
      'printOnOrder',
      'printerStation',
      'printerKitchen',
      'printerBar',
    ]) {
      expect(en.menu[key], `en.menu.${key}`).toBeTruthy()
      expect(sw.menu[key], `sw.menu.${key}`).toBeTruthy()
    }
  })

  it('nests the printer choice inside the fieldset that owns the switches', () => {
    // The `!print_on_order` disabling hint only means anything if the printer
    // control is inside the same fieldset as the switch it depends on, so the
    // markup structure is asserted rather than just the two attributes being
    // present somewhere in the file.
    const fieldset = source.slice(source.indexOf('<fieldset class="form-full printer-settings">'), source.indexOf('</fieldset>'))

    expect(fieldset).toContain('v-model="form.print_on_receipt"')
    expect(fieldset).toContain('v-model="form.print_on_order"')
    expect(fieldset).toContain('v-model="form.printer_station"')
    expect(fieldset).toContain('menu.printerStationOffHint')
  })
})
