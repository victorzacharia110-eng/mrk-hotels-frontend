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
  registration_code: 'MRK',
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
  payment_accounts: { mpesa: { lipa_number: '4001202' } },
  logo_url: null,
}

/**
 * Manager review: "Where does hotel company data registered from? If we change
 * the name of hotel and other info such as address will the adjustment appear on
 * every panel and every invoice as well as all exportable reports including
 * waiter receipts and kitchen order?"
 *
 * Propagation already worked (every consumer reads the single tenant record);
 * what was missing was any way to edit it. These tests pin the page that closes
 * that gap.
 */
describe('HotelSettingsPage', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    show.mockReset().mockResolvedValue({ data: { hotel: { ...HOTEL } } })
    update.mockReset().mockResolvedValue({ data: { hotel: { ...HOTEL } } })
    removeLogo.mockReset().mockResolvedValue({ data: {} })
  })

  function mountPage() {
    return mount(HotelSettingsPage, { global: { plugins: [pinia, i18n] } })
  }

  it('loads the hotel details into the form', async () => {
    const wrapper = mountPage()
    await flushPromises()

    expect(show).toHaveBeenCalled()
    expect(wrapper.vm.form.hotel_name).toBe('Old Name')
    expect(wrapper.vm.form.address).toBe('123 Hotel Street')
    // TIN/VRN are the numbers the review asked about.
    expect(wrapper.vm.form.tin).toBe('123-456-789')
    expect(wrapper.vm.form.vrn).toBe('40-012345-6')
  })

  it('sends the edited name and address so every letterhead consumer picks it up', async () => {
    const wrapper = mountPage()
    await flushPromises()

    wrapper.vm.form.hotel_name = 'New Name'
    wrapper.vm.form.address = '9 Elsewhere Road'
    await wrapper.vm.save()
    await flushPromises()

    const body = update.mock.calls[0][0]
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('hotel_name')).toBe('New Name')
    expect(body.get('address')).toBe('9 Elsewhere Road')
  })

  it('omits account entries the manager cleared, so blank numbers are not stored', async () => {
    const wrapper = mountPage()
    await flushPromises()

    // The seeded account has only a lipa_number, which the main box mirrors.
    expect(wrapper.vm.accountNumber('mpesa')).toBe('4001202')

    // Adding a value then clearing it must remove the provider entirely.
    wrapper.vm.setAccount('mpesa', 'number', '0712000000')
    expect(wrapper.vm.form.payment_accounts.mpesa.number).toBe('0712000000')

    wrapper.vm.setAccount('mpesa', 'number', '')
    wrapper.vm.setAccount('mpesa', 'lipa_number', '')
    expect(wrapper.vm.form.payment_accounts.mpesa).toBeUndefined()

    await wrapper.vm.save()
    await flushPromises()
    const body = update.mock.calls[0][0]
    expect(JSON.parse(body.get('payment_accounts'))).toEqual({})
  })

  it('drops the cached export letterhead after a save', async () => {
    // The bug this covers: exports cached the hotel name for the session, so a
    // renamed hotel kept printing the old name on every PDF until a hard reload.
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
