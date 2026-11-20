import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const show = vi.fn()
const update = vi.fn()
const removeLogo = vi.fn()

vi.mock('@/api', () => ({
  hotelSettingsApi: {
    show: (...a) => show(...a),
    update: (...a) => update(...a),
    removeLogo: (...a) => removeLogo(...a),
  },
}))

const HotelSettingsPage = (await import('@/pages/settings/HotelSettingsPage.vue')).default

const HOTEL = {
  hotel_name: 'Old Name',
  registration_code: '123456',
  contact_person: 'Asha',
  email: 'old@example.com',
  phone: '0712345678',
  address: '123 Hotel Street',
  city: 'Dodoma',
  country: 'Tanzania',
  tin: '123-456-789',
  vrn: '40-012345-6',
  timezone: 'Africa/Dar_es_Salaam',
  payment_methods: ['cash', 'mobile_money'],
  payment_accounts: { mpesa: { lipa_number: '4001202', provider_name: 'M-Pesa' } },
  logo_url: null,
}

describe('HotelSettingsPage', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    show.mockReset().mockResolvedValue({ data: { hotel: JSON.parse(JSON.stringify(HOTEL)) } })
    update.mockReset().mockResolvedValue({ data: { hotel: JSON.parse(JSON.stringify(HOTEL)) } })
    removeLogo.mockReset().mockResolvedValue({ data: {} })
  })

  function mountPage() {
    return mount(HotelSettingsPage, { global: { plugins: [pinia, i18n] } })
  }

  it('loads hotel details into structured form', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(show).toHaveBeenCalled()
    expect(wrapper.vm.form.hotel_name).toBe('Old Name')
    expect(wrapper.vm.form.address_street).toBe('123 Hotel Street')
    expect(wrapper.vm.form.tin).toBe('123-456-789')
    expect(wrapper.vm.form.vrn).toBe('40-012345-6')
    expect(Array.isArray(wrapper.vm.form.payment_methods)).toBe(true)
    expect(Array.isArray(wrapper.vm.form.payment_accounts_list)).toBe(true)
  })

  it('sends edited name and structured address so letterhead consumers pick it up', async () => {
    const wrapper = mountPage()
    await flushPromises()

    wrapper.vm.form.hotel_name = 'New Name'
    wrapper.vm.form.address_coordinates = '-6.7924, 39.2083'
    wrapper.vm.form.address_po_box = '12345'
    wrapper.vm.form.address_street = '9 Elsewhere Road'
    await wrapper.vm.save()
    await flushPromises()

    const body = update.mock.calls[0][0]
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('hotel_name')).toBe('New Name')
    const addr = JSON.parse(body.get('address'))
    expect(addr.coordinates).toBe('-6.7924, 39.2083')
    expect(addr.po_box).toBe('12345')
    expect(addr.street).toBe('9 Elsewhere Road')
  })

  it('omits empty provider/account entries so blank numbers are not stored', async () => {
    const wrapper = mountPage()
    await flushPromises()

    // Clear loaded account fields
    for (const acc of wrapper.vm.form.payment_accounts_list) {
      acc.number = ''
      acc.lipa_number = ''
      acc.name = ''
      acc.provider_name = ''
      acc.method = ''
      acc.description = ''
      acc.key = ''
    }

    await wrapper.vm.save()
    await flushPromises()
    const body = update.mock.calls[0][0]
    expect(JSON.parse(body.get('payment_accounts'))).toEqual({})
  })

  it('drops the cached export letterhead after a save', async () => {
    show.mockResolvedValue({ data: { hotel: { hotel_name: 'Old Name' } } })
    const { getOfficialHeader } = await import('@/utils/officialHeader')
    expect((await getOfficialHeader()).name).toBe('Old Name')

    update.mockResolvedValue({ data: { hotel: { hotel_name: 'New Name', address: 'Plot 5' } } })
    const wrapper = mountPage()
    await flushPromises()
    wrapper.vm.form.hotel_name = 'New Name'
    await wrapper.vm.save()
    await flushPromises()

    show.mockResolvedValue({ data: { hotel: { hotel_name: 'New Name' } } })
    expect((await getOfficialHeader()).name).toBe('New Name')
  })

  it('removes the logo through the delete endpoint', async () => {
    show.mockResolvedValue({ data: { hotel: { ...HOTEL, logo_url: 'https://cdn/logo.png' } } })
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.vm.removeLogo()
    await flushPromises()

    expect(removeLogo).toHaveBeenCalled()
    expect(wrapper.vm.logoUrl).toBe('')
  })
})
