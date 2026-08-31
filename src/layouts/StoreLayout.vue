<!--
  StoreLayout — shell for the public storefront and the staff panel.
  Hosts the top bar, the main header (logo, directory search, auth actions,
  language switch), the module navigation filtered by the user's access
  rights, the owner's read-only preview banner, the routed page and the
  footer.
-->

<template>
  <div class="store-layout">
    <a href="#main-content" class="skip-link">{{ $t('common.skipToContent') }}</a>
    <header class="site-header">
      <!-- Top bar: contact details; the viewed hotel's name when in app mode. -->
      <div class="top-bar">
        <div class="container top-bar-inner">
          <div class="top-bar-left">
            <span><i class="fas fa-phone" aria-hidden="true"></i> {{ contactPhone }}</span>
            <span><i class="fas fa-envelope" aria-hidden="true"></i> {{ contactEmail }}</span>
            <span><i class="fas fa-location-dot" aria-hidden="true"></i>
              {{ contactLocation }}</span>
          </div>
          <div class="top-bar-right" v-if="!isAppMode">
            <span class="top-bar-tagline"><i class="fas fa-hotel" aria-hidden="true"></i> {{ $t('topBar.tagline')
            }}</span>
          </div>
          <div class="top-bar-right" v-else>
            <span class="top-bar-tagline"><i class="fas fa-hotel" aria-hidden="true"></i> {{ hotelName }}</span>
          </div>
        </div>
      </div>

      <!-- Main header: logo, directory search and account/language actions. -->
      <div class="main-header">
        <div class="container main-header-inner">
          <button v-if="isAppMode" class="hamburger side-hamburger" :class="{ active: sideOpen }"
            @click="sideOpen = !sideOpen" :aria-expanded="sideOpen" :aria-label="$t('nav.menuToggle')"
            aria-controls="staff-drawer">
            <span></span><span></span><span></span>
          </button>

          <router-link :to="homeLink" class="logo" @click="navOpen = false"
            :aria-label="$t('nav.portal') + ' — MRK Hotels'">
            <span class="logo-icon" aria-hidden="true"><i class="fas fa-hotel"></i></span>
            <span class="logo-text">MRK<span>Hotels</span></span>
            <HolidayDecor v-if="holiday" :holiday="holiday" />
          </router-link>

          <div v-if="isDirectory" class="search-bar">
            <div class="search-input-wrap">
              <label for="directory-search" class="visually-hidden">{{ $t('common.search') }}</label>
              <input id="directory-search" v-model="searchQuery" type="text" :placeholder="$t('search.placeholder')"
                @keyup.enter="handleSearch" />
              <button v-if="searchQuery" @click="clearSearch" class="search-clear" type="button"
                :aria-label="$t('common.clear')"><i class="fas fa-xmark" aria-hidden="true"></i></button>
            </div>
          </div>

          <div class="header-actions">
            <router-link v-if="isAppMode" :to="{ name: 'public-home' }" class="action-link" @click="navOpen = false">
              <i class="fas fa-store" aria-hidden="true"></i>
              <span class="action-label">{{ $t('nav.portal') }}</span>
            </router-link>

            <template v-if="authStore.isAuthenticated">
              <router-link :to="dashboardRoute" class="action-link" @click="navOpen = false">
                <i class="fas fa-gauge-high" aria-hidden="true"></i>
                <span class="action-label">{{ $t('nav.dashboard') }}</span>
              </router-link>
              <router-link v-if="isAppMode" :to="{ name: 'hotel-profile' }" class="action-link"
                @click="navOpen = false">
                <i class="fas fa-user-circle" aria-hidden="true"></i>
                <span class="action-label">{{ $t('nav.profile') }}</span>
              </router-link>
              <button @click="handleLogout" class="action-link logout-btn">
                <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
                <span class="action-label">{{ $t('nav.logout') }}</span>
              </button>
            </template>
            <template v-else>
              <router-link to="/login" class="action-link">
                <i class="fas fa-user" aria-hidden="true"></i>
                <span class="action-label">{{ $t('nav.signIn') }}</span>
              </router-link>
            </template>

            <div class="lang-switch" role="group" :aria-label="$t('topBar.language')">
              <button type="button" class="lang-option" :class="{ active: locale === 'en' }" @click="setLocale('en')"
                :title="$t('topBar.switchToEnglish')" :aria-pressed="locale === 'en'">
                <span class="lang-flag" aria-hidden="true">🇬🇧</span>
                <span class="lang-code">EN</span>
              </button>
              <button type="button" class="lang-option" :class="{ active: locale === 'sw' }" @click="setLocale('sw')"
                :title="$t('topBar.switchToSwahili')" :aria-pressed="locale === 'sw'">
                <span class="lang-flag" aria-hidden="true">🇹🇿</span>
                <span class="lang-code">SW</span>
              </button>
            </div>
          </div>

          <button v-if="!isAppMode" class="hamburger" :class="{ active: navOpen }" @click="navOpen = !navOpen" :aria-expanded="navOpen"
            :aria-label="$t('nav.menuToggle')" aria-controls="mobile-menu">
            <span></span><span></span><span></span>
          </button>
        </div>

        <!-- Collapsible mobile menu (public pages only — staff use the sidebar drawer). -->
        <div v-if="!isAppMode" id="mobile-menu" class="mobile-dropdown" :class="{ open: navOpen }">
          <div class="mobile-dropdown-inner">
            <div v-if="isDirectory" class="mobile-search">
              <div class="mobile-search-row">
                <input v-model="searchQuery" type="text" :placeholder="$t('search.placeholder')"
                  @keyup.enter="handleSearch(); navOpen = false" :aria-label="$t('common.search')" />
                <button v-if="searchQuery" @click="clearSearch(); navOpen = false" class="search-clear" type="button"
                  :aria-label="$t('common.clear')"><i class="fas fa-xmark" aria-hidden="true"></i></button>
              </div>
            </div>

            <template v-if="isAppMode">
              <router-link v-for="item in visibleModules.filter((i) => !i.children)" :key="item.to" :to="item.to" class="mobile-link"
                @click="navOpen = false">
                <i :class="item.icon" aria-hidden="true"></i> {{ item.label }}
              </router-link>
              <div class="mobile-divider"></div>
              <router-link :to="{ name: 'public-home' }" class="mobile-link" @click="navOpen = false">
                <i class="fas fa-store" aria-hidden="true"></i> {{ $t('nav.portal') }}
              </router-link>
            </template>
            <template v-else>
              <router-link :to="{ name: 'public-home' }" class="mobile-link" @click="navOpen = false">
                <i class="fas fa-hotel" aria-hidden="true"></i> {{ $t('nav.hotels') }}
              </router-link>
              <router-link :to="{ name: 'public-booking' }" class="mobile-link" @click="navOpen = false">
                <i class="fas fa-calendar-check" aria-hidden="true"></i> {{ $t('nav.bookStay') }}
              </router-link>
            </template>

            <div class="mobile-divider"></div>

            <template v-if="authStore.isAuthenticated">
              <router-link :to="dashboardRoute" class="mobile-link" @click="navOpen = false">
                <i class="fas fa-gauge-high" aria-hidden="true"></i> {{ $t('nav.dashboard') }}
              </router-link>
              <button @click="handleLogout" class="mobile-link logout">
                <i class="fas fa-right-from-bracket" aria-hidden="true"></i> {{ $t('nav.logout') }}
              </button>
            </template>
            <template v-else>
              <router-link to="/login" class="mobile-link" @click="navOpen = false">
                <i class="fas fa-user" aria-hidden="true"></i> {{ $t('nav.signIn') }}
              </router-link>
            </template>

            <div class="mobile-divider"></div>

            <button class="mobile-link" @click="toggleLocale">
              <span class="mobile-lang-flag" aria-hidden="true">{{ locale === 'sw' ? '🇬🇧' : '🇹🇿' }}</span>
              {{ locale === 'sw' ? $t('topBar.switchToEnglish') : $t('topBar.switchToSwahili') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Module navigation: access-filtered staff links, or the public links. -->
      <nav class="main-nav" :class="{ 'main-nav--app': isAppMode }" :aria-label="$t('common.navigation')">
        <div class="container nav-inner">
          <div v-if="isAppMode" class="nav-links nav-scroll">
            <!-- Staff work entirely from their dashboard (chart, bars and
                 modals), so module links are hidden for every staff role —
                 no more jumping between tabs. -->
          </div>
          <div v-else class="nav-links">
            <router-link :to="{ name: 'public-home' }" class="nav-link" @click="navOpen = false">
              <i class="fas fa-hotel" aria-hidden="true"></i> {{ $t('nav.hotels') }}
            </router-link>
            <router-link :to="{ name: 'public-booking' }" class="nav-link" @click="navOpen = false">
              <i class="fas fa-calendar-check" aria-hidden="true"></i> {{ $t('nav.bookStay') }}
            </router-link>
            <div class="nav-powered-wrap">
              <router-link to="/portal/pricing" class="nav-link nav-link--powered" @click="navOpen = false">
                {{ $t('nav.poweredByTscl') }}
              </router-link>
              <div v-if="poweredTipOpen" class="powered-tip-bubble">
                <span>{{ $t('nav.poweredByTsclTip') }}</span>
                <button type="button" class="powered-tip-close" :aria-label="$t('common.close')"
                  @click.stop.prevent="poweredTipOpen = false">
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="nav-right">
            <button v-if="isAppMode" class="nav-bell"
              @click="toggleNotifDropdown"
              :aria-label="$t('notifications.unreadCount', { count: notifStore.unreadCount })">
              <i class="fas fa-bell"></i>
              <span v-if="notifStore.unreadCount > 0" class="nav-bell-badge">{{ notifStore.unreadCount > 99 ? '99+' : notifStore.unreadCount }}</span>
            </button>
            <span v-if="isAppMode"><RoleBadge /></span>
            <span v-else class="nav-text"><i class="fas fa-moon" aria-hidden="true"></i> {{ $t('nav.fastBooking')
            }}</span>
          </div>
        </div>
      </nav>
    </header>

    <!-- Staff drawer: collapsed by default; the hamburger slides it in over a
         dark overlay. Holds every module the role can access (messages,
         inventory, reports, ...) so the dashboard stays uncluttered. -->
    <Transition name="drawer-fade">
      <div v-if="isAppMode && sideOpen" class="drawer-overlay" aria-hidden="true" @click="sideOpen = false"></div>
    </Transition>
    <Transition name="drawer-slide">
      <aside v-if="isAppMode && sideOpen" id="staff-drawer" class="staff-drawer" :aria-label="$t('common.navigation')">
        <div class="drawer-head">
          <router-link :to="homeLink" class="logo drawer-brand" :aria-label="$t('nav.portal') + ' — MRK Hotels'"
            @click="sideOpen = false">
            <span class="logo-icon" aria-hidden="true"><i class="fas fa-hotel"></i></span>
            <span class="logo-text">MRK<span>Hotels</span></span>
            <HolidayDecor v-if="holiday" :holiday="holiday" />
          </router-link>
          <button type="button" class="drawer-close" :aria-label="$t('common.close')" @click="sideOpen = false">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        <nav class="drawer-nav">
          <template v-for="item in visibleModules" :key="item.to || item.key">
            <template v-if="item.children">
              <button type="button" class="drawer-link drawer-acc-head" @click="toggleAccordion(item.key)">
                <i :class="item.icon" aria-hidden="true"></i> {{ item.label }}
                <i class="fas fa-chevron-down drawer-acc-caret" :class="{ open: openAccordions.has(item.key) }" aria-hidden="true"></i>
              </button>
              <div v-if="openAccordions.has(item.key)" class="drawer-acc-children">
                <button
                  v-for="child in item.children.filter((c) => c.action)"
                  :key="child.action"
                  type="button"
                  class="drawer-link drawer-acc-child"
                  @click="handleAccordionAction(item.key, child.action)"
                >
                  <i :class="child.icon" aria-hidden="true"></i> {{ child.label }}
                </button>
                <router-link
                  v-for="child in item.children.filter((c) => c.to)"
                  :key="child.to"
                  :to="child.to"
                  class="drawer-link drawer-acc-child"
                  @click="sideOpen = false"
                >
                  <i :class="child.icon" aria-hidden="true"></i> {{ child.label }}
                </router-link>
              </div>
            </template>
            <router-link v-else :key="item.to" :to="item.to" class="drawer-link" @click="sideOpen = false">
              <i :class="item.icon" aria-hidden="true"></i> {{ item.label }}
            </router-link>
          </template>
        </nav>
        <div class="drawer-foot">
          <button class="drawer-link drawer-notif" @click="toggleNotifDropdown(); sideOpen = false">
            <i class="fas fa-bell" aria-hidden="true"></i>
            {{ $t('notifications.title') }}
            <span v-if="notifStore.unreadCount > 0" class="drawer-notif-badge">{{ notifStore.unreadCount > 99 ? '99+' : notifStore.unreadCount }}</span>
          </button>
          <router-link :to="{ name: 'public-home' }" class="drawer-link" @click="sideOpen = false">
            <i class="fas fa-store" aria-hidden="true"></i> {{ $t('nav.portal') }}
          </router-link>
          <router-link :to="{ name: 'hotel-profile' }" class="drawer-link" @click="sideOpen = false">
            <i class="fas fa-user-circle" aria-hidden="true"></i> {{ $t('nav.profile') }}
          </router-link>
          <button class="drawer-link" @click="toggleLocale">
            <span class="mobile-lang-flag" aria-hidden="true">{{ locale === 'sw' ? '🇬🇧' : '🇹🇿' }}</span>
            {{ locale === 'sw' ? $t('topBar.switchToEnglish') : $t('topBar.switchToSwahili') }}
          </button>
          <button class="drawer-link logout" @click="handleLogout">
            <i class="fas fa-right-from-bracket" aria-hidden="true"></i> {{ $t('nav.logout') }}
          </button>
        </div>
      </aside>
    </Transition>

    <!-- Notification dropdown panel -->
    <div v-if="showNotifDropdown && isAppMode" class="notif-dropdown" @click.self="showNotifDropdown = false">
      <div class="notif-panel">
        <div class="notif-panel-head">
          <h3>{{ $t('notifications.title') }}</h3>
          <button v-if="notifStore.unreadCount > 0" class="notif-mark-all"
            @click="notifStore.markAllRead(); showNotifDropdown = false">
            {{ $t('notifications.markAllRead') }}
          </button>
        </div>
        <div class="notif-panel-body">
          <div v-if="notifStore.alerts.length" class="notif-section">
            <p class="notif-section-label">{{ $t('notifications.needsAction') }}</p>
            <div v-for="alert in notifStore.alerts" :key="alert.id" class="notif-item notif-item--alert">
              <div class="notif-item-body">
                <strong class="notif-item-title">{{ alert.title }}</strong>
                <p class="notif-item-text">{{ alert.body }}</p>
                <span class="notif-item-time">{{ formatNotifTime(alert.created_at) }}</span>
              </div>
              <button class="notif-item-dismiss" @click="notifStore.dismissAlert(alert.id)"
                :aria-label="$t('common.close')">
                <i class="fas fa-xmark"></i>
              </button>
            </div>
          </div>
          <div v-if="notifStore.notifications.length" class="notif-section">
            <p class="notif-section-label">{{ $t('notifications.recent') }}</p>
            <button v-for="notif in notifStore.notifications" :key="notif.id" type="button"
              class="notif-item notif-item-btn" @click="notifStore.markRead(notif.id)">
              <div class="notif-item-body">
                <strong class="notif-item-title">{{ notif.title }}</strong>
                <p class="notif-item-text">{{ notif.body }}</p>
                <span class="notif-item-time">{{ formatNotifTime(notif.created_at) }}</span>
              </div>
            </button>
          </div>
          <p v-if="!notifStore.alerts.length && !notifStore.notifications.length" class="notif-empty">
            {{ $t('notifications.noNotifications') }}
          </p>
        </div>
        <div class="notif-panel-foot">
          <button class="btn btn-sm btn-secondary" @click="showNotifDropdown = false">{{ $t('common.close') }}</button>
        </div>
      </div>
    </div>

    <!-- Read-only banner shown when an owner is previewing one of their hotels. -->
    <div v-if="isOwnerViewing" class="owner-banner" role="status">
      <i class="fas fa-eye" aria-hidden="true"></i>
      <span>{{ $t('owner.viewingHotel', { hotel: viewingHotelName }) }}</span>
      <span class="owner-banner-readonly">{{ $t('owner.readOnly') }}</span>
      <button class="owner-banner-btn" @click="exitOwnerView">
        <i class="fas fa-arrow-left" aria-hidden="true"></i> {{ $t('owner.backToOwnerPanel') }}
      </button>
    </div>

    <!-- Routed page content with a fade transition between pages. -->
    <main id="main-content" tabindex="-1">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <!-- Site footer: brand, quick links, support and contact details.
         Hidden in the staff panel (/app) — panels use the full viewport. -->
    <footer v-if="!isAppMode" class="site-footer">
      <div class="container footer-grid">
        <div>
          <div class="footer-logo">
            <span class="logo-icon" aria-hidden="true"><i class="fas fa-hotel"></i></span>
            <span class="logo-text">MRK<span>Hotels</span></span>
            <HolidayDecor v-if="holiday" :holiday="holiday" />
          </div>
          <p class="footer-desc">{{ $t('footer.description') }}</p>
        </div>
        <div>
          <h4>{{ $t('footer.quickLinks') }}</h4>
          <router-link :to="{ name: 'public-home' }">{{ $t('nav.hotels') }}</router-link>
          <router-link :to="{ name: 'public-booking' }">{{ $t('nav.bookStay') }}</router-link>
          <div class="footer-powered">
            <router-link to="/portal/pricing" class="footer-powered-link">{{ $t('nav.poweredByTscl') }}</router-link>
            <span class="footer-powered-tip">{{ $t('nav.poweredByTsclTip') }}</span>
          </div>
          <router-link :to="{ name: 'login' }">{{ $t('nav.signIn') }}</router-link>
        </div>
        <div>
          <h4>{{ $t('footer.support') }}</h4>
          <a href="#">{{ $t('footer.helpCenter') }}</a>
          <a href="#">{{ $t('footer.privacyPolicy') }}</a>
          <a href="#">{{ $t('footer.terms') }}</a>
        </div>
        <div>
          <h4>{{ $t('footer.contact') }}</h4>
          <p><i class="fas fa-phone" aria-hidden="true"></i> {{ contactPhone }}</p>
          <p><i class="fas fa-envelope" aria-hidden="true"></i> {{ contactEmail }}</p>
          <p><i class="fas fa-location-dot" aria-hidden="true"></i> {{ contactLocation }}</p>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="container">
          <span>{{ $t('footer.copyright', { year }) }}</span>
        </div>
      </div>
    </footer>

    <!-- Welcome card: once per visit, introduces what the TSCL system offers
         and links to pricing. Mobile-first — desktop already has the nav tooltip. -->
    <Transition name="welcome-ad">
      <div v-if="welcomeAdOpen" class="welcome-ad" role="dialog" :aria-label="$t('nav.welcomeAd.title')">
        <div class="welcome-ad-card">
          <button type="button" class="welcome-ad-close" :aria-label="$t('common.close')" @click="closeWelcomeAd">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
          <p class="welcome-ad-kicker">{{ $t('nav.welcomeAd.kicker') }}</p>
          <h3 class="welcome-ad-title">{{ $t('nav.welcomeAd.title') }}</h3>
          <ul class="welcome-ad-services">
            <li><i class="fas fa-calendar-check" aria-hidden="true"></i> {{ $t('nav.welcomeAd.s1') }}</li>
            <li><i class="fas fa-people-roof" aria-hidden="true"></i> {{ $t('nav.welcomeAd.s2') }}</li>
            <li><i class="fas fa-mobile-screen" aria-hidden="true"></i> {{ $t('nav.welcomeAd.s3') }}</li>
            <li><i class="fas fa-chart-line" aria-hidden="true"></i> {{ $t('nav.welcomeAd.s4') }}</li>
          </ul>
          <router-link to="/portal/pricing" class="welcome-ad-cta" @click="closeWelcomeAd">
            {{ $t('nav.welcomeAd.cta') }}
          </router-link>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import RoleBadge from '@/components/RoleBadge.vue'
import { publicApi } from '@/api'
import { MODULES } from '@/config/modules'
import { clearOwnerHotel, ownerHotelId, ownerHotelName } from '@/utils/ownerView'
import { useHoliday } from '@/composables/useHoliday'
import HolidayDecor from '@/components/HolidayDecor.vue'
import { initEcho, destroyEcho } from '@/plugins/echo'
import { joinPresence, leavePresence } from '@/composables/usePresence'
import { useDistribution } from '@/composables/useDistribution'
import { useNotificationStore } from '@/stores/notifications'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const notifStore = useNotificationStore()

const { holiday } = useHoliday()

const year = new Date().getFullYear()
// Header UI state: the mobile menu toggle, the directory search query, and notification dropdown.
const navOpen = ref(false)
// Staff drawer (hamburger menu) open state — collapsed by default.
const sideOpen = ref(false)
const showNotifDropdown = ref(false)

/** Open/close the notification dropdown, refreshing counts and the list. */
function toggleNotifDropdown() {
  showNotifDropdown.value = !showNotifDropdown.value
  if (showNotifDropdown.value) {
    notifStore.fetchCounts()
    notifStore.fetchAlerts()
    notifStore.fetchNotifications({ per_page: 20 })
  }
}
const searchQuery = ref(Array.isArray(route.query.search) ? route.query.search[0] : (route.query.search || ''))
// Nav accordion groups that are currently expanded (e.g. Night Audit).
const openAccordions = ref(new Set())

// Mode detection: whether the header renders the hotel app (/app) or the
// public directory, and which root the logo should link to.
const isAppMode = computed(() => route.path.startsWith('/app'))
const isDirectory = computed(() => route.name === 'public-home')

const homeLink = computed(() => (isAppMode.value ? '/app' : '/'))

// Branding: the current hotel's name (or the viewed hotel when an owner is
// browsing). The signed-in role is rendered by <RoleBadge /> in the header.
const hotelName = computed(() =>
  isOwnerViewing.value
    ? viewingHotelName.value
    : authStore.user?.tenant?.hotel_name || 'MRK Hotels',
)

// Per-hotel public contact details: the top bar and footer show the currently
// viewed hotel's stored phone/email/location when browsing its public pages,
// falling back to the platform's own details elsewhere.
const currentHotel = ref(null)
const contactLoading = ref(false)

/**
 * The tenant id of the hotel currently being browsed on the public pages,
 * or null when there is no single-hotel context (directory, auth screens...).
 */
const hotelContextId = computed(() => {
  if (route.name === 'public-hotel') return route.params.id
  if (route.name === 'public-booking') return route.query.hotel_id
  return null
})

const contactPhone = computed(() => currentHotel.value?.phone || '+255 700 000 000')
const contactEmail = computed(() => currentHotel.value?.email || 'bookings@mrkhotels.com')
const contactLocation = computed(() => {
  if (currentHotel.value) {
    const parts = [currentHotel.value.address, currentHotel.value.city, currentHotel.value.country].filter(Boolean)
    return parts.length ? parts.join(', ') : t('topBar.location')
  }
  return t('topBar.location')
})

watch(hotelContextId, async (id) => {
  currentHotel.value = null
  if (!id) return
  contactLoading.value = true
  try {
    const res = await publicApi.hotelShow(id)
    currentHotel.value = res.data.hotel
  } catch {
    currentHotel.value = null
  } finally {
    contactLoading.value = false
  }
}, { immediate: true })

// Owner hotel-switching: an owner browsing one of their hotels, read-only.
const viewingHotelName = computed(() => ownerHotelName() || '—')
const isOwnerViewing = computed(
  () => authStore.user?.user_role === 'owner' && isAppMode.value && !!ownerHotelId(),
)

/**
 * Ends the owner hotel-switching preview and returns to the owner panel.
 */
function exitOwnerView() {
  clearOwnerHotel()
  router.push('/owner')
}

/** Route that the dashboard link points to, based on the user's role. */
const dashboardRoute = computed(() => (authStore.isSuperadmin ? '/superadmin' : '/app'))

/** Navigation modules the current user is allowed to see, with localised labels. */
const visibleModules = computed(() => {
  const items = MODULES.filter((item) => authStore.canAccess(item)).map((item) => ({
    ...item,
    label: t(item.labelKey),
  }))

  // Expand the flat "night audit" module into an accordion group holding the
  // three night-audit actions a receptionist runs: Run Night Audit, Night
  // Audit Log, and Insert Transaction.
  return items.map((item) => {
    if (item.key === 'night-audit') {
      return {
        ...item,
        to: undefined,
        children: [
          { to: '/app/night-audit', label: t('nightAudit.run'), icon: 'fas fa-play' },
          { to: '/app/night-audit/logs', label: t('nightAudit.log'), icon: 'fas fa-clock-rotate-left' },
          { to: '/app/night-audit/transactions', label: t('nightAudit.insert'), icon: 'fas fa-circle-plus' },
        ],
      }
    }
    // Expand the flat "distribution" module into an accordion holding the
    // Auto Stopsell drawer action and the Channel Logs page.
    if (item.key === 'distribution') {
      return {
        ...item,
        to: undefined,
        children: [
          { action: 'stop-sell', label: t('distribution.autoStopsell'), icon: 'fas fa-hand' },
          { to: '/app/distribution/channel-logs', label: t('distribution.channelLogs'), icon: 'fas fa-list-ul' },
        ],
      }
    }
    return item
  })
})

/** Toggle an accordion group open/closed in the staff drawer. */
function toggleAccordion(key) {
  const next = new Set(openAccordions.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openAccordions.value = next
}

/** Runs a non-route accordion action (e.g. opening the Auto Stopsell drawer). */
function handleAccordionAction(moduleKey, action) {
  if (moduleKey === 'distribution' && action === 'stop-sell') {
    sideOpen.value = false
    openStopsell()
    if (route.path !== '/app/distribution/channel-logs') {
      router.push('/app/distribution/channel-logs')
    }
  }
}

const { openStopsell } = useDistribution()

// Auto-expand the Night Audit and Distribution accordions whenever the user
// is on one of their child pages so the active item stays visible when the
// drawer opens.
watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/app/night-audit')) {
      const next = new Set(openAccordions.value)
      next.add('night-audit')
      openAccordions.value = next
    }
    if (path.startsWith('/app/distribution')) {
      const next = new Set(openAccordions.value)
      next.add('distribution')
      openAccordions.value = next
    }
  },
  { immediate: true },
)

