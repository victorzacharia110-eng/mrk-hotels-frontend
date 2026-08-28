<!--
  HousekeepingPage.vue
  Housekeeping task board: one row per room cleaning task with pax, house
  status, assignee, room status, arrival/departure and workflow status.
  Features: status/house-status/room-status/room filters, create/edit task
  modal, assign modal, full lifecycle actions (accept → start → complete →
  confirm/verify, reopen), and a read-only detail modal. Management actions
  gated by module 40 permissions. Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: refresh plus permission-gated "new task" button -->
    <div class="page-head">
      <div>
        <h1>{{ $t('housekeeping.title') }}</h1>
        <p class="muted">{{ $t('housekeeping.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('housekeeping.refresh') }}
        </button>
        <button v-if="canManage" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('housekeeping.newTask') }}
        </button>
        <TableExportButton filename="housekeeping" :load-all="loadAllTasks" />
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filter bar: narrows the task list by status, house/room status and room -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('housekeeping.status') }}</label>
          <SearchableSelect
            v-model="filters.status"
            :options="statusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('housekeeping.houseStatus') }}</label>
          <SearchableSelect
            v-model="filters.house_status"
            :options="houseStatusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('housekeeping.roomStatus') }}</label>
          <SearchableSelect
            v-model="filters.room_status"
            :options="roomStatusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('housekeeping.room') }}</label>
          <SearchableSelect
            v-model="filters.room_id"
            :options="roomFilterOptions"
            :empty-label="$t('housekeeping.allRooms')"
            @change="load"
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
    <div v-if="loading" class="alert alert-info">{{ $t('housekeeping.loading') }}</div>

    <!-- Task table: one row per housekeeping task with status/room badges and workflow actions -->
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('housekeeping.room') }}</th>
            <th scope="col">{{ $t('housekeeping.pax') }}</th>
            <th scope="col">{{ $t('housekeeping.houseStatus') }}</th>
            <th scope="col">{{ $t('housekeeping.assignedTo') }}</th>
            <th scope="col">{{ $t('housekeeping.roomStatus') }}</th>
            <th scope="col">{{ $t('housekeeping.arrival') }}</th>
            <th scope="col">
              {{ $t('housekeeping.departure') }} · {{ $t('housekeeping.nights') }}
            </th>
            <th scope="col">{{ $t('housekeeping.status') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in tasks" :key="task.task_id">
            <td v-if="task.room">
              <strong>{{ $t('housekeeping.room') }} {{ task.room.room_number }}</strong>
              <div class="muted capitalize">{{ task.room.room_type }}</div>
              <div v-if="task.remarks" class="muted">{{ task.remarks }}</div>
            </td>
            <td v-else>-</td>
            <td>{{ task.pax }}</td>
            <td>
              <span
                class="badge"
                :class="task.house_status === 'dirty' ? 'badge-red' : 'badge-green'"
              >
                {{
                  task.house_status === 'dirty'
                    ? $t('housekeeping.houseDirty')
                    : $t('housekeeping.houseClean')
                }}
              </span>
            </td>
            <td>{{ task.assigned_user?.full_name || $t('housekeeping.unassigned') }}</td>
            <td class="capitalize">{{ roomStatusLabel(task.room_status) }}</td>
            <td>{{ formatArrival(task.arrival_at) }}</td>
            <td>{{ formatDeparture(task.departure_at) }} · {{ task.nights }}</td>
            <td>
              <span class="badge" :class="statusBadge(task.status)">{{
                statusLabel(task.status)
              }}</span>
            </td>
            <td>
              <div class="actions">
                <button
                  v-if="canManage && task.status === 'dirty'"
                  class="btn btn-sm btn-secondary"
                  @click="openAssign(task)"
                >
                  <i class="fas fa-user-plus"></i> {{ $t('housekeeping.assign') }}
                </button>
                <button
                  v-if="task.status === 'dirty'"
                  class="btn btn-sm btn-primary"
                  @click="start(task)"
                >
                  <i class="fas fa-play"></i> {{ $t('housekeeping.start') }}
                </button>
                <button
                  v-if="task.status === 'in_progress' && canConfirm"
                  class="btn btn-sm btn-secondary"
                  @click="confirm(task)"
                >
                  <i class="fas fa-check-double"></i> {{ $t('housekeeping.confirm') }}
                </button>
                <button
                  v-if="task.status === 'confirmed' && canVerify"
                  class="btn btn-sm btn-secondary"
                  @click="verify(task)"
                >
                  <i class="fas fa-clipboard-check"></i> {{ $t('housekeeping.verify') }}
                </button>
                <button
                  v-if="task.status === 'verified'"
                  class="btn btn-sm btn-success"
                  @click="complete(task)"
                >
                  <i class="fas fa-check"></i> {{ $t('housekeeping.complete') }}
                </button>
                <button
                  v-if="canManage && ['dirty', 'in_progress', 'confirmed'].includes(task.status)"
                  class="btn btn-sm btn-secondary"
                  @click="openEdit(task)"
                >
                  <i class="fas fa-pen"></i>
                </button>
                <button v-if="canManage" class="btn btn-sm btn-danger" @click="remove(task)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!tasks.length && !loading">
            <td colspan="9" class="muted">{{ $t('housekeeping.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination controls (shown when there is more than one page of tasks) -->
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

    <!-- Create/edit task modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-broom"></i>
            {{ editing ? $t('housekeeping.editTask') : $t('housekeeping.newTask') }}
          </h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('housekeeping.room') }} *</label>
              <SearchableSelect
                v-model="form.room_id"
                :options="roomOptions"
                :empty-label="$t('housekeeping.selectRoom')"
                required
              />
            </div>
            <div class="form-group">
              <label>{{ $t('housekeeping.pax') }} *</label>
              <input v-model.number="form.pax" type="number" min="1" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('housekeeping.houseStatus') }} *</label>
              <SearchableSelect
                v-model="form.house_status"
                :options="houseStatusOptions"
                required
              />
            </div>
            <div class="form-group">
              <label>{{ $t('housekeeping.roomStatus') }} *</label>
              <SearchableSelect v-model="form.room_status" :options="roomStatusOptions" required />
            </div>
            <div class="form-group">
              <label>{{ $t('housekeeping.arrival') }} *</label>
              <input v-model="form.arrival_at" type="datetime-local" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('housekeeping.departure') }} *</label>
              <input v-model="form.departure_at" type="date" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('housekeeping.nights') }} *</label>
              <input v-model.number="form.nights" type="number" min="1" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('housekeeping.assignTo') }}</label>
              <SearchableSelect
                v-model="form.assigned_to"
                :options="userOptions"
                :empty-label="$t('housekeeping.unassigned')"
              />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('housekeeping.remarks') }}</label>
              <textarea v-model="form.remarks" rows="2" class="textarea"></textarea>
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
              {{ saving ? $t('common.saving') : $t('housekeeping.saveTask') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Assign task modal -->
    <div v-if="showAssign" class="modal-overlay" @click.self="showAssign = false">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-user-plus"></i> {{ $t('housekeeping.assignTo') }}</h2>
          <button class="modal-close" @click="showAssign = false">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <form @submit.prevent="assignTask">
          <div class="form-group">
            <label>{{ $t('housekeeping.assignTo') }} *</label>
            <SearchableSelect
              v-model="assignUserId"
              :options="userOptions"
              :empty-label="$t('housekeeping.selectRoom')"
              required
            />
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="showAssign = false">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('housekeeping.assign') }}
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
import { housekeepingApi, roomApi, userApi } from '@/api'
import { collectAllRows } from '@/utils/export'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'

