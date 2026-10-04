import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import i18n from '@/locales/i18n'

const close = vi.fn()
const report = vi.fn()
const history = vi.fn()

vi.mock('@/api', () => ({
  nightAuditApi: {
    report: (...a) => report(...a),
    history: (...a) => history(...a),
    close: (...a) => close(...a),
  },
  fbDayCloseApi: { index: vi.fn().mockResolvedValue({ data: {} }) },
  businessDateApi: { show: vi.fn().mockResolvedValue({ data: {} }) },
}))

const NightAuditPage = (await import('@/pages/reception/NightAuditPage.vue')).default

const REPORT_OPEN = {
  closed: false,
  revenue: { rooms: 0, fnb: 0, laundry: 0, fun_games: 0, total: 0 },
  collections: { by_method: { cash: 0 }, total: 0 },
  counts: { arrivals: 0, departures: 0, in_house: 0, reservations_created: 0 },
}

async function mountPage() {
  const wrapper = mount(NightAuditPage, { global: { plugins: [i18n, createPinia()] } })
  await flushPromises()
  return wrapper
}

/*
  The page's own close action is the only .btn-lg on it; the confirm dialog
  teleports to the body, so it is addressed separately via .confirm-modal-foot.
*/
const closeButton = (w) => w.find('.btn-lg')
const confirmButton = () =>
  document.querySelector('.confirm-modal-foot .btn-primary') ||
  document.querySelector('.confirm-modal-foot button:last-child')

describe('NightAuditPage — closing a business day', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    report.mockResolvedValue({ data: { report: REPORT_OPEN, closed: false, due_outs: [] } })
    history.mockResolvedValue({ data: { day_closes: [] } })
    close.mockResolvedValue({ data: {} })
  })

  /*
    The backend refuses to close a business day that has not fully passed
    (`if ($date->isAfter(now()->subDay()->endOfDay()))` -> 422). The page used to
    default to today and offer the button anyway, so the one action the page
    exists to perform always came back 422.
  */
  it('will not offer to close the current business date', async () => {
    const wrapper = await mountPage()

    const button = closeButton(wrapper)
    expect(button).toBeDefined()
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('after midnight')
  })

  it('offers the close action once the selected date has passed', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const asInput = yesterday.toISOString().slice(0, 10)

    const wrapper = await mountPage()
    await wrapper.find('input[type="date"]').setValue(asInput)
    await flushPromises()

    expect(closeButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('does not send a request the backend is bound to reject', async () => {
    const wrapper = await mountPage()

    // The button is disabled, so a click cannot reach the API at all.
    await closeButton(wrapper).trigger('click')
    await flushPromises()

    expect(document.querySelector('.confirm-modal')).toBeNull()
    expect(close).not.toHaveBeenCalled()
  })

  it('closes a date that has passed', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const asInput = yesterday.toISOString().slice(0, 10)

    const wrapper = await mountPage()
    await wrapper.find('input[type="date"]').setValue(asInput)
    await flushPromises()

    await closeButton(wrapper).trigger('click')
    await flushPromises()

    const confirm = confirmButton()
    expect(confirm).not.toBeNull()
    confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(close).toHaveBeenCalledWith({ date: asInput })
  })

  it('reads the date in the browser timezone, not UTC', async () => {
    // toISOString() is UTC. For part of every evening the hotel is on the next
    // calendar day already, so the page used to open on yesterday.
    await mountPage()
    const sent = report.mock.calls[0][0].date
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    // The store may supply the hotel's business date; it must never be a UTC
    // reading a day ahead of the browser.
    expect(sent <= local).toBe(true)
  })
})

