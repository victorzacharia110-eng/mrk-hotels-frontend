/**
 * useAccompaniments.js
 *
 * Loads one department's registered "served with" accompaniments (wali, ugali,
 * chips...) and exposes them as point-of-sale prompt options.
 *
 * The registry is per hotel and per department, so the restaurant and the bar
 * each see only their own sides. Until the fetch resolves, or if it fails, the
 * classic default sides (and their translations) keep the prompt usable; an
 * empty registry shows just the "None" option so departments stay separated.
 * `loadAccompanimentOptions` caches per department, so the waiter, cashier and
 * order-edit screens share one request each.
 */

import { computed, onMounted, reactive, unref, watch } from 'vue'
import {
  fallbackAccompanimentOptions,
  loadAccompanimentOptions,
  normalizeDepartment,
} from '../utils/menuAccompaniment'

/**
 * @param {(key: string) => string} t - i18n translator for the default labels.
 * @param {string | import('vue').Ref<string> | (() => string)} department - the
 *   active department ('restaurant' | 'bar'), reactive when the prompt can be
 *   switched between sides.
 */
export function useAccompaniments(t, department = 'restaurant') {
  const deptRef = computed(() =>
    normalizeDepartment(typeof department === 'function' ? department() : unref(department)),
  )

  // Loaded registry options per department. A missing key means "still default".
  const rowsByDept = reactive({})

  const accompanimentOptions = computed(() => [
    ...(rowsByDept[deptRef.value] ?? fallbackAccompanimentOptions(t)),
    { value: '', label: t('orders.accompNone') },
  ])

  /** Fetches the active department's registry; `force` bypasses the cache. */
  async function loadAccompaniments(force = false) {
    const dept = deptRef.value
    const rows = await loadAccompanimentOptions(dept, { force })
    if (rows) rowsByDept[dept] = rows
    return accompanimentOptions.value
  }

  watch(deptRef, () => loadAccompaniments())
  onMounted(() => loadAccompaniments())

  return { accompanimentOptions, loadAccompaniments }
}