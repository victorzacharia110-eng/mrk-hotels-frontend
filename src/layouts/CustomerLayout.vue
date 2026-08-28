<!--
  CustomerLayout — panel shell for self-service customers (/portal/*).
  Mirrors the superadmin layout style (same colors, sidebar, header)
  but scoped to the customer's own hotel management.
-->
<template>
  <div class="superadmin-layout">
    <a href="#portal-content" class="skip-link">Skip to content</a>
    <div
      class="sa-sidebar-overlay"
      :class="{ visible: sidebarMobileOpen }"
      @click="sidebarMobileOpen = false"
    ></div>
    <aside
      class="sa-sidebar"
      :class="{ collapsed: sidebarCollapsed, 'mobile-open': sidebarMobileOpen }"
    >
      <div
        class="sa-logo"
        @click="sidebarCollapsed = !sidebarCollapsed"
        role="button"
        tabindex="0"
        @keyup.enter="sidebarCollapsed = !sidebarCollapsed"
      >
        <span class="sa-logo-icon"><i class="fas fa-cloud"></i></span>
        <span class="sa-logo-text" v-show="!sidebarCollapsed">TSCL</span>
      </div>
      <nav class="sa-nav">
        <router-link
          to="/portal"
          class="sa-nav-link"
          :class="{ active: $route.name === 'portal-dashboard' }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-gauge-high"></i>
          <span v-show="!sidebarCollapsed">Dashboard</span>
        </router-link>
        <router-link
          to="/portal/hotel"
          class="sa-nav-link"
          :class="{ active: $route.path.startsWith('/portal/hotel') }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-hotel"></i>
          <span v-show="!sidebarCollapsed">Hotel Details</span>
        </router-link>
        <router-link
          to="/portal/subscription"
          class="sa-nav-link"
          :class="{ active: $route.path.startsWith('/portal/subscription') }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-credit-card"></i>
          <span v-show="!sidebarCollapsed">Subscription</span>
        </router-link>
        <router-link
          to="/portal/staff"
          class="sa-nav-link"
          :class="{ active: $route.path.startsWith('/portal/staff') }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-users"></i>
          <span v-show="!sidebarCollapsed">Staff</span>
        </router-link>

        <router-link
          to="/portal/payments"
          class="sa-nav-link"
          :class="{ active: $route.path.startsWith('/portal/payments') }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-money-bill"></i>
          <span v-show="!sidebarCollapsed">Payments</span>
        </router-link>

        <router-link
          to="/portal/profile"
          class="sa-nav-link"
          :class="{ active: $route.path.startsWith('/portal/profile') }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-user-circle"></i>
          <span v-show="!sidebarCollapsed">Profile</span>
        </router-link>

        <router-link
          to="/portal/notifications"
          class="sa-nav-link"
          :class="{ active: $route.path.startsWith('/portal/notifications') }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-bell"></i>
          <span v-show="!sidebarCollapsed">Notifications</span>
        </router-link>
      </nav>
      <div class="sa-sidebar-footer">
        <router-link to="/portal/pricing" class="sa-nav-link" @click="sidebarMobileOpen = false">
          <i class="fas fa-arrow-left"></i>
          <span v-show="!sidebarCollapsed">Back to TSCL</span>
        </router-link>
        <button @click="handleLogout" class="sa-nav-link logout-btn">
          <i class="fas fa-right-from-bracket"></i>
          <span v-show="!sidebarCollapsed">Logout</span>
        </button>
      </div>
    </aside>

    <div class="sa-main">
      <header class="sa-header">
        <div class="sa-header-left">
          <button class="sa-hamburger" @click="toggleSidebar" aria-label="Toggle menu">
            <i class="fas fa-bars"></i>
          </button>
          <h1 class="sa-page-title">{{ pageTitle }}</h1>
        </div>
        <div class="sa-header-right">
          <span v-if="tenantName" class="sa-tenant-badge">
            <i class="fas fa-building"></i> {{ tenantName }}
          </span>
          <span class="sa-badge"><i class="fas fa-cloud"></i> Customer</span>
          <span class="sa-user">{{ authStore.user?.full_name }}</span>
        </div>
      </header>
      <main id="portal-content" class="sa-content" tabindex="-1">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const sidebarCollapsed = ref(false)
const sidebarMobileOpen = ref(false)

const tenantName = computed(() => authStore.user?.tenant?.hotel_name)

const pageTitle = computed(() => {
  const titles = {
    'portal-dashboard': 'Dashboard',
    'portal-hotel': 'Hotel Details',
    'portal-subscription': 'Subscription',
    'portal-staff': 'Staff',
    'portal-payments': 'Payments',
    'portal-profile': 'Profile',
  }
  return titles[route.name] || 'Dashboard'
})

function toggleSidebar() {
  if (window.innerWidth <= 768) {
    sidebarMobileOpen.value = !sidebarMobileOpen.value
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
}

async function handleLogout() {
  await authStore.logout()
  router.push('/portal/login')
}
</script>

<style scoped>
/* Reuses superadmin layout CSS — identical look and feel */
.superadmin-layout { display: flex; min-height: 100vh; background: #f1f5f9; }
.skip-link { position: absolute; top: -40px; left: 0; background: #3b82f6; color: #fff; padding: 8px 16px; z-index: 200; font-size: 14px; }
.skip-link:focus { top: 0; }
.sa-sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 300; }
.sa-sidebar-overlay.visible { display: block; }

.sa-sidebar {
  width: 240px;
  background: #1e293b;
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  transition: width 0.2s;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 310;
  overflow-y: auto;
}
.sa-sidebar.collapsed { width: 64px; }

.sa-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  cursor: pointer;
  border-bottom: 1px solid #334155;
  min-height: 56px;
}
.sa-logo-icon { font-size: 20px; color: #3b82f6; flex-shrink: 0; width: 32px; text-align: center; }
.sa-logo-text { font-size: 16px; font-weight: 800; white-space: nowrap; }

.sa-nav { flex: 1; padding: 8px 0; }
.sa-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  color: #94a3b8;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
}
.sa-nav-link i { width: 20px; text-align: center; font-size: 14px; flex-shrink: 0; }
.sa-nav-link:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }
.sa-nav-link.active { background: rgba(59,130,246,0.15); color: #3b82f6; }

.sa-sidebar-footer { border-top: 1px solid #334155; padding: 8px 0; }
.logout-btn { color: #f87171 !important; }
.logout-btn:hover { background: rgba(248,113,113,0.1) !important; }

.sa-main { flex: 1; margin-left: 240px; transition: margin-left 0.2s; display: flex; flex-direction: column; }
.sa-sidebar.collapsed ~ .sa-main { margin-left: 64px; }

.sa-header {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 50;
}
.sa-header-left { display: flex; align-items: center; gap: 12px; }
.sa-hamburger { display: none; background: none; border: none; font-size: 18px; color: #64748b; cursor: pointer; }
.sa-page-title { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
.sa-header-right { display: flex; align-items: center; gap: 12px; }
.sa-tenant-badge { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; }
.sa-badge { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #3b82f6; background: #eff6ff; padding: 4px 10px; border-radius: 999px; }
.sa-user { font-size: 13px; font-weight: 500; color: #334155; }

.sa-content { padding: 24px; flex: 1; }

@media (max-width: 768px) {
  .sa-sidebar { transform: translateX(-100%); transition: transform 0.2s; }
  .sa-sidebar.mobile-open { transform: translateX(0); }
  .sa-main { margin-left: 0 !important; }
  .sa-hamburger { display: block; }
}
</style>
