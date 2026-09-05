<!--
  Cash Drawer page (route: /app/payments/cash-drawer,
  name: hotel-payments-cash-drawer).
  Today's cash position: payments received by cash, night-audit cash transactions
  and a quick link to post a new transaction.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('receptionPanel.cashDrawer') }}</h1>
        <p class="muted">{{ $t('receptionPanel.cashDrawerSubtitle') }}</p>
      </div>
      <div class="head-actions">
        <router-link to="/app/night-audit/transactions" class="btn btn-primary">
          <i class="fas fa-circle-plus"></i> {{ $t('receptionPanel.insertTransaction') }}
        </router-link>
        <button class="btn btn-secondary" :disabled="loading" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card" style="padding: 14px 20px; margin-bottom: 16px;">
      <div class="form-group" style="margin: 0;">
        <label>{{ $t('nightAudit.businessDate') }}</label>
        <input v-model="selectedDate" type="date" class="input" style="max-width: 220px;" @change="load" />
      </div>
    </div>

    <div class="kpi-grid" style="margin-bottom: 16px;">
      <div class="kpi total">
        <span class="kpi-value">{{ fmt(cashReceived) }}</span>
        <span class="kpi-label">{{ $t('receptionPanel.cashReceived') }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-value">{{ fmt(cashTransactions) }}</span>
        <span class="kpi-label">{{ $t('receptionPanel.cashTransactions') }}</span>
      </div>
      <div class="kpi" :class="{ total: true }">
        <span class="kpi-value">{{ fmt(netCash) }}</span>
        <span class="kpi-label">{{ $t('receptionPanel.netCashPosition') }}</span>
      </div>
    </div>

    <div class="card" style="padding: 20px; margin-bottom: 16px;">
      <h3 style="margin: 0 0 12px;"><i class="fas fa-cash-register" style="color: var(--mrk-blue);"></i> {{ $t('receptionPanel.todayCashPayments') }}</h3>
      <div v-if="loading" class="alert alert-info" style="margin: 0;">{{ $t('common.loading') }}</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>{{ $t('payments.amount') }}</th>
            <th>{{ $t('receptionPanel.paidBy') }}</th>
            <th>{{ $t('receptionPanel.forReservation') }}</th>
            <th>{{ $t('receptionPanel.recorded') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in cashPayments" :key="p.payment_id">
            <td>{{ fmt(p.amount) }}</td>
            <td>{{ p.paid_by || '—' }}</td>
            <td>{{ p.reservation?.guest_name || p.reservation_id?.slice(0, 8) || '—' }}</td>
            <td>{{ p.created_at ? new Date(p.created_at).toLocaleTimeString() : '—' }}</td>
          </tr>
          <tr v-if="!cashPayments.length && !loading">
            <td colspan="4" class="muted">{{ $t('payments.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card" style="padding: 20px;">
      <h3 style="margin: 0 0 12px;"><i class="fas fa-scroll" style="color: var(--mrk-blue);"></i> {{ $t('receptionPanel.nightAuditTransactions') }}</h3>
      <div v-if="loading" class="alert alert-info" style="margin: 0;">{{ $t('common.loading') }}</div>
      <div v-else-if="!transactions.length" class="muted" style="text-align: center; padding: 16px;">
        {{ $t('receptionPanel.noTransactions') }}
      </div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>{{ $t('nightAudit.description') }}</th>
            <th>{{ $t('receptionPanel.amount') }}</th>
            <th>{{ $t('receptionPanel.postedAt') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="txn in transactions" :key="txn.adjustment_id">
            <td>{{ txn.description || txn.charge_type }}</td>
            <td>{{ fmt(txn.total_amount) }}</td>
            <td>{{ txn.created_at ? new Date(txn.created_at).toLocaleTimeString() : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { paymentApi, nightAuditApi } from '@/api'

const { t } = useI18n()

const today = new Date().toISOString().slice(0, 10)
const selectedDate = ref(today)
const cashPayments = ref([])
const transactions = ref([])
const loading = ref(false)
const success = ref('')
const error = ref('')

const fmt = (n) => 'TZS ' + Number(n || 0).toLocaleString()

const cashReceived = computed(() => cashPayments.value.reduce((s, p) => s + Number(p.amount || 0), 0))
const cashTransactions = computed(() => transactions.value.reduce((s, txn) => s + Math.abs(Number(txn.total_amount || 0)), 0))
const netCash = computed(() => cashReceived.value - cashTransactions.value)

async function load() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const [payRes, txnRes] = await Promise.all([
      paymentApi.index({ method: 'cash', from: selectedDate.value, to: selectedDate.value, per_page: 100 }),
      nightAuditApi.transactions({ date: selectedDate.value }),
    ])
    cashPayments.value = Array.isArray(payRes.data) ? payRes.data : payRes.data?.data || []
    transactions.value = txnRes.data?.adjustments || txnRes.data?.data || []
  } catch (err) {
    error.value = err.response?.data?.message || t('payments.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>