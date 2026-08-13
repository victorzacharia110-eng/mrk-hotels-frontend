/**
 * useRoomBrowser — client-side search, sort and pagination for the list of
 * bookable rooms returned by the availability endpoints.
 *
 * The backend returns available rooms as a single flat array, so filtering
 * and paging happen in the browser. Room selections live outside this
 * composable (keyed by room_id) and therefore survive paging and sorting.
 *
 * Usage:
 *   const roomsSource = computed(() => availability.value?.available_rooms || [])
 *   const { query, sortKey, sortDir, page, pageCount, pagedRooms, filteredCount, rangeFrom, rangeTo, PER_PAGE } =
 *     useRoomBrowser(roomsSource)
 */

import { ref, computed, watch } from 'vue'

/**
 * Builds a reactive search/sort/paginate pipeline over a rooms ref/computed.
 * @param {import('vue').Ref<Array>|import('vue').ComputedRef<Array>} roomsSource - Reactive list of room objects.
 * @returns {object} Reactive controls and the derived page of rooms.
 */
export function useRoomBrowser(roomsSource) {
  // Rooms shown per page.
  const PER_PAGE = 15

  // Free-text search across room number, type and floor.
  const query = ref('')
  // Active sort field and direction.
  const sortKey = ref('price_per_night')
  const sortDir = ref('asc')
  // Current page (1-based).
  const page = ref(1)

  /**
   * Rooms after applying the free-text search (case-insensitive match over
   * room number, room type and floor).
   */
  const filteredRooms = computed(() => {
    const rooms = roomsSource.value || []
    const q = query.value.trim().toLowerCase()
    if (!q) return rooms
    return rooms.filter((room) =>
      [room.room_number, room.room_type, room.floor]
        .filter((v) => v !== null && v !== undefined)
        .some((v) => String(v).toLowerCase().includes(q)),
    )
  })

  /**
   * Comparator map for the supported sort fields. Room numbers sort naturally
   * so 101 < 102 < 202 reads sensibly.
   */
  const sorters = {
    price_per_night: (a, b) => Number(a.price_per_night) - Number(b.price_per_night),
    room_number: (a, b) =>
      String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true, sensitivity: 'base' }),
    max_occupancy: (a, b) => Number(a.max_occupancy || 0) - Number(b.max_occupancy || 0),
    floor: (a, b) => Number(a.floor || 0) - Number(b.floor || 0),
  }

  /**
   * Rooms after search + sort. Falls back to a room-number tiebreak so the
   * order is stable regardless of the primary key.
   */
  const sortedRooms = computed(() => {
    const compare = sorters[sortKey.value] || sorters.price_per_night
    const dir = sortDir.value === 'desc' ? -1 : 1
    return [...filteredRooms.value].sort((a, b) => {
      const primary = compare(a, b)
      if (primary !== 0) return primary * dir
      return sorters.room_number(a, b)
    })
  })

  // Total after filtering (drives the "Showing X-Y of Z" label and page count).
  const filteredCount = computed(() => sortedRooms.value.length)
  // Number of pages needed for the filtered set (at least 1).
  const pageCount = computed(() => Math.max(1, Math.ceil(filteredCount.value / PER_PAGE)))

  /**
   * The slice of rooms for the current page.
   */
  const pagedRooms = computed(() => {
    const start = (page.value - 1) * PER_PAGE
    return sortedRooms.value.slice(start, start + PER_PAGE)
  })

  // 1-based display offsets for the "Showing from-to of total" caption.
  const rangeFrom = computed(() => (filteredCount.value === 0 ? 0 : (page.value - 1) * PER_PAGE + 1))
  const rangeTo = computed(() => Math.min(page.value * PER_PAGE, filteredCount.value))

  // Any change to the result set, the original source list, or the
  // search/sort controls resets to page 1 so the user is never stranded.
  watch([query, sortKey, sortDir, filteredCount, roomsSource], () => {
    page.value = 1
  })

  return {
    PER_PAGE,
    query,
    sortKey,
    sortDir,
    page,
    pageCount,
    pagedRooms,
    filteredCount,
    rangeFrom,
    rangeTo,
  }
}
