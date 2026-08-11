/**
 * Tracks which hotel an owner is currently viewing in the staff panel.
 * Session-scoped: closing the tab drops the selection.
 */
const ID_KEY = 'owner_viewing_hotel'
const NAME_KEY = 'owner_viewing_hotel_name'

/**
 * Stores the hotel an owner is currently viewing in the staff panel.
 * @param {string} id - Hotel identifier.
 * @param {string} name - Hotel display name.
 */
export function setOwnerHotel(id, name) {
  sessionStorage.setItem(ID_KEY, id)
  sessionStorage.setItem(NAME_KEY, name || '')
}

/**
 * Clears the owner's selected hotel (used on logout / switching back).
 */
export function clearOwnerHotel() {
  sessionStorage.removeItem(ID_KEY)
  sessionStorage.removeItem(NAME_KEY)
}

/**
 * Returns the id of the hotel the owner is viewing.
 * @returns {string} Hotel id, or '' when none selected.
 */
export function ownerHotelId() {
  return sessionStorage.getItem(ID_KEY) || ''
}

/**
 * Returns the name of the hotel the owner is viewing.
 * @returns {string} Hotel name, or '' when none selected.
 */
export function ownerHotelName() {
  return sessionStorage.getItem(NAME_KEY) || ''
}
