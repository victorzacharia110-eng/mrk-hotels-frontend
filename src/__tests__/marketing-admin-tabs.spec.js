import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const routeState = vi.hoisted(() => ({ path: '/' }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: routeState.value }),
}))

import MarketingAdminLayout from '@/pages/superadmin/marketing/MarketingAdminLayout.vue'

function tabHrefs(path) {
  routeState.value = path
  const wrapper = mount(MarketingAdminLayout, {
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a class="tab-link" :href="to"><slot /></a>',
        },
        RouterView: true,
      },
    },
  })
  return wrapper.findAll('a.tab-link').map((link) => link.attributes('href'))
}

describe('marketing admin tabs', () => {
  it('hides the settings tab from owners', () => {
    expect(tabHrefs('/owner/marketing/content/pages')).not.toContain('/owner/marketing/content/settings')
  })

  it('keeps the settings tab for superadmins', () => {
    expect(tabHrefs('/superadmin/marketing/pages')).toContain('/superadmin/marketing/settings')
  })
})
