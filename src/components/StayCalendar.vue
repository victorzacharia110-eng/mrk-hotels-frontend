<!--
  Read-only stay/tape chart: rooms grouped by type in rows, one column per night,
  with coloured booking bars (green in-house, purple due-out/overdue, blue
  checked out, red not yet checked in) plus per-day availability and occupancy
  footers — the same calendar language the dashboard uses.

  Extracted from the dashboard stay view so the Rooms > Inventory tab can show
  the identical chart without the dashboard's booking/housekeeping side effects
  (no room modal, no cell taps): it only reads `rooms` and `reservations`.
-->
<template>
  <div class="stay-cal">
    <div class="sv-chart">
      <div class="sv-grid" :style="gridStyle">
        <!-- Corner: window navigation. The business date is column one. -->
        <div class="sv-corner">
          <button type="button" class="sv-nav-btn" :aria-label="$t('stayview.previous')" @click="shift(-7)">
            <i class="fas fa-chevron-left" aria-hidden="true"></i>
          </button>
          <span class="sv-bizdate-text">{{ businessDateLabel }}</span>
          <button type="button" class="sv-nav-btn" :aria-label="$t('stayview.next')" @click="shift(7)">
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        </div>

        <div
          v-for="d in days"
          :key="d.iso"
          class="sv-day-head"
          :class="{ today: d.isToday, weekend: d.isWeekend }"
        >
          <span class="dow">{{ d.dow }}</span>
          <span class="dom">{{ d.label }}</span>
        </div>

        <template v-for="group in groups" :key="group.type">
          <!-- Rate / availability row for the room type -->
          <div class="sv-type-cell">{{ roomTypeLabel(group.type) }}</div>
          <div
            v-for="d in days"
            :key="d.iso"
            class="sv-rate-cell"
            :class="{ today: d.isToday, weekend: d.isWeekend }"
          >
            <span class="sv-avail-pill" :class="{ zero: group.availability[d.iso] === 0 }">
              {{ group.availability[d.iso] }}
            </span>
            <span class="sv-price">{{ formatPrice(group.price) }}</span>
          </div>

          <!-- One row per physical room, with bars spanning its stay dates -->
          <template v-for="room in group.rooms" :key="room.room_id">
            <div class="sv-room-cell" :title="$t('stayview.roomDetails')">
              <span
                class="sv-room-dot"
                :class="roomDotOccupied(room) ? 'occupied' : (room.status !== 'occupied' ? room.status : 'available')"
                :title="roomDotOccupied(room) ? (occupiedGuest(room.room_id) || $t('stayview.occupiedGuest')) : room.status"
              ></span>
              <span class="sv-room-number">{{ room.room_number }}</span>
              <i
                v-if="room.status === 'dirty' || room.status === 'cleaning'"
                class="fas fa-broom sv-room-flag"
                :title="room.status"
                aria-hidden="true"
              ></i>
              <i
                v-if="room.status === 'maintenance'"
                class="fas fa-screwdriver-wrench sv-room-flag"
                :title="room.status"
                aria-hidden="true"
              ></i>
            </div>
            <div class="sv-room-track">
              <div
                v-for="(d, di) in days"
                :key="d.iso"
                class="sv-cell-bg"
                :class="{ today: d.isToday, weekend: d.isWeekend }"
                :style="{ gridColumn: `${di * 2 + 1} / span 2`, gridRow: '1 / -1' }"
              ></div>
              <div
                v-for="(d, di) in days"
                :key="'mid-' + d.iso"
                class="sv-day-mid"
                :class="{ today: d.isToday }"
                :style="{ gridColumn: `${di * 2 + 2} / span 1` }"
              ></div>
              <div
                v-for="bar in barsByRoom[room.room_id] || []"
                :key="bar.id"
                class="sv-bar"
                :class="bar.colorClass"
                :style="{ gridColumn: `${bar.start} / span ${bar.span}`, gridRow: bar.lane }"
                :title="bar.title"
              >
                <i class="fas fa-hotel" aria-hidden="true"></i>
                <span class="sv-bar-label">{{ bar.label }}</span>
              </div>
            </div>
          </template>
        </template>

        <!-- Footer: per-day availability -->
        <div class="sv-footer-cell sv-sticky-avail">{{ $t('stayview.availability') }}</div>
        <div
          v-for="d in days"
          :key="d.iso"
          class="sv-footer-day sv-sticky-avail"
          :class="{ today: d.isToday, weekend: d.isWeekend }"
        >
          <strong>{{ footer[d.iso].available }}</strong>
        </div>

        <!-- Footer: per-day occupancy percentage -->
        <div class="sv-footer-cell sv-sticky-occ">{{ $t('stayview.occupancy') }}</div>
        <div
          v-for="d in days"
          :key="d.iso"
          class="sv-footer-day sv-sticky-occ"
          :class="{ today: d.isToday, weekend: d.isWeekend }"
        >
          <div class="sv-occ">
            <div class="sv-occ-bar"><span :style="{ width: footer[d.iso].occupancy + '%' }"></span></div>
            <strong>{{ footer[d.iso].occupancy }}%</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  /** Physical rooms: { room_id, room_number, room_type, status, price_per_night }. */
  rooms: { type: Array, default: () => [] },
  /** Reservations/stays overlapping the window (any status). */
  reservations: { type: Array, default: () => [] },
  /** The hotel's business date, YYYY-MM-DD. Column one and the "today" marker. */
  businessDate: { type: String, default: '' },
  /** Number of night columns shown. */
  dayCount: { type: Number, default: 14 },
})

