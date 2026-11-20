<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head">
        <div>
          <h1>{{ $t('cashier.sales.title') }}</h1>
          <p>{{ $t('cashier.sales.subtitle') }}</p>
        </div>
        <div class="nc-head-actions">
          <OrderDateNav input-id="sales-date" v-model="date" :today="workingDateStore.workingDate"
            :today-label="$t('cashier.noCharge.today')" @change="load" />
          <button class="sm-btn sm success" type="button" @click="openModal">
            <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('cashier.sales.add') }}
          </button>
        </div>
      </div>

      <div class="table-scroll">
        <SkeletonLoader v-if="loading" variant="table" :count="5" :cols="8" />
        <table v-else class="sm-table">
          <thead>
            <tr>
              <th>{{ $t('cashier.summary.order') }}</th>
              <th>{{ $t('cashier.sales.guestType') }}</th>
              <th>{{ $t('cashier.sales.customer') }}</th>
              <th>{{ $t('cashier.sales.particular') }}</th>
              <th>{{ $t('cashier.sales.description') }}</th>
              <th>{{ $t('cashier.summary.amount') }}</th>
              <th>{{ $t('common.status') }}</th>
              <th>{{ $t('cashier.sales.settle') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.order_id">
              <td>{{ order.order_number }}</td>
              <td>{{ guestTypeLabel(order.guest_type) }}</td>
              <td>{{ order.guest_name || '—' }}<span v-if="order.room_number" class="room-tag">{{ order.room_number }}</span></td>
              <td>{{ order.particular || '—' }}</td>
              <td>{{ order.charge_description || order.notes || '—' }}</td>
              <td>{{ money(order.total_amount) }}</td>
              <td><span class="chip" :class="statusChip(order)">{{ statusLabel(order) }}</span></td>
              <td>
                <button v-if="isSettleable(order)" type="button" class="sm-btn sm primary"
                  :disabled="settlingId === order.order_id" @click="settle(order)">
                  {{ settlingId === order.order_id ? $t('common.saving') : $t('cashier.sales.settle') }}
                </button>
                <span v-else>—</span>
              </td>
            </tr>
            <tr v-if="!orders.length">
              <td colspan="8" class="empty">{{ $t('cashier.sales.none') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
    </section>

    <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
      <div class="modal-card" role="dialog" aria-modal="true" :aria-label="$t('cashier.sales.add')">
        <div class="modal-head">
          <h2>{{ $t('cashier.sales.add') }}</h2>
          <button type="button" class="icon-btn" :aria-label="$t('common.close')" @click="closeModal">
            <i class="fas fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <form class="modal-body" @submit.prevent="saveCharge">
          <label class="field">
            <span>{{ $t('cashier.sales.guestType') }}</span>
            <select v-model="form.guestType" class="sm-select sm" required @change="resetCustomer">
              <option v-for="type in guestTypes" :key="type" :value="type">{{ guestTypeLabel(type) }}</option>
            </select>
          </label>

          <label v-if="form.guestType !== 'non_guest'" class="field">
            <span>{{ $t('cashier.sales.customer') }}</span>
            <SearchableSelect v-model="form.guestKey" :options="customerOptions"
              :placeholder="$t('cashier.sales.selectCustomer')"
              :empty-label="$t('cashier.sales.noCustomer')" required
              :searching="form.guestType === 'creditor' && creditLoading"
              @search="onCustomerSearch" />
          </label>
          <label v-else class="field">
            <span>{{ $t('cashier.sales.customer') }}</span>
            <input v-model="form.guestName" class="sm-input" type="text" required
              :placeholder="$t('cashier.sales.customerPlaceholder')" />
          </label>

          <label class="field">
            <span>{{ $t('cashier.sales.particular') }}</span>
            <select v-model="form.particular" class="sm-select sm" required>
              <option v-for="particular in particulars" :key="particular" :value="particular">{{ particular }}</option>
            </select>
          </label>

          <label class="field">
            <span>{{ $t('cashier.sales.description') }}</span>
            <textarea v-model="form.description" class="sm-input" rows="3"
              :placeholder="$t('cashier.sales.descriptionPlaceholder')"></textarea>
          </label>

          <label class="field">
            <span>{{ $t('cashier.sales.amount') }}</span>
            <input v-model="form.amount" class="sm-input" type="number" min="0.01" step="0.01" required />
          </label>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="modal-actions">
            <button type="button" class="sm-btn sm ghost" @click="closeModal">{{ $t('common.cancel') }}</button>
            <button type="submit" class="sm-btn sm success" :disabled="saving">
              {{ saving ? $t('common.saving') : $t('cashier.sales.add') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { creditAccountApi, orderApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import OrderDateNav from '@/components/cashier/OrderDateNav.vue'
import { selectedOutlet } from '@/composables/useOutletContext'
import { useWorkingDateStore } from '@/stores/workingDate'
import { normalizeCreditAccounts } from '@/utils/payments'
import { toast } from '@/utils/toast'

const { t } = useI18n()
const workingDateStore = useWorkingDateStore()

const guestTypes = ['in_house', 'creditor', 'non_guest']
const particulars = ['EXTRA CHARGES', 'ROOM CHARGES', 'ROOM POSTING']

const orders = ref([])
const date = ref('')
const loading = ref(true)
const saving = ref(false)
const settlingId = ref(null)
const showModal = ref(false)
const error = ref('')
const formError = ref('')
const inHouseGuests = ref([])
const creditors = ref([])
const creditLoading = ref(false)
let creditTimer = null

const form = reactive({
  guestType: 'in_house',
  guestKey: '',
  guestName: '',
  particular: particulars[0],
  description: '',
  amount: '',
})

const guestKey = (guest) => `${guest.room_number || ''}|${guest.reservation_id || ''}`
const selectedInHouse = computed(() => inHouseGuests.value.find((g) => guestKey(g) === form.guestKey))
const selectedCreditor = computed(() => creditors.value.find((a) => a.credit_account_id === form.guestKey))
const customerOptions = computed(() => {
  if (form.guestType === 'in_house') {
    return inHouseGuests.value.map((guest) => ({
      value: guestKey(guest),
      label: `${guest.guest_name || 'Room ' + guest.room_number} · ${guest.room_number}`,
    }))
  }
  return creditors.value.map((account) => ({
    value: account.credit_account_id,
    label: account.name,
  }))
})

const customerName = computed(() => {
  if (form.guestType === 'in_house') return selectedInHouse.value?.guest_name || ''
  if (form.guestType === 'creditor') return selectedCreditor.value?.name || ''
  return form.guestName.trim()
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = {
      order_type: 'manual_charge',
      per_page: 100,
      outlet_id: selectedOutlet.value?.outlet_id || undefined,
    }
    if (date.value) {
      if (date.value < workingDateStore.workingDate) params.date = date.value
      else params.from_date = date.value
    }
    const { data } = await orderApi.index(params)
    orders.value = data.data || []
  } catch (err) {
    error.value = err.response?.data?.message || t('common.loadError')
  } finally {
    loading.value = false
  }
}

async function loadOptions() {
  try {
    const [{ data }, { data: creditData }] = await Promise.all([
      orderApi.formOptions(),
      creditAccountApi.index({ type: 'creditor', per_page: 250 }),
    ])
    inHouseGuests.value = data.in_house_guests || []
    creditors.value = normalizeCreditAccounts(creditData).filter((account) => account.type === 'creditor')
  } catch {
    inHouseGuests.value = []
    creditors.value = []
  }
}

function onCustomerSearch(query) {
  if (form.guestType !== 'creditor') return
  clearTimeout(creditTimer)
  creditTimer = setTimeout(async () => {
    creditLoading.value = true
    try {
      const { data } = await creditAccountApi.index({
        type: 'creditor',
        search: query,
        per_page: 250,
      })
      creditors.value = normalizeCreditAccounts(data).filter((account) => account.type === 'creditor')
    } finally {
      creditLoading.value = false
    }
  }, 250)
}

function resetCustomer() {
  form.guestKey = ''
  form.guestName = ''
  formError.value = ''
}

function openModal() {
  formError.value = ''
  resetCustomer()
  form.particular = particulars[0]
  form.description = ''
  form.amount = ''
  form.guestType = 'in_house'
  showModal.value = true
  loadOptions()
}

function closeModal() {
  showModal.value = false
}

async function saveCharge() {
  formError.value = ''
  const amount = Number(form.amount)
  if (!customerName.value) {
    formError.value = t('cashier.sales.selectCustomer')
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    formError.value = t('cashier.sales.invalidAmount')
    return
  }

  saving.value = true
  try {
    const outletType = selectedOutlet.value?.type === 'bar' ? 'bar' : 'restaurant'
    await orderApi.store({
      department: outletType,
      outlet_id: selectedOutlet.value?.outlet_id || undefined,
      order_type: 'manual_charge',
      guest_type: form.guestType,
      guest_name: customerName.value,
      particular: form.particular,
      charge_description: form.description.trim() || null,
      amount,
      room_number: form.guestType === 'in_house' ? selectedInHouse.value?.room_number : undefined,
      reservation_id: form.guestType === 'in_house' ? selectedInHouse.value?.reservation_id : undefined,
      credit_account_id: form.guestType === 'creditor' ? selectedCreditor.value?.credit_account_id : undefined,
      notes: form.description.trim() || null,
    })
    toast(t('cashier.sales.created'), 'success')
    closeModal()
    await load()
  } catch (err) {
    formError.value = err.response?.data?.message || t('common.saveError')
  } finally {
    saving.value = false
  }
}

function money(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

function isSettleable(order) {
  return order.payment_status === 'unpaid' && !['cancelled', 'merged', 'completed'].includes(order.status)
}

function statusLabel(order) {
  if (order.status === 'cancelled') return t('cashier.takeAway.status.cancelled')
  if (order.payment_status === 'paid' || order.payment_status === 'billed_to_room') return t('cashier.takeAway.status.completed')
  return t('cashier.takeAway.status.pending')
}

function statusChip(order) {
  if (order.status === 'cancelled') return 'cancelled'
  if (order.payment_status === 'paid' || order.payment_status === 'billed_to_room') return 'approved'
  return 'pending'
}

function guestTypeLabel(type) {
  const key = `cashier.sales.guestTypes.${type}`
  const label = t(key)
  return label === key ? type : label
}

async function settle(order) {
  settlingId.value = order.order_id
  try {
    if (order.guest_type === 'in_house') {
      await orderApi.billToRoom(order.order_id, {
        room_number: order.room_number,
        reservation_id: order.reservation_id,
      })
    } else if (order.guest_type === 'creditor') {
      await orderApi.settleCreditAccount(order.order_id, {
        credit_account_id: order.credit_account_id,
      })
    } else {
      await orderApi.pay(order.order_id, { method: 'cash' })
    }
    toast(t('cashier.sales.settled'), 'success')
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.saveError')
  } finally {
    settlingId.value = null
  }
}

watch(() => selectedOutlet.value?.outlet_id, () => load())
onMounted(load)
</script>

<style scoped>
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.panel-head h1 { margin: 0 0 4px; font-size: 20px; }
.panel-head p { margin: 0; color: #6b7280; font-size: 13px; }
.nc-head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.room-tag { margin-left: 6px; color: #6b7280; font-size: 11px; }
.form-error { color: #b42318; font-size: 13px; }
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.5);
}
.modal-card {
  width: min(480px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
}
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #e5e7eb; }
.modal-head h2 { margin: 0; font-size: 17px; }
.modal-body { display: grid; gap: 14px; padding: 20px; }
.field { display: grid; gap: 6px; font-size: 13px; font-weight: 600; }
.field textarea { resize: vertical; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px; }
.icon-btn { border: 0; background: transparent; color: #6b7280; cursor: pointer; }
</style>
