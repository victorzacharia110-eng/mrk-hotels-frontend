<!--
  CashierTransactionLockPage — the frozen (transaction-locked) POS orders.
  Matches the client's "Transaction Lock" screen: a list of locked orders
  (Order No / Table No / Type) that the cashier can release back into service.
-->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-lock" aria-hidden="true"></i> {{ $t('cashier.txlock.title') }}</h2>
        <span class="muted">{{ $t('cashier.txlock.records', { n: meta.total }) }}</span>
      </div>

      <div class="table-scroll">
        <SkeletonLoader v-if="loading" variant="table" :count="5" :cols="6" />
        <table v-else class="sm-table">
          <thead>
            <tr>
              <th>{{ $t('cashier.txlock.orderNo') }}</th>
              <th>{{ $t('cashier.txlock.tableNo') }}</th>
              <th>{{ $t('cashier.txlock.type') }}</th>
              <th class="num">{{ $t('cashier.txlock.amount') }}</th>
              <th>{{ $t('cashier.txlock.lockedSince') }}</th>
              <th>{{ $t('cashier.txlock.lockedBy') }}</th>
              <th class="right">{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.order_id">
              <td><strong>{{ order.order_number }}</strong></td>
              <td>{{ order.table_number || order.room_number || '—' }}</td>
              <td><span class="type-badge">{{ typeLabel(order.order_type) }}</span></td>
              <td class="num">TZS {{ fmtNum(order.total_amount) }}</td>
              <td>{{ fmtTime(order.frozen_at) }}</td>
              <td>{{ order.frozen_by_name || '—' }}</td>
              <td class="right">
                <button class="sm-btn ghost" :disabled="busy === order.order_id" @click="unlock(order)">
                  <i class="fas fa-lock-open" aria-hidden="true"></i> {{ busy === order.order_id ? $t('common.saving') : $t('cashier.txlock.unlock') }}
                </button>
              </td>
            </tr>
            <tr v-if="!orders.length && !loading">
              <td colspan="7" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.txlock.noData') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="meta.total > meta.per_page" class="pagination">
        <button class="btn btn-sm btn-secondary" :disabled="meta.current_page <= 1" @click="goPage(meta.current_page - 1)">
          {{ $t('common.previous') }}
        </button>
        <span class="muted">{{ $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page }) }}</span>
        <button class="btn btn-sm btn-secondary" :disabled="meta.current_page >= meta.last_page" @click="goPage(meta.current_page + 1)">
          {{ $t('common.next') }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { cashierApi } from '@/api'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const { t } = useI18n()

const orders = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 25 })
const loading = ref(false)
const busy = ref(null)

async function load() {
  loading.value = true
  try {
    const { data } = await cashierApi.frozenOrders({ per_page: meta.value.per_page, page: meta.value.current_page })
    orders.value = data.orders || []
    meta.value = data.pagination || meta.value
  } finally {
    loading.value = false
  }
}

function goPage(page) {
  meta.value.current_page = page
  load()
}

async function unlock(order) {
  busy.value = order.order_id
  try {
    await cashierApi.unfreeze(order.order_id)
    orders.value = orders.value.filter((o) => o.order_id !== order.order_id)
    meta.value.total = Math.max(0, meta.value.total - 1)
  } catch (e) {
    window.alert(e.response?.data?.message || t('common.actionFailed'))
  } finally {
    busy.value = null
  }
}

function typeLabel(orderType) {
  const key = `cashier.txlock.orderTypes.${orderType || 'unknown'}`
  return t(key) === key ? (orderType || '—').toUpperCase() : t(key).toUpperCase()
}

function fmtTime(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function fmtNum(n) {
  return Number(n ?? 0).toLocaleString()
}

onMounted(load)
</script>

<style scoped>
.muted { font-size: 12px; color: #64748b; }
.right { text-align: right; }
.num { text-align: right; }
td.num { font-variant-numeric: tabular-nums; }
.type-badge {
  display: inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase;
  background: #e8f1fa; color: var(--mrk-blue-deep, #00468c); border-radius: 999px; padding: 3px 10px;
}
.table-scroll { overflow-x: auto; }
.pagination { padding: 12px 16px; border-top: 1px solid #e2e8f0; }
</style>