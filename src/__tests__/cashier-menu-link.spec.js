import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import i18n from '@/locales/i18n'
import { canManageMenu, MENU_MANAGER_ROLES } from '@/utils/menuAccess'
import CashierLayout from '@/layouts/CashierLayout.vue'

vi.mock('@/api', () => ({
  fbDayCloseApi: { index: vi.fn().mockResolvedValue({ data: {} }) },
  cashierApi: { shift: vi.fn().mockResolvedValue({ data: {} }) },
  printerApi: { settings: vi.fn().mockResolvedValue({ data: {} }) },
  orderApi: { live: vi.fn().mockResolvedValue({ data: [] }) },
  authApi: { me: vi.fn().mockResolvedValue({ data: {} }) },
}))

/**
 * Mounts the cashier panel as `role`.
 *
 * Every link is stubbed rather than resolved. CashierLayout has 26 named
 * router-links and registering all of them would make this test a hostage to
 * unrelated route renames; what matters here is which link exists and what it
 * points at, so `to` is read straight off the stub.
 */
async function mountAs(role) {
  setActivePinia(createPinia())

  // Catch-all so `useRoute()` has something to read. The links are stubbed, so
  // no named route is ever resolved and the route table stays irrelevant here.
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/cashier')
  await router.isReady()

  const wrapper = mount(CashierLayout, {
    global: {
      plugins: [i18n, router, createPinia()],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
  await flushPromises()

  const { useAuthStore } = await import('@/stores/auth')
  useAuthStore().user = { user_role: role, name: 'Test User' }
  await flushPromises()

  return { wrapper }
}

/** The stubbed sidebar link whose `to` targets the given route name. */
const linkToRoute = (wrapper, name) =>
  wrapper
    .findAllComponents(RouterLinkStub)
    .find((l) => l.props('to')?.name === name)

/** The sidebar link to the menu page, if it was rendered. */
const menuLink = (wrapper) => linkToRoute(wrapper, 'hotel-menu')

describe('cashier panel -> menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /*
    Cashiers and bartenders were given menu management so they could correct a
    dish or a price themselves. The menu page renders in StoreLayout, though, so
    from the till panel the only route to it was typing the URL — the capability
    existed and was unreachable. These pin the link that closes that gap.
  */

  it('offers the menu to a cashier', async () => {
    const { wrapper } = await mountAs('cashier')

    expect(menuLink(wrapper)).toBeDefined()
    expect(menuLink(wrapper).text()).toContain('Menu')
  })

  it('offers the menu to a bartender', async () => {
    const { wrapper } = await mountAs('bartender')

    expect(menuLink(wrapper)).toBeDefined()
  })

  it('points at the real menu page, not a cashier route', async () => {
    // The page lives in another layout, so a wrong route name here renders a
    // dead link. Resolved against the app's actual route table, not a stub.
    const appRouter = (await import('@/router')).default
    expect(appRouter.resolve({ name: 'hotel-menu' }).path).toBe('/app/menu')
    const { wrapper } = await mountAs('cashier')
    expect(menuLink(wrapper).props('to').name).toBe('hotel-menu')
  })

  it('sits beside Ingredients, the other level of the same tree', async () => {
    // Ingredients was the only menu level reachable from the till, which is why
    // the menu link belongs next to it rather than in Ordering or Reports.
    const { wrapper } = await mountAs('cashier')
    const order = wrapper.findAllComponents(RouterLinkStub).map((l) => l.props('to')?.name)

    expect(order).toContain('cashier-ingredients')
    expect(order.indexOf('hotel-menu')).toBeGreaterThan(-1)
  })

  it('withholds the link from a waiter', async () => {
    // A waiter cannot edit the menu; offering the link would dead-end on a 403.
    const { wrapper } = await mountAs('waiter')

    expect(menuLink(wrapper)).toBeUndefined()
  })

  it('agrees with the gate the menu page itself applies', async () => {
    // Drift between the link and the page is the failure mode: a role shown the
    // link but refused by MenuListPage. The two now read one shared list, so
    // they cannot disagree — which makes "did they agree" a weak thing to
    // assert, since it holds even when the shared list is simply wrong. So the
    // role set is pinned separately, by literal, below.
    const roles = ['cashier', 'bartender', 'manager', 'hotel_admin', 'kitchen', 'waiter', 'housekeeping', 'receptionist', 'staff']

    for (const role of roles) {
      const { wrapper } = await mountAs(role)
      expect(menuLink(wrapper) !== undefined).toBe(canManageMenu(role))
    }
  })
})

describe('canManageMenu', () => {
  it('admits exactly the roles the API CanManageMenu policy admits', () => {
    // Pinned as literals, not read back from the list, so widening the list
    // silently — the drift the shared helper was meant to prevent — fails here.
    expect(MENU_MANAGER_ROLES).toEqual(['hotel_admin', 'manager', 'kitchen', 'cashier', 'bartender'])

    // Floor roles must stay out: the menu is not theirs to change.
    for (const role of ['waiter', 'housekeeping', 'receptionist', 'staff', 'accountant', 'procurement_officer']) {
      expect(canManageMenu(role)).toBe(false)
    }
  })


  it('takes either a user object or a bare role string', () => {
    expect(canManageMenu({ user_role: 'cashier' })).toBe(true)
    expect(canManageMenu('cashier')).toBe(true)
    expect(canManageMenu('waiter')).toBe(false)
  })

  it('treats a missing user as no access', () => {
    expect(canManageMenu(null)).toBe(false)
    expect(canManageMenu(undefined)).toBe(false)
    expect(canManageMenu({})).toBe(false)
  })

  it('cannot be mutated into granting a role', () => {
    // The list is frozen so a caller cannot push onto the shared array.
    expect(Object.isFrozen(MENU_MANAGER_ROLES)).toBe(true)
  })
})