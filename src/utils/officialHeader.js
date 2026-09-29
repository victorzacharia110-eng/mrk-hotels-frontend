/**
 * Cached hotel letterhead for exports.
 *
 * The details above an exported table only change when somebody edits the hotel
 * business details, but the button is mounted on dozens of screens and each
 * mount would otherwise re-request them. So the result is cached for the
 * session — and the cache has to be droppable, or a hotel that renames itself
 * keeps printing the old name on every PDF and CSV until the browser is
 * restarted.
 */

import { hotelSettingsApi } from '@/api'

let officialHeader = null
let headerPromise = null

/**
 * Drops the cached letterhead so the next export re-fetches it.
 *
 * Called after a successful hotel settings save. Cheap and idempotent, so it is
 * safe to call on every save without tracking whether anything actually moved.
 */
export function invalidateOfficialHeader() {
  officialHeader = null
  headerPromise = null
}

/**
 * The hotel name/address/contact block, fetched once and reused.
 *
 * A failed request caches an empty object rather than retrying on every
 * export: a network blip should not turn into one request per CSV the user
 * downloads, and the export still works with a blank header.
 */
export async function getOfficialHeader() {
  if (officialHeader) return officialHeader
  if (headerPromise) return headerPromise

  headerPromise = hotelSettingsApi
    .show()
    .then((res) => {
      const h = res.data?.hotel || res.data?.data || {}
      officialHeader = {
        name: h.hotel_name || '',
        address: h.address || '',
        city: h.city || '',
        country: h.country || '',
        phone: h.phone || '',
        email: h.email || '',
        tin: h.tin || '',
        vrn: h.vrn || '',
      }
      return officialHeader
    })
    .catch(() => {
      officialHeader = {}
      return officialHeader
    })

  return headerPromise
}
