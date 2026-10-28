<!-- StoreLowStockPage — dedicated low-stock alerts with reorder actions. -->
<template>
  <div class="sm-page">
    <div class="kpi-grid">
      <div class="kpi"><span class="kpi-label">{{ $t('storeManager.lowStock.outOfStock') }}</span><span class="kpi-value danger">{{ outOfStock.length }}</span></div>
      <div class="kpi"><span class="kpi-label">{{ $t('storeManager.lowStock.belowReorder') }}</span><span class="kpi-value warn">{{ belowReorder.length }}</span></div>
      <div class="kpi"><span class="kpi-label">{{ $t('storeManager.lowStock.totalAlerts') }}</span><span class="kpi-value">{{ alerts.length }}</span></div>
    </div>
    <div class="sm-toolbar">
      <select v-model="stockFilter" class="sm-select">
        <option value="">{{ $t('storeManager.lowStock.allAlerts') }}</option>
        <option value="out">{{ $t('storeManager.lowStock.outOfStock') }}</option>
        <option value="below">{{ $t('storeManager.lowStock.belowReorder') }}</option>
      </select>
      <SearchableSelect v-model="catFilter" :options="categoryOptions" :empty-label="$t('inventory.allCategories')" force-search />
      <button class="sm-btn" :disabled="!selected.length" @click="reorder"><i class="fas fa-cart-plus"></i> {{ $t('storeManager.lowStock.reorder') }} ({{ selected.length }})</button>
    </div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="alerts.length">
          <thead><tr>
            <th class="pick-col"><input type="checkbox" :checked="allSelected" :indeterminate.prop="someSelected && !allSelected" :aria-label="$t('common.selectAll')" @change="toggleAll" /></th>
            <th>{{ $t('inventory.itemName') }}</th><th>{{ $t('inventory.category') }}</th>
            <th>{{ $t('inventory.inStock') }}</th><th>{{ $t('inventory.reorderLevel') }}</th>
            <th>{{ $t('storeManager.lowStock.onShelves') }}</th>
            <th>{{ $t('storeManager.lowStock.severity') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="a in filteredAlerts" :key="a.item_id">
              <td class="pick-col"><input type="checkbox" :checked="selected.includes(a.item_id)" @change="toggle(a.item_id)" /></td>
              <td><strong>{{ a.item_name }}</strong></td>
              <td><span class="chip">{{ a.category }}</span></td>
              <td><span class="stock-low">{{ a.quantity_in_stock }}</span></td>
              <td>{{ a.reorder_level }}</td>
              <!-- The QTY above is the hotel-wide truth; this traces it back to
                   the shelf each balance actually sits on. -->
              <td>
                <span v-if="!(a.shelves || []).length" class="chip">{{ $t('storeManager.lowStock.storeOnly') }}</span>
                <span v-for="s in a.shelves" :key="s.department_id" class="chip">
                  {{ s.name }}: {{ s.quantity }}
                </span>
              </td>
              <td><span class="chip" :class="Number(a.quantity_in_stock) === 0 ? 'chip-red' : 'chip-amber'">
                {{ Number(a.quantity_in_stock) === 0 ? $t('storeManager.lowStock.outOfStock') : $t('storeManager.lowStock.low') }}
              </span></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.lowStock.empty') }}</p>
      </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeApi } from '../../api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useCategoriesStore } from '@/stores/categories'

const router = useRouter()
const categoriesStore = useCategoriesStore()
const categoryOptions = computed(() => categoriesStore.inventoryCategoryOptions)
const alerts = ref([])
const loading = ref(false)
const stockFilter = ref('')
const catFilter = ref('')
const selected = ref([])
const outOfStock = computed(() => alerts.value.filter((a) => Number(a.quantity_in_stock) === 0))
const belowReorder = computed(() => alerts.value.filter((a) => Number(a.quantity_in_stock) > 0))
const filteredAlerts = computed(() => {
  let rows = alerts.value
  if (stockFilter.value === 'out') rows = rows.filter((a) => Number(a.quantity_in_stock) === 0)
  if (stockFilter.value === 'below') rows = rows.filter((a) => Number(a.quantity_in_stock) > 0)
  if (catFilter.value) rows = rows.filter((a) => a.category === catFilter.value)
  return rows
})
const allSelected = computed(() => filteredAlerts.value.length > 0 && filteredAlerts.value.every((a) => selected.value.includes(a.item_id)))
const someSelected = computed(() => filteredAlerts.value.some((a) => selected.value.includes(a.item_id)))
function toggle(id) {
  selected.value = selected.value.includes(id) ? selected.value.filter((v) => v !== id) : [...selected.value, id]
}
function toggleAll() {
  const ids = filteredAlerts.value.map((a) => a.item_id)
  selected.value = allSelected.value ? selected.value.filter((id) => !ids.includes(id)) : [...new Set([...selected.value, ...ids])]
}
function reorder() {
  if (!selected.value.length) return
  router.push({ name: 'store-purchase-orders', query: { reorder: selected.value.join(','), create: '1' } })
}

async function load() {
  loading.value = true
  try {
    const res = await storeApi.lowStock({})
    const items = res.data.data || res.data || []
    alerts.value = items.filter((i) => Number(i.quantity_in_stock) <= Number(i.reorder_level || 0) || i.status === 'out_of_stock')
  } finally { loading.value = false }
}
onMounted(async () => {
  await categoriesStore.ensureLoaded()
  load()
})
</script>

<style scoped>
.danger { color: #dc2626; } .warn { color: #d97706; }
.chip-amber { background: #fef3c7; color: #92400e; }
.pick-col { width: 36px; }
.pick-col input { width: 16px; height: 16px; cursor: pointer; }
</style>