/**
 * Sets the UI language explicitly and persists the choice in localStorage.
 * @param {'en'|'sw'} lang - The language to switch to.
 */
function setLocale(lang) {
  locale.value = lang
  localStorage.setItem('locale', lang)
}

/**
 * Toggles the UI language between English and Swahili and persists the
 * choice in localStorage.
 */
function toggleLocale() {
  locale.value = locale.value === 'sw' ? 'en' : 'sw'
  localStorage.setItem('locale', locale.value)
}

/**
 * Submits the directory search query as a URL parameter and navigates to the
 * home page, closing any open mobile menu. An empty query resets the directory
 * back to its default (unfiltered) state.
 */
function handleSearch() {
  clearTimeout(searchTimer)
  const query = searchQuery.value.trim()
  router.push({ path: '/', query: query ? { search: query } : {} })
  navOpen.value = false
}

/**
 * Clears the directory search input and restores the default full list.
 */
function clearSearch() {
  clearTimeout(searchTimer)
  searchQuery.value = ''
  router.push({ path: '/', query: {} })
  navOpen.value = false
}

// Live search: re-run the directory query as the user types (or deletes), so
// clearing the bar automatically restores the full list.
let searchTimer = null
watch(searchQuery, (q) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const query = q.trim()
    router.push({ path: '/', query: query ? { search: query } : {} })
  }, 350)
})

