<template>
  <div class="dashboard-page">
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
      <!-- KPI cards summarising the owner's hotel portfolio -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-hotel"></i></div>
          <div><span class="stat-value">{{ data.hotels_total }}</span><span class="stat-label">{{ $t('owner.myHotels') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon revenue"><i class="fas fa-dollar-sign"></i></div>
          <div><span class="stat-value">TZS {{ data.revenue_30_days.toLocaleString() }}</span><span class="stat-label">{{ $t('owner.revenue30d') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon active"><i class="fas fa-bed"></i></div>
          <div><span class="stat-value">{{ data.avg_occupancy }}%</span><span class="stat-label">{{ $t('owner.avgOccupancy') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon guests"><i class="fas fa-users"></i></div>
          <div><span class="stat-value">{{ data.guests_in_house }}</span><span class="stat-label">{{ $t('owner.guestsInHouse') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bookings"><i class="fas fa-calendar-check"></i></div>
          <div><span class="stat-value">{{ data.active_reservations }}</span><span class="stat-label">{{ $t('owner.activeReservations') }}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon rooms"><i class="fas fa-door-open"></i></div>
          <div><span class="stat-value">{{ data.rooms_total }}</span><span class="stat-label">{{ $t('owner.roomsTotal') }}</span></div>
        </div>
      </div>

      <!-- Side-by-side comparison of every hotel the owner manages -->
      <div class="card">
        <h2 class="card-title"><i class="fas fa-building"></i> {{ $t('owner.hotelsComparison') }}</h2>
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>{{ $t('owner.hotel') }}</th>
                <th>{{ $t('owner.location') }}</th>
                <th>{{ $t('owner.rooms') }}</th>
                <th>{{ $t('owner.occupancy') }}</th>
                <th>{{ $t('owner.guestsInHouse') }}</th>
                <th>{{ $t('owner.activeReservations') }}</th>
                <th class="num">TZS · {{ $t('owner.revenue30d') }}</th>
                <th class="num">TZS · {{ $t('owner.revenueTotal') }}</th>
                <th>{{ $t('owner.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in data.hotels" :key="h.tenant_id">
                <td>
                  <router-link :to="{ name: 'owner-hotel-detail', params: { id: h.tenant_id } }" class="hotel-link">
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
        <p v-if="!data.hotels.length" class="empty-mini"><i class="fas fa-hotel"></i> {{ $t('owner.noHotels') }}</p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ownerApi } from '@/api'
import { setOwnerHotel } from '@/utils/ownerView'

const router = useRouter()
const { t } = useI18n()
const data = ref(null)
const loading = ref(false)
const error = ref('')

// Remembers the chosen hotel in localStorage so the app panel opens in its
// context, then routes into the management app.
function openPanel(hotel) {
  setOwnerHotel(hotel.tenant_id, hotel.hotel_name)
  router.push('/app')
}

// Fetches the owner dashboard summary from the API and exposes it in `data`.
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

onMounted(load)
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
  color: #777;
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

.stat-icon.revenue { background: #eafaf1; color: #1e8449; }
.stat-icon.active { background: #eaf4ff; color: #2980b9; }
.stat-icon.guests { background: #f5f0ff; color: #8e44ad; }
.stat-icon.bookings { background: #fef9e7; color: #b7950b; }
.stat-icon.rooms { background: #fdecea; color: #c0392b; }

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.stat-label {
  font-size: 12px;
  color: #888;
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
}
</style>
