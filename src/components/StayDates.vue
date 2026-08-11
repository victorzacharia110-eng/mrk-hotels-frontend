<template>
  <div class="form-group">
    <label :for="`${uid}-arrival`">
      {{ $t('stay.arrivalDate') }}<span class="req">*</span>
    </label>
    <input
      :id="`${uid}-arrival`"
      type="date"
      class="input"
      :value="arrival"
      :min="minDate"
      required
      :disabled="disabled"
      @change="onArrivalChange($event.target.value)"
    />
  </div>

  <!-- Typing a number of days recalculates the departure date. -->
  <div class="form-group">
    <label :for="`${uid}-days`">{{ $t('stay.numDays') }}</label>
    <input
      :id="`${uid}-days`"
      type="number"
      class="input"
      min="1"
      max="365"
      step="1"
      :value="days"
      :placeholder="$t('stay.numDaysPlaceholder')"
      :disabled="disabled || !arrival"
      @input="onDaysInput($event.target.value)"
    />
    <small class="hint muted">{{ $t('stay.numDaysHint') }}</small>
  </div>

  <!-- Editing the departure date recalculates the number of days. -->
  <div class="form-group">
    <label :for="`${uid}-departure`">
      {{ $t('stay.departureDate') }}<span class="req">*</span>
    </label>
    <input
      :id="`${uid}-departure`"
      type="date"
      class="input"
      :value="departure"
      :min="minDeparture"
      required
      :disabled="disabled || !arrival"
      @change="onDepartureChange($event.target.value)"
    />
    <small v-if="summary" class="hint muted">{{ summary }}</small>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { addDays, daysBetween, todayISO } from '@/utils/dates'

/**
 * The arrival / length-of-stay / departure triangle.
 *
 * Any two of the three imply the third. Entering a day count fills in the
 * departure date, and picking a departure date fills in the day count, so the
 * receptionist can work whichever way the guest talks.
 */
const props = defineProps({
  arrival: { type: String, default: '' },
  departure: { type: String, default: '' },
  days: { type: [Number, String], default: '' },
  disabled: { type: Boolean, default: false },
  /** Blocks past dates. Public guests cannot book yesterday; staff can backdate. */
  allowPast: { type: Boolean, default: false },
})

const emit = defineEmits(['update:arrival', 'update:departure', 'update:days'])

const { t } = useI18n()
const uid = `stay-${Math.random().toString(36).slice(2, 8)}`

// Derived constraints and summary: the earliest bookable arrival date and the
// minimum allowed departure date (the day after arrival).
const minDate = computed(() => (props.allowPast ? '' : todayISO()))

// Departure must be at least the day after arrival.
const minDeparture = computed(() => (props.arrival ? addDays(props.arrival, 1) : minDate.value))

/** Localised one-line summary of the stay length once all fields are set. */
const summary = computed(() => {
  const nights = Number(props.days)
  if (!props.arrival || !props.departure || !nights) return ''
  return t('stay.summary', { count: nights })
})

/**
 * Handles an arrival-date change: slides the departure date to preserve the
 * already-entered night count, or derives it from the current dates when the
 * stay length has not been stated.
 *
 * @param {string} value - New arrival date in ISO format.
 */
function onArrivalChange(value) {
  emit('update:arrival', value)
  if (!value) return

  const nights = Number(props.days)

  // Keep the stay length the guest already stated and slide the departure date.
  if (nights >= 1) {
    emit('update:departure', addDays(value, nights))
    return
  }

  // Otherwise push the departure date out if it is now on or before arrival.
  if (!props.departure || props.departure <= value) {
    emit('update:departure', addDays(value, 1))
    emit('update:days', 1)
  } else {
    emit('update:days', daysBetween(value, props.departure))
  }
}

/**
 * Handles typing a number of nights: propagates the value and, when an
 * arrival date is set, recalculates the departure date accordingly.
 *
 * @param {string} value - Raw input from the days field.
 */
function onDaysInput(value) {
  const nights = Number(value)

  if (!value) {
    emit('update:days', '')
    return
  }

  emit('update:days', nights)

  if (props.arrival && nights >= 1) {
    emit('update:departure', addDays(props.arrival, nights))
  }
}

/**
 * Handles a departure-date change: when an arrival date is set, derives the
 * number of nights from the difference between the two dates.
 *
 * @param {string} value - New departure date in ISO format.
 */
function onDepartureChange(value) {
  emit('update:departure', value)
  if (props.arrival && value) {
    emit('update:days', daysBetween(props.arrival, value))
  }
}
</script>

<style scoped>
.req {
  color: #c0392b;
  margin-left: 2px;
}

.hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}
</style>
