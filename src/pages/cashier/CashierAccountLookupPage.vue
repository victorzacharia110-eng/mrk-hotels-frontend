<!--
  CashierAccountLookupPage — search the guest book and surface each account's
  running balance, so cashiers can chase debtors at the counter. Matches the
  client's "Account Lookup" screen (Name / City / Country / Mobile / Email /
  Balance). Negative balance = the guest still owes.
-->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head">
        <h2><i class="fas fa-users" aria-hidden="true"></i> {{ $t('cashier.accounts.title') }}</h2>
        <div class="sm-search">
          <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
          <input v-model="search" type="search" :placeholder="$t('cashier.accounts.searchHint')"
            @keyup.enter="submitSearch" @input="debouncedSearch" />
        </div>
      </div>

      <div class="table-scroll">
        <SkeletonLoader v-if="loading" variant="table" :count="6" :cols="6" />
        <table v-else class="sm-table">
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
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { posApi } from '@/api'
import { getCountries, loadLocationData } from '@/utils/locations'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const accounts = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 25 })
const loading = ref(false)
const search = ref('')

let debounceTimer = null

async function load() {
  loading.value = true
  try {
    const { data } = await posApi.accounts({
      search: search.value.trim() || undefined,
      per_page: meta.value.per_page,
      page: meta.value.current_page,
    })
    accounts.value = data.accounts || []
    meta.value = data.pagination || meta.value
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
.panel-head .sm-search { min-width: 240px; }
</style>