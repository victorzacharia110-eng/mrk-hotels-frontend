/**
 * Real-time order board subscription.
 *
 * Listens for `.order.updated` events on the tenant's private channel and runs
 * the given callback as soon as any F&B order changes (created/edited/voided/
 * split/transferred/settled, or a dish goes ready/served). Backed by the shared
 * Reverb connection, so boards update instantly instead of polling.
 *
 * Multiple events fired in a quick burst (e.g. a waiter adding several items to
 * one ticket) are coalesced into a single callback via a short debounce, so the
 * board reloads once rather than flashing on every single mutation.
 */

import { getEcho, initEcho } from '@/plugins/echo'
import { useAuthStore } from '@/stores/auth'

export function useOrderRealtime(onUpdate, { debounce = 400 } = {}) {
  const authStore = useAuthStore()
  const tenantId = authStore.user?.tenant_id
  let channel = null
  let timer = null

  const stop = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (channel) channel.stopListening('.order.updated')
  }

  if (!tenantId) return { stop }

  const echo = getEcho() || initEcho()
  channel = echo.private(`tenant.${tenantId}`).listen('.order.updated', () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      onUpdate()
    }, debounce)
  })

  return { stop }
}