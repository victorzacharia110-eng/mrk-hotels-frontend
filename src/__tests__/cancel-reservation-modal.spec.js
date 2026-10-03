import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CancelReservationModal from '@/components/CancelReservationModal.vue'
import i18n from '@/locales/i18n'

const grouped = {
  reservation_id: 'r1',
  guest_name: 'Alice',
  room: { room_number: '101' },
  group: {
    rooms: [
      { reservation_id: 'r1', room_number: '101', is_primary: true, guest_name: 'Alice', status: 'confirmed' },
      { reservation_id: 'r2', room_number: '102', is_primary: false, guest_name: 'Bob', status: 'confirmed' },
      { reservation_id: 'r3', room_number: '103', is_primary: false, guest_name: 'Cara', status: 'confirmed' },
    ],
  },
}

const standalone = {
  reservation_id: 's1',
  guest_name: 'Solo',
  room: { room_number: '201' },
  group: null,
}

function mountModal(reservation) {
  return mount(CancelReservationModal, {
    props: { show: true, reservation },
    global: { plugins: [i18n], stubs: { teleport: true } },
  })
}

describe('CancelReservationModal', () => {
  it('confirms a standalone reservation with a single-room payload', async () => {
    const wrapper = mountModal(standalone)
    expect(wrapper.find('.cancel-modes').exists()).toBe(false)

    await wrapper.find('.cancel-modal-foot .btn-danger').trigger('click')

    expect(wrapper.emitted('confirm')[0][0]).toEqual({
      mode: 'single',
      reservationIds: ['s1'],
    })
  })

  it('defaults a group to cancelling every room', async () => {
    const wrapper = mountModal(grouped)

    const boxes = wrapper.findAll('.cancel-room input[type="checkbox"]')
    expect(boxes).toHaveLength(3)
    expect(boxes.every((box) => box.element.checked)).toBe(true)
    expect(wrapper.find('.cancel-modes input[value="group"]').element.checked).toBe(true)

    await wrapper.find('.cancel-modal-foot .btn-danger').trigger('click')

    expect(wrapper.emitted('confirm')[0][0]).toEqual({
      mode: 'group',
      reservationIds: ['r1', 'r2', 'r3'],
    })
  })

  it('flips to selected mode when a room is unticked', async () => {
    const wrapper = mountModal(grouped)

    await wrapper.findAll('.cancel-room input[type="checkbox"]')[1].setValue(false)

    expect(wrapper.find('.cancel-modes input[value="group"]').element.checked).toBe(false)
    expect(wrapper.find('.cancel-modes input[value="selected"]').element.checked).toBe(true)

    await wrapper.find('.cancel-modal-foot .btn-danger').trigger('click')

    expect(wrapper.emitted('confirm')[0][0]).toEqual({
      mode: 'selected',
      reservationIds: ['r1', 'r3'],
    })
  })

  it('flips back to whole group when every box is re-ticked', async () => {
    const wrapper = mountModal(grouped)

    const boxes = wrapper.findAll('.cancel-room input[type="checkbox"]')
    await boxes[1].setValue(false)
    await boxes[1].setValue(true)

    expect(wrapper.find('.cancel-modes input[value="group"]').element.checked).toBe(true)

    await wrapper.find('.cancel-modal-foot .btn-danger').trigger('click')
    expect(wrapper.emitted('confirm')[0][0].mode).toBe('group')
  })

  it('clears the boxes and disables confirm when "selected rooms" is chosen', async () => {
    const wrapper = mountModal(grouped)

    await wrapper.find('.cancel-modes input[value="selected"]').setValue()

    expect(
      wrapper.findAll('.cancel-room input[type="checkbox"]').some((box) => box.element.checked),
    ).toBe(false)
    expect(wrapper.find('.cancel-modal-foot .btn-danger').attributes('disabled')).toBeDefined()
  })
})