const { t } = useI18n()
const authStore = useAuthStore()
// Permission flags: task management requires module 40 access plus the ability to operate.
const canManage = computed(() => authStore.can(40) && authStore.canOperate)
const canVerify = computed(() => authStore.can(40) && authStore.canOperate)
const canConfirm = computed(() => authStore.can(40) && authStore.canOperate)

// List/table state: task rows, lookups for rooms and users, pagination and filter criteria.
const tasks = ref([])
const rooms = ref([])
const users = ref([])
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({ status: '', house_status: '', room_status: '', room_id: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

// Create/edit modal state.
const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')

// Assign-to modal state.
const showAssign = ref(false)
const assignTaskId = ref(null)
const assignUserId = ref('')

// Form model bound to the create/edit modal fields.
const form = reactive({
  room_id: '',
  pax: 1,
  house_status: 'dirty',
  room_status: 'in_house',
  arrival_at: '',
  departure_at: '',
  nights: 1,
  assigned_to: '',
  remarks: '',
  notes: '',
})

const statusOptions = [
  { value: 'dirty', label: t('housekeeping.statusDirty') },
  { value: 'in_progress', label: t('housekeeping.statusInProgress') },
  { value: 'confirmed', label: t('housekeeping.statusConfirmed') },
  { value: 'verified', label: t('housekeeping.statusVerified') },
  { value: 'completed', label: t('housekeeping.statusCompleted') },
]

const houseStatusOptions = [
  { value: 'dirty', label: t('housekeeping.houseDirty') },
  { value: 'clean', label: t('housekeeping.houseClean') },
]

const roomStatusOptions = [
  { value: 'checked_out', label: t('housekeeping.roomStatusCheckedOut') },
  { value: 'arriving_today', label: t('housekeeping.roomStatusArrivingToday') },
  { value: 'in_house', label: t('housekeeping.roomStatusInHouse') },
  { value: 'vacant', label: t('housekeeping.roomStatusVacant') },
]

const roomFilterOptions = computed(() =>
  rooms.value.map((room) => ({ value: room.room_id, label: room.room_number })),
)

const roomOptions = computed(() =>
  rooms.value.map((room) => ({
    value: room.room_id,
    label: `${t('housekeeping.room')} ${room.room_number} · ${room.status}`,
  })),
)

const userOptions = computed(() =>
  users.value.map((user) => ({ value: user.user_id, label: user.full_name })),
)

/** Maps a task status key to its translated display label. */
function statusLabel(status) {
  const map = {
    dirty: t('housekeeping.statusDirty'),
    in_progress: t('housekeeping.statusInProgress'),
    confirmed: t('housekeeping.statusConfirmed'),
    verified: t('housekeeping.statusVerified'),
    completed: t('housekeeping.statusCompleted'),
  }
  return map[status] || status
}

/** Returns the CSS badge class appropriate for the given task status. */
function statusBadge(status) {
  const map = {
    dirty: 'badge-red',
    in_progress: 'badge-blue',
    confirmed: 'badge-yellow',
    verified: 'badge-blue',
    completed: 'badge-green',
  }
  return map[status] || 'badge-gray'
}

/** Maps a room-status key to its translated display label. */
function roomStatusLabel(status) {
  const map = {
    checked_out: t('housekeeping.roomStatusCheckedOut'),
    arriving_today: t('housekeeping.roomStatusArrivingToday'),
    in_house: t('housekeeping.roomStatusInHouse'),
    vacant: t('housekeeping.roomStatusVacant'),
  }
  return map[status] || status
}

/** Formats an ISO datetime string for display, or '-' when absent. */
function formatArrival(date) {
  return date ? String(date).slice(0, 16).replace('T', ' ') : '-'
}

/** Returns the departure date as-is, or '-' when absent. */
function formatDeparture(date) {
  return date || '-'
}

/**
 * Fetches the paginated task list using the current filters and page, storing rows and pagination meta.
 * Shows a translated error message when the request fails.
 */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await housekeepingApi.index({
      status: filters.status,
      house_status: filters.house_status,
      room_status: filters.room_status,
      room_id: filters.room_id,
      page: page.value,
      per_page: 15,
    })
    tasks.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('housekeeping.loadError')
  } finally {
    loading.value = false
  }
}

