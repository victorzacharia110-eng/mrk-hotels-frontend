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
 * Swahili strings still to write. Empty: both files now hold the same 5,335
 * keys, so there is no gap left to paper over.
 *
 * Do not add a key here instead of adding it to sw.json. The point of this
 * file is to catch a key landing in one locale and not the other; a new entry
 * here would be that same bug, written down as a decision.
 */
const KNOWN_MISSING_IN_SW = new Set()

describe('locale parity', () => {
  it('reads both locale files', () => {
    expect(EN.size).toBeGreaterThan(1000)
    expect(SW.size).toBeGreaterThan(1000)
  })

  it('has no key in one locale that the other lacks', () => {
    // Both directions break the UI the same way — vue-i18n falls back silently
    // and the user reads a raw dotted key — so this is one statement rather
    // than two, and it stays one statement when the next locale is added.
    expect({
      missingFromSw: missingInSw,
      missingFromEn: missingInEn,
    }).toEqual({ missingFromSw: [], missingFromEn: [] })
  })

  it('has a baseline entry for every known gap and no others', () => {
    // Guards against the baseline drifting into describing a different set of
    // problems than the files actually have.
    expect([...KNOWN_MISSING_IN_SW].filter((k) => !EN.has(k))).toEqual([])
    expect([...KNOWN_MISSING_IN_SW].filter((k) => SW.has(k))).toEqual([])
  })
})