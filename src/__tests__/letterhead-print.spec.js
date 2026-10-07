import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { orderReceiptLines, kitchenTicketLines } from '@/utils/receipts'
import { orderPrintLines } from '@/utils/orderPrint'
import { invalidateOfficialHeader } from '@/utils/officialHeader'

/**
 * The letterhead review item: a hotel saves its business details in Hotel
 * Settings, and those details must appear on the paper the till prints.
 *
 * The save path has its own test (hotel-settings.spec.js), so what is checked
 * here is the other half of the chain — the settings reaching a receipt and a
 * kitchen ticket. Reading the rendered rows is the only way to tell whether the
 * guest actually gets a TIN to check.
 */

const hotelShow = vi.hoisted(() => vi.fn())

vi.mock('@/api', () => ({
  hotelSettingsApi: { show: (...a) => hotelShow(...a) },
}))

const HOTEL = {
  hotel_name: 'MRK Grand Hotel',
  address: 'Plot 42, Sam Nujoma Road',
  city: 'Arusha',
  country: 'Tanzania',
  phone: '+255 754 000 111',
  email: 'granded@mrkhotels.test',
  tin: '123-456-789',
  vrn: '987-654-321',
}

const ORDER = {
  order_id: 'o-1',
  order_number: 'TA-0001',
  department: 'restaurant',
  table_number: '4',
  order_type: 'dine_in',
  covers: 2,
  waiter_name: 'LYDIA MANASE',
  total_amount: 12000,
  payment_status: 'unpaid',
  items: [{ menu_item_id: 1, item_name: 'Ugali', quantity: 2, subtotal: 12000 }],
}

const text = (lines) => lines.map((l) => String(l[0])).join('\n')

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
  // The letterhead is cached module-level, so each test starts from scratch.
  invalidateOfficialHeader()
  hotelShow.mockResolvedValue({ data: { hotel: HOTEL } })
})

describe('letterhead reaches the printed receipt', () => {
  it('prints the hotel name, address, contact and tax ids', async () => {
    const lines = await orderPrintLines(ORDER, 'receipt')
    const out = text(lines)

    expect(out).toContain('MRK Grand Hotel')
    expect(out).toContain('Plot 42, Sam Nujoma Road, Arusha')
    expect(out).toContain('+255 754 000 111')
    expect(out).toContain('granded@mrkhotels.test')
    expect(out).toContain('TIN: 123-456-789')
    expect(out).toContain('VRN: 987-654-321')
  })

  it('still prints the bill below the letterhead', async () => {
    const out = text(await orderPrintLines(ORDER, 'receipt'))

    expect(out).toContain('Receipt')
    expect(out).toContain('2 x Ugali')
    expect(out).toContain('Bill Amount:')
  })

  it('puts the letterhead above the bill', async () => {
    const out = text(await orderPrintLines(ORDER, 'receipt'))

    expect(out.indexOf('MRK Grand Hotel')).toBeLessThan(out.indexOf('Receipt'))
    expect(out.indexOf('TIN: 123-456-789')).toBeLessThan(out.indexOf('Bill Amount:'))
  })

  it('fetches the hotel details once no matter how many tickets print', async () => {
    await orderPrintLines(ORDER, 'receipt')
    await orderPrintLines(ORDER, 'kot')
    await orderPrintLines(ORDER, 'receipt')

    expect(hotelShow).toHaveBeenCalledTimes(1)
  })

  it('picks up renamed hotel details after the cache is invalidated on save', async () => {
    expect(text(await orderPrintLines(ORDER, 'receipt'))).toContain('MRK Grand Hotel')

    // This is what the settings save calls, so a hotel that renames itself stops
    // printing the old name on every receipt from then on.
    hotelShow.mockResolvedValue({ data: { hotel: { ...HOTEL, hotel_name: 'MRK Arusha Lodge' } } })
    invalidateOfficialHeader()

    expect(text(await orderPrintLines(ORDER, 'receipt'))).toContain('MRK Arusha Lodge')
  })
})

describe('letterhead reaches the printed kitchen ticket', () => {
  it('names the hotel and gives the kitchen a phone for the floor', async () => {
    const out = text(await orderPrintLines(ORDER, 'kot'))

    expect(out).toContain('MRK Grand Hotel')
    expect(out).toContain('Tel: +255 754 000 111')
    expect(out).toContain('KITCHEN ORDER TICKET')
    expect(out).toContain('2 x Ugali')
  })

  it('omits the tax ids, which the kitchen has no use for', async () => {
    const out = text(await orderPrintLines(ORDER, 'kot'))

    expect(out).not.toContain('TIN:')
    expect(out).not.toContain('VRN:')
  })

  it('keeps the reprint watermark between the title and the order number', async () => {
    const out = text(await orderPrintLines(ORDER, 'kot', { reprinted: true }))

    expect(out.indexOf('REPRINTED')).toBeGreaterThan(out.indexOf('KITCHEN ORDER TICKET'))
    expect(out.indexOf('REPRINTED')).toBeLessThan(out.indexOf('TA-0001'))
  })
})

describe('letterhead fallbacks', () => {
  it('falls back to the caller hotel name when the hotel has no saved details', async () => {
    hotelShow.mockResolvedValue({ data: { hotel: {} } })

    const out = text(await orderPrintLines(ORDER, 'receipt', { hotel: 'MRK Hotels' }))

    expect(out).toContain('MRK Hotels')
    // Blank fields are dropped rather than printed as empty rows.
    expect(out).not.toContain('TIN:')
  })

  it('prints the bill even when the settings endpoint is down', async () => {
    // A guest waiting at the till must not be blocked by a letterhead lookup.
    hotelShow.mockRejectedValue(new Error('network down'))

    const out = text(await orderPrintLines(ORDER, 'receipt', { hotel: 'MRK Hotels' }))

    expect(out).toContain('MRK Hotels')
    expect(out).toContain('Bill Amount:')
  })
})

describe('printed letterhead never overflows the paper', () => {
  it('wraps a long hotel name and address instead of spilling past 48 columns', () => {
    const out = orderReceiptLines(ORDER, {
      letterhead: {
        name: 'Mara Valley Safari Lodge and Conference Centre',
        address: 'Off the Arusha–Moshi Road, near Oldeani Gate, Kilimanjaro Region',
        city: 'Arusha',
        phone: '+255 754 000 111 / +255 784 222 333',
        tin: '1234567890',
        vrn: '9876543210',
      },
    })

    for (const line of out) {
      // Size-2 rows print double-width, so they only get half the columns.
      const limit = line[2] === 2 ? 24 : 48
      expect(String(line[0]).length).toBeLessThanOrEqual(limit)
    }
    // Nothing is dropped: the tax id is still on the paper.
    expect(text(out)).toContain('1234567890')
  })

  it('keeps every line within the paper width for the kitchen ticket too', () => {
    const out = kitchenTicketLines(ORDER, {
      reprinted: true,
      closed: true,
      letterhead: {
        name: 'Mara Valley Safari Lodge and Conference Centre',
        phone: '+255 754 000 111 / +255 784 222 333',
      },
    })

    for (const line of out) {
      const limit = line[2] === 2 ? 24 : 48
      expect(String(line[0]).length).toBeLessThanOrEqual(limit)
    }
  })
})
