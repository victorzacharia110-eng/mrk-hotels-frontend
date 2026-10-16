<!--
  BackOfficePage.vue
  Route: /app/back-office (module: back-office).

  Management panel review: "BACK OFFICE is the equivalent of SWITCH TO BACK on
  EZEE ABSOLUTE ... it's not just a dropdown that would have all pages but
  entirely like a REPORTS BROWSER from front desk. BACK OFFICE serves as the
  engine for management to set prices | time line of 24 hrs GMT or local time
  zone, Printer Configurations | HOTEL INFO such as name, logo, business motto,
  mode of payments settings, registering of LIPA NO and Bank Acc."

  Follow-up review: the sidebar Back Office dropdown used to expand only in the
  drawer, and each of its entries redirected to one editor. It now opens this
  page instead, and every editor is grouped here under an accordion — the same
  way the POS Reports browser keeps its categories on the page.

  Tiles are filtered by the same feature gates the sidebar uses, so a property
  that does not run a module never sees a dead tile.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('backOffice.title') }}</h1>
        <p class="muted">{{ $t('backOffice.subtitle') }}</p>
      </div>
    </div>

    <div class="bo-accordions">
      <section
        v-for="group in groups"
        :key="group.key"
        class="bo-acc"
        :class="{ open: openKey === group.key }"
      >
        <button
          type="button"
          class="bo-acc-head"
          :aria-expanded="openKey === group.key"
          @click="toggle(group.key)"
        >
          <i
            class="fas bo-acc-caret"
            :class="openKey === group.key ? 'fa-chevron-down' : 'fa-chevron-right'"
            aria-hidden="true"
          ></i>
          <span class="bo-acc-icon"><i :class="group.icon" aria-hidden="true"></i></span>
          <span class="bo-acc-title">{{ $t(group.titleKey) }}</span>
          <span class="bo-acc-count">{{ group.tiles.length }}</span>
        </button>

        <div class="bo-acc-body" :class="{ open: openKey === group.key }">
          <div class="bo-acc-body-inner">
            <div class="bo-grid">
              <router-link
                v-for="tile in group.tiles"
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
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
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

// The accordions the editors are filed under, mirroring how the POS Reports
// browser groups its categories. Order matters: the first group opens on load.
const GROUPS = [
  {
    key: 'property',
    icon: 'fas fa-building',
    titleKey: 'backOffice.groups.property',
    tileKeys: ['hotel-info', 'rates', 'store-settings', 'departments', 'categories'],
  },
  {
    key: 'operations',
    icon: 'fas fa-gears',
    titleKey: 'backOffice.groups.operations',
    tileKeys: ['printer', 'suppliers'],
  },
  {
    key: 'access',
    icon: 'fas fa-user-tie',
    titleKey: 'backOffice.groups.access',
    tileKeys: ['staff', 'trusted-devices'],
  },
  {
    key: 'data',
    icon: 'fas fa-database',
    titleKey: 'backOffice.groups.data',
    tileKeys: ['import'],
  },
]

const tilesByKey = Object.fromEntries(ALL_TILES.map((tile) => [tile.key, tile]))

const roleAllowed = (tile) => {
  const gate = ROLE_GATES[tile.key]
  return !gate || gate.includes(auth.user?.user_role)
}

const groups = computed(() =>
  GROUPS.map((group) => ({
    ...group,
    tiles: group.tileKeys.map((key) => tilesByKey[key]).filter(Boolean).filter(roleAllowed),
  })).filter((group) => group.tiles.length),
)

// One accordion open at a time, the first by default, matching the POS Reports
// browser. An empty string closes every group.
const openKey = ref(GROUPS[0].key)

function toggle(key) {
  openKey.value = openKey.value === key ? '' : key
}
</script>

<style scoped>
.bo-accordions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.bo-acc {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.bo-acc.open {
  border-color: #cfe0f3;
  box-shadow: 0 6px 18px rgba(0, 94, 184, 0.06);
}

.bo-acc-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
}

.bo-acc-head:hover {
  background: #f4f8fd;
}

.bo-acc-caret {
  font-size: 12px;
  color: #7c8db0;
}

.bo-acc-icon {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: #eef4fb;
  color: #005eb8;
  font-size: 15px;
}

.bo-acc-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.bo-acc-count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  color: #005eb8;
  background: #e8f1fa;
  border-radius: 999px;
  padding: 2px 9px;
}

.bo-acc-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
}

.bo-acc-body.open {
  grid-template-rows: 1fr;
}

.bo-acc-body-inner {
  overflow: hidden;
  min-height: 0;
  padding: 0 18px;
}

.bo-acc-body.open .bo-acc-body-inner {
  padding-bottom: 18px;
}

.bo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
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
