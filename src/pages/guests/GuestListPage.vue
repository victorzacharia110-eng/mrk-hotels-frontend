<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('guests.title') }}</h1>
        <p class="muted">{{ $t('guests.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load"><i class="fas fa-rotate"></i> {{ $t('guests.refresh')
        }}</button>
        <button v-if="canEdit" class="btn btn-primary" @click="openCreate"><i class="fas fa-plus"></i> {{
          $t('guests.newGuest') }}</button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input v-model="filters.search" type="text" class="input" :placeholder="$t('guests.searchPlaceholder')"
            @input="triggerSearch" />
        </div>
        <div class="form-group">
          <label>{{ $t('guests.typeVip') }}</label>
          <SearchableSelect
            v-model="filters.vip"
            :options="vipFilterOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('guests.nationality') }}</label>
          <input v-model="filters.nationality" type="text" class="input"
            :placeholder="$t('guests.nationalityPlaceholder')" @input="triggerSearch" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters"><i class="fas fa-filter-circle-xmark"></i> {{
            $t('common.clear') }}</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('guests.loading') }}</div>

    <div v-else class="table-scroll">
      <table class="table">
      <thead>
        <tr>
          <th>{{ $t('guests.tableGuest') }}</th>
          <th>{{ $t('guests.tableContact') }}</th>
          <th>{{ $t('guests.tableId') }}</th>
          <th>{{ $t('guests.nationality') }}</th>
          <th>{{ $t('guests.tableType') }}</th>
          <th>{{ $t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="guest in guests" :key="guest.guest_id">
          <td>
            <strong>{{ guest.full_name }}</strong>
            <span v-if="guest.vip_status" class="badge badge-yellow vip-badge"><i class="fas fa-crown"></i> {{
              $t('guests.typeVip') }}</span>
          </td>
          <td>
            <div>{{ guest.email || '-' }}</div>
            <div class="muted">{{ guest.phone || '-' }}</div>
          </td>
          <td class="capitalize">{{ guest.id_type }} · {{ guest.id_number }}</td>
          <td>{{ guest.nationality || '-' }}</td>
          <td>
            <span class="badge" :class="guest.vip_status ? 'badge-yellow' : 'badge-gray'">
              {{ guest.vip_status ? $t('guests.typeVip') : $t('guests.typeRegular') }}
            </span>
          </td>
          <td>
            <div class="actions">
              <button v-if="canEdit" class="btn btn-sm btn-secondary" @click="openEdit(guest)"><i
                  class="fas fa-pen"></i> {{ $t('common.edit') }}</button>
              <button v-if="canEdit" class="btn btn-sm btn-danger" @click="remove(guest)"><i
                  class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>
        <tr v-if="!guests.length && !loading">
          <td colspan="6" class="muted">{{ $t('guests.empty') }}</td>
        </tr>
      </tbody>
    </table>
    </div>

    <div v-if="meta.total > meta.per_page" class="pagination">
      <button class="btn btn-sm btn-secondary" :disabled="!meta.prev_page_url" @click="goPage(meta.current_page - 1)">{{
        $t('common.previous') }}</button>
      <span class="muted">{{ $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page }) }}</span>
      <button class="btn btn-sm btn-secondary" :disabled="!meta.next_page_url" @click="goPage(meta.current_page + 1)">{{
        $t('common.next') }}</button>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2><i class="fas fa-user"></i> {{ editing ? $t('guests.editGuest') : $t('guests.newGuest') }}</h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('guests.firstName') }}<span class="req">*</span></label>
              <input v-model="form.first_name" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('guests.lastName') }}<span class="req">*</span></label>
              <input v-model="form.last_name" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('guests.email') }}</label>
              <input v-model="form.email" type="email" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('guests.phone') }}<span class="req">*</span></label>
              <PhoneInput
                v-model="form.phone"
                v-model:countryCode="form.country_code"
                :required="true"
              />
            </div>

            <CountryCitySelect
              v-model:country-code="form.country_code"
              v-model:country="form.country"
              v-model:city="form.city"
            />

            <!-- Identification is optional, but both halves go together. -->
            <div class="form-group">
              <label>{{ $t('guests.idTypeOptional') }}</label>
              <SearchableSelect
                v-model="form.id_type"
                :options="idTypeOptions"
                :empty-label="$t('common.none')"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('guests.idNumber') }}</label>
              <input
                v-model="form.id_number"
                type="text"
                class="input"
                :required="!!form.id_type"
                :disabled="!form.id_type"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('guests.nationality') }}</label>
              <input v-model="form.nationality" type="text" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('guests.dateOfBirth') }}</label>
              <input v-model="form.date_of_birth" type="date" class="input" :max="todayISO()" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('common.address') }}</label>
              <input v-model="form.address" type="text" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('guests.vipStatus') }}</label>
              <SearchableSelect v-model="form.vip_status" :options="vipStatusOptions" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('common.notes') }}</label>
              <textarea v-model="form.notes" rows="2" class="textarea"></textarea>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i> {{ saving ? $t('common.saving') : $t('guests.saveGuest') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { guestApi } from '@/api'
import CountryCitySelect from '@/components/CountryCitySelect.vue'
import PhoneInput from '@/components/PhoneInput.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { todayISO } from '@/utils/dates'
import { findCountryCode } from '@/utils/locations'
import { normalizePhoneNumber } from '@/utils/phone'

const { t } = useI18n()
const authStore = useAuthStore()
const canEdit = computed(() => authStore.can(60) && authStore.canOperate)

const vipFilterOptions = computed(() => [
  { value: 'true', label: t('guests.typeVip') },
  { value: 'false', label: t('guests.typeRegular') },
])

const idTypeOptions = computed(() => [
  { value: 'passport', label: t('common.idTypes.passport') },
  { value: 'national_id', label: t('common.idTypes.nationalId') },
  { value: 'driving_license', label: t('common.idTypes.drivingLicense') },
])

const vipStatusOptions = computed(() => [
  { value: false, label: t('guests.typeRegular') },
  { value: true, label: t('guests.typeVip') },
])

const guests = ref([])
const page = ref(1)
const meta = ref({ total: 0, per_page: 15, current_page: 1, last_page: 1, prev_page_url: null, next_page_url: null })
const filters = reactive({ search: '', vip: '', nationality: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  country: '',
  country_code: '',
  city: '',
  id_type: '',
  id_number: '',
  address: '',
  nationality: '',
  date_of_birth: '',
  vip_status: false,
  notes: '',
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await guestApi.index({
      search: filters.search,
      vip: filters.vip || undefined,
      nationality: filters.nationality,
      page: page.value,
      per_page: 15,
    })
    guests.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('guests.loadError')
  } finally {
    loading.value = false
  }
}

function goPage(p) {
  page.value = p
  load()
}

function clearFilters() {
  page.value = 1
  filters.search = ''
  filters.vip = ''
  filters.nationality = ''
  load()
}

function triggerSearch() {
  page.value = 1
  load()
}

function resetForm() {
  editing.value = false
  editingId.value = null
  form.first_name = ''
  form.last_name = ''
  form.email = ''
  form.phone = ''
  form.country = ''
  form.country_code = ''
  form.city = ''
  form.id_type = ''
  form.id_number = ''
  form.address = ''
  form.nationality = ''
  form.date_of_birth = ''
  form.vip_status = false
  form.notes = ''
}

function openCreate() {
  modalError.value = ''
  resetForm()
  showModal.value = true
}

function openEdit(guest) {
  modalError.value = ''
  editing.value = true
  editingId.value = guest.guest_id
  form.first_name = guest.first_name || ''
  form.last_name = guest.last_name || ''
  form.email = guest.email || ''
  form.phone = guest.phone || ''
  form.country = guest.country || ''
  // Older records may only carry the country name, so resolve the ISO code.
  form.country_code = guest.country_code || findCountryCode(guest.country)
  form.city = guest.city || ''
  form.id_type = guest.id_type || ''
  form.id_number = guest.id_number || ''
  form.address = guest.address || ''
  form.nationality = guest.nationality || ''
  form.date_of_birth = guest.date_of_birth || ''
  form.vip_status = !!guest.vip_status
  form.notes = guest.notes || ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function save() {
  modalError.value = ''
  saving.value = true
  try {
    if (editing.value) {
      await guestApi.update(editingId.value, { ...form, phone: normalizePhoneNumber(form.phone, form.country_code || 'TZ') })
      success.value = t('guests.updateSuccess')
    } else {
      await guestApi.store({ ...form, phone: normalizePhoneNumber(form.phone, form.country_code || 'TZ') })
      success.value = t('guests.createSuccess')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

async function remove(guest) {
  if (!window.confirm(t('guests.deleteMessage', { name: guest.full_name }))) return
  error.value = ''
  try {
    await guestApi.destroy(guest.guest_id)
    success.value = t('guests.deleteSuccess')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages ? Object.values(messages).flat().join(' ') : err.response?.data?.message || t('common.actionFailed')
}

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

.head-actions {
  display: flex;
  gap: 10px;
}

.filter-bar {
  margin-bottom: 16px;
  padding: 16px 20px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.filter-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 1px;
}

.muted {
  color: #888;
  font-size: 12px;
  margin-top: 2px;
}

.capitalize {
  text-transform: capitalize;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.vip-badge {
  margin-left: 8px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.form-full {
  grid-column: 1 / -1;
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

  .filter-grid {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-full {
    grid-column: auto;
  }
}
</style>
