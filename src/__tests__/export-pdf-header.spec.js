import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Manager review: "In export report particularly on PDF EXPORT the info below
 * is on the left side of the screen but should be shifted to the right while the
 * company name [stays] on the left side."
 *
 * jsPDF cannot lay out in jsdom, so the document is mocked and the placement
 * calls are inspected directly.
 */
const text = vi.fn()
const line = vi.fn()
const save = vi.fn()
const pageSize = { width: 210, height: 297 }

vi.mock('jspdf', () => ({
  jsPDF: class {
    internal = { pageSize }
    setFontSize = vi.fn()
    setFont = vi.fn()
    setTextColor = vi.fn()
    setDrawColor = vi.fn()
    setLineWidth = vi.fn()
    text = text
    line = line
    save = save
    addPage = vi.fn()
    lastAutoTable = { finalY: 10 }
  },
}))

vi.mock('jspdf-autotable', () => ({ default: vi.fn() }))

const HEADER = {
  name: 'MRK Grand Hotel',
  address: '123 Hotel Street',
  city: 'Dodoma',
  country: 'Tanzania',
  phone: '0712345678',
  email: 'hotel@mrkhotels.test',
  tin: '123-456-789',
  vrn: '40-012345-6',
}

describe('exportPDF letterhead', () => {
  beforeEach(() => {
    text.mockClear()
    line.mockClear()
    save.mockClear()
  })

  it('keeps the company name on the left and right-aligns the contact block', async () => {
    const { exportPDF } = await import('@/utils/export')

    try {
      exportPDF("rooms", [{ id: 1 }], [{ key: "id", label: "ID" }], "Rooms", { header: HEADER })
    } catch {
      // jsPDF/autotable layout is not available in jsdom; the draw calls made
      // before that point are what matters here.
    }

    const margin = 14
    const rightEdge = pageSize.width - margin

    // Company name stays hard left, with no align override.
    const nameCall = text.mock.calls.find((call) => call[0] === 'MRK GRAND HOTEL')
    expect(nameCall, 'company name is drawn').toBeDefined()
    expect(nameCall[1]).toBe(margin)
    expect(nameCall[3]).toBeUndefined()

    // Every contact detail line is flushed right.
    for (const expected of ['123 Hotel Street, Dodoma, Tanzania', 'Tel: 0712345678', 'TIN: 123-456-789', 'VRN: 40-012345-6']) {
      const call = text.mock.calls.find((c) => c[0] === expected)
      expect(call, `detail line "${expected}" is drawn`).toBeDefined()
      expect(call[1]).toBe(rightEdge)
      expect(call[3]).toEqual({ align: 'right' })
    }
  })
})
