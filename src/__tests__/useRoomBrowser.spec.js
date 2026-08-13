import { describe, it, expect } from 'vitest'
import { ref, nextTick } from 'vue'
import { useRoomBrowser } from '@/composables/useRoomBrowser'

// Build `n` fake rooms with varying attributes for search/sort/pagination tests.
function makeRooms(n) {
  return Array.from({ length: n }, (_, i) => ({
    room_id: i + 1,
    room_number: String(101 + i),
    room_type: i % 2 ? 'Double' : 'Single',
    floor: (i % 5) + 1,
    price_per_night: 50000 + i * 10000,
    max_occupancy: (i % 3) + 1,
  }))
}

describe('useRoomBrowser', () => {
  it('paginates to 15 per page', () => {
    const { pagedRooms, pageCount, page } = useRoomBrowser(ref(makeRooms(40)))
    expect(pageCount.value).toBe(3)
    expect(pagedRooms.value).toHaveLength(15)
    page.value = 3
    expect(pagedRooms.value).toHaveLength(10)
  })

  it('filters by search query across number, type and floor', () => {
    const { query, filteredCount } = useRoomBrowser(ref(makeRooms(20)))
    query.value = 'single'
    expect(filteredCount.value).toBe(10)
    query.value = '101'
    expect(filteredCount.value).toBe(1)
  })

  it('sorts by price ascending and descending', () => {
    const { pagedRooms, sortKey, sortDir } = useRoomBrowser(ref(makeRooms(20)))
    sortKey.value = 'price_per_night'
    sortDir.value = 'asc'
    expect(pagedRooms.value[0].price_per_night).toBe(50000)
    sortDir.value = 'desc'
    expect(pagedRooms.value[0].price_per_night).toBe(50000 + 19 * 10000)
  })

  it('resets to page 1 when the query changes', async () => {
    const { query, page } = useRoomBrowser(ref(makeRooms(40)))
    page.value = 2
    query.value = 'double'
    await nextTick()
    expect(page.value).toBe(1)
  })

  it('clamps the page when the result set shrinks', async () => {
    const rooms = ref(makeRooms(40))
    const { page, pageCount, pagedRooms } = useRoomBrowser(rooms)
    page.value = 3
    rooms.value = makeRooms(10)
    await nextTick()
    expect(pageCount.value).toBe(1)
    expect(page.value).toBe(1)
    expect(pagedRooms.value).toHaveLength(10)
  })

  it('resets to page 1 when the source list changes', async () => {
    const rooms = ref(makeRooms(40))
    const { page } = useRoomBrowser(rooms)
    page.value = 3
    // replace the source entirely (simulates a new availability payload)
    rooms.value = makeRooms(20)
    await nextTick()
    expect(page.value).toBe(1)
  })
})
