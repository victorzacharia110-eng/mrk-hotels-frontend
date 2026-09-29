import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const list = vi.fn()
const store = vi.fn()
const subUpdate = vi.fn()
const destroy = vi.fn()
const reorder = vi.fn()
const categoryUpdate = vi.fn()
const itemList = vi.fn()
const inventoryList = vi.fn()

vi.mock('@/api', () => ({
  menuItemApi: { index: (...a) => itemList(...a), list: (...a) => itemList(...a) },
  menuCategoryApi: {
    index: (...a) => list(...a),
    store: () => {},
    update: (...a) => categoryUpdate(...a),
    reorder: (...a) => reorder(...a),
    destroy: () => {},
  },
  menuSubCategoryApi: {
    index: (...a) => subIndex(...a),
    store: (...a) => store(...a),
    update: (...a) => subUpdate(...a),
    destroy: (...a) => destroy(...a),
  },
  inventoryApi: { index: (...a) => inventoryList(...a), categories: () => {} },
  // The page reads hotel details for the export letterhead.
  hotelSettingsApi: { show: () => Promise.resolve({ data: { hotel: {} } }) },
}))

const subIndex = vi.fn()

// The categories modal is behind a canEdit gate, so the suite signs in as a
// manager; the sub-category panel lives inside that modal.
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { user_role: 'manager', tenant: { tenant_id: 't1' } } }),
}))

const MenuListPage = (await import('@/pages/menu/MenuListPage.vue')).default

const CATEGORY = {
  category_id: 'cat-1',
  name: 'Starters',
  item_count: 4,
  sub_category_count: 2,
  is_active: true,
  sort_order: 0,
}

async function openModal(wrapper) {
  const button = wrapper.findAll('button').find((b) => b.html().includes('fa-tags'))
  expect(button).toBeTruthy()
  await button.trigger('click')
  await flushPromises()
}

/** The layer-group button that reveals a category's sub-categories. */
function subToggle(wrapper) {
  return wrapper.findAll('button').find((b) => b.html().includes('fa-layer-group'))
}

/** A sub-category row's button, picked by the icon it renders. */
function subRowButton(wrapper, icon) {
  return wrapper.findAll('.sub-list button').find((b) => b.html().includes(icon))
}

/** Opens the category modal and expands the sub-category panel. */
async function openSubPanel(wrapper) {
  await openModal(wrapper)
  const toggle = subToggle(wrapper)
  await toggle.trigger('click')
  await flushPromises()
}

