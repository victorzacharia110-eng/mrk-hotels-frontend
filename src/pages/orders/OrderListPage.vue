<!--
  OrderListPage.vue
  F&B order management for restaurant and bar. Features: department/status/
  order-type/payment/date filters, create-order modal with department-aware
  order types, waiter and in-house guest selectors plus dynamic line items,
  per-order status lifecycle actions, collect-payment and bill-to-room, and a
  detail modal with per-item ready/served actions. Payment collection is gated
  by permission 60; other writes by canOperate. Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: refresh plus permission-gated "new order" button -->
    <div class="page-head">
      <div>
        <h1>{{ $t('orders.title') }}</h1>
        <p class="muted">{{ $t('orders.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('orders.refresh') }}
        </button>
        <button v-if="canOperate" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('orders.newOrder') }}
        </button>
        <TableExportButton
          filename="orders"
          :load-all="loadAllOrders"
          :title="$t('orders.title')"
          :columns="[
            { key: 'order_number', label: $t('orders.tableOrder') },
            { key: 'department', label: $t('orders.tableLocation') },
            { key: 'guest_name', label: $t('orders.tableGuestTable') },
            { key: 'table_number', label: 'Table' },
            { key: 'room_number', label: 'Room' },
            { key: 'waiter_name', label: $t('orders.waiter') },
            { key: 'order_type', label: $t('orders.orderType') },
            { key: 'total_amount', label: $t('orders.total') },
            { key: 'status', label: $t('common.status') },
            { key: 'payment_status', label: $t('orders.payment') },
          ]"
        />
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filter bar: department, status, order type, payment status and date -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('common.department') }}</label>
          <SearchableSelect
            v-model="filters.department"
            :options="departmentOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('common.status') }}</label>
          <SearchableSelect
            v-model="filters.status"
            :options="statusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('orders.orderType') }}</label>
          <SearchableSelect
            v-model="filters.order_type"
            :options="orderTypeOptions"
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
          <label>{{ $t('common.date') }}</label>
          <input v-model="filters.date" type="date" class="input" @change="load" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters">
            <i class="fas fa-filter-circle-xmark"></i> {{ $t('common.clear') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading indicator shown while the list request is in flight -->
    <div v-if="loading" class="alert alert-info">{{ $t('orders.loading') }}</div>

    <!-- Orders table: number, department, guest/table, waiter, totals and status/payment badges -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('orders.tableOrder') }}</th>
            <th scope="col">{{ $t('orders.tableLocation') }}</th>
            <th scope="col">{{ $t('orders.tableGuestTable') }}</th>
            <th scope="col">{{ $t('orders.waiter') }}</th>
            <th scope="col">{{ $t('orders.orderType') }}</th>
            <th scope="col">{{ $t('orders.items') }}</th>
            <th scope="col">{{ $t('orders.total') }}</th>
            <th scope="col">{{ $t('common.status') }}</th>
            <th scope="col">{{ $t('orders.payment') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.order_id">
            <td>
              <strong>{{ order.order_number }}</strong>
              <div class="muted">{{ order.order_id }}</div>
            </td>
            <td class="capitalize">{{ order.department }}</td>
            <td>
              <div>{{ order.guest_name || '-' }}</div>
              <div class="muted">
                {{
                  order.table_number
                    ? $t('orders.tableN', { number: order.table_number })
                    : order.room_number
                      ? $t('orders.roomN', { number: order.room_number })
                      : ''
                }}
              </div>
            </td>
            <td>{{ order.waiter_name || '-' }}</td>
            <td class="capitalize">{{ orderTypeLabel(order.order_type) }}</td>
            <td>
              <button class="link-btn" @click="openDetail(order)">
                {{ (order.items || []).length }} {{ $t('orders.itemsSuffix') }}
              </button>
            </td>
            <td>
              <span class="price">TZS {{ Number(order.total_amount).toLocaleString() }}</span>
            </td>
            <td>
              <span class="badge" :class="statusBadge(order.status)">{{
                statusLabel(order.status)
              }}</span>
            </td>
            <td>
              <span class="badge" :class="paymentBadge(order.payment_status)">{{
                String(order.payment_status || 'unpaid').replace('_', ' ')
              }}</span>
            </td>
            <td>
              <div class="actions">
                <!-- Status-dependent action buttons drive the order through its lifecycle -->
                <template v-if="order.status === 'pending'">
                  <button class="btn btn-sm btn-danger" @click="setStatus(order, 'in_progress')">
                    {{ $t('orders.actionStart') }}
                  </button>
                </template>
                <template v-if="order.status === 'in_progress'">
                  <button class="btn btn-sm btn-warning" @click="setStatus(order, 'processing')">
                    {{ $t('orders.actionProcess') }}
                  </button>
                </template>
                <template v-if="order.status === 'processing'">
                  <button class="btn btn-sm btn-success" @click="setStatus(order, 'ready')">
                    {{ $t('orders.actionReady') }}
                  </button>
                </template>
                <template v-if="order.status === 'preparing'">
                  <button class="btn btn-sm btn-secondary" @click="setStatus(order, 'ready')">
                    {{ $t('orders.actionReady') }}
                  </button>
                </template>
                <template v-if="order.status === 'ready'">
                  <button class="btn btn-sm btn-secondary" @click="setStatus(order, 'served')">
                    {{ $t('orders.actionServed') }}
                  </button>
                </template>
                <button
                  v-if="order.status === 'served'"
                  class="btn btn-sm btn-success"
                  @click="setStatus(order, 'completed')"
                >
                  {{ $t('orders.actionComplete') }}
                </button>
                <button
                  v-if="
                    ['pending', 'in_progress', 'processing', 'preparing', 'ready'].includes(
                      order.status,
                    )
                  "
                  class="btn btn-sm btn-danger"
                  @click="setStatus(order, 'cancelled')"
                >
                  {{ $t('common.cancel') }}
                </button>
                <button
                  v-if="order.payment_status === 'unpaid' && canCollect"
                  class="btn btn-sm btn-success"
                  @click="openPay(order)"
                >
                  <i class="fas fa-money-bill-wave"></i> {{ $t('orders.actionCollect') }}
                </button>
                <button
                  v-if="order.payment_status === 'unpaid' && order.room_number && canCollect"
                  class="btn btn-sm btn-secondary"
                  @click="billToRoom(order)"
                >
                  {{ $t('orders.actionBillToRoom') }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!orders.length && !loading">
            <td colspan="10" class="muted">{{ $t('orders.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Server-side pagination controls -->
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

    <!-- New order modal (department, guest, waiter, line items) -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h2><i class="fas fa-utensils"></i> {{ $t('orders.newOrder') }}</h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('common.department') }} *</label>
              <SearchableSelect
                v-model="form.department"
                :options="departmentOptions"
                required
                @change="onDepartmentChange"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('orders.orderType') }} *</label>
              <SearchableSelect
                v-model="form.order_type"
                :options="formOrderTypeOptions"
                required
              />
            </div>
            <div class="form-group">
              <label>{{ $t('orders.waiterName') }} *</label>
              <SearchableSelect
                v-model="form.waiter_name"
                :options="waiterOptions"
                required
                force-search
              />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('orders.inHouseGuest') }}</label>
              <SearchableSelect
                v-model="form.guest_id"
                :options="inHouseGuestOptions"
                :empty-label="$t('orders.walkIn')"
                @change="fillGuest"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('orders.tableNumber') }}</label>
              <SearchableSelect
                v-model="form.table_number"
                :options="tableOptions"
                :empty-label="$t('orders.noTable')"
                force-search
              />
            </div>
            <div class="form-group">
              <label>{{ $t('orders.roomNumber') }}</label>
              <input v-model="form.room_number" type="text" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('orders.guestOptional') }}</label>
              <input v-model="form.guest_name" type="text" class="input" />
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('common.notes') }}</label>
            <textarea v-model="form.notes" rows="2" class="textarea"></textarea>
          </div>

          <div class="items-head">
            <h3>{{ $t('orders.items') }}</h3>
            <button type="button" class="btn btn-sm btn-secondary" @click="addItem">
              <i class="fas fa-plus"></i> {{ $t('orders.addItem') }}
            </button>
          </div>

          <!-- Category filter: follows the selected department (restaurant vs bar menus differ). -->
          <div class="form-group" v-if="categoryOptions.length > 1">
            <label>{{ $t('orders.category') }}</label>
            <select v-model="formCategory" class="input">
              <option value="">{{ $t('orders.allCategories') }} ({{ menuItemOptions.length }})</option>
              <option v-for="cat in categoryOptions" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>

          <div v-for="(item, idx) in form.items" :key="idx" class="item-row">
            <div class="item-grid">
              <div class="form-group">
                <label>{{ $t('orders.menuItem') }}</label>
                <SearchableSelect
                  v-model="item.menu_item_id"
                  :options="menuItemOptions"
                  :empty-label="$t('orders.selectItem')"
                  required
                  @change="onMenuItemPicked(idx)"
                />
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
              <div class="form-group item-remove">
                <button type="button" class="btn btn-sm btn-danger" @click="removeItem(idx)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <!-- Chosen accompaniment chip (e.g. Beef Mshikaki → Wali) -->
            <div v-if="item.accompaniment" class="accomp-chip">
              <i class="fas fa-bowl-rice"></i>
              <span>
                {{ $t('orders.servedWith') }}: <strong>{{ accompanimentLabel(item.accompaniment) }}</strong>
              </span>
              <button
                type="button"
                class="link-btn"
                @click="accompIdx = idx; showAccomp = true"
              >
                {{ $t('orders.accompChange') }}
              </button>
            </div>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('orders.creating') : $t('orders.createOrder') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- "Served with" modal: pick a side dish for grill mains (e.g. Beef Mshikaki → Wali/Ugali/Chips) -->
    <div v-if="showAccomp" class="modal-overlay" @click.self="chooseAccompaniment(form.items[accompIdx]?.accompaniment || '')">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-bowl-rice"></i> {{ $t('orders.servedWithTitle') }}</h2>
          <button
            class="modal-close"
            @click="chooseAccompaniment(form.items[accompIdx]?.accompaniment || '')"
          >
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <p class="muted">
          {{ $t('orders.servedWithHint', { item: accompItemName }) }}
        </p>
        <div class="accomp-grid">
          <button
            v-for="option in accompanimentOptions"
            :key="option.value"
            type="button"
            class="accomp-option"
            :class="{ active: form.items[accompIdx]?.accompaniment === option.value }"
            @click="chooseAccompaniment(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Collect payment modal for an unpaid order -->
    <div v-if="showPay" class="modal-overlay" @click.self="showPay = false">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-money-bill-wave"></i> {{ $t('orders.collectPayment') }}</h2>
          <button class="modal-close" @click="showPay = false"><i class="fas fa-xmark"></i></button>
        </div>
        <p class="muted">
          {{ payOrder.order_number }} ·
          <span class="price">TZS {{ Number(payOrder.total_amount).toLocaleString() }}</span>
        </p>
        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <form @submit.prevent="pay">
          <div class="form-group">
            <label>{{ $t('orders.method') }}</label>
            <SearchableSelect v-model="payMethod" :options="paymentMethodOptions" />
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="showPay = false">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-success" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('orders.processing') : $t('orders.confirmPayment') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Order detail modal with per-item status actions -->
    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = false">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h2><i class="fas fa-utensils"></i> {{ detail?.order_number }}</h2>
          <button class="modal-close" @click="showDetail = false">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <p class="muted">
          {{ detail?.department }} · {{ detail?.guest_name || '-' }} ·
          {{ $t('orders.tableN', { number: detail?.table_number || '-' }) }} /
          {{ $t('orders.roomN', { number: detail?.room_number || '-' }) }}
          <template v-if="detail?.prepared_user?.full_name">
            · {{ $t('orders.preparedBy') }} {{ detail.prepared_user.full_name }}
          </template>
        </p>
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">{{ $t('orders.item') }}</th>
                <th scope="col">{{ $t('orders.qty') }}</th>
                <th scope="col">{{ $t('orders.unitPrice') }}</th>
                <th scope="col">{{ $t('orders.subtotal') }}</th>
                <th scope="col">{{ $t('common.status') }}</th>
                <th scope="col">{{ $t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in detail?.items || []" :key="item.order_item_id">
                <td>
                  <strong>{{ item.item_name }}</strong>
                  <span v-if="item.accompaniment" class="accomp-chip detail-accomp">
                    <i class="fas fa-bowl-rice" aria-hidden="true"></i>
                    {{ $t('orders.servedWith') }}: <strong>{{ accompanimentLabel(item.accompaniment) }}</strong>
                  </span>
                </td>
                <td>{{ item.quantity }}</td>
                <td>TZS {{ Number(item.unit_price).toLocaleString() }}</td>
                <td>
                  <span class="price">TZS {{ Number(item.subtotal).toLocaleString() }}</span>
                </td>
                <td>
                  <span class="badge" :class="itemStatusBadge(item.status)">{{
                    itemStatusLabel(item.status)
                  }}</span>
                </td>
                <td>
                  <div class="actions" v-if="canOperate">
                    <template v-if="isOrderOpen && canOperate">
                      <button
                        v-if="item.status === 'pending'"
                        class="btn btn-sm btn-warning"
                        @click="markItem(item, 'ready')"
                      >
                        {{ $t('orders.itemReady') }}
                      </button>
                      <button
                        v-if="item.status === 'ready'"
                        class="btn btn-sm btn-primary"
                        @click="markItem(item, 'served')"
                      >
                        {{ $t('orders.itemServed') }}
                      </button>
                    </template>
                    <span v-else class="muted">—</span>
                  </div>
                </td>
              </tr>
              <tr v-if="detail">
                <td colspan="4" class="text-right">
                  <strong>{{ $t('orders.total') }}</strong>
                </td>
                <td>
                  <span class="price">TZS {{ Number(detail.total_amount).toLocaleString() }}</span>
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { orderApi, menuItemApi, tableApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import { PAYMENT_METHODS } from '@/utils/payments'
import { collectAllRows } from '@/utils/export'

const { t } = useI18n()
const authStore = useAuthStore()

// Permission gates: whether the user may operate and/or collect payments.
const canCollect = computed(() => authStore.can(60) && authStore.canOperate)
const canOperate = computed(() => authStore.canOperate)

// List state: orders, menu items, pagination, filters, and load flags/messages.
const orders = ref([])
const menuItems = ref([])
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({
  department: '',
  status: '',
  order_type: '',
  payment_status: '',
  date: '',
})
const loading = ref(false)
const error = ref('')
const success = ref('')

// Modal state: create form, payment modal, detail modal, and form option lists.
const showModal = ref(false)
const saving = ref(false)
const modalError = ref('')
const showPay = ref(false)
const payOrder = ref(null)
const payMethod = ref('cash')
const showDetail = ref(false)
const detail = ref(null)
const inHouseGuests = ref([])
const waiters = ref([])
// Physical restaurant/bar tables for the searchable table picker.
const tables = ref([])
const form = reactive({
  department: 'restaurant',
  order_type: 'dine_in',
  guest_id: '',
  waiter_name: '',
  table_number: '',
  room_number: '',
  guest_name: '',
  notes: '',
  items: [],
})

// Static dropdown options for filters and the create form.
const departmentOptions = [
  { value: 'restaurant', label: t('common.departments.restaurant') },
  { value: 'bar', label: t('common.departments.bar') },
]

const statusOptions = [
  { value: 'pending', label: t('orders.statusPending') },
  { value: 'in_progress', label: t('orders.statusInProgress') },
  { value: 'processing', label: t('orders.statusProcessing') },
  { value: 'preparing', label: t('orders.statusPreparing') },
  { value: 'ready', label: t('orders.statusReady') },
  { value: 'served', label: t('orders.statusServed') },
  { value: 'completed', label: t('orders.statusCompleted') },
  { value: 'cancelled', label: t('orders.statusCancelled') },
]

const orderTypeOptions = [
  { value: 'dine_in', label: t('orders.dineIn') },
  { value: 'at_bar', label: t('orders.atBar') },
  { value: 'hotel_menu', label: t('orders.hotelMenu') },
]

// Order types allowed for the selected department (bar vs restaurant).
const formOrderTypeOptions = computed(() =>
  form.department === 'bar'
    ? orderTypeOptions.filter((option) => option.value !== 'dine_in')
    : orderTypeOptions.filter((option) => option.value !== 'at_bar'),
)

/** Translates an order type code into its display label. */
function orderTypeLabel(value) {
  if (value === 'at_bar') return t('orders.atBar')
  if (value === 'hotel_menu') return t('orders.hotelMenu')
  return t('orders.dineIn')
}

const paymentStatusOptions = [
  { value: 'unpaid', label: t('orders.paymentUnpaid') },
  { value: 'paid', label: t('orders.paymentPaid') },
  { value: 'billed_to_room', label: t('orders.paymentBilledToRoom') },
]

const paymentMethodOptions = PAYMENT_METHODS.map((method) => ({
  value: method,
  label: t(`paymentFields.methods.${method}`),
}))

/** Menu items as selectable options (id → "name · price"), narrowed by the chosen category. */
const formCategory = ref('')

/** Distinct categories present in the current department's menu (ordered by sort_order). */
const categoryOptions = computed(() => {
  const seen = new Map()
  menuItems.value.forEach((mi) => {
    if (!mi.category || seen.has(mi.category)) return
    seen.set(mi.category, mi.category_order || 0)
  })
  return [...seen.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
})

const menuItemOptions = computed(() =>
  menuItems.value
    .filter((mi) => !formCategory.value || mi.category === formCategory.value)
    .map((mi) => ({
      value: mi.menu_item_id,
      label: `${mi.item_name} · TZS ${Number(mi.price).toLocaleString()}`,
    })),
)

/** Waiters available for the selected department (bartenders for the bar). */
const waiterOptions = computed(() => {
  const dept = form.department
  return waiters.value
    .filter((waiter) =>
      dept === 'bar'
        ? waiter.role === 'bartender' || waiter.department === 'bar'
        : waiter.role === 'waiter' || waiter.department === 'restaurant',
    )
    .map((waiter) => ({ value: waiter.full_name, label: waiter.full_name }))
})

/** In-house guests as selectable options (for billing to a room). */
const inHouseGuestOptions = computed(() =>
  inHouseGuests.value.map((guest) => ({
    value: guest.guest_id,
    label: `${guest.guest_name} · ${t('orders.roomN', { number: guest.room_number || '—' })}`,
  })),
)

/** Active tables as searchable options (name + section/capacity for context). */
const tableOptions = computed(() =>
  tables.value.map((table) => ({
    value: table.table_name,
    label: table.section
      ? `${table.table_name} · ${table.section}`
      : table.table_name,
  })),
)

/** Returns a fresh blank order line item. */
function emptyItem() {
  return { menu_item_id: '', quantity: 1, accompaniment: '' }
}

// ---------------------------------------------------------------------------
// "Served with" accompaniments: grill-style mains (mshikaki, nyama choma,
// kuku, samaki…) are usually served with a side (wali, ugali, chips…).
// Picking such an item opens a modal so the waiter records the side dish.
// ---------------------------------------------------------------------------

/** Accompaniment choices shown in the "served with" modal. */
const accompanimentOptions = computed(() => [
  { value: 'wali', label: t('orders.accompWali') },
  { value: 'ugali', label: t('orders.accompUgali') },
  { value: 'chips', label: t('orders.accompChips') },
  { value: 'chapati', label: t('orders.accompChapati') },
  { value: 'ndizi', label: t('orders.accompNdizi') },
  { value: 'maharage', label: t('orders.accompMaharage') },
  { value: '', label: t('orders.accompNone') },
])

/** Name keywords that mark a menu item as a grill-style main needing a side. */
const GRILL_KEYWORDS = ['mshikaki', 'mishkaki', 'choma', 'kuku', 'nyama', 'samaki', 'maini', 'grill']

// Accompaniment modal state: which line item is being asked about.
const showAccomp = ref(false)
const accompIdx = ref(null)

/** True when the given menu item is a grill-style main (needs a side dish). */
function isGrillItem(menuItemId) {
  const item = menuItems.value.find((mi) => mi.menu_item_id === menuItemId)
  if (!item) return false
  const name = (item.item_name || '').toLowerCase()
  return GRILL_KEYWORDS.some((keyword) => name.includes(keyword))
}

/** Looks up a line item's menu record for display in the accompaniment modal. */
const accompItemName = computed(() => {
  if (accompIdx.value === null) return ''
  const item = form.items[accompIdx.value]
  return menuItems.value.find((mi) => mi.menu_item_id === item?.menu_item_id)?.item_name || ''
})

/** Translates a stored accompaniment code back into its display label. */
function accompanimentLabel(value) {
  return accompanimentOptions.value.find((option) => option.value === value)?.label || value
}

/**
 * Called when a menu item is picked for a line item: if it is a grill-style
 * main in the restaurant, open the "served with" modal for that row.
 */
function onMenuItemPicked(idx) {
  const item = form.items[idx]
  if (!item?.menu_item_id) {
    if (item) item.accompaniment = ''
    return
  }
  if (form.department === 'restaurant' && isGrillItem(item.menu_item_id)) {
    accompIdx.value = idx
    showAccomp.value = true
  } else {
    item.accompaniment = ''
  }
}

/** Records the chosen accompaniment (or none) on the pending line item. */
function chooseAccompaniment(value) {
  if (accompIdx.value !== null && form.items[accompIdx.value]) {
    form.items[accompIdx.value].accompaniment = value
  }
  showAccomp.value = false
  accompIdx.value = null
}

/** Translates an order status code into its display label. */
function statusLabel(status) {
  const map = {
    pending: t('orders.statusPending'),
    in_progress: t('orders.statusInProgress'),
    processing: t('orders.statusProcessing'),
    preparing: t('orders.statusPreparing'),
    ready: t('orders.statusReady'),
    served: t('orders.statusServed'),
    completed: t('orders.statusCompleted'),
    cancelled: t('orders.statusCancelled'),
  }
  return map[status] || status
}

/** Maps an order status to its badge CSS class for the table. */
function statusBadge(status) {
  const map = {
    pending: 'badge-yellow',
    in_progress: 'badge-red',
    processing: 'badge-yellow',
    preparing: 'badge-blue',
    ready: 'badge-blue',
    served: 'badge-green',
    completed: 'badge-green',
    cancelled: 'badge-red',
  }
  return map[status] || 'badge-gray'
}

/** Maps a payment status to its badge CSS class for the table. */
function paymentBadge(status) {
  const map = { unpaid: 'badge-red', paid: 'badge-green', billed_to_room: 'badge-blue' }
  return map[status] || 'badge-gray'
}

/** Line items can be served only while the order is still open. */
const isOrderOpen = computed(
  () => ['completed', 'cancelled'].includes(detail.value?.status) === false,
)

/** Translates a line-item status code into its display label. */
function itemStatusLabel(status) {
  const map = {
    pending: t('orders.itemStatusPending'),
    ready: t('orders.itemStatusReady'),
    served: t('orders.itemStatusServed'),
  }
  return map[status] || status
}

/** Maps a line-item status to its badge CSS class. */
function itemStatusBadge(status) {
  const map = { pending: 'badge-yellow', ready: 'badge-blue', served: 'badge-green' }
  return map[status] || 'badge-gray'
}

/** Advances a single line item (ready/served) in the open order.
 * @param {object} item - the line item being updated
 * @param {string} status - new status for the line item
 */
async function markItem(item, status) {
  if (!detail.value) return
  error.value = ''
  try {
    const res = await orderApi.markItemStatus(detail.value.order_id, item.order_item_id, status)
    success.value = res.data.message || t('orders.itemUpdated', { status })
    const updated = res.data.item
    if (updated) {
      item.status = updated.status
      item.ready_at = updated.ready_at
    }
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Fetches the paged order list using the current filters. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await orderApi.index({
      department: filters.department,
      status: filters.status,
      order_type: filters.order_type,
      payment_status: filters.payment_status,
      date: filters.date,
      page: page.value,
      per_page: 15,
    })
    orders.value = (res.data.data || []).map((order) => ({
      ...order,
      // Guard legacy/partial rows so the table can never white-screen on a null.
      items: Array.isArray(order.items) ? order.items : [],
      payment_status: order.payment_status || 'unpaid',
      items_count: order.items_count ?? (Array.isArray(order.items) ? order.items.length : 0),
    }))
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('orders.loadError')
  } finally {
    loading.value = false
  }
}

const loadAllOrders = () =>
  collectAllRows((page, perPage) =>
    orderApi.index({
      department: filters.department,
      status: filters.status,
      order_type: filters.order_type,
      payment_status: filters.payment_status,
      date: filters.date,
      page,
      per_page: perPage,
    }),
  )

/** Loads the available menu items for the create-order form. */
async function loadMenu() {
  try {
    menuItems.value =
      (await menuItemApi.index({ is_available: true, department: form.department, per_page: 100 }))
        .data.data || []
  } catch {
    // ignore
  }
}

/** Moves to the given page and reloads. */
function goPage(page) {
  page.value = page
  load()
}

/** Resets all filters and reloads from the first page. */
function clearFilters() {
  page.value = 1
  filters.department = ''
  filters.status = ''
  filters.order_type = ''
  filters.payment_status = ''
  filters.date = ''
  load()
}

/** Resets the form when the department changes (order type, waiter, items). */
function onDepartmentChange() {
  form.items = []
  form.waiter_name = ''
  formCategory.value = ''
  form.order_type = form.department === 'bar' ? 'at_bar' : 'dine_in'
  loadMenu()
}

/** In-house guests (to bill to a room) and waiters are fetched from the API. */
async function loadFormOptions() {
  try {
    const res = await orderApi.formOptions()
    inHouseGuests.value = res.data.in_house_guests || []
    waiters.value = res.data.waiters || []
  } catch {
    // The form still works with the manual fields if this fails.
  }
}

/** Loads the active restaurant/bar tables for the searchable table picker. */
async function loadTables() {
  try {
    const res = await tableApi.index({ is_active: 1, per_page: 100 })
    const data = res.data
    tables.value = Array.isArray(data) ? data : data?.data || []
  } catch {
    tables.value = []
  }
}

/** Picking an in-house guest fills the room and guest name automatically. */
function fillGuest() {
  const guest = inHouseGuests.value.find((guest) => guest.guest_id === form.guest_id)
  if (!guest) return
  form.guest_name = guest.guest_name || ''
  form.room_number = guest.room_number || ''
}

/** Opens the create-order modal with a fresh, pre-filled form. */
function openCreate() {
  modalError.value = ''
  form.department = 'restaurant'
  form.order_type = 'dine_in'
  form.guest_id = ''
  form.waiter_name = ''
  form.table_number = ''
  form.room_number = ''
  form.guest_name = ''
  form.notes = ''
  form.items = [emptyItem()]

  // Automate the desk work: remember which waiter is on and which counter.
  const current = authStore.user
  if (
    current?.full_name &&
    waiters.value.some((waiter) => waiter.full_name === current.full_name)
  ) {
    form.waiter_name = current.full_name
  }
  if (current?.department === 'bar') form.department = 'bar'
  form.order_type = form.department === 'bar' ? 'at_bar' : 'dine_in'

  loadFormOptions()
  loadMenu()
  showModal.value = true
}

/** Adds an empty line item row to the order form. */
function addItem() {
  form.items.push(emptyItem())
}

/** Removes the line item at the given index. */
function removeItem(idx) {
  form.items.splice(idx, 1)
}

/** Closes the create and payment modals. */
function closeModal() {
  showModal.value = false
  showPay.value = false
}

/** Creates the order, sending only the filled-in line items. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    const res = await orderApi.store({
      department: form.department,
      order_type: form.order_type,
      waiter_name: form.waiter_name,
      table_number: form.table_number,
      room_number: form.room_number,
      guest_name: form.guest_name,
      notes: form.notes,
      items: form.items
        .filter((item) => item.menu_item_id)
        .map((item) => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          accompaniment: item.accompaniment || null,
        })),
    })
    success.value = res.data.message || t('orders.created')
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Shows the order detail modal for the selected order. */
function openDetail(order) {
  detail.value = order
  showDetail.value = true
}

/** Advances an order to the given status (with confirm for cancellation). */
async function setStatus(order, status) {
  if (
    status === 'cancelled' &&
    !window.confirm(t('orders.deleteMessage', { orderNumber: order.order_number }))
  )
    return
  error.value = ''
  try {
    const res = await orderApi.update(order.order_id, { status })
    success.value = res.data.message || t('orders.statusChanged', { status })
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Opens the collect-payment modal for the given order. */
function openPay(order) {
  modalError.value = ''
  payOrder.value = order
  payMethod.value = 'cash'
  showPay.value = true
}

/** Records the payment for the selected order. */
async function pay() {
  modalError.value = ''
  saving.value = true
  try {
    const res = await orderApi.pay(payOrder.value.order_id, { method: payMethod.value })
    success.value = res.data.message || t('orders.paymentCollected')
    showPay.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Bills an unpaid room order to the guest's room account after confirmation. */
async function billToRoom(order) {
  if (
    !window.confirm(
      t('orders.billToRoomConfirm', { amount: order.order_number, number: order.room_number }),
    )
  )
    return
  error.value = ''
  try {
    const res = await orderApi.billToRoom(order.order_id, {})
    success.value = res.data.message || t('orders.billedToRoom')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Flattens Laravel-style validation errors into a single readable message. */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
}

onMounted(() => {
  load()
  loadMenu()
  loadFormOptions()
  loadTables()
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

.price {
  font-weight: 700;
  color: #005eb8;
}

.text-right {
  text-align: right;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.link-btn {
  color: #005eb8;
  font-weight: 600;
  background: none;
  border: none;
  padding: 0;
  font-size: 13px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
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
  grid-template-columns: 3fr 1fr auto;
  gap: 10px;
  align-items: end;
}

.item-remove {
  padding-bottom: 1px;
}

/* Accompaniment chip shown under a line item once a side dish is chosen. */
.accomp-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 6px 10px;
  background: #eef6ff;
  border: 1px solid #cfe3fa;
  border-radius: 999px;
  font-size: 12px;
  color: #005eb8;
  width: fit-content;
}

/* Served-with chip inside the order detail table cell. */
.detail-accomp {
  margin-top: 4px;
}

/* "Served with" modal option grid. */
.accomp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 16px;
}

.accomp-option {
  padding: 14px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  transition: all 0.15s ease;
}

.accomp-option:hover {
  border-color: #005eb8;
  background: #eef6ff;
}

.accomp-option.active {
  border-color: #005eb8;
  background: #005eb8;
  color: #fff;
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

.modal-sm {
  max-width: 420px;
}

.modal-lg {
  max-width: 820px;
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
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

@media (max-width: 768px) {
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
}
</style>
