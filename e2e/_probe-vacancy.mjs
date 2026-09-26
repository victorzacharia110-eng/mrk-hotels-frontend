import { chromium } from 'playwright'
const TARGET = process.env.CI ? 'http://localhost:4173' : 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(TARGET + '/login')
await page.locator('input[type="email"]').fill('reception@mrkhotels.test')
await page.locator('input[type="password"]').fill('password')
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForURL(/\/app$/, { timeout: 30000 })
await page.goto(TARGET + '/app')

for (const i = 0; i < 5; i++) {
  const close = page.locator('.alert-modal-close,.notification-modal-close').first()
  if (!(await close.isVisible().catch(() => false))) break
  await close.click(); await page.waitForTimeout(300)
}

const grid = page.locator('.sv-board')
await grid.waitFor({ state: 'visible', timeout: 20000 })
const bars = page.locator('.sv-bar')
await bars.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2500)

const buttons = page.locator('.sv-room-cell, .sv-room-cell button')
const data = await page.locator('.sv-board-body .sv-room-track').evaluateAll((rows) =>
  rows.map((r) => {
    const num = r.querySelector('.sv-room-cell')?.textContent?.trim().match(/\d+/)?.[0]
    const cells = [...r.querySelectorAll('.sv-cell-bg')]
    const day0 = cells.find((c) => c.classList.contains('today'))
    const day1 = day0?.nextElementSibling
    const bars = [...r.querySelectorAll('.sv-bar')].map((b) => ({
      txt: b.textContent.trim(),
      cls: [...b.classList].join(' '),
      area: b.style.gridArea,
    }))
    return {
      num,
      day0Vacant: day0?.classList.contains('vacant') ?? null,
      day1Vacant: day1?.classList.contains('vacant') ?? null,
      bars,
    }
  })
)
console.log('=== rooms with any today/tomorrow vacancy + their bars ===')
for (const d of data) {
  if (!d.day0Vacant && !d.day1Vacant) continue
  console.log(`room ${d.num}: todayVacant=${d.day0Vacant} tomorrowVacant=${d.day1Vacant}`)
  for (const b of d.bars) console.log(`    bar {${b.txt}} [${b.cls}] ${b.area}`)
}
console.log('\npage errors:', errors.length ? errors.slice(0,3) : 'none')
await browser.close()
