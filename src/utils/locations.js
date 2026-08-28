/**
 * Country and city lookups for the booking forms.
 *
 * The dataset ships ~250 countries and ~150k cities (~8MB) — far too heavy
 * to put in the initial bundle. It is therefore loaded lazily via a dynamic
 * import the first time location UI actually needs it (Vite emits it as a
 * separate chunk fetched on demand). Everything here stays memoised: the
 * country list is built once and each country's cities are cached the first
 * time that country is selected.
 */

/** @type {Promise<object>|null} In-flight/finished loader for the dataset. */
let libPromise = null
/** @type {object|null} The loaded country-state-city module. */
let lib = null

// Memoised country list (built once, reused across all calls).
let countryCache = null
// Memoised city list per country code.
const cityCache = new Map()

/**
 * Loads the location dataset on demand. Safe to call repeatedly — the
 * dynamic import resolves only once. Awaiting this before reading the
 * getters guarantees data availability.
 * @returns {Promise<object>} The loaded dataset module.
 */
export function loadLocationData() {
  if (!libPromise) {
    libPromise = import('country-state-city').then((mod) => {
      lib = mod
      return mod
    })
  }
  return libPromise
}

/** Countries the hotel serves most, floated to the top of the list. */
export const PRIORITY_COUNTRY_CODES = ['TZ', 'KE', 'UG', 'RW', 'BI', 'ZM', 'MW', 'MZ', 'ZA']

/** Country preselected in the forms (the chain's home market). */
export const DEFAULT_COUNTRY_CODE = 'TZ'

/**
 * All countries as `{ code, name, phoneCode, flag }`, priority countries first
 * and everything else alphabetical. Requires {@link loadLocationData} to have
 * been awaited first.
 * @returns {Array<object>} The ordered list of countries.
 */
export function getCountries() {
  if (countryCache) return countryCache
  const all = lib.Country.getAllCountries().map((country) => ({
    code: country.isoCode,
    name: country.name,
    phoneCode: country.phonecode,
    flag: country.flag,
  }))

  // Pull the priority countries out in their fixed order...
  const priority = PRIORITY_COUNTRY_CODES.map((code) => all.find((c) => c.code === code)).filter(
    Boolean,
  )
  const priorityCodes = new Set(priority.map((c) => c.code))
  // ...then sort the remainder alphabetically for the rest of the list.
  const rest = all
    .filter((c) => !priorityCodes.has(c.code))
    .sort((a, b) => a.name.localeCompare(b.name))

  countryCache = [...priority, ...rest]
  return countryCache
}

/**
 * Every city in a country, de-duplicated and sorted by name.
 *
 * Some countries repeat a city name across states, so names are collapsed to a
 * unique set: the form only stores a city name, not a state.
 * @param {string} countryCode - ISO country code.
 * @returns {string[]} The sorted, de-duplicated city names.
 */
export function getCities(countryCode) {
  if (!countryCode) return []
  if (cityCache.has(countryCode)) return cityCache.get(countryCode)

  const raw = lib.City.getCitiesOfCountry(countryCode) || []
  const seen = new Set()
  const cities = []

  for (const city of raw) {
    if (seen.has(city.name)) continue
    seen.add(city.name)
    cities.push(city.name)
  }

  // A handful of small territories carry no city data; fall back to their
  // states so the dropdown is never empty.
  if (cities.length === 0) {
    for (const state of lib.State.getStatesOfCountry(countryCode) || []) {
      if (seen.has(state.name)) continue
      seen.add(state.name)
      cities.push(state.name)
    }
  }

  cities.sort((a, b) => a.localeCompare(b))
  cityCache.set(countryCode, cities)
  return cities
}

/**
 * Resolves a country name to its ISO code, so records saved before the code was
 * captured still light up the city dropdown. Returns '' when the dataset has
 * not been loaded yet rather than blocking the caller.
 * @param {string} name - Country name.
 * @returns {string} The matching ISO code, or ''.
 */
export function findCountryCode(name) {
  if (!name || !lib) return ''
  const match = getCountries().find((c) => c.name.toLowerCase() === String(name).toLowerCase())
  return match ? match.code : ''
}

/**
 * Resolves a country ISO code to its display name. Returns '' when the
 * dataset has not been loaded yet rather than blocking the caller.
 * @param {string} code - ISO country code.
 * @returns {string} The country name, or ''.
 */
export function getCountryName(code) {
  if (!code || !lib) return ''
  const match = getCountries().find((c) => c.code === code)
  return match ? match.name : ''
}
