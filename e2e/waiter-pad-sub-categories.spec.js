import { test, expect } from '@playwright/test'

/**
 * The two-level menu flow, asserted on a rendered page.
 *
 * The menu is two levels deep: `category` is the service line a waiter picks
 * first (Drinks) and `sub_category` is what sits inside it (Cocktails, Spirits).
 * The API has always sent both, but the pad read only `category`, so every
 * service line was one flat wall of food. The unit suite checks the wiring is
 * still there; only a real page can show that tapping a category brings up its
 * food and that the chips then narrow it.
 *
 * These run against the seeded demo tenant, which is the only place the two
 * levels exist: the seeder is what creates the categories and sub-categories.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill('admin@mrkhotels.test')
  await page.locator('input[type="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/app/)
  await page.goto('/app/take-order')
  await expect(page.locator('.cat-rail')).toBeVisible({ timeout: 20_000 })
})

/**
 * Switches the pad to the bar, where Cocktails lives.
 *
 * The department is a real filter, not a view preference: the seeded Cocktails
 * are bar items, so the pad opens on the restaurant and cannot show them until
 * the bar is picked. Worth asserting against deliberately rather than working
 * around, because it means these tests exercise the same two levels a bartender
 * sees.
 */
async function useBar(page) {
  await page.locator('.dept-toggle button', { hasText: /bar/i }).first().click()
  await expect(page.locator('.dept-toggle button', { hasText: /bar/i }).first()).toHaveClass(/active/)
  await expect(page.locator('.cat-rail')).toBeVisible()
}

/** Opens a service line by name and waits for its food. */
async function openCategory(page, name) {
  await page.locator('.cat-rail .cat-btn', { hasText: name }).first().click()
  await expect(page.locator('.inline-items')).toBeVisible()
}

/** The dish names currently in the food list. */
async function dishes(page) {
  return page.locator('.inline-grid .cat-item .cat-item-name').allTextContents()
}

/** The sub-category chips, with All first. */
async function chips(page) {
  return (await page.locator('.sub-rail .sub-btn').allTextContents()).map((c) => c.trim())
}

test('categories come first, and a category brings up its own food', async ({ page }) => {
  // The rail is the first thing on the pad, and nothing is on screen until a
  // service line is chosen: categories first, food second.
  await expect(page.locator('.cat-rail .cat-btn', { hasText: 'Drinks' }).first()).toBeVisible()
  await expect(page.locator('.inline-items')).toHaveCount(0)
  await expect(page.locator('.sub-rail')).toHaveCount(0)

  // One tap, with no sub-category chosen first, and the food is there.
  await openCategory(page, 'Drinks')
  const allDrinks = await dishes(page)
  expect(allDrinks.length, 'tapping a category must show its food').toBeGreaterThan(0)
})

test('the chips appear inside the category and narrow its food', async ({ page }) => {
  await useBar(page)
  await openCategory(page, 'Drinks')
  await expect(page.locator('.sub-rail')).toBeVisible()

  // All is first and preselected, so a category is never a dead end.
  expect((await chips(page))[0]).toBe('All')
  expect(await chips(page)).toContain('Cocktails')
  await expect(page.locator('.sub-rail .sub-btn').first()).toHaveClass(/active/)

  const allCount = (await dishes(page)).length

  // Picking a chip narrows the list to a strict subset, and says so in the
  // heading so the waiter can see why the list changed.
  await page.locator('.sub-rail .sub-btn', { hasText: 'Cocktails' }).click()
  await expect(page.locator('.sub-rail .sub-btn', { hasText: 'Cocktails' })).toHaveClass(/active/)
  await expect(page.locator('.inline-items-head strong')).toContainText('Cocktails')

  const cocktails = await dishes(page)
  expect(cocktails.length, 'Cocktails must have its own food').toBeGreaterThan(0)
  expect(cocktails.length, 'a sub-category must be narrower than its parent').toBeLessThan(allCount)

  // All puts the whole service line back.
  await page.locator('.sub-rail .sub-btn').first().click()
  await expect(page.locator('.inline-items-head strong')).not.toContainText('Cocktails')
  expect((await dishes(page)).length).toBe(allCount)
})

test('switching department drops a sub-category that no longer applies', async ({ page }) => {
  await useBar(page)
  await openCategory(page, 'Drinks')
  await page.locator('.sub-rail .sub-btn', { hasText: 'Cocktails' }).click()
  await expect(page.locator('.sub-rail .sub-btn', { hasText: 'Cocktails' })).toHaveClass(/active/)

  // The restaurant's Drinks is a different set of sub-categories entirely.
  // Carrying Cocktails across would open a category whose food list is empty
  // for no visible reason, so the whole selection is dropped on the way over.
  await page.locator('.dept-toggle button', { hasText: /restaurant/i }).first().click()
  await expect(page.locator('.dept-toggle button', { hasText: /restaurant/i }).first()).toHaveClass(
    /active/,
  )
  await expect(page.locator('.inline-items')).toHaveCount(0)
  await expect(page.locator('.sub-rail')).toHaveCount(0)

  // Reopening the same-named category there offers that department's own
  // sub-categories and food, not the bar's.
  await openCategory(page, 'Drinks')
  const restaurantChips = await chips(page)
  expect(restaurantChips).not.toContain('Cocktails')
  expect(restaurantChips).toContain('Beverages')
  expect((await dishes(page)).length, 'the reopened category must show its own food').toBeGreaterThan(0)
})

test('a search steps the chips aside rather than pretend to filter them', async ({ page }) => {
  await useBar(page)
  await openCategory(page, 'Drinks')
  await expect(page.locator('.sub-rail')).toBeVisible()

  // A search deliberately spans the whole department, so showing a Cocktails
  // chip over a result set that ignored it would be a lie.
  await page.locator('.cat-search').fill('margarita')
  await expect(page.locator('.sub-rail')).toHaveCount(0)

  const hits = await dishes(page)
  expect(hits.length).toBeGreaterThan(0)
  expect(hits.join(' ').toLowerCase()).toContain('margarita')
})
