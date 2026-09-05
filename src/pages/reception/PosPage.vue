<!--
  POS page (route: /app/payments/pos, name: hotel-payments-pos).
  Posts an incidental point-of-sale charge (restaurant, bar, laundry, shop,
  mini-bar...) straight onto the active room's folio so the balance due is
  kept up to date at checkout.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('receptionPanel.pos') }}</h1>
        <p class="muted">{{ $t('receptionPanel.posSubtitle') }}</p>
      </div>
      <button class="btn btn-secondary" :disabled="loading" @click="load">
        <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
      </button>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="grid-2" style="gap: 16px;">
      <div class="card" style="padding: 20px;">
        <h3 style="margin: 0 0 12px;"><i class="fas fa-cart-plus" style="color: var(--mrk-blue);"></i> {{ $t('receptionPanel.postCharge') }}</h3>
        <form @submit.prevent="submitCharge">
          <div class="form-group">
            <label>{{ $t('receptionPanel.selectRoom') }} *</label>
            <SkeletonLoader v-if="loading" variant="list" :count="3" />
            <select v-else v-model="form.reservation_id" class="input" required>
              <option :value="null" disabled>{{ $t('receptionPanel.chooseHouseGuest') }}</option>
              <option v-for="r in inHouse" :key="r.reservation_id" :value="r.reservation_id">
                {{ r.guest_name }} · {{ r.room?.room_number || r.room_number || '' }} · TZS {{ r.balance_due }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.chargeDescription') }} *</label>
            <input v-model="form.description" type="text" class="input" :placeholder="$t('receptionPanel.chargeDescriptionPlaceholder')" required />
          </div>
          <div class="form-group">
            <label>{{ $t('receptionPanel.amountTzs') }} *</label>
            <input v-model.number="form.amount" type="number" min="0" step="0.01" class="input" required />
          </div>
          <button class="btn btn-primary" :disabled="saving" type="submit">
            <i class="fas fa-circle-plus"></i> {{ saving ? $t('common.loading') : $t('receptionPanel.postToFolio') }}
          </button>
        </form>
      </div>

      <div class="card" style="padding: 20px;">
        <h3 style="margin: 0 0 12px;"><i class="fas fa-tag" style="color: var(--mrk-blue);"></i> {{ $t('receptionPanel.chargeTypes') }}</h3>
        <ul style="margin: 0; padding-left: 18px; line-height: 1.8;">
          <li>{{ $t('receptionPanel.typeRestaurant') }}</li>
          <li>{{ $t('receptionPanel.typeBar') }}</li>
          <li>{{ $t('receptionPanel.typeLaundry') }}</li>
          <li>{{ $t('receptionPanel.typeShop') }}</li>
          <li>{{ $t('receptionPanel.typeMiniBar') }}</li>
        </ul>
        <p class="muted" style="margin-top: 14px;">{{ $t('receptionPanel.autoBalances') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { reservationApi } from '@/api'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const { t } = useI18n()

const reservations = ref([])
const loading = ref(false)
const saving = ref(false)
const success = ref('')
const error = ref('')
const form = ref({ reservation_id: null, description: '', amount: null })

const inHouse = computed(() => reservations.value.filter((r) => ['confirmed', 'checked_in'].includes(r.status)))

async function load() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const res = await reservationApi.index({ per_page: 200 })
    reservations.value = res.data?.data || []
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

async function submitCharge() {
  if (!form.value.reservation_id || !form.value.description || !form.value.amount) return
  saving.value = true
  error.value = ''
  try {
    await reservationApi.postRoomCharge(form.value.reservation_id, {
      description: form.value.description,
      amount: form.value.amount,
    })
    success.value = t('receptionPanel.chargePosted')
    form.value = { reservation_id: null, description: '', amount: null }
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>