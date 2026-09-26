import { chromium } from '@playwright/test'
import { isoKey } from '../e2e/helpers.js'

const TARGET = 'http://localhost:5173'

const browser = await chromium.launch()
const page = await browser.newPage()

await page.goto(TARGET + '/login')
await page.locator('input[type="email"]').fill('reception@mrkhotels.test')
await page.locator('input[type="password"]').fill('password')
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 })

await page.goto(TARGET + '/app')
const track = page.locator('.sv-room-track').first()
await track.waitFor({ state: 'visible', timeout: 25000 })
await page.waitForTimeout(1500)

const result = await page.evaluate(() => {
  const tbody = document.querySelector('.sv-room-tape tbody') || document.querySelector('tbody')
  const rows = Array.from(tbody.querySelectorAll('tr')).filter((tr) => tr.querySelector('.sv-room-cell'))
  const out = []
  for (const tr of rows) {
    const roomEl = tr.querySelector('.sv-room-cell')
    const roomText = roomEl ? roomEl.innerText.trim() : ''
    const roomNum = (roomText.match(/(\d+)/) || [])[1]
    const track = tr.querySelector('.sv-room-track') || tr
    const cells = Array.from(track.querySelectorAll('.sv-cell-bg'))
    const which = ['day-today', 'day-tomorrow']
    const dayInfo = cells.map((c, i) => ({ i, cls: c.className }))
    const hasBarToday = !!track.querySelector('.sv-bar[data-today]') ||
      Array.from(track.querySelectorAll('.sv-bar')).some((b) => {
        const ga = b.style.gridArea
        const m = /(\d+)\s*\/\s*(\d+)\s*\/\s*\w+\s*\/\s*span\s+(\d+)/.exec(ga || '')
        if (!m) return false
        return Number(m[2]) <= 3 && Number(m[2]) + Number(m[3]) - 1 >= 4
      })
    out.push({ room: roomNum, cells: dayInfo.map((c) => c.cls), bars: Array.from(track.querySelectorAll('.sv-bar')).map((b) => ({ t: b.innerText.trim(), ga: b.style.gridArea, cls: b.className })) })
  }
  return out
})

console.log('=== BOARD TODAY/TOMORROW VACANCY vs BARS ===')
for (const row of result) {
  const c0 = row.cells[0] || ''
  const c1 = row.cells[1] || ''
  const todayVacant = c0.includes('vacant') && c1.includes('vacant')
  const barToday = row.bars.some((b) => b.ga && !b.ga.includes('100'))
  console.log(
    `${row.room}  today=${todayVacant ? 'VACANT' : 'OCCUPIED'}  [cells=${c0} | ${c1}]  bars=${row.bars.length ? row.bars.map((b) => `${b.t}:${b.ga}`).join(' · ') : 'none'}`,
  )
}
await browser.close()