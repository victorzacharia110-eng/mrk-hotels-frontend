<!--
  CalendarInput — drop-in replacement for the native `<input type="date">`.

  A button-styled field showing the picked date (or a placeholder), which opens
  a small popover calendar: previous/next month arrows, a weekday header and a
  day grid. The selected day is emitted as `YYYY-MM-DD`, exactly like the native
  input, so it can replace those inputs without touching page logic. Disabled
  days honour the `min`/`max` range props.
-->

<template>
  <div ref="root" class="calwrap" :class="{ open, disabled }">
    <button
      type="button"
      class="cal-field"
      :class="{ 'has-value': !!modelValue, 'is-invalid': invalid }"
      :disabled="disabled"
      :title="modelValue ? formatDay(modelValue) : placeholder || ''"
      @click="toggle"
    >
      <i class="fas fa-calendar-day cal-icon"></i>
      <span class="cal-value">{{ modelValue ? formatDay(modelValue) : (placeholder || '') }}</span>
      <span v-if="clearable && modelValue" class="cal-clear" role="button" title="Clear" @click.stop="clear" @keydown.enter.prevent="clear" tabindex="0">×</span>
      <i class="fas fa-chevron-down cal-caret"></i>
    </button>

    <div v-if="open" class="cal-pop" :class="align === 'right' ? 'right' : 'left'">
      <div class="cal-head">
        <button type="button" class="cal-nav" :disabled="backDisabled" @click="shift(-1)"><i class="fas fa-chevron-left"></i></button>
        <div class="cal-title">{{ monthTitle }}</div>
        <button type="button" class="cal-nav" :disabled="fwdDisabled" @click="shift(1)"><i class="fas fa-chevron-right"></i></button>
      </div>
      <div class="cal-week">
        <span v-for="w in weekdays" :key="w">{{ w }}</span>
      </div>
      <div class="cal-grid">
        <span v-for="cell in cells" :key="cell.key" class="cal-cell" :class="cell.cls" @click="pick(cell.date)">
          {{ cell.label }}
        </span>
      </div>
      <div v-if="todayEnabled" class="cal-foot">
        <button type="button" class="cal-today" @click="pick(todayISO())">Today</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { todayISO } from '@/utils/dates'

const props = defineProps({
  /** Selected date, YYYY-MM-DD, '' when nothing chosen. Mirrors input[type=date]. */
  modelValue: { type: String, default: '' },
  /** Earliest selectable date (YYYY-MM-DD); empty means no floor. */
  min: { type: String, default: '' },
  /** Latest selectable date (YYYY-MM-DD); empty means no ceiling. */
  max: { type: String, default: '' },
  /** Show a × that clears the picked date. */
  clearable: { type: Boolean, default: true },
  /** Placeholder text when empty. */
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  /** Which side of the field the popover drops. */
  align: { type: String, default: 'left', validator: (v) => ['left', 'right'].includes(v) },
})

const emit = defineEmits(['update:modelValue', 'change'])

const { locale } = useI18n()
const root = ref(null)
const open = ref(false)

// The calendar month being browsed, as parts (year, 0-based month).
const viewYear = ref(todayYear())
const viewMonth = ref(todayMonth())

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onDocKey)
    if (props.modelValue) {
      const d = parseISO(props.modelValue)
      viewYear.value = d.getFullYear()
      viewMonth.value = d.getMonth()
    } else {
      viewYear.value = todayYear()
      viewMonth.value = todayMonth()
    }
  } else {
    document.removeEventListener('click', onDocClick)
    document.removeEventListener('keydown', onDocKey)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKey)
})

function parseISO(iso) {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function todayYear() {
  return new Date().getFullYear()
}

function todayMonth() {
  return new Date().getMonth()
}

/** Localisation-safe formatter: 'en' rejects unknown locales, fall back lazily. */
function makeFormatter(localeName, options) {
  try {
    return new Intl.DateTimeFormat(localeName, options)
  } catch {
    try {
      return new Intl.DateTimeFormat(localeName.split(/[-_]/)[0], options)
    } catch {
      return new Intl.DateTimeFormat('en', options)
    }
  }
}

const dayFormatter = computed(() => makeFormatter(locale.value, { weekday: 'short' }))
const monthFormatter = computed(() => makeFormatter(locale.value, { month: 'long', year: 'numeric' }))
const dateFormatter = computed(() => makeFormatter(locale.value, { day: '2-digit', month: 'short', year: 'numeric' }))

const weekdays = computed(() => {
  // Monday-first week: grab the weekday labels for a known week.
  const anchor = new Date(2024, 0, 1) // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + i)
    return dayFormatter.value.format(d)
  })
})

const monthTitle = computed(() => {
  const d = new Date(viewYear.value, viewMonth.value, 1)
  return monthFormatter.value.format(d)
})

