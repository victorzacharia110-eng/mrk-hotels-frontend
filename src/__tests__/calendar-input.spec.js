import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import CalendarInput from '@/components/CalendarInput.vue'
import i18n from '@/locales/i18n'

function mountCalendar(props = {}) {
  return mount(CalendarInput, {
    props: { modelValue: '', ...props },
    global: { plugins: [i18n] },
  })
}

describe('CalendarInput', () => {
  it('shows the placeholder when empty and the value once picked', async () => {
    const wrapper = mountCalendar({ placeholder: 'Pick a date' })
    expect(wrapper.text()).toContain('Pick a date')

    await wrapper.setProps({ modelValue: '2026-05-04' })
    expect(wrapper.find('.cal-value').text()).toMatch(/2026/)
  })

  it('opens the month grid and emits the picked day', async () => {
    const wrapper = mountCalendar()
    await wrapper.get('.cal-field').trigger('click')

    expect(wrapper.find('.cal-pop').exists()).toBe(true)

    // Click the "4" cell of the currently browsed month; it must not be disabled.
    const day = wrapper.findAll('.cal-day').find((c) => c.text() === '4')
    expect(day).toBeTruthy()

    await day.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(wrapper.emitted('change')).toBeTruthy()
    expect(wrapper.find('.cal-pop').exists()).toBe(false)
  })

  it('disables days outside the min/max window', async () => {
    const wrapper = mountCalendar({ min: '2026-03-10', max: '2026-03-20', modelValue: '2026-03-15' })
    await wrapper.get('.cal-field').trigger('click')

    const disabled = wrapper.findAll('.cal-day.off')
    expect(disabled.length).toBeGreaterThan(0)
    // Some enabled days remain selectable inside the window.
    expect(wrapper.findAll('.cal-day:not(.off)').length).toBeGreaterThan(0)
  })

  it('clears the value through the × button', async () => {
    const wrapper = mountCalendar({ modelValue: '2026-03-15' })
    await wrapper.get('.cal-clear').trigger('click')

    expect(wrapper.emitted('update:modelValue')[0][0]).toBe('')
  })

  it('closes on an outside click', async () => {
    const wrapper = mountCalendar()
    await wrapper.get('.cal-field').trigger('click')
    expect(wrapper.find('.cal-pop').exists()).toBe(true)

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('.cal-pop').exists()).toBe(false)
  })
})