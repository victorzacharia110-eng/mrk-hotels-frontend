<template>
  <div>
    <section v-if="page" class="mrk-hero">
      <div class="mrk-container">
        <div v-if="heroSection?.subheading" class="mrk-eyebrow">{{ heroSection.subheading }}</div>
        <h1 class="mrk-page-title">{{ heroSection?.heading || page.title }}</h1>
        <p v-if="heroBody" class="mrk-lead">{{ heroBody }}</p>
      </div>
    </section>

    <MarketingSections v-if="page" :page="pageWithoutHero" :integrations="bootstrap?.integrations || []" />

    <section v-if="!page" class="mrk-section">
      <div class="mrk-container">
        <h1 class="mrk-page-title">Pricing</h1>
        <PricingExplorer />
      </div>
    </section>
    <section v-else-if="!hasPricingSection" class="mrk-section mrk-section-alt">
      <div class="mrk-container">
        <PricingExplorer />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMarketingContent } from '@/composables/useMarketingContent'
import MarketingSections from './MarketingSections.vue'
import PricingExplorer from './PricingExplorer.vue'

const { bootstrap, getPage } = useMarketingContent()
const page = computed(() => getPage('pricing'))

const sections = computed(() => (page.value?.sections || []).filter((s) => s && s.is_active !== false))
const heroSection = computed(() => sections.value.find((s) => s.section_type === 'hero'))
const heroBody = computed(() => {
  const body = heroSection.value?.body_json
  return body && typeof body.body === 'string' ? body.body : ''
})
const hasPricingSection = computed(() => sections.value.some((s) => s.section_type === 'pricing'))
const pageWithoutHero = computed(() => {
  if (!page.value) return null
  return {
    ...page.value,
    sections: sections.value.filter((s) => s.section_type !== 'hero'),
  }
})
</script>
