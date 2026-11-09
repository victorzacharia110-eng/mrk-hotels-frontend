<!--
  OrderPeekModal — read-only order peek opened from an order number on the
  Take Away / Room Service / Delivery / No Charge boards.
-->
<template>
  <teleport to="body">
    <transition name="din-pop">
      <div v-if="open" class="din-backdrop" @click="$emit('close')"></div>
    </transition>
    <transition name="din-pop">
      <div v-if="open" class="din-modal peek-modal">
        <div class="din-modal-head">
          <h3><i class="fas fa-receipt"></i> {{ order?.order_number || orderId }}</h3>
          <button class="sm-btn ghost sm" @click="$emit('close')"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="din-modal-body">
          <div v-if="loading" class="peek-loading"><i class="fas fa-spinner fa-spin"></i></div>
          <template v-else-if="order">
            <div class="peek-meta">
              <span><strong>{{ $t('cashier.summary.guest') }}:</strong> {{ order.guest_name || '—' }}</span>
              <span><strong>{{ $t('cashier.summary.waiter') }}:</strong> {{ order.waiter_name || '—' }}</span>
              <span><strong>{{ $t('common.status') }}:</strong> {{ order.status }}</span>
            </div>
            <p v-if="order.status === 'cancelled'" class="peek-reason">
              <strong>{{ $t('storeManager.common.reason') }}:</strong> {{ order.void_reason || '—' }}
            </p>
            <table class="sm-table">
              <thead>
                <tr>
                  <th>{{ $t('cashier.summary.item') }}</th>
                  <th>{{ $t('cashier.summary.qty') }}</th>
                  <th>{{ $t('cashier.summary.price') }}</th>
                  <th>{{ $t('cashier.summary.amount') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in order.items || []" :key="line.order_item_id">
                  <td><strong>{{ line.item_name }}</strong></td>
                  <td>{{ line.quantity }}</td>
                  <td>{{ money(line.unit_price) }}</td>
                  <td>{{ money(line.subtotal ?? line.unit_price * line.quantity) }}</td>
                </tr>
                <tr v-if="!(order.items || []).length">
                  <td colspan="4" class="empty">{{ $t('cashier.summary.noItems') }}</td>
                </tr>
              </tbody>
            </table>
            <div class="peek-total">
              <span>{{ $t('cashier.summary.total') }}</span>
              <strong>{{ money(order.total_amount) }}</strong>
            </div>
          </template>
        </div>
        <div class="din-modal-foot">
          <button class="sm-btn ghost" @click="$emit('close')">{{ $t('common.close') }}</button>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { orderApi } from '@/api'

const props = defineProps({
  open: { type: Boolean, default: false },
  orderId: { type: [String, Number], default: null },
})
defineEmits(['close'])

const order = ref(null)
const loading = ref(false)

watch(
  () => [props.open, props.orderId],
  async ([open, id]) => {
    if (!open || !id) return
    loading.value = true
    order.value = null
    try {
      const { data } = await orderApi.show(id)
      order.value = data.order || data
    } catch {
      order.value = null
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

function money(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)
}
</script>

<style scoped>
.peek-modal { max-width: 640px; width: calc(100vw - 32px); }
.peek-loading { padding: 32px; text-align: center; color: #64748b; }
.peek-meta { display: flex; flex-wrap: wrap; gap: 14px; font-size: 13px; color: #334155; margin-bottom: 12px; }
.peek-reason { margin: 0 0 12px; padding: 8px 10px; border-radius: 8px; background: #fef2f2; color: #b91c1c; font-size: 13px; }
.peek-total { display: flex; justify-content: flex-end; gap: 16px; padding: 12px 4px 0; font-size: 15px; }
</style>
