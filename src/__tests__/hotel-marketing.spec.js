import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import api from '@/api/axios'
import i18n from '@/locales/i18n'
import HotelMarketingPage from '@/pages/marketing/HotelMarketingPage.vue'
import OwnerMarketingPage from '@/pages/owner/OwnerMarketingPage.vue'

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  managerRequests: vi.fn(),
  propose: vi.fn(),
  ownerHotels: vi.fn(),
  ownerProfile: vi.fn(),
  ownerSaveProfile: vi.fn(),
  ownerRequests: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  preferences: vi.fn(),
  updatePreferences: vi.fn(),
}))

vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    hotelMarketingApi: {
      ...actual.hotelMarketingApi,
      profile: (...args) => mocks.profile(...args),
      requests: (...args) => mocks.managerRequests(...args),
      propose: (...args) => mocks.propose(...args),
    },
    ownerApi: {
      ...actual.ownerApi,
      hotels: (...args) => mocks.ownerHotels(...args),
    },
    ownerMarketingApi: {
      ...actual.ownerMarketingApi,
      profile: (...args) => mocks.ownerProfile(...args),
      saveProfile: (...args) => mocks.ownerSaveProfile(...args),
      requests: (...args) => mocks.ownerRequests(...args),
      approve: (...args) => mocks.approve(...args),
      reject: (...args) => mocks.reject(...args),
      preferences: (...args) => mocks.preferences(...args),
      updatePreferences: (...args) => mocks.updatePreferences(...args),
    },
  }
})

const PROFILE = {
  tenant_id: 'tenant-1',
  tagline: 'Old tagline',
  description: 'Old description',
  website_url: 'https://old.example.com',
  facebook_url: 'https://facebook.com/old',
  instagram_url: 'https://instagram.com/old',
  whatsapp_number: '0711111111',
  contact_email: 'old@example.com',
  contact_phone: '0722222222',
  hero_image_url: 'https://old.example.com/hero.jpg',
  is_published: false,
}

const CHANGE = {
  field: 'tagline',
  label: 'Tagline',
  from: 'Old tagline',
  to: 'New tagline',
}

const MANAGER_REQUEST = {
  id: 7,
  status: 'pending',
  changes: [CHANGE],
  proposed_values: { tagline: 'New tagline' },
  current_values: { tagline: 'Old tagline' },
  requested_by: 'user-asha',
  requester_name: 'Asha Manager',
  created_at: '2026-11-18T10:00:00Z',
  decided_at: null,
  decision_note: null,
  decided_via: null,
}

const OWNER_REQUEST = {
  ...MANAGER_REQUEST,
  tenant_id: 'tenant-1',
  hotel_name: 'Sunset Hotel',
}