// Keep the header input in sync when the directory is reset or deep-linked.
watch(
  () => route.query.search,
  (q) => {
    searchQuery.value = Array.isArray(q) ? q[0] : (q || '')
  }
)

/**
 * Logs the user out via the auth store and returns to the portal home page.
 *
 * @returns {Promise<void>}
 */
async function handleLogout() {
  navOpen.value = false
  await authStore.logout()
  router.push('/')
}

// Close the mobile menu when switching between the app and directory modes.
watch(isAppMode, () => {
  navOpen.value = false
})

/**
 * Keeps the WebSocket + tenant presence channel in step with the session:
 * join once the user has a tenant, and tear both down on logout. This makes
 * the online-status dots accurate across the whole app, not just the chat.
 */
function syncPresence() {
  if (authStore.isAuthenticated && authStore.user?.tenant_id) {
    initEcho()
    joinPresence(authStore.user.tenant_id, authStore.user)
  } else if (!authStore.isAuthenticated) {
    leavePresence()
    destroyEcho()
  }
}

// A refresh restores the token instantly but loads /auth/me afterwards, so
// watch both the session flag and the tenant id (resolves once the profile
// arrives).
watch(() => authStore.isAuthenticated, syncPresence)
watch(() => authStore.user?.tenant_id, syncPresence)

