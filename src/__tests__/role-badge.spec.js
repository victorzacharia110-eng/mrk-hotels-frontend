import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import RoleBadge from '@/components/RoleBadge.vue'
import i18n from '@/locales/i18n'

vi.mock('@/api', () => ({
  authApi: { login: vi.fn(), logout: vi.fn(), me: vi.fn(), changePassword: vi.fn(), loginPin: vi.fn() },
}))

describe('RoleBadge', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the translated label for the signed-in role', async () => {
    const auth = useAuthStore()
    auth.user = { user_role: 'hotel_admin' }
    const wrapper = mount(RoleBadge, { global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('Hotel Admin')
    expect(wrapper.find('.role-badge').exists()).toBe(true)
  })

  it('falls back to Staff for an unknown role', async () => {
    const auth = useAuthStore()
    auth.user = { user_role: 'nope' }
    const wrapper = mount(RoleBadge, { global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('Staff')
  })
})