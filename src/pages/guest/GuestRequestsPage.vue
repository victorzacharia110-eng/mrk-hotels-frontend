<!--
  GuestRequestsPage — guest's service requests (route: /guest/requests).
  Lists existing requests and lets the guest submit new ones.
-->
<template>
  <div class="guest-requests-page">
    <header class="page-header">
      <router-link :to="{ name: 'guest-booking' }" class="back-link">← Back</router-link>
      <h1>Service Requests</h1>
    </header>

    <!-- New request form -->
    <section class="card form-card">
      <h2>New Request</h2>
      <form @submit.prevent="submitRequest" class="request-form">
        <div class="input-group">
          <label for="type">Type</label>
          <select id="type" v-model="form.type" class="auth-input" required>
            <option value="" disabled>Select type</option>
            <option value="housekeeping">Housekeeping</option>
            <option value="maintenance">Maintenance / Repair</option>
            <option value="room_service">Room Service</option>
            <option value="restaurant">Restaurant Reservation</option>
            <option value="transport">Transport</option>
            <option value="general">General Inquiry</option>
          </select>
        </div>
        <div class="input-group">
          <label for="description">Description</label>
          <textarea
            id="description"
            v-model="form.description"
            class="auth-input"
            rows="3"
            required
            placeholder="Tell us what you need..."
          ></textarea>
        </div>
        <div v-if="error" class="alert alert--error">{{ error }}</div>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'Sending...' : 'Submit Request' }}
        </button>
      </form>
    </section>

    <!-- Existing requests -->
    <section class="card" style="margin-top:20px;">
      <h2>My Requests</h2>
      <SkeletonLoader v-if="listLoading" variant="cards" :count="3" :cols="2" />
      <p v-else-if="!requests.length" class="empty">No requests yet. Submit one above.</p>
      <ul v-else class="requests-list">
        <li v-for="r in requests" :key="r.id" class="request-item">
          <div class="request-head">
            <span class="type-pill">{{ r.type.replace(/_/g, ' ') }}</span>
            <span class="status-pill" :class="`status-pill--${r.status}`">{{ r.status.replace(/_/g, ' ') }}</span>
          </div>
          <p class="desc">{{ r.description }}</p>
          <time>{{ fmtDate(r.created_at) }}</time>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { guestPortalApi } from '@/api'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const router = useRouter()
const loading = ref(false)
const listLoading = ref(true)
const error = ref(null)
const requests = ref([])

const form = reactive({ type: '', description: '' })

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function submitRequest() {
  error.value = null
  loading.value = true
  try {
    const data = await guestPortalApi.createRequest({
      type: form.type,
      description: form.description,
    })
    requests.value.unshift(data.request)
    form.type = ''
    form.description = ''
  } catch (e) {
    error.value = e.response?.data?.message || 'Could not submit request.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const data = await guestPortalApi.requests()
    requests.value = data.requests || []
  } catch (e) {
    if (e.response?.status === 401) {
      sessionStorage.removeItem('guest_token')
      router.push({ name: 'guest-login' })
    }
  } finally {
    listLoading.value = false
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.guest-requests-page {
  min-height: 100vh; background: #f8f9fb;
  font-family: 'Inter', system-ui, sans-serif;
  padding: 24px; max-width: 720px; margin: 0 auto;
}
.page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.back-link { color: #6b7280; text-decoration: none; font-size: 13px; font-weight: 600; }
.page-header h1 { font-size: 22px; font-weight: 800; color: #1a1a2e; margin: 0; }

.card { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.card h2 { font-size: 15px; font-weight: 700; color: #374151; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.04em; }

.request-form { display: flex; flex-direction: column; gap: 14px; }
.input-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
.auth-input {
  width: 100%; padding: 11px 14px;
  border: 1.5px solid #d1d5db; border-radius: 8px;
  font-size: 14px; color: #111827; outline: none; resize: vertical;
}
.auth-input:focus { border-color: #2563eb; }
.btn-primary {
  padding: 11px 24px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
}
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.alert--error { background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; }

.requests-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.request-item { border: 1px solid #f1f5f9; border-radius: 10px; padding: 16px; }
.request-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
.type-pill { background: #eff6ff; color: #2563eb; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: capitalize; }
.status-pill { padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: capitalize; }
.status-pill--pending { background: #fffbeb; color: #d97706; }
.status-pill--in_progress { background: #eff6ff; color: #2563eb; }
.status-pill--completed { background: #ecfdf5; color: #059669; }
.status-pill--cancelled { background: #fef2f2; color: #dc2626; }
.desc { color: #374151; font-size: 13px; line-height: 1.5; margin: 0 0 6px; }
time { color: #9ca3af; font-size: 12px; }
.empty { color: #9ca3af; text-align: center; padding: 32px; }
</style>