onMounted(() => {
  syncPresence()
  notifStore.init()
  // Show the TSCL services card on every fresh visit (page load / refresh).
  // The × only hides it while browsing — navigating between pages keeps it
  // away since the layout stays mounted.
  welcomeAdOpen.value = true
})

// Desktop tooltip dismissal — plain component state, so a page refresh
// brings it back automatically.
const poweredTipOpen = ref(true)

// Mobile welcome card visibility.
const welcomeAdOpen = ref(false)

/** Dismisses the welcome card until the next page load. */
function closeWelcomeAd() {
  welcomeAdOpen.value = false
}

// The layout lives for the whole app session; release the socket on exit.
onUnmounted(() => {
  notifStore.destroy()
  leavePresence()
  destroyEcho()
})

/** Format a notification timestamp as a relative or absolute time string. */
function formatNotifTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.top-bar {
  background: var(--brand-dark);
  color: #fff;
  font-size: 13px;
  padding: 8px 0;
}

.top-bar-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.top-bar-left {
  display: flex;
  gap: 24px;
}

.top-bar-left span {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.85;
}

.top-bar-left i {
  color: var(--brand);
}

.top-bar-right {
  display: flex;
  gap: 12px;
}

.top-bar-tagline {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.85;
  font-weight: 500;
}