describe('MenuListPage — sub-categories', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'en'
    vi.clearAllMocks()
    list.mockResolvedValue({ data: { data: [CATEGORY] } })
    itemList.mockResolvedValue({ data: { data: [] } })
    inventoryList.mockResolvedValue({ data: { data: [] } })
    subIndex.mockResolvedValue({ data: { data: [] } })
  })

  it('loads a category’s sub-categories when its panel is opened', async () => {
    subIndex.mockResolvedValue({
      data: { data: [{ sub_category_id: 'sub-1', category_id: 'cat-1', name: 'Soup', item_count: 2 }] },
    })

    const wrapper = mount(MenuListPage, { global: { plugins: [i18n] } })
    await flushPromises()
    await openModal(wrapper)

    const toggle = subToggle(wrapper)
    expect(toggle).toBeTruthy()
    await toggle.trigger('click')
    await flushPromises()

    expect(subIndex).toHaveBeenCalledWith({ category_id: 'cat-1' })
    expect(wrapper.text()).toContain('Soup')
  })

  it('creates a sub-category and shows it in the panel', async () => {
    store.mockResolvedValue({
      data: { sub_category: { sub_category_id: 'sub-2', category_id: 'cat-1', name: 'Salads', item_count: 0 } },
    })

    const wrapper = mount(MenuListPage, { global: { plugins: [i18n] } })
    await flushPromises()
    await openModal(wrapper)

    const toggle = subToggle(wrapper)
    await toggle.trigger('click')
    await flushPromises()

    await wrapper.find('input[placeholder="Sub-category name, e.g. Soup"]').setValue('Salads')
    await wrapper.find('form.sub-add').trigger('submit')
    await flushPromises()

    expect(store).toHaveBeenCalledWith({ category_id: 'cat-1', name: 'Salads' })
    expect(wrapper.text()).toContain('Salads')
  })

  it('deletes a sub-category without touching the items on the menu', async () => {
    destroy.mockResolvedValue({ data: {} })
    subIndex.mockResolvedValue({
      data: { data: [{ sub_category_id: 'sub-1', category_id: 'cat-1', name: 'Soup', item_count: 2 }] },
    })

    const wrapper = mount(MenuListPage, { global: { plugins: [i18n] } })
    await flushPromises()
    await openModal(wrapper)

    const toggle = subToggle(wrapper)
    await toggle.trigger('click')
    await flushPromises()

    // The row also has a rename button, so the delete is picked by its icon.
    const remove = subRowButton(wrapper, 'fa-trash')
    await remove.trigger('click')
    await flushPromises()

    expect(destroy).toHaveBeenCalledWith('sub-1')
    expect(wrapper.text()).not.toContain('Soup')
  })

  it('does not submit a blank sub-category name', async () => {
    const wrapper = mount(MenuListPage, { global: { plugins: [i18n] } })
    await flushPromises()
    await openModal(wrapper)

    const toggle = subToggle(wrapper)
    await toggle.trigger('click')
    await flushPromises()

    await wrapper.find('form.sub-add').trigger('submit')
    await flushPromises()

    expect(store).not.toHaveBeenCalled()
  })

  it('renames a sub-category inline', async () => {
    subIndex.mockResolvedValue({
      data: { data: [{ sub_category_id: 'sub-1', category_id: 'cat-1', name: 'Soup', item_count: 2 }] },
    })
    subUpdate.mockResolvedValue({
      data: { sub_category: { sub_category_id: 'sub-1', category_id: 'cat-1', name: 'Broths', item_count: 2 } },
    })

    const wrapper = mount(MenuListPage, { global: { plugins: [i18n] } })
    await flushPromises()
    await openSubPanel(wrapper)

    const pen = subRowButton(wrapper, 'fa-pen')
    expect(pen).toBeTruthy()
    await pen.trigger('click')
    await nextTick()

    const input = wrapper.find('.sub-list .cat-edit-name input')
    expect(input.element.value).toBe('Soup')
    await input.setValue('Broths')
    await wrapper.find('.sub-list form.cat-edit-name').trigger('submit')
    await flushPromises()

    expect(subUpdate).toHaveBeenCalledWith('sub-1', { name: 'Broths' })
    expect(wrapper.text()).toContain('Broths')
    expect(wrapper.text()).not.toContain('Soup')
  })

  it('shows the name the server stored, not the one that was typed', async () => {
    // The API squishes whitespace, so the response is the source of truth.
    subIndex.mockResolvedValue({
      data: { data: [{ sub_category_id: 'sub-1', category_id: 'cat-1', name: 'Soup', item_count: 2 }] },
    })
    subUpdate.mockResolvedValue({
      data: { sub_category: { sub_category_id: 'sub-1', category_id: 'cat-1', name: 'Clear  Broths', item_count: 2 } },
    })

    const wrapper = mount(MenuListPage, { global: { plugins: [i18n] } })
    await flushPromises()
    await openSubPanel(wrapper)

    await subRowButton(wrapper, 'fa-pen').trigger('click')
    await nextTick()
    await wrapper.find('.sub-list .cat-edit-name input').setValue('  Clear  Broths  ')
    await wrapper.find('.sub-list form.cat-edit-name').trigger('submit')
    await flushPromises()

    expect(subUpdate).toHaveBeenCalledWith('sub-1', { name: 'Clear  Broths' })
    expect(wrapper.text()).toContain('Clear  Broths')
  })

  it('keeps the edit box open with the typed name when the rename fails', async () => {
    subIndex.mockResolvedValue({
      data: { data: [{ sub_category_id: 'sub-1', category_id: 'cat-1', name: 'Soup', item_count: 2 }] },
    })
    subUpdate.mockRejectedValue({ response: { data: { message: 'That name is already taken.' } } })
    // A genuinely different name, so the unchanged-name short-circuit does not
    // fire and the failure path is actually reached.

    const wrapper = mount(MenuListPage, { global: { plugins: [i18n] } })
    await flushPromises()
    await openSubPanel(wrapper)

    await subRowButton(wrapper, 'fa-pen').trigger('click')
    await nextTick()
    await wrapper.find('.sub-list .cat-edit-name input').setValue('Broths')
    await wrapper.find('.sub-list form.cat-edit-name').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('already taken')
    const input = wrapper.find('.sub-list .cat-edit-name input')
    expect(input.exists()).toBe(true)
    expect(input.element.value).toBe('Broths')
    // The rejected name never replaces what is on the server.
    expect(wrapper.text()).not.toContain('>Broths<')
  })

  it('does not call the API when the rename is unchanged or blank', async () => {
    subIndex.mockResolvedValue({
      data: { data: [{ sub_category_id: 'sub-1', category_id: 'cat-1', name: 'Soup', item_count: 2 }] },
    })

    const wrapper = mount(MenuListPage, { global: { plugins: [i18n] } })
    await flushPromises()
    await openSubPanel(wrapper)

    // Re-submitting the same name closes the box without a pointless write.
    await subRowButton(wrapper, 'fa-pen').trigger('click')
    await nextTick()
    await wrapper.find('.sub-list form.cat-edit-name').trigger('submit')
    await flushPromises()

    // Then a blank name likewise never reaches the API.
    await subRowButton(wrapper, 'fa-pen').trigger('click')
    await nextTick()
    await wrapper.find('.sub-list .cat-edit-name input').setValue('   ')
    await wrapper.find('.sub-list form.cat-edit-name').trigger('submit')
    await flushPromises()

    expect(subUpdate).not.toHaveBeenCalled()
  })
})
