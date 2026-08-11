/**
 * capture-docs-images.mjs (docs tooling)
 * Captures the screenshots for the PIN sign-in feature into docs/images/:
 *   - login-pin.png         Login card in PIN mode with 2 of 4 digits entered
 *   - app-staff.png         Staff Management page (row actions include "Set PIN")
 *   - app-staff-set-pin.png Set-PIN modal open for a staff member
 * Requires the dev server (5173) and the API (8000) to be running:
 *   node scripts/capture-docs-images.mjs         # all shots
 *   node scripts/capture-docs-images.mjs login   # only the login shot
 *   node scripts/capture-docs-images.mjs staff   # only the staff shots
 */
import { chromium } from '@playwright/test'
import os from 'node:os'

const BASE = process.env.DOCS_BASE_URL || 'http://localhost:5173'
const IMAGES = new URL('../docs/images/', import.meta.url).pathname
// Failure-only debug shots go to the tmpdir so they never pollute docs/images/.
const DEBUG = (name) => `${os.tmpdir()}/mrk-capture-${name}.png`

const browser = await chromium.launch()
const SHOTS = new Set(process.argv.slice(2)) // e.g. `node capture-docs-images.mjs staff`
const want = (name) => SHOTS.size === 0 || SHOTS.has(name)

// ---- 1. Login page in PIN mode (public, no auth needed) ----
if (want('login')) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // match the 2880x1800 docs images
  })
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  // Switch to the PIN sign-in mode.
  await page.getByRole('button', { name: 'PIN', exact: true }).click()
  // Fill the identifier and tap two keypad digits so the dots show progress.
  await page.locator('input[autocomplete="username"]').fill('admin@mrkhotels.test')
  for (const digit of ['7', '2']) {
    await page.getByRole('button', { name: digit, exact: true }).click()
  }
  await page.waitForTimeout(250)
  // Card-only shot focused on the PIN keypad.
  await page.locator('.auth-card').screenshot({ path: `${IMAGES}login-pin.png` })
  console.log('saved docs/images/login-pin.png')
  await page.close()
}

// ---- 2. Staff page + Set-PIN modal ----
if (want('staff')) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  page.setDefaultTimeout(15000)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  // Wait for the form to mount, then fill + submit via the real submit button.
  const emailInput = page.getByPlaceholder(/enter your email/i)
  const passwordInput = page.getByPlaceholder(/enter your password/i)
  await emailInput.waitFor({ state: 'visible' })
  await emailInput.fill('admin@mrkhotels.test')
  await passwordInput.fill('password')
  await page.locator('form button[type="submit"]').click()
  // The app redirects to /app on success; if it stalls, capture the auth state.
  try {
    await page.waitForURL(/\/app/, { timeout: 15000 })
  } catch {
    const state = await page.evaluate(() => ({
      email: document.querySelector('input[type="email"]')?.value,
      serverErrors: [...document.querySelectorAll('.server-error')].map((e) => e.textContent.trim()),
      token: !!localStorage.getItem('token'),
      url: location.href,
    }))
    await page.screenshot({ path: DEBUG('login') })
    throw new Error(`Login did not redirect to /app — ${JSON.stringify(state)} (debug shot: ${DEBUG('login')})`)
  }

  // Navigate to the staff page INSIDE the SPA via the Vue router (a hard
  // page.goto reload re-runs the guest guard before /auth/me resolves in
  // headless dev mode and bounces back to /login). Expose the router through
  // the app's root component instance.
  await page.evaluate(async () => {
    const app = document.querySelector('#app').__vue_app__
    const router = app.config.globalProperties.$router
    await router.push('/app/staff')
  })
  await page.waitForURL(/\/app\/staff/, { timeout: 15000 })

  // The staff table uses `.table tbody tr`; wait for it, but if it never
  // appears (e.g. no rows rendered) dump a debug screenshot so the failure
  // is diagnosable instead of a bare timeout.
  try {
    await page.waitForSelector('.table tbody tr', { timeout: 15000 })
  } catch {
    await page.screenshot({ path: DEBUG('staff') })
    throw new Error(`Staff table never rendered — debug shot: ${DEBUG('staff')}`)
  }

  // Viewport-sized shot of the staff page itself (matches the framing of the
  // existing app-*.png captures) — the row actions now include "Set PIN".
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${IMAGES}app-staff.png` })
  console.log('saved docs/images/app-staff.png')

  // Open the Set PIN action on a manageable (non-self) staff row; hidden
  // per-row buttons are display:none in this UI, so strict mode is safe.
  await page.getByRole('button', { name: /set pin/i }).first().click()
  await page.waitForSelector('.modal-pin')
  // Pre-fill both masked PIN fields so the modal shows a completed entry.
  const pinInputs = page.locator('.modal-pin input.pin-input')
  await pinInputs.nth(0).fill('1234')
  await pinInputs.nth(1).fill('1234')
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${IMAGES}app-staff-set-pin.png` })
  console.log('saved docs/images/app-staff-set-pin.png')
  await page.close()
}

await browser.close()
console.log('Done.')
