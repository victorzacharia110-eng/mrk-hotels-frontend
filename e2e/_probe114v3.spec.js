import { test } from '@playwright/test'
import { signIn } from './helpers.js'
import { openBoard, dismissAlerts } from './stay-workflow-helpers.js'

test('read room 114 today+tomorrow painted classes (settled)', async ({ page }) => {
  await signIn(page, { email: 'reception@mrkhotels.test', password: 'password' })
  await openBoard(page)
  await page.locator('.sv-bar').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(3500)
  await dismissAlerts(page)

  const out = await page.evaluate(() => {
    const pad = (n) => String(n).padStart(2, '0')
    const d0 = new Date()
    const todayIso = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`
    const d1 = new Date(); d1.setDate(d1.getDate() + 1)
    const tomorrowIso = `${d1.getFullYear()}-${pad(d1.getMonth() + 1)}-${pad(d1.getDate())}`

    const tracks = Array.from(document.querySelectorAll('.sv-room-track'))
    const summary = []
    const hits = []
    for (const tr of tracks) {
      const numEl = tr.querySelector('.sv-room-number')
      const num = numEl ? numEl.textContent.trim() : '(no number el)'
      const cells = Array.from(tr.querySelectorAll('.sv-cell-bg')).map((c) => c.className)
      const bars = Array.from(tr.querySelectorAll('.sv-bar')).map((b) => ({
        cls: b.className,
        title: b.getAttribute('title') || '',
        label: (b.querySelector('.sv-bar-label, span') || b).textContent.trim(),
      }))
      const holes = tr.getAttribute('data-room-id') || tr.dataset.sscid || ''
      summary.push({ num, cells, bars, holes })
      if (num === '114') hits.push({ num, cells, bars, holes })
    }
    return { todayIso, tomorrowIso, summary, hits }
  })

  console.log('today=' + out.todayIso + '  tomorrow=' + out.tomorrowIso)
  console.log('total tracks scanned: ' + out.summary.length)
  for (const h of out.hits) {
    console.log('ROOM 114:')
    console.log('  cells today:   ' + (h.cells[0] || '(none)'))
    console.log('  cells tomorrow:' + (h.cells[1] || '(none)'))
    console.log('  bars: ' + JSON.stringify(h.bars))
  }
  if (!out.hits.length) {
    console.log('--- first 4 tracks (to see nesting) ---')
    for (const s of out.summary.slice(0, 4)) console.log(JSON.stringify(s))
  }
})
