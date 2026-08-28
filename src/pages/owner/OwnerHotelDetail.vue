<!--
  Owner hotel detail page (route: /owner/hotels/:id, name: owner-hotel-detail).
  Read-only analytics for a single owned hotel: identity header with status and
  subscription badges plus KPI cards (rooms, occupancy, guests, revenue).
-->
<template>
  <div>
    <!-- Back navigation to the owner's dashboard -->
    <router-link :to="{ name: 'owner-dashboard' }" class="back-link">
      <i class="fas fa-arrow-left"></i> {{ $t('owner.backToDashboard') }}
    </router-link>

    <!-- Error and loading feedback while the hotel is being fetched -->
    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="loading" class="loading-spinner"><div class="spinner"></div></div>

    <!-- Rendered only once the hotel data has arrived -->
    <template v-else-if="hotel">
      <div class="card detail-head">
        <div>
          <h1>{{ hotel.hotel_name }}</h1>
          <p class="muted">{{ [hotel.city, hotel.country].filter(Boolean).join(', ') || '—' }}</p>
          <p class="muted">
            {{ [hotel.address, hotel.phone, hotel.email].filter(Boolean).join(' · ') }}
          </p>
          <p v-if="hotel.tin || hotel.vrn" class="muted">
            {{
              [hotel.tin ? 'TIN: ' + hotel.tin : null, hotel.vrn ? 'VRN: ' + hotel.vrn : null]
                .filter(Boolean)
                .join(' · ')
            }}
          </p>
        </div>
        <div class="head-badges">
          <span class="badge" :class="statusBadge(hotel.status)">{{ hotel.status }}</span>
          <span class="badge badge-blue">{{ hotel.subscription_plan }}</span>
        </div>
      </div>

      <!-- KPI cards summarising the hotel's current performance -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon rooms"><i class="fas fa-door-open"></i></div>
          <div>
            <span class="stat-value">{{ hotel.rooms }}</span
            ><span class="stat-label">{{ $t('owner.rooms') }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon active"><i class="fas fa-bed"></i></div>
          <div>
            <span class="stat-value">{{ hotel.occupancy_rate }}%</span
            ><span class="stat-label">{{ $t('owner.occupancy') }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon guests"><i class="fas fa-users"></i></div>
          <div>
            <span class="stat-value">{{ hotel.guests_in_house }}</span
            ><span class="stat-label">{{ $t('owner.guestsInHouse') }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bookings"><i class="fas fa-calendar-check"></i></div>
          <div>
            <span class="stat-value">{{ hotel.active_reservations }}</span
            ><span class="stat-label">{{ $t('owner.activeReservations') }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon revenue"><i class="fas fa-dollar-sign"></i></div>
          <div>
            <span class="stat-value">TZS {{ hotel.revenue_30_days.toLocaleString() }}</span
            ><span class="stat-label">{{ $t('owner.revenue30d') }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon total"><i class="fas fa-sack-dollar"></i></div>
          <div>
            <span class="stat-value">TZS {{ hotel.revenue_total.toLocaleString() }}</span
            ><span class="stat-label">{{ $t('owner.revenueTotal') }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ownerApi } from '@/api'

const route = useRoute()
const { t } = useI18n()
const hotel = ref(null)
const loading = ref(false)
const error = ref('')

/**
 * Maps a hotel status to the CSS class used for its badge colour.
 * @param {string} status - The tenant status (active, pending, suspended, cancelled).
 * @returns {string} The badge CSS class.
 */
function statusBadge(status) {
  const map = {
    active: 'badge-green',
    pending: 'badge-yellow',
    suspended: 'badge-red',
    cancelled: 'badge-gray',
  }
  return map[status] || 'badge-gray'
}

/** Fetches the hotel detail (by the tenant id in the URL) and stores it in `hotel`. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await ownerApi.hotel(route.params.id)
    hotel.value = res.data.hotel
  } catch (err) {
    error.value = err.response?.data?.message || t('owner.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: #0e7490;
  font-weight: 600;
  margin-bottom: 16px;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.detail-head h1 {
  font-size: 22px;
  margin-bottom: 6px;
}

.muted {
  color: #64748b;
  font-size: 13px;
}

.head-badges {
  display: flex;
  gap: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
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
.stat-icon.total {
  background: #fdf2e9;
  color: #b9770e;
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
