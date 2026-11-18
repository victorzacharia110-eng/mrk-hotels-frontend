<!--
  Public hotel directory (route: /, name: public-home).
  Landing page listing all bookable hotels with country/city filters; also hosts
  the booking status tracker and invoice download self-service cards.
-->
<template>
  <div class="hotels-directory">
    <div class="container page-content hotels-content">
      <div class="hero hotel-hero">
        <h1>{{ $t('home.heroTitle') }}</h1>
        <p>{{ $t('home.heroSubtitle') }}</p>
      </div>

      <div class="search-shell">
        <div class="search-bar card">
          <CountryCitySelect
            v-model:countryCode="filters.country_code"
            v-model:country="filters.country"
            v-model:city="filters.city"
            :city-as-dropdown="true"
          />
        </div>
      </div>

      <div v-if="error" class="alert alert-error directory-alert">{{ error }}</div>

      <SkeletonLoader v-if="loading && !hotels.length" variant="cards" :count="6" :cols="3" class="hotel-grid-skeleton" />

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
            <span v-if="hotel.room_types?.length" class="badge badge-gray">{{ hotel.room_types.join(', ') }}</span>
          </div>
          <div class="hotel-card-foot">
            <p class="price">
              <template v-if="hotel.starting_price">
                {{ $t('home.from') }} <strong>{{ curCode() }} {{ hotel.starting_price.toLocaleString() }}</strong> {{
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

      <div v-else-if="!loading" class="card empty">
        <i class="fas fa-hotel"></i>
        <p>{{ $t('home.noHotels') }}</p>
      </div>

      <div class="directory-tools">
        <BookingStatusTracker />
        <InvoiceDownloadCard />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { publicApi } from '@/api'
import CountryCitySelect from '@/components/CountryCitySelect.vue'
import BookingStatusTracker from '@/components/BookingStatusTracker.vue'
import InvoiceDownloadCard from '@/components/InvoiceDownloadCard.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

import { useTenantCurrency } from '@/utils/currency'

const { curCode } = useTenantCurrency()

const { t } = useI18n()
const route = useRoute()
const hotels = ref([])
const loading = ref(false)
const error = ref('')
const filters = ref({
  country_code: '',
  country: '',
  city: '',
  search: Array.isArray(route.query.search) ? route.query.search[0] : (route.query.search || ''),
})

/** Queries the API for hotels, passing the text/country/city filters when set. */
async function search() {
  loading.value = true
  error.value = ''
  try {
    const params = {
      search: filters.value.search || undefined,
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

// Applies a new search submitted from the header directory search input
watch(
  () => route.query.search,
  (q) => {
    filters.value.search = Array.isArray(q) ? q[0] : (q || '')
    search()
  }
)

onMounted(search)
</script>

<style scoped>
.hotels-directory {
  --hotel-bg: #f4f7fb;
  --hotel-surface: #ffffff;
  --hotel-surface-alt: #eef4ff;
  --hotel-text: #10243f;
  --hotel-muted: #5b6b83;
  --hotel-border: #d9e2f0;
  --hotel-primary: #0b5fff;
  --hotel-primary-dark: #0847bf;
  --hotel-accent: #00a88f;
  --hotel-highlight: #0b5fff;
  --hotel-on-primary: #ffffff;
  --hotel-radius: 18px;
  --hotel-shadow: 0 12px 30px rgba(16, 36, 63, 0.08);
  background: var(--hotel-bg);
  color: var(--hotel-text);
  min-height: calc(100vh - 64px);
}

html[data-theme='dark'] .hotels-directory {
  --hotel-bg: #0b141a;
  --hotel-surface: #202c33;
  --hotel-surface-alt: #2a3942;
  --hotel-text: #e9edef;
  --hotel-muted: #95a3ab;
  --hotel-border: #2f3b43;
  --hotel-primary: #2563eb;
  --hotel-primary-dark: #7cc0ff;
  --hotel-accent: #4bd6be;
  --hotel-highlight: #7cc0ff;
  --hotel-shadow: 0 18px 40px rgba(0, 0, 0, 0.32);
}

.hotels-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 12px;
}

.hotel-hero {
  position: relative;
  overflow: hidden;
  text-align: center;
  padding: 56px 24px 76px;
  border-radius: 24px;
  border: 1px solid var(--hotel-border);
  background:
    radial-gradient(700px 280px at 12% -20%, #dcebff 0, transparent 70%),
    radial-gradient(520px 240px at 95% 0%, #e2fff6 0, transparent 65%),
    var(--hotel-surface);
  box-shadow: var(--hotel-shadow);
}

.hotel-hero::before {
  content: '';
  position: absolute;
  width: 260px;
  height: 260px;
  top: -150px;
  right: 8%;
  border: 1px solid var(--hotel-border);
  border-radius: 50%;
  opacity: 0.7;
}

.hotel-hero h1 {
  position: relative;
  font-size: clamp(32px, 5vw, 52px);
  line-height: 1.08;
  letter-spacing: -0.03em;
  font-weight: 800;
  color: var(--hotel-text);
}

.hotel-hero p {
  position: relative;
  max-width: 760px;
  margin: 14px auto 0;
  font-size: 18px;
  line-height: 1.6;
  color: var(--hotel-muted);
}

html[data-theme='dark'] .hotel-hero {
  background:
    radial-gradient(700px 280px at 12% -20%, rgba(37, 99, 235, 0.24) 0, transparent 70%),
    radial-gradient(520px 240px at 95% 0%, rgba(75, 214, 190, 0.16) 0, transparent 65%),
    var(--hotel-surface);
}

.search-shell {
  position: relative;
  z-index: 2;
  max-width: 920px;
  margin: -44px auto 0;
}

.search-bar.card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  padding: 24px;
  border-radius: var(--hotel-radius);
  border: 1px solid var(--hotel-border);
  background: var(--hotel-surface);
  box-shadow: 0 18px 40px rgba(16, 36, 63, 0.12);
}

.search-bar.card :deep(.form-group) {
  margin: 0;
}

html[data-theme='dark'] .search-bar.card {
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.36);
}

.search-bar.card :deep(.form-group label) {
  color: var(--hotel-muted);
  font-weight: 700;
  font-size: 13px;
}

.search-bar.card :deep(.ss-trigger) {
  min-height: 46px;
  border-radius: 12px;
  border: 1px solid var(--hotel-border);
  background: var(--hotel-surface-alt);
  color: var(--hotel-text);
  font-weight: 600;
}

.search-bar.card :deep(.ss-trigger.is-empty) {
  color: var(--hotel-muted);
}

html[data-theme='dark'] .search-bar.card :deep(.ss-trigger) {
  background: var(--hotel-surface-alt);
  color: var(--hotel-highlight);
}

html[data-theme='dark'] .search-bar.card :deep(.ss-trigger.is-empty) {
  color: var(--hotel-muted);
}

.directory-alert {
  margin-top: 28px;
  border-radius: 14px;
}

.hotel-grid-skeleton {
  margin-top: 36px;
}

.hotel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 22px;
  margin-top: 36px;
}

.hotel-grid > .card + .card {
  margin-top: 0;
}

.hotel-card.card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 80px 22px 20px;
  border-radius: var(--hotel-radius);
  border: 1px solid var(--hotel-border);
  background: var(--hotel-surface);
  box-shadow: var(--hotel-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.hotel-card.card:hover {
  transform: translateY(-4px);
  border-color: var(--hotel-primary);
  box-shadow: 0 22px 48px rgba(16, 36, 63, 0.14);
}

html[data-theme='dark'] .hotel-card.card:hover {
  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.44);
}

.hotel-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 104px;
  background:
    radial-gradient(220px 120px at 18% 0%, rgba(11, 95, 255, 0.2) 0, transparent 70%),
    linear-gradient(135deg, var(--hotel-surface-alt), var(--hotel-surface));
}

.hotel-card::after {
  content: '';
  position: absolute;
  top: 38px;
  right: -34px;
  width: 124px;
  height: 124px;
  border: 1px solid var(--hotel-border);
  border-radius: 50%;
  opacity: 0.7;
}

.hotel-card-head {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.hotel-icon {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  background: var(--hotel-surface);
  color: var(--hotel-highlight);
  border: 1px solid var(--hotel-border);
  box-shadow: 0 8px 18px rgba(16, 36, 63, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

html[data-theme='dark'] .hotel-icon {
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
}

.hotel-icon i {
  opacity: 1;
}

.hotel-card h3 {
  font-size: 18px;
  line-height: 1.3;
  font-weight: 700;
  color: var(--hotel-text);
}

.hotel-location {
  color: var(--hotel-muted);
  font-size: 13px;
  margin-top: 6px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.hotel-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.hotel-card .badge {
  border-radius: 999px;
  padding: 6px 10px;
  background: var(--hotel-surface-alt);
  color: var(--hotel-highlight);
  border: 1px solid var(--hotel-border);
  font-weight: 600;
}

.hotel-card-foot {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-top: 1px solid var(--hotel-border);
  padding-top: 16px;
}

.price {
  color: var(--hotel-muted);
  font-size: 13px;
}

.price strong {
  color: var(--hotel-highlight);
  font-size: 16px;
}

.hotel-card .btn-primary {
  background: var(--hotel-primary);
  color: var(--hotel-on-primary);
  border-color: var(--hotel-primary);
  border-radius: 10px;
  padding: 10px 16px;
  font-weight: 700;
}

.empty.card {
  margin-top: 36px;
  text-align: center;
  padding: 64px 24px;
  color: var(--hotel-muted);
  border-radius: var(--hotel-radius);
  border: 1px solid var(--hotel-border);
  background: var(--hotel-surface);
  box-shadow: var(--hotel-shadow);
}

.empty i {
  width: 76px;
  height: 76px;
  margin: 0 auto 18px;
  border-radius: 24px;
  background: var(--hotel-surface-alt);
  color: var(--hotel-highlight);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
}

.directory-tools {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px;
  margin-top: 40px;
}

.directory-tools > .card + .card,
.directory-tools > :deep(.tracker),
.directory-tools > :deep(.invoice-card) {
  margin-top: 0;
}

.directory-tools :deep(.card) {
  padding: 24px;
  border-radius: var(--hotel-radius);
  border: 1px solid var(--hotel-border);
  background: var(--hotel-surface);
  box-shadow: var(--hotel-shadow);
}

html[data-theme='dark'] .directory-tools :deep(.card) {
  background: var(--hotel-surface);
  border-color: var(--hotel-border);
}

.directory-tools :deep(.card-title),
.directory-tools :deep(h2) {
  color: var(--hotel-text);
}

.directory-tools :deep(.muted),
.directory-tools :deep(label) {
  color: var(--hotel-muted);
}

.directory-tools :deep(.input) {
  border-radius: 12px;
  border: 1px solid var(--hotel-border);
  background: var(--hotel-surface-alt);
  color: var(--hotel-text);
}

html[data-theme='dark'] .directory-tools :deep(.input) {
  background: var(--hotel-surface-alt);
  border-color: var(--hotel-border);
  color: var(--hotel-text);
}

.directory-tools :deep(.btn-primary) {
  border-radius: 10px;
  background: var(--hotel-primary);
  border-color: var(--hotel-primary);
  color: var(--hotel-on-primary);
  font-weight: 700;
}

@media (max-width: 900px) {
  .directory-tools {
    grid-template-columns: 1fr;
  }

  .search-bar.card {
    grid-template-columns: 1fr;
  }

  .search-shell {
    margin-top: -32px;
  }
}

@media (max-width: 640px) {
  .hotels-content {
    padding: 20px 12px;
  }

  .hotel-hero {
    padding: 40px 18px 64px;
    border-radius: 18px;
  }

  .hotel-hero p {
    font-size: 16px;
  }

  .search-bar.card {
    padding: 18px;
  }

  .hotel-grid {
    grid-template-columns: 1fr;
  }

  .hotel-card-foot {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
