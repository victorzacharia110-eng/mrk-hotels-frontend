<!--
  SearchableSelect — custom dropdown replacement for <select>.
  Live-searches large option sets, positions its panel with `position: fixed`
  (flipping above the trigger near the viewport bottom), offers an `option`
  slot for custom rows, and keeps a hidden native <select> so HTML5 form
  validation (required) still runs.
-->

<template>
  <div class="ss" ref="rootEl">
    <!-- Trigger button showing the current selection (or the placeholder). -->
    <button
      type="button"
      class="ss-trigger"
      :class="{ 'is-empty': !selectedLabel, 'is-disabled': disabled }"
      :disabled="disabled"
      :aria-haspopup="'listbox'"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="ss-trigger-label">{{ selectedLabel || placeholder }}</span>
    </button>

    <!-- Dropdown panel: search box, loading/empty states and the option list. -->
    <div v-if="open" class="ss-panel" role="listbox" :style="panelStyle">
      <input
        v-if="showSearch"
        v-model="query"
        type="search"
        class="input ss-search"
        :placeholder="resolvedSearchPlaceholder"
        autocomplete="off"
        @keydown.esc="close"
        @input="onSearchInput"
      />
      <ul class="ss-list">
        <li
          v-if="emptyLabel !== null && emptyLabel !== undefined"
          class="ss-option"
          :class="{ 'is-active': !modelValue }"
          @click="pick('')"
        >
          {{ emptyLabel }}
        </li>
        <li v-if="searching" class="ss-option ss-muted">
          <i class="fas fa-spinner fa-spin" /> {{ resolvedLoadingLabel }}
        </li>
        <li
          v-for="o in filteredOptions"
          v-else
          :key="o.value"
          class="ss-option"
          :class="{ 'is-active': String(modelValue) === String(o.value) }"
          @click="pick(o.value)"
        >
          <slot name="option" :option="o" :active="String(modelValue) === String(o.value)">
            {{ o.label }}
          </slot>
        </li>
        <li v-if="!searching && !filteredOptions.length" class="ss-option ss-muted">
          {{ resolvedNoResultsLabel }}
        </li>
      </ul>
    </div>

    <!--
      Invisible twin select so HTML5 constraint validation (e.g. `required`)
      still runs when this control sits inside a <form>.
    -->
    <select
      class="ss-native"
      tabindex="-1"
      aria-hidden="true"
      :required="required"
      :disabled="disabled"
      :value="modelValue"
      @change="pick($event.target.value)"
    >
      <option v-for="o in options" :key="o.value" :value="o.value" />
    </select>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

// Props: the bound value, options, and a set of presentation/label
// overrides plus form flags. Emits model updates, change and search events.
const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  options: { type: Array, default: () => [] },
  emptyLabel: { type: String, default: null },
  placeholder: { type: String, default: '' },
  searchPlaceholder: { type: String, default: '' },
  loadingLabel: { type: String, default: '' },
  noResultsLabel: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  searchable: { type: Boolean, default: true },
  forceSearch: { type: Boolean, default: false },
  searching: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change', 'search'])

const { t } = useI18n()

// Dropdown UI state: root element ref, open flag, search query and the
// fixed-position panel geometry (anchored to the trigger).
const rootEl = ref(null)
const open = ref(false)
const query = ref('')
const panelStyle = ref({ top: '0px', left: '0px', width: '200px' })

// Fall back to generic i18n labels when the caller does not supply one.
const resolvedSearchPlaceholder = computed(() => props.searchPlaceholder || t('common.search'))
const resolvedLoadingLabel = computed(() => props.loadingLabel || t('common.loading'))
const resolvedNoResultsLabel = computed(() => props.noResultsLabel || t('common.noResults'))

// A tiny list does not need a search box, unless the caller forces one.
const showSearch = computed(() => props.searchable && (props.options.length > 7 || props.forceSearch))

// Cap the initial render so huge option sets (e.g. all cities) stay fast;
// typing a query narrows the list to actual matches.
const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options.slice(0, 100)
  return props.options
    .filter((o) => String(o.label || '').toLowerCase().includes(q))
    .slice(0, 200)
})

