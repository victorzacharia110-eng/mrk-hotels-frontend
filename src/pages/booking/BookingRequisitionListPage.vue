<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('bookingRequisitions.title') }}</h1>
        <p class="muted">{{ $t('bookingRequisitions.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load"><i class="fas fa-rotate"></i> {{
          $t('bookingRequisitions.refresh') }}</button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('bookingRequisitions.status') }}</label>
          <SearchableSelect v-model="filters.status" :options="statusOptions" :empty-label="$t('common.all')" @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('bookingPage.bookingType') }}</label>
          <SearchableSelect v-model="filters.booking_type" :options="bookingTypeOptions" :empty-label="$t('common.all')" @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input v-model="filters.search" type="text" class="input"
            :placeholder="$t('bookingRequisitions.searchPlaceholder')" @input="triggerSearch" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters"><i class="fas fa-filter-circle-xmark"></i> {{
            $t('common.clear') }}</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('bookingRequisitions.loading') }}</div>

    <div v-else class="table-scroll">
      <table class="table">
      <thead>
        <tr>
          <th>{{ $t('bookingRequisitions.tableReference') }}</th>
          <th>{{ $t('bookingRequisitions.tableGuest') }}</th>
          <th>{{ $t('bookingRequisitions.tableStay') }}</th>
          <th>{{ $t('bookingRequisitions.tableType') }}</th>
          <th>{{ $t('bookingRequisitions.tableDetails') }}</th>
          <th>{{ $t('bookingRequisitions.status') }}</th>
          <th>{{ $t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in requisitions" :key="r.requisition_id">
          <td><strong>{{ r.requisition_number }}</strong>
            <div class="muted">{{ formatDate(r.created_at) }}</div>
          </td>
          <td>
            <strong>{{ r.full_name }}</strong>
            <div class="muted">{{ r.email }} · {{ r.phone }}</div>
          </td>
          <td>
            <div>{{ r.check_in_date }} → {{ r.check_out_date }}</div>
            <div class="muted">{{ r.adults }} {{ $t('bookingRequisitions.adultSuffix') }}, {{ r.children }} {{
              $t('bookingRequisitions.childSuffix') }}, {{ r.rooms }} {{ $t('bookingRequisitions.roomSuffix') }}</div>
          </td>
          <td class="capitalize">{{ r.booking_type }}</td>
          <td>
            <span v-if="r.quoted_amount" class="price">TZS {{ Number(r.quoted_amount).toLocaleString() }}</span>
            <span v-else class="muted">-</span>
            <div v-if="r.hotel_notes" class="muted">{{ r.hotel_notes }}</div>
          </td>
          <td><span class="badge" :class="statusBadge(r.status)">{{ r.status }}</span></td>
          <td>
            <div class="actions">
              <button v-if="r.status === 'pending'" class="btn btn-sm btn-primary"
                @click="openRespond(r, 'reviewing')">{{ $t('bookingRequisitions.review') }}</button>
              <button v-if="['pending', 'reviewing', 'quoted'].includes(r.status)" class="btn btn-sm btn-secondary"
                @click="openRespond(r, 'quoted')">{{ $t('bookingRequisitions.quote') }}</button>
              <button v-if="['pending', 'reviewing', 'quoted'].includes(r.status)" class="btn btn-sm btn-success"
                @click="openRespond(r, 'confirmed')">{{ $t('common.confirm') }}</button>
              <button v-if="['pending', 'reviewing', 'quoted'].includes(r.status)" class="btn btn-sm btn-danger"
                @click="openRespond(r, 'rejected')">{{ $t('bookingRequisitions.reject') }}</button>
              <button v-if="r.status === 'pending'" class="btn btn-sm btn-danger" @click="remove(r)"><i
                  class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>
        <tr v-if="!requisitions.length && !loading">
          <td colspan="7" class="muted">{{ $t('bookingRequisitions.empty') }}</td>
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

    <div v-if="showRespond" class="modal-overlay" @click.self="showRespond = false">
      <div class="modal">
        <div class="modal-head">
          <h2><i class="fas fa-envelope-open-text"></i> {{ $t('bookingRequisitions.respondTo', {
            reference:
              respondTarget?.requisition_number }) }}</h2>
          <button class="modal-close" @click="showRespond = false"><i class="fas fa-xmark"></i></button>
        </div>
        <p class="muted">{{ respondTarget?.full_name }} · {{ respondTarget?.check_in_date }} → {{
          respondTarget?.check_out_date }}</p>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="saveRespond">
          <div class="form-group">
            <label>{{ $t('bookingRequisitions.response') }}</label>
            <SearchableSelect v-model="respondForm.status" :options="respondStatusOptions" required />
          </div>
          <div v-if="['quoted', 'confirmed'].includes(respondForm.status)" class="form-group">
            <label>{{ $t('bookingRequisitions.quotedAmount') }}</label>
            <input v-model.number="respondForm.quoted_amount" type="number" min="0" step="0.01" class="input"
              required />
          </div>
          <div class="form-group">
            <label>{{ $t('bookingRequisitions.hotelNotes') }}</label>
            <textarea v-model="respondForm.hotel_notes" rows="3" class="textarea"></textarea>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="showRespond = false">{{ $t('common.cancel')
              }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i> {{ saving ? $t('common.saving') : $t('bookingRequisitions.sendResponse') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { bookingRequisitionApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'

const { t } = useI18n()

const requisitions = ref([])
const page = ref(1)
const meta = ref({ total: 0, per_page: 15, current_page: 1, last_page: 1, prev_page_url: null, next_page_url: null })
const filters = reactive({ status: '', booking_type: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

const showRespond = ref(false)
const respondTarget = ref(null)
const saving = ref(false)
const modalError = ref('')
const respondForm = reactive({ status: 'reviewing', quoted_amount: null, hotel_notes: '' })

const statusOptions = computed(() => [
  { value: 'pending', label: t('bookingRequisitions.statusPending') },
  { value: 'reviewing', label: t('bookingRequisitions.statusReviewing') },
  { value: 'quoted', label: t('bookingRequisitions.statusQuoted') },
  { value: 'confirmed', label: t('bookingRequisitions.statusConfirmed') },
  { value: 'rejected', label: t('bookingRequisitions.statusRejected') },
  { value: 'cancelled', label: t('bookingRequisitions.statusCancelled') },
])

const bookingTypeOptions = computed(() => [
  { value: 'leisure', label: t('common.bookingTypes.leisure') },
  { value: 'business', label: t('common.bookingTypes.business') },
  { value: 'event', label: t('common.bookingTypes.event') },
  { value: 'wedding', label: t('common.bookingTypes.wedding') },
  { value: 'group', label: t('common.bookingTypes.group') },
  { value: 'other', label: t('common.bookingTypes.other') },
])

const respondStatusOptions = computed(() => [
  { value: 'reviewing', label: t('bookingRequisitions.statusReviewing') },
  { value: 'quoted', label: t('bookingRequisitions.statusQuoted') },
  { value: 'confirmed', label: t('bookingRequisitions.statusConfirmed') },
  { value: 'rejected', label: t('bookingRequisitions.statusRejected') },
])

function statusBadge(s) {
  const map = { pending: 'badge-yellow', reviewing: 'badge-blue', quoted: 'badge-blue', confirmed: 'badge-green', rejected: 'badge-red', cancelled: 'badge-gray' }
  return map[s] || 'badge-gray'
}

function formatDate(d) {
  return d ? String(d).slice(0, 16).replace('T', ' ') : '-'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await bookingRequisitionApi.index({
      status: filters.status,
      booking_type: filters.booking_type,
      search: filters.search,
      page: page.value,
      per_page: 15,
    })
    requisitions.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('bookingRequisitions.loadError')
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
  filters.status = ''
  filters.booking_type = ''
  filters.search = ''
  load()
}

function openRespond(r, status) {
  modalError.value = ''
  respondTarget.value = r
  respondForm.status = status
  respondForm.quoted_amount = r.quoted_amount ?? null
  respondForm.hotel_notes = r.hotel_notes || ''
  showRespond.value = true
}

async function saveRespond() {
  modalError.value = ''
  saving.value = true
  try {
    const res = await bookingRequisitionApi.respond(respondTarget.value.requisition_id, {
      status: respondForm.status,
      quoted_amount: respondForm.quoted_amount || undefined,
      hotel_notes: respondForm.hotel_notes,
    })
    success.value = res.data.message || t('bookingRequisitions.responseSent')
    showRespond.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

async function remove(r) {
  if (!window.confirm(t('bookingRequisitions.deleteConfirm', { reference: r.requisition_number }))) return
  error.value = ''
  try {
    const res = await bookingRequisitionApi.destroy(r.requisition_id)
    success.value = res.data.message || t('bookingRequisitions.deleted')
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

.price {
  font-weight: 700;
  color: #005EB8;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
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
}
</style>
