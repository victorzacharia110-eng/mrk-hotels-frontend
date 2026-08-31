<!--
  CashierLayout — dedicated point-of-sale panel for the cashier role.
  Dark sidebar with the POS sections (Ordering / Order Summary / Manager),
  top bar carrying the working date, the outlet selector and the Waiter
  Assignment shortcut. On first entry the outlet gate forces a choice
  between the property's outlets (e.g. "Brand Hotel" vs "BAR OUT").
-->

<template>
  <div class="pos-layout" :class="{ collapsed: sidebarCollapsed, 'mobile-open': mobileOpen }">
    <div v-if="mobileOpen" class="pos-backdrop" @click="mobileOpen = false"></div>
    <aside class="pos-sidebar">
      <router-link :to="{ name: 'cashier-dine-in' }" class="pos-brand">
        <img src="/MRK_logo_transparent.png" alt="MRK Hotels" class="pos-brand-logo" />
        <span class="pos-brand-text" v-show="!sidebarCollapsed"><strong>MRK</strong> {{ $t('cashier.panelTitle') }}</span>
      </router-link>

      <nav class="pos-nav">
        <p class="pos-nav-heading" v-show="!sidebarCollapsed">{{ $t('cashier.nav.ordering') }}</p>
        <router-link v-for="item in orderingNav" :key="item.to" :to="item.to" class="pos-nav-link"
          :class="{ active: isActive(item.to) }" :title="$t(item.labelKey)" @click="mobileOpen = false">
          <i :class="item.icon" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t(item.labelKey) }}</span>
        </router-link>

        <p class="pos-nav-heading" v-show="!sidebarCollapsed">{{ $t('cashier.nav.summaryGroup') }}</p>
        <router-link :to="{ name: 'cashier-order-summary' }" class="pos-nav-link"
          :class="{ active: isActive('/cashier/order-summary') }" @click="mobileOpen = false">
          <i class="fas fa-list-ul" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.orderSummary') }}</span>
        </router-link>

        <p class="pos-nav-heading" v-show="!sidebarCollapsed">{{ $t('cashier.nav.managerGroup') }}</p>
        <router-link :to="{ name: 'cashier-item-lookup' }" class="pos-nav-link"
          :class="{ active: isActive('/cashier/item-lookup') }" @click="mobileOpen = false">
          <i class="fas fa-book-open" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.itemLookup') }}</span>
        </router-link>
        <router-link :to="{ name: 'cashier-ingredients' }" class="pos-nav-link"
          :class="{ active: isActive('/cashier/ingredients') }" @click="mobileOpen = false">
          <i class="fas fa-flask" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.ingredients') }}</span>
        </router-link>
        <router-link :to="{ name: 'cashier-printer' }" class="pos-nav-link"
          :class="{ active: isActive('/cashier/printer') }" @click="mobileOpen = false">
          <i class="fas fa-print" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('cashier.nav.printer') }}</span>
        </router-link>
      </nav>

      <div class="pos-sidebar-footer">
        <button @click="switchOutlet" class="pos-nav-link">
          <i class="fas fa-right-left" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('cashier.topbar.switchOutlet') }}</span>
        </button>
        <button @click="handleLogout" class="pos-nav-link pos-logout">
          <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('common.logout') }}</span>
        </button>
      </div>
    </aside>

    <div class="pos-main">
      <header class="pos-topbar">
        <button class="pos-collapse" @click="toggleSidebar" :aria-label="$t('nav.menuToggle')">
          <i class="fas fa-bars" aria-hidden="true"></i>
        </button>
        <h1 class="pos-page-title">{{ pageTitle }}</h1>
        <div class="pos-topbar-right">
          <span class="pos-working-date"><i class="fas fa-calendar-day" aria-hidden="true"></i> {{ workingDate }}</span>
          <button v-if="selectedOutlet" class="pos-outlet-select" @click="switchOutlet"
            :title="$t('cashier.topbar.switchOutlet')">
            <i class="fas fa-store" aria-hidden="true"></i> {{ selectedOutlet.name }}
            <i class="fas fa-chevron-down" aria-hidden="true"></i>
          </button>
          <router-link :to="{ name: 'cashier-waiter-assignment' }" class="pos-waiter-btn">
            <i class="fas fa-user-group" aria-hidden="true"></i> {{ $t('cashier.nav.waiterAssignment') }}
          </router-link>
          <div class="sm-user">
            <span class="sm-user-avatar" aria-hidden="true">{{ userInitials }}</span>
            <span class="sm-user-meta">
              <strong>{{ authStore.user?.name }}</strong>
              <RoleBadge />
            </span>
          </div>
        </div>
      </header>

      <main class="pos-content" id="main-content">
        <router-view />
      </main>
    </div>

    <!-- Outlet gate: blocks the panel until an outlet is picked. -->
    <div v-if="gateOpen" class="sm-modal-backdrop">
      <div class="sm-modal" role="dialog" aria-modal="true">
        <div class="sm-modal-head">
          <h3><i class="fas fa-store" aria-hidden="true"></i> {{ $t('cashier.outletGate.title') }}</h3>
        </div>
        <p class="gate-hint">{{ $t('cashier.outletGate.hint', { hotel: hotelName }) }}</p>
        <div class="outlet-gate-list">
          <button v-for="outlet in outlets" :key="outlet.outlet_id" class="outlet-option"
            @click="chooseOutlet(outlet)">
            <span class="ico"><i :class="outlet.type === 'bar' ? 'fas fa-martini-glass-citrus' : 'fas fa-utensils'"
              aria-hidden="true"></i></span>
            <span>
              <strong>{{ outlet.name }}</strong>
              <small>{{ outlet.type === 'bar' ? $t('cashier.outletGate.barType') : $t('cashier.outletGate.restaurantType') }}</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { outletApi } from '@/api'
