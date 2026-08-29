/**
 * Shared helpers for the Playwright E2E suite. The app talks to the Laravel API
 * at VITE_API_URL (default http://localhost:8000/api), so tests hit that base.
 */
import { expect } from '@playwright/test'

export const API = globalThis.process?.env?.E2E_API_URL || 'http://localhost:8000/api'

// Demo accounts seeded by TenantSeeder; every staff role uses "password".
export const USERS = {
  admin: { email: 'admin@mrkhotels.test', password: 'password' },
  manager: { email: 'manager@mrkhotels.test', password: 'password' },
  reception: { email: 'reception@mrkhotels.test', password: 'password' },
  accountant: { email: 'accountant@mrkhotels.test', password: 'password' },
  housekeeping: { email: 'housekeeping@mrkhotels.test', password: 'password' },
  kitchen: { email: 'kitchen@mrkhotels.test', password: 'password' },
  cashier: { email: 'cashier@mrkhotels.test', password: 'password' },
  store: { email: 'inventory@mrkhotels.test', password: 'password' },
  procurement: { email: 'procurement@mrkhotels.test', password: 'password' },
  owner: { email: 'owner@mrkhotels.test', password: 'password' },
  superadmin: { email: 'superadmin@mrkhotels.test', password: 'SUPER ADMIN' },
}

/**
 * Sign in through the public login flow and wait for the redirect away from
 * /login. Returns nothing; the session lives in the page's localStorage.
 */
export async function signIn(page, { email, password, path = '/login' } = {}) {
  const creds = USERS[email] || { email, password }
  await page.goto(path)
  await page.locator('input[type="email"]').fill(creds.email)
  await page.locator('input[type="password"]').fill(creds.password || 'password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login') && !url.pathname.includes('/portal/login'), {
    timeout: 20_000,
  })
}

/**
 * Wire up error listeners. Any uncaught page error is collected so the test
 * can assert a page mounted cleanly. Failed requests are intentionally NOT
 * included (avatars/metrics icons can 404 without breaking a page); specs that
 * care about network failures track those explicitly.
 */
export function trackPageErrors(page) {
  const errors = []
  page.on('pageerror', (err) => errors.push('pageerror: ' + String(err && err.message ? err.message : err)))
  return errors
}

/**
 * Assert the page is not a login redirect, has real content and raised no
 * uncaught errors or failed API calls. The "not on login" check only applies
 * once a shell selector is given (auth areas) — public login pages legitimately
 * land on /login.
 */
export async function expectMounted(page, errors, shellSelector = 'body') {
  expect(errors, 'uncaught page/API errors').toEqual([])
  if (shellSelector !== 'body') {
    const url = page.url()
    expect(url, `must not bounce to login (got ${url})`).not.toMatch(/\/(login|portal\/login)(\?|$)/)
    await expect(page.locator(shellSelector).first()).toBeVisible({ timeout: 10_000 })
  }
  const text = (await page.evaluate(() => document.body.innerText)).trim()
  expect(text.length, 'page rendered as blank').toBeGreaterThan(40)
}

/**
 * Open a SearchableSelect (a .ss-trigger inside the label's .form-group) and
 * pick the option matching `optionRe`.
 */
export async function pickSelect(page, labelRe, optionRe) {
  const group = page.locator('.form-group').filter({ has: page.locator('label').filter({ hasText: labelRe }).first() }).first()
  await expect(group.locator('.ss-trigger')).toBeVisible()
  await group.locator('.ss-trigger').click()
  await expect(page.locator('.ss-panel').first()).toBeVisible()
  const opt = page.locator('.ss-panel [role="option"], .ss-panel li').filter({ hasText: optionRe }).first()
  await opt.click()
  await page.waitForTimeout(250)
}

/** ISO date `offset` days from today. */
export function isoDate(offset) {
  const d = new Date(Date.now() + offset * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * A future check-in/check-out window that drifts forward one day per calendar
 * day so repeated full-suite runs do not collide with rooms already held by
 * earlier runs or by manual probing. Each booking test passes its own base day
 * so the tests do not consume one another's rooms within a run.
 */
export function futureStay(day = 14) {
  const drift = Math.floor(Date.now() / 3_600_000) % 400
  const checkIn = isoDate(day + drift)
  return { checkIn, checkOut: isoDate(day + 2 + drift) }
}

/** Resolve a hotel's tenant_id from the public directory. */
export async function hotelId(client, name = 'MRK Grand Hotel') {
  const res = await client.get(`${API}/v1/public/hotels`)
  expect(res.ok()).toBeTruthy()
  const { hotels } = await res.json()
  const hotel = hotels.find((h) => h.hotel_name === name) || hotels[0]
  expect(hotel, `hotel "${name}" not found`).toBeTruthy()
  return hotel.tenant_id
}