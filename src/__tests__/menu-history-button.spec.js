import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const itemList = vi.fn()
const categoryList = vi.fn()
const subIndex = vi.fn()
const entity = vi.fn()

vi.mock('@/api', () => ({
  menuItemApi: { index: (...a) => itemList(...a), list: (...a) => itemList(...a) },
  menuCategoryApi: { index: (...a) => categoryList(...a), store: () => {}, update: () => {}, reorder: () => {}, destroy: () => {} },
  menuSubCategoryApi: { index: (...a) => subIndex(...a), store: () => {}, update: () => {}, destroy: () => {} },
  inventoryApi: { index: () => Promise.resolve({ data: { data: [] } }), categories: () => Promise.resolve({ data: { data: [] } }) },
  hotelSettingsApi: { show: () => Promise.resolve({ data: { hotel: {} } }) },
  menuAuditApi: { entity: (...a) => entity(...a), index: () => Promise.resolve({ data: { data: [] } }) },
}))

const MenuListPage = (await import('@/pages/menu/MenuListPage.vue')).default

const ITEM = {
  menu_item_id: 'i1',
  item_name: 'Ugali na Samaki',
  department: 'restaurant',
  price: '5000.00',
  is_available: true,
}

/** Signs in as a role and mounts the page. */
async function mountAs(role) {
  // One pinia instance, active *and* handed to the mount: a second instance here
  // would give the page a different auth store than the one just populated.
  const pinia = createPinia()
  setActivePinia(pinia)
  const { useAuthStore } = await import('@/stores/auth')
  useAuthStore().user = { user_role: role, tenant: { tenant_id: 't1' } }

  const wrapper = mount(MenuListPage, { global: { plugins: [pinia, i18n] } })
  await flushPromises()
  return wrapper
}

/** The clock-rotate button on a row. */
function historyButton(wrapper) {
  return wrapper.findAll('button').find((b) => b.html().includes('fa-clock-rotate-left'))
}

beforeEach(() => {
  itemList.mockReset().mockResolvedValue({ data: { data: [ITEM], total: 1, current_page: 1, last_page: 1, per_page: 15 } })
  categoryList.mockReset().mockResolvedValue({ data: { data: [] } })
  subIndex.mockReset().mockResolvedValue({ data: { data: [] } })
  entity.mockReset().mockResolvedValue({ data: { data: [] } })
})

describe('MenuListPage — edit history', () => {
  it('offers the history button to a manager', async () => {
    const wrapper = await mountAs('manager')
    expect(historyButton(wrapper)).toBeTruthy()
  })

  it('offers it to a cashier, who maintains the menu from this page', async () => {
    const wrapper = await mountAs('cashier')
    expect(historyButton(wrapper)).toBeTruthy()
  })

  it('hides it from a waiter, who may not edit the menu and so has no trail to read', async () => {
    const wrapper = await mountAs('waiter')
    expect(historyButton(wrapper)).toBeFalsy()
  })

  it('opens the panel for the row that was clicked', async () => {
    const wrapper = await mountAs('manager')

    await historyButton(wrapper).trigger('click')
    await flushPromises()

    expect(entity).toHaveBeenCalledWith('menu_item', 'i1')
    expect(wrapper.find('.mhd-panel').exists()).toBe(true)
    expect(wrapper.find('.mhd-subject').text()).toContain('Ugali na Samaki')
  })
})