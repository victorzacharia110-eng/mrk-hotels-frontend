import { describe, expect, it } from 'vitest'
import { displayBookingReference, normalizeBookingReference } from '@/utils/bookingReference'

describe('booking reference aliases', () => {
  it('displays a stored BK code as a RES reference', () => {
    expect(displayBookingReference('BK-2026-0001')).toBe('RES-2026-0001')
    expect(displayBookingReference('bk-2026-42')).toBe('RES-2026-42')
  })

  it('displays a hotel-coded BK code as a RES reference', () => {
    expect(displayBookingReference('BK-THB-2026-00042A')).toBe('RES-2026-00042A')
    expect(displayBookingReference('BK-2026-00042A')).toBe('RES-2026-00042A')
  })

  it('leaves non BK references alone', () => {
    expect(displayBookingReference('RES-2026-0001')).toBe('RES-2026-0001')
    expect(displayBookingReference('HTL-99')).toBe('HTL-99')
    expect(displayBookingReference(null)).toBe('')
  })

  it('normalises a RES alias back to the stored BK code', () => {
    expect(normalizeBookingReference('RES-2026-0001')).toBe('BK-2026-0001')
    expect(normalizeBookingReference('res-2026-7')).toBe('BK-2026-7')
    expect(normalizeBookingReference('BK-2026-0001')).toBe('BK-2026-0001')
    expect(normalizeBookingReference('RES-2026-00042A')).toBe('BK-2026-00042A')
  })
})
