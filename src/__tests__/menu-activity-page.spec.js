import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import i18n from '@/locales/i18n'

const index = vi.fn()

vi.mock('@/api', () => ({
  menuAuditApi: {
    index: (...a) => index(...a),
    entity: () => Promise.resolve({ data: { data: [] } }),
  },
}))

// The page links back to the menu with router-link.
vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRouter: () => ({ push: vi.fn() }),
}))

const MenuActivityPage = (await import('@/pages/menu/MenuActivityPage.vue')).default

const ROW = {
  log_id: 'l1',
  action: 'update',
  entity_type: 'menu_item',
  entity_id: 'abcdef12-3456-7890-abcd-ef1234567890',
  old_values: { price: '5000.00', item_name: 'Ugali na Samaki' },
  new_values: { price: '6000.00', item_name: 'Ugali na Samaki' },
  created_at: '2026-10-02T09:15:00.000000Z',
  user: { full_name: 'Neema Joseph' },
}

const PAGE = {
  data: [ROW],
  total: 1,
  per_page: 25,
  current_page: 1,
  last_page: 1,
}

function mountPage() {
  return mount(MenuActivityPage, { global: { plugins: [i18n] } })
}

beforeEach(() => {
  index.mockReset()
  index.mockResolvedValue({ data: PAGE })
})

describe('MenuActivityPage', () => {
  it('lists who did what across the menu, newest first', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Neema Joseph')
    expect(text).toContain('Menu item')
    expect(text).toContain('2026-10-02 09:15')
    // Only the truncated id is shown, like the reports page does.
    expect(text).toContain('abcdef12')
  })

  it('summarises which fields moved without printing the whole record', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const pills = wrapper.findAll('.ma-pill')
    expect(pills).toHaveLength(1)
    expect(pills[0].text()).toBe('Price')
  })

  it('reveals the before and after when a row is opened', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.find('.ma-diff').exists()).toBe(false)

    await wrapper.find('.ma-row').trigger('click')
    await flushPromises()

    const diff = wrapper.find('.ma-diff')
    expect(diff.exists()).toBe(true)
    expect(diff.text()).toContain('5000.00')
    expect(diff.text()).toContain('6000.00')
  })

  it('closes the diff again when the same row is clicked twice', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.find('.ma-row').trigger('click')
    await wrapper.find('.ma-row').trigger('click')
    await flushPromises()

    expect(wrapper.find('.ma-diff').exists()).toBe(false)
  })

  it('sends only the filters that are set, and drops them when cleared', async () => {
    const wrapper = mountPage()
    await flushPromises()

    // setValue drives the element, so v-model reads the choice back off the DOM
    // the way it does for a real click; setting the reactive property directly
    // would just be overwritten by the empty <option>.
    const [typeSelect] = wrapper.findAll('select')
    await typeSelect.setValue('menu_item')
    await flushPromises()

    expect(index).toHaveBeenLastCalledWith(
      expect.objectContaining({ entity_type: 'menu_item', page: 1 }),
    )

    await typeSelect.setValue('')
    await flushPromises()

    const last = index.mock.calls.at(-1)[0]
    expect(last.entity_type).toBeUndefined()
    expect(last.action).toBeUndefined()
  })

  it('names a deleted account instead of leaving the cell blank', async () => {
    index.mockResolvedValue({ data: { ...PAGE, data: [{ ...ROW, user: null }] } })
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('A former staff member')
  })

  it('says so when nothing matches the filters', async () => {
    index.mockResolvedValue({ data: { ...PAGE, data: [] } })
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('No menu activity matches these filters')
  })

  it('surfaces a load failure instead of pretending nothing happened', async () => {
    index.mockRejectedValue({ response: { data: { message: 'Server exploded' } } })
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).toContain('Server exploded')
  })
})