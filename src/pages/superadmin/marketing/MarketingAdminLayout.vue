<template>
  <div class="marketing-admin">
    <div class="page-head">
      <div>
        <h1>Marketing Site</h1>
        <p class="muted">Manage public marketing content, pricing, media and leads.</p>
      </div>
    </div>

    <div class="tabs card">
      <router-link v-for="tab in tabs" :key="tab.to" :to="tab.to" class="tab-link">{{ tab.label }}</router-link>
    </div>

    <div class="tab-body">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const basePath = computed(() => (
  route.path.startsWith('/owner') ? '/owner/marketing/content' : '/superadmin/marketing'
))
const tabs = computed(() => [
  { path: 'pages', label: 'Pages' },
  { path: 'sections', label: 'Sections' },
  { path: 'integrations', label: 'Integrations' },
  { path: 'faqs', label: 'FAQs' },
  { path: 'team', label: 'Team' },
  { path: 'pricing-products', label: 'Pricing Products' },
  { path: 'pricing-features', label: 'Pricing Features' },
  { path: 'pricing-plans', label: 'Pricing Plans' },
  { path: 'media', label: 'Media' },
  { path: 'settings', label: 'Settings' },
  { path: 'contact-submissions', label: 'Contact Submissions' },
].map((tab) => ({ ...tab, to: `${basePath.value}/${tab.path}` })))
</script>

<style scoped>
.page-head { margin-bottom: 16px; }
.page-head h1 { margin: 0; font-size: 28px; }
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  margin-bottom: 16px;
}
.tab-link {
  padding: 8px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
}
.tab-link.router-link-active {
  background: #005eb8;
  color: #fff;
}
.tab-body { min-width: 0; }
</style>
