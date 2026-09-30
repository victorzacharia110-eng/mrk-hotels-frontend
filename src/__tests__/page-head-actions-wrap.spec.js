import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// jsdom does no layout, so the geometry of the action row is asserted on the
// stylesheet that ships. The behaviour itself was measured in a real browser:
// before the fix the export button sat off a 360px screen and, because `html`
// clips horizontal overflow, could not be scrolled back into view.
const css = readFileSync(resolve(process.cwd(), 'src/assets/base.css'), 'utf8')

function rule(selector) {
  const match = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))
  return match ? match[1] : ''
}

describe('Page header actions stay reachable', () => {
  it('lets the action row wrap instead of running off the screen', () => {
    // 39 pages put their buttons in this row, and the last one is the first to
    // be lost. A nowrap flex row cannot be rescued by scrolling, because the
    // page itself clips horizontal overflow.
    expect(rule('.head-actions')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('lets the header drop its actions onto their own line', () => {
    expect(rule('.page-head')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('keeps wrapped rows aligned with the heading', () => {
    expect(rule('.head-actions')).toMatch(/justify-content:\s*flex-end/)
  })

  it('does not depend on the page being scrollable to reach the last button', () => {
    // If this ever stops clipping, a nowrap row would merely be off-screen
    // instead of unreachable, and the fix above would stop being load-bearing.
    // Asserting it keeps the reason for the change recorded.
    expect(css).toMatch(/html\s*\{[^}]*overflow-x:\s*hidden/)
  })
})
