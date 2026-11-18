<template>
  <div>
    <MarketingSections
      v-if="page"
      :page="page"
      :team-members="bootstrap?.team_members || []"
    />
    <div v-else class="mrk-section"><div class="mrk-container"><div class="mrk-empty">About content is unavailable.</div></div></div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMarketingContent } from '@/composables/useMarketingContent'
import MarketingSections from './MarketingSections.vue'

const { bootstrap, getPage } = useMarketingContent()
const page = computed(() => getPage('about'))
</script>
