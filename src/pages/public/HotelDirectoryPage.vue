<!--
  Public hotel directory (route: /, name: public-home).
  Landing page listing all bookable hotels with country/city filters; also hosts
  the booking status tracker and invoice download self-service cards.
-->
<template>
  <div class="container page-content">
    <!-- Hero banner with the storefront tagline -->
    <div class="hero">
      <h1>{{ $t('home.heroTitle') }}</h1>
      <p>{{ $t('home.heroSubtitle') }}</p>
    </div>

    <!-- Location filters that re-run the hotel search whenever they change -->
    <div class="search-bar card">
      <CountryCitySelect
        v-model:countryCode="filters.country_code"
        v-model:country="filters.country"
        v-model:city="filters.city"
        :city-as-dropdown="true"
      />
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div v-if="loading" class="alert alert-info">{{ $t('home.loadingHotels') }}</div>

    <!-- Grid of hotel cards, each linking to its detail page -->
    <div v-else-if="hotels.length" class="hotel-grid">
      <article v-for="hotel in hotels" :key="hotel.tenant_id" class="card hotel-card">
        <div class="hotel-card-head">
          <span class="hotel-icon"><i class="fas fa-hotel"></i></span>
          <div>
            <h3>{{ hotel.hotel_name }}</h3>
            <p class="hotel-location">
              <i class="fas fa-location-dot"></i>
              {{ [hotel.city, hotel.country].filter(Boolean).join(', ') || $t('superadmin.locationNotSpecified') }}
            </p>
          </div>
        </div>
        <div class="hotel-meta">
          <span class="badge badge-blue">{{ hotel.available_rooms }} {{ $t('home.rooms') }}</span>
          <span v-if="hotel.room_types?.length" class="badge badge-gray">{{ hotel.room_types.join(', ') }}</span>
        </div>
        <div class="hotel-card-foot">
          <p class="price">
            <template v-if="hotel.starting_price">
              {{ $t('home.from') }} <strong>TZS {{ hotel.starting_price.toLocaleString() }}</strong> {{
                $t('home.perNight') }}
            </template>
            <template v-else>{{ $t('home.noRooms') }}</template>
          </p>
          <router-link :to="{ name: 'public-hotel', params: { id: hotel.tenant_id } }" class="btn btn-primary btn-sm">
            {{ $t('home.viewHotel') }}
          </router-link>
        </div>
      </article>
    </div>

    <!-- Empty state shown when no hotels match the current filters -->
    <div v-else-if="!loading" class="card empty">
      <i class="fas fa-hotel"></i>
      <p>{{ $t('home.noHotels') }}</p>
    </div>

    <!-- Self-service tools: track a booking by reference, download an invoice -->
    <BookingStatusTracker />

    <InvoiceDownloadCard />
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { publicApi } from '@/api'
import CountryCitySelect from '@/components/CountryCitySelect.vue'
import BookingStatusTracker from '@/components/BookingStatusTracker.vue'
import InvoiceDownloadCard from '@/components/InvoiceDownloadCard.vue'

const { t } = useI18n()
const hotels = ref([])
const loading = ref(false)
const error = ref('')
const filters = ref({
  country_code: '',
  country: '',
  city: '',
})

/** Queries the API for hotels, passing the country/city filters when set. */
async function search() {
  loading.value = true
  error.value = ''
  try {
    const params = {
      country: filters.value.country || undefined,
      city: filters.value.city || undefined,
    }
    const res = await publicApi.hotels(params)
    hotels.value = res.data.hotels || []
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.loadError')
  } finally {
    loading.value = false
  }
}

// Re-runs the search whenever the selected country or city changes
watch(
  () => [filters.value.country, filters.value.city],
  () => search()
)

onMounted(search)
</script>

<style scoped>
.hero {
  text-align: center;
  padding: 40px 0 32px;
}

.hero h1 {
  font-size: 34px;
  font-weight: 800;
}

.hero p {
  color: #64748b;
  margin-top: 8px;
}

.hotel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 24px;
}

.hotel-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hotel-card-head {
  display: flex;
  gap: 12px;
  align-items: center;
}

.hotel-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #005EB8;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.hotel-icon i {
  opacity: 1;
}

.hotel-location {
  color: #64748b;
  font-size: 13px;
  margin-top: 2px;
}

.hotel-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.hotel-card-foot {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #f1f5f9;
  padding-top: 12px;
}

.price {
  color: #475569;
  font-size: 13px;
}

.price strong {
  color: #005EB8;
  font-size: 15px;
}

.empty {
  text-align: center;
  padding: 48px;
  color: #94a3b8;
}

.empty i {
  font-size: 40px;
  margin-bottom: 12px;
}
</style>
