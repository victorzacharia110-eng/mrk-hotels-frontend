<!--
  StoreManagerLayout — dedicated panel for the store manager role.
  Dark-navy sidebar (MRK logo colors), top bar with page title + user chip.
-->

<template>
  <div class="sm-layout" :class="{ collapsed: sidebarCollapsed, 'mobile-open': mobileOpen }">
    <div v-if="mobileOpen" class="sm-backdrop" @click="mobileOpen = false"></div>
    <aside class="sm-sidebar">
      <router-link :to="{ name: 'store-dashboard' }" class="sm-brand">
        <img src="/MRK_logo_transparent.png" alt="MRK Hotels" class="sm-brand-logo" />
        <span class="sm-brand-text" v-show="!sidebarCollapsed"><strong>MRK</strong> {{ $t('storeManager.panelTitle') }}</span>
      </router-link>

      <nav class="sm-nav">
        <template v-for="item in navItems" :key="item.to">
          <div v-if="item.children" class="sm-nav-group">
            <button class="sm-nav-link sm-group" :class="{ active: groupActive(item), open: isOpen(item.labelKey) }"
              @click="toggleGroup(item.labelKey)">
              <i :class="item.icon" aria-hidden="true"></i>
              <span v-show="!sidebarCollapsed">{{ $t(item.labelKey) }}</span>
              <i v-show="!sidebarCollapsed" class="fas fa-chevron-down sm-chevron" aria-hidden="true"></i>
            </button>
            <div v-if="isOpen(item.labelKey) && !sidebarCollapsed" class="sm-subnav">
              <router-link v-for="child in item.children" :key="child.to" :to="child.to" class="sm-nav-link sm-sub"
                :class="{ active: isActive(child.to) }" @click="mobileOpen = false">
                <i :class="child.icon || 'fas fa-angle-right'" aria-hidden="true"></i>
                <span>{{ $t(child.labelKey) }}</span>
              </router-link>
            </div>
          </div>
          <router-link v-else :key="item.to" :to="item.to" class="sm-nav-link"
            :class="{ active: isActive(item.to) }" :title="sidebarCollapsed ? $t(item.labelKey) : undefined"
            @click="mobileOpen = false">
            <i :class="item.icon" aria-hidden="true"></i>
            <span v-show="!sidebarCollapsed">{{ $t(item.labelKey) }}</span>
          </router-link>
        </template>
      </nav>

      <div class="sm-sidebar-footer">
        <button @click="handleLogout" class="sm-nav-link sm-logout">
          <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
          <span v-show="!sidebarCollapsed">{{ $t('common.logout') }}</span>
        </button>
      </div>
    </aside>

    <div class="sm-main">
      <header class="sm-topbar">
        <button class="sm-collapse" @click="toggleSidebar" :aria-label="$t('nav.menuToggle')">
          <i class="fas fa-bars" aria-hidden="true"></i>
        </button>
        <h1 class="sm-page-title">{{ pageTitle }}</h1>
        <div class="sm-topbar-right">
          <router-link :to="{ name: 'store-messages' }" class="sm-icon-btn" :title="$t('storeManager.nav.messages')">
            <i class="fas fa-comments" aria-hidden="true"></i>
          </router-link>
          <div class="sm-user">
            <span class="sm-user-avatar" aria-hidden="true">{{ userInitials }}</span>
            <span class="sm-user-meta">
              <strong>{{ authStore.user?.name }}</strong>
              <small>{{ $t('common.roles.storeManager') }}</small>
            </span>
          </div>
        </div>
      </header>

      <main class="sm-content" id="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const sidebarCollapsed = ref(false)
const mobileOpen = ref(false)

function toggleSidebar() {
  if (window.matchMedia('(max-width: 900px)').matches) mobileOpen.value = !mobileOpen.value
  else sidebarCollapsed.value = !sidebarCollapsed.value
}

watch(() => route.path, () => {
  mobileOpen.value = false
})

