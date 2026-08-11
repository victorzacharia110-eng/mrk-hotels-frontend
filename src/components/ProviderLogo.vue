<template>
  <span class="provider-logo" :class="sizeClass" :style="tileStyle">
    <img v-if="info?.logo" :src="info.logo" :alt="label" class="provider-logo-img" />
    <span v-else class="provider-logo-fallback">{{ fallbackText }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PROVIDERS } from '@/utils/payments'

// Props: the provider key to render and the desired tile size class.
const props = defineProps({
  provider: { type: String, default: '' },
  size: { type: String, default: 'sm' },
})

const { t } = useI18n()

/** Provider metadata (logo/color) looked up from the shared payments config. */
const info = computed(() => PROVIDERS[props.provider] || null)
/** Localised provider name used for the image alt text and fallback initials. */
const label = computed(() => t(`paymentFields.providers.${props.provider}`))
/** Size modifier appended to the tile's CSS class. */
const sizeClass = computed(() => `provider-logo--${props.size}`)

/**
 * Background style for the tile: only applied when there is no logo, using
 * the provider's brand colour (or a neutral gray).
 *
 * @returns {object} Inline style object; empty when a logo image exists.
 */
const tileStyle = computed(() => {
  if (info.value?.logo) return {}
  return { background: (info.value?.color || '#e2e8f0') }
})

/**
 * Fallback initials for providers without a logo: up to two capitalised
 * letters taken from the localised name, or "?" for an empty provider.
 *
 * @returns {string} Initials or fallback character.
 */
const fallbackText = computed(() => {
  if (!props.provider) return '?'
  return label.value.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || props.provider[0].toUpperCase()
})
</script>

<style scoped>
.provider-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
  flex-shrink: 0;
}

.provider-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 2px;
}

.provider-logo-fallback {
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.5px;
  line-height: 1;
}

.provider-logo--sm {
  width: 22px;
  height: 22px;
}

.provider-logo--sm .provider-logo-fallback {
  font-size: 9px;
}

.provider-logo--md {
  width: 28px;
  height: 28px;
}

.provider-logo--md .provider-logo-fallback {
  font-size: 11px;
}

.provider-logo--lg {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.provider-logo--lg .provider-logo-fallback {
  font-size: 14px;
}
</style>
