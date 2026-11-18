<!--
  Public hotel detail page (route: /hotels/:id, name: public-hotel).
  Guest-facing view of one hotel: location/contact header with a booking
  shortcut, plus a grid of its rooms with status, type and nightly price.
-->
<template>
  <div class="hotel-detail-page">
    <div class="container page-content public-flow-content">
    <!-- Error banner when the hotel could not be loaded -->
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Rendered once the hotel has loaded -->
    <div v-if="hotel">
      <router-link :to="{ name: 'public-home' }" class="back-link">
        <i class="fas fa-arrow-left"></i> {{ $t('hotelDetail.backToHotels') }}
      </router-link>

      <!-- Header card with hotel identity and a shortcut straight into booking -->
      <div class="card detail-head">
        <div class="detail-head-info">
          <span class="detail-icon"><i class="fas fa-hotel"></i></span>
          <div>
            <h1>{{ hotel.hotel_name }}</h1>
            <p class="muted">
              <i class="fas fa-location-dot"></i>
              {{ [hotel.address, hotel.city, hotel.country].filter(Boolean).join(', ') || $t('superadmin.locationNotSpecified') }}
            </p>
            <p v-if="hotel.phone" class="muted"><i class="fas fa-phone"></i> {{ hotel.phone }}</p>
          </div>
        </div>
        <router-link :to="{ name: 'public-booking', query: { hotel_id: hotel.tenant_id } }" class="btn btn-primary">
          {{ $t('home.bookNow') }}
        </router-link>
      </div>

      <!-- List of the hotel's rooms, each showing status, type and nightly price -->
      <div class="card rooms-card">
        <h2 class="card-title">{{ $t('hotelDetail.rooms') }}</h2>

        <!-- Search, status filter and sort controls -->
        <div v-if="rooms.length" class="room-browser-bar">
          <div class="form-group">
            <label>{{ $t('common.search') }}</label>
            <input v-model.trim="query" type="search" class="input" :placeholder="$t('bookingPage.searchRoomsPlaceholderPublic')" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.status') }}</label>
            <SearchableSelect v-model="status" :options="statusOptions" :empty-label="$t('common.all')" />
          </div>
          <div class="form-group">
            <label>{{ $t('bookingPage.sortBy') }}</label>
            <SearchableSelect v-model="sortKey" :options="sortOptions" :placeholder="$t('bookingPage.sortBy')" />
          </div>
          <div class="form-group">
            <label>&nbsp;</label>
            <button type="button" class="btn btn-outline room-browser-dir" @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'">
              <i :class="sortDir === 'asc' ? 'fas fa-arrow-up-wide-short' : 'fas fa-arrow-down-wide-short'"></i>
              {{ sortDir === 'asc' ? $t('bookingPage.sortAsc') : $t('bookingPage.sortDesc') }}
            </button>
          </div>
        </div>
        <p v-if="rooms.length" class="hint muted room-browser-count">
          {{ $t('bookingPage.showingRooms', { from: rangeFrom, to: rangeTo, total: filteredCount }) }}
        </p>

        <div v-if="pagedRooms.length" class="room-grid">
          <article v-for="room in pagedRooms" :key="room.room_id" class="room-card">
            <span class="badge" :class="statusBadge(room.status)">{{ room.status }}</span>
            <h3>{{ roomTypeLabel(room.room_type) }}</h3>
            <p class="muted">{{ $t('hotelDetail.capacity', { count: room.max_occupancy }) }}</p>
            <p class="room-price">{{ curCode() }} {{ room.price_per_night.toLocaleString() }} {{ $t('home.perNight') }}</p>
          </article>
        </div>
        <p v-else-if="rooms.length" class="muted">{{ $t('common.noResults') }}</p>
        <p v-else class="muted">{{ $t('hotelDetail.noRooms') }}</p>

        <!-- Pagination over the filtered/sorted rooms (15 per page) -->
        <div v-if="pageCount > 1" class="pagination">
          <button type="button" class="btn btn-sm btn-outline" :disabled="page <= 1" @click="page--">
            <i class="fas fa-chevron-left"></i> {{ $t('common.previous') }}
          </button>
          <span class="muted">{{ $t('common.pageXOfY', { current: page, total: pageCount }) }}</span>
          <button type="button" class="btn btn-sm btn-outline" :disabled="page >= pageCount" @click="page++">
            {{ $t('common.next') }} <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>

      <div v-else-if="loading" class="alert alert-info">{{ $t('superadmin.loadingHotel') }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { publicApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useRoomBrowser } from '@/composables/useRoomBrowser'

import { useTenantCurrency } from '@/utils/currency'

const { curCode } = useTenantCurrency()

const route = useRoute()
const { t } = useI18n()
const hotel = ref(null)
const rooms = ref([])
const loading = ref(false)
const error = ref('')

// Rooms after applying the status filter; the browser then searches/sorts/paginates these.
const status = ref('')
const statusFilteredRooms = computed(() => {
  if (!status.value) return rooms.value
  return rooms.value.filter((room) => room.status === status.value)
})

// Search/sort/paginate the status-filtered rooms client-side.
const { query, sortKey, sortDir, page, pageCount, pagedRooms, filteredCount, rangeFrom, rangeTo } =
  useRoomBrowser(statusFilteredRooms)

/** Translated label for a room type key (single, double, suite, ...). */
function roomTypeLabel(type) {
  return t(`common.roomTypes.${type}`)
}

// Options for the status filter dropdown (guests only see bookable statuses).
const statusOptions = computed(() => [
  { value: 'available', label: t('rooms.statusAvailable') },
  { value: 'occupied', label: t('rooms.statusOccupied') },
])

// Options for the room-sort dropdown.
const sortOptions = computed(() => [
  { value: 'price_per_night', label: t('bookingPage.sortPrice') },
  { value: 'room_number', label: t('bookingPage.sortRoomNumber') },
  { value: 'max_occupancy', label: t('bookingPage.sortCapacity') },
  { value: 'floor', label: t('bookingPage.sortFloor') },
])

/**
 * Maps a room status to the CSS class used for its badge colour.
 * @param {string} status - The room status (available, occupied, cleaning, maintenance).
 * @returns {string} The badge CSS class.
 */
function statusBadge(status) {
  const map = {
    available: 'badge-green',
    occupied: 'badge-red',
    cleaning: 'badge-yellow',
    maintenance: 'badge-gray',
  }
  return map[status] || 'badge-gray'
}

/** Fetches the hotel and its rooms by the tenant id in the URL. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await publicApi.hotelShow(route.params.id)
    hotel.value = res.data.hotel
    rooms.value = res.data.available_rooms?.data || res.data.available_rooms || []
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.failedToLoad')
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
  color: #005EB8;
  font-weight: 600;
  margin-bottom: 16px;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.detail-head-info {
  display: flex;
  gap: 16px;
  align-items: center;
}

.detail-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: #fef5f5;
  color: #005EB8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.muted {
  color: #64748b;
  font-size: 13px;
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.room-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.room-price {
  margin-top: auto;
  font-size: 15px;
  font-weight: 700;
  color: #005EB8;
}

.hotel-detail-page {
  --flow-bg: #f4f7fb;
  --flow-surface: #ffffff;
  --flow-surface-alt: #eef4ff;
  --flow-text: #10243f;
  --flow-muted: #5b6b83;
  --flow-border: #d9e2f0;
  --flow-primary: #0b5fff;
  --flow-primary-dark: #0847bf;
  --flow-highlight: #0b5fff;
  --flow-on-primary: #ffffff;
  --flow-radius: 18px;
  --flow-shadow: 0 12px 30px rgba(16, 36, 63, 0.08);
  background: var(--flow-bg);
  color: var(--flow-text);
  min-height: calc(100vh - 64px);
}

html[data-theme='dark'] .hotel-detail-page {
  --flow-bg: #0b141a;
  --flow-surface: #202c33;
  --flow-surface-alt: #2a3942;
  --flow-text: #e9edef;
  --flow-muted: #95a3ab;
  --flow-border: #2f3b43;
  --flow-primary: #2563eb;
  --flow-primary-dark: #7cc0ff;
  --flow-highlight: #7cc0ff;
  --flow-on-primary: #ffffff;
  --flow-shadow: 0 18px 40px rgba(0, 0, 0, 0.32);
}

.public-flow-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 12px 64px;
}

.back-link {
  margin-bottom: 18px;
  color: var(--flow-highlight);
}

html[data-theme='dark'] .back-link {
  color: var(--flow-highlight);
}

.detail-head.card {
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 28px;
  border-radius: var(--flow-radius);
  border: 1px solid var(--flow-border);
  background:
    radial-gradient(520px 200px at 8% -40%, #dcebff 0, transparent 70%),
    radial-gradient(420px 180px at 96% 0%, #e2fff6 0, transparent 65%),
    var(--flow-surface);
  box-shadow: var(--flow-shadow);
}

html[data-theme='dark'] .detail-head.card {
  background:
    radial-gradient(520px 200px at 8% -40%, rgba(37, 99, 235, 0.24) 0, transparent 70%),
    radial-gradient(420px 180px at 96% 0%, rgba(75, 214, 190, 0.16) 0, transparent 65%),
    var(--flow-surface);
}

.detail-head-info {
  min-width: 0;
}

.detail-head h1 {
  margin: 0 0 8px;
  font-size: clamp(24px, 3vw, 32px);
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--flow-text);
}

.detail-head .muted {
  color: var(--flow-muted);
  font-size: 14px;
}

.detail-icon {
  width: 62px;
  height: 62px;
  border-radius: 18px;
  border: 1px solid var(--flow-border);
  background: var(--flow-surface);
  color: var(--flow-highlight);
  box-shadow: 0 8px 18px rgba(16, 36, 63, 0.08);
}

.detail-head .btn-primary {
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--flow-primary);
  border-color: var(--flow-primary);
  color: var(--flow-on-primary);
  font-weight: 700;
  padding: 12px 22px;
}

.rooms-card.card {
  margin-top: 20px;
  padding: 26px;
  border-radius: var(--flow-radius);
  border: 1px solid var(--flow-border);
  background: var(--flow-surface);
  box-shadow: var(--flow-shadow);
}

.rooms-card .card-title {
  color: var(--flow-text);
  font-size: 19px;
  font-weight: 800;
  margin-bottom: 14px;
}

.room-browser-bar {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(0, 1fr)) auto;
  gap: 14px;
  align-items: end;
  margin: 0 0 12px;
}

.room-browser-bar .form-group {
  min-width: 0;
  margin: 0;
}

.room-browser-bar .form-group label {
  color: var(--flow-muted);
  font-size: 13px;
  font-weight: 700;
}

.room-browser-bar .input,
.room-browser-bar :deep(.ss-trigger) {
  height: 46px;
  min-height: 46px;
  padding: 0 14px;
  border-radius: 11px;
  border: 1px solid var(--flow-border);
  background: var(--flow-surface-alt);
  color: var(--flow-text);
}

.room-browser-bar :deep(.ss-trigger-label) {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.room-browser-dir {
  min-height: 46px;
  border-radius: 11px;
  border-color: var(--flow-border);
  color: var(--flow-highlight);
  white-space: nowrap;
}

.room-browser-count {
  margin: 0 0 16px;
  color: var(--flow-muted);
}

.room-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.room-card {
  min-height: 152px;
  padding: 18px;
  border-radius: 14px;
  border: 1px solid var(--flow-border);
  background: var(--flow-surface-alt);
}

.room-card h3 {
  color: var(--flow-text);
  font-size: 17px;
  font-weight: 700;
}

.room-card .muted {
  color: var(--flow-muted);
}

.room-card .badge {
  align-self: flex-start;
  border-radius: 999px;
  padding: 5px 10px;
  border: 1px solid var(--flow-border);
  background: var(--flow-surface);
  color: var(--flow-muted);
  font-size: 11px;
  text-transform: capitalize;
}

.room-card .badge-green {
  color: #087f5b;
  border-color: rgba(8, 127, 91, 0.24);
  background: rgba(8, 127, 91, 0.08);
}

.room-card .badge-red {
  color: #c92a2a;
  border-color: rgba(201, 42, 42, 0.24);
  background: rgba(201, 42, 42, 0.08);
}

.room-price {
  color: var(--flow-highlight);
  font-size: 16px;
}

.pagination .btn-outline {
  border-radius: 10px;
  border-color: var(--flow-border);
  color: var(--flow-text);
}

.pagination .muted {
  color: var(--flow-muted);
}

@media (max-width: 1000px) {
  .room-browser-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .room-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .public-flow-content {
    padding: 20px 12px 48px;
  }

  .detail-head.card,
  .rooms-card.card {
    padding: 20px;
  }

  .detail-head.card {
    align-items: flex-start;
    flex-direction: column;
  }

  .room-browser-bar,
  .room-grid {
    grid-template-columns: 1fr;
  }
}
</style>
