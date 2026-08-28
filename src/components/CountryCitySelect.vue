<!--
  CountryCitySelect — cascading country and city pickers for booking/guest
  forms. The parent owns three values: the ISO code (drives the city list),
  the country name (stored by the API) and the city name. The city is a free
  input with a datalist by default, or a full dropdown via `cityAsDropdown`.
-->

<template>
  <!-- Country -->
  <div class="form-group">
    <label :for="`${uid}-country`">
      {{ $t('location.country') }}<span v-if="required" class="req">*</span>
    </label>
    <SearchableSelect
      :id="`${uid}-country`"
      :model-value="countryCode"
      :options="countryOptions"
      :empty-label="$t('location.selectCountry')"
      :required="required"
      :disabled="disabled"
      @update:model-value="onCountryChange"
    />
  </div>

  <!-- City: by default a datalist keeps a 20k-city country usable by letting -->
  <!-- the receptionist type while still offering the full list on click. For -->
  <!-- guest-facing forms a true dropdown with every city is preferred.      -->
  <div class="form-group">
    <label :for="`${uid}-city`">
      {{ $t('location.city') }}<span v-if="required" class="req">*</span>
    </label>
    <SearchableSelect
      v-if="cityAsDropdown"
      :id="`${uid}-city`"
      :model-value="city"
      :options="cityOptions"
      :empty-label="$t('location.selectCity')"
      :required="required"
      :disabled="disabled || !countryCode"
      @update:model-value="$emit('update:city', $event)"
    />
    <input
      v-else
      :id="`${uid}-city`"
      class="input"
      :list="`${uid}-cities`"
      :value="city"
      :placeholder="cityPlaceholder"
      :required="required"
      :disabled="disabled || !countryCode"
      autocomplete="off"
      @input="$emit('update:city', $event.target.value)"
    />
    <datalist v-if="!cityAsDropdown" :id="`${uid}-cities`">
      <option v-for="name in cities" :key="name" :value="name" />
    </datalist>
    <small v-if="!countryCode" class="hint muted">{{ $t('location.pickCountryFirst') }}</small>
    <small v-else-if="cities.length" class="hint muted">
      {{ $t('location.cityCount', { count: cities.length }) }}
    </small>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  findCountryCode,
  getCities,
  getCountries,
  getCountryName,
  loadLocationData,
  PRIORITY_COUNTRY_CODES,
} from '@/utils/locations'
import SearchableSelect from '@/components/SearchableSelect.vue'

/**
 * Cascading country and city pickers.
 *
 * The parent owns three values: the ISO code (used to look cities up), the
 * country name (what the API stores) and the city name.
 */
const props = defineProps({
  countryCode: { type: String, default: '' },
  country: { type: String, default: '' },
  city: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  cityAsDropdown: { type: Boolean, default: false },
})

// v-model updates for the parent's countryCode, country name and city values.
const emit = defineEmits(['update:countryCode', 'update:country', 'update:city'])

const { t } = useI18n()

// Scopes the label/datalist ids so several instances can coexist on a page.
const uid = `loc-${Math.random().toString(36).slice(2, 8)}`

// Country and city option lists loaded from the shared locations data.
const countries = ref([])
const cities = ref([])

// Option lists: countries are sorted with priority codes first, cities are
// plain name/value pairs; the placeholder reflects whether a country is set.
const priorityCodes = new Set(PRIORITY_COUNTRY_CODES)
const countryOptions = computed(() => {
  const priority = countries.value.filter((c) => priorityCodes.has(c.code))
  const other = countries.value.filter((c) => !priorityCodes.has(c.code))
  return [...priority, ...other].map((c) => ({ value: c.code, label: c.name }))
})
const cityOptions = computed(() => cities.value.map((name) => ({ value: name, label: name })))

const cityPlaceholder = computed(() =>
  props.countryCode ? t('location.cityPlaceholder') : t('location.pickCountryFirst'),
)

/**
 * Fetches the cities for a country ISO code into the options list.
 *
 * @param {string} code - Country ISO code, or empty to clear the list.
 */
function loadCities(code) {
  cities.value = code ? getCities(code) : []
}

/**
 * Handles a country selection: propagates the ISO code and name, clears any
 * city that belonged to the old country, and reloads the city options.
 *
 * @param {string} code - Newly selected country ISO code.
 */
function onCountryChange(code) {
  emit('update:countryCode', code)
  emit('update:country', getCountryName(code))
  // The old city belongs to the old country, so clear it.
  emit('update:city', '')
  loadCities(code)
}

/**
 * Bootstraps the component: loads the country list and, when editing a record
 * saved without an ISO code, resolves the country name so the city dropdown
 * still populates. The ~8MB location dataset is fetched lazily here.
 */
onMounted(async () => {
  await loadLocationData()

  countries.value = getCountries()

  // Records saved before the ISO code was captured only carry a country name;
  // resolve it so the city dropdown still populates when editing them.
  if (!props.countryCode && props.country) {
    const resolved = findCountryCode(props.country)
    if (resolved) emit('update:countryCode', resolved)
  }

  loadCities(props.countryCode || findCountryCode(props.country))
})

// Keep the city list in step when the parent resets or pre-fills the form.
watch(
  () => props.countryCode,
  (code) => loadCities(code),
)
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
