import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { nextTick } from 'vue'
import i18n from '@/locales/i18n'
import en from '@/locales/en.json'
import sw from '@/locales/sw.json'
import { moduleByKey } from '@/config/modules'
import BackOfficePage from '@/pages/backoffice/BackOfficePage.vue'
import ReportBrowserLayout from '@/components/reports/ReportBrowserLayout.vue'

/**
 * The Back Office opens in the same Reports-browser shell the POS Reports page
 * uses: a category tree on the left (Property / Operations / Staff & Access /
 * Data) and a detail paper on the right. Picking an editor shows what it
 * controls plus an Open action that routes to the real page — the sidebar
 * carries one link instead of a dropdown.
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

const cats = (wrapper) => wrapper.findAll('.rb-cat')
const catHeads = (wrapper) => wrapper.findAll('.rb-cat-head')
const leaves = (wrapper) => wrapper.findAll('.rb-report')
const activeLeaf = (wrapper) => wrapper.find('.rb-report.active')

describe('Back Office presents the editors in the Reports-browser shell', () => {
  beforeEach(() => vi.clearAllMocks())

  it('files the editors under the report categories instead of a flat grid', async () => {
    const { wrapper } = await mountAs('hotel_admin')

    // Property & Brand / Operations / Staff & Access / Data.
    const labels = catHeads(wrapper).map((h) => h.text())
    expect(cats(wrapper).length).toBe(4)
    expect(labels[0]).toContain('Property & Brand')
    expect(labels[2]).toContain('Staff & Access')
    expect(labels[3]).toContain('Data')
  })

  it('opens the first category and selects the first editor on load', async () => {
    const { wrapper } = await mountAs('hotel_admin')

    expect(cats(wrapper)[0].classes()).toContain('open')
    expect(activeLeaf(wrapper).text()).toContain('Hotel Business Details')
    expect(wrapper.find('.bo-detail-desc').text()).toContain('Name, logo, motto')
  })

  it('shows the picked editor with a group label and an Open action', async () => {
    const { wrapper } = await mountAs('hotel_admin')

    // Property → Rates & Prices is the second Editor leaf.
    await leaves(wrapper)[1].trigger('click')
    await nextTick()

    expect(wrapper.find('.bo-detail-title').text()).toBe('Rates & Prices')
    expect(wrapper.find('.bo-detail-group').text()).toBe('Property & Brand')
    expect(wrapper.findComponent(RouterLinkStub).props('to')).toEqual({ name: 'hotel-rooms' })
  })

  it('keeps only the jump-to tool, dropping the report-only buttons', async () => {
    const { wrapper } = await mountAs('hotel_admin')

    expect(wrapper.find('.rb-quick').exists()).toBe(true)
    expect(wrapper.find('button[title="reportBrowser.print"]').exists()).toBe(false)
    expect(wrapper.find('button[title="reportBrowser.export"]').exists()).toBe(false)
    expect(wrapper.find('button[title="reportBrowser.openWindow"]').exists()).toBe(false)
  })

  it('filters the tree from the search box', async () => {
    const { wrapper } = await mountAs('hotel_admin')
    const layout = wrapper.findComponent(ReportBrowserLayout)

    layout.vm.$emit('search', 'printer')
    await nextTick()

    expect(cats(wrapper).length).toBe(1)
    expect(leaves(wrapper).length).toBe(1)
    expect(leaves(wrapper)[0].text()).toContain('Printer')
  })

  it('points every Open action at a page that exists in the real route table', async () => {
    const { wrapper } = await mountAs('hotel_admin')
    const appRouter = (await import('@/router')).default

    const count = leaves(wrapper).length
    expect(count).toBeGreaterThan(0)

    // A tile whose target failed to resolve, or landed outside /app, would be a
    // dead link; the offenders are named rather than left to a bare `true`.
    const dead = []
    for (let i = 0; i < count; i += 1) {
      await leaves(wrapper)[i].trigger('click')
      await nextTick()

      const to = wrapper.findComponent(RouterLinkStub).props('to')
      const resolved = appRouter.resolve(to)
      if (resolved.matched.length === 0 || !resolved.path.startsWith('/app/')) {
        dead.push(JSON.stringify(to))
      }
    }

    expect(dead).toEqual([])
  })
})

describe('Back Office browser keeps the role gates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('withholds Staff & Access and Data from the accountant', async () => {
    // staff / trusted-devices admit hotel_admin + manager, import admits
    // hotel_admin, so the accountant is left with the first two groups.
    const { wrapper } = await mountAs('accountant')
    const labels = catHeads(wrapper).map((h) => h.text())

    expect(cats(wrapper).length).toBe(2)
    expect(labels.some((l) => l.includes('Staff & Access'))).toBe(false)
    expect(labels.some((l) => l.includes('Data'))).toBe(false)
  })

  it('gives a manager every group but Data, which is hotel_admin-only', async () => {
    const { wrapper: admin } = await mountAs('hotel_admin')
    expect(cats(admin).length).toBe(4)
    expect(catHeads(admin).map((h) => h.text())[3]).toContain('Data')

    const { wrapper: manager } = await mountAs('manager')
    const labels = catHeads(manager).map((h) => h.text())
    expect(cats(manager).length).toBe(3)
    expect(labels.some((l) => l.includes('Data'))).toBe(false)
  })
})

describe('the header offers a way back to the Back Office', () => {
  it('shows a chip that routes to the Back Office browser', () => {
    const chipLine = STORE_LAYOUT_SRC.split('\n').find((line) => line.includes('class="bo-back"'))
    expect(chipLine, 'Back Office return chip').toBeDefined()
    expect(chipLine).toContain("name: 'hotel-back-office'")
  })

  it('only shows it after leaving the Back Office, and clears on return', () => {
    expect(STORE_LAYOUT_SRC).toContain("else if (from === '/app/back-office') backToBackOffice.value = true")
    expect(STORE_LAYOUT_SRC).toContain("if (to === '/app/back-office') backToBackOffice.value = false")
  })

  it('has the return label in both languages', () => {
    expect(en.backOffice.backToBackOffice).toBeTruthy()
    expect(sw.backOffice.backToBackOffice).toBeTruthy()
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
