/**
 * Country and city lookups for the booking forms.
 *
 * The dataset ships ~250 countries and ~150k cities. Everything here is lazy:
 * the country list is built once on first use and each country's cities are
 * cached the first time that country is selected, so opening a form never pays
 * for data it does not show.
 */

import { City, Country, State } from 'country-state-city'

/** Countries the hotel serves most, floated to the top of the list. */
export const PRIORITY_COUNTRY_CODES = ['TZ', 'KE', 'UG', 'RW', 'BI', 'ZM', 'MW', 'MZ', 'ZA']

/** Country preselected in the forms (the chain's home market). */
export const DEFAULT_COUNTRY_CODE = 'TZ'

// Memoised country list (built once, reused across all calls).
let countryCache = null
// Memoised city list per country code.
const cityCache = new Map()

/**
 * All countries as `{ code, name, phoneCode, flag }`, priority countries first
 * and everything else alphabetical.
 * @returns {Array<object>} The ordered list of countries.
 */
export function getCountries() {
  if (countryCache) return countryCache

  const all = Country.getAllCountries().map((country) => ({
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

  const raw = City.getCitiesOfCountry(countryCode) || []
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
    for (const state of State.getStatesOfCountry(countryCode) || []) {
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
 * captured still light up the city dropdown.
 * @param {string} name - Country name.
 * @returns {string} The matching ISO code, or ''.
 */
export function findCountryCode(name) {
  if (!name) return ''
  const match = getCountries().find((c) => c.name.toLowerCase() === String(name).toLowerCase())
  return match ? match.code : ''
}

/**
 * Resolves a country ISO code to its display name.
 * @param {string} code - ISO country code.
 * @returns {string} The country name, or ''.
 */
export function getCountryName(code) {
  if (!code) return ''
  const match = getCountries().find((c) => c.code === code)
  return match ? match.name : ''
}
