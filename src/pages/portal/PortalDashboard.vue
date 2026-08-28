<!--
  PortalDashboard — customer's home dashboard after login.
  Shows subscription status, trial countdown, real KPIs, revenue chart, quick links.
-->
<template>
  <div class="portal-dashboard">
    <div v-if="loading" class="loading-spinner"><div class="spinner"></div></div>
    <template v-else>
      <!-- Trial banner -->
      <div v-if="isTrial" class="trial-banner">
        <div class="trial-banner-content">
          <i class="fas fa-clock"></i>
          <div>
            <strong>Trial Period</strong>
            <p>You have <strong>{{ trialDaysLeft }}</strong> days remaining on your {{ planLabel }} plan trial.</p>
          </div>
        </div>
        <router-link to="/portal/subscription" class="btn btn-sm btn-primary">Upgrade Now</router-link>
      </div>

      <!-- KPI cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon--blue"><i class="fas fa-door-open"></i></div>
          <div class="kpi-body">
            <span class="kpi-value">{{ analytics.rooms?.total || 0 }}</span>
            <span class="kpi-label">Total Rooms</span>
            <span v-if="analytics.rooms?.total > 0" class="kpi-sub">{{ analytics.rooms.occupancy_rate }}% occupied</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon--green"><i class="fas fa-calendar-check"></i></div>
          <div class="kpi-body">
            <span class="kpi-value">{{ analytics.reservations?.last_30_days || 0 }}</span>
            <span class="kpi-label">Reservations (30d)</span>
            <span v-if="analytics.reservations?.trend" class="kpi-sub" :class="analytics.reservations.trend > 0 ? 'trend-up' : 'trend-down'">
              <i :class="analytics.reservations.trend > 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i>
              {{ Math.abs(analytics.reservations.trend) }}% vs prev
            </span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon--purple"><i class="fas fa-users"></i></div>
          <div class="kpi-body">
            <span class="kpi-value">{{ analytics.guests?.last_30_days || 0 }}</span>
            <span class="kpi-label">Guests (30d)</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon kpi-icon--amber"><i class="fas fa-money-bill"></i></div>
          <div class="kpi-body">
            <span class="kpi-value">TZS {{ formatAmount(analytics.revenue?.last_30_days) }}</span>
            <span class="kpi-label">Revenue (30d)</span>
            <span v-if="analytics.revenue?.trend" class="kpi-sub" :class="analytics.revenue.trend > 0 ? 'trend-up' : 'trend-down'">
              <i :class="analytics.revenue.trend > 0 ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i>
              {{ Math.abs(analytics.revenue.trend) }}% vs prev
            </span>
          </div>
        </div>
      </div>

      <!-- Revenue chart -->
      <div v-if="analytics.monthly_revenue?.length" class="card">
        <h2 class="card-title"><i class="fas fa-chart-bar"></i> Revenue Trend (6 months)</h2>
        <div class="chart">
          <div v-for="(item, i) in analytics.monthly_revenue" :key="i" class="chart-bar-wrap">
            <div class="chart-bar" :style="{ height: barHeight(item.amount) + '%' }">
              <span class="chart-value">TZS {{ formatAmount(item.amount) }}</span>
            </div>
            <span class="chart-label">{{ item.month.split(' ')[0] }}</span>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="card">
        <h2 class="card-title"><i class="fas fa-bolt"></i> Quick Actions</h2>
        <div class="quick-actions">
          <router-link to="/portal/payments" class="action-tile">
            <i class="fas fa-credit-card"></i>
            <span>Payments</span>
          </router-link>
          <router-link to="/portal/staff" class="action-tile">
            <i class="fas fa-user-gear"></i>
            <span>Staff</span>
          </router-link>
          <router-link to="/portal/subscription" class="action-tile">
            <i class="fas fa-crown"></i>
            <span>Subscription</span>
          </router-link>
          <router-link to="/portal/notifications" class="action-tile">
            <i class="fas fa-bell"></i>
            <span>Notifications</span>
          </router-link>
        </div>
      </div>

      <!-- Account info -->
      <div class="card">
        <h2 class="card-title"><i class="fas fa-info-circle"></i> Account Info</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Hotel</span>
            <span class="info-value">{{ tenant?.hotel_name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Plan</span>
            <span class="info-value plan-badge" :class="`plan-badge--${tenant?.subscription_plan}`">{{ tenant?.subscription_plan }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Status</span>
            <span class="info-value"><span class="status-dot" :class="`status-dot--${tenant?.status}`"></span>{{ tenant?.status }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Subdomain</span>
            <span class="info-value">{{ tenant?.subdomain }}.tscl.app</span>
          </div>
          <div v-if="tenant?.trial_ends_at" class="info-item">
            <span class="info-label">Trial Expires</span>
            <span class="info-value">{{ new Date(tenant.trial_ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { hotelSettingsApi, portalAnalyticsApi } from '@/api'

const authStore = useAuthStore()
const loading = ref(true)
const analytics = ref({})
const tenant = ref(null)

const isTrial = computed(() => tenant.value?.subscription_status === 'trial')
const planLabel = computed(() => {
  const labels = { starter: 'Starter', growth: 'Growth', enterprise: 'Enterprise', trial: 'Trial' }
  return labels[tenant.value?.subscription_plan] || tenant.value?.subscription_plan
})
const trialDaysLeft = computed(() => {
  if (!tenant.value?.trial_ends_at) return 0
  const diff = new Date(tenant.value.trial_ends_at) - new Date()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
})

function formatAmount(val) {
  return Number(val || 0).toLocaleString()
}

function barHeight(amount) {
  const max = Math.max(...(analytics.value.monthly_revenue || []).map(m => m.amount), 1)
  return Math.max(5, (amount / max) * 100)
}

onMounted(async () => {
  try {
    tenant.value = authStore.user?.tenant
    try {
      const { data } = await hotelSettingsApi.show()
      tenant.value = { ...tenant.value, ...data.hotel }
    } catch {
      // settings are optional on the dashboard
    }
    try {
      const { data } = await portalAnalyticsApi.overview()
      analytics.value = data
    } catch {
      // analytics are optional on the dashboard
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.portal-dashboard { max-width: 1100px; }

/* Trial banner */
.trial-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%);
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 24px;
}
.trial-banner-content { display: flex; align-items: center; gap: 12px; }
.trial-banner-content > i { font-size: 24px; color: #3b82f6; }
.trial-banner-content strong { color: #1e293b; }
.trial-banner-content p { margin: 2px 0 0; font-size: 13px; color: #64748b; }

/* KPI grid */
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.kpi-card { display: flex; align-items: center; gap: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
.kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.kpi-icon--blue { background: #dbeafe; color: #2563eb; }
.kpi-icon--green { background: #d1fae5; color: #059669; }
.kpi-icon--purple { background: #ede9fe; color: #7c3aed; }
.kpi-icon--amber { background: #fef3c7; color: #d97706; }
.kpi-value { display: block; font-size: 22px; font-weight: 800; color: #1e293b; line-height: 1; }
.kpi-label { display: block; font-size: 12px; color: #64748b; margin-top: 4px; }
.kpi-sub { display: block; font-size: 11px; margin-top: 2px; }
.trend-up { color: #059669; }
.trend-down { color: #dc2626; }

/* Revenue chart */
.chart { display: flex; align-items: flex-end; gap: 12px; height: 180px; padding: 0 8px; }
.chart-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
.chart-bar { width: 100%; background: linear-gradient(180deg, #3b82f6, #60a5fa); border-radius: 6px 6px 0 0; min-height: 4px; position: relative; transition: height 0.3s; display: flex; align-items: flex-start; justify-content: center; }
.chart-value { position: absolute; top: -20px; font-size: 10px; font-weight: 600; color: #64748b; white-space: nowrap; }
.chart-label { font-size: 11px; color: #94a3b8; margin-top: 6px; font-weight: 500; }

/* Cards */
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.card-title { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 16px; display: flex; align-items: center; gap: 8px; }
.card-title i { color: #3b82f6; }

/* Quick actions */
.quick-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.action-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  text-decoration: none;
  color: #334155;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
}
.action-tile:hover { border-color: #3b82f6; background: #eff6ff; }
.action-tile i { font-size: 20px; color: #3b82f6; }

/* Info grid */
.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.info-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; margin-bottom: 4px; }
.info-value { font-size: 14px; color: #1e293b; font-weight: 500; display: flex; align-items: center; gap: 6px; }

.plan-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: capitalize; }
.plan-badge--starter { background: #dbeafe; color: #2563eb; }
.plan-badge--growth { background: #d1fae5; color: #059669; }
.plan-badge--enterprise { background: #ede9fe; color: #7c3aed; }
.plan-badge--trial { background: #fef3c7; color: #d97706; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; }
.status-dot--active { background: #10b981; }
.status-dot--pending { background: #f59e0b; }
.status-dot--suspended { background: #ef4444; }

.loading-spinner { display: flex; justify-content: center; padding: 80px 20px; }
.spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .quick-actions { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 600px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .quick-actions { grid-template-columns: repeat(2, 1fr); }
  .trial-banner { flex-direction: column; gap: 12px; text-align: center; }
}
</style>
