/**
 * QZ Tray wrapper.
 *
 * QZ Tray is the free, cross-platform helper (Windows / macOS / Linux) that
 * lets a web page print raw ESC/POS to a thermal printer. It runs a small
 * websocket on the till (`wss://localhost:8182`) and the browser talks to it —
 * which is why it works from an HTTPS page, over USB, Serial or Network, where
 * a plain browser cannot.
 *
 * The library is loaded lazily: a page that never prints never pays for the
 * ~150 kB bundle, and the module never touches the network at import time.
 *
 * Silent printing needs signed requests (a certificate trusted by QZ Tray plus
 * a signing endpoint). That is optional here: set VITE_QZ_CERT_URL and
 * VITE_QZ_SIGN_URL and it is wired up automatically; leave them unset and QZ
 * Tray shows its normal one-time "Allow" prompt, which the operator can make
 * permanent with "Remember this decision".
 */

/** The loaded qz-tray instance, or null before the first call. */
let qz = null

/** Whether the (optional) signing handlers have been installed on the instance. */
let securityConfigured = false

/** Loads and caches the qz-tray library. Only ever called from the async API. */
async function loadQz() {
  if (!qz) {
    const mod = await import('qz-tray')
    qz = mod.default || mod
  }
  return qz
}

/**
 * Installs optional message-signing handlers when the app is configured with a
 * certificate URL and a signing URL. Without them QZ Tray falls back to its
 * interactive allow prompt, which is fine for a single till.
 */
function configureSecurity(instance) {
  if (securityConfigured) return
  securityConfigured = true

  const certUrl = import.meta.env?.VITE_QZ_CERT_URL
  const signUrl = import.meta.env?.VITE_QZ_SIGN_URL
  if (!certUrl || !signUrl) return

  instance.security.setCertificatePromise((resolve, reject) => {
    fetch(certUrl, { cache: 'no-store', headers: { 'Content-Type': 'text/plain' } })
      .then((resp) => (resp.ok ? resp.text().then(resolve) : reject(new Error('QZ certificate unavailable'))))
      .catch(reject)
  }, { rejectOnFailure: true })

  instance.security.setSignatureAlgorithm('SHA512')
  instance.security.setSignaturePromise((toSign) => (resolve, reject) => {
    fetch(`${signUrl}?request=${encodeURIComponent(toSign)}`, { cache: 'no-store' })
      .then((resp) => (resp.ok ? resp.text().then(resolve) : reject(new Error('QZ signature request failed'))))
      .catch(reject)
  })
}

/** Can this browser reach QZ Tray at all? (Any desktop browser can.) */
export function qzSupported() {
  return typeof WebSocket !== 'undefined' && typeof btoa !== 'undefined'
}

/** True when a QZ Tray websocket is already open (never opens one itself). */
export async function qzIsActive() {
  try {
    const instance = await loadQz()
    return Boolean(instance.websocket.isActive())
  } catch {
    return false
  }
}

/**
 * Connects to the local QZ Tray software.
 *
 * The first call on a till opens QZ Tray's "Allow this site" dialog unless the
 * request is signed. Later calls reuse the open socket.
 *
 * @param {{retries?: number, delay?: number}} [options]
 * @returns {Promise<object>} The connected qz instance.
 */
export async function qzConnect({ retries = 2, delay = 1 } = {}) {
  const instance = await loadQz()
  configureSecurity(instance)
  if (instance.websocket.isActive()) return instance
  await instance.websocket.connect({ retries, delay })
  return instance
}

/** Closes the QZ Tray websocket, if one is open. Never throws. */
export async function qzDisconnect() {
  if (!qz) return
  try {
    if (qz.websocket.isActive()) await qz.websocket.disconnect()
  } catch {
    /* already closed — nothing to do */
  }
}

/**
 * Lists the printers QZ Tray can see on this machine (their OS names).
 *
 * @returns {Promise<string[]>} Printer names.
 */
export async function qzListPrinters() {
  const instance = await qzConnect()
  const found = await instance.printers.find()
  if (!found) return []
  return Array.isArray(found) ? found : [found]
}

/** Encodes a byte stream as base64 without blowing the call stack on big jobs. */
function bytesToBase64(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * Builds the QZ print config for a target.
 *
 * @param {object} instance  The qz instance.
 * @param {{kind?:string, printer?:string, host?:string, port?:number}} target
 * @returns {object|null} A QZ config, or null when the target is incomplete.
 */
export function qzConfigFor(instance, target) {
  if (!target) return null
  if (target.kind === 'socket' && target.host) {
    return instance.configs.create({ host: target.host, port: Number(target.port) || 9100 })
  }
  if (target.printer) return instance.configs.create(target.printer)
  return null
}

/**
 * Prints raw ESC/POS bytes to a target through QZ Tray.
 *
 * @param {object} target  { kind: 'system'|'socket', printer|host, port }.
 * @param {Uint8Array} bytes  The ESC/POS byte stream.
 * @returns {Promise<boolean>} True when the job was handed to the printer.
 */
export async function qzPrintRaw(target, bytes) {
  const instance = await qzConnect()
  const config = qzConfigFor(instance, target)
  if (!config) throw new Error('No printer selected')
  await instance.print(config, [
    { type: 'raw', format: 'command', flavor: 'base64', data: bytesToBase64(bytes) },
  ])
  return true
}
