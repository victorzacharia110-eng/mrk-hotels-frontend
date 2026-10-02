import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Locale parity between English and Swahili.
 *
 * Both locale files are hand-maintained and large — over 5,000 keys each — so
 * a feature that adds a key to one and forgets the other renders the raw key to
 * the user, like "folio.billAmount" instead of "Bill amount". Nothing in the app
 * can catch that on its own: vue-i18n falls back silently and logs a warning
 * that nobody reads, so the page looks fine in development and broken for the
 * person using it.
 *
 * So this compares the two files directly.
 *
 * The comparison is against an explicit baseline rather than requiring perfect
 * parity. Fifty-seven Swahili strings are still untranslated, and a test that
 * failed on all of them would be red forever and therefore ignored — which is
 * worse than no test at all. The baseline names each known gap, so the suite
 * stays green while the gap is real, and any *change* to the gap in either
 * direction fails loudly:
 *
 *   - a key added to one file and not the other fails, which is the bug this
 *     exists to catch
 *   - a baseline key translated and removed from the list fails, because a gap
 *     quietly marked done without the string actually being written is the same
 *     lie from the other direction
 *   - a baseline key deleted outright fails too, so the list cannot rot into
 *     agreeing with a key nobody has
 *
 * Shrink KNOWN_MISSING_IN_SW as translations land. When it is empty the two
 * files are in parity and the whole block below can be deleted.
 */

/** Flattens nested locale JSON to dotted paths. */
function flatten(obj, prefix = '') {
  const out = new Set()
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of flatten(value, path)) out.add(nested)
    } else {
      out.add(path)
    }
  }
  return out
}

function keysFor(locale) {
  return flatten(
    JSON.parse(readFileSync(resolve(process.cwd(), `src/locales/${locale}.json`), 'utf8')),
  )
}

const EN = keysFor('en')
const SW = keysFor('sw')

const missingInSw = [...EN].filter((k) => !SW.has(k)).sort()
const missingInEn = [...SW].filter((k) => !EN.has(k)).sort()

/**
 * Swahili strings still to write. Grouped by section because that is how they
 * get translated — a translator works a screen, not a flat list of keys.
 *
 * These are all pre-existing gaps, not new ones. When adding a key here instead
 * of adding it to sw.json, ask why: the point of this file is to catch new keys
 * landing in one file only.
 */
const KNOWN_MISSING_IN_SW = new Set([
  // folio — guest bill print and folio screens (21)
  'folio.billAmount',
  'folio.category',
  'folio.guestName',
  'folio.itemName',
  'folio.no',
  'folio.noFolioPosted',
  'folio.orderNo',
  'folio.qty',
  'folio.receipt',
  'folio.receiptNo',
  'folio.refund',
  'folio.room',
  'folio.roomNo',
  'folio.serviceTable',
  'folio.tax',
  'folio.time',
  'folio.totalPayable',
  'folio.transferFrom',
  'folio.view',
  'folio.viewHint',
  'folio.viewTitle',
  // reportBrowser — POS report browser (11)
  'reportBrowser.chartBar',
  'reportBrowser.chartFigures',
  'reportBrowser.chartLabel',
  'reportBrowser.chartLine',
  'reportBrowser.chartNoData',
  'reportBrowser.chartStyle',
  'reportBrowser.chartTotal',
  'reportBrowser.chartUnnamed',
  'reportBrowser.charts',
  'reportBrowser.chartsHide',
  'reportBrowser.chartsShow',
  // stayview — hotel dashboard and creditors (9)
  'stayview.availableCredit',
  'stayview.collectPayment',
  'stayview.creditExceeded',
  'stayview.creditorCompany',
  'stayview.currentBalance',
  'stayview.postToCreditors',
  'stayview.remainingCredit',
  'stayview.searchCompany',
  'stayview.selectCreditorCompany',
  // receptionPanel — front desk (6)
  'receptionPanel.city',
  'receptionPanel.corporateDirectory',
  'receptionPanel.corporateDirectorySubtitle',
  'receptionPanel.hotelProfile',
  'receptionPanel.noCompanies',
  'receptionPanel.searchCompanies',
  // nightAudit — night audit guest search (3)
  'nightAudit.guestSearch',
  'nightAudit.guestSearchPlaceholder',
  'nightAudit.noGuestsFound',
  // guests — ID document types (3)
  'guests.typeDriverLicense',
  'guests.typeNationalId',
  'guests.typePassport',
  // storeManager — stock (2)
  'storeManager.lowStock.onShelves',
  'storeManager.lowStock.storeOnly',
  // cashier — room service (2)
  'cashier.roomService.items',
  'cashier.roomService.newOrder',
])

/** Swahili-only keys. Empty: every string Swahili uses also exists in English. */
const KNOWN_MISSING_IN_EN = new Set()

describe('locale parity', () => {
  it('reads both locale files', () => {
    expect(EN.size).toBeGreaterThan(1000)
    expect(SW.size).toBeGreaterThan(1000)
  })

  it('has no Swahili string English lacks', () => {
    // The direction that hurts most in practice: English is the fallback, so a
    // Swahili-only key shows a receptionist a raw dotted key in the language
    // they read. Anything added here is a key the API can reach but English
    // cannot render — check the caller before allowing one.
    expect(missingInEn).toEqual([...KNOWN_MISSING_IN_EN].sort())
  })

  it('has not grown the Swahili gap since the last translation pass', () => {
    const added = missingInSw.filter((k) => !KNOWN_MISSING_IN_SW.has(k))
    const healed = [...KNOWN_MISSING_IN_SW].filter((k) => !missingInSw.includes(k))
    const retired = [...KNOWN_MISSING_IN_SW].filter((k) => !EN.has(k))

    // Thrown rather than asserted with a message, because vitest's expect takes
    // only one argument and a failing diff alone does not say which of the
    // three directions went wrong or what to do about it.
    if (added.length) {
      throw new Error(
        `${added.length} key(s) exist in en but not sw: ${added.join(', ')}\n` +
          'Add them to sw.json, not to the baseline — that is the bug this test exists to catch.',
      )
    }
    if (healed.length) {
      throw new Error(
        `${healed.length} baseline key(s) now exist in sw: ${healed.join(', ')}\n` +
          'Delete them from KNOWN_MISSING_IN_SW so the baseline shrinks.',
      )
    }
    if (retired.length) {
      throw new Error(
        `${retired.length} baseline key(s) no longer exist in en.json: ${retired.join(', ')}\n` +
          'Delete them from KNOWN_MISSING_IN_SW.',
      )
    }

    expect({ added, healed, retired }).toEqual({ added: [], healed: [], retired: [] })
  })

  it('has a baseline entry for every known gap and no others', () => {
    // Guards against the baseline drifting into describing a different set of
    // problems than the files actually have.
    expect([...KNOWN_MISSING_IN_SW].filter((k) => !EN.has(k))).toEqual([])
    expect([...KNOWN_MISSING_IN_SW].filter((k) => SW.has(k))).toEqual([])
  })
})