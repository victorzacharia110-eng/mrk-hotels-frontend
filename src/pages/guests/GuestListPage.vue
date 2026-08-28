<!--
  GuestListPage.vue
  Guest directory for the hotel back-office. Features: search, VIP and
  nationality filters, create/edit modal with phone normalization and
  country/city selectors, VIP badging, and delete. Write actions are
  permission-gated via canEdit. Authenticated route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: refresh plus permission-gated "new guest" button -->
    <div class="page-head">
      <div>
        <h1>{{ $t('guests.title') }}</h1>
        <p class="muted">{{ $t('guests.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('guests.refresh') }}
        </button>
        <button v-if="canEdit" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('guests.newGuest') }}
        </button>
        <TableExportButton
          filename="guests"
          :load-all="loadAllGuests"
          :columns="[
            { key: 'full_name', label: $t('guests.tableGuest') },
            { key: 'email', label: $t('common.email') },
            { key: 'phone', label: $t('common.phone') },
            { key: 'id_type', label: $t('guests.tableId') },
            { key: 'id_number', label: 'ID #' },
            { key: 'nationality', label: $t('guests.nationality') },
            { key: 'vip_status', label: $t('guests.tableType') },
            { key: 'city', label: $t('common.city') },
            { key: 'country', label: $t('common.country') },
          ]"
        />
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filter bar: free-text search, VIP flag and nationality -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input
            v-model="filters.search"
            type="text"
            class="input"
            :placeholder="$t('guests.searchPlaceholder')"
            @input="triggerSearch"
          />
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
          <input
            v-model="filters.nationality"
            type="text"
            class="input"
            :placeholder="$t('guests.nationalityPlaceholder')"
            @input="triggerSearch"
          />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters">
            <i class="fas fa-filter-circle-xmark"></i> {{ $t('common.clear') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading indicator shown while the list request is in flight -->
    <div v-if="loading" class="alert alert-info">{{ $t('guests.loading') }}</div>

    <!-- Guests table: identity, contact, ID document, nationality and VIP type -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('guests.tableGuest') }}</th>
            <th scope="col">{{ $t('guests.tableContact') }}</th>
            <th scope="col">{{ $t('guests.tableId') }}</th>
            <th scope="col">{{ $t('guests.nationality') }}</th>
            <th scope="col">{{ $t('guests.tableType') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="guest in guests" :key="guest.guest_id">
            <td>
              <strong>{{ guest.full_name }}</strong>
              <span v-if="guest.vip_status" class="badge badge-yellow vip-badge"
                ><i class="fas fa-crown"></i> {{ $t('guests.typeVip') }}</span
              >
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
              <!-- Row actions (edit/delete) only for users with guest-edit rights -->
              <div class="actions">
                <button v-if="canEdit" class="btn btn-sm btn-secondary" @click="openEdit(guest)">
                  <i class="fas fa-pen"></i> {{ $t('common.edit') }}
                </button>
                <button v-if="canEdit" class="btn btn-sm btn-danger" @click="remove(guest)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!guests.length && !loading">
            <td colspan="6" class="muted">{{ $t('guests.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Server-side pagination controls -->
    <div v-if="meta.total > meta.per_page" class="pagination">
      <button
        class="btn btn-sm btn-secondary"
        :disabled="!meta.prev_page_url"
        @click="goPage(meta.current_page - 1)"
      >
        {{ $t('common.previous') }}
      </button>
      <span class="muted">{{
        $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page })
      }}</span>
      <button
        class="btn btn-sm btn-secondary"
        :disabled="!meta.next_page_url"
        @click="goPage(meta.current_page + 1)"
      >
        {{ $t('common.next') }}
      </button>
    </div>

    <!-- Create/edit guest modal: identity, contact, location, ID and VIP status -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-user"></i>
            {{ editing ? $t('guests.editGuest') : $t('guests.newGuest') }}
          </h2>
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
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('guests.saveGuest') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete guest confirmation modal with impact summary -->
    <div v-if="showDelete" class="modal-overlay" @click.self="closeDelete">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-trash-can"></i> {{ $t('guests.deleteTitle') }}</h2>
          <button class="modal-close" @click="closeDelete"><i class="fas fa-xmark"></i></button>
        </div>
        <p>{{ $t('guests.deleteMessage', { name: deleteTarget?.full_name }) }}</p>

        <div v-if="loadingDeletePreview" class="delete-impact-loading">
          <i class="fas fa-spinner fa-spin"></i> {{ $t('common.loading') }}
        </div>
        <div v-else-if="deletePreview" class="delete-impact">
          <p class="delete-impact-title">{{ $t('guests.deleteImpactTitle') }}</p>
          <table class="delete-impact-table">
            <tbody>
              <tr v-if="deletePreview.reservations_count > 0">
                <td><i class="fas fa-calendar"></i> {{ $t('guests.deleteImpactReservations') }}</td>
                <td class="text-right">{{ deletePreview.reservations_count }}</td>
              </tr>
              <tr v-if="deletePreview.payments_count > 0">
                <td><i class="fas fa-credit-card"></i> {{ $t('guests.deleteImpactPayments') }}</td>
                <td class="text-right">
                  {{ deletePreview.payments_count }} · TZS {{ Number(deletePreview.payments_total).toLocaleString() }}
                </td>
              </tr>
              <tr v-if="deletePreview.invoices_count > 0">
                <td><i class="fas fa-file-invoice"></i> {{ $t('guests.deleteImpactInvoices') }}</td>
                <td class="text-right">{{ deletePreview.invoices_count }}</td>
              </tr>
              <tr v-if="deletePreview.messages_count > 0">
                <td><i class="fas fa-comment"></i> {{ $t('guests.deleteImpactMessages') }}</td>
                <td class="text-right">{{ deletePreview.messages_count }}</td>
              </tr>
            </tbody>
          </table>
          <p class="delete-impact-warning">{{ $t('guests.deleteImpactWarning') }}</p>
        </div>

        <div class="modal-foot">
          <button class="btn btn-secondary" @click="closeDelete">{{ $t('common.cancel') }}</button>
          <button
            class="btn btn-danger"
            :disabled="deleting"
            @click="confirmDelete"
          >
            <i class="fas fa-trash-can"></i>
            {{ deleting ? $t('common.deleting') : $t('guests.deleteTitle') }}
          </button>
        </div>
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
import TableExportButton from '@/components/TableExportButton.vue'
import { todayISO } from '@/utils/dates'
import { collectAllRows } from '@/utils/export'
import { findCountryCode } from '@/utils/locations'
import { normalizePhoneNumber } from '@/utils/phone'

const { t } = useI18n()
const authStore = useAuthStore()
// Permission gate: guest editing requires permission 60 plus operate rights.
const canEdit = computed(() => authStore.can(60) && authStore.canOperate)

// VIP filter options with translated labels (recomputed on locale change).
const vipFilterOptions = computed(() => [
  { value: 'true', label: t('guests.typeVip') },
  { value: 'false', label: t('guests.typeRegular') },
])

// Accepted identification document types for the guest form.
const idTypeOptions = computed(() => [
  { value: 'passport', label: t('common.idTypes.passport') },
  { value: 'national_id', label: t('common.idTypes.nationalId') },
  { value: 'driving_license', label: t('common.idTypes.drivingLicense') },
])

// VIP status choices bound to the modal form select.
const vipStatusOptions = computed(() => [
  { value: false, label: t('guests.typeRegular') },
  { value: true, label: t('guests.typeVip') },
])

// List state: guest rows, pagination metadata, filters and feedback flags.
const guests = ref([])
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({ search: '', vip: '', nationality: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

// Create/edit modal state and its form model.
const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')

// Delete confirmation modal state.
const showDelete = ref(false)
const deleteTarget = ref(null)
const deletePreview = ref(null)
const loadingDeletePreview = ref(false)
const deleting = ref(false)

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

/**
 * Fetches the current page of guests applying the active filters.
 * @returns {Promise<void>}
 */
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

function loadAllGuests() {
  return collectAllRows((page, perPage) =>
    guestApi.index({
      search: filters.search,
      vip: filters.vip || undefined,
      nationality: filters.nationality,
      page,
      per_page: perPage,
    }),
  )
}

/**
 * Navigates to a given result page and reloads.
 * @param {number} page - 1-based page number.
 */
function goPage(page) {
  page.value = page
  load()
}

/** Resets every filter and the page cursor, then reloads the list. */
function clearFilters() {
  page.value = 1
  filters.search = ''
  filters.vip = ''
  filters.nationality = ''
  load()
}

/** Search-as-you-type handler: resets to page 1 and reloads on each input. */
function triggerSearch() {
  page.value = 1
  load()
}

/** Restores the guest form to its empty default state. */
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

/** Opens the create-guest modal with a fresh form. */
function openCreate() {
  modalError.value = ''
  resetForm()
  showModal.value = true
}

/**
 * Opens the edit modal pre-filled with the selected guest's data.
 * @param {Object} guest - The guest row to edit.
 */
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

/** Closes the create/edit modal. */
function closeModal() {
  showModal.value = false
}

/**
 * Creates or updates the guest depending on the editing flag.
 * The phone number is normalized to E.164 (defaulting to TZ) before sending.
 * @returns {Promise<void>}
 */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    if (editing.value) {
      await guestApi.update(editingId.value, {
        ...form,
        phone: normalizePhoneNumber(form.phone, form.country_code || 'TZ'),
      })
      success.value = t('guests.updateSuccess')
    } else {
      await guestApi.store({
        ...form,
        phone: normalizePhoneNumber(form.phone, form.country_code || 'TZ'),
      })
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

/**
 * Opens the delete confirmation modal and fetches the impact preview.
 * @param {Object} guest - The guest row to delete.
 */
async function remove(guest) {
  deleteTarget.value = guest
  deletePreview.value = null
  loadingDeletePreview.value = true
  showDelete.value = true
  try {
    const res = await guestApi.deletionPreview(guest.guest_id)
    deletePreview.value = res.data.preview
  } catch {
    deletePreview.value = null
  } finally {
    loadingDeletePreview.value = false
  }
}

/** Closes the delete modal. */
function closeDelete() {
  showDelete.value = false
  deleteTarget.value = null
  deletePreview.value = null
}

/** Permanently deletes the guest. */
async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  error.value = ''
  try {
    await guestApi.destroy(target.guest_id)
    success.value = t('guests.deleteSuccess')
    closeDelete()
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    deleting.value = false
  }
}

/**
 * Converts an Axios/Laravel error response into a single human-readable string,
 * joining per-field validation messages when present.
 * @param {Object} err - The caught Axios error.
 * @returns {string} Flattened error message (localized fallback included).
 */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
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
  color: #757575;
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
  color: #005eb8;
}

.modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #757575;
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

.delete-impact {
  margin-bottom: 16px;
  padding: 12px;
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 8px;
}

.delete-impact-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: #92400e;
}

.delete-impact-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
}

.delete-impact-table td {
  padding: 4px 0;
  font-size: 0.88rem;
}

.delete-impact-table td i {
  width: 18px;
  margin-right: 6px;
  color: #92400e;
}

.delete-impact-table .text-right {
  text-align: right;
  font-weight: 500;
}

.delete-impact-warning {
  font-size: 0.82rem;
  color: #b45309;
  margin: 0;
}

.delete-impact-loading {
  margin-bottom: 16px;
  padding: 12px;
  text-align: center;
  color: #6b7280;
  font-size: 0.88rem;
}

.modal-sm {
  max-width: 420px;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
  border: none;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
  border: none;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.88rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
