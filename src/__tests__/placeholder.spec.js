import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'
import i18n from '@/locales/i18n'

describe('ModulePlaceholder', () => {
  it('renders the module title', () => {
    const wrapper = mount(ModulePlaceholder, {
      props: { title: 'Reservations' },
      global: { plugins: [i18n] },
    })
    expect(wrapper.find('h1').text()).toContain('Reservations')
    expect(wrapper.text()).toContain('under construction')
  })
})
