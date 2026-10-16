import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import i18n from '@/locales/i18n'
import { moduleByKey } from '@/config/modules'
import BackOfficePage from '@/pages/backoffice/BackOfficePage.vue'

/**
 * The Back Office follow-up: the sidebar dropdown used to expand only inside
 * the drawer and each of its entries redirected to one editor. It now opens a
 * page that files every editor under an accordion — the pattern the POS
 * Reports browser uses — and the sidebar carries one link instead of a group.
 */

const STORE_LAYOUT_SRC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../layouts/StoreLayout.vue'),
  'utf8',
)

async function mountAs(role) {
  setActivePinia(createPinia())

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/app/back-office')
  await router.isReady()

  const wrapper = mount(BackOfficePage, {
    global: {
      plugins: [i18n, router, createPinia()],
      stubs: { RouterLink: RouterLinkStub },
    },
  })

  const { useAuthStore } = await import('@/stores/auth')
  useAuthStore().user = { user_role: role, name: 'Test User' }
  await flushPromises()

  return { wrapper }
}

const sections = (wrapper) => wrapper.findAll('.bo-acc')
const heads = (wrapper) => wrapper.findAll('.bo-acc-head')
const openIndices = (wrapper) =>
  sections(wrapper).map((s, i) => (s.classes().includes('open') ? i : -1)).filter((i) => i !== -1)

describe('Back Office page holds the accordion groups', () => {
  beforeEach(() => vi.clearAllMocks())

  it('files the editors under accordions instead of a flat tile grid', async () => {
    const { wrapper } = await mountAs('hotel_admin')

    // Property & Brand / Operations / Staff & Access / Data.
    const labels = heads(wrapper).map((h) => h.text())
    expect(sections(wrapper).length).toBe(4)
    expect(labels[0]).toContain('Property & Brand')
    expect(labels[2]).toContain('Staff & Access')
    expect(labels[3]).toContain('Data')
  })

  it('opens the first group on load, like the POS Reports browser', async () => {
    const { wrapper } = await mountAs('hotel_admin')

    expect(openIndices(wrapper)).toEqual([0])
  })

  it('keeps exactly one accordion open, and a second click closes it', async () => {
    const { wrapper } = await mountAs('hotel_admin')

    await heads(wrapper)[2].trigger('click')
    expect(openIndices(wrapper)).toEqual([2])

    await heads(wrapper)[2].trigger('click')
    expect(openIndices(wrapper)).toEqual([])
  })

  it('reports the open state to assistive tech', async () => {
    const { wrapper } = await mountAs('hotel_admin')

    expect(heads(wrapper)[0].attributes('aria-expanded')).toBe('true')
    expect(heads(wrapper)[1].attributes('aria-expanded')).toBe('false')
  })

  it('points every tile at a page that exists in the real route table', async () => {
    const { wrapper } = await mountAs('hotel_admin')
    const appRouter = (await import('@/router')).default

    const links = wrapper.findAllComponents(RouterLinkStub)
    expect(links.length).toBeGreaterThan(0)

    // A tile whose target failed to resolve, or landed outside /app, would be a
    // dead link; the offenders are named rather than left to a bare `true`.
    const dead = links
      .map((link) => link.props('to'))
      .filter((to) => {
        const resolved = appRouter.resolve(to)
        return resolved.matched.length === 0 || !resolved.path.startsWith('/app/')
      })

    expect(dead.map((to) => JSON.stringify(to))).toEqual([])
  })
})

describe('Back Office accordions keep the role gates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('withholds Staff & Access and Data from the accountant', async () => {
    // staff / trusted-devices admit hotel_admin + manager, import admits
    // hotel_admin, so the accountant is left with the first two groups.
    const { wrapper } = await mountAs('accountant')
    const labels = heads(wrapper).map((h) => h.text())

    expect(sections(wrapper).length).toBe(2)
    expect(labels.some((l) => l.includes('Staff & Access'))).toBe(false)
    expect(labels.some((l) => l.includes('Data'))).toBe(false)
  })

  it('gives a manager every group but Data, which is hotel_admin-only', async () => {
    const { wrapper: admin } = await mountAs('hotel_admin')
    expect(sections(admin).length).toBe(4)
    expect(heads(admin).map((h) => h.text())[3]).toContain('Data')

    const { wrapper: manager } = await mountAs('manager')
    const labels = heads(manager).map((h) => h.text())
    expect(sections(manager).length).toBe(3)
    expect(labels.some((l) => l.includes('Data'))).toBe(false)
  })
})

describe('the sidebar opens Back Office as a link, not a dropdown', () => {
  it('no longer builds the drawer dropdown that only expanded in place', () => {
    expect(STORE_LAYOUT_SRC).not.toContain('management-back-office')
  })

  it('emits the Back Office module as a single link to its browser', () => {
    expect(STORE_LAYOUT_SRC).toContain("byKey['back-office'], exact: true")
  })

  it('agrees with the route the page is served on', async () => {
    const mod = moduleByKey('back-office')

    expect(mod).toBeDefined()
    expect(mod.to).toBe('/app/back-office')

    const appRouter = (await import('@/router')).default
    expect(appRouter.resolve({ name: 'hotel-back-office' }).path).toBe('/app/back-office')
  })
})
