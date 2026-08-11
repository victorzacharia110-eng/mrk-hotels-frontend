<template>
  <div class="accounting-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('accounting.title') }}</h1>
        <p class="muted">{{ $t('accounting.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="reload"><i class="fas fa-rotate"></i> {{ $t('common.refresh')
          }}</button>
      </div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ activeTab === 'ledger' ? $t('accounting.from') : $t('accounting.asOf') }}</label>
          <input v-model="from" type="date" class="input" @change="reload" />
        </div>
        <div class="form-group">
          <label>{{ $t('accounting.to') }}</label>
          <input v-model="to" type="date" class="input" @change="reload" />
        </div>
      </div>
    </div>

    <!-- Accounting report type tabs: trial balance, balance sheet, general ledger -->
    <div class="tabs">
      <button v-for="tab in tabs" :key="tab.key" class="tab-btn" :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab.key)">
        <i :class="tab.icon"></i> {{ $t(tab.label) }}
      </button>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('accounting.loading') }}</div>

    <template v-else>
      <!-- Trial balance: account rows with debits/credits and a revenue breakdown -->
      <div v-if="activeTab === 'trial'" class="card dash-section">
        <div class="section-header-row">
          <h2><i class="fas fa-scale-balanced"></i> {{ $t('accounting.trialBalance') }}</h2>
          <span class="badge" :class="trial.balanced ? 'badge-ok' : 'badge-bad'">
            {{ trial.balanced ? $t('accounting.balanced') : $t('accounting.unbalanced') }}
          </span>
        </div>
        <div v-if="trial.accounts?.length" class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ $t('accounting.account') }}</th>
                <th class="num">{{ $t('accounting.type') }}</th>
                <th class="num">{{ $t('accounting.debit') }}</th>
                <th class="num">{{ $t('accounting.credit') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in trial.accounts" :key="row.account">
                <td>{{ row.account }}</td>
                <td class="num capitalize">{{ row.type }}</td>
                <td class="num">{{ money(row.debit) }}</td>
                <td class="num">{{ money(row.credit) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2"><strong>{{ $t('accounting.total') }}</strong></td>
                <td class="num"><strong>{{ money(trial.total_debit) }}</strong></td>
                <td class="num"><strong>{{ money(trial.total_credit) }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div v-else class="muted">{{ $t('accounting.noData') }}</div>

        <div v-if="trial.revenue" class="summary-block">
          <h3>{{ $t('accounting.revenueBreakdown') }}</h3>
          <div class="summary-row" v-for="(amount, key) in trial.revenue" :key="key" v-show="key !== 'total'">
            <span class="capitalize">{{ $t('accounting.' + key) }}</span>
            <span class="price">{{ money(amount) }}</span>
          </div>
          <div class="summary-row total-row">
            <span><strong>{{ $t('accounting.revenueTotal') }}</strong></span>
            <span class="price">{{ money(trial.revenue.total) }}</span>
          </div>
        </div>
      </div>

      <!-- Balance sheet: assets vs equity totals -->
      <div v-else-if="activeTab === 'balance'" class="card dash-section">
        <div class="section-header-row">
          <h2><i class="fas fa-scale-unbalanced"></i> {{ $t('accounting.balanceSheet') }}</h2>
          <span class="badge" :class="balance.balanced ? 'badge-ok' : 'badge-bad'">
            {{ balance.balanced ? $t('accounting.balanced') : $t('accounting.unbalanced') }}
          </span>
        </div>

        <div class="sheet-grid">
          <div>
            <h3 class="sheet-heading">{{ $t('accounting.assets') }}</h3>
            <div v-for="row in balance.assets" :key="row.account" class="summary-row">
              <span>{{ row.account }}</span>
              <span class="price">{{ money(row.amount) }}</span>
            </div>
            <div v-if="!balance.assets?.length" class="muted">{{ $t('accounting.noData') }}</div>
            <div class="summary-row total-row">
              <span><strong>{{ $t('accounting.total') }}</strong></span>
              <span class="price">{{ money(balance.total_assets) }}</span>
            </div>
          </div>
          <div>
            <h3 class="sheet-heading">{{ $t('accounting.equity') }}</h3>
            <div v-for="row in balance.equity" :key="row.account" class="summary-row">
              <span>{{ row.account }}</span>
              <span class="price">{{ money(row.amount) }}</span>
            </div>
            <div v-if="!balance.equity?.length" class="muted">{{ $t('accounting.noData') }}</div>
            <div class="summary-row total-row">
              <span><strong>{{ $t('accounting.total') }}</strong></span>
              <span class="price">{{ money(balance.total_equity) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- General ledger: dated entries with running balance -->
      <div v-else class="card dash-section">
        <div class="section-header-row">
          <h2><i class="fas fa-book"></i> {{ $t('accounting.generalLedger') }}</h2>
          <span class="muted">{{ $t('accounting.openingBalance') }}: <strong>{{ money(ledger.opening_balance)
              }}</strong></span>
        </div>
        <div v-if="ledger.entries?.length" class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ $t('accounting.date') }}</th>
                <th>{{ $t('accounting.reference') }}</th>
                <th>{{ $t('accounting.description') }}</th>
                <th class="num">{{ $t('accounting.debit') }}</th>
                <th class="num">{{ $t('accounting.credit') }}</th>
                <th class="num">{{ $t('accounting.balance') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in ledger.entries" :key="i">
                <td>{{ shortDateTime(row.date) }}</td>
                <td class="mono">{{ row.reference }}</td>
                <td>{{ row.description }}</td>
                <td class="num">{{ row.debit ? money(row.debit) : '—' }}</td>
                <td class="num">{{ row.credit ? money(row.credit) : '—' }}</td>
                <td class="num"><strong>{{ money(row.balance) }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="muted">{{ $t('accounting.noData') }}</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { accountingApi } from '@/api'

// Available accounting report tabs and their icons/labels.
const tabs = [
  { key: 'trial', icon: 'fas fa-scale-balanced', label: 'accounting.trialBalance' },
  { key: 'balance', icon: 'fas fa-scale-unbalanced', label: 'accounting.balanceSheet' },
  { key: 'ledger', icon: 'fas fa-book', label: 'accounting.generalLedger' },
]

// Active tab, loading/error flags, date range filter, and per-report data.
const activeTab = ref('trial')
const loading = ref(false)
const error = ref('')
const from = ref('')
const to = ref(today())
const trial = ref({})
const balance = ref({})
const ledger = ref({})

/** Returns today's date as an ISO string (YYYY-MM-DD). */
function today() {
  return new Date().toISOString().slice(0, 10)
}

/** Formats a numeric value as a TZS currency string for display. */
function money(value) {
  return `TZS ${Number(value || 0).toLocaleString()}`
}

/** Formats an ISO date/time into a dd/mm/yyyy hh:mm string. */
function shortDateTime(d) {
  const date = new Date(d)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${date.getFullYear()} ${hh}:${min}`
}

/** Switches the active report tab and reloads its data.
 * @param {string} tab - key of the report tab to activate
 */
function switchTab(tab) {
  activeTab.value = tab
  reload()
}

/** Fetches the report for the active tab, honouring the date range filter. */
async function reload() {
  loading.value = true
  error.value = ''
  const params = { from: from.value || undefined, to: to.value || undefined }
  try {
    if (activeTab.value === 'trial') {
      trial.value = (await accountingApi.trialBalance(params)).data
    } else if (activeTab.value === 'balance') {
      balance.value = (await accountingApi.balanceSheet(params)).data
    } else {
      ledger.value = (await accountingApi.generalLedger(params)).data
    }
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  } finally {
    loading.value = false
  }
}

onMounted(reload)
</script>

<style scoped>
.accounting-page {
  padding: 32px 20px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.page-head h1 {
  font-size: 28px;
  font-weight: 800;
}

.head-actions {
  display: flex;
  gap: 10px;
}

.filter-bar {
  margin-bottom: 16px;
  padding: 16px 20px;
}

.filter-grid {
  display: flex;
  gap: 12px;
  align-items: end;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 10px 16px;
  border: 1px solid #e2e2e2;
  background: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #555;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-btn.active {
  background: #005EB8;
  border-color: #005EB8;
  color: #fff;
}

.dash-section {
  padding: 24px;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.section-header-row h2 {
  font-size: 17px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-header-row h2 i {
  color: #005EB8;
}

.badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
}

.badge-ok {
  background: #e8f5e9;
  color: #1e7e34;
}

.badge-bad {
  background: #fdecea;
  color: #c0392b;
}

.table-wrap {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.data-table thead th {
  background: #fafafa;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #888;
}

.data-table tfoot td {
  border-top: 2px solid #e2e2e2;
  font-weight: 700;
}

.num {
  text-align: right;
  white-space: nowrap;
}

.capitalize {
  text-transform: capitalize;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #555;
}

.summary-block {
  margin-top: 24px;
  border-top: 1px solid #f0f0f0;
  padding-top: 16px;
}

.summary-block h3,
.sheet-heading {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #005EB8;
  margin-bottom: 10px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
}

.summary-row:last-child {
  border-bottom: none;
}

.total-row {
  border-top: 2px solid #e2e2e2;
  margin-top: 6px;
  padding-top: 10px;
}

.price {
  font-weight: 700;
  color: #005EB8;
}

.sheet-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.muted {
  color: #888;
  font-size: 13px;
}

@media (max-width: 768px) {
  .accounting-page {
    padding: 20px 16px;
  }

  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-grid {
    flex-direction: column;
    align-items: stretch;
  }

  .sheet-grid {
    grid-template-columns: 1fr;
  }
}
</style>
