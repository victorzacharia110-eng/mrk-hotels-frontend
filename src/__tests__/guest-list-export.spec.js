import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GuestListPage from '@/pages/guests/GuestListPage.vue'
import i18n from '@/locales/i18n'
import * as XLSX from 'xlsx'

const { autoTable } = vi.hoisted(() => ({ autoTable: vi.fn() }))

const api = vi.hoisted(() => ({
  guestApi: { index: vi.fn() },
  hotelSettingsApi: { show: vi.fn() },
}))

vi.mock('@/api', () => api)
vi.mock('@/utils/download', () => ({ saveBlob: vi.fn() }))
vi.mock('jspdf', () => ({
  jsPDF: class {
    internal = { pageSize: { width: 210, height: 297 } }
    setFontSize = vi.fn()
    setFont = vi.fn()
    setTextColor = vi.fn()
    setDrawColor = vi.fn()
    setLineWidth = vi.fn()
    text = vi.fn()
    line = vi.fn()
    addPage = vi.fn()
    output = vi.fn(() => new ArrayBuffer(8))
  },
}))
vi.mock('jspdf-autotable', () => ({ autoTable: undefined, applyPlugin: undefined, default: { default: autoTable } }))

const GUESTS = [
  {
    guest_id: 'g1',
    full_name: 'Asha Juma',
    email: 'asha@example.com',
    phone: '0712000111',
    id_type: 'national_id',
    id_number: 'NID-1',
    nationality: 'Tanzanian',
    vip_status: true,
    city: 'Dodoma',
    country: 'Tanzania',
  },
  {
    guest_id: 'g2',
    full_name: 'Juma Ali',
    email: 'juma@example.com',
    phone: '0712000222',
    id_type: 'passport',
    id_number: 'P-2',
    nationality: 'Kenyan',
    vip_status: false,
    city: 'Arusha',
    country: 'Kenya',
  },
]

let wrapper

async function openExport(kind) {
  await wrapper.find('.export-wrap > button').trigger('click')
  const item = wrapper.findAll('[role="menuitem"]').find((button) => button.text().includes(kind))
  expect(item, `${kind} export menu item`).toBeTruthy()
  await item.trigger('click')
  await flushPromises()
}

describe('guest list export', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    autoTable.mockClear()
    api.guestApi.index.mockReset().mockResolvedValue({
      data: { data: GUESTS, meta: { last_page: 1 } },
    })
    api.hotelSettingsApi.show.mockReset().mockResolvedValue({
      data: { hotel: { hotel_name: 'MRK Hotel', city: 'Dodoma' } },
    })
    const { saveBlob } = await import('@/utils/download')
    vi.mocked(saveBlob).mockClear()

    wrapper = mount(GuestListPage, {
      global: {
        plugins: [i18n],
        stubs: { CountryCitySelect: true, PhoneInput: true, SearchableSelect: true },
      },
    })
    await flushPromises()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('exports every guest as CSV with the real filtered rows', async () => {
    await openExport('CSV')

    expect(api.guestApi.index).toHaveBeenCalledWith(expect.objectContaining({ page: 1, per_page: 100 }))
    const { saveBlob } = await import('@/utils/download')
    expect(saveBlob).toHaveBeenCalledTimes(1)
    const [blob, filename] = saveBlob.mock.calls[0]
    expect(filename).toBe('guests.csv')
    const text = await blob.text()
    expect(text).toContain('Asha Juma')
    expect(text).toContain('Juma Ali')
    expect(text).not.toContain('[object Object]')
  })

  it('exports every guest as XLSX with the real filtered rows', async () => {
    await openExport('Excel')

    const { saveBlob } = await import('@/utils/download')
    expect(saveBlob).toHaveBeenCalledTimes(1)
    const [blob, filename] = saveBlob.mock.calls[0]
    expect(filename).toBe('guests.xlsx')
    const workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const values = XLSX.utils.sheet_to_json(sheet, { header: 1 }).flat().join(' ')
    expect(values).toContain('Asha Juma')
    expect(values).toContain('Juma Ali')
  })

  it('exports every guest as PDF through the real autoTable resolver', async () => {
    await openExport('PDF')

    const { saveBlob } = await import('@/utils/download')
    expect(saveBlob).toHaveBeenCalledTimes(1)
    expect(saveBlob.mock.calls[0][1]).toBe('guests.pdf')
    expect(autoTable).toHaveBeenCalledTimes(1)
    const body = autoTable.mock.calls[0][1].body
    expect(body.flat()).toContain('Asha Juma')
    expect(body.flat()).toContain('Juma Ali')
  })
})
