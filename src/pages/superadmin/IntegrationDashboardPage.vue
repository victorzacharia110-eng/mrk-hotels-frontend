<!--
  IntegrationDashboardPage.vue — Superadmin integration health overview.
  Shows connection status for Booking.com and QuickBooks across all hotels.
-->
<template>
  <div class="integration-dashboard container">
    <div class="dash-header">
      <div>
        <h1>Integration Status</h1>
        <p class="muted">Connection health across all hotels.</p>
      </div>
      <button class="btn btn-secondary" @click="load" :disabled="loading">
        <i class="fas fa-sync"></i> Refresh
      </button>
    </div>

    <div v-if="loading && !summary" class="loading-spinner"><div class="spinner"></div></div>
    <div v-else-if="error" class="alert alert-error">{{ error }}</div>

    <template v-else>
      <!-- Summary cards -->
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-icon summary-icon--blue"><i class="fas fa-hotel"></i></div>
          <div>
            <span class="summary-value">{{ summary.total_hotels }}</span>
            <span class="summary-label">Total Hotels</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-icon summary-icon--green"><i class="fas fa-calendar-check"></i></div>
          <div>
            <span class="summary-value">{{ summary.booking_com.connected }}</span>
            <span class="summary-label">Booking.com Connected</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-icon summary-icon--purple"><i class="fas fa-calculator"></i></div>
          <div>
            <span class="summary-value">{{ summary.quickbooks.connected }}</span>
            <span class="summary-label">QuickBooks Connected</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-icon summary-icon--cyan"><i class="fas fa-chart-line"></i></div>
          <div>
            <span class="summary-value">{{ summary.xero.connected }}</span>
            <span class="summary-label">Xero Connected</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-icon summary-icon--red"><i class="fas fa-exclamation-triangle"></i></div>
          <div>
            <span class="summary-value">{{ summary.booking_com.errors + summary.quickbooks.errors + summary.xero.errors }}</span>
            <span class="summary-label">Active Errors</span>
          </div>
        </div>
      </div>

      <!-- Hotels table -->
      <div class="card">
        <h2 class="card-title"><i class="fas fa-list"></i> All Hotels</h2>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Hotel</th>
                <th>Plan</th>
                <th>Status</th>
                <th class="col-integration">Booking.com</th>
                <th class="col-integration">QuickBooks</th>
                <th class="col-integration">Xero</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="hotel in hotels" :key="hotel.tenant_id">
                <td>
                  <strong>{{ hotel.hotel_name }}</strong>
                </td>
                <td>
                  <span class="plan-badge" :class="`plan-badge--${hotel.subscription_plan}`">
                    {{ hotel.subscription_plan }}
                  </span>
                </td>
                <td>
                  <span class="status-dot" :class="`status-dot--${hotel.status}`"></span>
                  {{ hotel.status }}
                </td>
                <td class="col-integration">
                  <IntegrationStatusCell :data="hotel.integrations.booking_com" name="Booking.com" />
                </td>
                <td class="col-integration">
                  <IntegrationStatusCell :data="hotel.integrations.quickbooks" name="QuickBooks" />
                </td>
                <td class="col-integration">
                  <IntegrationStatusCell :data="hotel.integrations.xero" name="Xero" />
                </td>
              </tr>
              <tr v-if="!hotels.length">
                <td colspan="6" class="empty-cell">No hotels found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { integrationDashboardApi } from '@/api'
import IntegrationStatusCell from '@/components/IntegrationStatusCell.vue'

const summary = ref(null)
const hotels = ref([])
const loading = ref(true)
const error = ref(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const { data } = await integrationDashboardApi.index()
    summary.value = data.summary
    hotels.value = data.hotels
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to load integration dashboard.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.integration-dashboard { padding: 32px 20px; }
.dash-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
.dash-header h1 { font-size: 28px; font-weight: 800; margin: 0 0 4px; }

/* Summary grid */
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 32px; }
.summary-card { display: flex; align-items: center; gap: 16px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
.summary-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.summary-icon--blue { background: #dbeafe; color: #2563eb; }
.summary-icon--green { background: #d1fae5; color: #059669; }
.summary-icon--purple { background: #ede9fe; color: #7c3aed; }
.summary-icon--cyan { background: #cffafe; color: #0891b2; }
.summary-icon--red { background: #fef2f2; color: #dc2626; }
.summary-value { display: block; font-size: 24px; font-weight: 800; color: #1e293b; line-height: 1; }
.summary-label { display: block; font-size: 12px; color: #64748b; margin-top: 4px; }

/* Table */
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
.data-table thead th { background: #f8fafc; font-weight: 600; color: #334155; }
.data-table tbody tr:hover { background: #f8fafc; }
.col-integration { min-width: 200px; }
.empty-cell { text-align: center; color: #94a3b8; padding: 32px 16px !important; }

.plan-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
.plan-badge--starter { background: #dbeafe; color: #2563eb; }
.plan-badge--growth { background: #d1fae5; color: #059669; }
.plan-badge--enterprise { background: #ede9fe; color: #7c3aed; }

.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
.status-dot--active { background: #10b981; }
.status-dot--pending { background: #f59e0b; }
.status-dot--suspended { background: #ef4444; }
.status-dot--inactive { background: #94a3b8; }

.alert-error { background: #fef2f2; color: #dc2626; padding: 12px 16px; border-radius: 8px; font-size: 14px; }
.loading-spinner { display: flex; justify-content: center; padding: 80px 20px; }
.spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) { .summary-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .summary-grid { grid-template-columns: 1fr; } }
</style>
