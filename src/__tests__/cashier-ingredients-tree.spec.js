import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DOMWrapper, mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import CashierIngredientsPage from '@/pages/cashier/CashierIngredientsPage.vue'

const api = vi.hoisted(() => ({
  menuIndex: vi.fn(),
  inventoryItems: vi.fn(),
  ingredientIndex: vi.fn(),
  destroy: vi.fn(),
}))

vi.mock('@/api', () => ({
  menuItemApi: { index: api.menuIndex },
  cashierApi: { inventoryItems: api.inventoryItems },
  menuItemIngredientApi: {
    index: api.ingredientIndex,
    store: vi.fn(),
    destroy: api.destroy,
  },
}))

const INVENTORY = {
  item_id: 'inv-flour',
  item_name: 'Flour',
  unit: 'kg',
  si_units: [{ unit: 'kg', factor: 1 }, { unit: 'bag', factor: 25 }],
  quantity_in_stock: 10,
  unit_cost: 1,
}

const INVENTORY_NO_UNITS = {
  item_id: 'inv-misc',
  item_name: 'Misc',
  unit: '',
  si_units: [],
  quantity_in_stock: 0,
  unit_cost: 0,
}

const INGREDIENT = {
  menu_item_ingredient_id: 'mi-1',
  quantity: 2,
  unit: 'g',
  item: {
    item_name: 'Flour',
    unit: 'g',
    quantity_in_stock: 10,
    reorder_level: 2,
    unit_cost: 1,
  },
}

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
  api.inventoryItems.mockResolvedValue({ data: { items: [INVENTORY, INVENTORY_NO_UNITS] } })
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

  it('auto-fills the SI unit picker from the selected inventory item', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.findAll('.cat-leaf')[0].trigger('click')
    await flushPromises()
    await wrapper.find('.panel-head .sm-btn').trigger('click')
    await flushPromises()

    const modal = document.querySelector('.din-modal')
    expect(modal).not.toBeNull()
    const triggers = modal.querySelectorAll('.ss-trigger')
    expect(triggers).toHaveLength(2)

    await new DOMWrapper(triggers[0]).trigger('click')
    await flushPromises()
    await new DOMWrapper(document.querySelector('.ss-search')).setValue('flour')
    const option = [...document.querySelectorAll('.ss-option')].find((o) => o.textContent.includes('Flour'))
    await new DOMWrapper(option).trigger('mousedown')
    await new DOMWrapper(option).trigger('click')
    await flushPromises()

    const unitTrigger = modal.querySelectorAll('.ss-trigger')[1]
    expect(unitTrigger.textContent).toContain('kg')

    await new DOMWrapper(unitTrigger).trigger('click')
    await flushPromises()
    const units = [...document.querySelectorAll('.ss-option')].map((o) => o.textContent.trim())
    expect(units).toEqual(expect.arrayContaining(['kg', 'bag']))

    wrapper.unmount()
  })

  it('falls back to the standard SI-unit list when the item registers none', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.findAll('.cat-leaf')[0].trigger('click')
    await flushPromises()
    await wrapper.find('.panel-head .sm-btn').trigger('click')
    await flushPromises()

    const modal = document.querySelector('.din-modal')
    const triggers = modal.querySelectorAll('.ss-trigger')
    await new DOMWrapper(triggers[0]).trigger('click')
    await flushPromises()
    const option = [...document.querySelectorAll('.ss-option')].find((o) => o.textContent.includes('Misc'))
    await new DOMWrapper(option).trigger('mousedown')
    await new DOMWrapper(option).trigger('click')
    await flushPromises()

    await new DOMWrapper(modal.querySelectorAll('.ss-trigger')[1]).trigger('click')
    await flushPromises()
    const units = [...document.querySelectorAll('.ss-option')].map((o) => o.textContent.trim())
    expect(units).toEqual(expect.arrayContaining(['BTL', 'PCS', 'KG', 'SACHET']))

    wrapper.unmount()
  })

  it('opens a styled confirmation modal and deletes only after confirming', async () => {
    api.ingredientIndex.mockResolvedValue({ data: { ingredients: [INGREDIENT] } })
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.findAll('.cat-leaf')[0].trigger('click')
    await flushPromises()
    await wrapper.find('.sm-btn.ghost.xs.danger').trigger('click')
    await flushPromises()

    const modal = document.querySelector('.confirm-modal')
    expect(modal).not.toBeNull()
    expect(modal.textContent).toContain('Remove ingredient?')
    expect(modal.textContent).toContain('Remove Flour from Gin?')
    expect(api.destroy).not.toHaveBeenCalled()

    await new DOMWrapper(document.querySelector('.confirm-modal-foot .btn-danger')).trigger('click')
    await flushPromises()

    expect(api.destroy).toHaveBeenCalledWith('menu-gin', 'mi-1')
    expect(document.querySelector('.confirm-modal')).toBeNull()

    wrapper.unmount()
  })
})
