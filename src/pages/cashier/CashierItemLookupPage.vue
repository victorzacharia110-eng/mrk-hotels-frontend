<!--
  CashierItemLookupPage — PRODUCT LIBRARY reference screen.
  Top search bar, horizontal category and sub-category rails, and a read-only
  item table (Name / Category / Sub Category / SI Unit / Tax Group / Cost /
  Price).
-->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head lookup-head">
        <div class="lookup-heading">
          <h2><i class="fas fa-book-open" aria-hidden="true"></i> {{ $t('cashier.lookup.title') }}</h2>
          <span class="item-count">{{ filteredItems.length }} {{ $t('cashier.lookup.items') }}</span>
        </div>
        <div class="lookup-search">
          <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
          <input v-model="search" type="search" class="sm-input lookup-search-input"
            :placeholder="$t('cashier.lookup.searchItem')" />
        </div>
      </div>

      <div v-if="categories.length" class="lookup-cats" role="tablist"
        :aria-label="$t('cashier.lookup.category')">
        <button v-for="cat in categories" :key="cat" type="button" role="tab" class="lookup-chip"
          :class="{ active: activeCategory === cat }" :aria-selected="activeCategory === cat"
          @click="selectCategory(cat)">
          {{ cat }}
        </button>
      </div>

      <div v-if="activeCategory && subCategories.length" class="lookup-subs" role="tablist"
        :aria-label="$t('cashier.lookup.allSubCategories')">
        <button type="button" role="tab" class="lookup-sub" :class="{ active: !activeSubCategory }"
          :aria-selected="!activeSubCategory" @click="activeSubCategory = ''">
          {{ $t('cashier.lookup.allSubCategories') }}
        </button>
        <button v-for="sub in subCategories" :key="sub" type="button" role="tab" class="lookup-sub"
          :class="{ active: activeSubCategory === sub }" :aria-selected="activeSubCategory === sub"
          @click="activeSubCategory = sub">
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
import { computed, onMounted, ref, watch } from 'vue'
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
  return (item.item_name || '').toLowerCase().includes(term)
}

const searchMatches = computed(() => items.value.filter(matchesSearch))

const categories = computed(() => {
  const seen = new Map()
  searchMatches.value.forEach((item) => {
    if (!item.category || seen.has(item.category)) return
    seen.set(item.category, Number(item.category_order || 0))
  })
  return [...seen.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
})

const subCategories = computed(() => {
  if (!activeCategory.value) return []
  const seen = new Map()
  searchMatches.value.forEach((item) => {
    if (item.category !== activeCategory.value) return
    if (!item.sub_category || seen.has(item.sub_category)) return
    seen.set(item.sub_category, Number(item.sub_category_order || 0))
  })
  return [...seen.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
})

const filteredItems = computed(() =>
  searchMatches.value.filter((item) => {
    if (activeCategory.value && item.category !== activeCategory.value) return false
    if (activeSubCategory.value && item.sub_category !== activeSubCategory.value) return false
    return true
  }),
)

watch(search, () => {
  activeCategory.value = ''
  activeSubCategory.value = ''

  const matchingCategories = categories.value
  if (search.value.trim() && matchingCategories.length === 1) {
    activeCategory.value = matchingCategories[0]
  }
})

function selectCategory(cat) {
  activeCategory.value = activeCategory.value === cat ? '' : cat
  activeSubCategory.value = ''
}

function money(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)
}

async function load() {
  loading.value = true
  try {
    const { data } = await menuItemApi.index({ per_page: 100 })
    const rows = [...(data.data || data)]
    const lastPage = Number(data.meta?.last_page || 1)
    if (lastPage > 1) {
      const pages = await Promise.all(
        Array.from({ length: lastPage - 1 }, (_, index) =>
          menuItemApi.index({ per_page: 100, page: index + 2 }).then((response) => response.data.data || response.data),
        ),
      )
      pages.forEach((pageRows) => rows.push(...pageRows))
    }
    items.value = rows
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.lookup-head { align-items: center; gap: 18px; }
.lookup-heading { display: flex; align-items: baseline; gap: 10px; flex-shrink: 0; }
.lookup-search { position: relative; flex: 1 1 480px; max-width: 760px; margin-left: auto; }
.lookup-search i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748b; }
.lookup-search-input { width: 100%; padding-left: 34px; }
.item-count { font-size: 12px; color: #64748b; white-space: nowrap; }
.lookup-cats {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  overflow-x: auto;
  padding: 14px 0 10px;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}
.lookup-chip {
  flex: 0 0 auto;
  border: 1px solid #d4d4d8;
  background: linear-gradient(180deg, #fafafa, #f0f0f2);
  color: #27272a;
  border-radius: 9px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
}
.lookup-chip:hover { transform: translateY(-1px); border-color: #005eb8; box-shadow: 0 4px 10px rgba(6, 42, 82, 0.1); }
.lookup-chip.active { background: #005eb8; border-color: #005eb8; color: #fff; }
.lookup-subs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0 10px;
  border-top: 1px solid #e4e4e7;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}
.lookup-sub {
  flex: 0 0 auto;
  border: 1px solid #d4d4d8;
  background: #fafafa;
  color: #3f3f46;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.lookup-sub:hover { border-color: #005eb8; }
.lookup-sub.active { background: #005eb8; border-color: #005eb8; color: #fff; }

@media (max-width: 640px) {
  .lookup-head { flex-wrap: wrap; }
  .lookup-search { flex-basis: 100%; max-width: none; }
}
</style>