/** Fetches every housekeeping task page for export, honouring the active filters. */
const loadAllTasks = () =>
  collectAllRows((page, perPage) =>
    housekeepingApi.index({
      status: filters.status,
      house_status: filters.house_status,
      room_status: filters.room_status,
      room_id: filters.room_id,
      page,
      per_page: perPage,
    }),
  )

/** Loads room and user option lists for the filter and form selects; failures are silently ignored. */
async function loadOptions() {
  try {
    rooms.value = (await roomApi.index({ per_page: 100 })).data.data || []
  } catch {
    // ignore
  }
  try {
    users.value = (await userApi.index({ per_page: 100 })).data.data || []
  } catch {
    // ignore
  }
}

/** Sets the page number and reloads the task list. */
function goPage(page) {
  page.value = page
  load()
}

/** Resets all filter criteria and reloads the list from page 1. */
function clearFilters() {
  page.value = 1
  filters.status = ''
  filters.house_status = ''
  filters.room_status = ''
  filters.room_id = ''
  load()
}

/** Restores the create/edit form to its default empty state. */
function resetForm() {
  form.room_id = ''
  form.pax = 1
  form.house_status = 'dirty'
  form.room_status = 'in_house'
  form.arrival_at = ''
  form.departure_at = ''
  form.nights = 1
  form.assigned_to = ''
  form.remarks = ''
  form.notes = ''
}

