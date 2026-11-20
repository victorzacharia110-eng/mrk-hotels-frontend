<template>
  <div>
    <div v-if="loading" class="mrk-section"><div class="mrk-container"><div class="mrk-empty">{{ $t('marketingCopy.loadingPage') }}</div></div></div>
    <div v-else-if="notFound" class="mrk-section"><div class="mrk-container"><div class="mrk-empty">{{ $t('marketingCopy.pageNotAvailable') }}</div></div></div>
    <MarketingSections v-else :page="page" :integrations="bootstrap?.integrations || []" :team-members="bootstrap?.team_members || []" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { localizeMarketingPage, useMarketingContent } from '@/composables/useMarketingContent'
import { publicMarketingApi } from '@/api'
import MarketingSections from './MarketingSections.vue'

const route = useRoute()
const router = useRouter()
const { bootstrap, loadBootstrap } = useMarketingContent()

const page = ref(null)
const loading = ref(false)
const notFound = ref(false)

function handleBookingRedirect(p) {
  const section = (p?.sections || []).find((s) => s.section_type === 'booking' && s.is_active !== false)
  const url = section?.body_json?.url
  if (url) {
    router.replace(url)
    return true
  }
  return false
}

async function load() {
  loading.value = true
  notFound.value = false
  page.value = null
  const slug = route.params.slug
  try {
    await loadBootstrap().catch(() => {})
    const fromBootstrap = bootstrap.value?.pages?.find((p) => p.slug === slug)
    if (fromBootstrap) {
      if (!handleBookingRedirect(fromBootstrap)) page.value = fromBootstrap
      return
    }
    const res = await publicMarketingApi.page(slug)
    const p = res.data?.page
    if (!p) {
      notFound.value = true
      return
    }
    if (!handleBookingRedirect(p)) page.value = localizeMarketingPage(p)
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

watch(() => route.params.slug, load, { immediate: true })
</script>
