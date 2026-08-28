/**
 * Real-time presence over Reverb presence channels.
 *
 * Every authenticated user joins `presence-online.all` (the whole MRK Hotels
 * network); tenant members additionally join `presence-online.{tenant_id}` so
 * same-hotel status stays visible even if global presence were ever disabled.
 * The broadcast system pushes the live member list to peers, so any browser
 * with the app open keeps the online set up to date without polling. The state
 * is a module singleton so every view shares one subscription; components only
 * read it. The channels self-heal: if the Echo singleton is destroyed and later
 * re-created (e.g. after a logout/login), the next join re-subscribes.
 */

import { ref } from 'vue'
import { getEcho } from '@/plugins/echo'

// Peers currently online in this user's hotel (tenant channel) and anywhere on
// the network (global channel); self is always excluded. Both are reactive so
// components calling isOnline() during render re-render when members change.
const tenantOnline = ref(new Set())
const globalOnline = ref(new Set())

// Echo instance the current subscriptions belong to (null once torn down).
let echoRef = null
let tenantChannel = null
let globalChannel = null

/**
 * Wires a presence channel's here/joining/leaving callbacks into a reactive set.
 * @param {object} channel - The Echo presence channel.
 * @param {object} setRef - The reactive Set ref to maintain.
 * @param {string|number} myId - Current user id, excluded from the set.
 * @returns {void}
 */
function subscribe(channel, setRef, myId) {
  channel.here((members) => {
    const ids = new Set()
    for (const member of members || []) {
      if (member && member.user_id != null && member.user_id !== myId) ids.add(member.user_id)
    }
    setRef.value = ids
  })

  channel.joining((member) => {
    if (member && member.user_id != null && member.user_id !== myId) {
      const next = new Set(setRef.value)
      next.add(member.user_id)
      setRef.value = next
    }
  })

  channel.leaving((member) => {
    if (member && member.user_id != null) {
      const next = new Set(setRef.value)
      next.delete(member.user_id)
      setRef.value = next
    }
  })
}

/**
 * Joins the global presence channel (always) and the tenant presence channel
 * (when a tenant id is given). Idempotent. No-ops when there is no Echo client
 * yet.
 * @param {string|number} tenantId - The hotel tenant id to observe (nullable).
 * @param {object} me - Current user payload (used to exclude self).
 * @returns {void}
 */
export function joinPresence(tenantId, me) {
  const echo = getEcho()
  if (!echo) return

  const myId = me?.user_id ?? me?.userId

  // The Echo singleton was torn down and rebuilt since our last join: reset
  // so we subscribe to the fresh connection.
  if (echo !== echoRef) {
    echoRef = echo
    tenantChannel = null
    globalChannel = null
    tenantOnline.value = new Set()
    globalOnline.value = new Set()
  }

  if (!globalChannel) {
    globalChannel = echo.join('online.all')
    subscribe(globalChannel, globalOnline, myId)
  }

  if (tenantId && !tenantChannel) {
    tenantChannel = echo.join(`online.${tenantId}`)
    subscribe(tenantChannel, tenantOnline, myId)
  }
}

/**
 * Leaves both presence channels and clears the online sets.
 * @returns {void}
 */
export function leavePresence() {
  if (tenantChannel) {
    tenantChannel.unsubscribe()
    tenantChannel = null
  }
  if (globalChannel) {
    globalChannel.unsubscribe()
    globalChannel = null
  }
  echoRef = null
  tenantOnline.value = new Set()
  globalOnline.value = new Set()
}

/**
 * Whether the given user is currently online anywhere on the network (peers
 * only, never self). Reads both reactive sets, so template calls re-evaluate
 * whenever presence changes.
 * @param {string|number} userId - The user id to test.
 * @returns {boolean} True when the user is in either presence set.
 */
export function isOnline(userId) {
  return tenantOnline.value.has(userId) || globalOnline.value.has(userId)
}
