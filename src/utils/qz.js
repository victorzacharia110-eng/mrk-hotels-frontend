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
 * a signing endpoint). That is wired up automatically: the browser fetches the
 * certificate and signs each message via the API (`VITE_API_URL`), keeping the
 * private key server-side. Point `VITE_QZ_CERT_URL` / `VITE_QZ_SIGN_URL`
 * elsewhere to override. When signing is unavailable QZ Tray falls back to its
 * normal one-time "Allow" prompt, which the operator can make permanent with
 * "Remember this decision".
 */

/** The loaded qz-tray instance, or null before the first call. */
let qz = null

/** Whether the (optional) signing handlers have been installed on the instance. */
let securityConfigured = false

/**
 * Why the last signing attempt failed, if it did. Silent printing is only
 * possible when QZ Tray can verify every message; when the certificate or
 * signature fetch fails we still connect (so the operator can print after
 * allowing once), but we record the cause here so the UI can explain the
 * unexpected "Allow" dialog instead of leaving the operator guessing.
 * @type {{ ok: boolean, reason: string }}
 */
export const qzSigningStatus = { ok: false, reason: '' }

/** Loads and caches the qz-tray library. Only ever called from the async API. */
async function loadQz() {
  if (!qz) {
    const mod = await import('qz-tray')
    qz = mod.default || mod
  }
  return qz
}

/**
 * Resolves a QZ signing endpoint. The defaults live on the same API as the
 * rest of the app (`VITE_API_URL`), so silent printing works with no extra
 * configuration; `VITE_QZ_CERT_URL` / `VITE_QZ_SIGN_URL` override the host if
 * signing is ever served elsewhere.
 *
 * @param {string} path  'certificate' or 'sign'.
 * @returns {string|null} Absolute URL, or null when no API base is configured.
 */
function qzSigningUrl(path) {
  const base = import.meta.env?.VITE_API_URL
  if (!base) return null
  return `${String(base).replace(/\/+$/, '')}/v1/qz/${path}`
}

/**
 * Installs message-signing handlers so QZ Tray prints without its interactive
 * "Allow" prompt (once the signing certificate's root CA is trusted on the
 * till via override.crt — see docs/qz-tray-till-setup.md).
 *
 * The private key stays on the server: the browser fetches the public
 * certificate and asks the API to sign each message. If signing is not
 * configured, QZ Tray simply falls back to the one-time allow prompt, so a
 * missing endpoint degrades to "asks once" rather than "cannot print".
 */
function configureSecurity(instance) {
  if (securityConfigured) return
  securityConfigured = true

  const certUrl = import.meta.env?.VITE_QZ_CERT_URL || qzSigningUrl('certificate')
  const signUrl = import.meta.env?.VITE_QZ_SIGN_URL || qzSigningUrl('sign')
  if (!certUrl || !signUrl) return

  // Record signing health so a failure is diagnosable. QZ Tray falls back to
  // its interactive "Allow" prompt whenever a signed request cannot be verified,
  // so a silent fetch failure otherwise presents as a mysterious dialog.
  instance.security.setCertificatePromise(
    (resolve, reject) => {
      fetch(certUrl, { cache: 'no-store' })
        .then((resp) => {
          if (!resp.ok) throw new Error(`QZ certificate unavailable (HTTP ${resp.status})`)
          return resp.text()
        })
        .then((pem) => {
          if (!String(pem).includes('BEGIN CERTIFICATE')) {
            throw new Error('QZ certificate endpoint did not return a PEM')
          }
          qzSigningStatus.ok = true
          qzSigningStatus.reason = ''
          resolve(pem)
        })
        .catch((err) => {
          qzSigningStatus.ok = false
          qzSigningStatus.reason =
            'Could not load the QZ signing certificate, so QZ Tray will ask for permission once. ' +
            'Check this till can reach the sign-in API.'
          reject(err)
        })
    },
    { rejectOnFailure: false },
  )

  instance.security.setSignatureAlgorithm('SHA512')
  instance.security.setSignaturePromise((toSign) => (resolve, reject) => {
    // POST the raw message rather than a query string: a raster logo makes the
    // payload hundreds of KB, well past any URL length limit.
    fetch(signUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: toSign,
    })
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

/**
 * Prints a PDF document to a target through QZ Tray, silently.
 *
 * QZ Tray's "pixel" mode accepts a base64 PDF (or image) and hands it to the
 * printer's OS driver. That is the whole trick behind dialog-free A4 printing:
 * a browser can never silence `window.print()`, but QZ Tray can render a PDF we
 * generated client-side without any UI at all — on Windows and Linux alike.
 *
 * @param {object} target  { kind: 'system'|'socket', printer|host, port }.
 * @param {Uint8Array|string} pdf  The PDF bytes, or an already base64 string.
 * @returns {Promise<boolean>} True when the job was handed to the printer.
 */
export async function qzPrintPdf(target, pdf) {
  const instance = await qzConnect()
  const config = qzConfigFor(instance, target)
  if (!config) throw new Error('No printer selected')
  const data = typeof pdf === 'string' ? pdf : bytesToBase64(pdf)
  await instance.print(config, [
    { type: 'pixel', format: 'pdf', flavor: 'base64', data },
  ])
  return true
}
