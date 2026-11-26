import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePrintSettingsStore } from '@/stores/printSettings'

const post = vi.hoisted(() => vi.fn())

vi.mock('@/api/axios', () => ({
  default: { post },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
  post.mockResolvedValue({ data: { data: { ok: true } } })
})

describe('server ESC/POS print method', () => {
  it('defaults to QZ Tray', () => {
    expect(usePrintSettingsStore().printMethod).toBe('qz')
  })

  it('sends receipt lines to the API when server printing is selected', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({
      printMethod: 'server',
      tillPrinter: { kind: 'socket', host: '192.168.1.50', port: 9100, label: 'Kitchen' },
    })

    await expect(store.print([['Total', true, 0]])).resolves.toBe(true)

    expect(post).toHaveBeenCalledWith('/v1/printer/escpos/print', {
      printer: { kind: 'socket', host: '192.168.1.50', port: 9100 },
      lines: [{ text: 'Total', bold: true, size: 0 }],
    })
  })

  it('refuses to send a system printer through the server method', async () => {
    const store = usePrintSettingsStore()
    store.saveSettings({
      printMethod: 'server',
      tillPrinter: { kind: 'system', printer: 'ZyWell', label: 'Till' },
    })

    await expect(store.print([['Total']])).resolves.toBe(false)
    expect(post).not.toHaveBeenCalled()
  })

  it('turns an API failure into a false result', async () => {
    post.mockRejectedValueOnce(new Error('offline'))
    const store = usePrintSettingsStore()
    store.saveSettings({
      printMethod: 'server',
      tillPrinter: { kind: 'socket', host: '192.168.1.50', port: 9100 },
    })

    await expect(store.print([['Total']])).resolves.toBe(false)
  })
})