describe('NightAuditPage — running a missed previous day', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    history.mockResolvedValue({ data: { day_closes: [] } })
    close.mockResolvedValue({ data: {} })
  })

  /** The hotel's today, as the page computes it (browser timezone). */
  function todayIso() {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  }

  function shift(iso, days) {
    const d = new Date(`${iso}T12:00:00`)
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const openReport = (closed = false) =>
    report.mockResolvedValue({ data: { report: REPORT_OPEN, closed, due_outs: [] } })

  const banner = (w) => w.find('.missed-banner')
  const previousDayButton = (w) =>
    w.findAll('button').find((b) => b.text().includes('previous day'))

  /*
    The capability has always been there — the backend closes any date that has
    fully passed, and the date picker could reach it. What was missing was any
    signpost: the page opened on today with the close button disabled and a note
    about midnight, which reads as "come back later" rather than "yesterday is
    still open". These pin the signpost.
  */

  it('warns that yesterday was never closed when nothing has been closed', async () => {
    openReport()
    const wrapper = await mountPage()

    expect(banner(wrapper).exists()).toBe(true)
    expect(wrapper.text()).toContain(shift(todayIso(), -1))
  })

  it('stays quiet once yesterday has been closed', async () => {
    history.mockResolvedValue({ data: { day_closes: [{ close_date: shift(todayIso(), -1) }] } })
    openReport()
    const wrapper = await mountPage()

    expect(banner(wrapper).exists()).toBe(false)
  })

  it('counts a run of missed days and offers the oldest one first', async () => {
    // Closing out of order would leave the reports with holes in them, so the
    // banner points at the earliest gap rather than the most recent.
    history.mockResolvedValue({ data: { day_closes: [{ close_date: shift(todayIso(), -4) }] } })
    openReport()
    const wrapper = await mountPage()

    const text = banner(wrapper).text()
    expect(text).toContain('3 days')
    expect(wrapper.text()).toContain(shift(todayIso(), -1))
    expect(wrapper.text()).toContain(shift(todayIso(), -3))

    await banner(wrapper).find('button').trigger('click')
    await flushPromises()

    expect(report).toHaveBeenLastCalledWith({ date: shift(todayIso(), -3) })
  })

  it('does not walk past a day that was closed', async () => {
    // Closing nothing in March must not leave March listed as still open.
    history.mockResolvedValue({ data: { day_closes: [{ close_date: shift(todayIso(), -1) }] } })
    openReport()
    const wrapper = await mountPage()

    expect(banner(wrapper).exists()).toBe(false)
  })

  it('jumps to yesterday from the quick button', async () => {
    openReport()
    const wrapper = await mountPage()

    await previousDayButton(wrapper).trigger('click')
    await flushPromises()

    const yesterday = shift(todayIso(), -1)
    expect(report).toHaveBeenLastCalledWith({ date: yesterday })
    expect(wrapper.find('input[type="date"]').element.value).toBe(yesterday)
  })

  it('enables the close action for the day the quick button lands on', async () => {
    openReport()
    const wrapper = await mountPage()

    expect(closeButton(wrapper).attributes('disabled')).toBeDefined()

    await previousDayButton(wrapper).trigger('click')
    await flushPromises()

    expect(closeButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('does not offer a future business date', async () => {
    // The backend rejects one outright, so an open-ended picker is a dead end.
    openReport()
    const wrapper = await mountPage()

    expect(wrapper.find('input[type="date"]').attributes('max')).toBe(todayIso())
  })
})

describe('NightAuditPage — unresolved older bookings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    history.mockResolvedValue({ data: { day_closes: [] } })
    close.mockResolvedValue({ data: {} })
  })

  const stale = {
    count: 2,
    items: [
      { reservation_id: 'R-1', guest_name: 'Emanuel Mallya', room_number: '116', check_in_date: '2026-09-21' },
      { reservation_id: 'R-2', guest_name: 'Russo Brothers', room_number: null, check_in_date: '2026-09-24' },
    ],
  }

  const withStale = (closed = false) =>
    report.mockResolvedValue({ data: { report: REPORT_OPEN, closed, due_outs: [], stale_arrivals: stale } })

  const panel = (w) => w.find('.stale-panel')

  /*
    The close stopped depending on these, so they would otherwise just vanish
    from the UI. They stay visible: a guest who never arrived and whose booking
    was never resolved is still unresolved, whatever the audit decided.
  */

  it('lists older unresolved bookings without blocking the page', async () => {
    withStale()
    const wrapper = await mountPage()

    expect(panel(wrapper).exists()).toBe(true)
    expect(wrapper.text()).toContain('Emanuel Mallya')
    expect(wrapper.text()).toContain('2026-09-21')
    expect(wrapper.text()).toContain('Russo Brothers')
  })

  it('copes with a booking that has no room attached', async () => {
    // A cancelled room leaves the relation null; printing "Room null" would
    // read like a real room number.
    withStale()
    const wrapper = await mountPage()

    expect(wrapper.text()).not.toContain('Room null')
  })

  it('says the outstanding count', async () => {
    withStale()
    const wrapper = await mountPage()

    expect(panel(wrapper).text()).toContain('2')
  })

  it('stays hidden when there is nothing outstanding', async () => {
    report.mockResolvedValue({ data: { report: REPORT_OPEN, closed: false, due_outs: [] } })
    const wrapper = await mountPage()

    expect(panel(wrapper).exists()).toBe(false)
  })

  it('survives a response from an older API that omits the field', async () => {
    // The panel is new; the backend may not be deployed yet. An absent key must
    // not throw inside the page and leave the audit unusable.
    report.mockResolvedValue({ data: { report: REPORT_OPEN, closed: false, due_outs: [] } })
    const wrapper = await mountPage()

    expect(panel(wrapper).exists()).toBe(false)
    expect(wrapper.find('.dashboard-page').exists()).toBe(true)
  })
})

