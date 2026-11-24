import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import api from '@/api/axios'
import { publicMarketingApi, marketingApi } from '@/api'

describe('publicMarketingApi', () => {
  beforeEach(() => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: {} })
    vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads bootstrap and resources', async () => {
    await publicMarketingApi.bootstrap()
    expect(api.get).toHaveBeenCalledWith('/v1/public/marketing/bootstrap')
    await publicMarketingApi.page('home')
    expect(api.get).toHaveBeenCalledWith('/v1/public/marketing/pages/home')
    await publicMarketingApi.integrations()
    expect(api.get).toHaveBeenCalledWith('/v1/public/marketing/integrations')
    await publicMarketingApi.faqs()
    expect(api.get).toHaveBeenCalledWith('/v1/public/marketing/faqs')
    await publicMarketingApi.team()
    expect(api.get).toHaveBeenCalledWith('/v1/public/marketing/team')
    await publicMarketingApi.media()
    expect(api.get).toHaveBeenCalledWith('/v1/public/marketing/media')
  })

  it('requests pricing with params and posts contact submissions', async () => {
    const params = { product: 'pms', country: 'TZ', billing: 'monthly', rooms: 10 }
    await publicMarketingApi.pricing(params)
    expect(api.get).toHaveBeenCalledWith('/v1/public/marketing/pricing', { params })
    const payload = { name: 'A', email: 'a@b.c', business_name: 'B', business_address: 'Addr' }
    await publicMarketingApi.contactSubmission(payload)
    expect(api.post).toHaveBeenCalledWith('/v1/public/marketing/contact-submissions', payload)
  })
})

describe('marketingApi', () => {
  beforeEach(() => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: {} })
    vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    vi.spyOn(api, 'put').mockResolvedValue({ data: {} })
    vi.spyOn(api, 'delete').mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handles page, section and resource CRUD paths', async () => {
    await marketingApi.pages.index({ q: 'x' })
    expect(api.get).toHaveBeenCalledWith('/v1/marketing/pages', { params: { q: 'x' } })
    await marketingApi.sections.store('p1', { title: 'S' })
    expect(api.post).toHaveBeenCalledWith('/v1/marketing/pages/p1/sections', { title: 'S' })
    await marketingApi.sections.update('p1', 's1', { title: 'S2' })
    expect(api.put).toHaveBeenCalledWith('/v1/marketing/pages/p1/sections/s1', { title: 'S2' })
    await marketingApi.integrations.destroy('i1')
    expect(api.delete).toHaveBeenCalledWith('/v1/marketing/integrations/i1')
    await marketingApi.faqs.show('f1')
    expect(api.get).toHaveBeenCalledWith('/v1/marketing/faqs/f1')
    await marketingApi.teamMembers.update('t1', { name: 'N' })
    expect(api.put).toHaveBeenCalledWith('/v1/marketing/team-members/t1', { name: 'N' })
    await marketingApi.contactSubmissions.index()
    expect(api.get).toHaveBeenCalledWith('/v1/marketing/contact-submissions', { params: undefined })
    await marketingApi.contactSubmissions.reply('c1', { reply_body: 'Hello' })
    expect(api.post).toHaveBeenCalledWith('/v1/marketing/contact-submissions/c1/reply', { reply_body: 'Hello' })
  })

  it('handles settings and pricing CRUD', async () => {
    await marketingApi.settings.index()
    expect(api.get).toHaveBeenCalledWith('/v1/marketing/settings', { params: undefined })
    await marketingApi.settings.update({ settings: { a: 1 } })
    expect(api.put).toHaveBeenCalledWith('/v1/marketing/settings', { settings: { a: 1 } })
    await marketingApi.settings.destroy('hero_ctas')
    expect(api.delete).toHaveBeenCalledWith('/v1/marketing/settings/hero_ctas')
    await marketingApi.pricingProducts.store({ name: 'PMS' })
    expect(api.post).toHaveBeenCalledWith('/v1/marketing/pricing/products', { name: 'PMS' })
    await marketingApi.pricingFeatures.update('pf1', { name: 'F' })
    expect(api.put).toHaveBeenCalledWith('/v1/marketing/pricing/features/pf1', { name: 'F' })
    await marketingApi.pricingPlans.destroy('pp1')
    expect(api.delete).toHaveBeenCalledWith('/v1/marketing/pricing/plans/pp1')
  })

  it('uploads and updates media as multipart', async () => {
    const fd = new FormData()
    fd.append('file', new Blob(['x']), 'a.png')
    await marketingApi.media.store(fd)
    expect(api.post).toHaveBeenCalledWith('/v1/marketing/media', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const fd2 = new FormData()
    fd2.append('file', new Blob(['y']), 'b.png')
    await marketingApi.media.update('m1', fd2)
    expect(fd2.get('_method')).toBe('PUT')
    expect(api.post).toHaveBeenCalledWith('/v1/marketing/media/m1', fd2, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  })
})
