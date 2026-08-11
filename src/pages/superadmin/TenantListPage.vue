<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('superadmin.tenantListTitle') }}</h1>
        <p class="muted">{{ $t('superadmin.tenantListSubtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load"><i class="fas fa-rotate"></i> {{ $t('superadmin.refresh')
          }}</button>
        <button class="btn btn-primary" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('superadmin.newTenant')
          }}</button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filters for search text, tenant status and plan; all trigger a reload -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input v-model="search" type="search" class="input" placeholder="Search hotels..." @input="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('superadmin.status') }}</label>
          <SearchableSelect v-model="status" :options="statusOptions" :empty-label="$t('common.all')" @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('superadmin.plan') }}</label>
          <SearchableSelect v-model="plan" :options="planOptions" :empty-label="$t('common.all')" @change="load" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters"><i class="fas fa-filter-circle-xmark"></i> {{
            $t('common.clear') }}</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('superadmin.loading') }}</div>

    <!-- Tenant table with a status-specific action per row -->
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>{{ $t('superadmin.tenant') }}</th>
            <th>{{ $t('superadmin.tableContact') }}</th>
            <th>{{ $t('superadmin.tableLocation') }}</th>
            <th>{{ $t('superadmin.status') }}</th>
            <th>{{ $t('superadmin.plan') }}</th>
            <th>{{ $t('superadmin.staff') }}</th>
            <th>{{ $t('superadmin.rooms') }}</th>
            <th>{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tenant in tenants" :key="tenant.tenant_id">
            <td>
              <router-link :to="{ name: 'superadmin-tenant-detail', params: { id: tenant.tenant_id } }"
                class="tenant-name">
                {{ tenant.hotel_name }}
              </router-link>
              <div class="muted">{{ tenant.subdomain }}</div>
            </td>
            <td>
              {{ tenant.contact_person }}
              <div class="muted">{{ tenant.email }}</div>
            </td>
            <td>{{ [tenant.city, tenant.country].filter(Boolean).join(', ') || '-' }}</td>
            <td><span class="badge" :class="statusBadge(tenant.status)">{{ tenant.status }}</span></td>
            <td>{{ tenant.subscription_plan }}</td>
            <td>{{ tenant.staff_count ?? '-' }}</td>
            <td>{{ tenant.room_count ?? '-' }}</td>
            <td>
              <div class="actions">
                <button v-if="tenant.status === 'pending'" class="btn btn-sm btn-success" @click="approve(tenant)">
                  {{ $t('superadmin.approve') }}
                </button>
                <button v-if="tenant.status === 'pending'" class="btn btn-sm btn-danger" @click="reject(tenant)">
                  {{ $t('superadmin.reject') }}
                </button>
                <button v-if="tenant.status === 'active'" class="btn btn-sm btn-danger" @click="suspend(tenant)">
                  {{ $t('superadmin.suspend') }}
                </button>
                <button v-if="tenant.status === 'suspended'" class="btn btn-sm btn-success" @click="reactivate(tenant)">
                  {{ $t('superadmin.reactivate') }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!tenants.length && !loading">
            <td colspan="8" class="muted">{{ $t('superadmin.empty') }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
        <div class="modal">
          <div class="modal-head">
            <h2><i class="fas fa-hotel"></i> {{ $t('superadmin.newTenant') }}</h2>
            <button class="modal-close" @click="showCreate = false"><i class="fas fa-xmark"></i></button>
          </div>
          <p class="muted">{{ $t('superadmin.onboardNote') }}</p>

          <div v-if="createError" class="alert alert-error">{{ createError }}</div>

          <form @submit.prevent="createHotel">
            <div class="form-grid">
              <div class="form-group">
                <label>{{ $t('superadmin.tenantName') }} *</label>
                <input v-model="form.hotel_name" type="text" class="input" required />
              </div>
              <div class="form-group">
                <label>{{ $t('superadmin.subdomain') }} *</label>
                <input v-model="form.subdomain" type="text" class="input" placeholder="my-hotel" required />
              </div>
              <div class="form-group">
                <label>{{ $t('superadmin.contactPerson') }}</label>
                <input v-model="form.contact_person" type="text" class="input" required />
              </div>
              <div class="form-group">
                <label>{{ $t('superadmin.email') }} *</label>
                <input v-model="form.email" type="email" class="input" required />
              </div>
              <div class="form-group">
                <label>{{ $t('superadmin.phone') }}</label>
                <PhoneInput v-model="form.phone" v-model:countryCode="form.country_code" />
              </div>
              <div class="form-group">
                <label>{{ $t('superadmin.city') }}</label>
                <input v-model="form.city" type="text" class="input" />
              </div>
              <div class="form-group">
                <label>{{ $t('superadmin.country') }}</label>
                <input v-model="form.country" type="text" class="input" />
              </div>
              <div class="form-group">
                <label>{{ $t('superadmin.tin') }}</label>
                <input v-model="form.tin" type="text" class="input" :placeholder="$t('superadmin.tinPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ $t('superadmin.vrn') }}</label>
                <input v-model="form.vrn" type="text" class="input" :placeholder="$t('superadmin.vrnPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ $t('superadmin.subscriptionPlan') }}</label>
                <SearchableSelect v-model="form.subscription_plan" :options="planOptions" />
              </div>
            </div>
            <div class="modal-foot">
              <button type="button" class="btn btn-secondary" @click="showCreate = false">{{ $t('common.cancel')
                }}</button>
              <button type="submit" class="btn btn-primary" :disabled="creating">
                <i class="fas fa-plus"></i> {{ creating ? $t('superadmin.creating') : $t('superadmin.createTenant') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { tenantApi } from '@/api'
import PhoneInput from '@/components/PhoneInput.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { normalizePhoneNumber } from '@/utils/phone'

const { t } = useI18n()

const tenants = ref([])
const search = ref('')
const status = ref('')
const plan = ref('')
const loading = ref(false)
const error = ref('')
const success = ref('')

const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const form = ref({
  hotel_name: '',
  subdomain: '',
  contact_person: '',
  email: '',
  phone: '',
  country_code: 'TZ',
  city: '',
  country: '',
  tin: '',
  vrn: '',
  subscription_plan: 'trial',
})

const statusOptions = computed(() => [
  { value: 'pending', label: t('superadmin.statusPending') },
  { value: 'active', label: t('superadmin.statusActive') },
  { value: 'suspended', label: t('superadmin.statusSuspended') },
  { value: 'cancelled', label: t('superadmin.statusCancelled') },
])

const planOptions = computed(() => [
  { value: 'trial', label: t('superadmin.planTrial') },
  { value: 'basic', label: t('superadmin.planBasic') },
  { value: 'premium', label: t('superadmin.planPremium') },
  { value: 'enterprise', label: t('superadmin.planEnterprise') },
])

function statusBadge(s) {
  const map = { active: 'badge-green', pending: 'badge-yellow', suspended: 'badge-red', cancelled: 'badge-gray' }
  return map[s] || 'badge-gray'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await tenantApi.index({
      status: status.value,
      plan: plan.value,
      search: search.value || undefined,
    })
    tenants.value = res.data.data || []
  } catch (err) {
    error.value = err.response?.data?.message || t('superadmin.loadError')
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  status.value = ''
  plan.value = ''
  search.value = ''
  load()
}

function openCreate() {
  createError.value = ''
  form.value = { ...form.value, hotel_name: '', subdomain: '', contact_person: '', email: '', phone: '', country_code: 'TZ', city: '', country: '', tin: '', vrn: '' }
  showCreate.value = true
}

async function createHotel() {
  createError.value = ''
  creating.value = true
  try {
    const res = await tenantApi.store({ ...form.value, phone: normalizePhoneNumber(form.value.phone, form.value.country_code || 'TZ') })
    showCreate.value = false
    success.value = res.data.message || t('superadmin.created')
    await load()
  } catch (err) {
    const messages = err.response?.data?.errors
    createError.value = messages
      ? Object.values(messages).flat().join(' ')
      : err.response?.data?.message || t('superadmin.createError')
  } finally {
    creating.value = false
  }
}

async function runAction(id, fn, message) {
  error.value = ''
  try {
    await fn(id)
    await load()
    window.alert(message)
  } catch (err) {
    error.value = err.response?.data?.message || t('common.actionFailed')
  }
}

const approve = (tenant) => runAction(tenant.tenant_id, tenantApi.approve, t('superadmin.approvedMsg', { name: tenant.hotel_name }))
const reject = (tenant) => runAction(tenant.tenant_id, tenantApi.reject, t('superadmin.rejectedMsg', { name: tenant.hotel_name }))
const suspend = (tenant) => runAction(tenant.tenant_id, tenantApi.suspend, t('superadmin.suspendedMsg', { name: tenant.hotel_name }))
const reactivate = (tenant) => runAction(tenant.tenant_id, tenantApi.reactivate, t('superadmin.reactivatedMsg', { name: tenant.hotel_name }))

onMounted(load)
</script>

<style scoped>
.dashboard-page {
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

.page-head .muted {
  margin-top: 4px;
}

.head-actions {
  display: flex;
  gap: 10px;
}

.filter-bar {
  margin-bottom: 16px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  align-items: end;
}

.table-wrap {
  overflow-x: auto;
}

.muted {
  color: #888;
  font-size: 12px;
}

.tenant-name {
  color: #005EB8;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: #fff;
  border-radius: 8px;
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.modal-head h2 {
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-head h2 i {
  color: #005EB8;
}

.modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #999;
  cursor: pointer;
  padding: 4px;
}

.modal-close:hover {
  color: #333;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 20px 16px;
  }

  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
