/**
 * Real-time stock level subscription.
 *
 * Listens for `.inventory.updated` events on the tenant's private channel and
 * runs the given callback as soon as any stock movement lands (purchase
 * receipt, indent supplied/accepted, issue, spoilage or an absolute
 * adjustment). Backed by the shared Reverb connection, so the department LOW
 * STOCK list and store dashboards refresh the moment the balance changes
 * instead of showing a stale snapshot.
 *
 * Bursts of movements (an indent supplying several lines at once) are
 * coalesced into a single callback through a short debounce, so the dashboard
 * reloads once rather than flashing on every line.
 */

import { getEcho, initEcho } from '@/plugins/echo'
import { useAuthStore } from '@/stores/auth'

export function useStockRealtime(onUpdate, { debounce = 400 } = {}) {
  const authStore = useAuthStore()
  const tenantId = authStore.user?.tenant_id
  let channel = null
  let timer = null

  const stop = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (channel) channel.stopListening('.inventory.updated')
  }

  if (!tenantId) return { stop }

  const echo = getEcho() || initEcho()
  channel = echo.private(`tenant.${tenantId}`).listen('.inventory.updated', () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      onUpdate()
    }, debounce)
  })

  return { stop }
}