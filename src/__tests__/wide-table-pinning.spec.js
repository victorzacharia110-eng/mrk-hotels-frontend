import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import i18n from '@/locales/i18n'

const roomIndex = vi.fn()
const reservationIndex = vi.fn()
const reservationShow = vi.fn()

vi.mock('@/api', () => ({
  roomApi: { index: (...a) => roomIndex(...a), stopSell: vi.fn().mockResolvedValue({ data: { blocks: [] } }) },
  reservationApi: {
    index: (...a) => reservationIndex(...a),
    show: (...a) => reservationShow(...a),
  },
  guestApi: { index: vi.fn().mockResolvedValue({ data: { data: [] } }) },
  invoiceApi: { index: vi.fn().mockResolvedValue({ data: { data: [] } }) },
  paymentApi: { index: vi.fn().mockResolvedValue({ data: { data: [] } }) },
  publicApi: { index: vi.fn().mockResolvedValue({ data: { data: [] } }) },
}))

const authModule = await import('@/stores/auth')
const RoomListPage = (await import('@/pages/rooms/RoomListPage.vue')).default
const ReservationListPage = (await import('@/pages/reservations/ReservationListPage.vue')).default

const STUBS = {
  SearchableSelect: true,
  TableExportButton: true,
  StayDates: true,
  PhoneInput: true,
  CountryCitySelect: true,
  PaymentMethodSelect: true,
  DeleteConfirmModal: true,
}

function roomPage() {
  return {
    data: {
      data: [
        {
          room_id: 'r1',
          room_number: '101',
          room_type: 'single',
          floor: '1',
          price_per_night: 50000,
          max_occupancy: 2,
          status: 'available',
        },
      ],
      current_page: 1,
      last_page: 1,
      per_page: 20,
      total: 1,
    },
  }
}

function reservationPage(status = 'confirmed') {
  return {
    data: {
      data: [
        {
          reservation_id: 'res1',
          reservation_number: 'R-1',
          guest_name: 'Amina Juma',
          guest_phone: '0754000000',
          booking_type: 'single',
          room: { room_id: 'r1', room_number: '101' },
          room_type: 'single',
          check_in: '2026-01-10',
          check_out: '2026-01-12',
          total_amount: 120000,
          amount_paid: 0,
          balance_due: 120000,
          status,
        },
      ],
      current_page: 1,
      last_page: 1,
      per_page: 20,
      total: 1,
    },
  }
}

/**
 * Mounts the page as a manager, so the row actions are on screen. The columns
 * must be reachable whether or not the buttons happen to be rendered.
 */
function build(component, user = { user_role: 'hotel_admin' }) {
  const pinia = createPinia()
  setActivePinia(pinia)
  authModule.useAuthStore().user = user
  return mount(component, { global: { plugins: [pinia, i18n], stubs: STUBS } })
}

const css = readFileSync(resolve(process.cwd(), 'src/assets/base.css'), 'utf8')
// The stop-sell calendar is a different table in a different file, and its grid
// has the same pinning requirement with one less axis.
const roomPageSrc = readFileSync(
  resolve(process.cwd(), 'src/pages/rooms/RoomListPage.vue'),
  'utf8',
)