const { t, te } = useI18n()

/* ---------------- Date helpers ---------------- */

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** Whole days between two dates (b − a). */
function diffDays(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000)
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function isoKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** The business date as a local-midnight Date (falls back to today). */
function businessToday() {
  return parseDate(props.businessDate) || startOfDay(new Date())
}

const businessDateLabel = computed(() => {
  const d = businessToday()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${day}/${m}/${d.getFullYear()}`
})

/* ---------------- Window ---------------- */

/** Days offset from the business date; the window opens ON it (offset 0). */
const offset = ref(0)
const windowStart = computed(() => addDays(businessToday(), offset.value))
const windowEnd = computed(() => addDays(windowStart.value, props.dayCount))

function shift(n) {
  offset.value += n
}

const days = computed(() => {
  const todayIso = isoKey(businessToday())
  return Array.from({ length: props.dayCount }, (_, i) => {
    const date = addDays(windowStart.value, i)
    const dow = date.getDay()
    return {
      date,
      iso: isoKey(date),
      dow: date.toLocaleDateString([], { weekday: 'short' }).toUpperCase(),
      label: date.toLocaleDateString([], { day: 'numeric', month: 'short' }),
      isToday: isoKey(date) === todayIso,
      isWeekend: dow === 0 || dow === 6,
    }
  })
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `170px repeat(${props.dayCount}, minmax(96px, 1fr))`,
}))

/* ---------------- Reservations → bars ---------------- */

function reservationRoomId(r) {
  return r?.room?.room_id ?? r?.room_id ?? null
}

function reservationDates(r) {
  return {
    arrival: parseDate(r?.arrival_date || r?.check_in_date),
    departure: parseDate(r?.departure_date || r?.check_out_date),
  }
}

function stayKey(r) {
  const guest = r.guest_id !== null && r.guest_id !== undefined
    ? String(r.guest_id)
    : String(r.guest_name || '').trim().toLowerCase()
  return `${guest}@${reservationRoomId(r) ?? ''}`
}

function isSplitTwin(r) {
  return String(r.notes || '').toLowerCase().startsWith('split folio of')
}

/** One reservation per physical stay: overlapping duplicates/twins are trimmed. */
const tapeReservations = computed(() => {
  const rows = props.reservations || []
  const statusRank = { checked_in: 0, checked_out: 1, confirmed: 2, pending: 3, no_show: 4, cancelled: 5 }
  const keep = new Set(rows.map((r) => r.reservation_id))
  const rank = (r) => [
    isSplitTwin(r) ? 1 : 0,
    statusRank[r.status] ?? 9,
    -(Number(r.total_amount) || 0),
    r.reservation_id,
  ]
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]
    if (!keep.has(a.reservation_id)) continue
    const da = reservationDates(a)
    if (!da.arrival || !da.departure) continue
    for (let j = i + 1; j < rows.length; j++) {
      const b = rows[j]
      if (!keep.has(b.reservation_id) || stayKey(a) !== stayKey(b)) continue
      const db = reservationDates(b)
      if (!db.arrival || !db.departure) continue
      if (!(da.arrival < db.departure && db.arrival < da.departure)) continue
      if (rank(a) <= rank(b)) keep.delete(b.reservation_id)
      else keep.delete(a.reservation_id)
    }
  }
  return rows.filter((r) => keep.has(r.reservation_id))
})

/** Reservations touching the window (a departing guest still owns the first half). */
const visibleReservations = computed(() =>
  tapeReservations.value.filter((r) => {
    const { arrival, departure } = reservationDates(r)
    if (!arrival || !departure) return false
    if (arrival >= windowEnd.value) return false
    if (departure < windowStart.value && r.status !== 'checked_in') return false
    return true
  }),
)

function barColorClass(r, departure) {
  if (r.status === 'checked_out') return 'bar-blue'
  if (r.status === 'checked_in') {
    return departure.getTime() <= businessToday().getTime() ? 'bar-purple' : 'bar-green'
  }
  return 'bar-red'
}

const barsByRoom = computed(() => {
  const map = {}
  for (const r of visibleReservations.value) {
    const roomId = reservationRoomId(r)
    if (!roomId) continue
    const { arrival, departure } = reservationDates(r)
    if (!arrival || !departure) continue
    const startIdx = Math.max(0, diffDays(windowStart.value, arrival))
    const endIdx = Math.min(props.dayCount, diffDays(windowStart.value, departure))
    const halfStart = startIdx * 2
    const halfEnd = Math.max(halfStart, endIdx * 2)
    const endedBeforeWindow = diffDays(windowStart.value, departure) < 0
    if (halfEnd < halfStart || (endedBeforeWindow && r.status !== 'checked_in')) continue
    const effectiveHalfEnd = endedBeforeWindow && r.status === 'checked_in'
      ? Math.max(halfEnd, halfStart + 1)
      : halfEnd
    const name = `${r.guest_name || ''}`.trim() || `#${r.reservation_id}`
    const statusLabel = (r.status || '').replace('_', ' ')
    ;(map[roomId] ||= []).push({
      id: r.reservation_id,
      arrivalIso: isoKey(arrival),
      colorClass: barColorClass(r, departure),
      label: name,
      title: `${name} · ${statusLabel}`.trim(),
      start: halfStart + 2,
      span: Math.max(1, effectiveHalfEnd - halfStart),
      lane: 1,
    })
  }
  for (const roomId of Object.keys(map)) {
    const arr = map[roomId].sort((a, b) =>
      a.arrivalIso < b.arrivalIso ? -1 : a.arrivalIso > b.arrivalIso ? 1 : 0,
    )
    arr.forEach((bar, i) => {
      bar.lane = (i % 2) + 1
    })
  }
  return map
})

