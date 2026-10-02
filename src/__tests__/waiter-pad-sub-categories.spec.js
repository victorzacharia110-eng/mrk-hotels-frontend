import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guards the two-level menu flow in the waiter pad.
 *
 * The menu is two levels deep — `category` is the service line a waiter picks
 * first (Drinks) and `sub_category` is what sits inside it (Cocktails). The API
 * has always returned both, but the pad only ever read `category`, so every
 * service line was a flat wall of food with no way into its parts.
 *
 * These are structural assertions, matching the rest of this suite: jsdom
 * resolves no layout and mounting the pad would drag in the whole API surface.
 * What they catch is the wiring being deleted or a key dropped, which is how this
 * gap arrived. The behaviour itself — food appearing on tap, the chips narrowing
 * it — is asserted for real in `e2e/waiter-pad-sub-categories.spec.js`.
 */

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const pad = read('src/pages/dashboards/OrderTakerDashboard.vue')
const en = JSON.parse(read('src/locales/en.json'))
const sw = JSON.parse(read('src/locales/sw.json'))
const styles = pad.slice(pad.indexOf('<style'))

/** Pulls a CSS rule body out of a `<style>` block by selector. */
function rule(css, selector) {
  const at = css.search(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`))
  expect(at, `selector ${selector} not found`).toBeGreaterThan(-1)
  const open = css.indexOf('{', at)
  let depth = 0
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  return css.slice(open + 1)
}

/** The body of a `function name(...) { ... }` in the script block. */
function fn(name) {
  const at = pad.search(new RegExp(`function ${name}\\s*\\(`))
  expect(at, `function ${name} not found`).toBeGreaterThan(-1)
  const open = pad.indexOf('{', pad.indexOf(')', at))
  let depth = 0
  for (let i = open; i < pad.length; i += 1) {
    if (pad[i] === '{') depth += 1
    if (pad[i] === '}') {
      depth -= 1
      if (depth === 0) return pad.slice(open + 1, i)
    }
  }
  return pad.slice(open + 1)
}

describe('waiter pad: categories first, then the sub-categories inside one', () => {
  it('derives the sub-categories of the active category, in menu order', () => {
    expect(pad).toMatch(/const subCategories = computed\(\(\) => \{/)
    // Scoped to the open category: the chips must never offer a sub-category
    // belonging to a service line that is not on screen.
    expect(pad).toMatch(/if \(item\.category !== activeCategory\.value\) return/)
    // Items that were never given a sub-category must not invent a chip.
    expect(pad).toMatch(/if \(!item\.sub_category \|\| seen\.has\(item\.sub_category\)\) return/)
    expect(pad).toMatch(/seen\.set\(item\.sub_category, item\.sub_category_order \|\| 0\)/)
  })

  it('shows the whole category on tap, and narrows only once a chip is picked', () => {
    expect(pad).toMatch(
      /if \(!activeSubCategory\.value\) return inCategory/,
      'a category must show its food immediately, not an empty list',
    )
    expect(pad).toMatch(
      /return inCategory\.filter\(\(item\) => item\.sub_category === activeSubCategory\.value\)/,
    )
  })

  it('resets the sub-category whenever the category is left or changed', () => {
    // Switching service line has to drop the old sub-category, or the food list
    // comes up empty with no visible reason why.
    expect(fn('openCategory')).toMatch(/activeSubCategory\.value = ''/)
    expect(fn('closeCategory')).toMatch(/activeSubCategory\.value = ''/)
    // ...and so does flipping restaurant/bar, whose sub-categories differ.
    expect(fn('switchDepartment')).toMatch(/activeSubCategory\.value = ''/)
  })

  it('renders the chips with an All escape, and hides them for a search', () => {
    expect(pad).toMatch(
      /v-if="activeCategory && !searchQuery && subCategories\.length > 1"/,
      'the rail must not appear before a category is open, must stay out of the way of a search, and a single sub-category is not worth a row of its own',
    )
    expect(pad).toMatch(/v-for="sub in subCategories"/)
    expect(pad).toMatch(/@click="openSubCategory\(sub\)"/)
    // "All" is preselected, which is what makes a category one tap from its food.
    expect(pad).toMatch(/\{ \$t\('orderTaker\.allItems'\) \}/)
    expect(pad).toMatch(/:class="\{ active: !activeSubCategory \}"/)
  })

  it('names the level it is on, for screen readers', () => {
    expect(pad).toMatch(/:aria-label="\$t\('orderTaker\.subCategories'\)"/)
    expect(pad).toMatch(/role="tablist"/)
  })

  it('keeps both rails on one line each so the column does not grow', () => {
    const rail = rule(styles, '.sub-rail')
    expect(rail).toMatch(/display:\s*flex/)
    // Sideways, not wrapped: a second level that wrapped would push the food off
    // the pad all over again, which is what the category rail already fixed.
    // A flex row does not wrap by default, so the regression to guard is an
    // explicit wrap sneaking in.
    expect(rail).toMatch(/overflow-x:\s*auto/)
    expect(rail).not.toMatch(/flex-wrap:\s*wrap/)
  })

  it('gives the shrinking to the food list, not to the rails', () => {
    // The panel holds both rails and must keep its natural height; the food list
    // is the only part with somewhere to give, because it scrolls.
    expect(rule(styles, '.cat-panel')).toMatch(/flex:\s*0 0 auto/)
    expect(rule(styles, '.inline-items')).toMatch(/flex:\s*1 1 auto/)
  })

  it('has the label in both languages', () => {
    expect(en.orderTaker.subCategories).toBe('Sub-categories')
    expect(sw.orderTaker.subCategories).toBeTruthy()
    // The chip row reuses the existing "All" key, so it must exist in both.
    expect(en.orderTaker.allItems).toBeTruthy()
    expect(sw.orderTaker.allItems).toBeTruthy()
  })
})
