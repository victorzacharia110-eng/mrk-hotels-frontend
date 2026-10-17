<!--
  BackOfficePage.vue
  Route: /app/back-office (module: back-office).

  Management panel review: "BACK OFFICE is the equivalent of SWITCH TO BACK on
  EZEE ABSOLUTE ... it's not just a dropdown that would have all pages but
  entirely like a REPORTS BROWSER from front desk. BACK OFFICE serves as the
  engine for management to set prices | time line of 24 hrs GMT or local time
  zone, Printer Configurations | HOTEL INFO such as name, logo, business motto,
  mode of payments settings, registering of LIPA NO and Bank Acc."

  The sidebar Back Office entry opens this page, which presents every editor in
  the same Reports-browser shell the POS Reports page uses: a category tree on
  the left and a detail paper on the right. Selecting an editor shows what it
  controls and an Open action that routes to the real page — the browser never
  duplicates an editor, it only points at the one that exists.

  Tiles are filtered by the same role gates the sidebar uses, so a property
  that does not run a module never sees a dead item.
-->
<template>
  <ReportBrowserLayout
    :categories="categories"
    :active="activeKey"
    :title="$t('backOffice.title')"
    :subtitle="$t('backOffice.subtitle')"
    :report-tools="false"
    @select="selectTile"
    @search="onSearch"
  >
    <div v-if="activeTile" class="bo-detail">
      <div class="bo-detail-head">
        <span class="bo-detail-icon"><i :class="activeTile.icon" aria-hidden="true"></i></span>
        <div class="bo-detail-titles">
          <span class="bo-detail-group">{{ activeGroupLabel }}</span>
          <h2 class="bo-detail-title">{{ $t(activeTile.titleKey) }}</h2>
        </div>
        <router-link :to="activeTile.to" class="bo-open">
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
          {{ $t('backOffice.open') }}
        </router-link>
      </div>
      <p class="bo-detail-desc">{{ $t(activeTile.descKey) }}</p>
    </div>

    <p v-else class="bo-empty">{{ $t('backOffice.noMatch') }}</p>
  </ReportBrowserLayout>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import ReportBrowserLayout from '@/components/reports/ReportBrowserLayout.vue'

const auth = useAuthStore()
const { t } = useI18n()

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

// The categories the editors are filed under, mirroring how the POS Reports
// browser groups its reports. Order matters: the first group opens on load.
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

const searchTerm = ref('')

const matches = (tile, term) =>
  t(tile.titleKey).toLowerCase().includes(term) ||
  t(tile.descKey).toLowerCase().includes(term)

// The Reports-browser tree: categories are the groups, each report is an
// editor. Hollow branches (all gated out, or filtered out by the search) are
// dropped so the tree never shows an empty group.
const categories = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  return GROUPS.map((group) => ({
    key: group.key,
    label: group.titleKey,
    icon: group.icon,
    reports: group.tileKeys
      .map((key) => tilesByKey[key])
      .filter(Boolean)
      .filter(roleAllowed)
      .filter((tile) => !term || matches(tile, term))
      .map((tile) => ({ key: tile.key, label: tile.titleKey, icon: tile.icon })),
  })).filter((group) => group.reports.length)
})

// Keep a selection visible: default to the first editor, and re-home it when a
// search filters the current one out.
const activeKey = ref('')

watch(
  categories,
  (cats) => {
    const keys = cats.flatMap((cat) => cat.reports.map((r) => r.key))
    if (!keys.includes(activeKey.value)) activeKey.value = keys[0] || ''
  },
  { immediate: true },
)

const activeTile = computed(() => tilesByKey[activeKey.value] || null)

const activeGroupLabel = computed(() => {
  const group = GROUPS.find((g) => activeTile.value && g.tileKeys.includes(activeTile.value.key))
  return group ? t(group.titleKey) : ''
})

function selectTile(key) {
  activeKey.value = key
}

function onSearch(term) {
  searchTerm.value = term
}
</script>

<style scoped>
.bo-detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.bo-detail-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e2e8f0;
}

.bo-detail-icon {
  flex: 0 0 auto;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #eef4fb;
  color: #005eb8;
  font-size: 24px;
}

.bo-detail-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.bo-detail-group {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #7c8db0;
}

.bo-detail-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.bo-open {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 8px;
  background: #005eb8;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.15s ease;
}

.bo-open:hover {
  background: #004b93;
}

.bo-detail-desc {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: #475569;
}

.bo-empty {
  margin: 0;
  color: #64748b;
}
</style>
