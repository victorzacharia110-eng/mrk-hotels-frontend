import { computed, reactive, ref } from 'vue'

/**
 * Bulk row-selection helpers for any table.
 *
 *   const bulk = useBulkSelection(() => rooms.value, { idKey: 'room_id' })
 *
 * - `selectedIds` persists across pages so rows picked on different pages accumulate.
 * - `toggleAll()` only toggles the rows currently visible (the array `getRows()` returns),
 *   which is the standard "select this page" behaviour.
 * - `removeMany(destroy)` fans out one delete call per selected id, never rejects.
 */
export function useBulkSelection(getRows, { idKey = 'id' } = {}) {
  const selectedIds = ref(new Set())

  const rows = computed(() => getRows() || [])

  const allSelected = computed(
    () => rows.value.length > 0 && rows.value.every((row) => selectedIds.value.has(row[idKey])),
  )
  const someSelected = computed(
    () => rows.value.length > 0 && rows.value.some((row) => selectedIds.value.has(row[idKey])),
  )
  const selectedCount = computed(() => selectedIds.value.size)

  function isSelected(id) {
    return selectedIds.value.has(id)
  }

  function toggle(id) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function toggleAll() {
    const next = new Set(selectedIds.value)
    if (allSelected.value) {
      rows.value.forEach((row) => next.delete(row[idKey]))
    } else {
      rows.value.forEach((row) => next.add(row[idKey]))
    }
    selectedIds.value = next
  }

  function clear() {
    selectedIds.value = new Set()
  }

  /**
   * Deletes every selected row via the given per-id destroy function.
   * @param {(id) => Promise<unknown>} destroy - resolves only for successful deletes.
   * @returns {Promise<{ tried: number, removed: number, failed: number }>}
   */
  async function removeMany(destroy) {
    const ids = [...selectedIds.value]
    const results = await Promise.allSettled(ids.map((id) => Promise.resolve(destroy(id))))
    const failed = results.filter((r) => r.status === 'rejected').length
    return { tried: ids.length, removed: ids.length - failed, failed }
  }

  return reactive({
    selectedIds,
    selectedCount,
    allSelected,
    someSelected,
    isSelected,
    toggle,
    toggleAll,
    clear,
    removeMany,
  })
}