describe('Wide tables stay usable when the screen is small', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    roomIndex.mockReset()
    reservationIndex.mockReset()
    roomIndex.mockResolvedValue(roomPage())
    reservationIndex.mockResolvedValue(reservationPage())
  })

  it('pins the header, the identity column and the actions on the rooms table', async () => {
    const wrapper = build(RoomListPage)
    await flushPromises()

    const scroll = wrapper.find('.table-scroll.is-pinned')
    expect(scroll.exists()).toBe(true)
    const table = scroll.find('table.table-pinned')
    expect(table.exists()).toBe(true)

    // One of each in the header row, and the same in the body. A pinned header
    // with an unpinned cell underneath it is the mismatch that makes the labels
    // line up with the wrong column.
    for (const cls of ['pin-col', 'actions-col']) {
      expect(table.findAll(`thead th.${cls}`).length).toBe(1)
      expect(table.findAll(`tbody tr td.${cls}`).length).toBe(1)
    }
  })

  it('pins the header, the identity column and the actions on the reservations table', async () => {
    const wrapper = build(ReservationListPage)
    await flushPromises()

    const table = wrapper.find('.table-scroll.is-pinned table.table-pinned')
    expect(table.exists()).toBe(true)
    for (const cls of ['pin-col', 'actions-col']) {
      expect(table.findAll(`thead th.${cls}`).length).toBe(1)
      expect(table.findAll(`tbody tr td.${cls}`).length).toBe(1)
    }
  })

  it('pins the same way whichever lifecycle the reservation is in', async () => {
    // The action buttons change with status, so a row can go from five wide
    // buttons to one. The columns must not drift with them.
    for (const status of ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']) {
      reservationIndex.mockResolvedValue(reservationPage(status))
      const wrapper = build(ReservationListPage)
      await flushPromises()

      const row = wrapper.find('.table-pinned tbody tr')
      expect(row.find('td.pin-col').exists()).toBe(true)
      expect(row.find('td.actions-col').exists()).toBe(true)
      wrapper.unmount()
    }
  })

  it('does not let a table clip itself out of its own sticky header', () => {
    // `.table` rounds its corners with `overflow: hidden`, which silently makes
    // every table a scroll container. A sticky header inside one then pins to
    // the table's own top edge and rides away with the rows: measured in a real
    // browser, the header drifted -700px on both tables before this was fixed,
    // even though the sticky rule itself was present and correct.
    const pinned = css.match(/\.table\.table-pinned\s*\{([^}]*)\}/)
    expect(pinned).toBeTruthy()
    expect(pinned[1]).toMatch(/overflow:\s*visible/)

    // The clip is what drew the table's own frame, so the wrapper has to be the
    // only frame, or the two edges sit on top of each other.
    expect(pinned[1]).toMatch(/border:\s*none/)

    const corner = css.match(/\.table-pinned thead th:first-child\s*\{([^}]*)\}/)
    expect(corner).toBeTruthy()
    expect(corner[1]).toMatch(/border-top-left-radius:\s*var\(--radius\)/)
  })

  it('gives the stop-sell calendar a header that stays put', () => {
    // Same trap: the calendar is a `.table`, so it needs the same escape.
    const cal = roomPageSrc.match(/\.stop-sell-calendar\s*\{([^}]*)\}/)
    expect(cal).toBeTruthy()
    expect(cal[1]).toMatch(/overflow:\s*visible/)
    expect(cal[1]).toMatch(/table-layout:\s*fixed/)

    // A sticky header needs something to pin to, so the calendar box is given a
    // height of its own and scrolls inside it.
    const scroll = roomPageSrc.match(/\.table-scroll\.cal-scroll\s*\{([^}]*)\}/)
    expect(scroll).toBeTruthy()
    expect(scroll[1]).toMatch(/max-height:/)
    expect(scroll[1]).toMatch(/overflow-y:\s*auto/)

    // The room column already pinned horizontally and must out-rank the day
    // headers, or it slides underneath them.
    expect(roomPageSrc).toMatch(/\.stop-sell-calendar thead th\.cal-room-col\s*\{[^}]*z-index:\s*3/)
  })

  it('actually sticks the header, the pinned columns and the actions', () => {
    // jsdom resolves no layout, so the positioning is asserted on the
    // stylesheet that ships.
    expect(css).toMatch(/\.table-pinned thead th\s*\{[^}]*position:\s*sticky/)
    expect(css).toMatch(/\.table-pinned \.pin-col\s*\{[^}]*position:\s*sticky[^}]*left:\s*0/)
    expect(css).toMatch(/\.table-pinned \.actions-col\s*\{[^}]*position:\s*sticky[^}]*right:\s*0/)

    // `overflow-x: auto` also makes the wrapper a vertical scroll container that
    // never scrolls, so a sticky top would silently do nothing. The small-screen
    // rule is what gives it a height and makes the header stick.
    expect(css).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.table-scroll\.is-pinned\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/,
    )

    // Pinned cells must be opaque or the scrolled columns show through them.
    expect(css).toMatch(/\.table-pinned \.actions-col\s*\{[^}]*background:\s*var\(--card\)/)
  })

  it('gives every action button a label that survives the icon-only collapse', async () => {
    const wrapper = build(RoomListPage)
    await flushPromises()

    const actions = wrapper.find('td.actions-col .actions')
    const buttons = actions.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const btn of buttons) {
      // Below 900px the text is hidden and the icon is all that is left, so the
      // accessible name has to come from aria-label and the tooltip from title.
      expect(btn.attributes('aria-label')).toBeTruthy()
      expect(btn.attributes('title')).toBeTruthy()
    }
  })

  it('does not collapse a button that has no icon to fall back on', async () => {
    // Two reservation actions had text but no icon, so there was nothing left
    // to show once the label was hidden. Every button needs both halves.
    //
    // Signed in at the front desk, not as management: `canOperate` is false for
    // hotel_admin, so signing in as one renders a single View button and this
    // assertion would pass without ever looking at the buttons that were broken.
    const seen = new Set()

    for (const status of ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']) {
      reservationIndex.mockResolvedValue(reservationPage(status))
      const wrapper = build(ReservationListPage, { user_role: 'receptionist' })
      await flushPromises()

      const buttons = wrapper.findAll('td.actions-col .actions button')
      for (const btn of buttons) {
        const label = btn.find('.btn-label').text()
        expect(btn.find('.btn-label').exists()).toBe(true)
        expect(btn.find('i').exists()).toBe(true)
        seen.add(label)
      }
      wrapper.unmount()
    }

    // Guards the gap above: if only management actions render, the sweep proves
    // nothing, so insist the front-desk buttons were the ones inspected.
    // Read the labels from i18n rather than hardcoding them, so rewording a
    // button does not read as a failure here.
    const t = i18n.global.t.bind(i18n.global)
    const expected = [
      t('common.view'),
      t('reservations.checkIn'),
      t('reservations.checkOut'),
      t('reservations.noShow'),
      t('common.cancel'),
      t('reservations.deletePermanent'),
    ]
    for (const action of expected) {
      expect(seen).toContain(action)
    }
  })
})
