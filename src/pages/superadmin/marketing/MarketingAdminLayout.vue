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
const tabs = [
  { to: '/superadmin/marketing/pages', label: 'Pages' },
  { to: '/superadmin/marketing/sections', label: 'Sections' },
  { to: '/superadmin/marketing/integrations', label: 'Integrations' },
  { to: '/superadmin/marketing/faqs', label: 'FAQs' },
  { to: '/superadmin/marketing/team', label: 'Team' },
  { to: '/superadmin/marketing/pricing-products', label: 'Pricing Products' },
  { to: '/superadmin/marketing/pricing-features', label: 'Pricing Features' },
  { to: '/superadmin/marketing/pricing-plans', label: 'Pricing Plans' },
  { to: '/superadmin/marketing/media', label: 'Media' },
  { to: '/superadmin/marketing/settings', label: 'Settings' },
  { to: '/superadmin/marketing/contact-submissions', label: 'Contact Submissions' },
]
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
