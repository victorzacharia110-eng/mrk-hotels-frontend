import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guards the two things that made the waiter pad unusable, plus the class of
 * bug that hid the sub-category box in the first place.
 *
 * These are structural assertions on the source, not layout measurements. jsdom
 * resolves no layout, so it genuinely cannot answer "does the food list scroll
 * while the table map stays put" — that is what the Playwright probe in
 * `e2e/sticky-headers.spec.js` and the manual viewport check are for. What these
 * tests do catch is a rule being deleted or a key being dropped, which is how
 * both of these problems actually arrived.
 */

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const pad = read('src/pages/dashboards/OrderTakerDashboard.vue')
const menuPage = read('src/pages/menu/MenuListPage.vue')
const en = JSON.parse(read('src/locales/en.json'))
const sw = JSON.parse(read('src/locales/sw.json'))

/** Pulls a CSS rule body out of a `<style>` block by selector. */
function rule(css, selector) {
  // Comments are stripped first. They live inside the braces here, and these
  // bodies are written to explain *why* a value is what it is — so a rule that
  // mentions `min-height: 100vh` in its prose would otherwise satisfy an
  // assertion about `height: 100vh` and pass without the CSS ever saying it.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  // The brace is required so a selector that is only one entry in a group
  // (`.a,\n.b {`) does not match when the caller means the standalone rule.
  const at = source.search(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`))
  expect(at, `selector ${selector} not found`).toBeGreaterThan(-1)
  const open = source.indexOf('{', at)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  return source.slice(open + 1)
}

const styles = pad.slice(pad.indexOf('<style'))

describe('waiter pad: the page itself does not scroll while taking an order', () => {
  it('only pins the tab to the viewport when an order is being taken', () => {
    // The dashboard/open/summary tabs are reports and are read by scrolling, so
    // the height lock has to be conditional rather than on the page always.
    expect(pad).toMatch(/:class="\{ 'pos-theme': isPosRole, 'taker-fixed': activeTab === 'new' \}"/)
    const fixed = rule(styles, '.taker-page.taker-fixed')
    expect(fixed).toMatch(/overflow:\s*hidden/)
  })

  it('fills the panel it is given, not the whole viewport', () => {
    // This used to ask for `height: 100vh` and the assertion above guarded it.
    // That was the bug: the app shell is 100vh with a header above
    // `#main-content`, so a viewport-tall pad overran its container by the
    // height of that header, and since the overflow was hidden with nothing to
    // scroll, the Send order button ended up below the bottom of the window and
    // could not be clicked. `100%` resolves against `#main-content`, which is
    // the flex leftover and already the scroll container.
    const fixed = rule(styles, '.taker-page.taker-fixed')
    expect(fixed).toMatch(/height:\s*100%/)
    expect(fixed).not.toMatch(/height:\s*100vh/)

    // `min-height: 0` is not optional. The base rule asks for
    // `min-height: 100vh`, and a min-height beats a height, so without this the
    // page is clamped back to a full viewport tall no matter what `height` says.
    expect(rule(styles, '.taker-page')).toMatch(/min-height:\s*100vh/)
    expect(fixed).toMatch(/min-height:\s*0/)
  })

  it('releases the height lock on a narrow screen', () => {
    // Stacked on a phone the pad would leave the food box a few centimetres
    // tall, so below 820px everything goes back to one normally scrolling page.
    const narrow = styles.slice(styles.indexOf('@media (max-width: 820px)'))
    expect(narrow).toMatch(/\.taker-page\.taker-fixed\s*\{[^}]*height:\s*auto/)
    expect(narrow).toMatch(/\.taker-page\.taker-fixed\s*\{[^}]*overflow:\s*visible/)
  })

  it('lets the columns shrink, or the page scrolls anyway', () => {
    // A flex/grid child will not shrink below its content without this, which
    // is the classic way an "overflow: hidden" parent still ends up scrolling.
    const split = rule(styles, '.taker-page.taker-fixed .taker-split')
    expect(split).toMatch(/min-height:\s*0/)
  })
})

describe('waiter pad: categories scroll sideways, food scrolls down', () => {
  it('lays the categories out as one non-wrapping horizontal rail', () => {
    const rail = rule(styles, '.cat-rail')
    expect(rail).toMatch(/display:\s*flex/)
    // nowrap is what keeps every category on one line; the default would wrap
    // and push the food cards off the bottom of the pad, which was the original
    // complaint.
    expect(rail).toMatch(/flex-wrap|overflow-x:\s*auto/)
    expect(rule(styles, '.cat-rail')).toMatch(/overflow-x:\s*auto/)
  })

  it('keeps the category chips from wrapping onto a second row', () => {
    const chip = rule(styles, '.cat-rail .cat-btn')
    expect(chip).toMatch(/flex:\s*0 0 auto/)
    // Category names range from "Soup" to "Cold Beverages"; a fixed narrow
    // width clipped the long ones.
    expect(chip).toMatch(/white-space:\s*nowrap/)
    expect(chip).toMatch(/text-overflow:\s*ellipsis/)
  })

  it('scrolls the food list inside a bounded box', () => {
    // `max-height: none` used to be deliberate here, which meant the list grew
    // the page instead of scrolling itself.
    const grid = rule(styles, '.inline-grid')
    expect(grid).toMatch(/overflow-y:\s*auto/)
    expect(grid).toMatch(/min-height:\s*0/)
    // And the wrapper has to be a column for the grid to take the leftover
    // height rather than being sized by its content.
    expect(rule(styles, '.inline-items')).toMatch(/display:\s*flex/)
  })
})

