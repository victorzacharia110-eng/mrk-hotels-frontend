import { defineStore } from 'pinia'
import { ref } from 'vue'
import Swal from 'sweetalert2'
import { notificationApi } from '@/api'
import { getEcho } from '@/plugins/echo'
import { useAuthStore } from '@/stores/auth'
import { useNotificationSettingsStore } from '@/stores/notificationSettings'
import i18n from '@/locales/i18n'

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Minimum gap between action-alert popups so a burst of notices does not stack
// modal after modal in front of the desk.
const ACTION_ALERT_COOLDOWN_MS = 5000
let lastActionAlertAt = 0

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref([])
  const unreadCount = ref(0)
  const alertCount = ref(0)
  const alerts = ref([])
  const loading = ref(false)
  let pollingTimer = null
  let echoListener = null
  let echoUserListener = null

  /** Rings the device when the kitchen flags an order item ready. */
  function ringReadyTone(event) {
    const d = event?.data || {}
    const key = d.order_id && d.item_id ? `${d.order_id}:${d.item_id}` : null
    useNotificationSettingsStore().ring(key)
  }

  /**
   * Surfaces a needs-action alert as a SweetAlert modal at the desk, so an
   * important notice (guest due out and still owing, pending approval, ...)
   * cannot be missed behind the bell badge. Throttled so a burst of alerts
   * does not stack modals.
   * @param {object} event - The realtime notification payload.
   */
  function showActionAlert(event) {
    const now = Date.now()
    if (now - lastActionAlertAt < ACTION_ALERT_COOLDOWN_MS) return
    lastActionAlertAt = now

    const d = event?.data || {}
    const title = d.title || event?.title || ''
    const body = d.body || event?.body || ''
    const t = i18n.global.t.bind(i18n.global)

    Swal.fire({
      icon: 'warning',
      title: t('notifications.actionAlertTitle'),
      html:
        `<strong style="font-size:1.05rem;">${escapeHtml(title)}</strong>` +
        (body ? `<p style="margin:8px 0 0;color:#475569;font-size:0.95rem;">${escapeHtml(body)}</p>` : ''),
      confirmButtonText: t('notifications.actionAlertConfirm'),
      confirmButtonColor: '#005EB8',
      showCloseButton: true,
    })
  }

  /** True when a staff/portal session token exists — public visitors never poll. */
  function hasSession() {
    return Boolean(useAuthStore().token)
  }

  /** Fetch unread counts from the API. */
  async function fetchCounts() {
    if (!hasSession()) return
    try {
      const { data } = await notificationApi.unreadCount()
      unreadCount.value = data.count
      alertCount.value = data.alert_count
    } catch {
      // Silently ignore — the badge just won't update.
    }
  }

  /** Fetch pending alert notifications (for dashboard modals). */
  async function fetchAlerts() {
    if (!hasSession()) return
    try {
      const { data } = await notificationApi.alerts()
      alerts.value = data.alerts || []
    } catch {
      // Silently ignore.
    }
  }

  /** Fetch paginated notification list. */
  async function fetchNotifications(params = {}) {
    loading.value = true
    try {
      const { data } = await notificationApi.index(params)
      notifications.value = data.data || []
    } catch {
      // Silently ignore.
    } finally {
      loading.value = false
    }
  }

  /** Mark a single notification as read and update counts. */
  async function markRead(id) {
    try {
      await notificationApi.markRead(id)
      unreadCount.value = Math.max(0, unreadCount.value - 1)
      const idx = alerts.value.findIndex((a) => a.id === id)
      if (idx !== -1) {
        alerts.value.splice(idx, 1)
        alertCount.value = Math.max(0, alertCount.value - 1)
      }
    } catch {
      // Silently ignore.
    }
  }

  /** Mark all notifications as read. */
  async function markAllRead() {
    try {
      await notificationApi.markAllRead()
      unreadCount.value = 0
      alertCount.value = 0
      alerts.value = []
    } catch {
      // Silently ignore.
    }
  }

  /** Dismiss a specific alert (mark as read). */
  function dismissAlert(id) {
    markRead(id)
  }

  /** Dismiss all alerts. */
  function dismissAllAlerts() {
    alerts.value.forEach((a) => markRead(a.id))
  }

  /** Start polling for unread counts every 30 seconds. */
  function startPolling() {
    stopPolling()
    fetchCounts()
    pollingTimer = setInterval(fetchCounts, 30000)
  }

  /** Stop polling. */
  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  /** Listen on the WebSocket tenant channel for real-time notifications. */
  function listenEcho() {
    const authStore = useAuthStore()
    const tenantId = authStore.user?.tenant_id
    if (!tenantId) return

    const echo = getEcho()
    if (!echo) return

    // Leave any previous listeners.
    stopEchoListener()

    echoListener = echo.private(`tenant.${tenantId}`)
      .listen('.notification.created', (event) => {
        unreadCount.value++
        // If it's an alert type, add to alerts, increment alertCount and
        // surface it at the desk as a SweetAlert modal.
        if (event.data?.requires_action) {
          alerts.value.unshift(event)
          alertCount.value++
          showActionAlert(event)
        }
        // Ring the device when a guest's check-out time is up and they still
        // owe money, so the front desk collects payment at check-out.
        if (event.type === 'reservation_due_out') {
          const d = event.data || {}
          useNotificationSettingsStore().ring(`due_out:${d.reservation_id}`)
        }
      })

    // Personal channel: ring only the targeted staff member's device when the
    // kitchen flags an order item as ready (the tenant broadcast reaches the
    // whole hotel, so ringing happens here to avoid the kitchen hearing every
    // item it marks).
    const userId = authStore.user?.user_id
    if (userId) {
      echoUserListener = echo.private(`user.${userId}`)
        .listen('.notification.created', (event) => {
          if (event.type === 'order_item_ready') {
            ringReadyTone(event)
          }
        })
    }
  }

  /** Stop the Echo listeners. */
  function stopEchoListener() {
    if (echoListener) {
      echoListener.stopListening('.notification.created')
      echoListener = null
    }
    if (echoUserListener) {
      echoUserListener.stopListening('.notification.created')
      echoUserListener = null
    }
  }

  /** Initialize: start polling and listen on WebSocket (authenticated sessions only). */
  function init() {
    if (!hasSession()) return
    fetchCounts()
    startPolling()
    listenEcho()
  }

  /** Cleanup. */
  function destroy() {
    stopPolling()
    stopEchoListener()
  }

  return {
    notifications,
    unreadCount,
    alertCount,
    alerts,
    loading,
    fetchCounts,
    fetchAlerts,
    fetchNotifications,
    markRead,
    markAllRead,
    dismissAlert,
    dismissAllAlerts,
    startPolling,
    stopPolling,
    listenEcho,
    stopEchoListener,
    init,
    destroy,
  }
})
