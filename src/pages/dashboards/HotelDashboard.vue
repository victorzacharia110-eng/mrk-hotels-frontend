<template>
  <div class="dashboard-page container">
    <div v-if="loading" class="loading-spinner">
      <div class="spinner"></div>
    </div>

    <template v-else-if="data">
      <div class="dash-header">
        <div>
          <h1>{{ $t('dashboard.subtitle') }}</h1>
          <p>{{ $t('dashboard.headerIntro', { hotelName }) }}</p>
        </div>
        <span class="role-badge"><i class="fas fa-user-shield"></i> {{ roleLabel }}</span>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-users"></i></div>
          <div><span class="stat-value">{{ data.guests_in_house }}</span><span class="stat-label">{{
            $t('dashboard.guestsInHouse') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon checkin"><i class="fas fa-right-to-bracket"></i></div>
          <div><span class="stat-value">{{ data.check_ins_today }}</span><span class="stat-label">{{
            $t('dashboard.todayCheckIns') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon checkout"><i class="fas fa-right-from-bracket"></i></div>
          <div><span class="stat-value">{{ data.check_outs_today }}</span><span class="stat-label">{{
            $t('dashboard.todayCheckOuts') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bookings"><i class="fas fa-calendar-check"></i></div>
          <div><span class="stat-value">{{ data.upcoming_reservations }}</span><span class="stat-label">{{
            $t('dashboard.upcomingReservations') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon revenue"><i class="fas fa-dollar-sign"></i></div>
          <div><span class="stat-value">TZS {{ data.revenue_today.toLocaleString() }}</span><span class="stat-label">{{
            $t('dashboard.revenueToday') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon occupancy"><i class="fas fa-bed"></i></div>
          <div><span class="stat-value">{{ data.occupancy_rate }}%</span><span class="stat-label">{{
            $t('dashboard.occupancyRate') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon issues"><i class="fas fa-flag"></i></div>
          <div><span class="stat-value">{{ data.open_issues }}</span><span class="stat-label">{{
            $t('dashboard.alertOpenIssues') }}</span></div>
        </div>
      </div>

      <div class="dash-grid">
        <div class="card dash-section">
          <div class="section-header-row">
            <h2><i class="fas fa-bed"></i> {{ $t('dashboard.roomStatus') }}</h2>
            <router-link v-if="canSeeRooms" to="/app/rooms" class="view-all-link">{{ $t('dashboard.viewRooms') }} <i
                class="fas fa-arrow-right"></i></router-link>
          </div>
          <div class="room-status-grid">
            <div v-for="(count, key) in roomStatusItems" :key="key" class="room-status-item">
              <span class="room-status-dot" :class="key"></span>
              <span class="room-status-label">{{ $t('dashboard.roomStatusLabels.' + key) }}</span>
              <span class="room-status-value">{{ data.room_status[key] }}</span>
            </div>
          </div>
        </div>

        <div class="card dash-section">
          <div class="section-header-row">
            <h2><i class="fas fa-bell"></i> {{ $t('dashboard.alerts') }}</h2>
          </div>
          <div class="list-item">
            <div><strong>{{ data.pending_requisitions }}</strong> {{ $t('dashboard.alertPendingRequisitions') }}</div>
          </div>
          <div class="list-item">
            <div><strong>{{ data.low_stock_items }}</strong> {{ $t('dashboard.alertLowStock') }}</div>
          </div>
          <div class="list-item">
            <div><strong>TZS {{ data.pending_payments.toLocaleString() }}</strong> {{
              $t('dashboard.alertPendingPayments') }}</div>
          </div>
          <div class="list-item">
            <div><strong>{{ data.orders_today }}</strong> {{ $t('dashboard.alertFnBOrders', { count: data.open_tables })
            }}</div>
          </div>
          <div class="list-item">
            <div><strong>{{ data.open_issues }}</strong> {{ $t('dashboard.alertOpenIssues') }}</div>
            <router-link to="/app/issue-reports" class="view-all-link">{{ $t('dashboard.viewIssues') }} <i
                class="fas fa-arrow-right"></i></router-link>
          </div>
        </div>
      </div>

      <div class="card dash-section">
        <div class="section-header-row">
          <h2><i class="fas fa-money-bill-wave"></i> {{ $t('dashboard.recentPayments') }}</h2>
          <router-link v-if="canSeePayments" to="/app/payments" class="view-all-link">{{ $t('dashboard.viewPayments') }} <i
              class="fas fa-arrow-right"></i></router-link>
        </div>
        <div v-if="!data.recent_payments || !data.recent_payments.length" class="list-item">
          <div class="muted">{{ $t('dashboard.noRecentPayments') }}</div>
        </div>
        <div v-else class="recent-payments-list">
          <div v-for="p in data.recent_payments" :key="p.payment_id" class="payment-row">
            <div class="payment-info">
              <strong>{{ p.guest_name }}</strong>
              <span class="payment-meta">
                <template v-if="p.payment_provider">
                  <ProviderLogo :provider="p.payment_provider" /> {{ p.payment_provider }}
                </template>
                <template v-else>{{ p.payment_method }}</template>
                · {{ formatDate(p.created_at) }}
              </span>
            </div>
            <span class="badge" :class="statusBadge(p.payment_status)">{{ statusLabel(p.payment_status) }}</span>
            <span class="payment-amount">TZS {{ Number(p.amount).toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <div class="card dash-section">
        <div class="section-header-row">
          <h2><i class="fas fa-gauge-high"></i> {{ $t('dashboard.quickActions') }}</h2>
        </div>
        <div class="actions-grid">
          <router-link v-for="tile in quickActions" :key="tile.to" :to="tile.to" class="action-tile">
            <i :class="tile.icon"></i><span>{{ tile.label }}</span>
          </router-link>
        </div>
      </div>
    </template>

    <div v-else-if="error" class="alert alert-error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { reportApi } from '@/api'
import { MODULES, moduleByKey } from '@/config/modules'
import ProviderLogo from '@/components/ProviderLogo.vue'

const authStore = useAuthStore()
const { t } = useI18n()
// Dashboard payload, loading flag and error banner text.
const data = ref(null)
const loading = ref(false)
const error = ref('')

// Role-to-translation-key map used for the header role badge.
const ROLE_LABELS = {
  hotel_admin: 'common.roles.hotelAdmin',
  manager: 'common.roles.manager',
  accountant: 'common.roles.accountant',
  receptionist: 'common.roles.receptionist',
  procurement_officer: 'common.roles.procurementOfficer',
  housekeeping: 'common.roles.housekeeping',
  kitchen: 'common.roles.kitchen',
  waiter: 'common.roles.waiterBartender',
  bartender: 'common.roles.waiterBartender',
  staff: 'nav.staff',
}

// Derived header values: the tenant hotel name and the user's role label.
const hotelName = computed(() => authStore.user?.tenant?.hotel_name || 'MRK Hotels')
const roleLabel = computed(() => {
  const key = ROLE_LABELS[authStore.user?.user_role]
  return key ? t(key) : t('nav.staff')
})

// Room status keys displayed on the dashboard card.
const roomStatusItems = { total: 'total', available: 'available', occupied: 'occupied', cleaning: 'cleaning', maintenance: 'maintenance' }

// Permission flags controlling the "view all" links.
const canSeeRooms = computed(() => authStore.canAccess(moduleByKey('rooms')))
const canSeePayments = computed(() => authStore.canAccess(moduleByKey('payments')))

// Payment status-to-translation-key map.
const PAYMENT_STATUS_LABELS = {
  pending: 'payments.statusPending',
  awaiting_confirmation: 'payments.statusAwaiting',
  completed: 'payments.statusCompleted',
  failed: 'payments.statusFailed',
  refunded: 'payments.statusRefunded',
}

/** Resolves a payment status to its translated display label. */
function statusLabel(status) {
  const key = PAYMENT_STATUS_LABELS[status]
  return key ? t(key) : status
}

/** Returns the CSS badge class for a payment status. */
function statusBadge(status) {
  const map = { pending: 'badge-warning', awaiting_confirmation: 'badge-info', completed: 'badge-success', failed: 'badge-danger', refunded: 'badge-secondary' }
  return map[status] || 'badge-secondary'
}

/** Formats a timestamp as a localized day/time string, or an em dash when absent. */
function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Builds the quick-action tiles from the modules the user is allowed to access. */
const quickActions = computed(() =>
  MODULES.filter((m) => m.to !== '/app' && m.to !== '/app/profile' && authStore.canAccess(m)).map((m) => ({
    label: t(m.labelKey),
    icon: m.icon,
    to: m.to,
  })),
)

/** Fetches the dashboard payload from the API, showing errors via the error banner. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await reportApi.dashboard()
    data.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('dashboard.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.dashboard-page {
  padding: 32px 20px;
}

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.dash-header h1 {
  font-size: 28px;
  font-weight: 800;
}

.dash-header p {
  color: #777;
  font-size: 15px;
  margin-top: 4px;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fef5f5;
  color: #005EB8;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: #fef5f5;
  color: #005EB8;
  flex-shrink: 0;
}

.stat-icon.checkin {
  background: #eaf4ff;
  color: #2980b9;
}

.stat-icon.checkout {
  background: #fef9e7;
  color: #005EB8;
}

.stat-icon.bookings {
  background: #eafaf1;
  color: #27ae60;
}

.stat-icon.revenue {
  background: #eaf4ff;
  color: #2980b9;
}

.stat-icon.occupancy {
  background: #fef9e7;
  color: #005EB8;
}

.stat-icon.issues {
  background: #f4eaff;
  color: #7d3c98;
}

.stat-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #333;
}

.stat-label {
  font-size: 13px;
  color: #888;
}

.dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.dash-section {
  padding: 24px;
}

.dash-section h2 {
  font-size: 17px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dash-section h2 i {
  color: #005EB8;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header-row h2 {
  margin-bottom: 0;
}

.view-all-link {
  font-size: 13px;
  color: #005EB8;
  text-decoration: none;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.2s;
}

.view-all-link:hover {
  opacity: 0.8;
}

.room-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.room-status-item {
  background: #fafafa;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #bbb;
}

.room-status-dot.total {
  background: #6c757d;
}

.room-status-dot.available {
  background: #27ae60;
}

.room-status-dot.occupied {
  background: #005EB8;
}

.room-status-dot.cleaning {
  background: #005EB8;
}

.room-status-dot.maintenance {
  background: #7f8c8d;
}

.room-status-label {
  font-size: 12px;
  text-transform: capitalize;
  color: #888;
}

.room-status-value {
  font-size: 20px;
  font-weight: 700;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
}

.list-item:last-child {
  border-bottom: none;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.recent-payments-list {
  display: flex;
  flex-direction: column;
}

.payment-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
}

.payment-row:last-child {
  border-bottom: none;
}

.payment-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.payment-meta {
  font-size: 12px;
  color: #888;
  text-transform: capitalize;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.payment-amount {
  font-weight: 600;
  white-space: nowrap;
}

.muted {
  color: #888;
}

.badge-warning { background: #fff3cd; color: #856404; }
.badge-info { background: #d1ecf1; color: #0c5460; }
.badge-success { background: #d4edda; color: #155724; }
.badge-danger { background: #f8d7da; color: #721c24; }
.badge-secondary { background: #e2e3e5; color: #383d41; }

.action-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 16px;
  border: 1px solid #eee;
  border-radius: 8px;
  text-decoration: none;
  color: #333;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  background: #fff;
}

.action-tile i {
  font-size: 24px;
  color: #005EB8;
}

.action-tile:hover {
  border-color: #005EB8;
  background: #fef5f5;
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 20px 16px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 14px;
  }

  .stat-card > div {
    min-width: 0;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  .stat-value {
    font-size: 20px;
  }

  .stat-label {
    font-size: 11px;
  }

  .dash-grid {
    grid-template-columns: 1fr;
  }

  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
