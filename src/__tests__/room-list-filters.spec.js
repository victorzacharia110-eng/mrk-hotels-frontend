import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const index = vi.fn()

vi.mock('@/api', () => ({
  roomApi: { index: (...a) => index(...a) },
}))

const RoomListPage = (await import('@/pages/rooms/RoomListPage.vue')).default

/** A paginated page of rooms, as the API returns it. */
function page(currentPage, total = 60) {
  return {
    data: {
      data: [{ room_id: `r${currentPage}`, room_number: String(100 + currentPage), room_type: 'single', status: 'available' }],
      current_page: currentPage,
      last_page: 3,
      per_page: 20,
      total,
    },
  }
}

function build() {
  return mount(RoomListPage, {
    global: {
      plugins: [createPinia(), i18n],
      stubs: { SearchableSelect: true, TableExportButton: true, DeleteConfirmModal: true },
    },
  })
}

describe('RoomListPage filters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    index.mockReset()
    index.mockResolvedValue(page(1))
  })

  it('returns to page 1 when a filter changes, so the filter is not page-scoped', async () => {
    const wrapper = build()
    await flushPromises()

    // The reviewer was sitting on page 3 when they applied the filter.
    index.mockResolvedValue(page(3))
    wrapper.vm.goPage(3)
    await flushPromises()
    expect(index).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }))

    index.mockResolvedValue(page(1))
    // STATUS / ROOM TYPE selects are wired to applyFilter.
    await wrapper.vm.applyFilter()
    await flushPromises()

    // Without the reset the request would still have asked for page 3, which is
    // how a filtered search reported "no rooms found".
    expect(index).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
  })

  it('keeps the active filter on the request it refetches', async () => {
    const wrapper = build()
    await flushPromises()

    wrapper.vm.filters.room_type = 'suite'
    await wrapper.vm.applyFilter()
    await flushPromises()

    expect(index).toHaveBeenLastCalledWith(expect.objectContaining({ room_type: 'suite', page: 1 }))
  })
})