describe('NightAuditPage — layout, auto-dismiss and consequences', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    history.mockResolvedValue({ data: { day_closes: [] } })
    close.mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    vi.useRealTimers()
    document.querySelectorAll('.confirm-modal').forEach((n) => n.remove())
  })

  function todayIso() {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  }

  function shift(iso, days) {
    const d = new Date(`${iso}T12:00:00`)
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const open = (closed = false, extra = {}) =>
    report.mockResolvedValue({ data: { report: REPORT_OPEN, closed, due_outs: [], ...extra } })

  it('aligns the jump button with the date input', async () => {
    // jsdom has no layout, so alignment is asserted on the source: .form-group
    // ships margin-bottom: 16px, and flex `align-items: end` aligns to the
    // margin box, which floated the button above the input it sits beside.
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../pages/reception/NightAuditPage.vue'),
      'utf8',
    )

    expect(source).toMatch(/\.date-field\s*\{\s*margin-bottom:\s*0;/)
    expect(source).toMatch(/\.date-row\s*\{[^}]*align-items:\s*end;/)
  })

  it('keeps the jump button inside the same row as the date field', async () => {
    const wrapper = await mountPage()
    const row = wrapper.find('.date-row')

    expect(row.find('.date-field').exists()).toBe(true)
    expect(row.text()).toContain('previous day')
  })

  it('dismisses the confirm dialog on its own', async () => {
    const wrapper = await mountPage()
    await wrapper.find('input[type="date"]').setValue(shift(todayIso(), -1))
    await flushPromises()
    await closeButton(wrapper).trigger('click')
    await flushPromises()

    expect(document.querySelector('.confirm-modal')).not.toBeNull()

    vi.advanceTimersByTime(13000)
    await flushPromises()

    expect(document.querySelector('.confirm-modal')).toBeNull()
  })

  it('does not dismiss the dialog while the close is running', async () => {
    // A dialog vanishing out from under an in-flight request would leave the
    // user with no feedback at all.
    let release
    close.mockImplementation(() => new Promise((r) => { release = r }))

    const wrapper = await mountPage()
    await wrapper.find('input[type="date"]').setValue(shift(todayIso(), -1))
    await flushPromises()
    await closeButton(wrapper).trigger('click')
    await flushPromises()

    const confirm = confirmButton()
    confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    vi.advanceTimersByTime(13000)
    await flushPromises()

    expect(document.querySelector('.confirm-modal')).not.toBeNull()

    release({ data: {} })
    await flushPromises()
  })

  it('warns before closing a day out of order', async () => {
    history.mockResolvedValue({ data: { day_closes: [{ close_date: shift(todayIso(), -2) }] } })
    open()
    const wrapper = await mountPage()
    await wrapper.find('input[type="date"]').setValue(shift(todayIso(), -5))
    await flushPromises()

    const text = wrapper.find('.close-warnings').text()
    expect(text).toContain(shift(todayIso(), -5))
    expect(text).toContain(shift(todayIso(), -2))
  })

  it('names the days that stay open behind an out-of-order close', async () => {
    // Closing the 5th when the 2nd is the latest close leaves 3rd and 4th open.
    history.mockResolvedValue({ data: { day_closes: [{ close_date: shift(todayIso(), -2) }] } })
    open()
    const wrapper = await mountPage()
    await wrapper.find('input[type="date"]').setValue(shift(todayIso(), -5))
    await flushPromises()

    const text = wrapper.find('.close-warnings').text()
    expect(text).toContain(shift(todayIso(), -4))
    expect(text).toContain(shift(todayIso(), -3))
  })

  it('says the close is permanent', async () => {
    open()
    const wrapper = await mountPage()
    await wrapper.find('input[type="date"]').setValue(shift(todayIso(), -1))
    await flushPromises()

    expect(wrapper.find('.close-warnings').text().toLowerCase()).toContain('permanent')
  })

  it('repeats the top consequence inside the confirm dialog', async () => {
    history.mockResolvedValue({ data: { day_closes: [{ close_date: shift(todayIso(), -2) }] } })
    open()
    const wrapper = await mountPage()
    await wrapper.find('input[type="date"]').setValue(shift(todayIso(), -5))
    await flushPromises()
    await closeButton(wrapper).trigger('click')
    await flushPromises()

    expect(document.querySelector('.confirm-modal-message').textContent)
      .toContain(shift(todayIso(), -5))
  })

  it('separates room and date in the stale list', async () => {
    open(false, {
      stale_arrivals: {
        count: 1,
        items: [{ reservation_id: 'R-1', guest_name: 'Russo Brothers', room_number: '216', check_in_date: '2026-09-24' }],
      },
    })
    const wrapper = await mountPage()

    const chips = wrapper.findAll('.stale-list li .stale-chip')
    expect(chips).toHaveLength(2)
    expect(chips[0].text()).toContain('216')
    expect(chips[1].text()).toContain('2026-09-24')
  })
})

