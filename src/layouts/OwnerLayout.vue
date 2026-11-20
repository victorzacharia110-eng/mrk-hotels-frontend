<!--
  OwnerLayout — shell for the owner panel (/owner).
  Collapsible sidebar (slide-over on mobile) with the dashboard link and
  session actions, a header showing the current page title, and the routed
  owner pages.
-->

<template>
  <div class="owner-layout">
    <a href="#owner-content" class="skip-link">{{ $t('common.skipToContent') }}</a>
    <!-- Backdrop that closes the slide-over sidebar on mobile. -->
    <div
      class="sa-sidebar-overlay"
      :class="{ visible: sidebarMobileOpen }"
      @click="sidebarMobileOpen = false"
    ></div>
    <!-- Sidebar: logo (click to collapse), navigation and session actions. -->
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
        <span class="sa-logo-icon" aria-hidden="true"><i class="fas fa-crown"></i></span>
        <span class="sa-logo-text" v-show="!sidebarCollapsed">{{ $t('owner.panelTitle') }}</span>
      </div>
      <nav class="sa-nav" :aria-label="$t('common.navigation')">
        <router-link
          to="/owner"
          class="sa-nav-link"
          :class="{ active: $route.name === 'owner-dashboard' }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-gauge-high" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('owner.dashboard') }}</span>
        </router-link>
        <router-link
          to="/owner/marketing"
          class="sa-nav-link"
          :class="{ active: $route.name === 'owner-marketing' }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-bullhorn" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('owner.marketing') }}</span>
        </router-link>
        <router-link
          to="/owner/marketing/content/pages"
          class="sa-nav-link"
          :class="{ active: String($route.name || '').startsWith('owner-marketing-') }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-globe" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('owner.marketingSiteContent') }}</span>
        </router-link>
        <router-link
          to="/owner/payment-methods"
          class="sa-nav-link"
          :class="{ active: $route.name === 'owner-payment-methods' }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-credit-card" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('hotelSettings.paymentSection') }}</span>
        </router-link>
        <router-link
          to="/owner/profile"
          class="sa-nav-link"
          :class="{ active: $route.name === 'owner-profile' }"
          @click="sidebarMobileOpen = false"
        >
          <i class="fas fa-user" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('owner.profile') }}</span>
        </router-link>
      </nav>
      <div class="sa-sidebar-footer">
        <router-link to="/" class="sa-nav-link" @click="sidebarMobileOpen = false">
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('owner.backToPortal') }}</span>
        </router-link>
        <button @click="handleLogout" class="sa-nav-link logout-btn">
          <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('common.logout') }}</span>
        </button>
      </div>
    </aside>
    <!-- Main column: header bar with the page title + routed page content. -->
    <div class="sa-main">
      <header class="sa-header">
        <div class="sa-header-left">
          <button
            type="button"
            class="sa-hamburger"
            @click="toggleSidebar"
            :aria-label="$t('nav.menuToggle')"
            :aria-expanded="sidebarMobileOpen || !sidebarCollapsed"
          >
            <span></span><span></span><span></span>
          </button>
          <h2>{{ pageTitle }}</h2>
        </div>
        <div class="sa-header-right">
          <ThemeToggle />
          <RoleBadge />
          <div class="sa-profile-menu">
            <button
              type="button"
              class="sa-profile-trigger"
              :aria-expanded="profileOpen"
              :aria-label="$t('nav.profile')"
              @click="profileOpen = !profileOpen"
            >
              <span class="sa-profile-avatar" aria-hidden="true">{{ userInitials }}</span>
            </button>
            <div v-if="profileOpen" class="sa-profile-backdrop" @click="profileOpen = false"></div>
            <div v-if="profileOpen" class="sa-profile-panel">
              <div class="sa-profile-head">
                <span class="sa-profile-avatar" aria-hidden="true">{{ userInitials }}</span>
                <div>
                  <strong>{{ accountName }}</strong>
                  <small>{{ authStore.user?.email }}</small>
                </div>
              </div>
              <router-link
                :to="{ name: 'user-manual' }"
                class="sa-profile-link"
                @click="profileOpen = false"
              >
                <i class="fas fa-book-open" aria-hidden="true"></i> {{ $t('nav.userManual') }}
              </router-link>
              <router-link
                :to="{ name: 'owner-profile' }"
                class="sa-profile-link"
                @click="profileOpen = false"
              >
                <i class="fas fa-user-circle" aria-hidden="true"></i> {{ $t('nav.profile') }}
              </router-link>
              <div class="sa-profile-lang" role="group" :aria-label="$t('topBar.language')">
                <button
                  type="button"
                  class="sa-lang-option"
                  :class="{ active: locale === 'en' }"
                  :title="$t('topBar.switchToEnglish')"
                  :aria-pressed="locale === 'en'"
                  @click="setLocale('en')"
                >
                  EN
                </button>
                <button
                  type="button"
                  class="sa-lang-option"
                  :class="{ active: locale === 'sw' }"
                  :title="$t('topBar.switchToSwahili')"
                  :aria-pressed="locale === 'sw'"
                  @click="setLocale('sw')"
                >
                  SW
                </button>
              </div>
              <button
                type="button"
                class="sa-profile-link sa-profile-logout"
                @click="profileOpen = false; handleLogout()"
              >
                <i class="fas fa-right-from-bracket" aria-hidden="true"></i> {{ $t('common.logout') }}
              </button>
            </div>
          </div>
        </div>
      </header>
      <main id="owner-content" class="sa-content" tabindex="-1">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import RoleBadge from '@/components/RoleBadge.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { locale } = useI18n()
