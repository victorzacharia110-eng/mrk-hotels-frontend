import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'

const show = vi.fn()
const updateSubscription = vi.fn()
const tenantAnalytics = vi.fn()
const planIndex = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 't1' } }),
}))

vi.mock('@/utils/currency', () => ({
  useTenantCurrency: () => ({ curCode: () => 'TZS' }),
}))

vi.mock('@/api', () => ({
  tenantApi: {
    show: (...args) => show(...args),
    update: vi.fn(),
    updateSubscription: (...args) => updateSubscription(...args),
    owners: vi.fn(),
    createOwner: vi.fn(),
    uploadBranding: vi.fn(),
    backup: vi.fn(),
  },
  superadminReportApi: {
    tenantAnalytics: (...args) => tenantAnalytics(...args),
  },
  planApi: {
    index: (...args) => planIndex(...args),
  },
}))

const TenantDetailPage = (await import('@/pages/superadmin/TenantDetailPage.vue')).default
const { state, closeResult } = await import('@/composables/useSuperadminResult')

const TENANT = {
  tenant_id: 't1',
  hotel_name: 'Test Hotel',
  subdomain: 'test',
  status: 'active',
  subscription_plan: 'growth',
  subscription_status: 'active',
  features: null,
  payment_methods: [],
  payment_accounts: {},
}

describe('superadmin feature feedback modal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    closeResult()
    show.mockReset().mockResolvedValue({ data: { tenant: { ...TENANT } } })
    updateSubscription.mockReset().mockResolvedValue({ data: { message: 'Saved' } })
    tenantAnalytics.mockReset().mockResolvedValue({ data: {} })
    planIndex.mockReset().mockResolvedValue({
      data: {
        plans: [{ slug: 'growth', label: 'Growth', price_monthly: 100, features: ['reservations', 'payment_methods'] }],
        feature_labels: {
          reservations: { label: 'Reservations', description: '' },
          payment_methods: { label: 'Payment Methods', description: '' },
        },
        feature_prices: {},
      },
    })
  })

  function mountPage() {
    return mount(TenantDetailPage, {
      global: {
        plugins: [i18n],
        stubs: { RouterLink: true, SearchableSelect: true, ProviderLogo: true },
      },
    })
  }

  it('saves a feature checkbox immediately and shows a success modal', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const checkbox = wrapper.findAll('input.feature-checkbox').find((input) => input.attributes('value') === 'reservations')
    await checkbox.setValue(false)
    await flushPromises()

    expect(updateSubscription).toHaveBeenCalled()
    expect(updateSubscription.mock.calls[0][1].features).not.toContain('reservations')
    expect(state.show).toBe(true)
    expect(state.type).toBe('success')
    expect(state.message).toBe('Saved')
  })

  it('shows an error modal and restores the checkbox when saving fails', async () => {
    updateSubscription.mockRejectedValueOnce({ response: { data: { message: 'No permission' } } })
    const wrapper = mountPage()
    await flushPromises()

    const checkbox = wrapper.findAll('input.feature-checkbox').find((input) => input.attributes('value') === 'reservations')
    await checkbox.setValue(false)
    await flushPromises()

    expect(state.show).toBe(true)
    expect(state.type).toBe('error')
    expect(state.message).toBe('No permission')
    expect(wrapper.vm.selectedFeatures).toContain('reservations')
  })
})
