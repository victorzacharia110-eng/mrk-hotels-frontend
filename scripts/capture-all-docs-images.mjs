/* global process */
/**
 * capture-all-docs-images.mjs
 * Regenerates every screenshot referenced by the manuals and developer docs
 * from the CURRENT running app (dev server on 5173 + API on 8000).
 *
 *   node scripts/capture-all-docs-images.mjs            # everything
 *   node scripts/capture-all-docs-images.mjs public      # public/portal login pages
 *   node scripts/capture-all-docs-images.mjs staff       # /app feature pages
 *   node scripts/capture-all-docs-images.mjs owner       # /owner + /portal
 *   node scripts/capture-all-docs-images.mjs superadmin  # /superadmin pages
 *
 * Failure-only debug shots go to the tmpdir; they never pollute docs/images/.
 */
import { chromium } from '@playwright/test'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const BASE = process.env.DOCS_BASE_URL || 'http://localhost:5173'
const IMAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'images')
const DEBUG = (name) => `${os.tmpdir()}/mrk-capture-${name}.png`

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})
const SCOPE = new Set(process.argv.slice(2))
// Scope aliases: a page family (first dash-segment) is captured when any of its
// scope keywords is requested. 'staff' and 'app' both cover /app/* pages.
const FAMILY = {
  app: ['app', 'staff'],
  owner: ['owner'],
  portal: ['owner', 'portal', 'public'],
  public: ['public'],
  superadmin: ['superadmin'],
}
const want = (name) => {
  if (SCOPE.size === 0) return true
  const family = FAMILY[name.split('-')[0]] || [name]
  return (SCOPE.has(name) || family.some((k) => SCOPE.has(k)))
}
// Gate a whole block (e.g. the staff block) when ANY of its captured names was
// requested directly — so `node capture.mjs app-messages-composer` runs just
// that name despite `want()` matching the whole 'app' family.
const blockWanted = (families) =>
  SCOPE.size === 0 ||
  families.some((f) => (FAMILY[f] || [f]).some((k) => SCOPE.has(k)) || [...SCOPE].some((n) => n.split('-')[0] === f))

// The API token lives in sessionStorage (see src/stores/auth.js), which is
// per-tab — so every capture gets its own page AND its own fresh login. The
// local API's auth limiter allows ~30 sign-ins per 15 min; starting a pass
// with `php artisan cache:clear` resets that budget (see README notes).
async function newPage() {
  const page = await context.newPage()
  page.setDefaultTimeout(45_000)
  return page
}

async function login(page, email, password, landing) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder(/enter your email/i).waitFor({ state: 'visible' })
  await page.getByPlaceholder(/enter your email/i).fill(email)
  await page.getByPlaceholder(/enter your password/i).fill(password)
  await page.locator('form button[type="submit"]').click()
  await page.waitForURL(new RegExp(landing), { timeout: 45_000 })
  await page.waitForTimeout(2000)
}

async function go(page, path) {
  await page.waitForFunction(
    () => !!document.querySelector('#app')?.__vue_app__,
    undefined,
    { timeout: 15_000 },
  )
  await page.evaluate(async (p) => {
    const app = document.querySelector('#app').__vue_app__
    await app.config.globalProperties.$router.push(p)
  }, path)
  await page.waitForTimeout(2000)
}

async function firstHref(page, pattern) {
  const href = await page
    .locator(`a[href]`)
    .evaluateAll((as, pat) => {
      const re = new RegExp(pat)
      const found = as.map((a) => (a.getAttribute('href') || '')).find((h) => re.test(h))
      return found || null
    }, pattern.source)
  if (!href) throw new Error(`no link matching ${pattern} on ${page.url()}`)
  return href
}

async function shot(page, name, opts = {}) {
  const { selector, target } = opts
  const file = path.join(IMAGES, `${name}.png`)
  if (selector) {
    const el = page.locator(selector)
    await el.evaluate((e) => e.scrollIntoView?.())
    await el.screenshot({ path: file }).catch(async () => {
      // Modal overlays can't scroll; fall back to a full-page shot.
      await page.screenshot({ path: file })
    })
  } else if (target) {
    await target.screenshot({ path: file })
  } else {
    await page.screenshot({ path: file, fullPage: false })
  }
  console.log(`saved docs/images/${name}.png`)
}

