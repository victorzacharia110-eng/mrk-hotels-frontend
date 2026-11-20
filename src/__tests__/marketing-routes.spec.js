import { describe, it, expect } from 'vitest'
import router from '@/router'

function findByName(name, routes = router.options.routes) {
  for (const r of routes) {
    if (r.name === name) return r
    if (r.children) {
      const found = findByName(name, r.children)
      if (found) return found
    }
  }
  return null
}

describe('marketing routes', () => {
  it('registers public marketing pages under /', () => {
    const root = router.options.routes.find((r) => r.path === '/' && r.children?.some((c) => c.name === 'marketing-home'))
    expect(root).toBeTruthy()
    const names = root.children.map((c) => c.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'marketing-home',
        'marketing-product',
        'marketing-integrations',
        'marketing-pricing',
        'marketing-about',
      ]),
    )
    expect(findByName('marketing-home').path).toBe('')
    expect(findByName('marketing-product').path).toBe('products/:slug')
  })

  it('keeps hotel directory at /hotels with route name public-home', () => {
    const dir = findByName('public-home')
    expect(dir).toBeTruthy()
    expect(dir.path).toBe('hotels')
    expect(findByName('public-hotel').path).toBe('hotels/:id')
    expect(findByName('public-booking').path).toBe('booking')
  })

  it('registers superadmin marketing CMS routes', () => {
    const byPath = (p) => router.resolve(p).matched.map((m) => m.name || m.path)
    expect(byPath('/superadmin/marketing/pages').join()).toContain('superadmin-marketing-pages')
    expect(byPath('/superadmin/marketing/pricing-plans').join()).toContain('superadmin-marketing-pricing-plans')
    expect(byPath('/superadmin/marketing/settings').join()).toContain('superadmin-marketing-settings')
  })

  it('registers owner marketing CMS routes', () => {
    const byPath = (p) => router.resolve(p).matched.map((m) => m.name || m.path)
    expect(byPath('/owner/marketing/content/pages').join()).toContain('owner-marketing-pages')
    expect(byPath('/owner/marketing/content/pricing-plans').join()).toContain('owner-marketing-pricing-plans')
    expect(byPath('/owner/marketing/content/settings').join()).toContain('owner-marketing-settings')
  })
})