describe('NightAuditPage — gaps in the record and double bookings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    history.mockResolvedValue({ data: { day_closes: [] } })
    close.mockResolvedValue({ data: {} })
  })

  function todayIso() {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  }

  function shift(iso, days) {
    const d = new Date(`${iso}T12:00:00`)
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const open = (extra = {}) =>
    report.mockResolvedValue({ data: { report: REPORT_OPEN, closed: false, due_outs: [], ...extra } })

  const gapPanel = (w) => w.find('.gap-panel')
  const dupPanel = (w) => w.find('.duplicate-panel')

  it('flags days skipped between two closed days', async () => {
    // The real shape of the record: closed the 22nd, then jumped to the 24th,
    // so the 23rd was skipped rather than left pending.
    history.mockResolvedValue({
      data: {
        day_closes: [
          { close_date: shift(todayIso(), -8) },
          { close_date: shift(todayIso(), -11) },
        ],
      },
    })
    open()
    const wrapper = await mountPage()

    expect(gapPanel(wrapper).exists()).toBe(true)
    expect(gapPanel(wrapper).text()).toContain(shift(todayIso(), -10))
    expect(gapPanel(wrapper).text()).toContain(shift(todayIso(), -9))
  })

  it('says a gap makes the reports incomplete', async () => {
    history.mockResolvedValue({
      data: {
        day_closes: [
          { close_date: shift(todayIso(), -8) },
          { close_date: shift(todayIso(), -11) },
        ],
      },
    })
    open()
    const wrapper = await mountPage()

    expect(gapPanel(wrapper).text().toLowerCase()).toContain('incomplete')
  })

  it('stays quiet when the closed run has no holes', async () => {
    history.mockResolvedValue({
      data: {
        day_closes: [
          { close_date: shift(todayIso(), -8) },
          { close_date: shift(todayIso(), -9) },
          { close_date: shift(todayIso(), -10) },
        ],
      },
    })
    open()
    const wrapper = await mountPage()

    expect(gapPanel(wrapper).exists()).toBe(false)
  })

  it('stays quiet with a single closed day', async () => {
    // One day cannot enclose a gap.
    history.mockResolvedValue({ data: { day_closes: [{ close_date: shift(todayIso(), -8) }] } })
    open()
    const wrapper = await mountPage()

    expect(gapPanel(wrapper).exists()).toBe(false)
  })

  it('flags two bookings competing for one room on one date', async () => {
    open({
      stale_arrivals: {
        count: 2,
        items: [
          { reservation_id: 'R-1', guest_name: 'Russo Brothers', room_number: '216', check_in_date: '2026-09-24' },
          { reservation_id: 'R-2', guest_name: 'Russo Brothers', room_number: '216', check_in_date: '2026-09-24' },
        ],
      },
    })
    const wrapper = await mountPage()

    expect(dupPanel(wrapper).exists()).toBe(true)
    const text = dupPanel(wrapper).text()
    expect(text).toContain('216')
    expect(text).toContain('2026-09-24')
    expect(text).toContain('2 bookings')
  })

  it('groups each contested room separately', async () => {
    open({
      stale_arrivals: {
        count: 3,
        items: [
          { reservation_id: 'R-1', guest_name: 'Russo Brothers', room_number: '216', check_in_date: '2026-09-24' },
          { reservation_id: 'R-2', guest_name: 'Russo Brothers', room_number: '216', check_in_date: '2026-09-24' },
          { reservation_id: 'R-3', guest_name: 'Emanuel Mallya', room_number: '116', check_in_date: '2026-09-21' },
          { reservation_id: 'R-4', guest_name: 'Emanuel Mallya', room_number: '116', check_in_date: '2026-09-21' },
        ],
      },
    })
    const wrapper = await mountPage()

    expect(dupPanel(wrapper).findAll('li')).toHaveLength(2)
  })

  it('does not treat the same room on different dates as a clash', async () => {
    // One guest legitimately occupies 116 across two nights. Grouping on room
    // alone would report this as a double booking and cry wolf on real stays.
    open({
      stale_arrivals: {
        count: 2,
        items: [
          { reservation_id: 'R-1', guest_name: 'Emanuel Mallya', room_number: '116', check_in_date: '2026-09-21' },
          { reservation_id: 'R-2', guest_name: 'Emanuel Mallya', room_number: '116', check_in_date: '2026-09-23' },
        ],
      },
    })
    const wrapper = await mountPage()

    expect(dupPanel(wrapper).exists()).toBe(false)
  })

  it('does not treat two different rooms as a clash', async () => {
    open({
      stale_arrivals: {
        count: 2,
        items: [
          { reservation_id: 'R-1', guest_name: 'Emanuel Mallya', room_number: '116', check_in_date: '2026-09-21' },
          { reservation_id: 'R-2', guest_name: 'Russo Sisters', room_number: '117', check_in_date: '2026-09-21' },
        ],
      },
    })
    const wrapper = await mountPage()

    expect(dupPanel(wrapper).exists()).toBe(false)
  })

  it('says the clash could mean a double charge', async () => {
    open({
      stale_arrivals: {
        count: 2,
        items: [
          { reservation_id: 'R-1', guest_name: 'Russo Brothers', room_number: '216', check_in_date: '2026-09-24' },
          { reservation_id: 'R-2', guest_name: 'Russo Brothers', room_number: '216', check_in_date: '2026-09-24' },
        ],
      },
    })
    const wrapper = await mountPage()

    expect(dupPanel(wrapper).text().toLowerCase()).toContain('charged twice')
  })
})
