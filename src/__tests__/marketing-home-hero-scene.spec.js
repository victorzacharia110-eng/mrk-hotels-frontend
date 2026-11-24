import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import MarketingSections from '@/pages/marketing/MarketingSections.vue'

vi.mock('@/api', () => ({
  publicMarketingApi: {
    pricing: vi.fn().mockResolvedValue({ data: { products: [], features: [], plans: [] } }),
    contactSubmission: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

const originalMatchMedia = window.matchMedia
const OriginalIntersectionObserver = window.IntersectionObserver
const originalGetContext = HTMLCanvasElement.prototype.getContext
let observerCallback = null

class IntersectionObserverMock {
  constructor(callback) {
    observerCallback = callback
    this.disconnect = vi.fn()
  }

  observe() {}
}

function mockMedia({ reducedMotion = false, smallScreen = false } = {}) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query) => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : query.includes('max-width') ? smallScreen : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function heroPage() {
  return {
    title: 'Home',
    sections: [
      {
        id: 1,
        section_type: 'hero',
        sort_order: 0,
        is_active: true,
        heading: 'Stay ahead',
        subheading: 'Intro',
        body_json: { body: 'Lead' },
      },
    ],
  }
}

async function mountSections(enableHeroScene = false) {
  const wrapper = mount(MarketingSections, {
    props: { page: heroPage(), enableHeroScene },
    global: { plugins: [i18n, createPinia()] },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  observerCallback = null
  setActivePinia(createPinia())
  mockMedia()
  window.IntersectionObserver = IntersectionObserverMock
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
})

afterEach(() => {
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    })
  } else {
    delete window.matchMedia
  }
  if (OriginalIntersectionObserver) window.IntersectionObserver = OriginalIntersectionObserver
  else delete window.IntersectionObserver
  HTMLCanvasElement.prototype.getContext = originalGetContext
})

describe('marketing home hero scene', () => {
  it('keeps the static hero when the scene is not enabled', async () => {
    const wrapper = await mountSections(false)
    observerCallback?.([{ isIntersecting: true }])
    await flushPromises()

    expect(wrapper.find('.mrk-hero-content h1').text()).toBe('Stay ahead')
    expect(wrapper.find('.mrk-hero-canvas').exists()).toBe(false)
  })

  it('does not initialise the scene for reduced motion', async () => {
    mockMedia({ reducedMotion: true })
    const wrapper = await mountSections(true)
    observerCallback?.([{ isIntersecting: true }])
    await flushPromises()

    expect(observerCallback).toBeNull()
    expect(wrapper.find('.mrk-hero-canvas').exists()).toBe(false)
  })

  it('does not initialise the scene on small screens', async () => {
    mockMedia({ smallScreen: true })
    const wrapper = await mountSections(true)
    observerCallback?.([{ isIntersecting: true }])
    await flushPromises()

    expect(observerCallback).toBeNull()
    expect(wrapper.find('.mrk-hero-canvas').exists()).toBe(false)
  })

  it('loads the scene only when the hero becomes visible', async () => {
    const wrapper = await mountSections(true)
    expect(observerCallback).toBeTypeOf('function')
    expect(wrapper.find('.mrk-hero-canvas').exists()).toBe(false)

    observerCallback([{ isIntersecting: true }])
    await flushPromises()

    await vi.waitFor(() => {
      expect(wrapper.find('.mrk-hero-canvas').exists()).toBe(true)
    })
  })
})