function occupiedOnDay(ids, date) {
  let count = 0
  for (const r of tapeReservations.value) {
    const { arrival, departure } = reservationDates(r)
    if (!arrival || !departure) continue
    if (ids.has(reservationRoomId(r)) && arrival <= date && departure > date) count += 1
  }
  return count
}

/* ---------------- Groups + footer ---------------- */

const groups = computed(() => {
  const byType = {}
  for (const room of props.rooms || []) {
    const type = room.room_type || 'single'
    ;(byType[type] ||= []).push(room)
  }
  return Object.keys(byType)
    .sort()
    .map((type) => {
      const typeRooms = byType[type].sort((a, b) =>
        String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }),
      )
      const ids = new Set(typeRooms.map((r) => r.room_id))
      const price = Math.min(...typeRooms.map((r) => Number(r.price_per_night) || 0))
      const availability = {}
      for (const d of days.value) {
        availability[d.iso] = Math.max(0, typeRooms.length - occupiedOnDay(ids, d.date))
      }
      return { type, rooms: typeRooms, price, availability }
    })
})

const footer = computed(() => {
  const bookable = (props.rooms || []).filter((r) => r.status !== 'maintenance')
  const total = bookable.length
  const allIds = new Set(bookable.map((r) => r.room_id))
  const result = {}
  for (const d of days.value) {
    const occupied = occupiedOnDay(allIds, d.date)
    result[d.iso] = {
      available: Math.max(0, total - occupied),
      occupancy: total ? Math.round((occupied / total) * 100) : 0,
    }
  }
  return result
})

/* ---------------- Housekeeping dots ---------------- */

function roomDotOccupied(room) {
  const today = businessToday()
  for (const r of tapeReservations.value) {
    if (r.status !== 'checked_in') continue
    if (reservationRoomId(r) !== room.room_id) continue
    const { arrival } = reservationDates(r)
    if (arrival && arrival <= today) return true
  }
  return false
}

function occupiedGuest(roomId) {
  const today = businessToday()
  for (const r of tapeReservations.value) {
    if (r.status !== 'checked_in') continue
    if (reservationRoomId(r) !== roomId) continue
    const { arrival, departure } = reservationDates(r)
    if (arrival && departure && arrival <= today && departure > today) return r.guest_name
  }
  return ''
}

