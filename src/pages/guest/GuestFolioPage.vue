<!--
  GuestFolioPage — guest's folio (route: /guest/folio).
  Shows all charges and payments for their stay.
-->
<template>
  <div class="guest-folio-page">
    <header class="page-header">
      <router-link :to="{ name: 'guest-booking' }" class="back-link">← Back</router-link>
      <h1>My Folio</h1>
    </header>

    <!-- Summary -->
    <div class="summary-grid" v-if="summary">
      <div class="summary-card"><span class="label">Total Charges</span><span class="value">TZS {{ Number(summary.total_charges).toLocaleString() }}</span></div>
      <div class="summary-card"><span class="label">Total Paid</span><span class="value value--green">TZS {{ Number(summary.total_payments).toLocaleString() }}</span></div>
      <div class="summary-card summary-card--balance"><span class="label">Balance Due</span><span class="value" :class="{ 'value--red': summary.balance > 0 }">TZS {{ Number(summary.balance).toLocaleString() }}</span></div>
    </div>

    <!-- Line items -->
    <section class="card">
      <table v-if="folio.length" class="folio-table">
        <thead><tr><th>Date</th><th>Description</th><th>Type</th><th class="amount-col">Amount</th></tr></thead>
        <tbody>
          <tr v-for="item in folio" :key="item.id">
            <td>{{ fmtDate(item.date) }}</td>
            <td>{{ item.description }}</td>
            <td><span class="type-pill" :class="`type-pill--${item.type}`">{{ item.type }}</span></td>
            <td class="amount-col" :class="{ negative: item.type === 'payment' }">
              {{ item.type === 'payment' ? '−' : '' }} TZS {{ Number(item.amount).toLocaleString() }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">No charges or payments yet.</p>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { guestPortalApi } from '@/api'

const router = useRouter()
const loading = ref(true)
const folio = ref([])
const summary = ref(null)

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

onMounted(async () => {
  try {
    const data = await guestPortalApi.folio()
    folio.value = data.folio || []
    summary.value = data.summary
  } catch (e) {
    if (e.response?.status === 401) {
      sessionStorage.removeItem('guest_token')
      router.push({ name: 'guest-login' })
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.guest-folio-page {
  min-height: 100vh; background: #f8f9fb;
  font-family: 'Inter', system-ui, sans-serif;
  padding: 24px; max-width: 860px; margin: 0 auto;
}
.page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.back-link { color: #6b7280; text-decoration: none; font-size: 13px; font-weight: 600; }
.page-header h1 { font-size: 22px; font-weight: 800; color: #1a1a2e; margin: 0; }

.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.summary-card { background: #fff; border-radius: 14px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
.summary-card--balance { background: #fff7ed; border: 1px solid #fed7aa; }
.label { display: block; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
.value { display: block; font-size: 18px; font-weight: 800; color: #111827; }
.value--green { color: #059669; }
.value--red { color: #dc2626; }

.card { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); overflow-x: auto; }
.folio-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.folio-table th { text-align: left; font-weight: 600; color: #94a3b8; padding: 8px 12px; border-bottom: 2px solid #f1f5f9; text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; }
.folio-table td { padding: 10px 12px; border-bottom: 1px solid #f8fafc; color: #374151; }
.amount-col { text-align: right; font-weight: 600; }
.negative { color: #059669; }

.type-pill { padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
.type-pill--charge { background: #fef3c7; color: #d97706; }
.type-pill--payment { background: #d1fae5; color: #059669; }

.empty { text-align: center; color: #9ca3af; padding: 40px; }

@media (max-width: 720px) {
  .summary-grid { grid-template-columns: 1fr; }
}
</style>
