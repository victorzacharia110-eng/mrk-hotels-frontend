<!--
  Owner dashboard (route: /owner, name: owner-dashboard).
  Portfolio overview for a hotel owner: KPI cards aggregated across all their
  hotels and a per-hotel comparison table with a shortcut into each staff panel.
-->
<template>
  <div class="dashboard-page">
    <!-- Page header with the owner role badge -->
    <div class="dash-header">
      <div>
        <h1>{{ $t('owner.dashboardTitle') }}</h1>
        <p>{{ $t('owner.dashboardSubtitle') }}</p>
      </div>
      <span class="role-badge"><i class="fas fa-crown"></i> {{ $t('owner.title') }}</span>
    </div>

    <!-- Error and loading feedback while the dashboard is being fetched -->
    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="loading" class="loading-spinner"><div class="spinner"></div></div>

    <!-- Rendered only once the dashboard data has arrived -->
    <template v-else-if="data">
      <!-- Top: owner portfolio figures represented as stay-view style bars -->
      <div class="card sv-card">
        <div class="sv-card-head"><h2><i class="fas fa-hotel"></i> {{ $t('owner.dashboardTitle') }}</h2></div>
        <div class="sv-bar-row">
          <span class="sv-row-label"><i class="fas fa-building"></i> {{ $t('owner.myHotels') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-blue" :style="{ width: pctOf(data.hotels_total, data.hotels_total) + '%' }">
              <span class="sv-bar-label">{{ data.hotels_total }}</span>
            </div>
          </div>
        </div>
        <div class="sv-bar-row">
          <span class="sv-row-label"><i class="fas fa-dollar-sign"></i> {{ $t('owner.revenue30d') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-green" :style="{ width: pctOf(data.revenue_30_days, data.revenue_total) + '%' }">
              <span class="sv-bar-label">TZS {{ data.revenue_30_days.toLocaleString() }}</span>
            </div>
          </div>
        </div>
        <div class="sv-bar-row">
          <span class="sv-row-label"><i class="fas fa-percent"></i> {{ $t('owner.avgOccupancy') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-blue" :style="{ width: Math.min(100, Number(data.avg_occupancy) || 0) + '%' }">
              <span class="sv-bar-label">{{ data.avg_occupancy }}%</span>
            </div>
          </div>
        </div>
        <div class="sv-bar-row">
          <span class="sv-row-label"><i class="fas fa-users"></i> {{ $t('owner.guestsInHouse') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-green" :style="{ width: pctOf(data.guests_in_house, data.rooms_total) + '%' }">
              <span class="sv-bar-label">{{ data.guests_in_house }}</span>
            </div>
          </div>
        </div>
        <div class="sv-bar-row">
          <span class="sv-row-label"><i class="fas fa-calendar-check"></i> {{ $t('owner.activeReservations') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-green" :style="{ width: pctOf(data.active_reservations, data.rooms_total) + '%' }">
              <span class="sv-bar-label">{{ data.active_reservations }}</span>
            </div>
          </div>
        </div>
        <div class="sv-bar-row">
          <span class="sv-row-label"><i class="fas fa-door-open"></i> {{ $t('owner.roomsTotal') }}</span>
          <div class="sv-track">
            <div class="sv-bar bar-blue" :style="{ width: pctOf(data.rooms_total, data.rooms_total) + '%' }">
              <span class="sv-bar-label">{{ data.rooms_total }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom: the owner's admin-style overview (KPIs + per-hotel comparison) -->
      <div class="owner-overview">
        <!-- KPI cards summarising the owner's hotel portfolio -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon"><i class="fas fa-hotel"></i></div>
            <div>
              <span class="stat-value">{{ data.hotels_total }}</span
              ><span class="stat-label">{{ $t('owner.myHotels') }}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon revenue"><i class="fas fa-dollar-sign"></i></div>
            <div>
              <span class="stat-value">TZS {{ data.revenue_30_days.toLocaleString() }}</span
              ><span class="stat-label">{{ $t('owner.revenue30d') }}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon active"><i class="fas fa-bed"></i></div>
            <div>
              <span class="stat-value">{{ data.avg_occupancy }}%</span
              ><span class="stat-label">{{ $t('owner.avgOccupancy') }}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon guests"><i class="fas fa-users"></i></div>
            <div>
              <span class="stat-value">{{ data.guests_in_house }}</span
              ><span class="stat-label">{{ $t('owner.guestsInHouse') }}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon bookings"><i class="fas fa-calendar-check"></i></div>
            <div>
              <span class="stat-value">{{ data.active_reservations }}</span
              ><span class="stat-label">{{ $t('owner.activeReservations') }}</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon rooms"><i class="fas fa-door-open"></i></div>
            <div>
              <span class="stat-value">{{ data.rooms_total }}</span
              ><span class="stat-label">{{ $t('owner.roomsTotal') }}</span>
            </div>
          </div>
        </div>

        <!-- Side-by-side comparison of every hotel the owner manages -->
        <div class="card">
          <div class="card-head-row">
            <h2 class="card-title">
              <i class="fas fa-building"></i> {{ $t('owner.hotelsComparison') }}
            </h2>
            <TableExportButton
              filename="owner-hotels"
              :title="$t('owner.hotelsComparison')"
              :rows="data.hotels"
            />
          </div>
          <div class="table-scroll">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">{{ $t('owner.hotel') }}</th>
                  <th scope="col">{{ $t('owner.location') }}</th>
                  <th scope="col">{{ $t('owner.rooms') }}</th>
                  <th scope="col">{{ $t('owner.occupancy') }}</th>
                  <th scope="col">{{ $t('owner.guestsInHouse') }}</th>
                  <th scope="col">{{ $t('owner.activeReservations') }}</th>
                  <th scope="col" class="num">TZS · {{ $t('owner.revenue30d') }}</th>
                  <th scope="col" class="num">TZS · {{ $t('owner.revenueTotal') }}</th>
                  <th scope="col">{{ $t('owner.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in data.hotels" :key="h.tenant_id">
                  <td>
                    <router-link
                      :to="{ name: 'owner-hotel-detail', params: { id: h.tenant_id } }"
                      class="hotel-link"
                    >
                      {{ h.hotel_name }}
                    </router-link>
                  </td>
                  <td>{{ [h.city, h.country].filter(Boolean).join(', ') || '—' }}</td>
                  <td>{{ h.rooms }}</td>
                  <td>{{ h.occupancy_rate }}%</td>
                  <td>{{ h.guests_in_house }}</td>
                  <td>{{ h.active_reservations }}</td>
                  <td class="num">{{ h.revenue_30_days.toLocaleString() }}</td>
                  <td class="num">{{ h.revenue_total.toLocaleString() }}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary" @click="openPanel(h)">
                      <i class="fas fa-arrow-up-right-from-square"></i> {{ $t('owner.viewPanel') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="!data.hotels.length" class="empty-mini">
            <i class="fas fa-hotel"></i> {{ $t('owner.noHotels') }}
          </p>
        </div>
      </div>
    </template>

    <!-- Dashboard alert modal for urgent notifications -->
    <AlertModal
      v-if="currentAlert"
      :show="true"
      :title="currentAlert.title"
      :body="currentAlert.body"
      :details="alertDetails"
      :timestamp="currentAlert.created_at"
      :type="alertType"
      @dismiss="dismissCurrentAlert"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ownerApi } from '@/api'
import { useNotificationStore } from '@/stores/notifications'
import TableExportButton from '@/components/TableExportButton.vue'
import AlertModal from '@/components/AlertModal.vue'
import { setOwnerHotel } from '@/utils/ownerView'

const router = useRouter()
const { t } = useI18n()
const notifStore = useNotificationStore()
const data = ref(null)
const loading = ref(false)
const error = ref('')

/**
 * Remembers the chosen hotel in localStorage so the app panel opens in its
 * context, then routes into the management app.
 * @param {Object} hotel - The hotel row from the dashboard comparison table.
 */
function openPanel(hotel) {
  setOwnerHotel(hotel.tenant_id, hotel.hotel_name)
  // The owner browses a hotel's panel with hotel_admin-level visibility, whose
  // landing is the operational overview. Navigating to bare /app would hit the
  // stay-view dashboard module gate (front-desk roles only) and bounce the
  // owner straight back to /owner.
  router.push('/app/overview')
}

/** Normalized percentage of a part over its whole, for the bar widths. */
function pctOf(part, whole) {
  const w = Number(whole) || 0
  if (w <= 0) return part ? 6 : 0
  return Math.max(4, Math.min(100, ((Number(part) || 0) / w) * 100))
}

/** Fetches the owner dashboard summary from the API and exposes it in `data`. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await ownerApi.dashboard()
    data.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('owner.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  notifStore.fetchAlerts()
})

/** Alert modal logic. */
const currentAlert = computed(() => notifStore.alerts[0] || null)
const alertType = computed(() => {
  if (!currentAlert.value) return 'info'
  switch (currentAlert.value.type) {
    case 'payment_awaiting_confirmation': return 'payment'
    case 'reservation_new': return 'reservation'
    case 'booking_requisition_new': return 'approval'
    case 'purchase_requisition_pending': return 'approval'
    case 'purchase_order_pending': return 'approval'
    default: return 'info'
  }
})
const alertDetails = computed(() => {
  if (!currentAlert.value?.data) return []
  const d = currentAlert.value.data
  const details = []
  if (d.guest_name) details.push({ label: t('guests.guestName'), value: d.guest_name })
  if (d.amount) details.push({ label: t('payments.amount'), value: `TZS ${Number(d.amount).toLocaleString()}` })
  if (d.provider) details.push({ label: t('payments.provider'), value: d.provider })
  if (d.requested_by) details.push({ label: 'Requested by', value: d.requested_by })
  if (d.ordered_by) details.push({ label: 'Ordered by', value: d.ordered_by })
  if (d.requisition_number) details.push({ label: t('bookingRequisitions.requisitionNumber'), value: d.requisition_number })
  return details
})
function dismissCurrentAlert() {
  if (currentAlert.value) notifStore.dismissAlert(currentAlert.value.id)
}
</script>

<style scoped>
.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.dash-header h1 {
  font-size: 26px;
  font-weight: 800;
}

.dash-header p {
  color: #6f6f6f;
  font-size: 14px;
  margin-top: 4px;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fef5f5;
  color: #005eb8;
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
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: #fef5f5;
  color: #005eb8;
  flex-shrink: 0;
}

.stat-icon.revenue {
  background: #eafaf1;
  color: #1e8449;
}
.stat-icon.active {
  background: #eaf4ff;
  color: #1f6ea8;
}
.stat-icon.guests {
  background: #f5f0ff;
  color: #8e44ad;
}
.stat-icon.bookings {
  background: #fef9e7;
  color: #856f00;
}
.stat-icon.rooms {
  background: #fdecea;
  color: #c0392b;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.stat-label {
  font-size: 12px;
  color: #757575;
}

.card-title {
  font-size: 17px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title i {
  color: #005eb8;
}

.card-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.card-head-row .card-title {
  margin-bottom: 0;
}

.hotel-link {
  font-weight: 600;
  color: #005eb8;
}

.num {
  text-align: right;
}

.empty-mini {
  text-align: center;
  padding: 32px 16px;
  color: #757575;
  font-size: 14px;
}

.empty-mini i {
  font-size: 28px;
  color: #ddd;
  margin-bottom: 12px;
  display: block;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 14px;
  }

  .sv-bar-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}

/* ------- Stay-view style bars ------- */
.sv-card {
  padding: 22px 24px;
  margin-bottom: 24px;
}

.sv-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.sv-card-head h2 {
  font-size: 17px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sv-card-head h2 i {
  color: #005eb8;
}

.sv-bar-row {
  display: grid;
  grid-template-columns: 240px 1fr;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}

.sv-row-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #444;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-row-label i {
  color: #005eb8;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.sv-track {
  height: 30px;
  background: #f0f2f5;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.sv-track .sv-bar {
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  overflow: hidden;
  white-space: nowrap;
  min-width: 44px;
  animation: sv-bar-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  transition: filter 0.2s ease;
}

.sv-track .sv-bar:hover {
  filter: brightness(0.92);
}

.sv-track .sv-bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-bar.bar-green { background: #28c76f; }
.sv-bar.bar-red { background: #ff6b6b; }
.sv-bar.bar-blue { background: #3b82f6; }

@keyframes sv-bar-in {
  from {
    opacity: 0;
    transform: translateX(-10px) scaleX(0.85);
  }
  to {
    opacity: 1;
    transform: translateX(0) scaleX(1);
  }
}
</style>
