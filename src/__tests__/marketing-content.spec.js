import { describe, it, expect, vi, beforeEach } from 'vitest'

const bootstrap = vi.hoisted(() => vi.fn())

vi.mock('@/api', () => ({
  publicMarketingApi: {
    bootstrap: (...a) => bootstrap(...a),
  },
}))

describe('useMarketingContent', () => {
  beforeEach(async () => {
    bootstrap.mockReset()
    const { useMarketingContent } = await import('@/composables/useMarketingContent')
    useMarketingContent().clearBootstrap()
  })

  it('loads and normalizes bootstrap once', async () => {
    bootstrap.mockResolvedValue({
      data: {
        settings: { site_name: 'MRK' },
        pages: [
          { slug: 'about', sort_order: 2, sections: [{ id: 2, sort_order: 2 }, { id: 1, sort_order: 1 }] },
          { slug: 'home', sort_order: 1 },
        ],
        integrations: [{ id: 1 }],
        faqs: null,
      },
    })
    const { useMarketingContent } = await import('@/composables/useMarketingContent')
    const { loadBootstrap, bootstrap: state, getSetting, getPage } = useMarketingContent()

    const data = await loadBootstrap()
    expect(bootstrap).toHaveBeenCalledTimes(1)
    expect(state.value.pages.map((p) => p.slug)).toEqual(['home', 'about'])
    expect(getPage('about').sections.map((s) => s.id)).toEqual([1, 2])
    expect(getSetting('site_name')).toBe('MRK')
    expect(getSetting('missing', 'x')).toBe('x')
    expect(data.faqs).toEqual([])
    expect(data.pricing).toEqual({ products: [], features: [], plans: [] })

    await loadBootstrap()
    expect(bootstrap).toHaveBeenCalledTimes(1)
  })

  it('sets error and clears state on failure', async () => {
    bootstrap.mockRejectedValue({ response: { data: { message: 'boom' } } })
    const { useMarketingContent } = await import('@/composables/useMarketingContent')
    const { loadBootstrap, bootstrap: state, error } = useMarketingContent()

    await expect(loadBootstrap()).rejects.toBeTruthy()
    expect(state.value).toBeNull()
    expect(error.value).toBe('boom')
  })

  it('reloads when forced', async () => {
    bootstrap.mockResolvedValue({ data: { settings: {}, pages: [] } })
    const { useMarketingContent } = await import('@/composables/useMarketingContent')
    const { loadBootstrap } = useMarketingContent()
    await loadBootstrap()
    await loadBootstrap(true)
    expect(bootstrap).toHaveBeenCalledTimes(2)
  })
})
