<!--
  GuestBookingPage — guest's booking overview (route: /guest/booking).
  Shows booking details, status, and links to folio + service requests.
-->
<template>
  <div class="guest-booking-page">
    <header class="page-header">
      <img v-if="booking?.hotel_logo" :src="booking.hotel_logo" alt="Logo" class="hotel-logo" />
      <div>
        <h1>{{ booking?.hotel_name || 'Your Booking' }}</h1>
        <p class="ref">Reference: {{ booking?.reference }}</p>
      </div>
      <button class="logout-btn" @click="logout">Sign out</button>
    </header>

    <div v-if="loading" class="loading">Loading your booking...</div>

    <template v-else-if="booking">
      <div class="status-banner" :class="`status-banner--${booking.status}`">
        Booking {{ booking.status }}
      </div>

      <div class="content-grid">
        <!-- Booking details -->
        <section class="card">
          <h2>Stay Details</h2>
          <dl class="details-list">
            <div class="detail"><dt>Room</dt><dd>{{ booking.room_number }}</dd></div>
            <div class="detail"><dt>Room Type</dt><dd>{{ booking.room_type }}</dd></div>
            <div class="detail"><dt>Check-in</dt><dd>{{ fmtDate(booking.check_in_date) }}</dd></div>
            <div class="detail"><dt>Check-out</dt><dd>{{ fmtDate(booking.check_out_date) }}</dd></div>
            <div v-if="booking.nights" class="detail"><dt>Nights</dt><dd>{{ booking.nights }}</dd></div>
            <div class="detail"><dt>Guests</dt><dd>{{ booking.adults }} adult{{ booking.adults !== 1 ? 's' : '' }}<span v-if="booking.children">, {{ booking.children }} child{{ booking.children !== 1 ? 'ren' : '' }}</span></dd></div>
          </dl>
        </section>

        <!-- Charges summary -->
        <section class="card">
          <h2>Charges</h2>
          <dl class="details-list">
            <div class="detail"><dt>Total</dt><dd>TZS {{ Number(booking.total_amount || 0).toLocaleString() }}</dd></div>
            <div class="detail"><dt>Paid</dt><dd>TZS {{ Number(booking.advance_payment || 0).toLocaleString() }}</dd></div>
            <div class="detail detail--balance"><dt>Balance Due</dt><dd>TZS {{ Number(booking.balance || 0).toLocaleString() }}</dd></div>
          </dl>
        </section>
      </div>

      <!-- Quick actions -->
      <nav class="quick-actions">
        <router-link :to="{ name: 'guest-folio' }" class="action-card">
          <i class="fas fa-file-invoice"></i>
          <span>View Folio</span>
          <p>All charges and payments</p>
        </router-link>
        <router-link :to="{ name: 'guest-requests' }" class="action-card">
          <i class="fas fa-concierge-bell"></i>
          <span>Service Requests</span>
          <p>Request room service or help</p>
        </router-link>
      </nav>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { guestPortalApi } from '@/api'

const router = useRouter()
const loading = ref(true)
const booking = ref(null)

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function logout() {
  sessionStorage.removeItem('guest_token')
  sessionStorage.removeItem('guest_booking')
  router.push({ name: 'guest-login' })
}

onMounted(async () => {
  try {
    const data = await guestPortalApi.booking()
    booking.value = data.booking
  } catch (e) {
    if (e.response?.status === 401) {
      logout()
      return
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.guest-booking-page {
  min-height: 100vh; background: #f8f9fb;
  font-family: 'Inter', system-ui, sans-serif;
  padding: 24px; max-width: 960px; margin: 0 auto;
}
.page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.hotel-logo { max-width: 56px; max-height: 56px; border-radius: 12px; }
.page-header h1 { font-size: 22px; font-weight: 800; color: #1a1a2e; margin: 0; }
.ref { color: #6b7280; font-size: 13px; margin: 4px 0 0; }
.logout-btn { margin-left: auto; background: none; border: none; color: #dc2626; cursor: pointer; font-size: 13px; font-weight: 600; }

.loading { text-align: center; padding: 60px; color: #6b7280; }

.status-banner {
  padding: 12px 20px; border-radius: 10px; margin-bottom: 20px;
  font-weight: 700; text-transform: capitalize; font-size: 14px;
}
.status-banner--confirmed { background: #ecfdf5; color: #059669; }
.status-banner--pending { background: #fffbeb; color: #d97706; }
.status-banner--checked_in { background: #eff6ff; color: #2563eb; }
.status-banner--checked_out { background: #f1f5f9; color: #475569; }
.status-banner--cancelled { background: #fef2f2; color: #dc2626; }

.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
.card { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.card h2 { font-size: 15px; font-weight: 700; color: #374151; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.04em; }

.details-list { display: flex; flex-direction: column; gap: 10px; margin: 0; }
.detail { display: flex; justify-content: space-between; }
.detail dt { color: #6b7280; font-size: 13px; }
.detail dd { color: #111827; font-size: 13px; font-weight: 600; margin: 0; }
.detail--balance dd { color: #dc2626; font-size: 15px; font-weight: 800; }

.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.action-card {
  display: block; background: #fff; border-radius: 14px; padding: 24px;
  text-decoration: none; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
.action-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-2px); }
.action-card i { font-size: 24px; color: #2563eb; margin-bottom: 12px; }
.action-card span { display: block; font-weight: 700; color: #111827; margin-bottom: 4px; }
.action-card p { color: #6b7280; font-size: 13px; margin: 0; }

@media (max-width: 720px) {
  .content-grid, .quick-actions { grid-template-columns: 1fr; }
}
</style>
