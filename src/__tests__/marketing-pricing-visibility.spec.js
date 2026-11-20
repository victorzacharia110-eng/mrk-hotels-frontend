import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import i18n from '@/locales/i18n'
import { useMarketingContent } from '@/composables/useMarketingContent'

const bootstrapGet = vi.hoisted(() => vi.fn())
const pricingGet = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: { products: [], features: [], plans: [] } }),
)

vi.mock('@/api', () => ({
  publicMarketingApi: {
    bootstrap: bootstrapGet,
    pricing: pricingGet,
  },
}))

const MrkMarketingLayout = (await import('@/layouts/MrkMarketingLayout.vue')).default
const MarketingPricingPage = (await import('@/pages/marketing/MarketingPricingPage.vue')).default
const { clearBootstrap } = useMarketingContent()

function marketingPayload(settings = {}, pages = []) {
  return {
    data: {
      settings,
      pages,
      integrations: [],
      faqs: [],
      team_members: [],
      media: [],
      pricing: { products: [], features: [], plans: [] },
    },
  }
}

async function mountLayout() {
  const wrapper = mount(MrkMarketingLayout, {
    global: {
      plugins: [i18n, createPinia()],
      stubs: { RouterLink: RouterLinkStub, RouterView: true, ThemeToggle: true },
    },
  })
  await flushPromises()
  return wrapper
}

async function mountPricingPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'marketing-home', component: { template: '<div>home</div>' } },
      { path: '/pricing', name: 'marketing-pricing', component: MarketingPricingPage },
    ],
  })
  router.push('/pricing')
  await router.isReady()
  const wrapper = mount(MarketingPricingPage, {
    global: { plugins: [i18n, createPinia(), router] },
  })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  clearBootstrap()
  bootstrapGet.mockReset()
  pricingGet.mockReset()
  pricingGet.mockResolvedValue({ data: { products: [], features: [], plans: [] } })
})

afterEach(() => {
  clearBootstrap()
  vi.useRealTimers()
})

describe('marketing pricing visibility', () => {
  it('hides MRK pricing links until show_pricing is enabled', async () => {
    bootstrapGet.mockResolvedValue(marketingPayload())
    let wrapper = await mountLayout()
    let targets = wrapper.findAllComponents(RouterLinkStub).map((link) => link.props('to'))
    expect(targets).not.toContainEqual({ name: 'marketing-pricing' })
    expect(targets).toContain('/portal/pricing')
    wrapper.unmount()

    clearBootstrap()
    bootstrapGet.mockResolvedValue(marketingPayload({ show_pricing: true }))
    wrapper = await mountLayout()
    targets = wrapper.findAllComponents(RouterLinkStub).map((link) => link.props('to'))
    expect(targets).toContainEqual({ name: 'marketing-pricing' })
    expect(targets).toContain('/portal/pricing')
    wrapper.unmount()
  })

  it('redirects direct MRK pricing visits home when disabled', async () => {
    bootstrapGet.mockResolvedValue(marketingPayload({ show_pricing: false }))
    await useMarketingContent().loadBootstrap()
    const { wrapper, router } = await mountPricingPage()
    expect(router.currentRoute.value.name).toBe('marketing-home')
    expect(wrapper.text()).not.toContain('Pricing')
    wrapper.unmount()
  })

  it('renders MRK pricing when enabled', async () => {
    bootstrapGet.mockResolvedValue(marketingPayload({ show_pricing: true }))
    await useMarketingContent().loadBootstrap()
    const { wrapper, router } = await mountPricingPage()
    expect(router.currentRoute.value.name).toBe('marketing-pricing')
    expect(wrapper.text()).toContain('Pricing')
    wrapper.unmount()
  })
})

describe('product hub menu', () => {
  it('keeps the menu open until the close delay elapses', async () => {
    bootstrapGet.mockResolvedValue(
      marketingPayload({}, [{ slug: 'pms', title: 'PMS', show_in_nav: true }]),
    )
    const wrapper = await mountLayout()
    const dropdown = wrapper.find('.mrk-dropdown')

    await dropdown.trigger('mouseenter')
    expect(wrapper.find('.mrk-dropdown-menu').exists()).toBe(true)

    vi.useFakeTimers()
    await dropdown.trigger('mouseleave')
    expect(wrapper.find('.mrk-dropdown-menu').exists()).toBe(true)

    vi.advanceTimersByTime(250)
    await nextTick()
    expect(wrapper.find('.mrk-dropdown-menu').exists()).toBe(false)
    wrapper.unmount()
  })

  it('stays open when the pointer moves into the menu', async () => {
    bootstrapGet.mockResolvedValue(
      marketingPayload({}, [{ slug: 'pms', title: 'PMS', show_in_nav: true }]),
    )
    const wrapper = await mountLayout()
    const dropdown = wrapper.find('.mrk-dropdown')

    await dropdown.trigger('mouseenter')
    vi.useFakeTimers()
    await dropdown.trigger('mouseleave')
    await wrapper.find('.mrk-dropdown-menu').trigger('mouseenter')

    vi.advanceTimersByTime(250)
    await nextTick()
    expect(wrapper.find('.mrk-dropdown-menu').exists()).toBe(true)
    wrapper.unmount()
  })
})
