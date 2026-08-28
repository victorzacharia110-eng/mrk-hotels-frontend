<!--
  CashierTakeAwayPage — quick counter/takeaway order entry.
  Opens directly into the shared order builder with no table attached.
-->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-bag-shopping" aria-hidden="true"></i> {{ $t('cashier.takeAway.title') }}</h2>
        <button class="sm-btn sm success" @click="showModal = true">
          <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('cashier.takeAway.newOrder') }}
        </button>
      </div>
      <div class="panel-body">
        <p class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.takeAway.hint') }}</p>
      </div>
    </section>

    <NewOrderModal v-if="showModal" mode="takeaway" :title="$t('cashier.takeAway.newOrder')"
      @close="showModal = false" @created="onCreated" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'

const { t } = useI18n()
const showModal = ref(false)

function onCreated(order) {
  window.alert(t('cashier.order.created', { number: order.order_number }))
}
</script>