function roomTypeLabel(type) {
  const key = `common.roomTypes.${type}`
  return te(key) ? t(key) : type
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
</script>

<style scoped>
.stay-cal {
  width: 100%;
  overflow: auto;
}

.sv-chart {
  min-width: 100%;
}

.sv-grid {
  display: grid;
  min-width: 100%;
}

.sv-corner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid #e5e7eb;
  border-right: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  left: 0;
  background: #fff;
  z-index: 3;
}

.sv-nav-btn {
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 7px;
  padding: 4px 9px;
  color: #1e293b;
  cursor: pointer;
}

.sv-nav-btn:hover {
  border-color: #005eb8;
  color: #005eb8;
}

.sv-bizdate-text {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid #ddd;
  background: #fff;
  white-space: nowrap;
}

.sv-day-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border-bottom: 1px solid #e5e7eb;
  border-right: 1px solid #f0f0f0;
  font-size: 12px;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 2;
}

.sv-day-head .dow {
  font-size: 11px;
  letter-spacing: 0.05em;
  color: #757575;
}

.sv-day-head .dom {
  font-weight: 600;
}

.sv-day-head.today {
  background: #eaf3fb;
  color: #005eb8;
}

.sv-day-head.weekend:not(.today) {
  background: #fafafa;
}

.sv-type-cell {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  border-right: 1px solid #e5e7eb;
  position: sticky;
  left: 0;
  background: #eef4fb;
  font-weight: 700;
  font-size: 12px;
  text-transform: capitalize;
  color: #0b3f74;
  z-index: 2;
}

.sv-rate-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  border-bottom: 1px solid #f0f0f0;
  border-right: 1px solid #f0f0f0;
  background: #f7fafd;
}

.sv-avail-pill {
  min-width: 20px;
  padding: 1px 7px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-size: 11px;
  font-weight: 700;
}

.sv-avail-pill.zero {
  background: #fde2e2;
  color: #b91c1c;
}

.sv-price {
  font-size: 10px;
  color: #64748b;
}

.sv-room-cell {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px;
  border-bottom: 1px solid #f0f0f0;
  border-right: 1px solid #e5e7eb;
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 2;
  min-height: 34px;
}

.sv-room-number {
  font-weight: 600;
  font-size: 13px;
}

.sv-room-flag {
  color: #94a3b8;
  font-size: 11px;
}

.sv-room-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sv-room-dot.available {
  background: #28a745;
}

.sv-room-dot.occupied {
  background: #dc3545;
}

.sv-room-dot.cleaning {
  background: #005eb8;
}

.sv-room-dot.dirty {
  background: #e0a800;
}

.sv-room-dot.maintenance {
  background: #7f8c8d;
}

.sv-room-track {
  grid-column: 2 / -1;
  display: grid;
  grid-template-columns: repeat(28, 1fr);
  grid-template-rows: 1fr 1fr;
  border-bottom: 1px solid #f0f0f0;
  min-height: 42px;
  position: relative;
}

.sv-cell-bg {
  height: 100%;
  border-right: 1px solid #f5f5f5;
  grid-row: 1 / -1;
}

.sv-day-mid {
  grid-row: 1 / -1;
  border-left: 1px dashed #e2e8f0;
  pointer-events: none;
  z-index: 0;
}

.sv-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border-radius: 6px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
}

.sv-bar i {
  font-size: 10px;
  opacity: 0.9;
}

.sv-bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-bar.bar-green {
  background: #28a745;
}

.sv-bar.bar-purple {
  background: #7c3aed;
}

.sv-bar.bar-blue {
  background: #0d6efd;
}

.sv-bar.bar-red {
  background: #dc3545;
}

.sv-footer-cell,
.sv-footer-day {
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.sv-footer-cell {
  position: sticky;
  left: 0;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  z-index: 2;
}

.sv-footer-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 4px;
  font-size: 12px;
}

.sv-occ {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.sv-occ-bar {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}

.sv-occ-bar span {
  display: block;
  height: 100%;
  background: #005eb8;
  border-radius: 999px;
}

.sv-rate-cell.today,
.sv-cell-bg.today,
.sv-footer-day.today {
  background: #f4f9fd;
}

.sv-rate-cell.weekend:not(.today),
.sv-cell-bg.weekend:not(.today),
.sv-footer-day.weekend:not(.today) {
  background: #fbfbfb;
}
</style>
