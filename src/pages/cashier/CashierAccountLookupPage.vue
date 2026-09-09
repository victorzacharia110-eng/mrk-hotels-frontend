<!--
  CashierAccountLookupPage — two counter lookups in one screen:
    · Accounts  — search the guest book and surface each account's running
      balance so cashiers can chase debtors (negative = the guest owes).
    · Creditors — EVERY organization that extends the hotel credit: suppliers
      from the procurement book plus banks, lenders, leasing firms, landlords,
      contractors and utilities, with payment terms, credit limit and the
      balance currently owed. Hotel admin / manager / accountant / store users
      can also add, edit and remove the non-supplier creditor accounts here.
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
        <div class="panel-head-actions">
          <div class="sm-search">
            <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
            <input v-model="search" type="search" :placeholder="searchHint"
              @keyup.enter="submitSearch" @input="debouncedSearch" />
          </div>
          <button v-if="tab === 'creditors' && canManageCreditors" type="button" class="btn btn-brand" @click="openNew">
            <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('cashier.accounts.newCreditor') }}
          </button>
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
                <th>{{ $t('cashier.accounts.type') }}</th>
                <th>{{ $t('cashier.accounts.contactPerson') }}</th>
                <th>{{ $t('cashier.accounts.mobile') }}</th>
                <th>{{ $t('cashier.accounts.account') }}</th>
                <th>{{ $t('cashier.accounts.paymentTerms') }}</th>
                <th class="num">{{ $t('cashier.accounts.creditLimit') }}</th>
                <th class="num">{{ $t('cashier.accounts.currentBalance') }}</th>
                <th v-if="canManageCreditors">{{ $t('cashier.accounts.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="creditor in creditors" :key="creditor.creditor_id">
                <td>
                  <strong>{{ creditor.name }}</strong>
                  <span v-if="creditor.status === 'blocked'" class="cred-badge t-blocked">{{ $t('cashier.accounts.statuses.blocked') }}</span>
                </td>
                <td><span class="cred-badge" :class="`t-${creditor.type}`">{{ creditorTypeLabel(creditor.type) }}</span></td>
                <td>{{ creditor.contact_person || '—' }}</td>
                <td>{{ creditor.phone || '—' }}</td>
                <td>{{ creditor.account_number || '—' }}</td>
                <td>{{ creditor.payment_terms || '—' }}</td>
                <td class="num">{{ fmtBalance(creditor.credit_limit) }}</td>
                <td class="num"><strong :class="balanceClass(creditor.current_balance)">{{ fmtBalance(creditor.current_balance) }}</strong></td>
                <td v-if="canManageCreditors" class="cred-actions">
                  <template v-if="creditor.type === 'supplier'">
                    <span class="muted">—</span>
                  </template>
                  <template v-else>
                    <button type="button" class="icon-btn" :aria-label="$t('cashier.accounts.editCreditor')"
                      @click="openEdit(creditor)">
                      <i class="fas fa-pen" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="icon-btn danger" :aria-label="$t('common.delete')"
                      @click="removeCreditor(creditor)">
                      <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                  </template>
                </td>
              </tr>
              <tr v-if="!creditors.length && !loading">
                <td :colspan="canManageCreditors ? 9 : 8" class="empty"><i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.accounts.noCreditors') }}</td>
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

    <!-- Creditor editor: register or update an organization that credits the hotel. -->
    <div v-if="modalOpen" class="sm-modal-backdrop" @click.self="modalOpen = false">
      <div class="sm-modal sm-modal--wide" role="dialog" aria-modal="true">
        <div class="sm-modal-head">
          <h3>
            <i class="fas fa-building" aria-hidden="true"></i>
            {{ editing ? $t('cashier.accounts.editCreditor') : $t('cashier.accounts.newCreditor') }}
          </h3>
          <button type="button" class="sm-modal-close" :aria-label="$t('common.close')" @click="modalOpen = false">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        <form class="cred-form" @submit.prevent="submitCreditor">
          <div class="form-grid">
            <label class="field">
              <span>{{ $t('cashier.accounts.organizationName') }} *</span>
              <input v-model.trim="form.organization_name" type="text" required maxlength="255" />
            </label>
            <label class="field">
              <span>{{ $t('cashier.accounts.creditorType') }} *</span>
              <select v-model="form.category" required>
                <option v-for="type in creditorTypes" :key="type" :value="type">
                  {{ creditorTypeLabel(type) }}
                </option>
              </select>
            </label>
            <label class="field">
              <span>{{ $t('cashier.accounts.accountNumber') }}</span>
              <input v-model.trim="form.account_number" type="text" maxlength="100" />
            </label>
            <label class="field">
              <span>{{ $t('cashier.accounts.contactPerson') }}</span>
              <input v-model.trim="form.contact_person" type="text" maxlength="255" />
            </label>
            <label class="field">
              <span>{{ $t('cashier.accounts.mobile') }}</span>
              <input v-model.trim="form.phone" type="tel" maxlength="20" />
            </label>
            <label class="field">
              <span>{{ $t('cashier.accounts.email') }}</span>
              <input v-model.trim="form.email" type="email" maxlength="255" />
            </label>
            <label class="field">
              <span>{{ $t('cashier.accounts.paymentTerms') }}</span>
              <input v-model.trim="form.payment_terms" type="text" maxlength="255" placeholder="Net 30" />
            </label>
            <label class="field">
              <span>{{ $t('cashier.accounts.creditLimit') }}</span>
              <input v-model="form.credit_limit" type="number" min="0" step="0.01" />
            </label>
            <label class="field">
              <span>{{ $t('cashier.accounts.currentBalance') }}</span>
              <input v-model="form.current_balance" type="number" step="0.01" />
            </label>
            <label class="field">
              <span>{{ $t('cashier.accounts.status') }}</span>
              <select v-model="form.status">
                <option v-for="status in ['active', 'inactive', 'blocked']" :key="status" :value="status">
                  {{ $t(`cashier.accounts.statuses.${status}`) }}
                </option>
              </select>
            </label>
            <label class="field field--full">
              <span>{{ $t('cashier.accounts.address') }}</span>
              <input v-model.trim="form.address" type="text" />
            </label>
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="sm-modal-foot">
            <button type="button" class="btn btn-secondary" @click="modalOpen = false">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-brand" :disabled="saving">
              <i v-if="saving" class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              {{ $t('common.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { posApi } from '@/api'
import { getCountries, loadLocationData } from '@/utils/locations'
import { toast } from '@/utils/toast'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const { t } = useI18n()
const authStore = useAuthStore()

const MANAGER_ROLES = ['hotel_admin', 'manager', 'accountant', 'store_manager']
const creditorTypes = ['bank', 'lending', 'leasing', 'landlord', 'contractor', 'utility', 'other']

const tab = ref('accounts')
const accounts = ref([])
const creditors = ref([])
const meta = ref({ current_page: 1, last_page: 1, total: 0, per_page: 25 })
const loading = ref(false)
const search = ref('')

const modalOpen = ref(false)
const editing = ref(null)
const saving = ref(false)
const formError = ref('')
const form = ref(emptyForm())

let debounceTimer = null

const canManageCreditors = computed(() => MANAGER_ROLES.includes(authStore.user?.user_role))

const searchHint = computed(() => tab.value === 'accounts'
  ? t('cashier.accounts.searchHint')
  : t('cashier.accounts.searchCreditorsHint'))

function creditorTypeLabel(type) {
  return t(`cashier.accounts.creditorTypes.${type || 'other'}`)
}

function emptyForm() {
  return {
    organization_name: '',
    category: 'bank',
    account_number: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    payment_terms: '',
    credit_limit: '',
    current_balance: '',
    status: 'active',
  }
}

function fillForm(creditor) {
  form.value = {
    organization_name: creditor.name || '',
    category: creditor.type === 'supplier' ? 'other' : (creditor.type || 'other'),
    account_number: creditor.account_number || '',
    contact_person: creditor.contact_person || '',
    phone: creditor.phone || '',
    email: creditor.email || '',
    address: creditor.address || '',
    payment_terms: creditor.payment_terms || '',
    credit_limit: creditor.credit_limit ?? '',
    current_balance: creditor.current_balance ?? '',
    status: creditor.status || 'active',
  }
}

function openNew() {
  editing.value = null
  form.value = emptyForm()
  formError.value = ''
  modalOpen.value = true
}

function openEdit(creditor) {
  editing.value = creditor
  fillForm(creditor)
  formError.value = ''
  modalOpen.value = true
}

async function submitCreditor() {
  saving.value = true
  formError.value = ''
  try {
    if (editing.value) {
      await posApi.updateCreditor(editing.value.creditor_id, form.value)
    } else {
      await posApi.saveCreditor(form.value)
    }
    toast(t('cashier.accounts.saved'))
    modalOpen.value = false
    await load()
  } catch (err) {
    formError.value = err.response?.data?.message || t('common.loadError')
  } finally {
    saving.value = false
  }
}

async function removeCreditor(creditor) {
  if (!window.confirm(t('cashier.accounts.deleteConfirm'))) return
  try {
    await posApi.deleteCreditor(creditor.creditor_id)
    toast(t('common.deleteSuccess'))
    await load()
  } catch (err) {
    toast(err.response?.data?.message || t('common.loadError'), 'error')
  }
}

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
.panel-head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-left: auto; }
.panel-head-actions .sm-search { min-width: 240px; }

.cred-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border-radius: 999px;
  padding: 3px 9px;
  background: #eef2f7;
  color: #475569;
  margin-right: 6px;
}

.cred-badge.t-supplier { background: #e0f2fe; color: #0369a1; }
.cred-badge.t-bank { background: #dbeafe; color: #1d4ed8; }
.cred-badge.t-lending { background: #ede9fe; color: #6d28d9; }
.cred-badge.t-leasing { background: #cffafe; color: #0e7490; }
.cred-badge.t-landlord { background: #fef3c7; color: #92400e; }
.cred-badge.t-contractor { background: #d1fae5; color: #047857; }
.cred-badge.t-utility { background: #fef9c3; color: #a16207; }
.cred-badge.t-other { background: #eef2f7; color: #475569; }
.cred-badge.t-blocked { background: #fee2e2; color: #b91c1c; }

.cred-actions { white-space: nowrap; }
.icon-btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
}
.icon-btn + .icon-btn { margin-left: 6px; }
.icon-btn.danger { color: #b91c1c; }
.icon-btn:hover { background: #f1f5f9; }

.sm-modal--wide { width: min(720px, 94vw); }
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  padding: 18px;
}
.field { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: #64748b; }
.field--full { grid-column: 1 / -1; }
.field input,
.field select {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  background: #fff;
}
.form-error {
  margin: 0 18px 6px;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
}
</style>