import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { REVIEW_GROUPS, reviewCounts } from '@/data/panelReview'
import { moduleByKey } from '@/config/modules'

/**
 * The manager panel review answered in one page. This guards the things that
 * would quietly rot it:
 *
 *  - a point that loses its plain-language problem or its "where to see it",
 *    which is the two things the page exists to carry;
 *  - an invalid status, which would render an unstyled badge;
 *  - the page becoming unreachable, since the whole point is that a signed-in
 *    user can find it;
 *  - and a locale key going missing, which is what actually happens to a page
 *    like this six months later.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(resolve(root, rel), 'utf8')

const items = REVIEW_GROUPS.flatMap((g) => g.items)

describe('panel review record', () => {
  it('answers every raised point in plain language', () => {
    // The audience is a hotel manager. A point with no "what was wrong" or no
    // "where to see it" is a code change written up for a developer, which is
    // the failure mode this page exists to prevent.
    for (const item of items) {
      expect(item.ask, `${item.ref} is missing the review question`).toBeTruthy()
      expect(item.problem, `${item.ref} does not explain the problem`).toBeTruthy()
      expect(item.solution, `${item.ref} does not explain the change`).toBeTruthy()
      expect(item.where, `${item.ref} does not say where to see the result`).toBeTruthy()
    }
  })

  it('keeps every status renderable', () => {
    for (const item of items) {
      expect(['done', 'partial', 'open']).toContain(item.status)
    }
  })

  it('counts what is done and what is outstanding', () => {
    const counts = reviewCounts()
    expect(counts.total).toBe(items.length)
    expect(counts.done + counts.partial + counts.open).toBe(counts.total)
  })

  it('does not claim the stop-sell calendar is finished', () => {
    // Rooms 6 asks for a calendar layout across several days. It is not built,
    // so it stays visible as open. If someone builds it, this test is the
    // reminder to update the status rather than leave a stale claim.
    const calendar = items.find((i) => i.ask.includes('calendar'))
    expect(calendar?.status).toBe('open')
  })
})

describe('panel review page wiring', () => {
  it('is reachable by every signed-in role', () => {
    // "So that when logged in it could be easy to spot those changes" — a
    // module restricted to management would hide the answer from the
    // receptionist who raised half the points.
    const mod = moduleByKey('panel-review')
    expect(mod).toBeTruthy()
    expect(mod.roles).toEqual([])
    expect(mod.to).toBe('/app/panel-review')
  })

  it('is in the router and in every role drawer', () => {
    const router = read('router/index.js')
    expect(router).toContain("name: 'panel-review'")

    // Five role panels build their own list, so five entries.
    const entries = read('layouts/StoreLayout.vue')
      .split('\n')
      .filter((line) => /if \(byKey\['panel-review'\]\) out\.push\(byKey\['panel-review'\]\)/.test(line))
    expect(entries).toHaveLength(5)
  })

  it('has its labels in both languages', () => {
    for (const locale of ['en', 'sw']) {
      const messages = JSON.parse(read(`locales/${locale}.json`))
      expect(messages.panelReview, `${locale} has no panelReview block`).toBeTruthy()
      for (const key of ['title', 'intro', 'asked', 'problem', 'change', 'where', 'status_done']) {
        expect(messages.panelReview[key], `${locale} is missing panelReview.${key}`).toBeTruthy()
      }
    }
  })
})