// Module navigation of the store manager panel, following the client's
// requested menu: Dashboard, Purchase Orders, GRN, Expenses, Cash Register,
// Reports, Department Indents, Inventory and Back Office. Reports, Inventory
// and Back Office are expandable groups.
const navItems = [
  { to: '/store-manager', icon: 'fas fa-gauge-high', labelKey: 'storeManager.nav.dashboard' },
  { to: '/store-manager/purchase-orders', icon: 'fas fa-file-invoice', labelKey: 'storeManager.nav.purchaseOrders' },
  { to: '/store-manager/goods-received', icon: 'fas fa-clipboard-check', labelKey: 'storeManager.nav.goodsReceived' },
  { to: '/store-manager/expenses', icon: 'fas fa-money-bill-wave', labelKey: 'storeManager.nav.expenses' },
  { to: '/store-manager/cash-register', icon: 'fas fa-vault', labelKey: 'storeManager.nav.cashRegister' },
  {
    to: '/store-manager/reports',
    icon: 'fas fa-chart-line',
    labelKey: 'storeManager.nav.reports',
    children: [
      { to: '/store-manager/reports?view=ledger-summary', labelKey: 'storeManager.reports.stockLedger' },
      { to: '/store-manager/reports?view=transfer-register', labelKey: 'storeManager.reports.transferSummary' },
      { to: '/store-manager/reports?view=movement-detail', labelKey: 'storeManager.reports.movementDetail' },
      { to: '/store-manager/reports?view=stock-take-detail', labelKey: 'storeManager.reports.physicalStock' },
      { to: '/store-manager/reports?view=closing-stock', labelKey: 'storeManager.reports.closingStock' },
      { to: '/store-manager/reports?view=goods-return-register', labelKey: 'storeManager.reports.goodsReturns' },
    ],
  },
  { to: '/store-manager/indents', icon: 'fas fa-file-import', labelKey: 'storeManager.nav.indents' },
  {
    to: '/store-manager/inventory',
    icon: 'fas fa-boxes-stacked',
    labelKey: 'storeManager.nav.inventory',
    children: [
      { to: '/store-manager/low-stock', labelKey: 'storeManager.nav.lowStock' },
      { to: '/store-manager/stock-movements', labelKey: 'storeManager.nav.movements' },
      { to: '/store-manager/transfers', labelKey: 'storeManager.nav.transfers' },
      { to: '/store-manager/stock-counts', labelKey: 'storeManager.nav.stockCounts' },
      { to: '/store-manager/stock-adjust', labelKey: 'storeManager.nav.stockAdjust' },
    ],
  },
  {
    to: '/store-manager/back-office',
    icon: 'fas fa-address-book',
    labelKey: 'storeManager.nav.backOffice',
    children: [
      { to: '/store-manager/suppliers', labelKey: 'storeManager.nav.suppliers' },
    ],
  },
]

// Sidebar groups currently expanded.
const openGroups = ref(new Set())

function isOpen(labelKey) {
  return openGroups.value.has(labelKey)
}

function toggleGroup(labelKey) {
  const next = new Set(openGroups.value)
  if (next.has(labelKey)) next.delete(labelKey)
  else next.add(labelKey)
  openGroups.value = next
}

function groupActive(item) {
  return item.children.some((child) => isActive(child.to))
}

// Active-link test. Leaf targets match exactly on path (+ query view when a
// Reports child carries one); groups share their page's path.
function isActive(target) {
  const [path, qs] = target.split('?')
  if (path !== route.path) return false
  if (!qs) return true
  return new URLSearchParams(qs).get('view') === route.query.view
}

watch(() => route.query, () => {
  // Auto-expand whichever group contains the active route.
  const next = new Set(openGroups.value)
  for (const item of navItems) {
    if (item.children && item.children.some((child) => isActive(child.to))) next.add(item.labelKey)
  }
  openGroups.value = next
}, { immediate: true })

const pageTitle = computed(() => (route.meta.titleKey ? t(route.meta.titleKey) : t('storeManager.panelTitle')))
const userInitials = computed(() => {
  const name = authStore.user?.name || ''
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'SM'
})

