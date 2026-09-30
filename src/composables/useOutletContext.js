/**
 * Which outlet the signed-in user is working in.
 *
 * The manager review asks for this to be choosable by everyone, management
 * included, except reception: "all users even management except receptionist get
 * to select which outlet would they use in order to perform their activities".
 * The worked example is a property with two stores, where a store manager has
 * no way to tell which one they are about to work in.
 *
 * CashierLayout already had this, but only as its own POS gate, and only for
 * the POS. The state lives here so the whole panel shares one selection.
 *
 * State is module-level on purpose: this is one selection per signed-in
 * session, read by the layout, the POS pages and the order screen at once, so
 * it must not be re-created per component.
 */
import { ref, computed } from 'vue'
import { outletApi } from '@/api'

/** The property's outlets, loaded once per session. */
const outlets = ref([])
/** Currently selected outlet object ({ outlet_id, name, type }) or null. */
const selectedOutlet = ref(null)
/** True once the list has been fetched at least once. */
const loaded = ref(false)
/** Set while a fetch is in flight, so two layouts don't both request it. */
let inflight = null

const STORAGE_KEY = 'active_outlet'

/** True once an outlet has been picked for this session. */
const hasOutlet = computed(() => selectedOutlet.value !== null)

/** Outlet id for API calls, or undefined so a query string is left clean. */
const outletId = computed(() => selectedOutlet.value?.outlet_id)

/**
 * Loads the property's outlets and re-applies the persisted selection.
 *
 * The saved id is honoured only if it still matches a live outlet, so a
 * deactivated outlet does not leave the panel working against something that
 * no longer exists.
 *
 * @returns {Promise<Array>} The outlets.
 */
async function loadOutlets() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const { data } = await outletApi.index()
      outlets.value = data.outlets || data.data || []
      const savedId = sessionStorage.getItem(STORAGE_KEY)
      selectedOutlet.value = outlets.value.find((o) => o.outlet_id === savedId) || null
    } catch {
      // A property with no reachable outlet list keeps the panel usable rather
      // than blocking it; the POS gate still guards the cashier flow.
      outlets.value = []
      selectedOutlet.value = null
    } finally {
      loaded.value = true
      inflight = null
    }
    return outlets.value
  })()
  return inflight
}

/**
 * Selects the outlet to work in.
 *
 * @param {object} outlet  The outlet object to activate.
 */
function selectOutlet(outlet) {
  selectedOutlet.value = outlet || null
  if (outlet?.outlet_id) sessionStorage.setItem(STORAGE_KEY, outlet.outlet_id)
  else sessionStorage.removeItem(STORAGE_KEY)
}

/** Clears the selection, returning the user to the un-picked state. */
function clearOutlet() {
  selectedOutlet.value = null
  sessionStorage.removeItem(STORAGE_KEY)
}

/** True when more than one outlet exists, i.e. picking one is a real choice. */
const hasChoice = computed(() => outlets.value.length > 1)

/**
 * Whether the signed-in role may pick an outlet.
 *
 * Reception is the one role the review carves out: front desk work is not done
 * "through" an outlet, so offering the picker there would be a control with no
 * meaning behind it.
 *
 * @param {string|undefined|null} role  The user's role.
 * @returns {boolean} True when the role may choose an outlet.
 */
function roleCanSelectOutlet(role) {
  return !!role && role !== 'receptionist'
}

export function useOutletContext() {
  return {
    outlets,
    selectedOutlet,
    hasOutlet,
    hasChoice,
    loaded,
    outletId,
    loadOutlets,
    selectOutlet,
    clearOutlet,
    roleCanSelectOutlet,
  }
}

/**
 * The refs are also exported directly, because the order screens only need to
 * read the current selection and stamping a ticket is not a "use this context"
 * moment -- it is a single read at submit time. They are the same refs the
 * function above hands out, so there is still only one selection per session.
 */
export { outlets, selectedOutlet, hasOutlet, hasChoice, loaded, outletId }
