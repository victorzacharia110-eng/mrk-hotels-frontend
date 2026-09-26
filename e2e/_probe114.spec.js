import { test } from '@playwright/test'
import { signIn } from './helpers.js'
import { openBoard, dismissAlerts, barFor } from './stay-workflow-helpers.js'

test('probe room 114 board (settled, post-gate, today+tomorrow cells)', async ({ page }) => {
  await signIn(page, { email: 'reception@mrkhotels.test', password: 'password' })
  await openBoard(page)
  // settled: at least one bar + give pagination the room to finish
  await page.locator('.sv-bar').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(4000)
  await dismissAlerts(page)

  const out = await page.evaluate(() => {
    const pad = (n) => String(n).padStart(2, '0')
    const d0 = new Date()
    const todayIso = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`
    const d1 = new Date(); d1.setDate(d1.getDate() + 1)
    const tomorrowIso = `${d1.getFullYear()}-${pad(d1.getMonth() + 1)}-${pad(d1.getDate())}`

    const rows = Array.from(document.querySelectorAll('.sv-room-track'))
    const found = rows
      .map((row) => {
        const numEl = row.querySelector('.sv-room-num, [class*="room-num"]')
        const num = numEl ? numEl.textContent.trim() : '(none)'
        const bars = Array.from(row.querySelectorAll('.sv-bar')).map((b) => b.textContent.trim())
        const cells = Array.from(row.querySelectorAll('.sv-cell-bg')).map((c) => c.className)
        return { num, cells, bars }
      })
      .filter((r) => r.num === '114')
    const h = found[0] || null
    return {
      todayIso,
      tomorrowIso,
      rowCount: rows.length,
      hit: h && {
        num: h.num,
        bars: h.bars,
        todayCellCls: h.cells[0] || '',
        tomorrowCellCls: h.cells[1] || '',
      },
    }
  })

  console.log('ROW COUNT: ' + out.rowCount)
  console.log('today=' + out.todayIso + '  tomorrow=' + out.tomorrowIso)
  if (!out.hit) {
    console.log('room 114 row NOT FOUND on board')
    return
  }
  console.log('room114 bars: ' + JSON.stringify(out.hit.bars))
  console.log('room114 firstCell(bg today):  ' + out.hit.todayCellCls)
  console.log('room114 secondCell(bg tmrw):  ' + out.hit.tomorrowCellCls)
})