import { selectedOutlet } from '@/pages/cashier/outlet-context'
import { restorePrinter } from '@/utils/printer'
import RoleBadge from '@/components/RoleBadge.vue'

const OUTLET_KEY = 'cashier_outlet'

const route = useRoute()
const router = useRouter()
const { t, d } = useI18n()
const authStore = useAuthStore()

const outlets = ref([])
const gateOpen = ref(false)
const sidebarCollapsed = ref(false)
const mobileOpen = ref(false)

function toggleSidebar() {
  if (window.matchMedia('(max-width: 900px)').matches) mobileOpen.value = !mobileOpen.value
  else sidebarCollapsed.value = !sidebarCollapsed.value
}

watch(() => route.path, () => {
  mobileOpen.value = false
})

const orderingNav = [
  { to: '/cashier/dine-in', icon: 'fas fa-chair', labelKey: 'cashier.nav.dineIn' },
  { to: '/cashier/take-away', icon: 'fas fa-bag-shopping', labelKey: 'cashier.nav.takeAway' },
  { to: '/cashier/room-service', icon: 'fas fa-bed', labelKey: 'cashier.nav.roomService' },
  { to: '/cashier/delivery', icon: 'fas fa-motorcycle', labelKey: 'cashier.nav.delivery' },
  { to: '/cashier/no-charge', icon: 'fas fa-gift', labelKey: 'cashier.nav.noCharge' },
]

const pageTitle = computed(() => (route.meta.titleKey ? t(route.meta.titleKey) : t('cashier.panelTitle')))
const userInitials = computed(() => {
  const name = authStore.user?.name || ''
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'CS'
})
const hotelName = computed(() => authStore.tenant?.hotel_name || '')
const workingDate = d(new Date(), 'long')

function isActive(to) {
  return route.path.startsWith(to)
}

/** Loads outlets and re-applies the persisted selection. */
async function loadOutlets() {
  const { data } = await outletApi.index()
  outlets.value = data.outlets || []
  const savedId = sessionStorage.getItem(OUTLET_KEY)
  selectedOutlet.value = outlets.value.find((o) => o.outlet_id === savedId) || null
  if (!selectedOutlet.value) gateOpen.value = true
}

function chooseOutlet(outlet) {
  selectedOutlet.value = outlet
  sessionStorage.setItem(OUTLET_KEY, outlet.outlet_id)
  gateOpen.value = false
}

function switchOutlet() {
  gateOpen.value = true
}

async function handleLogout() {
  await authStore.logout()
  router.push({ name: 'login' })
}

onMounted(() => {
  loadOutlets()
  restorePrinter()
})
</script>

<style>
@import '@/pages/cashier/cashier-shared.css';
</style>

