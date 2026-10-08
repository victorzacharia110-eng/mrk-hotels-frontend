import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/locales/i18n'
import LoginPage from '@/pages/auth/LoginPage.vue'

/**
 * The device-trust one-time code step. It once lived INSIDE the password
 * form while the form itself hid whenever a challenge was pending — so staff
 * received the OTP by email/SMS and faced an empty card with nowhere to type
 * it. These tests drive the real login flow and assert the code box actually
 * renders (and that the escape hatch back to the form works).
 */

const { loginMock, verifyMock, resendMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  verifyMock: vi.fn(),
  resendMock: vi.fn(),
}))

vi.mock('@/api', () => ({
  authApi: {
    login: loginMock,
    loginPin: vi.fn(),
    verifyDevice: verifyMock,
    verifyDeviceResend: resendMock,
    logout: vi.fn(),
    fetchProfile: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} }),
}))

vi.mock('@/router', () => ({ resolveLanding: () => '/app' }))

const CHALLENGE = {
  requires_device_verification: true,
  challenge: 'ch_123',
  email: 'm***@mrkhotels.test',
  phone: '683****68',
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  localStorage.clear()
  i18n.global.locale.value = 'en'
  vi.clearAllMocks()
})

async function mountLogin() {
  const wrapper = mount(LoginPage, { global: { plugins: [i18n] } })
  await flushPromises()
  return wrapper
}

/** Signs in with the password form; the challenge response is already mocked. */
async function submitCredentials(wrapper) {
  await wrapper.find('input[type="email"]').setValue('manager@mrkhotels.test')
  await wrapper.find('input[type="password"]').setValue('password')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('LoginPage — device trust OTP step', () => {
  it('asks the backend to trust the device so an OTP is actually issued', async () => {
    loginMock.mockResolvedValue({ data: CHALLENGE })
    const wrapper = await mountLogin()

    await submitCredentials(wrapper)

    expect(loginMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'manager@mrkhotels.test',
        password: 'password',
        trust_device: true,
      }),
    )
  })

  it('renders the code box after the challenge — even though the form hides itself', async () => {
    loginMock.mockResolvedValue({ data: CHALLENGE })
    const wrapper = await mountLogin()

    await submitCredentials(wrapper)

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('.mode-switch').exists()).toBe(false)

    const codeInput = wrapper.find('input[autocomplete="one-time-code"]')
    expect(codeInput.exists()).toBe(true)
    expect(wrapper.find('.device-verify').text()).toContain('m***@mrkhotels.test')
    expect(wrapper.find('.device-verify').text()).toContain('683****68')
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('submits the entered code with the challenge and trust duration', async () => {
    loginMock.mockResolvedValue({ data: CHALLENGE })
    verifyMock.mockResolvedValue({
      data: { token: 'tok_1', user: { user_role: 'receptionist' }, device_key: 'dev_1' },
    })
    const wrapper = await mountLogin()

    await submitCredentials(wrapper)
    await wrapper.find('input[autocomplete="one-time-code"]').setValue('123456')
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Verify and sign in'))
      .trigger('click')
    await flushPromises()

    expect(verifyMock).toHaveBeenCalledWith({
      challenge: 'ch_123',
      code: '123456',
      trust_months: 3,
    })
  })

  it('Back returns to the login form without losing the entered credentials', async () => {
    loginMock.mockResolvedValue({ data: CHALLENGE })
    const wrapper = await mountLogin()

    await submitCredentials(wrapper)
    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'Back')
      .trigger('click')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.find('input[type="email"]').element.value).toBe('manager@mrkhotels.test')
    expect(wrapper.find('.mode-switch').exists()).toBe(true)
  })

  it('re-issues the code from the Resend button while the challenge is live', async () => {
    loginMock.mockResolvedValue({ data: CHALLENGE })
    resendMock.mockResolvedValue({ data: { challenge: 'ch_123', phone: '683****68' } })
    const wrapper = await mountLogin()

    await submitCredentials(wrapper)
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Resend code'))
      .trigger('click')
    await flushPromises()

    expect(resendMock).toHaveBeenCalledWith({ challenge: 'ch_123' })
    expect(wrapper.text()).toContain('Resend (60s)')
  })
})
