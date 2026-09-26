// Live-production probe for the folio-creditor / ledger-cards fix (a4f7acf).
// Awaits manual sign-in, opens the split stay, and compares the RENDERED ledger
// (panel cards, footer, switcher rows) against the raw folio() payload for both
// the current and the related folio. Run:
//   PROBE_GUEST=MALLYA node e2e/_probe-live-folio-flip.mjs
import { chromium } from 'playwright'

const BASE = 'https://mrk-hotels.com'
const GUEST = process.env.PROBE_GUEST || 'MALLYA'
const HEADFUL = process.env.PROBE_HEADLESS !== '1'

const browser = await chromium.launch({ headless: !HEADFUL })
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  serviceWorkers: 'block',
})
const page = await context.newPage()
page.setDefaultTimeout(45000)

page.on('console', (m) => {
  if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 300))
})
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 300)))

const folioPayloads = new Map()
page.on('response', async (res) => {
  const u = res.url()
  if (/\/folio(\/|$|\?)/.test(u)) {
    try {
      const j = await res.json()
      const rid = j?.reservation?.reservation_id ?? (u.match(/\/(\d+)\/folio/) || [])[1]
      folioPayloads.set(String(rid), j)
    } catch {}
  }
})

console.log(`\n>>> Opening ${BASE} — SIGN IN there (any staff account).\n`)
await page.goto(BASE, { waitUntil: 'domcontentloaded' })

