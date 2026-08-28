/**
 * useHoliday.js
 *
 * Google-Doodle-style holiday detection for the MRK Hotels logo. Returns the
 * holiday active today (or null), with the emoji set and animation mode the
 * logo should use. Covers Tanzanian public holidays, fixed worldwide
 * favourites and variable/lunar events (Easter, Eid, World Cup).
 *
 * Modes:
 *   float    — emojis gently bobbing around the logo
 *   fall     — emojis drifting down across the logo (e.g. Christmas snow)
 *   confetti — confetti pieces raining over the logo (celebratory days)
 */

import { computed, ref } from 'vue'

/** Date key as YYYY-MM-DD in local time. */
function dateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Anonymous Gregorian algorithm: Easter Sunday for the given year. */
function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

// Approximate lunar dates for Eid (visible-day estimates, ±1 day tolerated).
const EID_FITR = {
  2025: '2025-03-30',
  2026: '2026-03-20',
  2027: '2027-03-09',
  2028: '2028-02-26',
  2029: '2029-02-14',
  2030: '2030-02-03',
}
const EID_ADHA = {
  2025: '2025-06-06',
  2026: '2026-05-27',
  2027: '2027-05-16',
  2028: '2028-05-05',
  2029: '2029-04-24',
  2030: '2030-04-13',
}

// World Cup windows. FIFA moved off the divisible-by-4 cycle (Qatar 2022 was
// a winter tournament), so explicit windows override the generic rule, which
// targets the even-but-not-divisible-by-4 years (1998…2026, 2030…).
const WORLD_CUPS = [
  { year: 2022, start: { month: 10, day: 21 }, end: { month: 11, day: 18 } }, // Qatar (winter edition)
]
const WORLD_CUP_SUMMER = { start: { month: 5, day: 11 }, end: { month: 6, day: 19 } }

function isWorldCupSeason(date) {
  const year = date.getFullYear()
  const explicit = WORLD_CUPS.find((w) => w.year === year)
  if (explicit) {
    const start = new Date(year, explicit.start.month, explicit.start.day)
    const end = new Date(year, explicit.end.month, explicit.end.day)
    return date >= start && date <= end
  }
  if (year % 4 !== 2) return false
  const start = new Date(year, WORLD_CUP_SUMMER.start.month, WORLD_CUP_SUMMER.start.day)
  const end = new Date(year, WORLD_CUP_SUMMER.end.month, WORLD_CUP_SUMMER.end.day)
  return date >= start && date <= end
}

/** Fixed-date holidays: id, name, month (0-based), day, emojis, mode. */
const FIXED = [
  { id: 'new_year', name: 'New Year', month: 0, day: 1, emojis: ['🎉', '🥂', '🎆', '✨'], mode: 'confetti' },
  { id: 'zanzibar_revolution', name: 'Zanzibar Revolution Day', month: 0, day: 12, emojis: ['🇹🇿', '🎉', '🎊'], mode: 'confetti' },
  { id: 'valentines', name: "Valentine's Day", month: 1, day: 14, emojis: ['❤️', '💝', '🌹', '💌'], mode: 'float' },
  { id: 'womens_day', name: "International Women's Day", month: 2, day: 8, emojis: ['🌸', '🌷', '👩', '💐'], mode: 'float' },
  { id: 'union_day', name: 'Union Day (Tanzania)', month: 3, day: 26, emojis: ['🇹🇿', '🎊', '🎉'], mode: 'confetti' },
  { id: 'labor_day', name: "Labour Day", month: 4, day: 1, emojis: ['🛠️', '👷', '🔧'], mode: 'float' },
  { id: 'nane_nane', name: 'Nane Nane Farmers’ Day', month: 7, day: 8, emojis: ['🌾', '🚜', '🌽'], mode: 'float' },
  { id: 'teachers_day', name: 'World Teachers’ Day', month: 9, day: 5, emojis: ['📚', '🍎', '✏️'], mode: 'float' },
  { id: 'halloween', name: 'Halloween', month: 9, day: 31, emojis: ['🎃', '👻', '🦇', '🕷️'], mode: 'float' },
  { id: 'uhuru', name: 'Independence Day (Tanzania)', month: 11, day: 9, emojis: ['🇹🇿', '🎊', '🎉'], mode: 'confetti' },
  { id: 'christmas_eve', name: 'Christmas Eve', month: 11, day: 24, emojis: ['🎄', '❄️', '🎁', '⭐'], mode: 'fall' },
  { id: 'christmas', name: 'Christmas', month: 11, day: 25, emojis: ['🎄', '❄️', '🎁', '⛄', '🎅'], mode: 'fall' },
  { id: 'boxing_day', name: 'Boxing Day', month: 11, day: 26, emojis: ['🎁', '🎄', '❄️'], mode: 'fall' },
  { id: 'new_year_eve', name: "New Year's Eve", month: 11, day: 31, emojis: ['🎆', '🥂', '🕛', '✨'], mode: 'confetti' },
]

function fixedMatches(h, date) {
  return date.getMonth() === h.month && date.getDate() === h.day
}

/** Returns the active holiday for a date, or null when none applies. */
export function getHoliday(date = new Date()) {
  const year = date.getFullYear()
  const key = dateKey(date)

  for (const h of FIXED) {
    if (fixedMatches(h, date)) return h
  }

  if (isWorldCupSeason(date)) {
    return { id: 'world_cup', name: `FIFA World Cup ${year}`, emojis: ['⚽', '🏆', '🌍', '🥅'], mode: 'float' }
  }

  // Eid days: tolerate a one-day drift around the estimated date.
  for (const [table, holiday] of [
    [EID_FITR, { id: 'eid_fitr', name: 'Eid al-Fitr', emojis: ['🌙', '✨', '🕌', '🎁'], mode: 'float' }],
    [EID_ADHA, { id: 'eid_adha', name: 'Eid al-Adha', emojis: ['🌙', '✨', '🕌'], mode: 'float' }],
  ]) {
    const estimated = table[year]
    if (!estimated) continue
    const est = new Date(`${estimated}T12:00:00`)
    const drift = Math.round((date - est) / 86400000)
    if (drift >= -1 && drift <= 1) return holiday
  }

  // Easter Sunday and Good Friday (two days earlier).
  const easter = easterSunday(year)
  for (const [offset, holiday] of [
    [0, { id: 'easter', name: 'Easter Sunday', emojis: ['🐣', '🐰', '🌸', '🥚'], mode: 'float' }],
    [-2, { id: 'good_friday', name: 'Good Friday', emojis: ['🥚', '🌸'], mode: 'float' }],
  ]) {
    const candidate = new Date(easter)
    candidate.setDate(candidate.getDate() + offset)
    if (dateKey(candidate) === key) return holiday
  }

  return null
}

/**
 * Reactive holiday for the current date.
 * @returns {{ holiday: import('vue').ComputedRef<object|null> }}
 */
export function useHoliday() {
  const now = ref(new Date())
  const holiday = computed(() => getHoliday(now.value))
  return { holiday, now }
}
