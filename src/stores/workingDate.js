import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fbDayCloseApi } from '@/api'

/**
 * The hotel's open business date, sourced from the F&B Day Close backend.
 *
 * When a cashier closes a business day the panels must start operating on the
 * NEXT working date instead of the wall-clock "today". This store fetches
 * GET /fnb/day-close once (which returns the tenant's `open_date` in the
 * hotel's own timezone), caches it, and falls back to the local date so every
 * panel still renders before the fetch completes or if it fails.
 */
const localToday = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/**
 * The hotel's calendar day, not the browser's.
 *
 * The business date rolls over at midnight in the HOTEL's timezone (the one
 * returned by GET /fnb/day-close). A browser sitting in another zone would
 * otherwise read the wrong day: a laptop in UTC sees the previous day until
 * 03:00 Dar es Salaam time, so `needsDayClose` stays false and the panels
 * default to yesterday's business date — exactly the confusion item 18 of the
 * review is about. Before the hotel timezone is known we fall back to the
 * browser date, and the fetch corrects it as soon as it lands.
 */
const dateInTimezone = (timezone) => {
  if (!timezone) return localToday()
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const pick = (type) => parts.find((part) => part.type === type)?.value
    return `${pick('year')}-${pick('month')}-${pick('day')}`
  } catch {
    return localToday()
  }
}

/**
 * One sessionStorage key for the whole Day Close reminder. The three panels
 * that show it (cashier/bar, inventory manager, staff order pad) used to keep
 * separate keys, so a cashier sitting on the order pad got the layout modal
 * AND the page banner stacked on top of each other.
 */
const DAY_CLOSE_REMINDER_KEY = 'fnb_day_close_reminder_ack'

export const useWorkingDateStore = defineStore('workingDate', () => {
  const openDate = ref('')
  const timezone = ref('')
  const runningOrdersCount = ref(0)
  const unsettledOrdersCount = ref(0)
  const loading = ref(false)
  const loaded = ref(false)

  /** The business date every cashier/bar/inventory panel should default to. */
  const workingDate = computed(() => openDate.value || today.value)

  /** The hotel's current calendar day, in the hotel's own timezone. */
  const today = computed(() => dateInTimezone(timezone.value))

  /**
   * True once the hotel's calendar date has moved past the open business date
   * — i.e. a new day has started but Day Close has not been run yet. Panels
   * use this to remind staff that orders taken now still join the running
   * orders of the open (un-closed) business day.
   */
  const needsDayClose = computed(
    () => Boolean(openDate.value) && openDate.value < today.value,
  )

  /**
   * The Day Close reminder is shared state rather than a per-component ref:
   * exactly one modal may be on screen, no matter how many of the panels that
   * used to render their own copy happen to be mounted together.
   */
  const dayCloseReminderVisible = ref(false)

  /** Loads the business date, then raises the reminder if the day rolled over. */
  async function initDayCloseReminder() {
    await ensureLoaded()
    if (needsDayClose.value && !sessionStorage.getItem(DAY_CLOSE_REMINDER_KEY)) {
      dayCloseReminderVisible.value = true
    }
  }

  function dismissDayCloseReminder() {
    dayCloseReminderVisible.value = false
    sessionStorage.setItem(DAY_CLOSE_REMINDER_KEY, '1')
  }

  /** Fetches the open business date once; failures keep the local fallback. */
  async function ensureLoaded() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const { data } = await fbDayCloseApi.index()
      openDate.value = data?.open_date || ''
      timezone.value = data?.timezone || ''
      runningOrdersCount.value = Number(data?.running_orders_count ?? 0)
      unsettledOrdersCount.value = Number(data?.unsettled_orders_count ?? 0)
      loaded.value = true
    } catch {
      // Keep the local-today fallback so panels always render.
    } finally {
      loading.value = false
    }
  }

  /** Force-refetches the business date (used after a Day Close succeeds). */
  async function reload() {
    loaded.value = false
    openDate.value = ''
    await ensureLoaded()
  }

  return {
    openDate,
    timezone,
    runningOrdersCount,
    unsettledOrdersCount,
    loading,
    loaded,
    workingDate,
    today,
    needsDayClose,
    dayCloseReminderVisible,
    initDayCloseReminder,
    dismissDayCloseReminder,
    ensureLoaded,
    reload,
  }
})