// Sidebar UI state: collapsed on desktop, or open as an overlay on mobile.
const sidebarCollapsed = ref(true)
const sidebarMobileOpen = ref(false)
const profileOpen = ref(false)

/** Title shown in the header, derived from the current route name. */
const pageTitle = computed(() => {
  const titles = {
    'owner-dashboard': 'Dashboard',
    'owner-hotel-detail': 'Hotel Details',
    'owner-marketing': 'Marketing',
    'owner-payment-methods': 'Payment Methods',
    'owner-profile': 'Profile',
  }
  if (typeof route.name === 'string' && route.name.startsWith('owner-marketing-')) return 'Marketing Site'
  return titles[route.name] || 'Dashboard'
})

const accountName = computed(() => (
  authStore.user?.full_name
  || authStore.user?.name
  || [authStore.user?.first_name, authStore.user?.last_name].filter(Boolean).join(' ')
  || (authStore.user?.email || '').split('@')[0]
  || ''
))

const userInitials = computed(() => {
  const parts = accountName.value.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (authStore.user?.user_role || 'OW').slice(0, 2).toUpperCase()
})

/**
 * Toggles the sidebar: switches the mobile overlay on small screens and the
 * collapsed/expanded state on larger ones.
 */
function toggleSidebar() {
  profileOpen.value = false
  if (window.innerWidth <= 768) {
    sidebarMobileOpen.value = !sidebarMobileOpen.value
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
}

function setLocale(lang) {
  profileOpen.value = false
  locale.value = lang
  localStorage.setItem('locale', lang)
}

watch(() => route.path, () => {
  profileOpen.value = false
  sidebarMobileOpen.value = false
})

/**
 * Logs the owner out via the auth store and redirects to the login page.
 *
 * @returns {Promise<void>}
 */
async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.owner-layout {
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: #f0f2f5;
}

.sa-sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.sa-sidebar-overlay.visible {
  opacity: 1;
}

.sa-sidebar {
  width: 260px;
  background: #1a1a2e;
  color: #fff;
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  flex-shrink: 0;
  overflow: hidden;
  z-index: 1000;
}

.sa-sidebar.collapsed {
  width: 72px;
}

.sa-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
}

