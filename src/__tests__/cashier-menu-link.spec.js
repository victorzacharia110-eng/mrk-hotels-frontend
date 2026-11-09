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

async function mountAs(role) {
  setActivePinia(createPinia())

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

const linkToRoute = (wrapper, name) =>
  wrapper
    .findAllComponents(RouterLinkStub)
    .find((l) => l.props('to')?.name === name)

const menuLink = (wrapper) => linkToRoute(wrapper, 'hotel-menu')

describe('cashier panel -> menu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not offer menu management to a cashier', async () => {
    const { wrapper } = await mountAs('cashier')
    expect(menuLink(wrapper)).toBeUndefined()
  })

  it('does not offer menu management to a bartender', async () => {
    const { wrapper } = await mountAs('bartender')
    expect(menuLink(wrapper)).toBeUndefined()
  })

  it('keeps the menu route restricted to management roles', async () => {
    const appRouter = (await import('@/router')).default
    const resolved = appRouter.resolve({ name: 'hotel-menu' })
    expect(resolved.path).toBe('/app/menu')
    expect(resolved.meta.role).toEqual(['hotel_admin', 'manager'])
  })

  it('still exposes the cashier-side inventory/menu levels it owns', async () => {
    const { wrapper } = await mountAs('cashier')
    const order = wrapper.findAllComponents(RouterLinkStub).map((l) => l.props('to')?.name)
    expect(order).toContain('cashier-ingredients')
  })
})

describe('canManageMenu', () => {
  it('admits only hotel admins and managers', () => {
    expect(MENU_MANAGER_ROLES).toEqual(['hotel_admin', 'manager'])
    expect(canManageMenu('hotel_admin')).toBe(true)
    expect(canManageMenu('manager')).toBe(true)

    for (const role of ['cashier', 'bartender', 'kitchen', 'waiter', 'housekeeping', 'receptionist', 'staff']) {
      expect(canManageMenu(role)).toBe(false)
    }
  })

  it('takes either a user object or a bare role string', () => {
    expect(canManageMenu({ user_role: 'manager' })).toBe(true)
    expect(canManageMenu('manager')).toBe(true)
    expect(canManageMenu('cashier')).toBe(false)
  })

  it('treats a missing user as no access', () => {
    expect(canManageMenu(null)).toBe(false)
    expect(canManageMenu(undefined)).toBe(false)
    expect(canManageMenu({})).toBe(false)
  })

  it('cannot be mutated into granting a role', () => {
    expect(Object.isFrozen(MENU_MANAGER_ROLES)).toBe(true)
  })
})
