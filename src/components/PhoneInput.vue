<!--
  PhoneInput — phone number field with a searchable country picker.
  Emits the live-formatted number and the selected ISO country code; changing
  the country re-formats the typed digits under the new dialling conventions.

  Strict by design: letters and special characters are never accepted (only a
  leading '+' and digits survive), and the field refuses to grow beyond the
  selected country's maximum length. An invalid-but-possible number surfaces a
  message on blur; over-length input is truncated at the cap.
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
      :class="{ 'number-invalid': invalidMsg || error }"
      type="tel"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      @input="onPhoneInput($event.target.value)"
      @blur="onBlur"
    />
    <span v-if="invalidMsg || error" class="phone-invalid" role="alert">
      <i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ invalidMsg || error }}
    </span>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatIncompletePhoneNumber } from 'libphonenumber-js'
import { getCountries, loadLocationData } from '@/utils/locations'
import { capPhoneInput, formatPhoneInput, validatePhoneNumber } from '@/utils/phone'
import SearchableSelect from '@/components/SearchableSelect.vue'

/**
 * Phone field with a searchable country/country-code dropdown, space
 * formatting that follows the selected country's dialling conventions, and
 * strict length/character gating per that country.
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
  error: { type: String, default: '' },
})

// v-model updates for the formatted phone number and the selected country code.
const emit = defineEmits(['update:modelValue', 'update:countryCode'])

const { t } = useI18n()

// Country dropdown options built from the shared locations list, combining
// the flag, name and dialling code in each label.
const countries = ref([])

const invalidMsg = ref('')

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
 * Reacts to typing in the number field: sanitizes to '+' and digits, hard-caps
 * the length the selected country's dialling plan allows, then emits the value
 * formatted for that country.
 *
 * @param {string} value - Raw input from the phone field.
 */
function onPhoneInput(value) {
  invalidMsg.value = ''
  const capped = capPhoneInput(value, props.countryCode)
  emit('update:modelValue', formatPhoneInput(capped, props.countryCode))
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

/**
 * Validates the entered number against the selected country's dialling plan
 * when the field loses focus, surfacing a message for impossible or
 * over-length input.
 */
function onBlur() {
  const res = validatePhoneNumber(props.modelValue, props.countryCode)
  if (res.valid || res.possible) {
    invalidMsg.value = ''
  } else {
    invalidMsg.value =
      res.reason === 'too_long' ? t('validations.phoneTooLong') : t('validations.phoneInvalid')
  }
}

/** Loads the country list once the component mounts (dataset fetched lazily). */
onMounted(async () => {
  await loadLocationData()
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

.number-invalid {
  border-color: #dc2626;
}

.phone-invalid {
  color: #dc2626;
  font-size: 11.5px;
  line-height: 1.3;
  display: flex;
  align-items: flex-start;
  gap: 5px;
}

.phone-invalid i {
  margin-top: 1px;
}
</style>