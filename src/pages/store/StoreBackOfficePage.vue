<!-- StoreBackOfficePage — flat launchpad for the inventory back-office masters. -->
<template>
  <div class="sm-page">
    <div class="bo-grid">
      <router-link v-for="tile in tiles" :key="tile.name" :to="{ name: tile.name }" class="bo-tile">
        <span class="bo-icon"><i :class="tile.icon"></i></span>
        <span>
          <strong>{{ $t(tile.titleKey) }}</strong>
          <small>{{ $t(tile.descKey) }}</small>
        </span>
        <i class="fas fa-arrow-right bo-arrow"></i>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import '@/pages/store/store-shared.css'

const tiles = [
  { name: 'store-items', icon: 'fas fa-boxes-stacked', titleKey: 'storeManager.nav.items', descKey: 'storeManager.backOffice.itemsDesc' },
  { name: 'store-suppliers', icon: 'fas fa-truck-ramp-box', titleKey: 'storeManager.nav.suppliers', descKey: 'storeManager.backOffice.suppliersDesc' },
  { name: 'store-categories', icon: 'fas fa-tags', titleKey: 'storeManager.nav.categories', descKey: 'storeManager.backOffice.categoriesDesc' },
  { name: 'store-expense-categories', icon: 'fas fa-money-bill-wave', titleKey: 'storeManager.nav.expenseCategories', descKey: 'storeManager.backOffice.expenseCategoriesDesc' },
  { name: 'store-units', icon: 'fas fa-ruler-combined', titleKey: 'storeManager.nav.siUnits', descKey: 'storeManager.backOffice.siUnitsDesc' },
]
</script>

<style scoped>
.bo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
}
.bo-tile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  color: #1e293b;
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.bo-tile:hover {
  border-color: #005eb8;
  box-shadow: 0 8px 22px rgba(0, 94, 184, 0.12);
  transform: translateY(-1px);
}
.bo-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e8f1fa;
  color: #005eb8;
  font-size: 18px;
  flex-shrink: 0;
}
.bo-tile span:nth-child(2) { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.bo-tile strong { font-size: 14px; }
.bo-tile small { color: #64748b; font-size: 12px; line-height: 1.35; }
.bo-arrow { margin-left: auto; color: #94a3b8; font-size: 12px; }
html[data-theme='dark'] .bo-tile { background: #1e293b; border-color: #334155; color: #e2e8f0; }
html[data-theme='dark'] .bo-icon { background: #1e3a5f; color: #7cc0ff; }
html[data-theme='dark'] .bo-tile small { color: #94a3b8; }
</style>
