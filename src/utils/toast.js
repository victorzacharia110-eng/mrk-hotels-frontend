/**
 * Lightweight, dependency-free toast notifications.
 *
 * Renders small transient banners in a fixed stack at the top-right of the
 * viewport. No framework dependency: the messaging page (and anything else)
 * can call `window.toast(...)` or import `toast` directly. Toasts are plain
 * DOM nodes with an ARIA live region, auto-removed after a few seconds.
 */

let container = null

/**
 * Returns (creating on first use) the shared toast stack element.
 * @returns {HTMLDivElement} The container that holds visible toasts.
 */
function ensureContainer() {
  if (container) return container
  container = document.createElement('div')
  container.className = 'app-toast-container'
  container.setAttribute('role', 'status')
  container.setAttribute('aria-live', 'polite')
  document.body.appendChild(container)
  return container
}

/**
 * Shows a transient toast banner.
 * @param {string} text - The message to display.
 * @param {string} [type='success'] - Toast tone: `success` or `error`.
 * @param {number} [duration=3200] - How long (ms) the toast stays visible.
 * @returns {void}
 */
export function toast(text, type = 'success', duration = 3200) {
  const el = document.createElement('div')
  el.className = `app-toast${type === 'error' ? ' app-toast-error' : ''}`
  el.textContent = text
  ensureContainer().appendChild(el)

  window.setTimeout(() => {
    el.classList.add('app-toast-hide')
    window.setTimeout(() => el.remove(), 250)
  }, duration)
}

/**
 * Error-tinted toast for failed actions.
 * @param {string} text - The error message to display.
 * @returns {void}
 */
export function toastError(text) {
  toast(text, 'error')
}

/**
 * Removes every visible toast and resets the shared container (used in tests).
 * @returns {void}
 */
export function clearToasts() {
  container?.remove()
  container = null
}

// Expose for any code that calls window.toast(...) directly.
if (typeof window !== 'undefined') {
  window.toast = toast
  window.toastError = toastError
  window.clearToasts = clearToasts
}