async function mountPage(component, user, path) {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/marketing', name: 'hotel-marketing', component: { template: '<div />' } },
      { path: '/owner/marketing', name: 'owner-marketing', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()

  const { useAuthStore } = await import('@/stores/auth')
  useAuthStore().user = user

  return mount(component, {
    global: { plugins: [pinia, router, i18n] },
  })
}

function buttonByText(wrapper, text) {
  return wrapper.findAll('button').find((button) => button.text().includes(text))
}

describe('hotel marketing API paths', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'get').mockResolvedValue({ data: {} })
    vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    vi.spyOn(api, 'put').mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the exact hotel change-request endpoints', async () => {
    const actual = await vi.importActual('@/api')
    const payload = { ...PROFILE, tagline: 'New tagline' }

    await actual.hotelMarketingApi.profile()
    await actual.hotelMarketingApi.requests()
    await actual.hotelMarketingApi.propose(payload)

    expect(api.get).toHaveBeenCalledWith('/v1/hotel-marketing/profile')
    expect(api.get).toHaveBeenCalledWith('/v1/hotel-marketing/change-requests')
    expect(api.post).toHaveBeenCalledWith('/v1/hotel-marketing/change-requests', payload)
  })

  it('uses the exact owner approval and preference endpoints', async () => {
    const actual = await vi.importActual('@/api')
    const note = { note: 'Not this time' }
    const channels = { channels: ['email', 'sms'] }
    const profile = { tenant_id: 'tenant-1', tagline: 'Owner edited' }

    await actual.ownerApi.hotels()
    await actual.ownerMarketingApi.profile('tenant-1')
    await actual.ownerMarketingApi.saveProfile(profile)
    await actual.ownerMarketingApi.requests({ status: 'pending' })
    await actual.ownerMarketingApi.approve(12)
    await actual.ownerMarketingApi.reject(13, note)
    await actual.ownerMarketingApi.preferences()
    await actual.ownerMarketingApi.updatePreferences(channels)

    expect(api.get).toHaveBeenCalledWith('/v1/owner/hotels')
    expect(api.get).toHaveBeenCalledWith('/v1/owner/marketing/profile', {
      params: { tenant_id: 'tenant-1' },
    })
    expect(api.put).toHaveBeenCalledWith('/v1/owner/marketing/profile', profile)
    expect(api.get).toHaveBeenCalledWith('/v1/owner/marketing/change-requests', {
      params: { status: 'pending' },
    })
    expect(api.post).toHaveBeenCalledWith('/v1/owner/marketing/change-requests/12/approve')
    expect(api.post).toHaveBeenCalledWith('/v1/owner/marketing/change-requests/13/reject', note)
    expect(api.get).toHaveBeenCalledWith('/v1/owner/marketing/preferences')
    expect(api.put).toHaveBeenCalledWith('/v1/owner/marketing/preferences', channels)
  })
})

describe('HotelMarketingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.profile.mockReset().mockResolvedValue({ data: { profile: { ...PROFILE } } })
    mocks.managerRequests.mockReset().mockResolvedValue({ data: { requests: [MANAGER_REQUEST] } })
    mocks.propose.mockReset().mockResolvedValue({
      data: {
        request: MANAGER_REQUEST,
        notification: { channels: ['email', 'sms'], notified_at: '2026-11-18T10:05:00Z' },
      },
    })
  })

  it('loads the profile and renders each proposed diff', async () => {
    const wrapper = await mountPage(
      HotelMarketingPage,
      { user_id: 'user-asha', user_role: 'manager', full_name: 'Asha Manager' },
      '/app/marketing',
    )
    await flushPromises()

    expect(mocks.profile).toHaveBeenCalled()
    expect(mocks.managerRequests).toHaveBeenCalled()
    expect(wrapper.find('#hm-tagline').element.value).toBe('Old tagline')
    expect(wrapper.text()).toContain('Tagline')
    expect(wrapper.text()).toContain('Old tagline')
    expect(wrapper.text()).toContain('New tagline')
    expect(wrapper.text()).toContain('Asha Manager')
  })

  it('submits a proposal instead of saving the profile directly', async () => {
    const wrapper = await mountPage(
      HotelMarketingPage,
      { user_id: 'user-asha', user_role: 'manager', full_name: 'Asha Manager' },
      '/app/marketing',
    )
    await flushPromises()

    await wrapper.find('#hm-tagline').setValue('New tagline')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mocks.propose).toHaveBeenCalledTimes(1)
    const payload = mocks.propose.mock.calls[0][0]
    expect(payload).toEqual(expect.objectContaining({
      tenant_id: 'tenant-1',
      tagline: 'New tagline',
      description: 'Old description',
      website_url: 'https://old.example.com',
      facebook_url: 'https://facebook.com/old',
      instagram_url: 'https://instagram.com/old',
      whatsapp_number: '0711111111',
      contact_email: 'old@example.com',
      contact_phone: '0722222222',
      hero_image_url: 'https://old.example.com/hero.jpg',
      is_published: false,
    }))
    expect(wrapper.text()).toContain('Owner notified via: email, sms')
  })

  it('hides the proposal form below level 80', async () => {
    const wrapper = await mountPage(
      HotelMarketingPage,
      { user_id: 'user-asha', user_role: 'receptionist', full_name: 'Asha' },
      '/app/marketing',
    )
    await flushPromises()

    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('cannot submit changes')
  })
})

