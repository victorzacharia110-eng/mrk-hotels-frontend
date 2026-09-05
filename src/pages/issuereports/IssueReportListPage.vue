<!--
  IssueReportListPage.vue
  Internal issue/maintenance report tracker. Any staff member can file a
  report (category, priority, description) and follow its comment thread;
  managers (module 80 permission) additionally see reporter identity, can
  update status/resolution/assignee, and can send private targeted questions
  to employees from the detail modal. Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Page header: refresh plus "new report" button (available to all staff) -->
    <div class="page-head">
      <div>
        <h1>{{ $t('issueReports.title') }}</h1>
        <p class="muted">{{ $t('issueReports.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('common.refresh') }}
        </button>
        <button class="btn btn-primary" @click="openCreate">
          <i class="fas fa-flag"></i> {{ $t('issueReports.newReport') }}
        </button>
        <TableExportButton
          filename="issue-reports"
          :load-all="loadAllReports"
          :title="$t('issueReports.title')"
        />
      </div>
    </div>

    <!-- Global success / error feedback banners -->
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Filter bar: narrows reports by status, category, priority or search text -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('issueReports.status') }}</label>
          <SearchableSelect
            v-model="filters.status"
            :options="statusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('issueReports.category') }}</label>
          <SearchableSelect
            v-model="filters.category"
            :options="categoryOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('issueReports.priority') }}</label>
          <SearchableSelect
            v-model="filters.priority"
            :options="priorityOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input
            v-model="filters.search"
            type="text"
            class="input"
            :placeholder="$t('issueReports.searchPlaceholder')"
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
    <div v-if="loading" class="alert alert-info">{{ $t('issueReports.loading') }}</div>

    <!-- Reports table; the "reported by" column is only rendered for managers -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('issueReports.reportNumber') }}</th>
            <th scope="col">{{ $t('issueReports.title') }}</th>
            <th scope="col">{{ $t('issueReports.category') }}</th>
            <th scope="col">{{ $t('issueReports.priority') }}</th>
            <th scope="col">{{ $t('issueReports.status') }}</th>
            <th scope="col" v-if="canManage">{{ $t('issueReports.reportedBy') }}</th>
            <th scope="col">{{ $t('issueReports.reportedAt') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="report in reports" :key="report.issue_report_id">
            <td>
              <strong>{{ report.report_number }}</strong>
            </td>
            <td>{{ report.title }}</td>
            <td class="capitalize">{{ categoryLabel(report.category) }}</td>
            <td>
              <span class="badge" :class="priorityBadge(report.priority)">{{
                priorityLabel(report.priority)
              }}</span>
            </td>
            <td>
              <span class="badge" :class="statusBadge(report.status)">{{
                statusLabel(report.status)
              }}</span>
            </td>
            <td v-if="canManage">{{ report.reporter?.full_name || '-' }}</td>
            <td>{{ formatDateTime(report.created_at) }}</td>
            <td>
              <button class="btn btn-sm btn-secondary" @click="openDetail(report)">
                <i class="fas fa-eye"></i> {{ $t('common.view') }}
              </button>
            </td>
          </tr>
          <tr v-if="!reports.length && !loading">
            <td :colspan="canManage ? 8 : 7" class="muted">{{ $t('issueReports.empty') }}</td>
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

    <!-- Create report modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="closeCreate">
      <div class="modal">
        <div class="modal-head">
          <h2><i class="fas fa-flag"></i> {{ $t('issueReports.newReport') }}</h2>
          <button class="modal-close" @click="closeCreate"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>{{ $t('issueReports.title') }} *</label>
              <input v-model="form.title" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('issueReports.category') }} *</label>
              <SearchableSelect v-model="form.category" :options="categoryOptions" required />
            </div>
            <div class="form-group">
              <label>{{ $t('issueReports.priority') }} *</label>
              <SearchableSelect v-model="form.priority" :options="priorityOptions" required />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('common.description') }} *</label>
              <textarea v-model="form.description" rows="4" class="textarea" required></textarea>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeCreate">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('issueReports.submitReport') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Detail modal -->
    <div v-if="detail" class="modal-overlay" @click.self="closeDetail">
      <div class="modal detail-modal">
        <div class="modal-head">
          <h2><i class="fas fa-flag"></i> {{ detail.report_number }}</h2>
          <button class="modal-close" @click="closeDetail"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <div v-if="detailSuccess" class="alert alert-success">{{ detailSuccess }}</div>

        <h3 class="detail-title">{{ detail.title }}</h3>
        <div class="detail-meta">
          <span class="badge" :class="statusBadge(detail.status)">{{
            statusLabel(detail.status)
          }}</span>
          <span class="badge" :class="priorityBadge(detail.priority)">{{
            priorityLabel(detail.priority)
          }}</span>
          <span class="badge badge-gray capitalize">{{ categoryLabel(detail.category) }}</span>
          <span class="muted"
            >{{ $t('issueReports.reportedAt') }} {{ formatDateTime(detail.created_at) }}</span
          >
          <span v-if="detail.reporter" class="muted"
            >{{ $t('issueReports.reportedBy') }}: {{ detail.reporter.full_name }}</span
          >
          <span v-if="detail.assigned_to_user" class="muted"
            >{{ $t('issueReports.assignedTo') }}: {{ detail.assigned_to_user.full_name }}</span
          >
        </div>

        <div class="detail-description">
          <p>{{ detail.description }}</p>
        </div>

        <div v-if="detail.resolution" class="detail-resolution">
          <h4><i class="fas fa-check-circle"></i> {{ $t('issueReports.resolution') }}</h4>
          <p>{{ detail.resolution }}</p>
          <p v-if="detail.resolved_at" class="muted">
            {{ $t('issueReports.resolvedAt') }} {{ formatDateTime(detail.resolved_at) }}
          </p>
        </div>

        <!-- Manager respond panel -->
        <div
          v-if="canManage && detail.status !== 'resolved' && detail.status !== 'cancelled'"
          class="respond-panel"
        >
          <h4><i class="fas fa-reply"></i> {{ $t('issueReports.respond') }}</h4>
          <form @submit.prevent="respond">
            <div class="form-grid">
              <div class="form-group">
                <label>{{ $t('issueReports.status') }}</label>
                <SearchableSelect v-model="respondForm.status" :options="respondStatusOptions" />
              </div>
              <div class="form-group">
                <label>{{ $t('issueReports.assignTo') }}</label>
                <SearchableSelect
                  v-model="respondForm.assigned_to"
                  :options="userOptions"
                  :empty-label="$t('common.none')"
                />
              </div>
              <div class="form-group form-full">
                <label>{{ $t('issueReports.resolution') }}</label>
                <textarea
                  v-model="respondForm.resolution"
                  rows="3"
                  class="textarea"
                  :placeholder="$t('issueReports.resolutionPlaceholder')"
                ></textarea>
              </div>
            </div>
            <div class="modal-foot">
              <button type="submit" class="btn btn-primary" :disabled="responding">
                <i class="fas fa-check"></i>
                {{ responding ? $t('common.saving') : $t('issueReports.updateReport') }}
              </button>
            </div>
          </form>
        </div>

        <!-- Manager: ask a targeted employee a private question -->
        <div v-if="canManage" class="respond-panel private-panel">
          <h4><i class="fas fa-lock"></i> {{ $t('issueReports.askPrivately') }}</h4>
          <form @submit.prevent="askPrivately">
            <div class="form-grid">
              <div class="form-group form-full">
                <label>{{ $t('issueReports.askTarget') }} *</label>
                <SearchableSelect
                  v-model="privateAsk.directed_to"
                  :options="userOptions"
                  :empty-label="$t('issueReports.selectEmployee')"
                  required
                />
              </div>
              <div class="form-group form-full">
                <label>{{ $t('issueReports.privateQuestion') }} *</label>
                <textarea
                  v-model="privateAsk.body"
                  rows="3"
                  class="textarea"
                  :placeholder="$t('issueReports.privateQuestionPlaceholder')"
                  required
                ></textarea>
              </div>
            </div>
            <div class="modal-foot">
              <button type="submit" class="btn btn-primary" :disabled="askingPrivate">
                <i class="fas fa-lock"></i>
                {{ askingPrivate ? $t('common.saving') : $t('issueReports.askPrivately') }}
              </button>
            </div>
          </form>
        </div>

        <!-- Comments thread -->
        <div class="comments">
          <h4><i class="fas fa-comments"></i> {{ $t('issueReports.comments') }}</h4>
          <div v-if="!detail.comments || !detail.comments.length" class="muted">
            {{ $t('issueReports.noComments') }}
          </div>
          <div
            v-for="comment in detail.comments"
            :key="comment.issue_report_comment_id"
            class="comment-row"
            :class="{ 'private-comment': comment.is_private }"
          >
            <div class="comment-head">
              <strong>{{ comment.user?.full_name || '—' }}</strong>
              <span v-if="comment.is_private" class="badge badge-purple"
                ><i class="fas fa-lock"></i> {{ $t('issueReports.private') }}</span
              >
              <span v-if="comment.directed_to_user" class="muted"
                >{{ $t('issueReports.privateTo') }}: {{ comment.directed_to_user.full_name }}</span
              >
              <span class="muted">{{ formatDateTime(comment.created_at) }}</span>
            </div>
            <p>{{ comment.body }}</p>
          </div>

          <form class="comment-form" @submit.prevent="addComment">
            <textarea
              v-model="commentBody"
              rows="2"
              class="textarea"
              :placeholder="$t('issueReports.commentPlaceholder')"
              required
            ></textarea>
            <button type="submit" class="btn btn-primary" :disabled="commenting">
              <i class="fas fa-paper-plane"></i>
              {{ commenting ? $t('common.saving') : $t('issueReports.postComment') }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { issueReportApi, userApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import { collectAllRows } from '@/utils/export'
import { useCategoriesStore } from '@/stores/categories'

const { t } = useI18n()
const authStore = useAuthStore()
// Permission flag: managing/responding to issue reports requires module 80 access.
const canManage = computed(() => authStore.can(80))

// List/table state: report rows, user lookups, pagination, filters and UI flags.
const reports = ref([])
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
const filters = reactive({ status: '', category: '', priority: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

// Create-report modal state.
const showCreate = ref(false)
const saving = ref(false)
const modalError = ref('')
const form = reactive({ title: '', category: '', priority: 'normal', description: '' })

// Detail modal state: the loaded report, feedback messages and per-action flags.
const detail = ref(null)
const detailSuccess = ref('')
const commenting = ref(false)
const responding = ref(false)
const commentBody = ref('')
const respondForm = reactive({ status: '', resolution: '', assigned_to: '' })
const privateAsk = reactive({ directed_to: '', body: '' })
const askingPrivate = ref(false)

// Report categories (filter bar and create form) come from the shared catalog.
const categoriesStore = useCategoriesStore()
const categoryOptions = categoriesStore.issueCategoryOptions

// Priority levels from low to urgent (filter bar and create form).
const priorityOptions = [
  { value: 'low', label: t('issueReports.priorityLow') },
  { value: 'normal', label: t('issueReports.priorityNormal') },
  { value: 'high', label: t('issueReports.priorityHigh') },
  { value: 'urgent', label: t('issueReports.priorityUrgent') },
]

// Report workflow statuses (filter bar).
const statusOptions = [
  { value: 'new', label: t('issueReports.statusNew') },
  { value: 'in_progress', label: t('issueReports.statusInProgress') },
  { value: 'resolved', label: t('issueReports.statusResolved') },
  { value: 'cancelled', label: t('issueReports.statusCancelled') },
]

// Statuses a manager may set from the respond panel (currently all of them).
const respondStatusOptions = computed(() =>
  statusOptions.filter(
    (option) =>
      option.value === 'new' ||
      option.value === 'in_progress' ||
      option.value === 'resolved' ||
      option.value === 'cancelled',
  ),
)

// Employee dropdown options used by the assign and private-question selectors.
const userOptions = computed(() =>
  users.value.map((user) => ({ value: user.user_id, label: user.full_name })),
)

/** Maps a category key to its translated display label. */
function categoryLabel(category) {
  const map = {
    billing: t('issueReports.categoryBilling'),
    reservation: t('issueReports.categoryReservation'),
    housekeeping: t('issueReports.categoryHousekeeping'),
    food_beverage: t('issueReports.categoryFoodBeverage'),
    inventory: t('issueReports.categoryInventory'),
    facility: t('issueReports.categoryFacility'),
    it_system: t('issueReports.categoryItSystem'),
    other: t('issueReports.categoryOther'),
  }
  return map[category] || category
}

/** Maps a priority key to its translated display label. */
function priorityLabel(priority) {
  const map = {
    low: t('issueReports.priorityLow'),
    normal: t('issueReports.priorityNormal'),
    high: t('issueReports.priorityHigh'),
    urgent: t('issueReports.priorityUrgent'),
  }
  return map[priority] || priority
}

/** Returns the CSS badge class for the given priority. */
function priorityBadge(priority) {
  const map = { low: 'badge-gray', normal: 'badge-blue', high: 'badge-yellow', urgent: 'badge-red' }
  return map[priority] || 'badge-gray'
}

/** Maps a report status key to its translated display label. */
function statusLabel(status) {
  const map = {
    new: t('issueReports.statusNew'),
    in_progress: t('issueReports.statusInProgress'),
    resolved: t('issueReports.statusResolved'),
    cancelled: t('issueReports.statusCancelled'),
  }
  return map[status] || status
}

/** Returns the CSS badge class for the given report status. */
function statusBadge(status) {
  const map = {
    new: 'badge-yellow',
    in_progress: 'badge-blue',
    resolved: 'badge-green',
    cancelled: 'badge-gray',
  }
  return map[status] || 'badge-gray'
}

/** Formats an ISO datetime string for display, or '-' when absent. */
function formatDateTime(date) {
  return date ? String(date).slice(0, 16).replace('T', ' ') : '-'
}

/**
 * Fetches the paginated report list using the current filters and page.
 * Stores the rows and pagination meta, surfacing errors via the error banner.
 */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await issueReportApi.index({
      status: filters.status,
      category: filters.category,
      priority: filters.priority,
      search: filters.search,
      page: page.value,
      per_page: 15,
    })
    reports.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('issueReports.loadError')
  } finally {
    loading.value = false
  }
}

const loadAllReports = () =>
  collectAllRows((page, perPage) =>
    issueReportApi.index({
      status: filters.status,
      category: filters.category,
      priority: filters.priority,
      search: filters.search,
      page,
      per_page: perPage,
    }),
  )

/** Loads the list of users for the assign/private-ask selectors; failures are silently ignored. */
async function loadUsers() {
  try {
    users.value = (await userApi.index({ per_page: 100 })).data.data || []
  } catch {
    // ignore
  }
}

/** Sets the page number and reloads the report list. */
function goPage(page) {
  page.value = page
  load()
}

/** Resets all filter criteria and reloads the list from page 1. */
function clearFilters() {
  page.value = 1
  filters.status = ''
  filters.category = ''
  filters.priority = ''
  filters.search = ''
  load()
}

/** Resets to page 1 and reloads on search input. */
function triggerSearch() {
  page.value = 1
  load()
}

/** Resets the form and opens the create-report modal. */
function openCreate() {
  form.title = ''
  form.category = ''
  form.priority = 'normal'
  form.description = ''
  modalError.value = ''
  showCreate.value = true
}

/** Hides the create-report modal. */
function closeCreate() {
  showCreate.value = false
}

/** Submits a new issue report via the API and reloads the list on success. */
async function save() {
  modalError.value = ''
  saving.value = true
  try {
    await issueReportApi.store({
      title: form.title,
      category: form.category,
      priority: form.priority,
      description: form.description,
    })
    success.value = t('issueReports.createSuccess')
    showCreate.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Loads a single report's full detail and primes the respond/ask forms, then opens the viewer. */
async function openDetail(report) {
  modalError.value = ''
  detailSuccess.value = ''
  commentBody.value = ''
  try {
    const res = await issueReportApi.show(report.issue_report_id)
    detail.value = res.data.report
    respondForm.status = detail.value.status
    respondForm.resolution = ''
    respondForm.assigned_to = detail.value.assigned_to || ''
    privateAsk.directed_to = ''
    privateAsk.body = ''
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Closes the detail modal by clearing the currently loaded report. */
function closeDetail() {
  detail.value = null
}

/** Posts a public comment on the open report and updates the detail from the response. */
async function addComment() {
  if (!detail.value) return
  commenting.value = true
  modalError.value = ''
  try {
    const res = await issueReportApi.comment(detail.value.issue_report_id, {
      body: commentBody.value,
    })
    detail.value = res.data.report
    commentBody.value = ''
    detailSuccess.value = t('issueReports.commentAdded')
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    commenting.value = false
  }
}

/** Sends a private question directed at a specific employee on the open report. */
async function askPrivately() {
  if (!detail.value) return
  askingPrivate.value = true
  modalError.value = ''
  try {
    const res = await issueReportApi.comment(detail.value.issue_report_id, {
      body: privateAsk.body,
      is_private: true,
      directed_to: privateAsk.directed_to,
    })
    detail.value = res.data.report
    detailSuccess.value = t('issueReports.privateQuestionSent')
    privateAsk.directed_to = ''
    privateAsk.body = ''
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    askingPrivate.value = false
  }
}

/** Applies the manager's status/resolution/assignment response to the open report. */
async function respond() {
  if (!detail.value) return
  responding.value = true
  modalError.value = ''
  try {
    const payload = {}
    if (respondForm.status) payload.status = respondForm.status
    if (respondForm.resolution) payload.resolution = respondForm.resolution
    if (respondForm.assigned_to) payload.assigned_to = respondForm.assigned_to
    const res = await issueReportApi.respond(detail.value.issue_report_id, payload)
    detail.value = res.data.report
    respondForm.status = detail.value.status
    respondForm.resolution = ''
    detailSuccess.value = t('issueReports.updateSuccess')
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    responding.value = false
  }
}

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
  if (canManage.value) loadUsers()
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

.detail-modal {
  max-width: 680px;
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

.detail-title {
  font-size: 18px;
  font-weight: 700;
  margin: 12px 0 8px;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.detail-description {
  background: #f7f9fc;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 14px;
  white-space: pre-wrap;
}

.detail-resolution {
  border-left: 4px solid #1e8449;
  background: #eafaf1;
  border-radius: 0 8px 8px 0;
  padding: 12px 16px;
  margin-bottom: 14px;
}

.detail-resolution h4 {
  color: #1e8449;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.respond-panel {
  border: 1px solid #e3e9f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.respond-panel h4 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #005eb8;
  margin-bottom: 4px;
}

.private-panel {
  border-color: #e0d5f5;
  background: #faf8ff;
}

.private-panel h4 {
  color: #7d3c98;
}

.private-comment {
  border-color: #e0d5f5;
  background: #faf8ff;
}

.comments h4 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #005eb8;
  margin: 6px 0 12px;
}

.comment-row {
  border: 1px solid #f1f1f1;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 10px;
}

.comment-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.comment-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}

.comment-form button {
  align-self: flex-end;
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
