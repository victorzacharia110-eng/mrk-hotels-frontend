<!--
  PhoneInput — phone number field with a searchable country picker.
  Emits the live-formatted number and the selected ISO country code; changing
  the country re-formats the typed digits under the new dialling conventions.
-->

<template>
  <div class="phone-input">
    <!-- Country/dial-code picker. -->
    <SearchableSelect
      class="country-select"
      :model-value="countryCode"
      :options="countryOptions"
      searchable
      @update:model-value="onCountryChange"
    />
    <!-- Number field, formatted live as the user types. -->
    <input
      class="input number-input"
      type="tel"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      @input="onPhoneInput($event.target.value)"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { formatIncompletePhoneNumber } from 'libphonenumber-js'
import { getCountries } from '@/utils/locations'
import { formatPhoneInput } from '@/utils/phone'
import SearchableSelect from '@/components/SearchableSelect.vue'

/**
 * Phone field with a searchable country/country-code dropdown and space
 * formatting that follows the selected country's dialling conventions.
 *
 * The parent owns two values: the ISO code (sent to the API as country_code)
 * and the formatted number itself.
 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  countryCode: { type: String, default: 'TZ' },
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

// v-model updates for the formatted phone number and the selected country code.
const emit = defineEmits(['update:modelValue', 'update:countryCode'])

// Country dropdown options built from the shared locations list, combining
// the flag, name and dialling code in each label.
const countries = ref([])

const countryOptions = computed(() =>
  countries.value.map((c) => ({ value: c.code, label: `${c.flag} ${c.name} (+${c.phoneCode})` })),
)

/**
 * Resolves the dialling code for a country ISO code.
 *
 * @param {string} code - Country ISO code.
 * @returns {string|undefined} The country's phone code, or undefined.
 */
function countryDial(code) {
  return countries.value.find((c) => c.code === code)?.phoneCode
}

/**
 * Reacts to typing in the number field, emitting a value formatted for the
 * currently selected country's dialling conventions.
 *
 * @param {string} value - Raw input from the phone field.
 */
function onPhoneInput(value) {
  emit('update:modelValue', formatPhoneInput(value, props.countryCode))
}

/**
 * Reacts to a country change: strips the previous country's dialling code
 * from the typed digits (if present) and reformats the remainder using the
 * newly selected country's conventions.
 *
 * @param {string} code - Newly selected country ISO code.
 */
function onCountryChange(code) {
  const digits = String(props.modelValue || '').replace(/\D/g, '')
  const oldDial = countryDial(props.countryCode)
  const withoutDial = oldDial && digits.startsWith(oldDial) ? digits.slice(String(oldDial).length) : digits

  emit('update:countryCode', code)
  emit('update:modelValue', withoutDial ? formatIncompletePhoneNumber(withoutDial, code) : '')
}

/** Loads the country list once the component mounts. */
onMounted(() => {
  countries.value = getCountries()
})
</script>

<style scoped>
.phone-input {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.country-select {
  width: 100%;
}

.number-input {
  width: 100%;
}
</style>
