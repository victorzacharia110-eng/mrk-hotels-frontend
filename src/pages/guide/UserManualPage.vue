<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1><i class="fas fa-book-open" aria-hidden="true"></i> {{ $t('userManual.title') }}</h1>
        <p class="muted">{{ $t('userManual.subtitle') }}</p>
      </div>
    </div>

    <div class="guide-grid">
      <router-link
        v-for="section in sections"
        :key="section.to"
        :to="section.to"
        class="guide-card"
        :data-guide="section.key"
      >
        <span class="guide-card-icon"><i :class="section.icon" aria-hidden="true"></i></span>
        <div class="guide-card-body">
          <strong>{{ section.title }}</strong>
          <p class="muted">{{ section.desc }}</p>
        </div>
        <span class="guide-card-open">{{ $t('userManual.open') }} <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { moduleByKey } from '@/config/modules'

const { t } = useI18n()
const authStore = useAuthStore()

/**
 * Staff "User Manual": the existing in-app guides and quick references, each
 * entry gated by the module access matrix so a room never points a role at a
 * page they are not allowed to open.
 */
const sections = computed(() => {
  const can = (key) => {
    const mod = moduleByKey(key)
    return mod && authStore.canAccess(mod)
  }
  const out = []
  if (can('printer')) {
    out.push({
      key: 'printer',
      to: '/app/printer',
      icon: 'fas fa-print',
      title: t('userManual.printersTitle'),
      desc: t('userManual.printersDesc'),
    })
  }
  if (can('trusted-devices')) {
    out.push({
      key: 'trusted-devices',
      to: '/app/settings/trusted-devices',
      icon: 'fas fa-mobile-screen-button',
      title: t('userManual.trustedTitle'),
      desc: t('userManual.trustedDesc'),
    })
  }
  if (can('rooms')) {
    out.push({
      key: 'rooms',
      to: '/app/rooms',
      icon: 'fas fa-door-open',
      title: t('userManual.ratesTitle'),
      desc: t('userManual.ratesDesc'),
    })
  }
  if (can('night-audit')) {
    out.push({
      key: 'night-audit',
      to: '/app/night-audit',
      icon: 'fas fa-moon',
      title: t('userManual.nightAuditTitle'),
      desc: t('userManual.nightAuditDesc'),
    })
  }
  return out
})
</script>

<style scoped>
.dashboard-page { padding: 32px 20px; }

.page-head h1 {
  font-size: 26px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.page-head h1 i { color: #005eb8; }
.muted { color: #757575; font-size: 13px; margin-top: 2px; }

.guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  margin-top: 22px;
}

.guide-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  border: 1px solid #e7e7e7;
  border-radius: 12px;
  background: #fff;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.guide-card:hover {
  border-color: #005eb8;
  box-shadow: 0 6px 18px rgba(0, 94, 184, 0.12);
  transform: translateY(-1px);
}

.guide-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 10px;
  background: #eaf3fb;
  color: #005eb8;
  font-size: 16px;
}

.guide-card-body { flex: 1; min-width: 0; }
.guide-card-body strong { font-size: 14px; display: block; }
.guide-card-body .muted { margin: 4px 0 0; line-height: 1.5; }

.guide-card-open {
  align-self: flex-end;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  color: #005eb8;
}
</style>