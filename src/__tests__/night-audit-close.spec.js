import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
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
