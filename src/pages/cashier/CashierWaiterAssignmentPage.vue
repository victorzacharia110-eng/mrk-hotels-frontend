<!--
  CashierWaiterAssignmentPage — the Waiter Assignment board.
  Left: floor map — each table card has action icons:
        👤 user (distinct waiters today)  ＋ plus (quick assign)  📋 clipboard (take order)
  Right: waiter rail — assign (+), served-orders icon, table count.
  Real-time via Laravel Reverb on the tenant channel.
-->

<template>
  <div class="sm-page">
    <div class="pos-board-layout">
      <!-- ═══ Floor map ═══ -->
      <section class="panel">
        <div class="panel-head">
          <h2><i class="fas fa-chair" aria-hidden="true"></i> {{ $t('cashier.dineIn.title') }}</h2>
          <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="tableQ" type="text" :placeholder="$t('common.search')" /></div>
        </div>
        <div class="panel-body pos-tables-wrap">
          <div v-if="mode === 'assign'" class="mode-banner assign-banner">
            <span class="step-badge">Step 2</span>
            <i class="fas fa-arrow-pointer"></i>
            <span>{{ $t('cashier.waiters.hintAssign', { name: waiterName(selectedUserId) }) }}</span>
            <button class="banner-x" @click="mode = null; selectedUserId = null" :title="$t('common.cancel')"><i class="fas fa-xmark"></i></button>
          </div>
          <div v-else-if="mode === 'unassign'" class="mode-banner unassign-banner">
            <span class="step-badge">Step 2</span>
            <i class="fas fa-arrow-pointer"></i>
            <span>{{ $t('cashier.waiters.hintUnassign') }}</span>
            <button class="banner-x" @click="mode = null" :title="$t('common.cancel')"><i class="fas fa-xmark"></i></button>
          </div>
          <!-- Skeleton loading -->
          <div v-if="busy && !tables.length" class="pos-tables">
            <div v-for="n in 20" :key="'sk-'+n" class="sm-skeleton-card">
              <div class="sm-skeleton sk-name"></div>
              <div class="sm-skeleton sk-chip"></div>
              <div class="sk-icons">
                <div class="sm-skeleton sk-icon"></div>
                <div class="sm-skeleton sk-icon"></div>
                <div class="sm-skeleton sk-icon"></div>
              </div>
            </div>
          </div>
          <p v-else-if="!filteredTables.length && !busy" class="empty">{{ $t('cashier.dineIn.noTables') }}</p>
          <div class="pos-tables">
            <div v-for="table in filteredTables" :key="table.table_id" class="pos-table"
              :class="[table.status, { 'has-orders': (table._waitersCount || 0) > 0 }]"
              @click="onTableClick(table)">
              <span class="pos-table-name">{{ table.table_name }}</span>
              <span class="pos-table-meta">
                <span v-if="table.waiter" class="waiter-chip">
                  <span class="avatar">{{ initials(table.waiter.full_name) }}</span>
                  {{ table.waiter.full_name.split(' ')[0] }}
                  <button class="chip-x" :title="$t('cashier.waiters.removeTip')" @click.stop="quickUnassign(table)"><i class="fas fa-xmark"></i></button>                </span>
                <span v-else class="unassigned-tag">{{ $t('cashier.waiters.none') }}</span>
              </span>
              <span class="pos-table-time" v-if="table._lastAt">{{ fmtTime(table._lastAt) }}</span>

              <!-- Action icons -->
              <span class="pos-table-icons">
                <button class="icon-btn user-icon"
                  :title="$t('cashier.waiters.waitersServedToday', { n: table._waitersCount || 0 })"
                  :class="{ active: (table._waitersCount || 0) > 0 }"
                  @click.stop="openWaiterListModal(table)">
                  <i class="fas fa-user"></i>
                  <span v-if="(table._waitersCount || 0) > 0" class="icon-badge">{{ table._waitersCount }}</span>
                </button>
                <button class="icon-btn add-icon"
                  :title="$t('cashier.waiters.assignWaiter')"
                  @click.stop="openWaiterPicker(table)">
                  <i class="fas fa-plus"></i>
                </button>
                <button class="icon-btn order-icon"
                  :title="$t('cashier.dineIn.takeOrder')"
                  @click.stop="openTakeOrder(table)">
                  <i class="fas fa-clipboard-list"></i>
                </button>
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ Desktop waiter rail ═══ -->
      <aside class="waiter-rail">
        <div class="panel">
          <div class="panel-head">
            <h2><i class="fas fa-user-group" aria-hidden="true"></i> {{ $t('cashier.waiters.title') }}</h2>
            <div class="panel-head-tools">
              <button class="rail-close" :title="$t('common.close')" :aria-label="$t('common.close')"
                @click="router.push({ name: 'cashier-dine-in' })"><i class="fas fa-xmark"></i></button>
              <button class="icon-btn help-btn" :title="$t('cashier.waiters.guideHelp')" @click="showGuide"><i class="fas fa-circle-question"></i></button>
              <button class="sm-btn sm danger" :class="{ active: mode === 'unassign' }" @click="startUnassign">
                <i class="fas fa-user-slash" aria-hidden="true"></i> {{ $t('cashier.waiters.unassign') }}
              </button>
            </div>
            <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="waiterQ" type="text" :placeholder="$t('common.search')" /></div>
          </div>
          <div class="rail-body">
            <!-- Skeleton rail rows -->
            <template v-if="busy && !waiters.length">
              <div v-for="n in 6" :key="'rk-'+n" class="sm-skeleton sm-skeleton-rail-row"></div>
            </template>
            <div v-for="waiter in filteredWaiters" :key="waiter.user_id" class="waiter-row"
              :class="{ selected: mode === 'assign' && selectedUserId === waiter.user_id }">
              <button class="waiter-main" :title="waiter.full_name" @click="selectWaiter(waiter)">
                <span class="avatar">{{ initials(waiter.full_name) }}</span>
                <strong class="waiter-name">{{ waiter.full_name }}</strong>
              </button>
              <span class="waiter-meta">
                <span class="meta-chip tables-chip"><i class="fas fa-chair"></i> {{ waiter.tables_count }}</span>
                <button class="meta-chip served-chip"
                  :title="$t('cashier.waiters.servedToday', { n: waiter.served_count })"
                  @click.stop="openWaiterOrders(waiter)">
                  <i class="fas fa-users"></i> {{ waiter.served_count }}
                </button>
                <button class="meta-chip add-chip" @click.stop="selectWaiter(waiter)">
                  <i class="fas fa-plus"></i>
                </button>
              </span>
            </div>
          </div>
        </div>
      </aside>

      <!-- ═══ Mobile FAB + bubble ═══ -->
      <button v-if="bubbleOpen" class="wa-backdrop" aria-label="close" @click="bubbleOpen = false"></button>
      <transition name="wa-pop">
        <div v-if="bubbleOpen" class="wa-bubble">
          <div class="panel">
            <div class="panel-head">
              <h2><i class="fas fa-user-group" aria-hidden="true"></i> {{ $t('cashier.waiters.title') }}</h2>
              <button class="sm-btn ghost sm" @click="bubbleOpen = false" aria-label="close"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="wa-bubble-tools">
              <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="waiterQ" type="text" :placeholder="$t('common.search')" /></div>
              <button class="sm-btn sm danger" :class="{ active: mode === 'unassign' }" @click="startUnassign">
                <i class="fas fa-user-slash" aria-hidden="true"></i> {{ $t('cashier.waiters.unassign') }}
              </button>
            </div>
            <div class="rail-body">
              <div v-for="waiter in filteredWaiters" :key="waiter.user_id" class="waiter-row"
                :class="{ selected: mode === 'assign' && selectedUserId === waiter.user_id }">
                <button class="waiter-main" @click="selectWaiter(waiter)">
                  <span class="avatar">{{ initials(waiter.full_name) }}</span>
                  <strong class="waiter-name">{{ waiter.full_name }}</strong>
                </button>
                <span class="waiter-meta">
                  <span class="meta-chip tables-chip"><i class="fas fa-chair"></i> {{ waiter.tables_count }}</span>
                  <button class="meta-chip served-chip" @click.stop="openWaiterOrders(waiter)">
                    <i class="fas fa-users"></i> {{ waiter.served_count }}
                  </button>
                  <button class="meta-chip add-chip" @click.stop="selectWaiter(waiter)"><i class="fas fa-plus"></i></button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </transition>
      <button class="wa-fab" :class="{ open: bubbleOpen }" :aria-label="$t('cashier.nav.waiterAssignment')"
        @click="bubbleOpen = !bubbleOpen"><i class="fas fa-ellipsis-vertical"></i></button>

      <!-- ═══ MODAL 1: Waiter list (user icon → who served this table) ═══ -->
      <teleport to="body">
        <transition name="wa-pop">
          <div v-if="waiterListModal.open" class="wa-backdrop" style="z-index:88" @click="waiterListModal.open = false"></div>
        </transition>
        <transition name="wa-pop">
          <div v-if="waiterListModal.open" class="orders-modal">
            <div class="orders-modal-head">
              <h3>
                <i class="fas fa-chair"></i> {{ waiterListModal.tableName }}
                <span class="orders-modal-sub">{{ filteredWaiterList.length }} {{ $t('cashier.waiters.waitersServed') }}</span>
              </h3>
              <button class="sm-btn ghost sm" @click="waiterListModal.open = false"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="modal-search">
              <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="waiterListModal.q" type="text" :placeholder="$t('common.search')" /></div>
            </div>
            <div class="orders-modal-body">
              <p v-if="!filteredWaiterList.length" class="empty">{{ waiterListModal.q ? $t('common.noResults') : $t('cashier.waiters.noWaitersToday') }}</p>
              <div v-else class="wl-list">
                <div v-for="w in filteredWaiterList" :key="w.user_id" class="wl-row">
                  <span class="avatar">{{ initials(w.full_name) }}</span>
                  <div class="wl-info">
                    <strong>{{ w.full_name }}</strong>
                    <small>{{ w.orders_count }} {{ $t('cashier.waiters.ordersLower') }}</small>
                  </div>
                  <div class="wl-times">
                    <span v-for="(ts, i) in w.timestamps" :key="i" class="wl-time">{{ ts }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </teleport>

      <!-- ═══ MODAL 2: Waiter picker (+ icon → assign waiter) ═══ -->
      <teleport to="body">
        <transition name="wa-pop">
          <div v-if="pickerOpen" class="wa-backdrop" style="z-index:88" @click="pickerOpen = false"></div>
        </transition>
        <transition name="wa-pop">
          <div v-if="pickerOpen" class="orders-modal">
            <div class="orders-modal-head">
              <h3><i class="fas fa-chair"></i> {{ pickerTable?.table_name }}</h3>
              <button class="sm-btn ghost sm" @click="pickerOpen = false"><i class="fas fa-xmark"></i></button>
            </div>
            <p class="picker-hint">{{ $t('cashier.waiters.pickWaiter') }}</p>
            <div class="modal-search">
              <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="pickerQ" type="text" :placeholder="$t('common.search')" /></div>
            </div>
            <div class="orders-modal-body">
              <p v-if="!filteredPickerWaiters.length" class="empty">{{ $t('common.noResults') }}</p>
              <div v-for="w in filteredPickerWaiters" :key="w.user_id" class="picker-row"
                @click="assignFromPicker(w)">
                <span class="avatar">{{ initials(w.full_name) }}</span>
                <strong>{{ w.full_name }}</strong>
                <span class="meta-chip tables-chip"><i class="fas fa-chair"></i> {{ w.tables_count }}</span>
              </div>
            </div>
          </div>
        </transition>
      </teleport>

      <!-- ═══ MODAL 3: Waiter orders (served-chip on rail) ═══ -->
      <teleport to="body">
        <transition name="wa-pop">
          <div v-if="ordersModal.open" class="wa-backdrop" style="z-index:88" @click="ordersModal.open = false"></div>
        </transition>
        <transition name="wa-pop">
          <div v-if="ordersModal.open" class="orders-modal">
            <div class="orders-modal-head">
              <h3>
                <span class="avatar sm">{{ initials(ordersModal.waiterName) }}</span>
                {{ ordersModal.waiterName }}
                <span class="orders-modal-sub">{{ $t('cashier.waiters.ordersToday') }}</span>
              </h3>
              <button class="sm-btn ghost sm" @click="ordersModal.open = false"><i class="fas fa-xmark"></i></button>
            </div>
            <div v-if="ordersModal.loading" class="orders-modal-body"><p class="empty">{{ $t('common.loading') }}</p></div>
            <div v-else-if="!ordersModal.orders.length" class="orders-modal-body"><p class="empty">{{ $t('cashier.waiters.noOrdersToday') }}</p></div>
            <div v-else class="orders-modal-body">
              <table class="orders-table">
                <thead>
                  <tr>
                    <th>{{ $t('storeManager.sales.number') }}</th>
                    <th>{{ $t('cashier.dineIn.title') }}</th>
                    <th>{{ $t('cashier.waiters.guests') }}</th>
                    <th>{{ $t('storeManager.reports.total') }}</th>
                    <th>{{ $t('common.status') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="order in ordersModal.orders" :key="order.order_number">
                    <td class="mono">{{ order.order_number }}</td>
                    <td>{{ order.table_number || '—' }}</td>
                    <td class="center">{{ order.covers ?? '—' }}</td>
                    <td class="right">{{ fmtMoney(order.total_amount) }}</td>
                    <td><span class="status-chip" :class="order.payment_status">{{ order.payment_status }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </transition>
      </teleport>

      <!-- ═══ MODAL 4: Take order (clipboard icon) ═══ -->
      <NewOrderModal v-if="takeOrderModal.open" mode="dine_in"
        :title="$t('cashier.dineIn.newOrderFor', { table: takeOrderModal.tableName })"
        :table-number="takeOrderModal.tableName"
        @close="takeOrderModal.open = false"
        @created="onOrderCreated" />

      <!-- ═══ GUIDE: How to assign & unassign waiters ═══ -->
      <teleport to="body">
        <transition name="wa-pop">
          <div v-if="guideOpen" class="wa-backdrop" style="z-index:90" @click="closeGuide"></div>
        </transition>
        <transition name="wa-pop">
          <div v-if="guideOpen" class="guide-modal">
            <div class="guide-head">
              <h3><i class="fas fa-circle-question"></i> {{ $t('cashier.waiters.guideTitle') }}</h3>
              <button class="sm-btn ghost sm" @click="closeGuide"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="guide-body">
              <div class="guide-method">
                <div class="guide-method-head">
                  <span class="guide-badge easy">{{ $t('cashier.waiters.guideEasy') }}</span>
                  <h4>{{ $t('cashier.waiters.guideMethod1Title') }}</h4>
                </div>
                <ol class="guide-steps">
                  <li><i class="fas fa-mouse-pointer"></i> {{ $t('cashier.waiters.guideStep1Easy') }}</li>
                  <li><i class="fas fa-xmark-circle"></i> {{ $t('cashier.waiters.guideStep2Easy') }}</li>
                </ol>
              </div>
              <div class="guide-divider"></div>
              <div class="guide-method">
                <div class="guide-method-head">
                  <span class="guide-badge step">{{ $t('cashier.waiters.guideSteps') }}</span>
                  <h4>{{ $t('cashier.waiters.guideMethod2Title') }}</h4>
                </div>
                <ol class="guide-steps">
                  <li><i class="fas fa-user-slash"></i> {{ $t('cashier.waiters.guideStep1Hard') }}</li>
                  <li><i class="fas fa-arrow-pointer"></i> {{ $t('cashier.waiters.guideStep2Hard') }}</li>
                </ol>
              </div>
              <div class="guide-divider"></div>
              <div class="guide-method">
                <div class="guide-method-head">
                  <span class="guide-badge easy">{{ $t('cashier.waiters.guideEasy') }}</span>
                  <h4>{{ $t('cashier.waiters.guideAssignTitle') }}</h4>
                </div>
                <ol class="guide-steps">
                  <li><i class="fas fa-plus-circle"></i> {{ $t('cashier.waiters.guideAssignStep1') }}</li>
                  <li><i class="fas fa-arrow-pointer"></i> {{ $t('cashier.waiters.guideAssignStep2') }}</li>
                </ol>
              </div>
            </div>
            <div class="guide-foot">
              <label class="guide-dontshow"><input type="checkbox" v-model="guideDontShow"> {{ $t('cashier.waiters.guideDontShow') }}</label>
              <button class="sm-btn primary" @click="closeGuide">{{ $t('common.gotIt') }}</button>
            </div>
          </div>
        </transition>
      </teleport>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { cashierApi, tableApi } from '@/api'
import { initEcho, getEcho } from '@/plugins/echo'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'

const authStore = useAuthStore()
const router = useRouter()

const tables = ref([])
const waiters = ref([])
const waiterMap = ref({})
const tableQ = ref('')
const waiterQ = ref('')
const busy = ref(false)
const bubbleOpen = ref(false)
const mode = ref(null)
const selectedUserId = ref(null)

/* ── Guide modal (first-visit auto-show + manual reopen) ─────── */
const GUIDE_KEY = 'mrk_waiter_guide_seen'
const guideOpen = ref(false)
const guideDontShow = ref(false)

function showGuide() { guideOpen.value = true; guideDontShow.value = false }
function closeGuide() {
  guideOpen.value = false
  if (guideDontShow.value) localStorage.setItem(GUIDE_KEY, '1')
}

/* ── Helpers ─────────────────────────────────────────────────── */
function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function fmtMoney(v) {
  return v != null ? `TZS ${Number(v).toLocaleString()}` : '—'
}
function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}
function waiterName(id) {
  return waiters.value.find((w) => w.user_id === id)?.full_name || ''
}

/* ── MODAL 1: Waiter list modal (user icon → who served today) ─ */
const waiterListModal = reactive({
  open: false,
  tableName: '',
  waiters: [],
  q: '',
})

const filteredWaiterList = computed(() => {
  const term = waiterListModal.q.trim().toLowerCase()
  if (!term) return waiterListModal.waiters
  return waiterListModal.waiters.filter((w) => w.full_name.toLowerCase().includes(term))
})

async function openWaiterListModal(table) {
  waiterListModal.tableName = table.table_name
  waiterListModal.waiters = []
  waiterListModal.q = ''
  waiterListModal.open = true
  try {
    const { data } = await cashierApi.tableTodayOrders(table.table_id)
    waiterListModal.waiters = data.waiters || []
  } catch { /* stay empty */ }
}

/* ── MODAL 2: Waiter picker (+ icon → assign) ───────────────── */
const pickerOpen = ref(false)
const pickerTable = ref(null)
const pickerQ = ref('')

const filteredPickerWaiters = computed(() => {
  const term = pickerQ.value.trim().toLowerCase()
  if (!term) return waiters.value
  return waiters.value.filter((w) => w.full_name.toLowerCase().includes(term))
})

function openWaiterPicker(table) {
  pickerTable.value = table
  pickerQ.value = ''
  pickerOpen.value = true
}

async function assignFromPicker(waiter) {
  if (!pickerTable.value || busy.value) return
  pickerOpen.value = false
  busy.value = true
  try {
    await cashierApi.assignWaiter(pickerTable.value.table_id, waiter.user_id)
    await load()
  } finally {
    busy.value = false
  }
}

/* ── MODAL 3: Waiter orders (served-chip on rail) ───────────── */
const ordersModal = reactive({
  open: false,
  loading: false,
  waiterName: '',
  orders: [],
})

async function openWaiterOrders(waiter) {
  ordersModal.open = true
  ordersModal.loading = true
  ordersModal.waiterName = waiter.full_name
  ordersModal.orders = []
  try {
    const { data } = await cashierApi.waiterOrders(waiter.user_id)
    ordersModal.orders = data.orders || []
  } finally {
    ordersModal.loading = false
  }
}

/* ── MODAL 4: Take order (clipboard icon) ────────────────────── */
const takeOrderModal = reactive({
  open: false,
  tableName: '',
})

function openTakeOrder(table) {
  takeOrderModal.tableName = table.table_name
  takeOrderModal.open = true
}

function onOrderCreated() {
  takeOrderModal.open = false
  load()
}

/* ── Computed ────────────────────────────────────────────────── */
const filteredTables = computed(() => {
  const term = tableQ.value.trim().toLowerCase()
  if (!term) return tables.value
  return tables.value.filter((row) =>
    `${row.table_name} ${row.waiter?.full_name || ''}`.toLowerCase().includes(term))
})

const filteredWaiters = computed(() => {
  const term = waiterQ.value.trim().toLowerCase()
  if (!term) return waiters.value
  return waiters.value.filter((w) => w.full_name.toLowerCase().includes(term))
})

/* ── Board actions ───────────────────────────────────────────── */
function selectWaiter(waiter) {
  if (mode.value === 'assign' && selectedUserId.value === waiter.user_id) {
    mode.value = null
    selectedUserId.value = null
  } else {
    mode.value = 'assign'
    selectedUserId.value = waiter.user_id
  }
  pickerOpen.value = false
  bubbleOpen.value = false
}

function startUnassign() {
  mode.value = mode.value === 'unassign' ? null : 'unassign'
}

async function onTableClick(table) {
  if (mode.value === 'assign' && selectedUserId.value) {
    if (busy.value) return
    busy.value = true
    try {
      await cashierApi.assignWaiter(table.table_id, selectedUserId.value)
      await load()
      mode.value = null
      selectedUserId.value = null
    } finally {
      busy.value = false
    }
  } else if (mode.value === 'unassign') {
    if (busy.value || !table.waiter) return
    busy.value = true
    try {
      await cashierApi.assignWaiter(table.table_id, null)
      await load()
      mode.value = null
    } finally {
      busy.value = false
    }
  }
}

async function quickUnassign(table) {
  if (busy.value || !table.waiter) return
  busy.value = true
  try {
    await cashierApi.assignWaiter(table.table_id, null)
    await load()
  } finally {
    busy.value = false
  }
}

/* ── Data loading ────────────────────────────────────────────── */
async function load() {
  busy.value = true
  try {
    const [tablesRes, board] = await Promise.all([
      tableApi.index({ per_page: 200 }),
      cashierApi.waiters(),
    ])
    const list = tablesRes.data.data || tablesRes.data
    const wList = board.data.waiters || []
    waiters.value = wList
    waiterMap.value = Object.fromEntries(wList.map((w) => [w.user_id, w]))

    const enriched = list
      .filter((x) => x.is_active !== false)
      .map((x) => ({
        ...x,
        waiter: x.waiter_id ? waiterMap.value[x.waiter_id] || null : null,
        _waitersCount: 0,
        _lastAt: null,
      }))

    const batchRes = await cashierApi.todayOrdersBatch()
    const batchMap = batchRes.data.tables || {}

    for (const tbl of enriched) {
      const b = batchMap[tbl.table_name]
      if (b) {
        tbl._waitersCount = b.waiters_count || 0
        tbl._lastAt = b.last_at || null
      }
    }

    tables.value = enriched
  } finally {
    busy.value = false
  }
}

/* ── Real-time WebSocket ─────────────────────────────────────── */
let echoChannel = null

function subscribe() {
  const tenantId = authStore.user?.tenant_id
  if (!tenantId) return

  initEcho()
  const echo = getEcho()
  if (!echo) return

  echoChannel = echo.private(`tenant.${tenantId}`)
    .listen('.table.waiter.updated', (e) => {
      const idx = tables.value.findIndex((x) => x.table_id === e.table_id)
      if (idx !== -1) {
        tables.value[idx] = {
          ...tables.value[idx],
          waiter: e.waiter ? waiterMap.value[e.waiter.user_id] || { user_id: e.waiter.user_id, full_name: e.waiter.full_name } : null,
        }
      }
      refreshWaiterCounts()
    })
}

function refreshWaiterCounts() {
  const counts = {}
  for (const tbl of tables.value) {
    if (tbl.waiter?.user_id) {
      counts[tbl.waiter.user_id] = (counts[tbl.waiter.user_id] || 0) + 1
    }
  }
  waiters.value = waiters.value.map((w) => ({ ...w, tables_count: counts[w.user_id] ?? 0 }))
}

function unsubscribe() {
  if (echoChannel) {
    echoChannel.stopListening('.table.waiter.updated')
    echoChannel = null
  }
}

onMounted(() => {
  load(); subscribe()
  if (!localStorage.getItem(GUIDE_KEY)) showGuide()
})
onUnmounted(unsubscribe)
</script>


<style scoped>
.panel-body.pos-tables-wrap { padding: 16px; }

/* ── Table card ──────────────────────────────────────────────── */
.pos-table { display: flex; flex-direction: column; gap: 2px; }
.pos-table.has-orders { border-color: var(--mrk-blue); box-shadow: 0 0 0 1px var(--mrk-blue); }

.pos-table-time {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 500;
}

/* ── Icon row on table card ──────────────────────────────────── */
.pos-table-icons {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.icon-btn:hover { border-color: var(--mrk-blue); color: var(--mrk-blue); background: #f0f6ff; }

.user-icon.active {
  background: var(--mrk-blue);
  color: #fff;
  border-color: var(--mrk-blue);
}
.user-icon.active:hover { background: var(--mrk-blue-deep); }

.icon-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: #ef4444;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
}

.add-icon { color: #16a34a; border-color: #bbf7d0; background: #f0fdf4; }
.add-icon:hover { background: #dcfce7; color: #166534; border-color: #16a34a; }

.order-icon { color: #f59e0b; border-color: #fde68a; background: #fffbeb; }
.order-icon:hover { background: #fef3c7; color: #92400e; border-color: #f59e0b; }

/* ── Waiter list modal rows ──────────────────────────────────── */
.wl-list { display: flex; flex-direction: column; gap: 10px; }
.wl-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
}
.wl-info { flex: 1; min-width: 0; }
.wl-info strong { display: block; font-size: 13px; color: #1e293b; }
.wl-info small { font-size: 11px; color: #64748b; }
.wl-times {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}
.wl-time {
  font-size: 11px;
  font-family: monospace;
  background: #dbeafe;
  color: var(--mrk-blue);
  padding: 2px 7px;
  border-radius: 6px;
  font-weight: 600;
}

/* ── Waiter rail row ─────────────────────────────────────────── */
.waiter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  transition: border-color 0.15s, background 0.15s;
}
.waiter-row.selected { border-color: var(--mrk-blue); background: #e8f1fa; }
.waiter-row:hover { border-color: var(--mrk-blue); }

.waiter-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.waiter-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.waiter-meta { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  padding: 2px 7px;
  border: none;
  cursor: default;
  line-height: 1.4;
}
.tables-chip { background: #f1f5f9; color: #475569; }
.served-chip { background: #dbeafe; color: var(--mrk-blue); cursor: pointer; }
.served-chip:hover { background: #bfdbfe; }
.add-chip { background: var(--mrk-blue); color: #fff; cursor: pointer; padding: 2px 8px; }
.add-chip:hover { background: var(--mrk-blue-deep); }

/* ── Shared modal styling ────────────────────────────────────── */
.orders-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 90;
  width: min(560px, 92vw);
  max-height: 80vh;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 14px 44px rgba(6, 42, 82, 0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.orders-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #e5e7eb;
}
.orders-modal-head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  color: #1e293b;
}
.orders-modal-sub { font-size: 12px; color: #94a3b8; font-weight: 400; margin-left: 4px; }
.modal-search { padding: 10px 18px 0; }
.modal-search .sm-search { width: 100%; }
.orders-modal-body { padding: 14px 18px 18px; overflow-y: auto; }
.picker-hint { margin: 0; padding: 10px 18px 0; font-size: 12px; color: #64748b; }

.picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: border-color 0.12s, background 0.12s;
}
.picker-row:hover { border-color: var(--mrk-blue); background: #f0f6ff; }
.picker-row .meta-chip { margin-left: auto; }

.orders-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.orders-table th {
  text-align: left;
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 6px 8px;
  border-bottom: 1px solid #e5e7eb;
}
.orders-table td { padding: 8px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.mono { font-family: monospace; font-size: 12px; }
.center { text-align: center; }
.right { text-align: right; }
.status-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
}
.status-chip.paid { background: #dcfce7; color: #166534; }
.status-chip.pending { background: #fef3c7; color: #92400e; }
.status-chip.completed { background: #dbeafe; color: #1e40af; }
.status-chip.cancelled { background: #fee2e2; color: #991b1b; }
.status-chip.billed_to_room { background: #e0e7ff; color: #3730a3; }
.status-chip.unpaid { background: #f1f5f9; color: #64748b; }

.avatar.sm {
  width: 24px;
  height: 24px;
  font-size: 10px;
  border-radius: 50%;
  background: var(--mrk-blue);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Mobile FAB / bubble ─────────────────────────────────────── */
.wa-fab { display: none; }
.wa-backdrop { display: none; }

@media (max-width: 1100px) {
  .waiter-rail { display: none; }
  .wa-fab {
    display: flex;
    position: fixed;
    right: 18px;
    bottom: 22px;
    z-index: 70;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: var(--mrk-blue);
    color: #fff;
    font-size: 20px;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 18px rgba(6, 42, 82, 0.4);
    cursor: pointer;
  }
  .wa-fab.open { background: var(--mrk-blue-deep); transform: rotate(90deg); }
  .wa-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 75;
    background: rgba(33, 33, 33, 0.35);
    border: none;
  }
  .wa-bubble {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 82px;
    z-index: 80;
    max-height: 62vh;
    display: flex;
  }
  .wa-bubble .panel { flex: 1; display: flex; flex-direction: column; min-height: 0; box-shadow: 0 10px 30px rgba(6, 42, 82, 0.35); }
  .wa-bubble-tools { display: flex; gap: 8px; padding: 10px 12px 0; }
  .wa-bubble-tools .sm-search { flex: 1; }
}
.wa-pop-enter-active, .wa-pop-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.wa-pop-enter-from, .wa-pop-leave-to { opacity: 0; transform: translateY(12px); }
.board-hint { margin: 0 0 12px; font-size: 13px; color: #00468c; background: #e8f1fa; border-left: 3px solid #005eb8; border-radius: 8px; padding: 8px 12px; }
.mode-banner {
  display: flex; align-items: center; gap: 10px; margin: 0 0 12px;
  padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
}
.assign-banner { background: #dbeafe; color: #1e40af; border-left: 3px solid #3b82f6; }
.unassign-banner { background: #fee2e2; color: #991b1b; border-left: 3px solid #ef4444; }
.mode-banner i:first-child { font-size: 15px; }
.mode-banner span { flex: 1; }
.banner-x {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%; border: none; cursor: pointer;
  font-size: 11px; color: #fff;
}
.assign-banner .banner-x { background: #3b82f6; }
.unassign-banner .banner-x { background: #ef4444; }
.banner-x:hover { opacity: 0.8; }
.rail-body { padding: 12px; display: flex; flex-direction: column; gap: 6px; max-height: 70vh; overflow-y: auto; }
.unassigned-tag { font-size: 11px; color: #94a3b8; font-weight: 600; }

/* ── Help button + guide modal ──────────────────────────────── */
.panel-head-tools { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.rail-close {
  width: 30px; height: 30px; border-radius: 50%; border: 1px solid #fecaca;
  background: #fef2f2; color: #b91c1c; font-size: 14px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background .15s, color .15s;
}
.rail-close:hover { background: #fee2e2; color: #991b1b; border-color: #b91c1c; }
.help-btn {
  width: 30px; height: 30px; border-radius: 50%; border: 1px solid #cbd5e1;
  background: #fff; color: #64748b; font-size: 14px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background .15s, color .15s;
}
.help-btn:hover { background: #f1f5f9; color: var(--mrk-blue); }

.guide-modal {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  z-index: 91; background: #fff; border-radius: 14px; width: 480px; max-width: 92vw;
  max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 50px rgba(0,0,0,0.25);
}
.guide-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
}
.guide-head h3 { margin: 0; font-size: 16px; color: var(--mrk-charcoal); display: flex; align-items: center; gap: 8px; }
.guide-head h3 i { color: var(--mrk-blue); }
.guide-body { padding: 20px; }
.guide-method { margin-bottom: 4px; }
.guide-method:last-child { margin-bottom: 0; }
.guide-method-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.guide-method-head h4 { margin: 0; font-size: 14px; color: var(--mrk-charcoal); }
.guide-badge {
  display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; padding: 3px 8px; border-radius: 6px; white-space: nowrap;
}
.guide-badge.easy { background: #dcfce7; color: #166534; }
.guide-badge.step { background: #dbeafe; color: #1e40af; }
.guide-steps {
  margin: 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;
}
.guide-steps li {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: 13px; color: #475569; line-height: 1.5;
}
.guide-steps li i { color: var(--mrk-blue); font-size: 14px; margin-top: 2px; min-width: 16px; }
.guide-divider { height: 1px; background: #e2e8f0; margin: 16px 0; }
.guide-foot {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-top: 1px solid #e2e8f0; background: #f8fafc; border-radius: 0 0 14px 14px;
}
.guide-dontshow { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.guide-dontshow input { accent-color: var(--mrk-blue); }
</style>