/** Leading day-of-week blanks (Mon-first) + 1-based day numbers for the month. */
const cells = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7 // Monday-first offset
  const out = []
  const today = todayISO()

  for (let i = 0; i < lead; i++) {
    out.push({ key: `b${i}`, label: '', date: null, cls: ['cal-blank'] })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const cls = ['cal-day']
    if (iso === props.modelValue) cls.push('sel')
    if (iso === today) cls.push('today')
    if (disabledISO(iso)) cls.push('off')
    out.push({ key: iso, label: d, date: iso, cls })
  }

  // Pad the last row so the grid stays a stable height.
  while (out.length % 7 !== 0) out.push({ key: `t${out.length}`, label: '', date: null, cls: ['cal-blank'] })

  return out
})

/** A date is unselectable when it sits outside the min/max window. */
function disabledISO(iso) {
  if (props.min && iso < props.min) return true
  if (props.max && iso > props.max) return true
  return false
}

const backDisabled = computed(() => {
  const d = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}-01`
  return !!(props.min && d < props.min)
})

const fwdDisabled = computed(() => {
  const endOf = new Date(viewYear.value, viewMonth.value + 1, 0)
  const last = `${endOf.getFullYear()}-${String(endOf.getMonth() + 1).padStart(2, '0')}-${String(endOf.getDate()).padStart(2, '0')}`
  return !!(props.max && last > props.max)
})

/** True when the model value text is not a real date. */
const invalid = computed(() => !!props.modelValue && !parseISO(props.modelValue))

/** The Today shortcut is only offered when today falls inside the window. */
const todayEnabled = computed(() => {
  const t = todayISO()
  if (props.min && t < props.min) return false
  if (props.max && t > props.max) return false
  return true
})

function toggle() {
  if (props.disabled) return
  open.value = !open.value
}

function shift(delta) {
  const d = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
}

function pick(iso) {
  if (!iso) return
  if (disabledISO(iso)) return
  emit('update:modelValue', iso)
  emit('change')
  open.value = false
}

function clear() {
  emit('update:modelValue', '')
  emit('change')
}

function formatDay(iso) {
  const d = parseISO(iso)
  return d ? dateFormatter.value.format(d) : iso
}

function onDocClick(e) {
  if (root.value && !root.value.contains(e.target)) open.value = false
}

function onDocKey(e) {
  if (e.key === 'Escape') open.value = false
}
</script>

<style scoped>
.calwrap {
  position: relative;
  display: inline-block;
  min-width: 150px;
}

.cal-field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 1px solid #d7dee8;
  border-radius: 6px;
  background: #ffffff;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
  color: #1a1a2e;
  cursor: pointer;
  text-align: left;
}

.cal-field:hover { border-color: #8fa8c8; }
.cal-field.is-invalid { border-color: #c0392b; }

.calwrap.open .cal-field { border-color: #005eb8; box-shadow: 0 0 0 2px rgba(0, 94, 184, 0.15); }
.calwrap.disabled .cal-field { background: #f4f6f9; color: #9aa4b2; cursor: not-allowed; }

.cal-icon { color: #005eb8; font-size: 12px; }
.cal-value { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cal-clear { color: #9aa4b2; font-weight: bold; padding: 0 2px; }
.cal-clear:hover { color: #c0392b; }
.cal-caret { color: #9aa4b2; font-size: 10px; }

.cal-pop {
  position: absolute;
  top: calc(100% + 4px);
  z-index: 60;
  width: 248px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
  padding: 10px;
}
.cal-pop.left { left: 0; }
.cal-pop.right { right: 0; }

.cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.cal-title { font-weight: 600; font-size: 13px; text-transform: capitalize; color: #1a1a2e; }

.cal-nav {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
  font-size: 11px;
}
.cal-nav:hover { background: #f1f5f9; }
.cal-nav:disabled { opacity: 0.35; cursor: not-allowed; }

.cal-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 4px; }
.cal-week span {
  text-align: center;
  font-size: 10px;
  text-transform: uppercase;
  color: #64748b;
  padding: 4px 0;
}

.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cal-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  font-size: 12px;
  color: #1a1a2e;
  border-radius: 6px;
  cursor: pointer;
}
.cal-day:hover { background: #eaf2fb; }
.cal-day.sel { background: #005eb8; color: #ffffff; font-weight: 600; }
.cal-day.today { outline: 1px solid #005eb8; }
.cal-day.off { color: #c3ccd6; background: transparent; cursor: not-allowed; }
.cal-blank { cursor: default; }

.cal-foot { border-top: 1px solid #f1f5f9; margin-top: 8px; padding-top: 8px; text-align: center; }
.cal-today {
  border: none;
  background: none;
  color: #005eb8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.cal-today:hover { text-decoration: underline; }
</style>