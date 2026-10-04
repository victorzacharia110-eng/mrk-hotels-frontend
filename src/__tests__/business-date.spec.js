import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const show = vi.fn()

vi.mock('@/api', () => ({
  businessDateApi: { show: (...a) => show(...a) },
}))

const { useBusinessDateStore } = await import('@/stores/businessDate')

describe('businessDate store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('falls back to the local date before the fetch lands', () => {
    const store = useBusinessDateStore()
    const local = new Date()
    const expected = new Date(local.getTime() - local.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10)

    expect(store.loaded).toBe(false)
    expect(store.current).toBe(expected)
  })

  it('loads the hotel business date, calendar day and timezone', async () => {
    show.mockResolvedValue({
      data: {
        business_date: '2026-05-09',
        today: '2026-05-10',
        timezone: 'Africa/Dar_es_Salaam',
        latest_closed_date: '2026-05-08',
        auto_advanced: true,
      },
    })

    const store = useBusinessDateStore()
    await store.ensureLoaded()

    expect(store.current).toBe('2026-05-09')
    expect(store.calendarToday).toBe('2026-05-10')
    expect(store.timezone).toBe('Africa/Dar_es_Salaam')
    expect(store.latestClosedDate).toBe('2026-05-08')
    expect(store.autoAdvanced).toBe(true)
    expect(store.auditDue).toBe(true)
    expect(store.loaded).toBe(true)
  })

  it('keeps the local fallback when the fetch fails', async () => {
    show.mockRejectedValue(new Error('offline'))

    const store = useBusinessDateStore()
    await store.ensureLoaded()

    expect(store.loaded).toBe(false)
    expect(store.current).toBeTruthy()
  })
})
