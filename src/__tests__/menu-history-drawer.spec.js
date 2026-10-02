import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import i18n from '@/locales/i18n'

const entity = vi.fn()

vi.mock('@/api', () => ({
  menuAuditApi: {
    entity: (...a) => entity(...a),
    index: () => Promise.resolve({ data: { data: [] } }),
  },
}))

const MenuHistoryDrawer = (await import('@/components/MenuHistoryDrawer.vue')).default

/** A price-change row: the case someone opens this panel for mid-service. */
const PRICE_CHANGE = {
  log_id: 'l1',
  action: 'update',
  entity_type: 'menu_item',
  entity_id: 'i1',
  old_values: { item_name: 'Ugali na Samaki', price: '5000.00' },
  new_values: { item_name: 'Ugali na Samaki', price: '6000.00' },
  created_at: '2026-10-02T09:15:00.000000Z',
  user: { full_name: 'Neema Joseph' },
}

function mountDrawer(props = {}) {
  return mount(MenuHistoryDrawer, {
    props: {
      modelValue: true,
      entityType: 'menu_item',
      entityId: 'i1',
      title: 'Ugali na Samaki',
      ...props,
    },
    global: { plugins: [i18n] },
  })
}

beforeEach(() => {
  entity.mockReset()
})

describe('MenuHistoryDrawer', () => {
  it('answers who changed it and when, using the newest row', async () => {
    entity.mockResolvedValue({ data: { data: [PRICE_CHANGE] } })
    const wrapper = mountDrawer()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Neema Joseph')
    expect(text).toContain('Ugali na Samaki')
    expect(entity).toHaveBeenCalledWith('menu_item', 'i1')
  })

  it('shows what moved as before -> after, not the whole record twice', async () => {
    entity.mockResolvedValue({ data: { data: [PRICE_CHANGE] } })
    const wrapper = mountDrawer()
    await flushPromises()

    // Only the price changed, so only the price is listed.
    const changes = wrapper.findAll('.mhd-change')
    expect(changes).toHaveLength(1)
    expect(changes[0].text()).toContain('5000.00')
    expect(changes[0].text()).toContain('6000.00')
  })

  it('names the staff member even when the account has since been deleted', async () => {
    // audit_logs.user_id is nullOnDelete, so `user` comes back null for anyone
    // who has left. The trail must still say somebody did it.
    entity.mockResolvedValue({
      data: { data: [{ ...PRICE_CHANGE, user: null }] },
    })
    const wrapper = mountDrawer()
    await flushPromises()

    expect(wrapper.text()).toContain('A former staff member')
  })

  it('does not fetch until it is opened', async () => {
    const wrapper = mountDrawer({ modelValue: false })
    await flushPromises()

    expect(entity).not.toHaveBeenCalled()
    expect(wrapper.find('.mhd-panel').exists()).toBe(false)
  })

  it('reloads each time it is opened so the answer is never stale', async () => {
    entity.mockResolvedValue({ data: { data: [PRICE_CHANGE] } })
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()

    expect(entity).toHaveBeenCalledTimes(2)
  })

  it('says so plainly when a record has no history yet', async () => {
    entity.mockResolvedValue({ data: { data: [] } })
    const wrapper = mountDrawer()
    await flushPromises()

    expect(wrapper.text()).toContain('No changes recorded')
  })

  it('surfaces a load failure instead of an empty panel', async () => {
    // An empty list reads as "nobody touched this", which is a different and
    // wrong claim from "we could not find out".
    entity.mockRejectedValue({ response: { data: { message: 'Server exploded' } } })
    const wrapper = mountDrawer()
    await flushPromises()

    expect(wrapper.text()).toContain('Server exploded')
    expect(wrapper.find('.mhd-error').exists()).toBe(true)
  })

  it('emits close when the overlay is clicked', async () => {
    entity.mockResolvedValue({ data: { data: [] } })
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.find('.mhd-overlay').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})