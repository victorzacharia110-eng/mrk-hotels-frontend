<template>
  <div>
    <MarketingSections
      v-if="page"
      :page="page"
      :integrations="bootstrap?.integrations || []"
    />
    <section v-if="!page" class="mrk-section">
      <div class="mrk-container">
        <h1 class="mrk-page-title">Integrations</h1>
        <div v-if="grouped.length" style="margin-top:24px;">
          <div v-for="group in grouped" :key="group.category" class="mrk-integration-group">
            <h3>{{ group.category }}</h3>
            <div class="mrk-grid mrk-grid-3">
              <article v-for="item in group.items" :key="item.id || item.slug" class="mrk-card">
                <h3>{{ item.name }}</h3>
                <p>{{ item.description || 'No description available.' }}</p>
              </article>
            </div>
          </div>
        </div>
        <div v-else class="mrk-empty">No integrations available.</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMarketingContent } from '@/composables/useMarketingContent'
import MarketingSections from './MarketingSections.vue'

const { bootstrap, getPage } = useMarketingContent()
const page = computed(() => getPage('integrations'))

const grouped = computed(() => {
  const groups = new Map()
  for (const item of bootstrap.value?.integrations || []) {
    const key = item.category || 'Other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }))
})
</script>
