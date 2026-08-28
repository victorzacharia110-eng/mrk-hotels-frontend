import { computed, ref, watch } from 'vue'

/**
 * Client-side table helpers: realtime search, dynamic status filter and
 * pagination for lists the API returns as plain arrays.
 *
 *   const { q, status, statuses, page, lastPage, paged } = useClientTable(rows)
 */
export function useClientTable(source, { pageSize = 15, searchFields = [], filterFn = null } = {}) {
  const q = ref('')
  const status = ref('')
  const page = ref(1)

  const statuses = computed(() =>
    [...new Set(source.value.map((r) => r.status).filter(Boolean))].sort(),
  )

  const filtered = computed(() => {
    let rows = source.value
    if (filterFn) rows = rows.filter(filterFn)
    if (status.value) rows = rows.filter((r) => r.status === status.value)
    const term = q.value.trim().toLowerCase()
    if (term && searchFields.length) {
      rows = rows.filter((r) =>
        searchFields.some((f) => {
          const v = typeof f === 'function' ? f(r) : r[f]
          return String(v ?? '').toLowerCase().includes(term)
        }),
      )
    }
    return rows
  })

  const lastPage = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
  const paged = computed(() => {
    const p = Math.min(page.value, lastPage.value)
    return filtered.value.slice((p - 1) * pageSize, p * pageSize)
  })

  const reset = () => { page.value = 1 }
  watch([q, status], reset)

  return { q, status, statuses, page, lastPage, paged }
}
