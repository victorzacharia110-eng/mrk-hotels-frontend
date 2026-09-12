/**
 * Room occupancy truth for the stay-view dot board.
 *
 * A room's red dot is reservation-derived, never the denormalized
 * `rooms.status` column (which can go stale across the check-out/clean
 * cycle). It uses the same overlap logic as `occupiedOnDay()` in
 * HotelDashboard.vue so the dot always agrees with the footer occupancy.
 */

/** Normalized room id for a reservation (nested room object or flat field). */
function reservationRoomId(r) {
  return r?.room?.room_id ?? r?.room_id ?? null
}

/** Local-midnight arrival/departure for a reservation (or null). */
function reservationDates(r) {
  const toDate = (value) => {
    if (!value) return null
    const d = new Date(String(value).slice(0, 10) + 'T00:00:00')
    return Number.isNaN(d.getTime()) ? null : d
  }
  return {
    arrival: toDate(r?.arrival_date || r?.check_in_date),
    departure: toDate(r?.departure_date || r?.check_out_date),
  }
}

/** True when a `checked_in` reservation is in-house for the room on `day`. */
export function roomOccupiedToday(reservations, roomId, day) {
  for (const r of reservations || []) {
    if (r?.status !== 'checked_in') continue
    if (reservationRoomId(r) !== roomId) continue
    const { arrival, departure } = reservationDates(r)
    if (arrival && departure && arrival <= day && departure > day) return true
  }
  return false
}