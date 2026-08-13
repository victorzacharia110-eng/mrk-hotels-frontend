/**
 * Stable browser device identity for attendance anti-cheat.
 *
 * Each browser profile gets one device id, generated once and kept in local
 * storage. Because it lives in the browser, a colleague who logs into a
 * fellow employee's account from their own phone still presents *their* own
 * device id — which the backend binds to their account and refuses (or flags
 * as a shared-device swap).
 */

const DEVICE_ID_KEY = 'mrk_attendance_device_id'
const DEVICE_SECRET_KEY = 'mrk_attendance_device_secret'

/** @returns {string} A v4-style random id, with a fallback for older browsers. */
function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * The stable device id for this browser profile.
 * @returns {string}
 */
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = randomId()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

/**
 * A coarse browser fingerprint (device id + platform + language). Kept short
 * and privacy-light: it only needs to be stable per browser profile.
 * @returns {string}
 */
export function getDeviceFingerprint() {
  const parts = [
    navigator.platform || '',
    navigator.language || '',
    navigator.hardwareConcurrency || '',
    screen.width,
    screen.height,
  ]
  let hash = 0
  const raw = parts.join('|')
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i)
    hash |= 0
  }
  return getDeviceId() + ':' + (hash >>> 0).toString(36)
}

/**
 * The server-issued device secret for this browser profile, if one has been
 * handed out. It proves this device still holds its key, so a stolen device
 * id (read from logs or storage) cannot be replayed. Never sent to the client
 * again after issuance — the backend keeps only its hash.
 * @returns {string|null}
 */
export function getDeviceSecret() {
  return localStorage.getItem(DEVICE_SECRET_KEY)
}

/**
 * Stores the secret returned by the server when the device is registered or
 * first used. Cleared together with the device id when the device is revoked
 * so the next clock-in forces a fresh registration.
 * @param {string} secret - The plaintext secret issued by the server.
 */
export function setDeviceSecret(secret) {
  localStorage.setItem(DEVICE_SECRET_KEY, secret)
}

/**
 * Forgets the stored secret (and device id) so the browser re-registers.
 */
export function clearDeviceSecret() {
  localStorage.removeItem(DEVICE_SECRET_KEY)
}
