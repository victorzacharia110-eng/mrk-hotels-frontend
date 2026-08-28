import { describe, it, expect, afterEach } from 'vitest'
import { toast, toastError, clearToasts } from '@/utils/toast'

describe('toast', () => {
  afterEach(() => {
    clearToasts()
  })

  it('renders a success toast and removes it after its duration', () => {
    toast('Hello')
    const el = document.querySelector('.app-toast')
    expect(el).toBeTruthy()
    expect(el.textContent).toBe('Hello')
    expect(el.classList.contains('app-toast-error')).toBe(false)
  })

  it('renders an error toast with the error tone', () => {
    toastError('Boom')
    const el = document.querySelector('.app-toast-error')
    expect(el).toBeTruthy()
    expect(el.textContent).toBe('Boom')
  })

  it('exposes the global window.toast helpers', () => {
    expect(typeof window.toast).toBe('function')
    expect(typeof window.toastError).toBe('function')
  })
})
