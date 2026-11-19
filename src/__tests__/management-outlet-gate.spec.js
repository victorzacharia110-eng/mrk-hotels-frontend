import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const layout = readFileSync(resolve(process.cwd(), 'src/layouts/StoreLayout.vue'), 'utf8')

describe('management outlet gate', () => {
  it('skips the post-login gate through roleNeedsOutletGate', () => {
    const opener = layout.slice(
      layout.indexOf('async function openOutletGateIfNeeded'),
      layout.indexOf('function chooseType'),
    )

    expect(opener).toContain('roleNeedsOutletGate(authStore.user?.user_role)')
  })
})