<style scoped>
.pos-layout {
  --mrk-blue: #005eb8;
  --mrk-blue-bright: #1269bd;
  --mrk-blue-deep: #00468c;
  --mrk-blue-tint: #b0cde9;
  --mrk-blue-pale: #e8f1fa;
  --mrk-charcoal: #333333;
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #f3f6fa;
  font-family: 'Inter', sans-serif;
  color: #1f2937;
}
.pos-sidebar {
  width: 230px;
  flex-shrink: 0;
  background: linear-gradient(180deg, var(--mrk-blue) 0%, var(--mrk-blue-deep) 100%);
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-y: auto;
  transition: width 0.2s ease;
}
.collapsed .pos-sidebar { width: 72px; }
.collapsed .pos-brand { justify-content: center; padding-inline: 8px; }
.pos-collapse {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  color: var(--mrk-blue);
  font-size: 15px;
  flex-shrink: 0;
}
.pos-collapse:hover { background: var(--mrk-blue-pale); }
.pos-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  text-decoration: none;
  color: #fff;
  background: var(--mrk-blue-dark);
  border-bottom: 3px solid var(--mrk-blue-tint);
}
.pos-brand-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  background: #fff;
  border-radius: 10px;
  padding: 4px;
  flex-shrink: 0;
}
.pos-brand-text { font-size: 15px; white-space: nowrap; color: #d7e6f9; }
.pos-brand-text strong { color: #fff; }
.pos-nav { flex: 1; padding: 12px 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.pos-nav-heading {
  margin: 10px 8px 2px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #b0cde9;
}
.pos-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 10px;
  color: #dbeafe;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  border-left: 3px solid transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.pos-nav-link i { width: 20px; text-align: center; font-size: 16px; flex-shrink: 0; }
.pos-nav-link:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
.pos-nav-link.router-link-active {
  background: #fff;
  border-left-color: var(--mrk-blue-bright);
  color: var(--mrk-blue-deep);
  font-weight: 700;
  box-shadow: 0 4px 14px rgba(6, 42, 82, 0.45);
}
.pos-sidebar-footer { padding: 10px; border-top: 1px solid rgba(255, 255, 255, 0.2); display: flex; flex-direction: column; gap: 4px; }
.pos-logout:hover { background: rgba(220, 38, 38, 0.25); color: #fca5a5; }
.pos-main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.pos-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 13px 24px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: inset 0 -3px 0 var(--mrk-blue);
  z-index: 20;
}
.pos-page-title { font-size: 18px; font-weight: 700; margin: 0; flex: 1; color: var(--mrk-charcoal); }
.pos-topbar-right { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.pos-working-date { font-size: 13px; color: #64748b; display: inline-flex; align-items: center; gap: 7px; }
.pos-outlet-select {
  display: inline-flex; align-items: center; gap: 9px;
  background: var(--mrk-blue-pale); color: var(--mrk-blue-deep);
  border: 1px solid var(--mrk-blue); border-radius: 999px;
  padding: 8px 14px; font-size: 13px; font-weight: 700;
  cursor: pointer; font-family: inherit;
}
.pos-outlet-select:hover { background: var(--mrk-blue-tint); }
.pos-waiter-btn {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--mrk-charcoal); color: #fff;
  border-radius: 999px; padding: 8px 14px;
  font-size: 13px; font-weight: 700; text-decoration: none;
}
.pos-waiter-btn:hover { background: #444444; }
.sm-user { display: flex; align-items: center; gap: 10px; }
.sm-user-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  background: var(--mrk-blue); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px;
}
.sm-user-meta { display: flex; flex-direction: column; line-height: 1.2; }
.sm-user-meta strong { font-size: 14px; color: var(--mrk-charcoal); }
.sm-user-meta small { color: #64748b; font-size: 12px; }
.pos-content { flex: 1; min-height: 0; overflow-y: auto; padding: 24px; }
.gate-hint { color: #64748b; font-size: 13px; margin: 4px 0 16px; }
.pos-backdrop { display: none; }
@media (max-width: 900px) {
  .pos-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 60;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: 8px 0 24px rgba(6, 42, 82, 0.35);
    width: 230px;
  }
  .mobile-open .pos-sidebar { transform: translateX(0); }
  .collapsed .pos-sidebar { width: 230px; }
  .collapsed .pos-brand { justify-content: flex-start; padding-inline: 16px; }
  .pos-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 55;
    background: rgba(33, 33, 33, 0.5);
  }
  .sm-user-meta { display: none; }
  .pos-page-title { font-size: 16px; }
}
</style>
