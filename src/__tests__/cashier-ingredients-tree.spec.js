import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import CashierIngredientsPage from '@/pages/cashier/CashierIngredientsPage.vue'

const api = vi.hoisted(() => ({
  menuIndex: vi.fn(),
  inventoryItems: vi.fn(),
  ingredientIndex: vi.fn(),
}))

vi.mock('@/api', () => ({
  menuItemApi: { index: api.menuIndex },
  cashierApi: { inventoryItems: api.inventoryItems },
  menuItemIngredientApi: {
    index: api.ingredientIndex,
    store: vi.fn(),
    destroy: vi.fn(),
  },
}))

const MENU = [
  {
    menu_item_id: 'menu-gin',
    item_name: 'Gin',
    category: 'Drinks',
    category_order: 1,
    sub_category: 'Spirits',
    sub_category_order: 1,
    ingredient_count: 0,
  },
  {
    menu_item_id: 'menu-beer',
    item_name: 'Beer',
    category: 'Drinks',
    category_order: 1,
    sub_category: 'Beer',
    sub_category_order: 2,
    ingredient_count: 0,
  },
  {
    menu_item_id: 'menu-rice',
    item_name: 'Rice',
    category: 'Food',
    category_order: 2,
    sub_category: 'Main dishes',
    sub_category_order: 1,
    ingredient_count: 0,
  },
]

function mountPage() {
  setActivePinia(createPinia())
  return mount(CashierIngredientsPage, {
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  api.menuIndex.mockImplementation(async ({ page }) => {
    if (page === 2) {
      return { data: { data: [MENU[2]], meta: { last_page: 2 } } }
    }
    return { data: { data: [MENU[0], MENU[1]], meta: { last_page: 2 } } }
  })
  api.inventoryItems.mockResolvedValue({ data: { items: [] } })
  api.ingredientIndex.mockResolvedValue({ data: { ingredients: [] } })
})

describe('CashierIngredientsPage menu tree', () => {
  it('loads every page and groups items by category and registered sub-category', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(api.menuIndex).toHaveBeenCalledWith({ per_page: 100 })
    expect(api.menuIndex).toHaveBeenCalledWith({ per_page: 100, page: 2 })

    expect(wrapper.findAll('.cat-toggle').map((button) => button.text()))
      .toEqual(['Drinks 2', 'Food 1'])
    expect(wrapper.findAll('.sub-toggle').map((button) => button.text()))
      .toEqual(['Spirits 1', 'Beer 1', 'Main dishes 1'])
    expect(wrapper.findAll('.cat-leaf').map((button) => button.text()))
      .toEqual(['Gin', 'Beer', 'Rice'])

    wrapper.unmount()
  })
})
