/*
  a11y.js — centralized accessibility behaviours applied across the whole app.

  Handles the modal dialog pattern that is repeated inline on many pages:
    <div v-if="showX" class="modal-overlay" @click.self="close">
      <div class="modal">
        <div class="modal-head">
          <h2>…</h2>
          <button class="modal-close"><i class="fas fa-xmark"></i></button>
        …

  Without touching every page, this module:
    - labels every .modal-overlay as a modal dialog (role/aria-modal) and names
      it from its <h2> heading;
    - labels icon-only close buttons;
    - traps Tab focus inside the open modal;
    - restores focus to the triggering element when a modal closes;
    - closes the top-most modal when Escape is pressed.
*/

import i18n from '@/locales/i18n'

let previousFocus = null
let currentOverlay = null

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
]

/** Returns the deepest open .modal-overlay, or null when none is open. */
function topOverlay() {
  const overlays = document.querySelectorAll('.modal-overlay')
  return overlays.length ? overlays[overlays.length - 1] : null
}

/** Focusable elements inside an overlay, in document order. */
function focusableIn(overlay) {
  return Array.from(overlay.querySelectorAll(FOCUSABLE.join(',')))
}

/**
 * Makes an overlay behave as an accessible modal dialog: ARIA semantics,
 * an accessible name from its heading, a labelled close button and focus.
 */
function prepareOverlay(overlay) {
  if (overlay.dataset.a11yReady) return
  overlay.dataset.a11yReady = 'true'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.tabIndex = -1

  const heading = overlay.querySelector('.modal-head h2, .modal h2, h2')
  if (heading) {
    heading.setAttribute(
      'id',
      `modal-title-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    )
    overlay.setAttribute('aria-labelledby', heading.id)
  }

  const closeBtn = overlay.querySelector('.modal-close')
  if (closeBtn && !closeBtn.getAttribute('aria-label')) {
    closeBtn.setAttribute('aria-label', i18n.global.t('common.close'))
  }

  if (currentOverlay !== overlay) {
    currentOverlay = overlay
    previousFocus = document.activeElement
    const first = focusableIn(overlay)[0]
    if (first) first.focus()
    else overlay.focus()
  }
}

/** Restores focus to whatever opened the modal when it is removed. */
function cleanupOverlay(overlay) {
  if (currentOverlay !== overlay) return
  currentOverlay = null
  if (previousFocus && document.contains(previousFocus)) previousFocus.focus()
  previousFocus = null
}

/** Watches for modal overlays appearing/disappearing anywhere in the app. */
function watchOverlays() {
  const observer = new MutationObserver((_mutations) => {
    const next = topOverlay()
    if (next && next !== currentOverlay) prepareOverlay(next)
    if (!next) {
      if (currentOverlay) cleanupOverlay(currentOverlay)
      currentOverlay = null
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  const initial = topOverlay()
  if (initial) prepareOverlay(initial)
}

/** Keeps Tab/Shift+Tab inside the open modal. */
function trapFocus(event) {
  if (!currentOverlay) return
  if (event.key !== 'Tab') return
  const items = focusableIn(currentOverlay)
  if (!items.length) return
  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

/** Closes the top-most modal with the Escape key via its close button. */
function onEscape(event) {
  if (event.key !== 'Escape') return
  const overlay = topOverlay()
  if (!overlay) return
  event.preventDefault()
  const closeBtn = overlay.querySelector('.modal-close')
  if (closeBtn) closeBtn.click()
}

/** Installs the global modal behaviours. Call once, after the app mounts. */
export function initA11y() {
  watchOverlays()
  document.addEventListener('keydown', trapFocus, true)
  document.addEventListener('keydown', onEscape)
}