/**
 * The label currently shown on the trigger button: the matching option's
 * label, the empty label when nothing is selected, or a blank string.
 *
 * @returns {string} Displayed trigger label.
 */
const selectedLabel = computed(() => {
  const found = props.options.find((o) => String(o.value) === String(props.modelValue))
  if (found) return found.label
  if (!props.modelValue && props.emptyLabel) return props.emptyLabel
  return ''
})

/**
 * Toggles the dropdown between open and closed based on its current state.
 */
function toggle() {
  if (open.value) {
    close()
  } else {
    openPanel()
  }
}

// The panel is positioned with `position: fixed` so it is never clipped by an
// ancestor with `overflow: hidden` (e.g. `.card`). Anchor it to the trigger.
const PANEL_HEIGHT = 250
/**
 * Positions the fixed-position panel just below the trigger, flipping it
 * above when there is not enough room at the bottom of the viewport.
 */
function positionPanel() {
  const trigger = rootEl.value?.querySelector('.ss-trigger')
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  let top = rect.bottom + 4
  if (top + PANEL_HEIGHT > window.innerHeight && rect.top > PANEL_HEIGHT) {
    top = rect.top - PANEL_HEIGHT - 4
  }
  panelStyle.value = {
    top: `${top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  }
}

/**
 * Re-anchors the open panel when the page scrolls or the window resizes.
 */
function onViewportChange() {
  if (open.value) positionPanel()
}

/**
 * Emits the current query so the parent can run remote searches.
 */
function onSearchInput() {
  emit('search', query.value)
}

/**
 * Opens the dropdown: resets the query, positions the panel and focuses the
 * search field on the next frame.
 */
function openPanel() {
  open.value = true
  query.value = ''
  emit('search', '')
  positionPanel()
  requestAnimationFrame(() => rootEl.value?.querySelector('.ss-search')?.focus())
}

/** Closes the dropdown. */
function close() {
  open.value = false
}

/**
 * Selects an option: emits the model update and change events (unless
 * disabled) and closes the dropdown.
 *
 * @param {string|number|boolean} value - Value of the chosen option.
 */
function pick(value) {
  if (props.disabled) return
  emit('update:modelValue', value)
  emit('change', value)
  close()
}

/**
 * Closes the dropdown when a click lands outside the component.
 *
 * @param {MouseEvent} event - The captured mousedown event.
 */
function onDocumentClick(event) {
  if (open.value && rootEl.value && !rootEl.value.contains(event.target)) close()
}

// A model change from the parent collapses the dropdown.
watch(
  () => props.modelValue,
  () => {
    if (open.value) close()
  },
)

/** Registers the document/scroll/resize listeners used by the dropdown. */
onMounted(() => {
  document.addEventListener('mousedown', onDocumentClick)
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
})
/** Removes the document/scroll/resize listeners on teardown. */
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>

<style scoped>
.ss {
  position: relative;
}

.ss-trigger {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  font: inherit;
  font-size: 14px;
  text-align: left;
  color: #1c2733;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ss-trigger:hover {
  border-color: #005eb8;
}

.ss-trigger:focus {
  outline: none;
  border-color: #005eb8;
  box-shadow: 0 0 0 3px rgba(0, 94, 184, 0.15);
}

.ss-trigger.is-empty {
  color: #888;
}

.ss-trigger.is-disabled {
  background: #f2f2f2;
  color: #aaa;
  cursor: not-allowed;
}

.ss-trigger::after {
  content: '';
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-right: 2px solid #666;
  border-bottom: 2px solid #666;
  transform: translateY(-2px) rotate(45deg);
  pointer-events: none;
}

.ss-panel {
  position: fixed;
  z-index: 1000;
  padding: 8px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}

.ss-search {
  margin-bottom: 8px;
}

.ss-list {
  max-height: 220px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
}

.ss-option {
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.ss-option:hover,
.ss-option.is-active {
  background: #f2f6fa;
}

.ss-option.ss-muted {
  color: #888;
  cursor: default;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ss-native {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  border: 0;
  padding: 0;
}
</style>
