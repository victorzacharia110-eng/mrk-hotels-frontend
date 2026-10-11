<!--
  BackOfficePage.vue
  Route: /app/back-office (module: back-office).

  Management panel review: "BACK OFFICE is the equivalent of SWITCH TO BACK on
  EZEE ABSOLUTE ... it's not just a dropdown that would have all pages but
  entirely like a REPORTS BROWSER from front desk. BACK OFFICE serves as the
  engine for management to set prices | time line of 24 hrs GMT or local time
  zone, Printer Configurations | HOTEL INFO such as name, logo, business motto,
  mode of payments settings, registering of LIPA NO and Bank Acc."

  This page is that engine: one browser of tiles, each opening the back-office
  setting it names. Tiles are filtered by the same feature gates the sidebar
  uses, so a property that does not run a module never sees a dead tile.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('backOffice.title') }}</h1>
        <p class="muted">{{ $t('backOffice.subtitle') }}</p>
      </div>
    </div>

    <div class="bo-grid">
      <router-link
        v-for="tile in tiles"
        :key="tile.key"
        :to="tile.to"
        class="bo-tile"
      >
        <span class="bo-tile-icon"><i :class="tile.icon" aria-hidden="true"></i></span>
        <span class="bo-tile-body">
          <strong class="bo-tile-title">{{ $t(tile.titleKey) }}</strong>
          <span class="bo-tile-desc">{{ $t(tile.descKey) }}</span>
        </span>
        <i class="fas fa-chevron-right bo-tile-go" aria-hidden="true"></i>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

// Every back-office surface the review names. `titleKey`/`descKey` resolve to
// backOffice.tiles.*; `to` is the existing page that owns the setting, so the
// browser never duplicates an editor — it routes to the one that exists.
const ALL_TILES = [
  {
    key: 'hotel-info',
    icon: 'fas fa-building-circle-check',
    titleKey: 'hotelSettings.title',
    descKey: 'backOffice.tiles.hotelInfo',
    to: { name: 'hotel-settings' },
  },
  {
    key: 'rates',
    icon: 'fas fa-tags',
    titleKey: 'backOffice.tiles.ratesTitle',
    descKey: 'backOffice.tiles.rates',
    to: { name: 'hotel-rooms' },
  },
  {
    key: 'printer',
    icon: 'fas fa-print',
    titleKey: 'nav.printer',
    descKey: 'backOffice.tiles.printer',
    to: { name: 'hotel-printer' },
  },
  {
    key: 'store-settings',
    icon: 'fas fa-receipt',
    titleKey: 'nav.backOffice',
    descKey: 'backOffice.tiles.receipt',
    to: { name: 'hotel-store-settings' },
  },
  {
    key: 'departments',
    icon: 'fas fa-building',
    titleKey: 'nav.departments',
    descKey: 'backOffice.tiles.departments',
    to: { name: 'hotel-departments' },
  },
  {
    key: 'categories',
    icon: 'fas fa-tags',
    titleKey: 'nav.categories',
    descKey: 'backOffice.tiles.categories',
    to: { name: 'hotel-categories' },
  },
  {
    key: 'suppliers',
    icon: 'fas fa-truck',
    titleKey: 'nav.suppliers',
    descKey: 'backOffice.tiles.suppliers',
    to: { name: 'hotel-suppliers' },
  },
  {
    key: 'staff',
    icon: 'fas fa-users-gear',
    titleKey: 'nav.staff',
    descKey: 'backOffice.tiles.staff',
    to: { name: 'hotel-staff' },
  },
  {
    key: 'trusted-devices',
    icon: 'fas fa-mobile-screen-button',
    titleKey: 'nav.trustedDevices',
    descKey: 'backOffice.tiles.trustedDevices',
    to: { name: 'hotel-trusted-devices' },
  },
  {
    key: 'import',
    icon: 'fas fa-file-import',
    titleKey: 'nav.importData',
    descKey: 'backOffice.tiles.import',
    to: { name: 'hotel-import' },
  },
]

// Keep a tile only when the signed-in role is allowed on the page behind it.
// The mapping mirrors config/modules so a denied page is never linked.
const ROLE_GATES = {
  staff: ['hotel_admin', 'manager'],
  'trusted-devices': ['hotel_admin', 'manager'],
  import: ['hotel_admin'],
}

const tiles = computed(() =>
  ALL_TILES.filter((tile) => {
    const gate = ROLE_GATES[tile.key]
    return !gate || gate.includes(auth.user?.user_role)
  }),
)
</script>

<style scoped>
.bo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 8px;
}

.bo-tile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.bo-tile:hover {
  border-color: #005eb8;
  box-shadow: 0 6px 18px rgba(0, 94, 184, 0.12);
  transform: translateY(-1px);
}

.bo-tile-icon {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: #eef4fb;
  color: #005eb8;
  font-size: 18px;
}

.bo-tile-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.bo-tile-title {
  font-size: 15px;
  color: #0f172a;
}

.bo-tile-desc {
  font-size: 12.5px;
  line-height: 1.4;
  color: #64748b;
}

.bo-tile-go {
  margin-left: auto;
  color: #94a3b8;
  font-size: 12px;
}
</style>