const failures = []
async function capture(name, fn) {
  if (!want(name.split('-')[0]) && !want(name)) return
  for (let attempt = 1; attempt <= 2; attempt++) {
    const page = await newPage()
    try {
      await fn(page)
      await shot(page, name)
      await page.close()
      await new Promise((r) => setTimeout(r, 800))
      return
    } catch (err) {
      await page.screenshot({ path: DEBUG(name) }).catch(() => {})
      await page.close()
      if (attempt === 2) failures.push(`${name}: ${err.message}`)
      else await new Promise((r) => setTimeout(r, 4000))
    }
  }
}

// ================= PUBLIC / AUTH =================
if (blockWanted(['public','portal'])) {
  await capture('public-home', async (page) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.hotel-card, main, [class*="hotel"]', { timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(1500)
  })

  await capture('public-hotel', async (page) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const href = await firstHref(page, /\/hotels\/[0-9a-f-]{8,}/)
    await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
  })

  await capture('login', async (page) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.getByPlaceholder(/enter your email/i).waitFor({ state: 'visible' })
    await page.waitForTimeout(500)
  })

  await capture('portal-login', async (page) => {
    await page.goto(`${BASE}/portal/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
  })

  await capture('portal-register', async (page) => {
    await page.goto(`${BASE}/portal/register`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
  })

  await capture('portal-pricing', async (page) => {
    await page.goto(`${BASE}/portal/pricing`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
  })

  // PIN-mode login card (mirrors the original capture).
  await capture('login-pin', async (page) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'PIN', exact: true }).click()
    await page.locator('input[autocomplete="username"]').fill('cashier@mrkhotels.test')
    for (const digit of ['7', '2']) {
      await page.getByRole('button', { name: digit, exact: true }).click()
    }
    await page.waitForTimeout(250)
  })
}

// ================= STAFF APP (hotel admin, MRK Grand) =================
if (blockWanted(['app'])) {
  const staff = async (page) => {
    await login(page, 'admin@mrkhotels.test', 'password', '/app')
  }

  await capture('app', async (page) => {
    await staff(page)
    await page.waitForSelector('.kpi-card, main, .dashboard', { timeout: 20_000 }).catch(() => {})
  })

  const ROUTES = [
    ['app-overview', '/app/overview'],
    ['app-reservations', '/app/reservations'],
    ['app-rooms', '/app/rooms'],
    ['app-guests', '/app/guests'],
    ['app-payments', '/app/payments'],
    ['app-booking-requisitions', '/app/booking-requisitions'],
    ['app-housekeeping', '/app/housekeeping'],
    ['app-orders', '/app/orders'],
    ['app-statuses', '/app/statuses'],
    ['app-menu', '/app/menu'],
    ['app-laundry', '/app/laundry'],
    ['app-fun-games', '/app/fun-games'],
    ['app-inventory', '/app/inventory'],
    ['app-suppliers', '/app/suppliers'],
    ['app-requisitions', '/app/requisitions'],
    ['app-purchase-orders', '/app/purchase-orders'],
    ['app-goods-received', '/app/goods-received'],
    ['app-reports', '/app/reports'],
    ['app-profile', '/app/profile'],
  ]
  for (const [name, route] of ROUTES) {
    await capture(name, async (page) => {
      await staff(page)
      await go(page, route)
      await page.waitForTimeout(1200)
    })
  }

  await capture('app-staff', async (page) => {
    await staff(page)
    await go(page, '/app/staff')
    await page.waitForSelector('.table tbody tr', { timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(500)
  })

  // Set-PIN modal open (default: auto-generated PIN display).
  if (want('app-staff-set-pin')) await capture('app-staff-set-pin', async (page) => {
    await staff(page)
    await go(page, '/app/staff')
    await page.waitForSelector('.table tbody tr', { timeout: 20_000 }).catch(() => {})
    await page.getByRole('button', { name: /set pin/i }).first().click()
    await page.waitForSelector('.modal-pin')
    await page.waitForTimeout(500)
  })

  // Opens (or creates) a direct thread with the first MRK Grand staff member
  // that shows up in the recipient search, then sends a short message so the
  // thread actually has content ("brand new pictures" with real data).
  async function openThread(page) {
    await staff(page)
    await go(page, '/app/messages')
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: /new message/i }).first().click()
    await page.locator('.modal-overlay input[placeholder*="olleague"], .modal-overlay input[placeholder*="Search across"]').first()
      .fill('a')
    await page.waitForSelector('.user-results .user-result', { timeout: 15_000 }).catch(() => {})
    await page.locator('.user-results .user-result').first().click()
    await page.waitForSelector('.chat-composer', { timeout: 30_000 })
    await page.waitForTimeout(1000)
  }

  async function sayHi(page) {
    const txt = page.locator('.chat-composer textarea, .chat-composer input[type="text"]').first()
    await txt.fill('Good morning team — have a wonderful shift!')
    await page.locator('.chat-composer button.composer-send, form.chat-composer button[type="submit"]').first().click()
    await page.waitForTimeout(1500)
  }

  if (want('app-messages')) await capture('app-messages', async (page) => {
    await openThread(page)
    await sayHi(page)
  })

  if (want('app-messages-composer')) await capture('app-messages-composer', async (page) => {
    await openThread(page)
    await sayHi(page)
    await page.locator('.composer-tools .icon-btn, .composer-tools button').evaluateAll(async (btns) => {
      const hit = btns.find((b) => /poll/i.test(b.title))
      hit?.click()
    })
    await page.waitForTimeout(500)
  })

  // Messages: workspace modal + (best-effort) meetings/SOS/composer states.
  await capture('app-messages-workspace', async (page) => {
    await staff(page)
    await go(page, '/app/messages')
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: /workspace/i }).first().click()
    await page.waitForSelector('.workspace-modal')
    await page.waitForTimeout(400)
  })

  for (const [name, label] of [
    ['app-messages-meetings', /meetings?/i],
    ['app-messages-sos', /sos/i],
  ]) {
    await capture(name, async (page) => {
      await staff(page)
      await go(page, '/app/messages')
      await page.waitForTimeout(1000)
      await page.getByRole('button', { name: /workspace/i }).first().click()
      await page.waitForSelector('.workspace-modal')
      const tab = page.locator('.workspace-tabs button, .workspace-tabs [role="tab"], .workspace-tabs a').filter({ hasText: label })
      if (await tab.count()) {
        await tab.first().click()
      }
      await page.waitForTimeout(400)
    })
  }
}

// ================= OWNER + PORTAL =================
if (blockWanted(['owner','portal'])) {
  const owner = async (page) => {
    await login(page, 'owner@mrkhotels.test', 'password', '/owner')
  }

  await capture('owner-dashboard', async (page) => {
    await owner(page)
    await page.waitForSelector('.kpi-card, .table, main', { timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(1200)
  })

  await capture('owner-hotel-detail', async (page) => {
    await owner(page)
    await page.waitForTimeout(2000)
    const href = await firstHref(page, /\/owner\/hotels\/[0-9a-f-]{8,}/)
    await go(page, href.startsWith('/') ? href : `/${href}`)
    await page.waitForTimeout(2000)
  })

  await capture('owner-profile', async (page) => {
    await owner(page)
    await go(page, '/owner/profile')
  })

  await capture('portal-dashboard', async (page) => {
    await owner(page)
    await go(page, '/portal')
  })
}

// ================= SUPERADMIN =================
if (blockWanted(['superadmin'])) {
  const admin = async (page) => {
    await login(page, 'superadmin@mrkhotels.com', 'Victorzacharia58362795#', '/superadmin')
  }

  await capture('superadmin', async (page) => {
    await admin(page)
    await page.waitForSelector('.kpi-card, main', { timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(1500)
  })

  await capture('superadmin-tenants', async (page) => {
    await admin(page)
    await go(page, '/superadmin/tenants')
  })

  await capture('superadmin-tenant', async (page) => {
    await admin(page)
    await go(page, '/superadmin/tenants')
    await page.waitForTimeout(2500)
    const href = await firstHref(page, /\/superadmin\/tenants\/[0-9a-f-]{8,}/)
    await go(page, href.startsWith('/') ? href : `/${href}`)
    await page.waitForTimeout(2000)
  })

  await capture('superadmin-reports', async (page) => {
    await admin(page)
    await go(page, '/superadmin/reports')
  })

  await capture('superadmin-profile', async (page) => {
    await admin(page)
    await go(page, '/superadmin/profile')
  })
}

await browser.close()

if (failures.length) {
  console.error(`\n${failures.length} capture(s) failed:`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exitCode = 1
} else {
  console.log('All captures succeeded.')
}