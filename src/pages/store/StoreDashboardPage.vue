<!--
  StoreDashboardPage — store manager landing: stock KPIs, low-stock alerts,
  pending requisitions/PO approvals and quick actions.
-->

<template>
  <div class="sm-page">
    <!-- KPI cards -->
    <section class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-icon blue"><i class="fas fa-boxes-stacked"></i></span>
        <div><strong>{{ stats.totalItems }}</strong><small>{{ $t('storeManager.dashboard.totalItems') }}</small></div>
      </div>
      <div class="kpi-card">
        <span class="kpi-icon red"><i class="fas fa-triangle-exclamation"></i></span>
        <div><strong>{{ lowStock.length }}</strong><small>{{ $t('storeManager.dashboard.lowStock') }}</small></div>
      </div>
      <div class="kpi-card">
        <span class="kpi-icon amber"><i class="fas fa-file-signature"></i></span>
        <div><strong>{{ stats.pendingRequisitions }}</strong><small>{{ $t('storeManager.dashboard.pendingRequisitions') }}</small></div>
      </div>
      <div class="kpi-card">
        <span class="kpi-icon green"><i class="fas fa-file-invoice"></i></span>
        <div><strong>{{ stats.openOrders }}</strong><small>{{ $t('storeManager.dashboard.openPurchaseOrders') }}</small></div>
      </div>
      <div class="kpi-card">
        <span class="kpi-icon navy"><i class="fas fa-coins"></i></span>
        <div><strong>TZS {{ stats.stockValue.toLocaleString() }}</strong><small>{{ $t('storeManager.dashboard.stockValue') }}</small></div>
      </div>
    </section>

    <!-- Quick actions -->
    <section class="quick-actions">
      <router-link :to="{ name: 'store-inventory', query: { create: '1' } }" class="qa-btn"><i class="fas fa-plus"></i> {{ $t('storeManager.dashboard.newItem') }}</router-link>
      <router-link :to="{ name: 'store-requisitions', query: { create: '1' } }" class="qa-btn"><i class="fas fa-file-signature"></i> {{ $t('storeManager.dashboard.newRequisition') }}</router-link>
      <router-link :to="{ name: 'store-goods-received', query: { create: '1' } }" class="qa-btn"><i class="fas fa-clipboard-check"></i> {{ $t('storeManager.dashboard.recordGrn') }}</router-link>
      <router-link :to="{ name: 'store-suppliers', query: { create: '1' } }" class="qa-btn"><i class="fas fa-truck"></i> {{ $t('storeManager.dashboard.newSupplier') }}</router-link>
    </section>

    <div class="panel-grid">
      <!-- Low stock alerts -->
      <section class="panel">
        <header class="panel-head">
          <h2><i class="fas fa-triangle-exclamation"></i> {{ $t('storeManager.dashboard.lowStockAlerts') }}</h2>
          <router-link :to="{ name: 'store-inventory', query: { filter: 'low' } }" class="panel-link">{{ $t('common.viewAll') }}</router-link>
        </header>
        <div class="table-scroll">
        <table class="sm-table" v-if="lowStock.length">
          <thead><tr><th>{{ $t('inventory.itemName') }}</th><th>{{ $t('inventory.category') }}</th><th>{{ $t('inventory.inStock') }}</th><th>{{ $t('inventory.reorderLevel') }}</th></tr></thead>
          <tbody>
            <tr v-for="item in lowStock" :key="item.item_id">
              <td><strong>{{ item.item_name }}</strong></td>
              <td><span class="chip">{{ item.category }}</span></td>
              <td><span class="stock-low">{{ item.quantity_in_stock }} {{ item.unit }}</span></td>
              <td>{{ item.reorder_level }} {{ item.unit }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty"><i class="fas fa-circle-check"></i> {{ $t('storeManager.dashboard.noLowStock') }}</p>
      </div>
      </section>

      <!-- Pending requisitions -->
      <section class="panel">
        <header class="panel-head">
          <h2><i class="fas fa-file-signature"></i> {{ $t('storeManager.dashboard.pendingRequisitions') }}</h2>
          <router-link :to="{ name: 'store-requisitions', query: { status: 'pending' } }" class="panel-link">{{ $t('common.viewAll') }}</router-link>
        </header>
        <div class="table-scroll">
        <table class="sm-table" v-if="pendingReqs.length">
          <thead><tr><th>{{ $t('requisitions.number') }}</th><th>{{ $t('requisitions.department') }}</th><th>{{ $t('requisitions.items') }}</th><th>{{ $t('common.date') }}</th></tr></thead>
          <tbody>
            <tr v-for="req in pendingReqs" :key="req.requisition_id">
              <td><strong>{{ req.requisition_number }}</strong></td>
              <td>{{ req.department }}</td>
              <td>{{ (req.items || []).length }}</td>
              <td>{{ formatDate(req.created_at) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty"><i class="fas fa-circle-check"></i> {{ $t('storeManager.dashboard.noPending') }}</p>
      </div>
      </section>
    </div>

    <!-- Recent goods received -->
    <section class="panel">
      <header class="panel-head">
        <h2><i class="fas fa-clipboard-check"></i> {{ $t('storeManager.dashboard.recentReceipts') }}</h2>
        <router-link :to="{ name: 'store-goods-received' }" class="panel-link">{{ $t('common.viewAll') }}</router-link>
      </header>
      <div class="table-scroll">
        <table class="sm-table" v-if="recentGrns.length">
        <thead><tr><th>{{ $t('goodsReceived.number') }}</th><th>{{ $t('goodsReceived.purchaseOrder') }}</th><th>{{ $t('goodsReceived.supplier') }}</th><th>{{ $t('goodsReceived.receivedDate') }}</th><th>{{ $t('goodsReceived.inspection') }}</th></tr></thead>
        <tbody>
          <tr v-for="grn in recentGrns" :key="grn.grn_id">
            <td><strong>{{ grn.grn_number }}</strong></td>
            <td>{{ grn.purchase_order?.po_number || '-' }}</td>
            <td>{{ grn.supplier?.supplier_name || '-' }}</td>
            <td>{{ formatDate(grn.received_date) }}</td>
            <td><span class="chip" :class="grn.inspection_status">{{ grn.inspection_status }}</span></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">{{ $t('storeManager.dashboard.noReceipts') }}</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { inventoryApi, purchaseRequisitionApi, purchaseOrderApi, goodsReceivedNoteApi } from '@/api'

const items = ref([])
const requisitions = ref([])
const orders = ref([])
const grns = ref([])

const lowStock = computed(() =>
  items.value.filter((i) => Number(i.quantity_in_stock) <= Number(i.reorder_level || 0)).slice(0, 8)
)
const pendingReqs = computed(() => requisitions.value.filter((r) => r.status === 'pending').slice(0, 8))
const recentGrns = computed(() => grns.value.slice(0, 8))

const stats = computed(() => ({
  totalItems: items.value.length,
  pendingRequisitions: pendingReqs.value.length,
  openOrders: orders.value.filter((o) => ['pending', 'manager_approved', 'approved'].includes(o.status)).length,
  stockValue: items.value.reduce((sum, i) => sum + Number(i.quantity_in_stock || 0) * Number(i.unit_cost || 0), 0),
}))

function formatDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(async () => {
  const [inv, req, po, grn] = await Promise.allSettled([
    inventoryApi.index({ per_page: 100 }),
    purchaseRequisitionApi.index({ per_page: 50 }),
    purchaseOrderApi.index({ per_page: 50 }),
    goodsReceivedNoteApi.index({ per_page: 10 }),
  ])
  if (inv.status === 'fulfilled') items.value = inv.value.data.data || inv.value.data || []
  if (req.status === 'fulfilled') requisitions.value = req.value.data.data || req.value.data || []
  if (po.status === 'fulfilled') orders.value = po.value.data.data || po.value.data || []
  if (grn.status === 'fulfilled') grns.value = grn.value.data.data || grn.value.data || []
})
</script>
