<template>
  <div class="store-layout">
    <header class="site-header">
      <div class="top-bar">
        <div class="container top-bar-inner">
          <div class="top-bar-left">
            <span><i class="fas fa-phone"></i> +255 700 000 000</span>
            <span><i class="fas fa-envelope"></i> bookings@mrkhotels.com</span>
            <span><i class="fas fa-location-dot"></i> {{ $t('topBar.location') }}</span>
          </div>
          <div class="top-bar-right" v-if="!isAppMode">
            <span class="top-bar-tagline"><i class="fas fa-hotel"></i> {{ $t('topBar.tagline') }}</span>
          </div>
          <div class="top-bar-right" v-else>
            <span class="top-bar-tagline"><i class="fas fa-hotel"></i> {{ hotelName }}</span>
          </div>
        </div>
      </div>

      <div class="main-header">
        <div class="container main-header-inner">
          <router-link :to="homeLink" class="logo" @click="navOpen = false">
            <span class="logo-icon"><i class="fas fa-hotel"></i></span>
            <span class="logo-text">MRK<span>Hotels</span></span>
          </router-link>

          <div v-if="isDirectory" class="search-bar">
            <input v-model="searchQuery" type="text" :placeholder="$t('search.placeholder')"
              @keyup.enter="handleSearch" />
            <button @click="handleSearch" class="search-btn"><i class="fas fa-search"></i></button>
          </div>

          <div class="header-actions">
            <router-link v-if="isAppMode" :to="{ name: 'public-home' }" class="action-link" @click="navOpen = false">
              <i class="fas fa-store"></i>
              <span class="action-label">{{ $t('nav.portal') }}</span>
            </router-link>

            <template v-if="authStore.isAuthenticated">
              <router-link :to="dashboardRoute" class="action-link" @click="navOpen = false">
                <i class="fas fa-gauge-high"></i>
                <span class="action-label">{{ $t('nav.dashboard') }}</span>
              </router-link>
              <router-link v-if="isAppMode" :to="{ name: 'hotel-profile' }" class="action-link"
                @click="navOpen = false">
                <i class="fas fa-user-circle"></i>
                <span class="action-label">{{ $t('nav.profile') }}</span>
              </router-link>
              <button @click="handleLogout" class="action-link logout-btn">
                <i class="fas fa-right-from-bracket"></i>
                <span class="action-label">{{ $t('nav.logout') }}</span>
              </button>
            </template>
            <template v-else>
              <router-link to="/login" class="action-link">
                <i class="fas fa-user"></i>
                <span class="action-label">{{ $t('nav.signIn') }}</span>
              </router-link>
            </template>

            <button class="lang-switch" @click="toggleLocale"
              :title="locale === 'sw' ? $t('topBar.switchToEnglish') : $t('topBar.switchToSwahili')">
              {{ locale === 'sw' ? 'EN' : 'SW' }}
            </button>
          </div>

          <button class="hamburger" :class="{ active: navOpen }" @click="navOpen = !navOpen">
            <span></span><span></span><span></span>
          </button>
        </div>

        <!-- Collapsible mobile menu with the same links as the desktop nav. -->
        <div class="mobile-dropdown" :class="{ open: navOpen }">
          <div class="mobile-dropdown-inner">
            <div v-if="isDirectory" class="mobile-search">
              <input v-model="searchQuery" type="text" :placeholder="$t('search.placeholder')"
                @keyup.enter="handleSearch(); navOpen = false" />
              <button @click="handleSearch(); navOpen = false" class="search-btn"><i class="fas fa-search"></i></button>
            </div>

            <template v-if="isAppMode">
              <router-link v-for="item in visibleModules" :key="item.to" :to="item.to" class="mobile-link"
                @click="navOpen = false">
                <i :class="item.icon"></i> {{ item.label }}
              </router-link>
              <div class="mobile-divider"></div>
              <router-link :to="{ name: 'public-home' }" class="mobile-link" @click="navOpen = false">
                <i class="fas fa-store"></i> {{ $t('nav.portal') }}
              </router-link>
            </template>
            <template v-else>
              <router-link :to="{ name: 'public-home' }" class="mobile-link" @click="navOpen = false">
                <i class="fas fa-hotel"></i> {{ $t('nav.hotels') }}
              </router-link>
              <router-link :to="{ name: 'public-booking' }" class="mobile-link" @click="navOpen = false">
                <i class="fas fa-calendar-check"></i> {{ $t('nav.bookStay') }}
              </router-link>
            </template>

            <div class="mobile-divider"></div>

            <template v-if="authStore.isAuthenticated">
              <router-link :to="dashboardRoute" class="mobile-link" @click="navOpen = false">
                <i class="fas fa-gauge-high"></i> {{ $t('nav.dashboard') }}
              </router-link>
              <button @click="handleLogout" class="mobile-link logout">
                <i class="fas fa-right-from-bracket"></i> {{ $t('nav.logout') }}
              </button>
            </template>
            <template v-else>
              <router-link to="/login" class="mobile-link" @click="navOpen = false">
                <i class="fas fa-user"></i> {{ $t('nav.signIn') }}
              </router-link>
            </template>

            <div class="mobile-divider"></div>

            <button class="mobile-link" @click="toggleLocale">
              <i class="fas fa-language"></i>
              {{ locale === 'sw' ? $t('topBar.switchToEnglish') : $t('topBar.switchToSwahili') }}
            </button>
          </div>
        </div>
      </div>

      <nav class="main-nav">
        <div class="container nav-inner">
          <div v-if="isAppMode" class="nav-links nav-scroll">
            <router-link v-for="item in visibleModules" :key="item.to" :to="item.to" class="nav-link"
              @click="navOpen = false">
              <i :class="item.icon"></i> {{ item.label }}
            </router-link>
            <router-link :to="{ name: 'public-home' }" class="nav-link nav-portal" @click="navOpen = false">
              <i class="fas fa-store"></i> {{ $t('nav.portal') }}
            </router-link>
          </div>
          <div v-else class="nav-links">
            <router-link :to="{ name: 'public-home' }" class="nav-link" @click="navOpen = false">
              <i class="fas fa-hotel"></i> {{ $t('nav.hotels') }}
            </router-link>
            <router-link :to="{ name: 'public-booking' }" class="nav-link" @click="navOpen = false">
              <i class="fas fa-calendar-check"></i> {{ $t('nav.bookStay') }}
            </router-link>
          </div>
          <div class="nav-right">
            <span v-if="isAppMode" class="nav-text"><i class="fas fa-user-shield"></i> {{ roleLabel }}</span>
            <span v-else class="nav-text"><i class="fas fa-moon"></i> {{ $t('nav.fastBooking') }}</span>
          </div>
        </div>
      </nav>
    </header>

    <!-- Read-only banner shown when an owner is previewing one of their hotels. -->
    <div v-if="isOwnerViewing" class="owner-banner">
      <i class="fas fa-eye"></i>
      <span>{{ $t('owner.viewingHotel', { hotel: viewingHotelName }) }}</span>
      <span class="owner-banner-readonly">{{ $t('owner.readOnly') }}</span>
      <button class="owner-banner-btn" @click="exitOwnerView">
        <i class="fas fa-arrow-left"></i> {{ $t('owner.backToOwnerPanel') }}
      </button>
    </div>

    <main>
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <div class="footer-logo">
            <span class="logo-icon"><i class="fas fa-hotel"></i></span>
            <span class="logo-text">MRK<span>Hotels</span></span>
          </div>
          <p class="footer-desc">{{ $t('footer.description') }}</p>
        </div>
        <div>
          <h4>{{ $t('footer.quickLinks') }}</h4>
          <router-link :to="{ name: 'public-home' }">{{ $t('nav.hotels') }}</router-link>
          <router-link :to="{ name: 'public-booking' }">{{ $t('nav.bookStay') }}</router-link>
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
          <p><i class="fas fa-phone"></i> +255 700 000 000</p>
          <p><i class="fas fa-envelope"></i> bookings@mrkhotels.com</p>
          <p><i class="fas fa-location-dot"></i> {{ $t('topBar.location') }}</p>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="container">
          <span>{{ $t('footer.copyright', { year }) }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { MODULES } from '@/config/modules'
import { clearOwnerHotel, ownerHotelId, ownerHotelName } from '@/utils/ownerView'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const authStore = useAuthStore()

const year = new Date().getFullYear()
// Header UI state: the mobile menu toggle and the directory search query.
const navOpen = ref(false)
const searchQuery = ref('')

// Human-readable labels for every user role the portal can authenticate.
const ROLE_LABELS = {
  superadmin: 'Superadmin',
  owner: 'Owner',
  hotel_admin: 'Hotel Admin',
  manager: 'Manager',
  accountant: 'Accountant',
  receptionist: 'Receptionist',
  procurement_officer: 'Procurement Officer',
  housekeeping: 'Housekeeping',
  kitchen: 'Kitchen',
  waiter: 'Waiter / Bartender',
  bartender: 'Waiter / Bartender',
  staff: 'Staff',
}

// Mode detection: whether the header renders the hotel app (/app) or the
// public directory, and which root the logo should link to.
const isAppMode = computed(() => route.path.startsWith('/app'))
const isDirectory = computed(() => route.name === 'public-home')

const homeLink = computed(() => (isAppMode.value ? '/app' : '/'))

// Branding and role text: the current hotel's name (or the viewed hotel when
// an owner is browsing) and the user's role label.
const hotelName = computed(() =>
  isOwnerViewing.value ? viewingHotelName.value : (authStore.user?.tenant?.hotel_name || 'MRK Hotels'),
)
const roleLabel = computed(() => ROLE_LABELS[authStore.user?.user_role] || 'Staff')

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
const visibleModules = computed(() =>
  MODULES.filter((item) => authStore.canAccess(item)).map((item) => ({
    ...item,
    label: t(item.labelKey),
  })),
)

/**
 * Switches the UI language between English and Swahili and persists the
 * choice in localStorage.
 */
function toggleLocale() {
  locale.value = locale.value === 'sw' ? 'en' : 'sw'
  localStorage.setItem('locale', locale.value)
}

/**
 * Submits the directory search query as a URL parameter and navigates to the
 * home page, closing any open mobile menu.
 */
function handleSearch() {
  if (searchQuery.value.trim()) {
    router.push({ path: '/', query: { search: searchQuery.value } })
    navOpen.value = false
  }
}

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

.search-bar input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #eee;
  border-right: none;
  border-radius: 4px 0 0 4px;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
}

.search-bar input:focus {
  outline: none;
  border-color: var(--brand);
}

.search-btn {
  padding: 12px 20px;
  background: var(--brand);
  color: #fff;
  border-radius: 0 4px 4px 0;
  font-size: 16px;
  border: none;
  cursor: pointer;
}

.search-btn:hover {
  background: var(--brand-dark);
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
  transition: max-height 0.3s ease, opacity 0.3s ease;
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

.mobile-search .search-btn {
  border-radius: 8px;
  margin-top: 8px;
  width: 100%;
  padding: 12px;
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
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 700;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-switch:hover {
  border-color: var(--brand);
  color: var(--brand);
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

</style>
