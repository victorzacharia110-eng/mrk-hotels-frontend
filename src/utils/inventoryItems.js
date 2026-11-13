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
  // Only the loop condition reads this, and the do/while body always assigns it
  // from the first response's meta before that condition is ever evaluated.
  let lastPage

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

/**
 * The stock an item holds on one department's shelf.
 *
 * Mirrors InventoryItem::stockFor() on the API: items with no shelf rows keep
 * their plain global level, while shelf-managed items must not fall back to
 * the hotel-wide total when the selected shelf is not one of their rows.
 *
 * @param {object} item - Inventory item resource.
 * @param {string|undefined} departmentId - Shelf to read.
 * @returns {number} Quantity on that shelf.
 */
export function stockOnShelf(item, departmentId) {
  const shelves = item?.departments
  if (!Array.isArray(shelves) || shelves.length === 0) {
    return Number(item?.quantity_in_stock || 0)
  }
  const shelf = shelves.find(
    (department) => String(department.department_id) === String(departmentId),
  )
  return shelf ? Number(shelf.quantity || 0) : 0
}