/** Prepares the modal for creating a brand-new task. */
function openCreate() {
  resetForm()
  modalError.value = ''
  editing.value = false
  editingId.value = null
  showModal.value = true
}

/** Fills the form with an existing task's data and opens the modal in edit mode. */
function openEdit(task) {
  resetForm()
  modalError.value = ''
  editing.value = true
  editingId.value = task.task_id
  form.room_id = task.room_id
  form.pax = task.pax
  form.house_status = task.house_status
  form.room_status = task.room_status
  form.arrival_at = task.arrival_at ? String(task.arrival_at).slice(0, 16) : ''
  form.departure_at = task.departure_at || ''
  form.nights = task.nights
  form.assigned_to = task.assigned_to || ''
  form.remarks = task.remarks || ''
  form.notes = task.notes || ''
  showModal.value = true
}

/** Hides the create/edit modal. */
function closeModal() {
  showModal.value = false
}

/** Creates or updates the task via the API and refreshes the list on success. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    const payload = { ...form }
    payload.departure_at = form.departure_at || form.arrival_at?.slice(0, 10)
    if (editing.value) {
      await housekeepingApi.update(editingId.value, payload)
      success.value = t('housekeeping.updateSuccess')
    } else {
      await housekeepingApi.store(payload)
      success.value = t('housekeeping.createSuccess')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Opens the assign modal for the given task, clearing any previous selection. */
function openAssign(task) {
  modalError.value = ''
  assignTaskId.value = task.task_id
  assignUserId.value = ''
  showAssign.value = true
}

/** Assigns the selected user to the task and refreshes the list on success. */
async function assignTask() {
  modalError.value = ''
  saving.value = true
  try {
    const res = await housekeepingApi.assign(assignTaskId.value, {
      assigned_to: assignUserId.value,
    })
    success.value = res.data.message || t('housekeeping.assigned')
    showAssign.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Runs a housekeeping action (e.g. start/confirm/verify) and reloads the list, surfacing API errors. */
async function runAction(task, fn, message) {
  error.value = ''
  try {
    const res = await fn(task.task_id)
    success.value = res.data.message || message
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

// One-liner wrappers that bind each housekeeping API action to the shared runAction helper.
const start = (task) => runAction(task, housekeepingApi.start, t('housekeeping.started'))
const confirm = (task) => runAction(task, housekeepingApi.confirm, t('housekeeping.confirmed'))
const verify = (task) => runAction(task, housekeepingApi.verify, t('housekeeping.verified'))
const complete = (task) => runAction(task, housekeepingApi.complete, t('housekeeping.completed'))
const remove = (task) => runAction(task, housekeepingApi.destroy, t('housekeeping.deleteSuccess'))

/**
 * Flattens a validation/API error into a single readable message string.
 * @param {Error} err - The thrown request error.
 * @returns {string} A space-joined error message or the generic failure text.
 */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
}

onMounted(() => {
  load()
  loadOptions()
})
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
  grid-template-columns: repeat(4, 1fr) auto;
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

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.table-wrap {
  overflow-x: auto;
}

.table-wrap .table {
  min-width: 1100px;
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

.form-full {
  grid-column: 1 / -1;
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
