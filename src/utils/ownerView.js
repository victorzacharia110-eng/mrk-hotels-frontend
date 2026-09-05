/**
 * Tracks which hotel an owner is currently viewing in the staff panel.
 * Session-scoped: closing the tab drops the selection.
 */
const ID_KEY = 'owner_viewing_hotel'
const NAME_KEY = 'owner_viewing_hotel_name'
const FEATURES_KEY = 'owner_viewing_hotel_features'

/**
 * Stores the hotel an owner is currently viewing in the staff panel.
 * @param {string} id - Hotel identifier.
 * @param {string} name - Hotel display name.
 * @param {string[]|null} features - The hotel's enabled subscription
 *   features (null means all features are enabled).
 */
export function setOwnerHotel(id, name, features = null) {
  sessionStorage.setItem(ID_KEY, id)
  sessionStorage.setItem(NAME_KEY, name || '')
  if (features) {
    sessionStorage.setItem(FEATURES_KEY, JSON.stringify(features))
  } else {
    sessionStorage.removeItem(FEATURES_KEY)
  }
}

/**
 * Clears the owner's selected hotel (used on logout / switching back).
 */
export function clearOwnerHotel() {
  sessionStorage.removeItem(ID_KEY)
  sessionStorage.removeItem(NAME_KEY)
  sessionStorage.removeItem(FEATURES_KEY)
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

/**
 * Returns the enabled subscription features of the hotel the owner is
 * viewing, or null when all features are enabled (or none selected).
 * @returns {string[]|null}
 */
export function ownerHotelFeatures() {
  const raw = sessionStorage.getItem(FEATURES_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
