import { inventoryApi } from '@/api'

/**
 * Loads the whole inventory catalogue, not just the first 100 rows.
 * Pickers on purchase orders, GRNs and transfers must offer every registered
 * item; the API caps `per_page` at 100, so walk its pages.
 *
 * @param {object} params - Extra inventory index filters (category, search...).
 * @returns {Promise<Array>} Every inventory item visible to the caller.
 */
export async function fetchAllInventoryItems(params = {}) {
  const items = []
  let page = 1
  let lastPage = 1

  do {
    const res = await inventoryApi.index({ ...params, per_page: 100, page })
    const rows = res.data.data || res.data || []
    items.push(...rows)
    const meta = res.data.meta || {}
    lastPage = Number(meta.last_page || 1)
    page += 1
  } while (page <= lastPage)

  return items
}
