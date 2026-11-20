import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const portalLogin = readFileSync('src/pages/portal/PortalLoginPage.vue', 'utf8')

describe('portal login', () => {
  it('marks the request as a portal login so the API can restrict staff', () => {
    expect(portalLogin).toContain('portal_login: true')
  })
})