.top-bar-tagline i {
  color: var(--brand);
}

.main-header {
  background: #fff;
  padding: 16px 0;
  border-bottom: 1px solid #eee;
  position: relative;
  z-index: 100;
}

.main-header-inner {
  display: flex;
  align-items: center;
  gap: 32px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex-shrink: 0;
  position: relative;
}

.logo-icon {
  background: #fff url('/MRK_mark_transparent.png') center/78% no-repeat;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  font-size: 18px;
  box-shadow: 0 12px 32px rgba(0, 94, 184, 0.12);
  background-size: 70%;
}

.logo-icon i {
  opacity: 0;
}

.logo-text {
  font-size: 24px;
  font-weight: 800;
  color: var(--brand-dark);
}

.logo-text span {
  color: var(--brand);
}

.search-bar {
  flex: 1;
  display: flex;
  max-width: 500px;
}

.search-input-wrap {
  position: relative;
  flex: 1;
}

.search-input-wrap input {
  width: 100%;
  padding: 12px 44px 12px 16px;
  border: 2px solid #858585;
  border-radius: 4px;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
}

.search-input-wrap input:focus {
  outline: none;
  border-color: var(--brand);
}

.search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  padding: 6px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
}

.search-clear:hover {
  color: #475569;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.action-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #555;
  font-size: 12px;
  text-decoration: none;
  transition: color 0.2s;
  position: relative;
}

