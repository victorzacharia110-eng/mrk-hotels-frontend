<!--
  CashierItemLookupPage — PRODUCT LIBRARY reference screen.
  Top search bar, horizontal categories, sub-categories inside the list and a
  read-only item table (Name / Category / Sub Category / SI Unit / Tax Group /
  Cost / Price).
-->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="lookup-top">
        <div class="lookup-search">
          <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
          <input v-model="search" type="search" class="sm-input lookup-search-input"
            :placeholder="$t('cashier.lookup.searchItem')" />
        </div>
        <span class="item-count">{{ filteredItems.length }} {{ $t('cashier.lookup.items') }}</span>
      </div>

      <div class="lookup-cats">
        <button type="button" class="lookup-chip" :class="{ active: !activeCategory }"
          @click="selectCategory('')">{{ $t('cashier.lookup.allCategories') }}</button>
        <button v-for="cat in categories" :key="cat" type="button" class="lookup-chip"
          :class="{ active: activeCategory === cat }" @click="selectCategory(cat)">
          {{ cat }}
        </button>
      </div>

      <div v-if="subCategories.length" class="lookup-subs">
        <button type="button" class="lookup-sub" :class="{ active: !activeSubCategory }"
          @click="activeSubCategory = ''">{{ $t('cashier.lookup.allSubCategories') }}</button>
        <button v-for="sub in subCategories" :key="sub" type="button" class="lookup-sub"
          :class="{ active: activeSubCategory === sub }" @click="activeSubCategory = sub">
          {{ sub }}
        </button>
      </div>

      <div class="table-scroll">
        <SkeletonLoader v-if="loading" variant="table" :count="7" :cols="7" />
        <table class="sm-table" v-else>
          <thead>
            <tr>
              <th>{{ $t('cashier.lookup.name') }}</th>
              <th>{{ $t('cashier.lookup.category') }}</th>
              <th>{{ $t('cashier.lookup.subCategory') }}</th>
              <th>{{ $t('cashier.lookup.siUnit') }}</th>
              <th>{{ $t('cashier.lookup.taxGroup') }}</th>
              <th>{{ $t('cashier.lookup.cost') }}</th>
              <th>{{ $t('cashier.lookup.price') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredItems" :key="item.menu_item_id">
              <td><strong>{{ item.item_name }}</strong></td>
              <td>{{ item.category || '—' }}</td>
              <td>{{ item.sub_category || '—' }}</td>
              <td>{{ item.si_unit || '—' }}</td>
              <td>{{ item.tax_group || '—' }}</td>
              <td>{{ money(item.cost) }}</td>
              <td><strong>{{ money(item.price) }}</strong></td>
            </tr>
            <tr v-if="!filteredItems.length">
              <td colspan="7" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.lookup.noItems') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { menuItemApi } from '@/api'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import '@/pages/store/store-shared.css'

const items = ref([])
const loading = ref(true)
const search = ref('')
const activeCategory = ref('')
const activeSubCategory = ref('')

const matchesSearch = (item) => {
  const term = search.value.trim().toLowerCase()
  if (!term) return true
  return `${item.item_name || ''} ${item.category || ''} ${item.sub_category || ''}`
    .toLowerCase()
    .includes(term)
}

const searchMatches = computed(() => items.value.filter(matchesSearch))

const categories = computed(() => {
  const seen = new Set()
  return searchMatches.value
    .map((i) => i.category)
    .filter((c) => c && !seen.has(c) && seen.add(c))
    .sort((a, b) => a.localeCompare(b))
})

const subCategories = computed(() => {
  const seen = new Set()
  return searchMatches.value
    .filter((i) => !activeCategory.value || i.category === activeCategory.value)
    .map((i) => i.sub_category)
    .filter((s) => s && !seen.has(s) && seen.add(s))
    .sort((a, b) => a.localeCompare(b))
})

const filteredItems = computed(() =>
  searchMatches.value.filter((item) => {
    if (activeCategory.value && item.category !== activeCategory.value) return false
    if (activeSubCategory.value && item.sub_category !== activeSubCategory.value) return false
    return true
  }),
)

function selectCategory(cat) {
  activeCategory.value = cat
  activeSubCategory.value = ''
}

function money(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)
}

async function load() {
  loading.value = true
  try {
    const { data } = await menuItemApi.index({ per_page: 500 })
    items.value = data.data || data
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.lookup-top { display: flex; align-items: center; gap: 12px; padding: 12px 12px 8px; }
.lookup-search { position: relative; flex: 1; min-width: 0; }
.lookup-search i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748b; }
.lookup-search-input { width: 100%; padding-left: 34px; }
.item-count { font-size: 12px; color: #64748b; white-space: nowrap; }
.lookup-cats { display: flex; gap: 8px; overflow-x: auto; padding: 4px 12px 10px; }
.lookup-chip { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 600; white-space: nowrap; cursor: pointer; }
.lookup-chip.active { background: #005eb8; border-color: #005eb8; color: #fff; }
.lookup-subs { display: flex; gap: 8px; overflow-x: auto; padding: 0 12px 10px; }
.lookup-sub { border: none; background: #f1f5f9; color: #475569; border-radius: 999px; padding: 4px 12px; font-size: 12px; white-space: nowrap; cursor: pointer; }
.lookup-sub.active { background: #e0edf9; color: #005eb8; font-weight: 700; }
</style>
