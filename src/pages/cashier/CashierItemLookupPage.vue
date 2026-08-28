<!--
  CashierItemLookupPage — the menu reference screen.
  Left: collapsible category tree (per department/menu). Right: the item
  table with Name / Category / SKU / Tax Group / Discount / Open Price /
  Cost / Price, exactly as the POS Item Lookup prints them.
-->

<template>
  <div class="sm-page">
    <div class="lookup-layout">
      <section class="panel">
        <div class="panel-head">
          <h2><i class="fas fa-layer-group" aria-hidden="true"></i> {{ $t('cashier.lookup.menus') }}</h2>
          <select v-model="department" class="sm-select sm" @change="load">
            <option value="">{{ $t('cashier.lookup.allMenus') }}</option>
            <option value="restaurant">{{ $t('cashier.lookup.kitchenMenu') }}</option>
            <option value="bar">{{ $t('cashier.lookup.barMenu') }}</option>
          </select>
        </div>
        <div class="tree-body">
          <input v-model="search" type="search" class="sm-input full-width"
            :placeholder="$t('cashier.lookup.searchCategory')" />
          <div class="cat-tree">
            <div v-for="(itemsInCat, cat) in groupedItems" :key="cat" class="cat-group">
              <button class="cat-toggle" @click="toggleCat(cat)">
                <i :class="collapsed.has(cat) ? 'fas fa-chevron-right' : 'fas fa-chevron-down'" aria-hidden="true"></i>
                {{ cat }}
                <span class="cat-count">{{ itemsInCat.length }}</span>
              </button>
              <div v-show="!collapsed.has(cat)" class="cat-kids">
                <button v-for="item in itemsInCat" :key="item.menu_item_id" class="cat-leaf"
                  :class="{ active: activeItemId === item.menu_item_id }" @click="activeItemId = item.menu_item_id">
                  {{ item.item_name }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2><i class="fas fa-book-open" aria-hidden="true"></i> {{ $t('cashier.lookup.title') }}</h2>
          <span class="item-count">{{ items.length }} {{ $t('cashier.lookup.items') }}</span>
        </div>
        <table class="sm-table">
          <thead>
            <tr>
              <th>{{ $t('cashier.lookup.name') }}</th>
              <th>{{ $t('cashier.lookup.category') }}</th>
              <th>{{ $t('cashier.lookup.sku') }}</th>
              <th>{{ $t('cashier.lookup.taxGroup') }}</th>
              <th>{{ $t('cashier.lookup.discount') }}</th>
              <th>{{ $t('cashier.lookup.openPrice') }}</th>
              <th>{{ $t('cashier.lookup.cost') }}</th>
              <th>{{ $t('cashier.lookup.price') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in flatItems" :key="item.menu_item_id"
              :class="{ 'row-active': activeItemId === item.menu_item_id }">
              <td><strong>{{ item.item_name }}</strong></td>
              <td>{{ item.category || '—' }}</td>
              <td>{{ item.sku || '—' }}</td>
              <td>{{ item.tax_group || '—' }}</td>
              <td>{{ item.discount_allowed ? yesNo(true) : yesNo(false) }}</td>
              <td>{{ yesNo(item.open_price) }}</td>
              <td>{{ money(item.cost) }}</td>
              <td><strong>{{ money(item.price) }}</strong></td>
            </tr>
            <tr v-if="!flatItems.length">
              <td colspan="8" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.lookup.noItems') }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { menuItemApi } from '@/api'

const { t } = useI18n()

const items = ref([])
const department = ref('')
const search = ref('')
const collapsed = ref(new Set())
const activeItemId = ref(null)

// Categories containing the search term stay visible; term also filters leaves.
const groupedItems = computed(() => {
  const term = search.value.trim().toLowerCase()
  const groups = {}
  for (const item of items.value) {
    const cat = item.category || t('cashier.order.uncategorized')
    if (term && !`${cat} ${item.item_name}`.toLowerCase().includes(term)) continue
    ;(groups[cat] ||= []).push(item)
  }
  return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)))
})

const flatItems = computed(() => {
  const groups = groupedItems.value
  if (search.value.trim()) {
    return Object.values(groups).flat()
  }
  // No search: show only the expanded groups so the tree stays authoritative.
  const open = Object.keys(groups).filter((cat) => !collapsed.value.has(cat))
  return open.length ? open.flatMap((cat) => groups[cat]) : []
})

function toggleCat(cat) {
  const next = new Set(collapsed.value)
  if (next.has(cat)) next.delete(cat)
  else next.add(cat)
  collapsed.value = next
}

function yesNo(value) {
  return value ? t('common.yes') : t('common.no')
}

function money(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)
}

async function load() {
  const params = { per_page: 200 }
  if (department.value) params.department = department.value
  const { data } = await menuItemApi.index(params)
  items.value = data.data || data
}

onMounted(load)
</script>


<style scoped>
.tree-body { padding: 12px; display: flex; flex-direction: column; gap: 10px; max-height: 75vh; overflow-y: auto; }
.full-width { width: 100%; }
.cat-count { margin-left: auto; color: #94a3b8; font-size: 11px; font-weight: 600; background: #f1f5f9; border-radius: 999px; padding: 1px 8px; }
.item-count { font-size: 12px; color: #64748b; }
.row-active td { background: #e8f1fa; box-shadow: inset 3px 0 0 #005eb8; }
</style>