.action-link:hover {
  color: var(--brand);
}

.action-link.router-link-exact-active {
  color: var(--brand);
}

.action-link i {
  font-size: 20px;
}

.action-label {
  font-weight: 500;
}

.logout-btn {
  cursor: pointer;
  background: none;
  border: none;
  font-family: inherit;
}

.hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
}

/* The staff-drawer hamburger is always visible in /app mode */
.hamburger.side-hamburger {
  display: flex;
}

/* Sidebar logo: keep the brand styling inside the dark drawer */
.drawer-brand.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  font-size: 1.25rem;
}

.hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: #333;
  border-radius: 2px;
  transition: all 0.3s;
}

/* Staff drawer: dark overlay + sliding panel */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1400;
}

.staff-drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  max-width: 85vw;
  background: #005eb8;
  color: #e8f2fb;
  z-index: 1500;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.35);
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid #004a93;
}

.drawer-brand {
  font-weight: 700;
  font-size: 17px;
}

.drawer-brand span {
  color: #c9a227;
}

.drawer-close {
  background: none;
  border: none;
  color: #a9d1f2;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 6px;
}

.drawer-close:hover {
  color: #fff;
}

.drawer-nav {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
  display: flex;
  flex-direction: column;
}

.drawer-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  color: #d6e9f9;
  text-decoration: none;
  font-size: 14px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  font-family: inherit;
}

