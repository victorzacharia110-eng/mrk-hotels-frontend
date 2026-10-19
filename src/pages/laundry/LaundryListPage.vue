<!--
  LaundryListPage.vue
  Guest laundry order management. Features: service/status/payment/date filters,
  order-number search, create/edit modal with dynamic line items and a live
  estimated charge, quick status transitions (pending → ready → delivered,
  cancel) and delete. Management actions gated by module 40 permissions.
  Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: back link, refresh plus permission-gated "new order" button -->
    <div class="page-head">
      <div class="head-left">
        <button
          type="button"
          class="btn btn-secondary btn-back"
          :title="$t('common.back')"
          @click="$router.back()"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
        </button>
        <div>
          <h1>{{ $t('laundry.title') }}</h1>
          <p class="muted">{{ $t('laundry.subtitle') }}</p>
        </div>
      </div>
      <div class="head-actions">
        <div class="hsk-calendar">
          <button
            type="button"
            class="hsk-cal-step"
            :aria-label="$t('housekeeping.prevDay')"
            :title="$t('housekeeping.prevDay')"
            @click="stepDate(-1)"
          >
            <i class="fas fa-chevron-left" aria-hidden="true"></i>
          </button>
          <i class="fas fa-calendar-day" aria-hidden="true"></i>
          <input
            v-model="filters.date"
            type="date"
            class="input"
            :aria-label="$t('housekeeping.calendar')"
            @change="load"
          />
          <button
            type="button"
            class="hsk-cal-step"
            :aria-label="$t('housekeeping.nextDay')"
            :title="$t('housekeeping.nextDay')"
            @click="stepDate(1)"
          >
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('laundry.refresh') }}
        </button>
        <button
          v-if="canManage && bulk.selectedCount > 0"
          class="btn btn-danger"
          @click="showBulkDelete = true"
        >
          <i class="fas fa-trash"></i> {{ $t('common.deleteSelected') }} ({{ bulk.selectedCount }})
        </button>
        <button v-if="canManage" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('laundry.newOrder') }}
        </button>
        <button v-if="canManage" class="btn btn-secondary" @click="$router.push('/app/laundry/cloth-types')">
          <i class="fas fa-shirt"></i> {{ $t('laundry.clothTypes') }}
        </button>
        <TableExportButton filename="laundry" :load-all="laundryExportRows" :columns="exportColumns" />
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filter bar: narrows orders by service, status, payment status, date or order number -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('laundry.service') }}</label>
          <SearchableSelect
            v-model="filters.service"
            :options="serviceOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('laundry.status') }}</label>
          <SearchableSelect
            v-model="filters.status"
            :options="statusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('orders.payment') }}</label>
          <SearchableSelect
            v-model="filters.payment_status"
            :options="paymentStatusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('laundry.orderDate') }}</label>
          <input v-model="filters.date" type="date" class="input" @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input
            v-model="filters.search"
            type="text"
            class="input"
            :placeholder="$t('laundry.orderNumber')"
            @input="triggerSearch"
          />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters">
            <i class="fas fa-filter-circle-xmark"></i> {{ $t('common.clear') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading indicator shown while the list request is in flight -->
    <div v-if="loading" class="alert alert-info">{{ $t('laundry.loading') }}</div>

    <!-- Orders table with status workflow actions and payment badges -->
    <div v-else>
      <!-- Manual (room + customer) vs automated hotel-linen runs -->
      <div class="source-switch" role="tablist" :aria-label="$t('laundry.guestType')">
        <button
          type="button"
          role="tab"
          class="source-btn"
          :class="{ active: sourceView === 'manual' }"
          :aria-selected="sourceView === 'manual'"
          @click="sourceView = 'manual'"
        >
          <i class="fas fa-jug-detergent" aria-hidden="true"></i> {{ $t('laundry.manualOrders') }}
        </button>
        <button
          type="button"
          role="tab"
          class="source-btn"
          :class="{ active: sourceView === 'automated' }"
          :aria-selected="sourceView === 'automated'"
          @click="sourceView = 'automated'"
        >
          <i class="fas fa-layer-group" aria-hidden="true"></i> {{ $t('laundry.automatedOrders') }}
        </button>
      </div>

      <!-- Cashier-style action bar: runs against the single selected order -->
      <div class="table-actions">
        <button
          type="button"
          class="sm-btn sm"
          :disabled="!singleSelected"
          :title="$t('laundry.viewOrder')"
          @click="openDrawer(singleSelected)"
        >
          <i class="fas fa-eye" aria-hidden="true"></i> {{ $t('laundry.viewOrder') }}
        </button>
        <button
          type="button"
          class="sm-btn sm ghost"
          :disabled="!canSettleSelected"
          :title="$t('laundry.settle')"
          @click="openSettle(singleSelected)"
        >
          <i class="fas fa-money-bill" aria-hidden="true"></i> {{ $t('laundry.settle') }}
        </button>
        <button
          type="button"
          class="sm-btn sm danger-ghost"
          :disabled="!canVoidSelected"
          :title="$t('laundry.voidOrder')"
          @click="openDrawer(singleSelected); promptVoid()"
        >
          <i class="fas fa-ban" aria-hidden="true"></i> {{ $t('laundry.void') }}
        </button>
        <span class="spacer"></span>
        <p v-if="!singleSelected" class="table-actions-hint">
          <i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.summary.selectToAct') }}
        </p>
      </div>

      <div class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col" class="bulk-col">
              <input
                v-if="canManage"
                type="checkbox"
                :checked="bulk.allSelected"
                :indeterminate.prop="bulk.someSelected && !bulk.allSelected"
                :aria-label="$t('common.selectAll')"
                @change="bulk.toggleAll()"
              />
            </th>
            <th scope="col">{{ $t('laundry.orderNumber') }}</th>
            <th scope="col">{{ $t('laundry.guest') }}</th>
            <th scope="col">{{ $t('laundry.room') }}</th>
            <th scope="col">{{ $t('laundry.tableService') }}</th>
            <th scope="col">{{ $t('laundry.items') }}</th>
            <th scope="col">{{ $t('laundry.attendant') }}</th>
            <th scope="col">{{ $t('laundry.status') }}</th>
            <th scope="col">{{ $t('orders.payment') }}</th>
            <th scope="col">{{ $t('laundry.orderDate') }}</th>
            <th scope="col">{{ $t('laundry.totalCharge') }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="sourceView === 'manual'">
            <tr v-for="order in orders" :key="order.laundry_order_id">
              <td class="bulk-col">
                <input
                  v-if="canManage"
                  type="checkbox"
                  :checked="bulk.isSelected(order.laundry_order_id)"
                  @change="bulk.toggle(order.laundry_order_id)"
                />
              </td>
              <td>
                <button type="button" class="btn-link" @click="openDrawer(order)">
                  <strong>{{ order.order_number }}</strong>
                </button>
              </td>
              <td>{{ order.guest_name || '-' }}</td>
              <td>{{ order.room_number || '-' }}</td>
              <td class="capitalize">{{ serviceLabel(order.service) }}</td>
              <td>{{ order.items_count || '-' }}</td>
              <td>{{ order.attendant?.full_name || '-' }}</td>
              <td>
                <span class="badge" :class="displayStatus(order).badge">{{
                  displayStatus(order).label
                }}</span>
              </td>
              <td>
                <span class="badge" :class="paymentBadge(order.payment_status)">{{
                  paymentLabel(order.payment_status)
                }}</span>
              </td>
              <td>{{ order.order_date || '-' }}</td>
              <td>
                <span class="price">{{ curCode() }} {{ Number(order.total_charge).toLocaleString() }}</span>
              </td>
            </tr>
            <tr v-if="!orders.length && !loading">
              <td colspan="11" class="muted">{{ $t('laundry.empty') }}</td>
            </tr>
          </template>
          <tr v-else>
            <td colspan="11" class="muted">{{ $t('laundry.automatedEmpty') }}</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- Pagination controls (shown when there is more than one page of orders) -->
    <div v-if="meta.total > meta.per_page" class="pagination">
      <button
        class="btn btn-sm btn-secondary"
        :disabled="!meta.prev_page_url"
        @click="goPage(meta.current_page - 1)"
      >
        {{ $t('common.previous') }}
      </button>
      <span class="muted">{{
        $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page })
      }}</span>
      <button
        class="btn btn-sm btn-secondary"
        :disabled="!meta.next_page_url"
        @click="goPage(meta.current_page + 1)"
      >
        {{ $t('common.next') }}
      </button>
    </div>

    <!-- Create/edit order modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-jug-detergent"></i>
            {{ editing ? $t('laundry.editOrder') : $t('laundry.newOrder') }}
          </h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <!-- Two major modes: an in-house guest (auto-filled) or a walk-in customer -->
          <div class="guest-type" role="radiogroup" :aria-label="$t('laundry.guestType')">
            <label class="guest-type-option" :class="{ active: guestType === 'in_house' }">
              <input v-model="guestType" type="radio" value="in_house" />
              <i class="fas fa-bed" aria-hidden="true"></i> {{ $t('laundry.inHouseGuest') }}
            </label>
            <label class="guest-type-option" :class="{ active: guestType === 'customer' }">
              <input v-model="guestType" type="radio" value="customer" />
              <i class="fas fa-user" aria-hidden="true"></i> {{ $t('laundry.customer') }}
            </label>
          </div>

          <div class="form-grid">
            <!-- IN HOUSE: pick the stay, room + guest auto-fill from the booking -->
            <div v-if="guestType === 'in_house'" class="form-group form-full">
              <label>{{ $t('laundry.selectInHouseGuest') }}</label>
              <SearchableSelect
                v-model="selectedGuestId"
                :options="inHouseOptions"
                :empty-label="$t('laundry.selectInHouseGuest')"
                @change="onGuestSelect"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('laundry.guestName') }}</label>
              <input
                v-model="form.guest_name"
                type="text"
                class="input"
                :readonly="guestType === 'in_house'"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('laundry.service') }} *</label>
              <SearchableSelect v-model="form.service" :options="serviceOptions" required />
            </div>
            <div class="form-group">
              <label>{{ $t('laundry.room') }}</label>
              <input
                v-model="form.room_number"
                type="text"
                class="input"
                :readonly="guestType === 'in_house'"
                :placeholder="$t('laundry.roomNumberPlaceholder')"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('laundry.orderDate') }}</label>
              <input v-model="form.order_date" type="date" class="input" readonly />
            </div>
            <div class="form-group">
              <label>{{ $t('laundry.paymentStatus') }}</label>
              <SearchableSelect v-model="form.payment_status" :options="paymentStatusOptions" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('laundry.attendant') }}</label>
              <SearchableSelect
                v-model="form.attendant_id"
                :options="attendantOptions"
                :empty-label="$t('common.none')"
              />
            </div>
          </div>

          <!-- Line items: repeatable rows of item name, quantity, unit price and a remove button -->
          <div class="items-head">
            <h3>{{ $t('laundry.lineItems') }}</h3>
            <button type="button" class="btn btn-sm btn-secondary" @click="addItem">
              <i class="fas fa-plus"></i> {{ $t('laundry.addItem') }}
            </button>
          </div>
          <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
            <div class="item-grid">
              <div class="form-group">
                <label>{{ $t('laundry.itemName') }}</label>
                <SearchableSelect
                  v-if="clothTypeOptions.length"
                  v-model="item.cloth_type_id"
                  :options="clothTypeOptions"
                  :empty-label="$t('laundry.selectClothType')"
                  @change="onClothTypeChange(item)"
                />
                <input v-else v-model="item.item_name" type="text" class="input" required />
              </div>
              <div class="form-group">
                <label>{{ $t('orders.quantity') }}</label>
                <input
                  v-model.number="item.quantity"
                  type="number"
                  min="1"
                  class="input"
                  required
                />
              </div>
              <div class="form-group">
                <label>{{ $t('laundry.unitPrice') }}</label>
                <input
                  v-model.number="item.unit_price"
                  type="number"
                  min="0"
                  step="0.01"
                  class="input"
                  required
                  :readonly="Boolean(item.cloth_type_id)"
                />
              </div>
              <div class="form-group item-remove">
                <button type="button" class="btn btn-sm btn-danger" @click="removeItem(idx)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
          <p v-if="form.items.length" class="muted">
            {{
              $t('laundry.estimatedCharge', { currency: curCode(), amount: Number(estimatedCharge).toLocaleString() })
            }}
          </p>

          <div class="form-group form-full">
            <label>{{ $t('laundry.notes') }}</label>
            <textarea v-model="form.notes" rows="2" class="textarea"></textarea>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{
                saving
                  ? $t('common.saving')
                  : editing
                    ? $t('laundry.updateOrder')
                    : $t('laundry.saveOrder')
              }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Confirmation modal for bulk deletion (type DELETE to confirm) -->
    <DeleteConfirmModal
      v-model="showBulkDelete"
      :count="bulk.selectedCount"
      :busy="deleting"
      @confirm="bulkDelete"
    />

    <!-- Order-detail drawer: items, total and settle / edit / void actions -->
    <div v-if="drawerOrder" class="modal-overlay" @click.self="closeDrawer">
      <div class="modal drawer">
        <div class="modal-head">
          <h2><i class="fas fa-receipt" aria-hidden="true"></i> {{ drawerOrder.order_number }}</h2>
          <button class="modal-close" :aria-label="$t('common.close')" @click="closeDrawer">
            <i class="fas fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <p class="settle-order">
          {{ drawerOrder.guest_name || '-' }}
          <template v-if="drawerOrder.room_number"> · Room {{ drawerOrder.room_number }}</template>
          · <span class="capitalize">{{ serviceLabel(drawerOrder.service) }}</span>
        </p>

        <table class="drawer-items">
          <thead>
            <tr>
              <th>{{ $t('laundry.itemName') }}</th>
              <th>{{ $t('orders.quantity') }}</th>
              <th>{{ $t('laundry.unitPrice') }}</th>
              <th>{{ $t('laundry.totalCharge') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in drawerOrder.items || []" :key="i">
              <td>{{ item.item_name }}</td>
              <td>{{ item.quantity }}</td>
              <td>{{ curCode() }} {{ Number(item.unit_price).toLocaleString() }}</td>
              <td>{{ curCode() }} {{ Number(item.subtotal ?? item.unit_price * item.quantity).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>

        <p class="drawer-total">
          {{ $t('laundry.totalCharge') }}:
          <span class="price">{{ curCode() }} {{ Number(drawerOrder.total_charge).toLocaleString() }}</span>
        </p>
        <p>
          {{ $t('laundry.status') }}:
          <span class="badge" :class="displayStatus(drawerOrder).badge">{{ displayStatus(drawerOrder).label }}</span>
        </p>
        <p v-if="!isEditable(drawerOrder)" class="muted settled-hint">
          <i class="fas fa-lock" aria-hidden="true"></i> {{ $t('laundry.settledHint') }}
        </p>

        <div class="drawer-actions">
          <!-- Operational wash steps (unsettled orders only) -->
          <template v-if="isEditable(drawerOrder)">
            <button
              v-if="drawerOrder.status === 'pending'"
              type="button"
              class="sm-btn sm ghost"
              @click="setStatus(drawerOrder, 'ready')"
            >
              <i class="fas fa-check-double" aria-hidden="true"></i> {{ $t('laundry.markReady') }}
            </button>
            <button
              v-if="drawerOrder.status === 'ready'"
              type="button"
              class="sm-btn sm success"
              @click="setStatus(drawerOrder, 'delivered')"
            >
              <i class="fas fa-truck" aria-hidden="true"></i> {{ $t('laundry.markDelivered') }}
            </button>
            <button
              v-if="drawerOrder.payment_status === 'unpaid'"
              type="button"
              class="sm-btn sm primary"
              @click="openSettle(drawerOrder)"
            >
              <i class="fas fa-money-bill" aria-hidden="true"></i> {{ $t('laundry.settle') }}
            </button>
            <button type="button" class="sm-btn sm ghost" @click="openEdit(drawerOrder)">
              <i class="fas fa-pen" aria-hidden="true"></i> {{ $t('common.edit') }}
            </button>
            <span class="spacer"></span>
            <button
              v-if="drawerOrder.status !== 'cancelled'"
              type="button"
              class="sm-btn sm danger-ghost"
              @click="promptVoid"
            >
              <i class="fas fa-ban" aria-hidden="true"></i> {{ $t('laundry.voidOrder') }}
            </button>
          </template>
        </div>

        <div v-if="voidConfirming" class="drawer-void">
          <label :for="'void-reason'">{{ $t('laundry.voidReason') }}</label>
          <input
            id="void-reason"
            v-model.trim="voidReason"
            type="text"
            maxlength="255"
            class="input"
          />
          <div class="drawer-actions">
            <button type="button" class="sm-btn sm ghost" @click="voidConfirming = false">
              {{ $t('common.cancel') }}
            </button>
            <button
              type="button"
              class="sm-btn sm danger"
              :disabled="voiding"
              @click="confirmVoid"
            >
              <i class="fas fa-ban" aria-hidden="true"></i>
              {{ voiding ? $t('common.saving') : $t('laundry.voidOrder') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Settlement modal: mark the order paid or post it to the guest's room -->
    <div v-if="showSettleModal" class="modal-overlay" @click.self="closeSettle">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-money-bill-wave"></i>
            {{ $t('laundry.settleTitle') }}
          </h2>
          <button class="modal-close" @click="closeSettle"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="settleError" class="alert alert-error">{{ settleError }}</div>

        <p class="settle-order">
          <strong>{{ settleOrder?.order_number }}</strong>
          · {{ settleOrder?.guest_name || '-' }} ·
          <span class="price">{{ curCode() }} {{ Number(settleOrder?.total_charge || 0).toLocaleString() }}</span>
        </p>
        <p class="muted">{{ $t('laundry.settleChoice') }}</p>

        <!-- Room (in-house) orders settle by posting to the guest's folio. -->
        <label v-if="isInHouse(settleOrder)" class="settle-option">
          <input v-model="settleMode" type="radio" value="billed_to_room" />
          <span>
            <i class="fas fa-bed"></i> {{ $t('laundry.settleRoom') }}
            <small class="muted">{{ $t('orders.paymentBilledToRoom') }}</small>
          </span>
        </label>
        <label class="settle-option">
          <input v-model="settleMode" type="radio" value="paid" />
          <span>
            <i class="fas fa-cash-register"></i> {{ $t('laundry.settlePaid') }}
            <small class="muted">{{ $t('orders.paymentPaid') }}</small>
          </span>
        </label>

        <div v-if="settleMode === 'billed_to_room' && !settleOrder?.reservation_id" class="form-group settle-room">
          <label>{{ $t('laundry.room') }}</label>
          <input v-model="settleRoomNumber" type="text" class="input" :placeholder="$t('laundry.roomNumberPlaceholder')" />
        </div>

        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" @click="closeSettle">
            {{ $t('common.cancel') }}
          </button>
          <button type="button" class="btn btn-primary" :disabled="settling" @click="confirmSettle">
            <i class="fas fa-check"></i>
            {{ settling ? $t('common.saving') : $t('laundry.settle') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { laundryApi, clothTypeApi, userApi, orderApi } from '@/api'
import { collectAllRows } from '@/utils/export'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'
import { useBulkSelection } from '@/composables/useBulkSelection'

import { useTenantCurrency } from '@/utils/currency'

const { curCode } = useTenantCurrency()

const { t } = useI18n()
const authStore = useAuthStore()
// Permission flag: laundry management requires module 40 access plus the ability to operate.
const canManage = computed(() => authStore.can(40) && authStore.canOperate)

// List/table state: order rows, user lookups, pagination, filters and UI flags.
const orders = ref([])
const users = ref([])
const clothTypes = ref([])
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({ service: '', status: '', payment_status: '', date: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

const bulk = useBulkSelection(() => orders.value, { idKey: 'laundry_order_id' })
const showBulkDelete = ref(false)
const deleting = ref(false)

// The order currently ticked for the cashier-style action bar. Single-ticket
// actions (view / settle / void) need exactly one selected order.
const singleSelected = computed(() => {
  const rows = orders.value.filter((o) => bulk.isSelected(o.laundry_order_id))
  return rows.length === 1 ? rows[0] : null
})
const canSettleSelected = computed(
  () => singleSelected.value?.payment_status === 'unpaid',
)
const canVoidSelected = computed(
  () => singleSelected.value && isEditable(singleSelected.value) && singleSelected.value.status !== 'cancelled',
)

// Create/edit modal state.
const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
// The new-order page offers two major modes: an in-house guest (auto-filled
// from the active stay) or a walk-in customer typed by hand.
const guestType = ref('in_house')
const inHouseGuests = ref([])
const selectedGuestId = ref('')
// Order-detail drawer (cashier-style view with settle / void / edit actions).
const drawerOrder = ref(null)
// Toggle between the manual orders (room + customer) and automated linen runs.
const sourceView = ref('manual')
// Form model bound to the order modal, including dynamic line items.
const form = reactive({
  guest_name: '',
  service: 'wash',
  room_number: '',
  items: [],
  status: 'pending',
  payment_status: 'unpaid',
  order_date: '',
  attendant_id: '',
  notes: '',
})

// Laundry service types offered to guests (filter bar and form).
const serviceOptions = [
  { value: 'wash', label: t('laundry.serviceWash') },
  { value: 'iron', label: t('laundry.serviceIron') },
  { value: 'dry_clean', label: t('laundry.serviceDryClean') },
]

// Order workflow statuses (filter bar and form).
const statusOptions = [
  { value: 'pending', label: t('laundry.statusPending') },
  { value: 'ready', label: t('laundry.statusReady') },
  { value: 'delivered', label: t('laundry.statusDelivered') },
  { value: 'cancelled', label: t('laundry.statusCancelled') },
]

// Payment statuses shared with the F&B orders module (labels come from orders.*).
const paymentStatusOptions = [
  { value: 'unpaid', label: t('orders.paymentUnpaid') },
  { value: 'paid', label: t('orders.paymentPaid') },
  { value: 'billed_to_room', label: t('orders.paymentBilledToRoom') },
]

// Attendant options: registered laundry personnel first, otherwise housekeeping
// staff — matching the PDF's "laundry personnel, else housekeeping" rule. Each
// option carries the user's role/department so the table can badge them.
const attendantOptions = computed(() => {
  const pool = users.value.filter((u) => {
    const role = (u.user_role || '').toLowerCase()
    const dept = (u.department || '').toLowerCase()
    return role === 'housekeeping' || dept === 'laundry' || dept === 'housekeeping'
  })
  const list = pool.length ? pool : users.value
  return list.map((user) => ({
    value: user.user_id,
    label: user.full_name,
    role: user.user_role,
    department: user.department,
  }))
})

// Registered cloth/linen types for the searchable item picker.
const clothTypeOptions = computed(() =>
  clothTypes.value
    .filter((cloth) => cloth.is_active)
    .map((cloth) => ({
      value: cloth.cloth_type_id,
      label: cloth.name,
      wash_price: Number(cloth.wash_price),
      iron_price: Number(cloth.iron_price),
      dry_clean_price: Number(cloth.dry_clean_price),
    })),
)

/** Price of a cloth type for the currently chosen service, or 0. */
function priceFor(cloth, service) {
  const map = { wash: 'wash_price', iron: 'iron_price', dry_clean: 'dry_clean_price' }
  return cloth?.[map[service]] ?? 0
}

/** Fills a line item's name + unit price from the selected cloth type. */
function onClothTypeChange(item) {
  const cloth = clothTypes.value.find((c) => c.cloth_type_id === item.cloth_type_id)
  if (!cloth) return
  item.item_name = cloth.name
  item.unit_price = priceFor(cloth, form.service)
}

// Switching the order's service re-prices every registry-derived line item,
// keeping the estimate in step with the chosen laundry service.
watch(
  () => form.service,
  (service) => {
    for (const item of form.items) {
      if (!item.cloth_type_id) continue
      const cloth = clothTypes.value.find((c) => c.cloth_type_id === item.cloth_type_id)
      if (cloth) item.unit_price = priceFor(cloth, service)
    }
  },
)

/** Returns the CSS badge class for the given payment status. */
function paymentBadge(status) {
  const map = { unpaid: 'badge-red', paid: 'badge-green', billed_to_room: 'badge-blue' }
  return map[status] || 'badge-gray'
}

/**
 * Settlement-driven status shown in the STATUS column. Per the resolution the
 * guest only ever sees two conditions: PENDING (not yet settled) or COMPLETE
 * (settled by payment or posted to a room). The internal ready/delivered
 * workflow still drives the operational buttons, but the column the guest reads
 * reflects settlement.
 */
function displayStatus(order) {
  const settled = ['paid', 'billed_to_room'].includes(order.payment_status)
  return settled
    ? { key: 'complete', label: t('laundry.statusComplete'), badge: 'badge-green' }
    : { key: 'pending', label: t('laundry.statusPending'), badge: 'badge-yellow' }
}

/** Maps a payment status key to its translated display label. */
function paymentLabel(status) {
  const map = {
    unpaid: t('orders.paymentUnpaid'),
    paid: t('orders.paymentPaid'),
    billed_to_room: t('orders.paymentBilledToRoom'),
  }
  return map[status] || status
}

/** Maps a laundry service key to its translated display label. */
function serviceLabel(service) {
  const map = {
    wash: t('laundry.serviceWash'),
    iron: t('laundry.serviceIron'),
    dry_clean: t('laundry.serviceDryClean'),
  }
  return map[service] || service
}

/** Formats an ISO datetime string for display, or '-' when absent. */
function formatDateTime(date) {
  return date ? String(date).slice(0, 16).replace('T', ' ') : '-'
}

/** Creates a blank line-item object for the items list. */
function emptyItem() {
  return { cloth_type_id: '', item_name: '', quantity: 1, unit_price: 0 }
}

/** Appends a blank line item to the form. */
function addItem() {
  form.items.push(emptyItem())
}

/** Removes the line item at the given index from the form. */
function removeItem(idx) {
  form.items.splice(idx, 1)
}

/** Computes the estimated total charge from the entered line items. */
const estimatedCharge = computed(() =>
  form.items.reduce(
    (sum, item) => sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 0),
    0,
  ),
)

/**
 * Fetches the paginated laundry order list using the current filters and page.
 * Stores the rows and pagination meta, surfacing errors via the error banner.
 */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await laundryApi.index({
      service: filters.service,
      status: filters.status,
      payment_status: filters.payment_status,
      date: filters.date,
      search: filters.search,
      page: page.value,
      per_page: 15,
    })
    orders.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('laundry.loadError')
  } finally {
    loading.value = false
  }
}

/** Fetches every laundry order page for export, honouring the active filters. */
const loadAllOrders = () =>
  collectAllRows((page, perPage) =>
    laundryApi.index({
      service: filters.service,
      status: filters.status,
      payment_status: filters.payment_status,
      date: filters.date,
      search: filters.search,
      page,
      per_page: perPage,
    }),
  )

// Ordered, human-readable columns for the CSV/Excel/PDF export.
const exportColumns = [
  { key: 'order_number', label: 'Order Number' },
  { key: 'guest_name', label: 'Guest' },
  { key: 'room_number', label: 'Room' },
  { key: 'service', label: 'Service' },
  { key: 'items', label: 'Items' },
  { key: 'items_count', label: 'Items Count' },
  { key: 'status', label: 'Status' },
  { key: 'payment_status', label: 'Payment' },
  { key: 'order_date', label: 'Order Date' },
  { key: 'notes', label: 'Notes' },
  { key: 'ready_at', label: 'Ready' },
  { key: 'delivered_at', label: 'Delivered' },
  { key: 'created_at', label: 'Created' },
  { key: 'total_charge', label: 'Amount' },
]

/** Turns a raw API order into a flat, export-ready row (no nested objects). */
function toExportRow(order) {
  return {
    order_number: order.order_number,
    guest_name: order.guest_name || '',
    room_number: order.room_number || '',
    service: serviceLabel(order.service),
    items: (order.items || [])
      .map((item) => (Number(item.quantity) > 1 ? `${item.item_name} x${item.quantity}` : item.item_name))
      .filter(Boolean)
      .join('; '),
    items_count: order.items_count,
    status: displayStatus(order).label,
    payment_status: paymentLabel(order.payment_status),
    order_date: order.order_date || '',
    notes: order.notes || '',
    ready_at: formatDateTime(order.ready_at),
    delivered_at: formatDateTime(order.delivered_at),
    created_at: formatDateTime(order.created_at),
    total_charge: Number(order.total_charge || 0).toFixed(2),
  }
}

/** Fetches every order and maps it to the flat, human-readable export shape. */
const laundryExportRows = async () => (await loadAllOrders()).map(toExportRow)

function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function stepDate(days) {
  const base = filters.date ? new Date(`${filters.date}T00:00:00`) : new Date()
  base.setDate(base.getDate() + days)
  filters.date = toISODate(base)
  load()
}

/** Loads the list of users for the attendant selector; failures are silently ignored. */
async function loadUsers() {
  try {
    users.value = (await userApi.index({ per_page: 100 })).data.data || []
  } catch {
    // ignore
  }
}

/**
 * Loads the currently in-house guests (rooms with an active stay) so the
 * "IN HOUSE GUEST" mode can auto-fill room number and guest name. The same
 * endpoint the F&B order pad uses; failures are silently ignored.
 */
async function loadInHouseGuests() {
  try {
    const res = await orderApi.formOptions()
    inHouseGuests.value = res.data.in_house_guests || []
  } catch {
    inHouseGuests.value = []
  }
}

/** In-house guest picker options keyed by reservation for stable selection. */
const inHouseOptions = computed(() =>
  inHouseGuests.value.map((g) => ({
    value: String(g.reservation_id || g.room_number),
    label: `${g.guest_name} · Room ${g.room_number}`,
  })),
)

/**
 * Auto-fills room number and guest name when an in-house guest is picked.
 * The stay's own reservation is stamped so "bill to room" posting resolves.
 */
function onGuestSelect(value) {
  const guest = inHouseGuests.value.find(
    (g) => String(g.reservation_id || g.room_number) === String(value),
  )
  if (!guest) return
  form.guest_name = guest.guest_name || ''
  form.room_number = guest.room_number || ''
  form.reservation_id = guest.reservation_id || undefined
}

/** Loads the registered cloth types feeding the item picker. */
async function loadClothTypes() {
  try {
    const res = await clothTypeApi.index({ per_page: 100 })
    clothTypes.value = res.data.cloth_types?.data || res.data.data?.data || []
  } catch {
    // ignore
  }
}

/** Sets the page number and reloads the order list. */
function goPage(p) {
  page.value = p
  load()
}

/** Resets all filter criteria and reloads the list from page 1. */
function clearFilters() {
  page.value = 1
  filters.service = ''
  filters.status = ''
  filters.payment_status = ''
  filters.date = ''
  filters.search = ''
  load()
}

/** Debounces search input by resetting to page 1 and reloading. */
function triggerSearch() {
  page.value = 1
  load()
}

/** Restores the order form to its default empty state with one blank line item. */
async function resetForm() {
  guestType.value = 'in_house'
  selectedGuestId.value = ''
  form.guest_name = ''
  form.service = 'wash'
  form.room_number = ''
  form.reservation_id = undefined
  form.items = [emptyItem()]
  form.status = 'pending'
  form.payment_status = 'unpaid'
  form.order_date = ''
  form.attendant_id = ''
  form.notes = ''
  try {
    const bd = (await import('@/stores/businessDate')).useBusinessDateStore()
    await bd.ensureLoaded()
    form.order_date = bd.current || new Date().toISOString().slice(0, 10)
  } catch {
    // ignore
  }
}

/** Prepares the modal for creating a brand-new order. */
async function openCreate() {
  await resetForm()
  modalError.value = ''
  editing.value = false
  editingId.value = null
  showModal.value = true
  loadInHouseGuests()
}

/**
 * Fills the form with an existing order's data and opens the modal in edit mode.
 * Only unsettled orders may be edited — a settled order is view-only, so the
 * edit path is only reached for unpaid orders.
 */
function openEdit(order) {
  modalError.value = ''
  editing.value = true
  editingId.value = order.laundry_order_id
  guestType.value = order.room_number || order.reservation_id ? 'in_house' : 'customer'
  selectedGuestId.value = ''
  form.guest_name = order.guest_name || ''
  form.service = order.service
  form.room_number = order.room_number || ''
  form.reservation_id = order.reservation_id || undefined
  form.items = (order.items || []).map((item) => ({
    cloth_type_id: item.cloth_type_id || '',
    item_name: item.item_name,
    quantity: item.quantity,
    unit_price: Number(item.unit_price),
  }))
  form.status = order.status
  form.payment_status = order.payment_status || 'unpaid'
  form.order_date = order.order_date || ''
  form.attendant_id = order.attendant_id || ''
  form.notes = order.notes || ''
  showModal.value = true
  loadInHouseGuests()
}

/** Hides the create/edit modal. */
function closeModal() {
  showModal.value = false
}

/**
 * Builds the API payload from the form, dropping blank line items and empty optional fields.
 * @returns {object} The payload for create/update requests.
 */
function buildPayload() {
  return {
    guest_name: form.guest_name,
    service: form.service,
    room_number: form.room_number || undefined,
    reservation_id: form.reservation_id || undefined,
    items: form.items
      .filter((item) => item.item_name)
      .map((item) => ({
        cloth_type_id: item.cloth_type_id || undefined,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    status: form.status,
    payment_status: form.payment_status,
    order_date: form.order_date,
    attendant_id: form.attendant_id || undefined,
    notes: form.notes,
  }
}

/** Creates or updates the order via the API and refreshes the list on success. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    const payload = buildPayload()
    if (editing.value) {
      await laundryApi.update(editingId.value, payload)
      success.value = t('laundry.updated')
    } else {
      await laundryApi.store(payload)
      success.value = t('laundry.created')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/**
 * Moves an order along the internal wash workflow (ready / delivered). These
 * operational steps live in the order drawer, not the table — the STATUS column
 * the guest reads is settlement-driven (PENDING / COMPLETE).
 */
async function setStatus(order, status) {
  error.value = ''
  try {
    await laundryApi.update(order.laundry_order_id, { status })
    success.value = t('laundry.statusChanged', { status: t(`laundry.status${status.charAt(0).toUpperCase()}${status.slice(1)}`) })
    drawerOrder.value = null
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

// Settlement modal state.
const showSettleModal = ref(false)
const settleOrder = ref(null)
const settleMode = ref('paid')
const settleRoomNumber = ref('')
const settleError = ref('')
const settling = ref(false)

/** True when the order belongs to an in-house guest (has a room or stay). */
function isInHouse(order) {
  return Boolean(order?.reservation_id || order?.room_number)
}

/**
 * Opens the settlement modal. Room (in-house) orders settle by POSTING to the
 * guest's folio, so posting is the default; walk-in customer orders settle by
 * direct payment. A customer order has no room, so posting is unavailable.
 */
function openSettle(order) {
  settleOrder.value = order
  settleMode.value = isInHouse(order) ? 'billed_to_room' : 'paid'
  settleRoomNumber.value = order.room_number || ''
  settleError.value = ''
  showSettleModal.value = true
}

/** Closes the settlement modal. */
function closeSettle() {
  showSettleModal.value = false
  settleOrder.value = null
}

/** Settles the order as paid or posts it to the guest's room folio. */
async function confirmSettle() {
  if (!settleOrder.value || settling.value) return
  settleError.value = ''
  settling.value = true
  try {
    const payload = { payment_status: settleMode.value }
    if (settleMode.value === 'billed_to_room') {
      if (settleRoomNumber.value) payload.room_number = settleRoomNumber.value
    }
    await laundryApi.update(settleOrder.value.laundry_order_id, payload)
    success.value = t('laundry.settled')
    closeSettle()
    drawerOrder.value = null
    await load()
  } catch (err) {
    settleError.value = flattenError(err)
  } finally {
    settling.value = false
  }
}

// Order-detail drawer (cashier-style) state.
const voidReason = ref('')
const voidConfirming = ref(false)
const voiding = ref(false)

/** Opens the order-detail drawer (view / settle / edit / void live here). */
function openDrawer(order) {
  drawerOrder.value = order
  voidConfirming.value = false
  voidReason.value = ''
}

/** Closes the order-detail drawer. */
function closeDrawer() {
  drawerOrder.value = null
  voidConfirming.value = false
  voidReason.value = ''
}

/**
 * True when the order may still be edited or voided. A settled order (paid or
 * posted) is view-only — no edit, no void, matching the "once settled, just
 * VIEW" rule.
 */
function isEditable(order) {
  return !['paid', 'billed_to_room'].includes(order.payment_status)
}

/** Asks for confirmation before voiding an order. */
function promptVoid() {
  voidReason.value = ''
  voidConfirming.value = true
}

/**
 * Voids an unsettled order by moving it to the terminal cancelled state (the
 * backend's existing transition), then reloads the list and closes the drawer.
 */
async function confirmVoid() {
  if (!drawerOrder.value || voiding.value) return
  error.value = ''
  voiding.value = true
  try {
    await laundryApi.update(drawerOrder.value.laundry_order_id, { status: 'cancelled' })
    success.value = t('laundry.statusChanged', { status: t('laundry.statusCancelled') })
    closeDrawer()
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    voiding.value = false
  }
}

/**
 * Deletes every selected order; the typed-confirmation modal guards the action.
 */
async function bulkDelete() {
  error.value = ''
  deleting.value = true
  try {
    const { tried, failed } = await bulk.removeMany((id) => laundryApi.destroy(id))
    if (failed > 0) {
      error.value = t('laundry.bulkDeletePartial', { tried, failed })
    } else if (tried > 0) {
      success.value = t('laundry.bulkDeleteSuccess', { count: tried })
    }
    bulk.clear()
    showBulkDelete.value = false
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    deleting.value = false
  }
}

/**
 * Flattens a validation/API error into a single readable message string.
 * @param {Error} err - The thrown request error.
 * @returns {string} A space-joined error message or the generic failure text.
 */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
}

onMounted(async () => {
  // Default the list to the front-desk business date so the "current" orders
  // show first; the universal calendar steps back to earlier days.
  try {
    const bd = (await import('@/stores/businessDate')).useBusinessDateStore()
    await bd.ensureLoaded()
    filters.date = bd.current || ''
  } catch {
    // ignore
  }
  load()
  loadUsers()
  loadClothTypes()
  loadInHouseGuests()
})
</script>

<style scoped>
.dashboard-page {
  padding: 32px 20px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.page-head h1 {
  font-size: 28px;
  font-weight: 800;
}

.head-actions {
  display: flex;
  gap: 10px;
}

.filter-bar {
  margin-bottom: 16px;
  padding: 16px 20px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.filter-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 1px;
}

.muted {
  color: #757575;
  font-size: 12px;
  margin-top: 2px;
}

.capitalize {
  text-transform: capitalize;
}

.bulk-col {
  width: 40px;
}

.bulk-col input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.price {
  font-weight: 700;
  color: #005eb8;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: #fff;
  border-radius: 8px;
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.modal-head h2 {
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-head h2 i {
  color: #005eb8;
}

.modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #757575;
  cursor: pointer;
  padding: 4px;
}

.modal-close:hover {
  color: #333;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.form-full {
  grid-column: 1 / -1;
}

.items-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 18px 0 12px;
}

.items-head h3 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #005eb8;
}

.item-row {
  border: 1px solid #f1f1f1;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
}

.item-grid {
  display: grid;
  grid-template-columns: 3fr 1fr 1fr auto;
  gap: 10px;
  align-items: end;
}

.consumable-grid {
  grid-template-columns: 3fr 1fr auto;
}

.consumables-summary {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.4;
}

.consumables-summary i {
  margin-right: 4px;
  color: #005eb8;
}

.item-remove {
  padding-bottom: 1px;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.settle-order {
  margin: 8px 0 4px;
  font-size: 15px;
}

.settle-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  margin-top: 10px;
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  cursor: pointer;
  background: #fafafa;
}

.settle-option.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settle-option span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-weight: 600;
}

.settle-option small {
  font-weight: 400;
}

.settle-room {
  margin-top: 14px;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.btn-back {
  padding: 10px 12px;
}

/* Two major modes on the new-order form: in-house guest vs customer. */
.guest-type {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}

.guest-type-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  cursor: pointer;
  background: #fafafa;
  font-weight: 600;
}

.guest-type-option input {
  display: none;
}

.guest-type-option.active {
  border-color: #005eb8;
  background: #eaf3ff;
  color: #005eb8;
}

/* Manual vs automated (hotel linen) source switch above the table. */
.source-switch {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 14px;
  background: #f0f0f0;
  border-radius: 10px;
}

.source-btn {
  border: none;
  background: transparent;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  color: #555;
}

.source-btn.active {
  background: #fff;
  color: #005eb8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

/* Cashier-style action bar above the table. */
.table-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.table-actions .spacer {
  flex: 1;
}

.table-actions-hint {
  margin: 0;
  font-size: 12px;
  color: #757575;
}

/* Order-detail drawer (wider panel on the right of the overlay). */
.drawer {
  max-width: 620px;
}

.drawer-items {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 13px;
}

.drawer-items th,
.drawer-items td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid #eee;
}

.drawer-total {
  text-align: right;
  font-size: 15px;
  margin: 10px 0;
}

.drawer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.drawer-actions .spacer {
  flex: 1;
}

.drawer-void {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.drawer-void label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
}

.drawer-void .input {
  width: 100%;
}

.settled-hint {
  color: #7a6a00;
}

/* Tablets: 768px is the classic iPad portrait width, so the phone
   treatment below starts at 767px. Without this band a tablet drops
   straight from the full form to a single column. */
@media (min-width: 768px) and (max-width: 1024px) {
  .filter-grid,
  .form-grid {
    grid-template-columns: 1fr 1fr;
  }

  .page-head {
    flex-direction: row;
  }
}

@media (max-width: 767px) {
  .dashboard-page {
    padding: 20px 16px;
  }

  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-grid {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-full {
    grid-column: auto;
  }
}
</style>