.sa-logo-icon {
  width: 36px;
  height: 36px;
  background: #005eb8;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.sa-logo-text {
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
}

.sa-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sa-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  border: none;
  background: none;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
}

.sa-nav-link:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.sa-nav-link.active {
  background: #005eb8;
  color: #fff;
}

.sa-nav-link i {
  width: 20px;
  text-align: center;
  font-size: 16px;
  flex-shrink: 0;
}

.sa-sidebar-footer {
  flex-shrink: 0;
  padding: 12px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.logout-btn {
  width: 100%;
  color: rgba(255, 255, 255, 0.5);
}

.logout-btn:hover {
  color: #005eb8 !important;
  background: rgba(231, 76, 60, 0.1) !important;
}

.sa-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sa-header {
  background: #fff;
  border-bottom: 1px solid #eee;
  padding: 16px 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sa-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sa-header h2 {
  font-size: 20px;
  font-weight: 700;
}

.sa-header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.sa-profile-menu {
  position: relative;
  display: flex;
  align-items: center;
}

.sa-profile-trigger {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
}

.sa-profile-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #005eb8;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  overflow: hidden;
}
.sa-profile-avatar.has-image { background: #e2e8f0; }
.sa-profile-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }

.sa-profile-backdrop {
  position: fixed;
  inset: 0;
  z-index: 95;
  background: transparent;
}

.sa-profile-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 260px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
  z-index: 96;
  overflow: hidden;
}

.sa-profile-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
}

.sa-profile-head .sa-profile-avatar {
  width: 34px;
  height: 34px;
  font-size: 13px;
}

.sa-profile-head strong {
  display: block;
  font-size: 14px;
  color: #333;
}

.sa-profile-head small {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.sa-profile-link {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  text-align: left;
  text-decoration: none;
  font-size: 13px;
  font-family: inherit;
  color: #334155;
  cursor: pointer;
}

.sa-profile-link i {
  width: 18px;
  text-align: center;
  color: #64748b;
}

.sa-profile-link:hover {
  background: #f8fafc;
}

.sa-profile-lang {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
}

.sa-lang-option {
  flex: 1;
  padding: 6px 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.sa-lang-option.active {
  background: #eaf4ff;
  border-color: #005eb8;
  color: #005eb8;
}

.sa-profile-logout,
.sa-profile-logout i {
  color: #dc2626;
}

html[data-theme='dark'] .sa-profile-panel {
  background: #1e293b;
  border-color: #334155;
}

html[data-theme='dark'] .sa-profile-head {
  border-bottom-color: #334155;
}

html[data-theme='dark'] .sa-profile-head strong {
  color: #e2e8f0;
}

html[data-theme='dark'] .sa-profile-link {
  color: #cbd5e1;
}

html[data-theme='dark'] .sa-profile-link:hover {
  background: #334155;
}

html[data-theme='dark'] .sa-profile-lang {
  border-color: #334155;
}

html[data-theme='dark'] .sa-lang-option {
  background: #1e293b;
  border-color: #475569;
  color: #cbd5e1;
}

html[data-theme='dark'] .sa-lang-option.active {
  background: rgba(18, 105, 189, 0.3);
  border-color: #60a5fa;
  color: #bfdbfe;
}

.sa-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}

.sa-hamburger {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
}

.sa-hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: #333;
  border-radius: 2px;
}

@media (max-width: 767px) {
  .sa-sidebar {
    position: fixed;
    left: -280px;
    top: 0;
    bottom: 0;
    transition: left 0.3s ease;
  }

  .sa-sidebar.mobile-open {
    left: 0;
  }

  .sa-sidebar-overlay {
    display: block;
    pointer-events: none;
  }

  .sa-sidebar-overlay.visible {
    pointer-events: auto;
  }

  .sa-hamburger {
    display: flex;
  }

  .sa-header {
    padding: 14px 16px;
  }

  .sa-content {
    padding: 20px 16px;
  }
}
</style>