const t0 = Date.now()
try {
  await page.waitForFunction(() => sessionStorage.getItem('auth_token'), null, { timeout: 5 * 60 * 1000 })
  console.log(`>>> Signed in after ${Math.round((Date.now() - t0) / 1000)}s. Opening the stay board...`)
  await page.waitForFunction(() => !location.pathname.includes('/login'), null, { timeout: 30000 }).catch(() => {})

  const searchBox = page.locator('.sv-search input[type="text"]')
  await searchBox.waitFor({ state: 'visible', timeout: 25000 })
  await page.waitForTimeout(3000)
  await searchBox.fill(GUEST)

  const bars = page.locator('.sv-bar')
  await bars.first().waitFor({ state: 'visible', timeout: 25000 })
  console.log(`   ${await bars.count()} bar(s). Opening each until the switcher appears...`)

  let switcher = null
  let openedCode = ''
  for (let b = 0; b < await bars.count(); b++) {
    await bars.nth(b).click()
    const ref = page.locator('.sv-folio-ref')
    try {
      await ref.waitFor({ state: 'visible', timeout: 12000 })
      openedCode = ((await ref.locator('strong').textContent()) || '').trim()
    } catch {}
    switcher = page.locator('.sv-folio-switch')
    try {
      await switcher.waitFor({ state: 'visible', timeout: 6000 })
    } catch {
      switcher = null
    }
    const tbl = page.locator('table.sv-folio-table')
    const hasLedger = await tbl.count() > 0 || false
    console.log(`   [${b}] folio ${openedCode} ${switcher ? '→ HAS switcher ✔' : (hasLedger ? '(no related; ledger shown)' : '(nothing loaded)')}`)
    if (switcher) break
    await page.locator('.sv-modal-close').first().click().catch(() => {})
    await page.waitForTimeout(900)
  }
  if (!switcher) {
    console.log('   !! No switcher found. Aborting.')
    await browser.close()
    process.exit(1)
  }

  await page.locator('.sv-panel-card').first().waitFor({ state: 'visible', timeout: 45000 }).catch(() => {})
  await page.waitForTimeout(1500)

  const summarize = (rid, j) => {
    const f = j?.folio || {}
    const entries = (j?.folio_entries || []).map((e) => ({ t: e.type, a: Number(e.amount || 0) }))
    const charges = entries.filter((e) => e.a > 0).reduce((s, e) => s + e.a, 0)
    const credits = entries.filter((e) => e.a < 0).reduce((s, e) => s + -e.a, 0)
    const payments = (j?.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
    return {
      rid,
      code: f.folio_code,
      header: { total_amount: f.total_amount, room_charges: f.room_charges, advance: f.advance_payment },
      ledgerFromEntries: { charges, credits, net: charges - credits },
      paymentsSum: payments,
      related: (j?.related_folios || []).map((r) => ({ rid: r.reservation_id, code: r.folio_code, balance_due: r.balance_due })),
    }
  }

  const readSwitchRow = async (i) => {
    const t = ((await switcher.locator('tbody tr').nth(i).locator('.sv-folio-row-type').textContent()) || '').trim()
    const code = ((await switcher.locator('tbody tr').nth(i).locator('td').first().locator('strong').textContent()) || '').trim()
    const nums = await switcher.locator('tbody tr').nth(i).locator('td').evaluateAll(
      (tds) => tds.map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()),
    )
    return { t, code, nums }
  }

  const snapshot = async (label) => {
    const rows = []
    for (let i = 0; i < await switcher.locator('tbody tr').count(); i++) rows.push(await readSwitchRow(i))
    const cards = (await page.locator('.sv-panel-card').allTextContents()).map((s) => s.replace(/\s+/g, ' ').trim())
    const footText = await page.locator('table.sv-folio-table tfoot').textContent().catch(() => '')
    const foot = (footText || '').replace(/\s+/g, ' ').trim()
    const nowViewing = ((await page.locator('.sv-folio-now-viewing').textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim()
    // Ground truth from the running component.
    const vm = await page.evaluate(() => {
      const root = document.querySelector('#app')?.__vue_app__?._instance
      const walk = (inst) => {
        if (!inst) return null
        const st = inst.setupState
        if (st && 'folioTotals' in st) return st
        if (inst.subTree && inst.subTree.children && Array.isArray(inst.subTree.children)) {
          for (const ch of inst.subTree.children) {
            const hit = walk(ch?.component)
            if (hit) return hit
          }
        }
        if (inst.subTree && inst.subTree.component) return walk(inst.subTree.component)
        if (inst.subTree && inst.subTree.type === 'div' && Array.isArray(inst.subTree.children)) {
          for (const ch of inst.subTree.children) {
            const hit = walk(ch?.component)
            if (hit) return hit
          }
        }
        return null
      }
      const st = walk(root)
      if (!st) return null
      const f = st.folio && st.folio.value
      const v = st.viewingFolio && st.viewingFolio.value
      const creditors = (st.folioEntries?.value || []).filter((e) => e.type === 'creditors_out')
      return {
        activeBarId: st.activeBar?.value?.id,
        viewingRid: v?.reservation?.reservation_id,
        viewingCode: (v?.folio || {}).folio_code,
        currentCode: f?.folio?.folio_code,
        activeFolioId: st.activeFolioId?.value,
        donorEmpty: st.donorEmptyFolio?.value,
        folioEntries: st.folioEntries?.value?.length,
        totals: st.folioTotals?.value,
        currentTotals: st.currentFolioTotals?.value,
        header: st.ledgerHeader?.value,
        related: (f?.related_folios || []).map((r) => ({ rid: r.reservation_id, code: r.folio_code, bd: r.balance_due })),
        creditors,
      }
    })
    console.log(`\n----- ${label} -----\n  nowViewing: ${nowViewing || '(current folio)'}`)
    rows.forEach((r) => console.log(`  switch ${r.t} | ${r.code} | cells`, JSON.stringify(r.nums)))
    console.log('  panelCards:', JSON.stringify(cards))
    console.log('  ledgerFoot:', foot)
    console.log('  vm:', JSON.stringify(vm))
    await page.screenshot({ path: `/tmp/opencode/live-${label.replace(/\W+/g, '-')}.png`, fullPage: true })
  }

  await snapshot('BEFORE-current')

  // Dump the current folio's raw payload + the ledger DOM rows.
  const curRid = ((await page.locator('.sv-folio-ref').textContent()) || '')
  console.log('\n=== Raw folio() payloads captured ===')
  for (const [rid, j] of folioPayloads) console.log('  ', JSON.stringify(summarize(rid, j)))
  const ledgerRows = await page.locator('table.sv-folio-table tbody tr').count()
  console.log('   ledger tbody rows:', ledgerRows)
  const descriptions = await page.locator('table.sv-folio-table tbody tr td').evaluateAll(
    (tds) => tds.map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()),
  )
  console.log('   ledger cells:', JSON.stringify(descriptions.slice(0, 40)))

  // Toggle to the related folio (01302) and re-snapshot.
  const relRow = switcher.locator('tbody tr').filter({ hasText: '01302' })
  console.log('\n=== Toggling related folio 01302 ===')
  if ((await relRow.count()) === 0) throw new Error('no 01302 row in the switcher')
  await relRow.locator('.sv-folio-view-btn').click()
  await page.locator('.sv-folio-now-viewing').waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(1800)
  await snapshot('WHILE-viewing-related')
  await page.locator('.sv-folio-return').click().catch(() => {})
  await page.waitForTimeout(2000)
  await snapshot('AFTER-return-current')

  console.log('\n=== Raw folio() payloads captured (post-toggle) ===')
  for (const [rid, j] of folioPayloads) console.log('  ', JSON.stringify(summarize(rid, j)))
} catch (err) {
  console.log('\n   !! Probe aborted:', String(err).slice(0, 500))
  await page.screenshot({ path: '/tmp/opencode/live-error.png', fullPage: true }).catch(() => {})
  process.exitCode = 1
} finally {
  await browser.close()
}