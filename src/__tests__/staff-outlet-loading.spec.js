import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import { useAuthStore } from '@/stores/auth'
import StaffListPage from '@/pages/staff/StaffListPage.vue'

/**
 * Regression: the staff page crashed in production with
 * `TypeError: G.value.map is not a function`.
 *
 * `GET /outlets` answers `{ outlets: [...] }`, but the page unwrapped it as
 * `res.data.data || res.data || []`. The `data.data` branch is undefined for
 * this endpoint, so `res.data` — the whole object — was assigned, leaving
 * `outlets` an object where an array was expected. The options computed then
 * threw on `.map`, and because the computed is read during render the whole
 * page failed to mount: the staff list became unreachable, not just its
 * outlet picker.
 *
 * The shape is asserted here against the real production payload so the
 * mismatch cannot quietly return.
 */

const { outletIndex, userIndex } = vi.hoisted(() => ({
  outletIndex: vi.fn(),
  userIndex: vi.fn(),
}))

vi.mock('@/api', () => ({
  outletApi: { index: (...a) => outletIndex(...a) },
  userApi: {
    index: (...a) => userIndex(...a),
    update: vi.fn().mockResolvedValue({ data: { data: {} } }),
    store: vi.fn().mockResolvedValue({ data: { data: {} } }),
  },
}))

/** Mounts the page and returns it, failing loudly if the render crashed. */
async function mountPage() {
  const wrapper = mount(StaffListPage, {
    global: { plugins: [createPinia(), i18n] },
  })
  await flushPromises()
  return wrapper
}

const OUTLETS = [
  { outlet_id: 'o1', name: 'RESTAURANT', type: 'fnb', is_active: true },
  { outlet_id: 'o2', name: 'BAR', type: 'fnb', is_active: true },
]

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  localStorage.clear()
  vi.clearAllMocks()

  const auth = useAuthStore()
  auth.user = { user_role: 'manager', tenant: { features: null } }
  auth.permissions = ['manage_staff']
  auth.token = 'test-token'

  userIndex.mockResolvedValue({ data: { data: [], current_page: 1 } })
  // The real production shape, not the usual `{ data: [...] }`.
  outletIndex.mockResolvedValue({ data: { outlets: OUTLETS } })
})

/**
 * Opens the create modal, which is what actually reads `outletOptions`.
 *
 * The options live inside a `v-if="showModal"` form, so a page that is merely
 * mounted never evaluates the computed and the crash stays hidden — which is
 * how the original bug reached production looking untestable. Clicking the
 * "add staff" button is what forces the read.
 */
async function openCreateModal(wrapper) {
  await wrapper.find('button.btn-primary').trigger('click')
  await flushPromises()
}

describe('staff page outlet loading', () => {
  it('renders the outlet picker when /outlets returns { outlets: [...] }', async () => {
    const wrapper = await mountPage()
    await openCreateModal(wrapper)

    // SearchableSelect renders <option> elements whose labels are filled in
    // imperatively, so the assertion reads the bound values: if `outlets` had
    // stayed the raw response object there would be no such options at all.
    const values = wrapper.findAll('option').map((o) => o.attributes('value'))
    expect(values).toContain('o1')
    expect(values).toContain('o2')
  })

  it('mounts without crashing when /outlets returns { outlets: [...] }', async () => {
    const wrapper = await mountPage()
    await openCreateModal(wrapper)

    expect(wrapper.exists()).toBe(true)
  })

  it('survives an empty outlet list', async () => {
    outletIndex.mockResolvedValue({ data: { outlets: [] } })

    const wrapper = await mountPage()
    await openCreateModal(wrapper)

    expect(wrapper.find('.modal').exists()).toBe(true)
  })

  it('survives the outlets request failing entirely', async () => {
    outletIndex.mockRejectedValue(new Error('network down'))

    const wrapper = await mountPage()
    await openCreateModal(wrapper)

    expect(wrapper.find('.modal').exists()).toBe(true)
  })

  it('ignores a non-array payload instead of poisoning the options', async () => {
    // Defensive: an unexpected shape must not take the whole page down again.
    outletIndex.mockResolvedValue({ data: { outlets: { unexpected: true } } })

    const wrapper = await mountPage()
    await openCreateModal(wrapper)

    expect(wrapper.find('.modal').exists()).toBe(true)
  })
})
