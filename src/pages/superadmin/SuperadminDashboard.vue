<!--
  Superadmin dashboard (route: /superadmin, name: superadmin-dashboard).
  Platform-wide overview: tenant KPIs, SaaS business metrics (MRR/ARR, trials,
  conversion), a monthly GMV bar chart, expiring trials and recent signups.
-->
<template>
  <div class="dashboard-page container">
    <div v-if="loading" class="loading-spinner">
      <div class="spinner"></div>
    </div>

    <!-- Rendered once the dashboard data has arrived -->
    <template v-else-if="data">
      <div class="dash-header">
        <div>
          <h1>{{ $t('superadmin.dashboardTitle') }}</h1>
          <p>{{ $t('superadmin.dashboardSubtitle') }}</p>
        </div>
        <span class="role-badge"><i class="fas fa-shield-halved"></i> {{ $t('superadmin.title') }}</span>
      </div>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <!-- Top-level KPI cards: tenant counts, GMV and subscription health -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-hotel"></i></div>
          <div><span class="stat-value">{{ data.tenants.total }}</span><span class="stat-label">{{
            $t('superadmin.totalTenants') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon active"><i class="fas fa-check-circle"></i></div>
          <div><span class="stat-value">{{ data.tenants.active }}</span><span class="stat-label">{{
            $t('superadmin.statusActive') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon pending"><i class="fas fa-clock"></i></div>
          <div><span class="stat-value">{{ data.tenants.pending_approvals }}</span><span class="stat-label">{{
            $t('superadmin.pendingApprovals') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon suspended"><i class="fas fa-ban"></i></div>
          <div><span class="stat-value">{{ data.tenants.suspended }}</span><span class="stat-label">{{
            $t('superadmin.statusSuspended') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon revenue"><i class="fas fa-dollar-sign"></i></div>
          <div><span class="stat-value">TZS {{ data.revenue_last_30_days.toLocaleString() }}</span><span
              class="stat-label">{{ $t('superadmin.gmv30d') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon trials"><i class="fas fa-hourglass-half"></i></div>
          <div><span class="stat-value">{{ data.subscriptions.trials_expiring_7_days }}</span><span
              class="stat-label">{{ $t('superadmin.trialsExpiring') }}</span></div>
        </div>
      </div>

      <!-- SaaS business metrics, only shown when the report provides them -->
      <template v-if="data.saas">
        <h2 class="saas-title"><i class="fas fa-chart-line"></i> {{ $t('superadmin.saasBusiness') }}</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon mrr"><i class="fas fa-money-bill-wave"></i></div>
            <div><span class="stat-value">{{ data.saas.currency }} {{ data.saas.mrr.toLocaleString() }}</span><span
                class="stat-label">{{ $t('superadmin.mrr') }}</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon arr"><i class="fas fa-sack-dollar"></i></div>
            <div><span class="stat-value">{{ data.saas.currency }} {{ data.saas.arr.toLocaleString() }}</span><span
                class="stat-label">{{ $t('superadmin.arr') }}</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon active"><i class="fas fa-credit-card"></i></div>
            <div><span class="stat-value">{{ data.saas.paying_hotels }}</span><span class="stat-label">{{
              $t('superadmin.payingHotels') }}</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon signups"><i class="fas fa-user-plus"></i></div>
            <div><span class="stat-value">{{ data.saas.new_signups_30d }}</span><span class="stat-label">{{
              $t('superadmin.newSignups30d') }}</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon trials"><i class="fas fa-stopwatch"></i></div>
            <div><span class="stat-value">{{ data.saas.active_trials }}</span><span class="stat-label">{{
              $t('superadmin.activeTrials') }}</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon conversion"><i class="fas fa-filter-circle-dollar"></i></div>
            <div><span class="stat-value">{{ data.saas.conversion_rate }}%</span><span class="stat-label">{{
              $t('superadmin.conversionRate') }}</span></div>
          </div>
        </div>

        <div class="dash-grid">
        <!-- Monthly GMV trend rendered as proportional horizontal bars -->
        <div class="card dash-section">
          <h2><i class="fas fa-chart-column"></i> {{ $t('superadmin.gmvTitle') }}</h2>
            <p class="muted small-hint">{{ $t('superadmin.gmvHint') }}</p>
            <div class="bars">
              <div v-for="m in data.saas.monthly_gmv" :key="m.month" class="bar-row">
                <span class="bar-label">{{ m.month }}</span>
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: barWidth(m.total) }"></div>
                </div>
                <span class="bar-value">{{ formatCompact(m.total) }}</span>
              </div>
            </div>
          </div>

          <!-- Trials ending soon, each linking to its tenant detail page -->
          <div class="card dash-section">
            <h2><i class="fas fa-hourglass-half"></i> {{ $t('superadmin.trialsExpiringTitle') }}</h2>
            <template v-if="data.saas.trials_expiring.length">
              <div v-for="tenant in data.saas.trials_expiring" :key="tenant.tenant_id" class="list-item">
                <div>
                  <router-link :to="{ name: 'superadmin-tenant-detail', params: { id: tenant.tenant_id } }"
                    class="tenant-link">
                    {{ tenant.hotel_name }}
                  </router-link>
                  <span class="muted">{{ $t('superadmin.trialEndsOn') }} {{ new Date(tenant.trial_ends_at).toLocaleDateString() }}</span>
                </div>
              </div>
            </template>
            <p v-else class="empty-mini"><i class="fas fa-circle-check"></i> {{ $t('superadmin.noTrialsExpiring') }}</p>
          </div>
        </div>
      </template>

      <div class="dash-grid">
        <!-- Platform-wide aggregates: users, rooms and active subscriptions -->
        <div class="card dash-section">
          <h2><i class="fas fa-globe"></i> {{ $t('superadmin.platform') }}</h2>
          <div class="list-item">
            <div><strong>{{ data.users_total }}</strong> {{ $t('superadmin.users') }}</div>
          </div>
          <div class="list-item">
            <div><strong>{{ data.rooms_total }}</strong> {{ $t('superadmin.rooms') }}</div>
          </div>
          <div class="list-item">
            <div><strong>{{ data.subscriptions.active_subscriptions }}</strong> {{ $t('superadmin.activeSubscriptions')
              }}</div>
          </div>
        </div>

        <!-- Most recently registered hotels with quick links into their detail pages -->
        <div class="card dash-section">
          <div class="section-header-row">
            <h2><i class="fas fa-building-circle-arrow-right"></i> {{ $t('superadmin.recentHotels') }}</h2>
            <router-link to="/superadmin/tenants" class="view-all-link">{{ $t('superadmin.manageHotels') }} <i
                class="fas fa-arrow-right"></i></router-link>
          </div>
          <div v-for="tenant in data.recent_registrations" :key="tenant.tenant_id" class="list-item">
            <div>
              <router-link :to="{ name: 'superadmin-tenant-detail', params: { id: tenant.tenant_id } }"
                class="tenant-link">
                {{ tenant.hotel_name }}
              </router-link>
              <span class="muted">{{ tenant.city || '—' }}</span>
            </div>
            <span class="badge" :class="statusBadge(tenant.status)">{{ tenant.status }}</span>
            <span class="item-price">{{ tenant.subscription_plan }}</span>
          </div>
          <p v-if="!data.recent_registrations?.length" class="empty-mini"><i class="fas fa-hotel"></i> {{
            $t('superadmin.emptyHotels') }}</p>
        </div>
      </div>
    </template>

    <div v-else-if="error" class="alert alert-error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { superadminReportApi } from '@/api'

const { t } = useI18n()
const data = ref(null)
const loading = ref(false)
const error = ref('')

// Largest monthly GMV figure, used to scale all the bars in the chart.
const maxGmv = computed(() =>
  Math.max(1, ...(data.value?.saas?.monthly_gmv?.map((m) => m.total) || [1])),
)

/**
 * Converts a monthly total into a bar width percentage relative to the largest month.
 * @param {number} total - The month's GMV total.
 * @returns {string} A CSS width percentage (minimum 2% so small bars stay visible).
 */
function barWidth(total) {
  return `${Math.max(2, Math.round((total / maxGmv.value) * 100))}%`
}

/**
 * Shortens large amounts for display, e.g. 1.5M or 20K.
 * @param {number} n - The raw amount.
 * @returns {string} The compact label.
 */
function formatCompact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

/**
 * Maps a tenant status to the CSS class used for its badge colour.
 * @param {string} status - The tenant status (active, pending, suspended, rejected).
 * @returns {string} The badge CSS class.
 */
function statusBadge(status) {
  const map = { active: 'badge-green', pending: 'badge-yellow', suspended: 'badge-red', rejected: 'badge-red' }
  return map[status] || 'badge-gray'
}

/** Fetches the superadmin dashboard report and exposes it in `data`. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await superadminReportApi.dashboard()
    data.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.dashboardLoadError')
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

.stat-icon.active {
  background: #eafaf1;
  color: #27ae60;
}

.stat-icon.pending {
  background: #fef9e7;
  color: #005EB8;
}

.stat-icon.suspended {
  background: #fdecea;
  color: #c0392b;
}

.stat-icon.revenue {
  background: #eaf4ff;
  color: #2980b9;
}

.stat-icon.trials {
  background: #f5f0ff;
  color: #8e44ad;
}

.stat-icon.mrr {
  background: #eafaf1;
  color: #1e8449;
}

.stat-icon.arr {
  background: #fdf2e9;
  color: #b9770e;
}

.stat-icon.signups {
  background: #eaf4ff;
  color: #2980b9;
}

.stat-icon.conversion {
  background: #fdecea;
  color: #c0392b;
}

.saas-title {
  font-size: 18px;
  margin: 8px 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.saas-title i {
  color: #005eb8;
}

.small-hint {
  font-size: 12px;
  margin: -8px 0 16px;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.bar-label {
  width: 64px;
  color: #888;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 14px;
  background: #f1f5f9;
  border-radius: 7px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: #005eb8;
  border-radius: 7px;
  min-width: 4px;
  transition: width 0.4s ease;
}

.bar-value {
  width: 70px;
  text-align: right;
  font-weight: 600;
  flex-shrink: 0;
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

.list-item .muted {
  display: block;
  font-size: 12px;
  color: #999;
}

.tenant-link {
  font-weight: 600;
  color: #005EB8;
}

.item-price {
  margin-left: auto;
  font-weight: 600;
  color: #005EB8;
  text-transform: capitalize;
}

.empty-mini {
  text-align: center;
  padding: 32px 16px;
  color: #999;
  font-size: 14px;
}

.empty-mini i {
  font-size: 28px;
  color: #ddd;
  margin-bottom: 12px;
  display: block;
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 20px 16px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .dash-grid {
    grid-template-columns: 1fr;
  }
}
</style>