async function handleLogout() {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<style>
@import '@/pages/store/store-shared.css';
</style>

<style scoped>
.sm-layout {
  --sm-blue: #005eb8;
  --sm-blue-dark: #00468c;
  --sm-blue-deep: #00468c;
  --sm-blue-darker: #062a52;
  --sm-blue-tint: #b0cde9;
  --sm-blue-light: #e8f1fa;
  --sm-text: #1f2937;
  --sm-muted: #64748b;
  --sm-bg: #f3f6fa;
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--sm-bg);
  font-family: 'Inter', sans-serif;
  color: var(--sm-text);
}
.sm-sidebar {
  width: 250px;
  flex-shrink: 0;
  background: linear-gradient(180deg, var(--sm-blue) 0%, var(--sm-blue-deep) 100%);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  transition: width 0.2s ease;
}
.collapsed .sm-sidebar { width: 72px; }
.sm-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  text-decoration: none;
  color: #fff;
  background: var(--sm-blue-darker);
  border-bottom: 3px solid var(--sm-blue-tint);
}
.sm-brand-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  background: #fff;
  border-radius: 10px;
  padding: 4px;
  flex-shrink: 0;
}
.sm-brand-text { font-size: 15px; white-space: nowrap; color: #b0cde9; }
.sm-brand-text strong { color: #fff; }
.sm-nav { flex: 1; padding: 12px 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.sm-nav-link {
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
  transition: background 0.15s, color 0.15s;
}
.sm-nav-link i { width: 20px; text-align: center; font-size: 16px; flex-shrink: 0; }
.sm-nav-link:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
.sm-nav-link.active {
  background: #fff;
  color: var(--sm-blue-deep);
  font-weight: 700;
  box-shadow: 0 4px 14px rgba(6, 42, 82, 0.45);
  border-left: 3px solid var(--mrk-blue-bright, #1269bd);
}
.sm-nav-group { display: flex; flex-direction: column; gap: 2px; }
.sm-chevron { margin-left: auto; transition: transform 0.2s ease; }
.sm-group.open .sm-chevron { transform: rotate(180deg); }
.sm-subnav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 10px;
  padding-left: 10px;
  border-left: 2px solid rgba(255, 255, 255, 0.18);
}
.sm-nav-link.sm-sub { padding: 9px 12px; font-size: 13px; font-weight: 500; }
.sm-sidebar-footer { padding: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1); }
.sm-logout:hover { background: rgba(220, 38, 38, 0.2); color: #fca5a5; }
.sm-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.sm-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 24px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 20;
}
.sm-collapse {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  color: var(--sm-blue);
  font-size: 15px;
}
.sm-collapse:hover { background: var(--sm-blue-light); }
.sm-page-title { font-size: 18px; font-weight: 700; margin: 0; flex: 1; color: var(--sm-blue-dark); }
.sm-topbar-right { display: flex; align-items: center; gap: 14px; }
.sm-icon-btn {
  width: 38px; height: 38px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: var(--sm-blue); background: var(--sm-blue-light);
  text-decoration: none; font-size: 16px;
}
.sm-user { display: flex; align-items: center; gap: 10px; }
.sm-user-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  background: var(--sm-blue); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px;
}
.sm-user-meta { display: flex; flex-direction: column; line-height: 1.2; }
.sm-user-meta strong { font-size: 14px; }
.sm-user-meta small { color: var(--sm-muted); font-size: 12px; }
.sm-content { flex: 1; padding: 24px; overflow-y: auto; min-height: 0; }
.sm-backdrop { display: none; }
@media (max-width: 900px) {
  .sm-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 60;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: 8px 0 24px rgba(6, 42, 82, 0.35);
  }
  .mobile-open .sm-sidebar { transform: translateX(0); }
  .collapsed .sm-sidebar { width: 250px; }
  .collapsed .sm-nav-link span, .collapsed .sm-brand-text { display: inline; }
  .sm-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 55;
    background: rgba(33, 33, 33, 0.5);
  }
  .sm-user-meta { display: none; }
  .sm-page-title { font-size: 16px; }
}
</style>