.drawer-link i {
  width: 18px;
  text-align: center;
  color: #a9d1f2;
}

.drawer-link:hover,
.drawer-link.router-link-active {
  background: #004a93;
  color: #fff;
}

.drawer-link:hover i,
.drawer-link.router-link-active i {
  color: #c9a227;
}

.drawer-link.logout {
  color: #ffd7d7;
}

/* Night Audit accordion group in the staff drawer. */
.drawer-acc-head {
  padding-right: 16px;
}

.drawer-acc-caret {
  margin-left: auto;
  width: auto;
  transition: transform 0.2s ease;
}

.drawer-acc-caret.open {
  transform: rotate(180deg);
}

.drawer-acc-children {
  display: flex;
  flex-direction: column;
}

.drawer-acc-child {
  padding-left: 34px;
  font-size: 13px;
}


.drawer-notif-badge {
  margin-left: auto;
  background: #dc2626;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  padding: 2px 8px;
}

.drawer-foot {
  border-top: 1px solid #004a93;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.25s;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.28s ease;
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(-100%);
}

.hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: #333;
  border-radius: 2px;
  transition: all 0.3s;
}

.hamburger.active span:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}

.hamburger.active span:nth-child(2) {
  opacity: 0;
}

.hamburger.active span:nth-child(3) {
  transform: rotate(-45deg) translate(5px, -5px);
}

.main-nav {
  background: var(--brand);
}

/* In staff app mode the navigation bar is gone — staff use the hamburger
   sidebar drawer, which keeps notifications/profile inside it on mobile. */
.main-nav--app {
  display: none;
}

.nav-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-links {
  display: flex;
}

.nav-scroll {
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.4) transparent;
  max-width: 100%;
}

.nav-link {
  color: #fff;
  padding: 14px 20px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.nav-link i {
  font-size: 13px;
}

/* "POWERED BY TSCL" pricing link (caps) — real tooltip bubble with a close
   button. Component state drives visibility, so a refresh restores it. */
.nav-powered-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.nav-link--powered {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #fbbf24;
}

.nav-link--powered:hover {
  color: #fcd34d;
}

.powered-tip-bubble {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  max-width: min(420px, 90vw);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #1e293b;
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: normal;
  text-transform: none;
  line-height: 1.5;
  padding: 9px 12px;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  z-index: 200;
  animation: powered-tip-in 0.18s ease both;
}

.powered-tip-bubble::before {
  content: '';
  position: absolute;
  top: -4px;
  right: 18px;
  width: 9px;
  height: 9px;
  background: #1e293b;
  border-radius: 2px;
  transform: rotate(45deg);
}

@keyframes powered-tip-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.powered-tip-close {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin: -2px -4px -2px 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  font-size: 9px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s ease;
}

.powered-tip-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.nav-link:hover {
  background: rgba(0, 0, 0, 0.1);
}

.nav-link.router-link-exact-active {
  background: rgba(0, 0, 0, 0.2);
  box-shadow: inset 0 -3px 0 rgba(255, 255, 255, 0.85);
}

.nav-portal {
  border-left: 1px solid rgba(255, 255, 255, 0.25);
}

.nav-right {
  display: flex;
  align-items: center;
}

.nav-text {
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.9;
  white-space: nowrap;
  padding-left: 20px;
}

.mobile-dropdown {
  display: none;
  background: #fff;
  border-top: 1px solid #eee;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 99;
  max-height: 0;
  overflow: hidden;
  transition:
    max-height 0.3s ease,
    opacity 0.3s ease;
  opacity: 0;
}

.mobile-dropdown.open {
  max-height: 80vh;
  overflow-y: auto;
  opacity: 1;
}

.mobile-dropdown-inner {
  padding: 12px 0;
}

.mobile-search {
  display: none;
  padding: 0 16px 12px;
}

.mobile-search input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #eee;
  border-radius: 8px;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
}

.mobile-search input:focus {
  outline: none;
  border-color: var(--brand);
}

.mobile-search-row {
  position: relative;
}

.mobile-search-row input {
  width: 100%;
  padding: 12px 44px 12px 16px;
  border: 2px solid #eee;
  border-radius: 8px;
}

.mobile-search-row .search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  padding: 6px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
}

.mobile-lang-flag {
  font-size: 16px;
  line-height: 1;
}

.mobile-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  color: #333;
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  transition: background 0.15s;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
}

.mobile-link:hover {
  background: #f5f5f5;
}

.mobile-link.router-link-exact-active {
  background: #e8f1fb;
  color: var(--brand);
  font-weight: 700;
}

.mobile-link.router-link-exact-active i {
  color: var(--brand);
}

.mobile-link i {
  width: 20px;
  text-align: center;
  color: var(--brand);
  font-size: 16px;
}

.mobile-link.logout {
  color: var(--brand);
}

.mobile-divider {
  height: 1px;
  background: #eee;
  margin: 8px 16px;
}

.site-footer {
  background: var(--brand-dark);
  color: #ccc;
  padding-top: 48px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 40px;
  padding-bottom: 40px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  position: relative;
}

.footer-logo .logo-icon {
  width: 44px;
  height: 44px;
  font-size: 16px;
  background: #fff url('/MRK_mark_transparent.png') center/78% no-repeat;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background-size: 70%;
}

.footer-logo .logo-icon i {
  opacity: 0;
}

.footer-logo .logo-text {
  color: #fff;
  font-size: 20px;
}

.footer-desc {
  font-size: 13px;
  line-height: 1.7;
  opacity: 0.7;
}

