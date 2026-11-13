<!--
  CashierLowStockPage — the cashier/bartender panel's LOW STOCK page.
  Lists the sellable menu items whose stock on the selected outlet's shelf has
  fallen to (or below) their own reorder level. This is deliberately menu stock,
  not the raw store inventory: a bar's reorder level belongs to the drink, and
  the figure shown is the shelf the ticket will actually be charged against.
-->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <h2 class="low-title">
        <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
        {{ $t('staffDashboard.lowStockTitle') }}

      </h2>
      <div class="dept-toggle" role="group" :aria-label="$t('common.department')">
        <button type="button" class="dept-btn" :class="{ active: department === 'restaurant' }"
          @click="department = 'restaurant'">
          <i class="fas fa-utensils" aria-hidden="true"></i> {{ $t('cashier.order.restaurant') }}
        </button>
        <button type="button" class="dept-btn" :class="{ active: department === 'bar' }" @click="department = 'bar'">
          <i class="fas fa-martini-glass-citrus" aria-hidden="true"></i> {{ $t('cashier.order.bar') }}
        </button>
      </div>
      <span class="spacer"></span>
      <span class="muted">{{ rows.length }} {{ $t('staffDashboard.item') }}</span>
      <button class="sm-btn sm" :disabled="loading" @click="load">
        <i class="fas fa-rotate" aria-hidden="true"></i> {{ $t('staffDashboard.refresh') }}
      </button>
    </div>

    <p v-if="error" class="alert alert-error">{{ error }}</p>

    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i> {{
        $t('common.loading') }}</div>
      <div v-else-if="!rows.length" class="empty-state">
        <i class="fas fa-circle-check" aria-hidden="true"></i>
        {{ $t('staffDashboard.lowStockEmpty') }}
      </div>
      <div v-else class="table-scroll">
        <table class="sm-table">
          <thead>
            <tr>
              <th>{{ $t('staffDashboard.item') }}</th>
              <th>{{ $t('requisitionPanel.siUnit') }}</th>
              <th class="num">{{ $t('staffDashboard.qty') }}</th>
              <th class="num">{{ $t('staffDashboard.reorderLevel') }}</th>
              <th class="num">{{ $t('staffDashboard.stockValue') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.item_id">
              <td><strong>{{ row.item_name }}</strong></td>
              <td>{{ row.si_unit || '—' }}</td>
              <td class="num">{{ num(row.quantity) }}</td>
              <td class="num">{{ num(row.reorder_level) }}</td>
              <td class="num">{{ curCode() }} {{ money(row.value) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { reportApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { selectedOutlet } from '@/pages/cashier/outlet-context'
import { useTenantCurrency } from '@/utils/currency'

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const { curCode } = useTenantCurrency()

// The dashboard arrow carries the department the user was looking at, so the
// count and the list it opens are the same side of the business.
const requestedDepartment = String(route.query.department || '').toLowerCase()
const department = ref(
  ['restaurant', 'bar'].includes(requestedDepartment)
    ? requestedDepartment
    : (authStore.user?.user_role === 'bartender' ? 'bar' : 'restaurant'),
)
const rows = ref([])
const loading = ref(false)
const error = ref('')

function num(value) {
  return Number(value ?? 0).toFixed(2)
}

function money(value) {
  return Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await reportApi.staffDashboard({
      department: department.value,
      outlet_id: selectedOutlet.value?.outlet_id || undefined,
    })
    const stock = data?.menu_stock || {}
    rows.value = (stock.rows || []).filter((row) => row.low)
  } catch (err) {
    error.value = err.response?.data?.message || t('staffDashboard.loadError')
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(department, load)
watch(() => selectedOutlet.value?.outlet_id, load)
onMounted(load)
</script>

<style scoped>
.sm-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.low-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}

.spacer {
  flex: 1;
}

.muted {
  color: #64748b;
  font-size: 12px;
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.dept-toggle {
  display: inline-flex;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  overflow: hidden;
  background: #fff;
}

.dept-btn {
  border: none;
  background: #fff;
  color: #475569;
  cursor: pointer;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dept-btn+.dept-btn {
  border-left: 1px solid #e2e8f0;
}

.dept-btn.active {
  background: #005eb8;
  color: #fff;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #16a34a;
  font-weight: 600;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
}
</style>