describe('OwnerMarketingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ownerHotels.mockReset().mockResolvedValue({
      data: { hotels: [{ tenant_id: 'tenant-1', hotel_name: 'Sunset Hotel' }] },
    })
    mocks.ownerProfile.mockReset().mockResolvedValue({ data: { profile: { ...PROFILE } } })
    mocks.ownerSaveProfile.mockReset().mockResolvedValue({
      data: { profile: { ...PROFILE, tagline: 'Owner edited tagline' } },
    })
    mocks.ownerRequests.mockReset().mockResolvedValue({ data: { requests: [OWNER_REQUEST] } })
    mocks.approve.mockReset().mockResolvedValue({ data: { request: { ...OWNER_REQUEST, status: 'approved' } } })
    mocks.reject.mockReset().mockResolvedValue({ data: { request: { ...OWNER_REQUEST, status: 'rejected' } } })
    mocks.preferences.mockReset().mockResolvedValue({ data: { channels: ['email'] } })
    mocks.updatePreferences.mockReset().mockResolvedValue({ data: { channels: ['email', 'sms'] } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function mountOwnerPage() {
    const wrapper = await mountPage(
      OwnerMarketingPage,
      { user_id: 'user-owner', user_role: 'owner', full_name: 'Peter Owner' },
      '/owner/marketing',
    )
    await flushPromises()
    return wrapper
  }

  it('shows aggregated requests with hotel, requester and changed values', async () => {
    const wrapper = await mountOwnerPage()

    expect(mocks.ownerRequests).toHaveBeenCalledWith({ status: 'pending' })
    expect(mocks.preferences).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Sunset Hotel')
    expect(wrapper.text()).toContain('Asha Manager')
    expect(wrapper.text()).toContain('Old tagline')
    expect(wrapper.text()).toContain('New tagline')
  })

  it('lets the owner edit and save marketing content directly', async () => {
    const wrapper = await mountOwnerPage()

    expect(mocks.ownerHotels).toHaveBeenCalled()
    expect(mocks.ownerProfile).toHaveBeenCalledWith('tenant-1')
    expect(wrapper.find('#om-tagline').element.value).toBe('Old tagline')

    await wrapper.find('#om-tagline').setValue('Owner edited tagline')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mocks.ownerSaveProfile).toHaveBeenCalledTimes(1)
    expect(mocks.ownerSaveProfile.mock.calls[0][0]).toEqual(expect.objectContaining({
      tenant_id: 'tenant-1',
      tagline: 'Owner edited tagline',
      is_published: false,
    }))
    expect(wrapper.text()).toContain('Marketing content saved.')
  })

  it('approves a pending request', async () => {
    const wrapper = await mountOwnerPage()

    await buttonByText(wrapper, 'Approve').trigger('click')
    await flushPromises()

    expect(mocks.approve).toHaveBeenCalledWith(7)
    expect(wrapper.text()).toContain('Request approved and applied.')
  })

  it('rejects a pending request with the optional note', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Please update the hero image')
    const wrapper = await mountOwnerPage()

    await buttonByText(wrapper, 'Reject').trigger('click')
    await flushPromises()

    expect(prompt).toHaveBeenCalled()
    expect(mocks.reject).toHaveBeenCalledWith(7, {
      note: 'Please update the hero image',
    })
  })

  it('updates notification preferences to both channels', async () => {
    const wrapper = await mountOwnerPage()

    await buttonByText(wrapper, 'Both').trigger('click')
    await flushPromises()

    expect(mocks.updatePreferences).toHaveBeenCalledWith({ channels: ['email', 'sms'] })
    expect(wrapper.text()).toContain('Notification preference saved.')
  })

  it('loads every request when the all filter is chosen', async () => {
    const wrapper = await mountOwnerPage()

    await buttonByText(wrapper, 'All').trigger('click')
    await flushPromises()

    expect(mocks.ownerRequests).toHaveBeenLastCalledWith({})
  })
})
