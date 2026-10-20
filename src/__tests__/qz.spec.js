import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The QZ Tray wrapper is the only place the app talks to the local printing
 * helper, so these tests pin the contract it hands the rest of the app: connect
 * once, list printers, and send ESC/POS bytes as base64 raw data.
 */

const qz = vi.hoisted(() => {
  const websocket = {
    active: false,
    connect: vi.fn().mockResolvedValue(),
    disconnect: vi.fn().mockResolvedValue(),
    isActive: vi.fn(),
  }
  websocket.isActive.mockImplementation(() => websocket.active)
  return {
    websocket,
    printers: { find: vi.fn() },
    configs: { create: vi.fn((target) => ({ target })) },
    print: vi.fn().mockResolvedValue(),
    security: {
      setCertificatePromise: vi.fn(),
      setSignatureAlgorithm: vi.fn(),
      setSignaturePromise: vi.fn(),
    },
  }
})

vi.mock('qz-tray', () => ({ default: qz }))

const { qzConnect, qzIsActive, qzListPrinters, qzPrintRaw, qzPrintPdf, qzSupported, qzConfigFor } = await import(
  '@/utils/qz'
)

beforeEach(() => {
  vi.clearAllMocks()
  qz.websocket.active = false
  qz.websocket.connect.mockResolvedValue()
  qz.websocket.disconnect.mockResolvedValue()
  qz.printers.find.mockResolvedValue([])
})

describe('qz wrapper', () => {
  it('reports support on any desktop browser', () => {
    expect(qzSupported()).toBe(true)
  })

  it('connects only when the socket is not already open', async () => {
    await qzConnect()
    expect(qz.websocket.connect).toHaveBeenCalledTimes(1)

    qz.websocket.active = true
    await qzConnect()
    expect(qz.websocket.connect).toHaveBeenCalledTimes(1)
  })

  it('reports whether the socket is active without opening one', async () => {
    qz.websocket.active = true
    await expect(qzIsActive()).resolves.toBe(true)
    expect(qz.websocket.connect).not.toHaveBeenCalled()
  })

  it('lists the installed printers, normalising a single result to an array', async () => {
    qz.printers.find.mockResolvedValueOnce(['A', 'B'])
    await expect(qzListPrinters()).resolves.toEqual(['A', 'B'])

    qz.printers.find.mockResolvedValueOnce('Only Printer')
    await expect(qzListPrinters()).resolves.toEqual(['Only Printer'])
  })

  it('builds a config for a system printer and for a network socket', () => {
    expect(qzConfigFor(qz, { kind: 'system', printer: 'ZyWell' })).toEqual({ target: 'ZyWell' })
    expect(qzConfigFor(qz, { kind: 'socket', host: '10.0.0.5', port: 9100 })).toEqual({
      target: { host: '10.0.0.5', port: 9100 },
    })
    expect(qzConfigFor(qz, null)).toBeNull()
  })

  it('sends bytes as base64 raw command data', async () => {
    await qzPrintRaw({ kind: 'system', printer: 'ZyWell' }, new Uint8Array([0x1b, 0x40]))

    expect(qz.print).toHaveBeenCalledWith({ target: 'ZyWell' }, [
      { type: 'raw', format: 'command', flavor: 'base64', data: 'G0A=' },
    ])
  })

  it('refuses to print when the target is incomplete', async () => {
    await expect(qzPrintRaw({ kind: 'system' }, new Uint8Array([0x1b]))).rejects.toThrow('No printer selected')
  })

  it('sends a PDF as base64 pixel data for silent A4 printing', async () => {
    await qzPrintPdf({ kind: 'system', printer: 'Front desk' }, new Uint8Array([0x25, 0x50, 0x44, 0x46]))

    expect(qz.print).toHaveBeenCalledWith({ target: 'Front desk' }, [
      { type: 'pixel', format: 'pdf', flavor: 'base64', data: 'JVBERg==' },
    ])
  })

  it('accepts an already-encoded PDF string without re-encoding', async () => {
    await qzPrintPdf({ kind: 'socket', host: '10.0.0.9', port: 9100 }, 'JVBERg==')

    expect(qz.print).toHaveBeenCalledWith({ target: { host: '10.0.0.9', port: 9100 } }, [
      { type: 'pixel', format: 'pdf', flavor: 'base64', data: 'JVBERg==' },
    ])
  })
})
