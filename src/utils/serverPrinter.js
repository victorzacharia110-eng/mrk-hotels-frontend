import api from '@/api/axios'
import { printerState, targetLabel } from '@/utils/printer'

export function serverTargetUsable(target) {
  return Boolean(target && target.kind === 'socket' && target.host)
}

export async function printToServerPrinter(lines, opts = {}) {
  const target = opts.printer
  if (!serverTargetUsable(target)) {
    printerState.connected = false
    printerState.reason = 'Server ESC/POS needs a network printer. Enter the printer IP address and port in Printer Settings.'
    return false
  }

  printerState.printing = true
  try {
    const payload = {
      printer: {
        kind: 'socket',
        host: String(target.host),
        port: Number(target.port) || 9100,
      },
      lines: (lines || []).map((line) => ({
        text: String(line?.[0] ?? line?.text ?? ''),
        bold: Boolean(line?.[1] ?? line?.bold ?? false),
        size: Number(line?.[2] ?? line?.size ?? 0),
      })),
    }
    await api.post('/v1/printer/escpos/print', payload)
    printerState.connected = true
    printerState.reason = ''
    printerState.info = targetLabel(target)
    return true
  } catch (err) {
    printerState.connected = false
    printerState.reason =
      err?.response?.data?.message ||
      err?.message ||
      'The server printer could not be reached. Check its IP address, port and allowlist.'
    return false
  } finally {
    printerState.printing = false
  }
}
