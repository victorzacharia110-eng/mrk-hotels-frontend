/**
 * Stale-bundle guard.
 *
 * A till keeps a long-lived tab open, so it can be running an old JS bundle
 * long after a new deploy. That is not just a missing-feature problem: an old
 * bundle talks to QZ Tray with an old (or absent) signing certificate, which
 * shows up at the printer as the wrong certificate or an "Untrusted website"
 * prompt. The fix is to notice the mismatch and reload.
 *
 * On every check we fetch `/version.json` (a static asset written at build time
 * by scripts/bump-version.mjs) with cache disabled. If the deployed version
 * differs from the one baked into this bundle, the page is stale. We then wait
 * for a safe moment — never mid-print, never with an unsaved modal open — and
 * reload.
 *
 * The running version is imported from src/version.json, so it is frozen into
 * the bundle and cannot itself be stale.
 */

import { ref } from 'vue'
import versionData from '@/version.json'

/** The version this page is actually running (baked into the bundle). */
export const runningVersion = versionData.version

/** The version the server is currently serving, once known. */
export const latestVersion = ref(runningVersion)

/** True once a newer deploy has been detected and a reload is pending. */
export const updateAvailable = ref(false)

/** Guards against starting more than one poller (e.g. after a hot reload). */
let started = false

/** How often to check while the tab stays open (ms). */
const CHECK_INTERVAL = 5 * 60 * 1000

/**
 * Someone may be midway through something important; do not yank the page out
 * from under them. We reload only when it is safe, and otherwise remember that
 * an update is waiting so the UI can offer a manual reload.
 */
let canReload = () => true

/** The pending "wait for a safe moment" timer, if any. */
let safeTimer = null

/**
 * Fetches the deployed version and returns it, or null when it cannot be read
 * (offline, blocked, malformed). Never throws — a failed check is silent.
 *
 * @returns {Promise<string|null>}
 */
async function fetchDeployedVersion() {
  try {
    const resp = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' })
    if (!resp.ok) return null
    const data = await resp.json()
    const version = String(data?.version || '').trim()
    return version || null
  } catch {
    return null
  }
}

/**
 * Compares versions and, when the deploy is newer, decides what to do.
 *
 * @param {string} deployed  The version the server is serving.
 * @returns {{ stale: boolean, deployed: string }}
 */
function evaluate(deployed) {
  latestVersion.value = deployed
  return { stale: Boolean(deployed && deployed !== runningVersion), deployed }
}

/** Reload the page, bypassing the HTTP cache, to pick up the new bundle. */
export function reloadToUpdate() {
  // location.reload() may serve a cached HTML; a cache-busting replace forces
  // a fresh fetch while preserving the current route.
  const url = new URL(window.location.href)
  url.searchParams.set('_v', latestVersion.value)
  window.location.replace(url.toString())
}

/**
 * Checks once whether this page is stale.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.reload]  Reload immediately when stale and safe.
 * @returns {Promise<boolean>} True when a newer deploy is available.
 */
export async function checkForUpdate({ reload = true } = {}) {
  const deployed = await fetchDeployedVersion()
  if (!deployed) return false

  const { stale } = evaluate(deployed)
  if (!stale) {
    updateAvailable.value = false
    return false
  }

  updateAvailable.value = true
  if (reload && canReload()) {
    reloadToUpdate()
  } else if (reload && !safeTimer) {
    // Not safe right now — retry a little later rather than abandoning the update.
    safeTimer = setTimeout(() => {
      safeTimer = null
      if (canReload()) reloadToUpdate()
    }, 30 * 1000)
  }
  return true
}

/**
 * Starts watching for new deploys.
 *
 * @param {object} [opts]
 * @param {() => boolean} [opts.isSafeToReload]  Returns false while the user is
 *   mid-task (e.g. a print is in flight or a modal is open); checked before an
 *   automatic reload.
 */
export function watchForUpdates({ isSafeToReload } = {}) {
  if (started) return
  started = true
  if (typeof isSafeToReload === 'function') canReload = isSafeToReload

  // Check shortly after boot, then on a slow interval, and whenever the tab is
  // brought back to the foreground (a till is often hidden between shifts).
  checkForUpdate()
  setInterval(() => checkForUpdate(), CHECK_INTERVAL)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  })
}
