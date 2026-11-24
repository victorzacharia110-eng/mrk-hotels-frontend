<template>
  <div>
    <MarketingSections
      v-if="page"
      :page="page"
      :integrations="bootstrap?.integrations || []"
      :team-members="bootstrap?.team_members || []"
      enable-hero-scene
    />
    <div v-else class="mrk-section"><div class="mrk-container"><div class="mrk-empty">{{ $t('marketingCopy.homeUnavailable') }}</div></div></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMarketingContent } from '@/composables/useMarketingContent'
import MarketingSections from './MarketingSections.vue'

const { bootstrap, getPage } = useMarketingContent()
const page = computed(() => getPage('home'))
</script>
