<!--
  CashierDineInPage — the Dine In floor map (cashier landing page).
  Each table card has 3 action icons:
    👤 user (distinct waiters today) → waiter-list modal with timestamps
    ＋ plus (quick assign)            → waiter picker modal
    📋 clipboard (take order)         → NewOrderModal
  Clicking the card body opens the ticket actions (running) or take order.
-->

<template>
  <div class="sm-page">
    <div class="kpi-grid">
      <template v-if="busy && !tables.length">
        <div v-for="n in 3" :key="'kpi-'+n" class="sm-skeleton sm-skeleton-kpi"></div>
      </template>
      <template v-else>
        <div class="kpi-card"><span class="kpi-icon amber"><i class="fas fa-chair" aria-hidden="true"></i></span><div><strong>{{ occupiedCount }}</strong><small>{{ $t('cashier.dineIn.occupied') }}</small></div></div>
        <div class="kpi-card"><span class="kpi-icon green"><i class="fas fa-chair" aria-hidden="true"></i></span><div><strong>{{ vacantCount }}</strong><small>{{ $t('cashier.dineIn.vacant') }}</small></div></div>
        <div class="kpi-card"><span class="kpi-icon blue"><i class="fas fa-clock" aria-hidden="true"></i></span><div><strong>{{ runningOrders.length }}</strong><small>{{ $t('cashier.dineIn.running') }}</small></div></div>
      </template>
    </div>

    <section class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-chair" aria-hidden="true"></i> {{ $t('cashier.dineIn.title') }}</h2>
        <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="tableQ" type="text" :placeholder="$t('common.search')" /></div>
        <button class="sm-btn ghost sm" @click="load" :disabled="busy">
          <i class="fas fa-rotate" aria-hidden="true"></i> {{ $t('common.refresh') }}
        </button>
      </div>
      <div class="panel-body pos-tables-wrap">
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
            :class="[table.status, { frozen: frozenTableIds.has(table.table_name), 'has-orders': (table._waitersCount || 0) > 0 }]">

            <!-- Clickable card body → ticket actions or take order -->
            <button class="pos-table-body" @click="openTable(table)">
              <span class="pos-table-name">{{ table.table_name }}</span>
              <span class="pos-table-meta">
                <span v-if="table.waiter" class="waiter-chip">
                  <span class="avatar">{{ initials(table.waiter.full_name) }}</span>
                  {{ table.waiter.full_name.split(' ')[0] }}
                  <button class="chip-x" :title="$t('cashier.waiters.removeTip')" @click.stop="unassignWaiter(table)"><i class="fas fa-xmark"></i></button>
                </span>
                <span v-if="tableTimers[table.table_name]" class="pos-timer">{{ tableTimers[table.table_name] }}</span>
                <span v-if="runningByTable[table.table_name]?.length" class="running-badge">
                  <i class="fas fa-play" aria-hidden="true"></i>
                  {{ $t('cashier.dineIn.runningCount', runningByTable[table.table_name].length) }}
                </span>
              </span>
            </button>

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

    <!-- ═══ MODAL 1: Waiter list (user icon → who served today) ═══ -->
    <teleport to="body">
      <transition name="din-pop">
        <div v-if="waiterListModal.open" class="din-backdrop" @click="waiterListModal.open = false"></div>
      </transition>
      <transition name="din-pop">
        <div v-if="waiterListModal.open" class="din-modal waiter-list-modal">
          <div class="din-modal-head">
            <h3>
              <i class="fas fa-chair"></i> {{ waiterListModal.tableName }}
              <span class="din-sub">{{ filteredWaiterList.length }} {{ $t('cashier.waiters.waitersServed') }}</span>
            </h3>
            <button class="sm-btn ghost sm" @click="waiterListModal.open = false"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="din-modal-tools">
            <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="waiterListModal.q" type="text" :placeholder="$t('common.search')" /></div>
          </div>
          <div class="din-modal-body">
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

    <!-- ═══ MODAL 2: Waiter picker (+ icon → assign) ═══ -->
    <teleport to="body">
      <transition name="din-pop">
        <div v-if="pickerOpen" class="din-backdrop" @click="pickerOpen = false"></div>
      </transition>
      <transition name="din-pop">
        <div v-if="pickerOpen" class="din-modal waiter-picker-modal">
          <div class="din-modal-head">
            <h3><i class="fas fa-chair"></i> {{ pickerTable?.table_name }}</h3>
            <button class="sm-btn ghost sm" @click="pickerOpen = false"><i class="fas fa-xmark"></i></button>
          </div>
          <p class="din-hint">{{ $t('cashier.waiters.pickWaiter') }}</p>
          <div class="din-modal-tools">
            <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="pickerQ" type="text" :placeholder="$t('common.search')" /></div>
          </div>
          <div class="din-modal-body">
            <p v-if="!filteredPickerWaiters.length" class="empty">{{ $t('common.noResults') }}</p>
            <div v-for="w in filteredPickerWaiters" :key="w.user_id" class="picker-row" @click="assignFromPicker(w)">
              <span class="avatar">{{ initials(w.full_name) }}</span>
              <strong>{{ w.full_name }}</strong>
              <span class="meta-chip tables-chip"><i class="fas fa-chair"></i> {{ w.tables_count }}</span>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- ═══ Take order (clipboard icon + card click for vacant) ═══ -->
    <NewOrderModal v-if="showOrderModal" mode="dine_in" :title="$t('cashier.dineIn.newOrderFor', { table: activeTable?.table_name })"
      :table-number="activeTable?.table_name" @close="showOrderModal = false" @created="onCreated" />

    <!-- ═══ Ticket actions (card click for occupied) ═══ -->
    <div v-if="ticketTable" class="sm-modal-backdrop" @click.self="ticketTable = null">
      <div class="sm-modal" role="dialog" aria-modal="true">
        <div class="sm-modal-head">
          <h3><i class="fas fa-receipt" aria-hidden="true"></i> {{ ticketTable.table_name }}</h3>
          <button class="sm-btn ghost sm" @click="ticketTable = null">{{ $t('common.close') }}</button>
        </div>
        <table class="sm-table">
          <thead>
            <tr>
              <th>{{ $t('cashier.summary.order') }}</th>
              <th>{{ $t('cashier.summary.amount') }}</th>
              <th>{{ $t('common.status') }}</th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in runningByTable[ticketTable.table_name] || []" :key="order.order_id">
              <td>{{ order.order_number }}</td>
              <td>{{ money(order.total_amount) }}</td>
              <td><span class="chip pending">{{ order.status }}</span></td>
              <td>
                <div class="row-actions">
                  <button v-if="!order.is_frozen" class="sm-btn sm" @click="freeze(order)">
                    <i class="fas fa-snowflake" aria-hidden="true"></i> {{ $t('storeManager.common.freeze') }}
                  </button>
                  <button v-else class="sm-btn sm success" @click="unfreeze(order)">
                    <i class="fas fa-sun" aria-hidden="true"></i> {{ $t('storeManager.common.unfreeze') }}
                  </button>
                  <button class="sm-btn sm ghost" @click="$router.push({ name: 'cashier-order-summary', query: { focus: order.order_id } })">
                    {{ $t('cashier.dineIn.openTicket') }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!(runningByTable[ticketTable.table_name] || []).length">
              <td colspan="4" class="empty">{{ $t('cashier.dineIn.noRunning') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { cashierApi, orderApi, tableApi } from '@/api'
import NewOrderModal from '@/components/cashier/NewOrderModal.vue'

const { t } = useI18n()

const tables = ref([])
const allWaiters = ref([])
const tableQ = ref('')
const filteredTables = computed(() => {
  const term = tableQ.value.trim().toLowerCase()
  if (!term) return tables.value
  return tables.value.filter((row) =>
    `${row.table_name} ${row.waiter?.full_name || ''}`.toLowerCase().includes(term))
})
const runningOrders = ref([])
const busy = ref(false)
const showOrderModal = ref(false)
const activeTable = ref(null)
const ticketTable = ref(null)
let timerHandle = null

const occupiedCount = computed(() => tables.value.filter((x) => x.status === 'occupied').length)
const vacantCount = computed(() => tables.value.filter((x) => x.status === 'available').length)

const runningByTable = computed(() => {
  const map = {}
  for (const order of runningOrders.value) {
    if (!order.table_number) continue
    ;(map[order.table_number] ||= []).push(order)
  }
  return map
})

const frozenTableIds = computed(() => {
  const set = new Set()
  for (const order of runningOrders.value) {
    if (order.is_frozen && order.table_number) set.add(order.table_number)
  }
  return set
})

const tableTimers = computed(() => {
  const timers = {}
  for (const [name, orders] of Object.entries(runningByTable.value)) {
    const oldest = orders.reduce((min, o) => Math.min(min, new Date(o.created_at).getTime()), Infinity)
    if (oldest === Infinity) continue
    const mins = Math.floor((Date.now() - oldest) / 60000)
    timers[name] = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} ${t('cashier.dineIn.hr')}`
  }
  return timers
})

function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function money(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

/* ── MODAL 1: Waiter list (user icon) ───────────────────────── */
const waiterListModal = reactive({ open: false, tableName: '', waiters: [], q: '' })

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

/* ── MODAL 2: Waiter picker (+ icon) ────────────────────────── */
const pickerOpen = ref(false)
const pickerTable = ref(null)
const pickerQ = ref('')

const filteredPickerWaiters = computed(() => {
  const term = pickerQ.value.trim().toLowerCase()
  if (!term) return allWaiters.value
  return allWaiters.value.filter((w) => w.full_name.toLowerCase().includes(term))
})

function openWaiterPicker(table) {
  pickerTable.value = table
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

async function unassignWaiter(table) {
  if (busy.value || !table.waiter) return
  busy.value = true
  try {
    await cashierApi.assignWaiter(table.table_id, null)
    await load()
  } finally {
    busy.value = false
  }
}

/* ── Take order (clipboard icon) ─────────────────────────────── */
function openTakeOrder(table) {
  activeTable.value = table
  showOrderModal.value = true
}

/* ── Card click → ticket actions or take order ───────────────── */
function openTable(table) {
  activeTable.value = table
  if ((runningByTable.value[table.table_name] || []).length) {
    ticketTable.value = table
  } else {
    showOrderModal.value = true
  }
}

/* ── Data loading ────────────────────────────────────────────── */
async function load() {
  busy.value = true
  try {
    const today = new Date().toISOString().slice(0, 10)
    const [tablesRes, ordersRes, boardRes] = await Promise.all([
      tableApi.index({ per_page: 200 }),
      orderApi.index({ status: 'pending', date: today, per_page: 100 }),
      cashierApi.waiters(),
    ])
    const list = (tablesRes.data.data || tablesRes.data).filter((x) => x.is_active !== false)
    allWaiters.value = boardRes.data.waiters || []

    const stages = await Promise.all(
      ['in_progress', 'processing', 'preparing', 'ready', 'served'].map((status) =>
        orderApi.index({ status, date: today, per_page: 100 }).catch(() => ({ data: { data: [] } })),
      ),
    )
    runningOrders.value = [{ data: ordersRes.data }, ...stages.map((r) => r.data)]
      .flatMap((page) => page.data || [])

    // Enrich tables with today's waiter count per table (single batch request)
    const batchRes = await cashierApi.todayOrdersBatch()
    const batchMap = batchRes.data.tables || {}

    tables.value = list.map((x) => ({
      ...x,
      _waitersCount: batchMap[x.table_name]?.waiters_count || 0,
    }))
  } finally {
    busy.value = false
  }
}

async function freeze(order) {
  await cashierApi.freeze(order.order_id)
  await load()
}

async function unfreeze(order) {
  await cashierApi.unfreeze(order.order_id)
  await load()
}

function onCreated() {
  showOrderModal.value = false
  load()
}

onMounted(() => {
  load()
  timerHandle = setInterval(load, 60000)
})
onBeforeUnmount(() => clearInterval(timerHandle))
</script>

<style scoped>
.panel-body.pos-tables-wrap { padding: 16px; }
.actions-col { width: 1%; }

/* ── Table card body is clickable; icons row is separate ─────── */
.pos-table { display: flex; flex-direction: column; gap: 2px; }
.pos-table-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  font: inherit;
  width: 100%;
}
.pos-table.has-orders { border-color: var(--mrk-blue); box-shadow: 0 0 0 1px var(--mrk-blue); }

/* ── Icon row ────────────────────────────────────────────────── */
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
.user-icon.active { background: var(--mrk-blue); color: #fff; border-color: var(--mrk-blue); }
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

/* ── Dine-in modal shell (shared) ────────────────────────────── */
.din-backdrop {
  position: fixed;
  inset: 0;
  z-index: 88;
  background: rgba(33, 33, 33, 0.35);
}
.din-modal {
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
.din-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #e5e7eb;
}
.din-modal-head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  color: #1e293b;
}
.din-sub { font-size: 12px; color: #94a3b8; font-weight: 400; margin-left: 4px; }
.din-hint { margin: 0; padding: 10px 18px 0; font-size: 12px; color: #64748b; }
.din-modal-tools { padding: 10px 18px 0; }
.din-modal-tools .sm-search { width: 100%; }
.din-modal-body { padding: 14px 18px 18px; overflow-y: auto; }

/* ── Waiter list rows ────────────────────────────────────────── */
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
.wl-times { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; }
.wl-time {
  font-size: 11px;
  font-family: monospace;
  background: #dbeafe;
  color: var(--mrk-blue);
  padding: 2px 7px;
  border-radius: 6px;
  font-weight: 600;
}

/* ── Picker rows ─────────────────────────────────────────────── */
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
.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  padding: 2px 7px;
  border: none;
  line-height: 1.4;
}
.tables-chip { background: #f1f5f9; color: #475569; }

/* ── Transitions ─────────────────────────────────────────────── */
.din-pop-enter-active, .din-pop-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.din-pop-enter-from, .din-pop-leave-to { opacity: 0; transform: translateY(12px); }
</style>
