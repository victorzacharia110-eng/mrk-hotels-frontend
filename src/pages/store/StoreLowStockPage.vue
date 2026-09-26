<!-- StoreLowStockPage — dedicated low-stock alerts with reorder actions. -->
<template>
  <div class="sm-page">
    <div class="kpi-grid">
      <div class="kpi"><span class="kpi-label">{{ $t('storeManager.lowStock.outOfStock') }}</span><span class="kpi-value danger">{{ outOfStock.length }}</span></div>
      <div class="kpi"><span class="kpi-label">{{ $t('storeManager.lowStock.belowReorder') }}</span><span class="kpi-value warn">{{ belowReorder.length }}</span></div>
      <div class="kpi"><span class="kpi-label">{{ $t('storeManager.lowStock.totalAlerts') }}</span><span class="kpi-value">{{ alerts.length }}</span></div>
    </div>
    <div class="sm-toolbar">
      <CalendarInput v-model="dateFilter" :placeholder="$t('common.date')" @change="load" />
    </div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="alerts.length">
          <thead><tr>
            <th>{{ $t('inventory.itemName') }}</th><th>{{ $t('inventory.category') }}</th>
            <th>{{ $t('inventory.inStock') }}</th><th>{{ $t('inventory.reorderLevel') }}</th>
            <th>{{ $t('storeManager.lowStock.onShelves') }}</th>
            <th>{{ $t('storeManager.lowStock.severity') }}</th><th>{{ $t('common.actions') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="a in alerts" :key="a.item_id">
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
              <td><router-link class="sm-btn sm ghost" :to="{ name: 'store-requisitions', query: { create: '1' } }"><i class="fas fa-file-circle-plus"></i> {{ $t('storeManager.lowStock.reorder') }}</router-link></td>
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
import { storeApi } from '../../api'
import CalendarInput from '@/components/CalendarInput.vue'
import { useWorkingDateStore } from '@/stores/workingDate'

const workingDateStore = useWorkingDateStore()
const alerts = ref([])
const loading = ref(false)
const dateFilter = ref(workingDateStore.workingDate)
const outOfStock = computed(() => alerts.value.filter((a) => Number(a.quantity_in_stock) === 0))
const belowReorder = computed(() => alerts.value.filter((a) => Number(a.quantity_in_stock) > 0))

async function load() {
  loading.value = true
  try {
    const params = {}
    if (dateFilter.value) params.date = dateFilter.value
    const res = await storeApi.lowStock(params)
    const items = res.data.data || res.data || []
    alerts.value = items.filter((i) => Number(i.quantity_in_stock) <= Number(i.reorder_level || 0) || i.status === 'out_of_stock')
  } finally { loading.value = false }
}
onMounted(async () => {
  await workingDateStore.ensureLoaded()
  dateFilter.value = workingDateStore.workingDate
  load()
})
</script>

<style scoped>
.danger { color: #dc2626; } .warn { color: #d97706; }
.chip-amber { background: #fef3c7; color: #92400e; }
</style>
