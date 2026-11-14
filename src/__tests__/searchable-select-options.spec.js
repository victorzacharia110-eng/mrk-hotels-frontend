import { describe, it, expect } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import SearchableSelect from '@/components/SearchableSelect.vue'
import i18n from '@/locales/i18n'

/**
 * The sync-to-stock picker holds the whole stock catalogue, which can run to
 * hundreds of items. The panel scrolls internally, so every loaded option has
 * to be rendered — slicing the list capped it at the first hundred and hid
 * later-alphabet items (e.g. "Zanzi 250ml") that could never be reached by
 * scrolling.
 */
function buildOptions(count) {
  return Array.from({ length: count }, (_, i) => ({
    value: `id-${i}`,
    label: `Item ${String(i).padStart(3, '0')}`,
  }))
}

function panelOptions() {
  return [...document.querySelectorAll('.ss-option')].map((o) => o.textContent.trim())
}

describe('SearchableSelect option rendering', () => {
  it('renders options past the first hundred so a late item is reachable', async () => {
    const options = [...buildOptions(150), { value: 'zanzi', label: 'Zanzi 250ml' }]
    const wrapper = mount(SearchableSelect, {
      props: { modelValue: '', options, forceSearch: true },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })

    await wrapper.get('.ss-trigger').trigger('click')

    expect(panelOptions()).toContain('Zanzi 250ml')

    wrapper.unmount()
  })

  it('filters to the matching option when a query is typed', async () => {
    const options = [...buildOptions(150), { value: 'zanzi', label: 'Zanzi 250ml' }]
    const wrapper = mount(SearchableSelect, {
      props: { modelValue: '', options, forceSearch: true },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })

    await wrapper.get('.ss-trigger').trigger('click')
    await new DOMWrapper(document.querySelector('.ss-search')).setValue('zanzi')

    expect(panelOptions()).toEqual(['Zanzi 250ml'])

    wrapper.unmount()
  })

  it('keeps the teleported panel open when its option is clicked inside a clipped modal', async () => {
    const options = [{ value: 'flour', label: 'Flour' }]
    const wrapper = mount(
      {
        components: { SearchableSelect },
        template: `
          <div style="position: fixed; transform: translate(-50%, -50%); overflow: hidden">
            <SearchableSelect v-model="picked" :options="options" />
          </div>
        `,
        data: () => ({ picked: '', options }),
      },
      { global: { plugins: [i18n] }, attachTo: document.body },
    )

    await wrapper.get('.ss-trigger').trigger('click')
    const panel = document.querySelector('.ss-panel')
    expect(panel?.parentElement).toBe(document.body)

    const option = new DOMWrapper(document.querySelector('.ss-option'))
    await option.trigger('mousedown')
    await option.trigger('click')

    expect(wrapper.vm.picked).toBe('flour')
    expect(document.querySelector('.ss-panel')).toBeNull()

    wrapper.unmount()
  })
})