describe('waiter pad: the table cards are on the right and stay put', () => {
  it('renders the table map inside the right column, not the left', () => {
    const leftAt = pad.indexOf('class="ts-left"')
    const rightAt = pad.indexOf('class="ts-right"')
    const mapAt = pad.indexOf('class="table-map"')
    expect(leftAt, 'left column not found').toBeGreaterThan(-1)
    expect(rightAt, 'right column not found').toBeGreaterThan(leftAt)
    expect(mapAt, 'table map not found').toBeGreaterThan(-1)

    // The table map used to sit at the bottom of the left column, under the food
    // cards, so the longer the menu the further down the tables were. Asserting
    // the ORDER is enough: the map has to come after the right column opens.
    expect(mapAt).toBeGreaterThan(rightAt)
  })

  it('keeps the map visible while the order scrolls under it', () => {
    expect(rule(styles, '.ts-right .table-map')).toMatch(/position:\s*sticky/)
    // A sticky child needs something to stick inside, and the right column is
    // that. Matched with the brace so the earlier grouped `.ts-left, .ts-right`
    // rule (which only sets height) is not picked up instead.
    expect(styles).toMatch(/\.taker-page\.taker-fixed \.ts-right\s*\{[^}]*overflow-y:\s*auto/)
    // A sticky child needs a defined top to stick to.
    expect(rule(styles, '.ts-right .table-map')).toMatch(/top:\s*0/)
  })

  it('lets the map scroll internally instead of growing past the window', () => {
    expect(rule(styles, '.taker-page.taker-fixed .table-map')).toMatch(/max-height:\s*42vh/)
    expect(rule(styles, '.taker-page.taker-fixed .table-map-grid')).toMatch(/overflow-y|min-height:\s*0/)
  })

  it('stops being sticky on a narrow screen, where it would overlap', () => {
    const narrow = styles.slice(styles.indexOf('@media (max-width: 820px)'))
    expect(narrow).toMatch(/\.ts-right \.table-map\s*\{[^}]*position:\s*static/)
  })
})

describe('menu translations', () => {
  it('offers a Kiswahili name and description on the item form', () => {
    expect(menuPage).toMatch(/v-model="form\.item_name_sw"/)
    expect(menuPage).toMatch(/v-model="form\.description_sw"/)
  })

  it('sends a blank translation as null, not an empty string', () => {
    expect(menuPage).toMatch(/item_name_sw:\s*form\.item_name_sw\.trim\(\) \|\| null/)
    expect(menuPage).toMatch(/description_sw:\s*form\.description_sw\.trim\(\) \|\| null/)
  })

  it('reads the dish name for display without changing what is sent to the API', () => {
    // The API resolves `item_name_display` from Accept-Language, so the screen
    // can be Kiswahili. The order line must still carry the English
    // `item_name`, because that is what the kitchen ticket and the sales report
    // are keyed on.
    expect(pad).toMatch(/function dishName\(item\)/)
    expect(pad).toMatch(/item_name:\s*item\.item_name,/)
    expect(pad).toMatch(/\{\{ dishName\(item\) \}\}/)
  })

  it('stamps the current UI language on every API call', () => {
    const axios = read('src/api/axios.js')
    expect(axios).toMatch(/Accept-Language/)
    // Read per request, because the language switch does not reload the page.
    expect(axios).toMatch(/localStorage\.getItem\('locale'\)/)
  })
})

describe('locale files stay in step', () => {
  it('defines every key the menu form and waiter pad use, in both languages', () => {
    // `menu.subCategory` was referenced by the item form and never defined, so
    // the sub-category field's label rendered as the literal text
    // "menu.subCategory *" and the second level looked like it did not exist.
    // That is the whole reason the inline "add a sub-category" button was needed.
    //
    // Scoped to the keys this feature renders. The two files also carry
    // pre-existing drift in unrelated sections (folio, reportBrowser, stayview,
    // receptionPanel, nightAudit), which is a separate bug and not this test's
    // to silently paper over by inventing translations.
    const used = new Set()
    for (const src of [menuPage, pad]) {
      for (const m of src.matchAll(/\$t\('([a-zA-Z]+\.[a-zA-Z0-9_]+)'\)/g)) used.add(m[1])
    }
    // Order-taker keys are numerous and pre-existing; only assert the menu keys
    // this change added, plus that the sub-category pair exists at all.
    const menuKeys = [...used].filter((k) => k.startsWith('menu.'))
    expect(menuKeys.length).toBeGreaterThan(0)

    const lookup = (obj, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
    const missingEn = menuKeys.filter((k) => !lookup(en, k))
    const missingSw = menuKeys.filter((k) => !lookup(sw, k))
    expect(missingEn, 'menu keys used by the page but absent from en.json').toEqual([])
    expect(missingSw, 'menu keys used by the page but absent from sw.json').toEqual([])
  })

  it('does not double up the required marker on the sub-category label', () => {
    // The template appends its own `*`; a string carrying one too rendered
    // "Sub-category * *".
    expect(menuPage).toMatch(/\$t\('menu\.subCategory'\)\s*\}\}\s*\*/)
    expect(en.menu.subCategory).not.toMatch(/\*/)
    expect(sw.menu.subCategory).not.toMatch(/\*/)
  })

  it('exposes the inline way to add a sub-category from the item form', () => {
    // The only other route to it was the "Categories" button in the page header,
    // which is what made the second level undiscoverable.
    expect(menuPage).toMatch(/menu\.addSubCategory/)
    expect(en.menu.addSubCategory).toBeTruthy()
    expect(sw.menu.addSubCategory).toBeTruthy()
  })
})
