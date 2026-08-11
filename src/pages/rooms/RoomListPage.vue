<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('rooms.title') }}</h1>
        <p class="muted">{{ $t('rooms.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load"><i class="fas fa-rotate"></i> {{ $t('rooms.refresh') }}</button>
        <button v-if="canEdit" class="btn btn-primary" @click="openCreate"><i class="fas fa-plus"></i> {{
          $t('rooms.newRoom') }}</button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('rooms.status') }}</label>
          <SearchableSelect v-model="filters.status" :options="roomStatusOptions" :empty-label="$t('common.all')"
            @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('rooms.roomType') }}</label>
          <SearchableSelect v-model="filters.room_type" :options="roomTypeOptions" :empty-label="$t('common.all')"
            @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input v-model="filters.search" type="text" class="input" :placeholder="$t('rooms.searchPlaceholder')"
            @input="triggerSearch" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="clearFilters"><i class="fas fa-filter-circle-xmark"></i> {{
            $t('common.clear') }}</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('rooms.loading') }}</div>

    <div v-else class="table-scroll">
      <table class="table">
      <thead>
        <tr>
          <th>{{ $t('rooms.tableRoom') }}</th>
          <th>{{ $t('rooms.tableType') }}</th>
          <th>{{ $t('rooms.floor') }}</th>
          <th>{{ $t('rooms.tableRate') }}</th>
          <th>{{ $t('rooms.tableCapacity') }}</th>
          <th>{{ $t('rooms.status') }}</th>
          <th>{{ $t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="room in rooms" :key="room.room_id">
          <td>
            <strong>{{ room.room_number }}</strong>
            <div v-if="room.current_reservation" class="muted">
              {{ room.current_reservation.guest_name }}
              <span v-if="room.current_reservation.reservation_number">· {{ room.current_reservation.reservation_number
              }}</span>
            </div>
          </td>
          <td class="capitalize">{{ room.room_type }}</td>
          <td>{{ $t('rooms.floor') }} {{ room.floor ?? '-' }}</td>
          <td><span class="price">TZS {{ Number(room.price_per_night).toLocaleString() }}</span></td>
          <td>{{ room.max_occupancy ?? 1 }}</td>
          <td><span class="badge" :class="statusBadge(room.status)">{{ room.status }}</span></td>
          <td>
            <div class="actions">
              <button v-if="canEdit" class="btn btn-sm btn-secondary" @click="openEdit(room)"><i class="fas fa-pen"></i>
                {{ $t('common.edit') }}</button>
              <button v-if="canEdit && room.status !== 'occupied'" class="btn btn-sm btn-secondary"
                @click="openStatus(room)"><i class="fas fa-arrows-rotate"></i> {{ $t('rooms.status') }}</button>
              <button v-if="canEdit" class="btn btn-sm btn-danger" @click="remove(room)"><i
                  class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>
        <tr v-if="!rooms.length && !loading">
          <td colspan="7" class="muted">{{ $t('rooms.empty') }}</td>
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
          <h2><i class="fas fa-bed"></i> {{ editing ? $t('rooms.editRoom') : $t('rooms.newRoom') }}</h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('rooms.roomNumber') }} *</label>
              <input v-model="form.room_number" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('rooms.roomType') }} *</label>
              <SearchableSelect v-model="form.room_type" :options="roomTypeOptions" :required="true" />
            </div>
            <div class="form-group">
              <label>{{ $t('rooms.floor') }}</label>
              <input v-model.number="form.floor" type="number" min="0" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('rooms.pricePerNightTZS') }} *</label>
              <input v-model.number="form.price_per_night" type="number" min="0" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('rooms.maxOccupancy') }}</label>
              <input v-model.number="form.max_occupancy" type="number" min="1" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('rooms.status') }}</label>
              <SearchableSelect v-model="form.status" :options="roomStatusOptions" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('rooms.amenities') }}</label>
              <input v-model="amenitiesText" type="text" class="input"
                :placeholder="$t('rooms.amenitiesPlaceholder')" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('rooms.description') }}</label>
              <textarea v-model="form.description" rows="2" class="textarea"></textarea>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i> {{ saving ? $t('common.saving') : $t('rooms.saveRoom') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showStatus" class="modal-overlay" @click.self="showStatus = false">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-arrows-rotate"></i> {{ $t('rooms.changeStatus') }}</h2>
          <button class="modal-close" @click="showStatus = false"><i class="fas fa-xmark"></i></button>
        </div>
        <p class="muted">{{ $t('rooms.roomTitle', { number: statusRoom.room_number }) }}</p>
        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <form @submit.prevent="saveStatus">
          <div class="form-group">
            <label>{{ $t('rooms.newStatus') }}</label>
            <SearchableSelect v-model="statusForm.status" :options="statusChangeOptions" :required="true" />
          </div>
          <div class="form-group">
            <label>{{ $t('common.notes') }}</label>
            <textarea v-model="statusForm.notes" rows="2" class="textarea"></textarea>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="showStatus = false">{{ $t('common.cancel')
            }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i> {{ saving ? $t('rooms.updating') : $t('rooms.updateStatus') }}
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
import { roomApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'

const { t } = useI18n()
const authStore = useAuthStore()
const canEdit = computed(() => authStore.can(80))

const rooms = ref([])
const page = ref(1)
const meta = ref({ total: 0, per_page: 20, current_page: 1, last_page: 1, prev_page_url: null, next_page_url: null })
const filters = reactive({ status: '', room_type: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

const showModal = ref(false)
const showStatus = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const statusRoom = ref(null)
const form = reactive({ room_number: '', room_type: 'single', floor: null, status: 'available', price_per_night: null, max_occupancy: 2, description: '', amenities: [] })
const statusForm = reactive({ status: 'available', notes: '' })
const amenitiesText = ref('')

const roomTypeOptions = computed(() => [
  { value: 'single', label: t('common.roomTypes.single') },
  { value: 'double', label: t('common.roomTypes.double') },
  { value: 'suite', label: t('common.roomTypes.suite') },
  { value: 'deluxe', label: t('common.roomTypes.deluxe') },
  { value: 'presidential', label: t('common.roomTypes.presidential') },
])

const roomStatusOptions = computed(() => [
  { value: 'available', label: t('rooms.statusAvailable') },
  { value: 'occupied', label: t('rooms.statusOccupied') },
  { value: 'cleaning', label: t('rooms.statusCleaning') },
  { value: 'maintenance', label: t('rooms.statusMaintenance') },
  { value: 'dirty', label: t('rooms.statusDirty') },
])

const statusChangeOptions = computed(() => [
  { value: 'available', label: t('rooms.statusAvailable') },
  { value: 'cleaning', label: t('rooms.statusCleaning') },
  { value: 'maintenance', label: t('rooms.statusMaintenance') },
  { value: 'dirty', label: t('rooms.statusDirty') },
])

function statusBadge(s) {
  const map = { available: 'badge-green', occupied: 'badge-red', cleaning: 'badge-yellow', maintenance: 'badge-gray', dirty: 'badge-yellow' }
  return map[s] || 'badge-gray'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await roomApi.index({ status: filters.status, room_type: filters.room_type, search: filters.search, page: page.value, per_page: 20 })
    rooms.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('rooms.loadError')
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
  filters.room_type = ''
  filters.search = ''
  load()
}

function triggerSearch() {
  page.value = 1
  load()
}

function resetForm() {
  editing.value = false
  editingId.value = null
  form.room_number = ''
  form.room_type = 'single'
  form.floor = null
  form.status = 'available'
  form.price_per_night = null
  form.max_occupancy = 2
  form.description = ''
  form.amenities = []
  amenitiesText.value = ''
}

function openCreate() {
  modalError.value = ''
  resetForm()
  showModal.value = true
}

function openEdit(room) {
  modalError.value = ''
  editing.value = true
  editingId.value = room.room_id
  form.room_number = room.room_number
  form.room_type = room.room_type
  form.floor = room.floor
  form.status = room.status
  form.price_per_night = room.price_per_night
  form.max_occupancy = room.max_occupancy
  form.description = room.description || ''
  form.amenities = room.amenities || []
  amenitiesText.value = Array.isArray(room.amenities) ? room.amenities.join(', ') : ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  showStatus.value = false
}

async function save() {
  modalError.value = ''
  saving.value = true
  const payload = {
    ...form,
    amenities: amenitiesText.value ? amenitiesText.value.split(',').map((a) => a.trim()).filter(Boolean) : [],
  }
  try {
    if (editing.value) {
      await roomApi.update(editingId.value, payload)
      success.value = t('rooms.updateSuccess')
    } else {
      await roomApi.store(payload)
      success.value = t('rooms.createSuccess')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

function openStatus(room) {
  modalError.value = ''
  statusRoom.value = room
  statusForm.status = room.status === 'available' ? 'cleaning' : room.status
  statusForm.notes = ''
  showStatus.value = true
}

async function saveStatus() {
  modalError.value = ''
  saving.value = true
  try {
    await roomApi.updateStatus(statusRoom.value.room_id, { status: statusForm.status, notes: statusForm.notes })
    showStatus.value = false
    success.value = t('rooms.statusUpdated', { number: statusRoom.value.room_number })
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

async function remove(room) {
  if (!window.confirm(t('rooms.deleteMessage', { roomNumber: room.room_number }))) return
  error.value = ''
  try {
    await roomApi.destroy(room.room_id)
    success.value = t('rooms.deleteSuccess')
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

.price {
  font-weight: 700;
  color: #005EB8;
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

.modal-sm {
  max-width: 420px;
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