.site-footer h4 {
  color: #fff;
  font-size: 15px;
  margin-bottom: 16px;
}

.site-footer a,
.site-footer p {
  display: block;
  font-size: 13px;
  color: #ccc;
  text-decoration: none;
  margin-bottom: 10px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.site-footer a:hover {
  opacity: 1;
  color: var(--brand);
}

/* Footer "POWERED BY TSCL" pricing link — plain on desktop; the explainer
   line below only appears in the mobile breakpoint. */
.footer-powered-link {
  display: inline-block !important;
  font-size: 11px !important;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #fbbf24 !important;
}

.footer-powered-link:hover {
  color: #fcd34d !important;
}

.footer-powered-tip {
  display: none;
}

/* Welcome card — TSCL services pitch, once per visit. Mobile-only:
   desktop visitors already see the nav tooltip next to the link. */
.welcome-ad {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 300;
}

.welcome-ad-card {
  position: relative;
  background: #101826;
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: 16px;
  padding: 18px 16px 16px;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45);
  max-width: 420px;
  margin: 0 auto;
}

.welcome-ad-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  font-size: 12px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.welcome-ad-close:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.welcome-ad-kicker {
  margin: 0 0 4px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fbbf24;
}

.welcome-ad-title {
  margin: 0 0 10px;
  font-size: 17px;
  line-height: 1.3;
  color: #fff;
}

.welcome-ad-services {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  display: grid;
  gap: 7px;
}

.welcome-ad-services li {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.82);
}

.welcome-ad-services i {
  width: 15px;
  text-align: center;
  color: #fbbf24;
  font-size: 12px;
}

.welcome-ad-cta {
  display: block;
  text-align: center;
  padding: 10px 14px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
}

.welcome-ad-cta:hover {
  filter: brightness(1.08);
}

/* Slide-up entrance/exit for the welcome card. */
.welcome-ad-enter-active,
.welcome-ad-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.welcome-ad-enter-from,
.welcome-ad-leave-to {
  opacity: 0;
  transform: translateY(24px);
}

@media (min-width: 769px) {
  .welcome-ad {
    display: none;
  }
}

.site-footer p i {
  color: var(--brand);
  width: 18px;
  margin-right: 4px;
}

.footer-bottom {
  padding: 20px 0;
  text-align: center;
  font-size: 13px;
  opacity: 0.5;
}

.lang-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 3px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
}

.lang-option {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: none;
  background: none;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-option:hover {
  color: var(--brand);
}

.lang-option.active {
  background: #fff;
  color: var(--brand);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
}

.lang-flag {
  font-size: 15px;
  line-height: 1;
}

.lang-code {
  line-height: 1;
}

@media (max-width: 768px) {
  .top-bar {
    display: none;
  }

  .main-header-inner {
    gap: 6px;
    justify-content: space-between;
  }

  .search-bar {
    display: none;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .header-actions .action-label {
    display: none;
  }

  .header-actions .action-link {
    gap: 0;
  }

  .logo-text {
    font-size: 17px;
  }

  .logo-icon {
    width: 34px;
    height: 34px;
    font-size: 15px;
  }

  .header-actions {
    display: none;
  }

  .hamburger {
    display: flex;
  }

  .main-nav {
    display: none;
  }

  .mobile-dropdown {
    display: block;
  }

  .mobile-search {
    display: flex;
    flex-direction: column;
  }

  .footer-grid {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  /* Mobile footer: surface the pricing explainer as a quiet inline line
     under the link — no tooltip machinery, keeps the client info readable. */
  .footer-powered-tip {
    display: block;
    font-size: 11px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.45);
    margin-top: 4px;
    max-width: 280px;
  }
}

@media (min-width: 769px) {
  .mobile-dropdown {
    display: none !important;
  }
}

.owner-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  background: #1a1a2e;
  color: #fff;
  padding: 10px 16px;
  font-size: 13px;
}

.owner-banner i {
  color: #7db8f0;
}

.owner-banner-readonly {
  background: rgba(255, 255, 255, 0.12);
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.owner-banner-btn {
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.owner-banner-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

/* --- Notification bell & dropdown --- */
.nav-bell {
  position: relative;
  background: none;
  border: none;
  color: inherit;
  font-size: 18px;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: background 0.15s;
}

.nav-bell:hover {
  background: rgba(0, 0, 0, 0.06);
}

.nav-bell-badge {
  position: absolute;
  top: -2px;
  right: -4px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}

.notif-dropdown {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.notif-panel {
  position: absolute;
  top: 60px;
  right: 16px;
  width: 380px;
  max-height: 70vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.notif-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.notif-panel-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.notif-mark-all {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.notif-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.notif-section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.04em;
  padding: 4px 8px;
  margin: 0;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 8px;
  transition: background 0.1s;
}

.notif-item:hover {
  background: #f1f5f9;
}

.notif-item-btn {
  width: 100%;
  border: none;
  background: none;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}

.notif-item--alert {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.notif-item--alert:hover {
  background: #fef3c7;
}

.notif-item-body {
  flex: 1;
  min-width: 0;
}

.notif-item-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  display: block;
}

.notif-item-text {
  font-size: 12px;
  color: #64748b;
  margin: 2px 0 0;
  line-height: 1.4;
}

.notif-item-time {
  font-size: 11px;
  color: #94a3b8;
}

.notif-item-dismiss {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  flex-shrink: 0;
}

.notif-item-dismiss:hover {
  background: rgba(0, 0, 0, 0.06);
  color: #64748b;
}

.notif-empty {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  padding: 24px 16px;
  margin: 0;
}

.notif-panel-foot {
  padding: 10px 16px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}
</style>
