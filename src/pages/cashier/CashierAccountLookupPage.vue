<!--
  CashierAccountLookupPage — two counter lookups in one screen:
    · Accounts  — search the guest book and surface each account's running
      balance so cashiers can chase debtors (negative = the guest owes).
    · Creditors — the companies that extend the hotel credit (suppliers),
      with payment terms, credit limit and the balance currently owed.
  Matches the client's "Account Lookup" screen (Name / City / Country /
  Mobile / Email / Balance) plus the creditor list.
  -->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head">
        <div class="status-tabs" role="tablist">
          <button type="button" class="status-tab" :class="{ active: tab === 'accounts' }"
            role="tab" :aria-selected="tab === 'accounts'"
            @click="switchTab('accounts')">
            <i class="fas fa-users" aria-hidden="true"></i> {{ $t('cashier.accounts.tabAccounts') }}
          </button>
          <button type="button" class="status-tab" :class="{ active: tab === 'creditors' }"
            role="tab" :aria-selected="tab === 'creditors'"
            @click="switchTab('creditors')">
            <i class="fas fa-building" aria-hidden="true"></i> {{ $t('cashier.accounts.tabCreditors') }}
          </button>
        </div>
        <div class="sm-search">
          <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
          <input v-model="search" type="search" :placeholder="searchHint"
            @keyup.enter="submitSearch" @input="debouncedSearch" />
        </div>
      </div>

      <div class="table-scroll">
        <SkeletonLoader v-if="loading" variant="table" :count="6" :cols="7" />
        <table v-else class="sm-table">
          <template v-if="tab === 'accounts'">
            <thead>
              <tr>
                <th>{{ $t('cashier.accounts.name') }}</th>
                <th>{{ $t('cashier.accounts.city') }}</th>
                <th>{{ $t('cashier.accounts.country') }}</th>
                <th>{{ $t('cashier.accounts.mobile') }}</th>
                <th>{{ $t('cashier.accounts.email') }}</th>
                <th class="num">{{ $t('cashier.accounts.balance') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="account in accounts" :key="account.guest_id">
                <td><strong>{{ account.full_name }}</strong></td>
                <td>{{ account.city || '—' }}</td>
                <td>{{ countryName(account.country_code) }}</td>
                <td>{{ account.mobile || '—' }}</td>
                <td>{{ account.email || '—' }}</td>
                <td class="num"><strong :class="balanceClass(account.balance)">{{ fmtBalance(account.balance) }}</strong></td>
              </tr>
              <tr v-if="!accounts.length && !loading">
                <td colspan="6" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.accounts.noData') }}</td>
              </tr>
            </tbody>
          </template>

          <template v-else>
            <thead>
              <tr>
                <th>{{ $t('cashier.accounts.creditorName') }}</th>
                <th>{{ $t('cashier.accounts.contactPerson') }}</th>
                <th>{{ $t('cashier.accounts.mobile') }}</th>
                <th>{{ $t('cashier.accounts.category') }}</th>
                <th>{{ $t('cashier.accounts.paymentTerms') }}</th>
                <th class="num">{{ $t('cashier.accounts.creditLimit') }}</th>
                <th class="num">{{ $t('cashier.accounts.currentBalance') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="creditor in creditors" :key="creditor.supplier_id">
                <td><strong>{{ creditor.supplier_name }}</strong></td>
                <td>{{ creditor.contact_person || '—' }}</td>
                <td>{{ creditor.phone || '—' }}</td>
                <td>{{ creditor.category || '—' }}</td>
                <td>{{ creditor.payment_terms || '—' }}</td>
                <td class="num">{{ fmtBalance(creditor.credit_limit) }}</td>
                <td class="num"><strong :class="balanceClass(creditor.current_balance)">{{ fmtBalance(creditor.current_balance) }}</strong></td>
              </tr>
              <tr v-if="!creditors.length && !loading">
                <td colspan="7" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.accounts.noCreditors') }}</td>
              </tr>
            </tbody>
          </template>
        </table>
      </div>

      <div v-if="meta.total > meta.per_page" class="pagination">
        <button class="btn btn-sm btn-secondary" :disabled="meta.current_page <= 1" @click="goPage(meta.current_page - 1)">
          {{ $t('common.previous') }}
        </button>
        <span class="muted">{{ $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page }) }}</span>
        <button class="btn btn-sm btn-secondary" :disabled="meta.current_page >= meta.last_page" @click="goPage(meta.current_page + 1)">
          {{ $t('common.next') }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { posApi } from '@/api'
import { getCountries, loadLocationData } from '@/utils/locations'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const { t } = useI18n()

const tab = ref('accounts')
const accounts = ref([])
const creditors = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 25 })
const loading = ref(false)
const search = ref('')

let debounceTimer = null

const searchHint = computed(() => tab.value === 'accounts'
  ? t('cashier.accounts.searchHint')
  : t('cashier.accounts.searchCreditorsHint'))

async function load() {
  loading.value = true
  try {
    const params = {
      search: search.value.trim() || undefined,
      per_page: meta.value.per_page,
      page: meta.value.current_page,
    }
    if (tab.value === 'accounts') {
      const { data } = await posApi.accounts(params)
      accounts.value = data.accounts || []
      meta.value = data.pagination || meta.value
    } else {
      const { data } = await posApi.creditors(params)
      creditors.value = data.creditors || []
      meta.value = data.pagination || meta.value
    }
  } finally {
    loading.value = false
  }
}

function submitSearch() {
  meta.value.current_page = 1
  load()
}

function debouncedSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(submitSearch, 400)
}

function goPage(page) {
  meta.value.current_page = page
  load()
}

function switchTab(next) {
  if (next === tab.value) return
  tab.value = next
  search.value = ''
  meta.value = { current_page: 1, last_page: 1, total: 0, per_page: 25 }
  load()
}

const countryCache = ref([])

function countryName(code) {
  if (!code) return '—'
  const match = countryCache.value.find((c) => c.code === code)
  return match?.name || code
}

function fmtBalance(balance) {
  if (balance == null) return '—'
  const sign = Number(balance) < 0 ? '-' : ''
  return `${sign}TZS ${Math.abs(Number(balance)).toLocaleString()}`
}

function balanceClass(balance) {
  const value = Number(balance)
  if (value < 0) return 'debt'
  if (value > 0) return 'credit'
  return ''
}

onMounted(() => {
  load()
  loadLocationData().then(() => {
    countryCache.value = getCountries()
  })
})
onBeforeUnmount(() => clearTimeout(debounceTimer))
</script>

<style scoped>
.muted { font-size: 12px; color: #64748b; }
.num { text-align: right; }
td.num { font-variant-numeric: tabular-nums; }
.debt { color: #dc2626; }
.credit { color: #15803d; }
.table-scroll { overflow-x: auto; }
.pagination { padding: 12px 16px; border-top: 1px solid #e2e8f0; }
.panel-head { flex-wrap: wrap; row-gap: 10px; }
.panel-head .sm-search { min-width: 240px; }
</style>