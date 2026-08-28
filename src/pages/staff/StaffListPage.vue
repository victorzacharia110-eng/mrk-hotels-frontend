<!--
  Staff page (route: /app/staff, name: hotel-staff).
  Staff account management for a hotel: a filterable paginated list with
  role-based editing rules, a create/edit modal with profile picture and
  attachments, plus invite, activate, deactivate and set-PIN actions
  (the PIN enables the iPOS-style PIN sign-in mode on the login page).
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('staff.title') }}</h1>
        <p class="muted">{{ $t('staff.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('staff.refresh') }}
        </button>
        <button class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('staff.newStaff') }}
        </button>
        <TableExportButton
          filename="staff"
          :load-all="loadAllStaff"
          :columns="[
            { key: 'full_name', label: $t('staff.tableStaff') },
            { key: 'registration_number', label: 'Reg #' },
            { key: 'email', label: $t('common.email') },
            { key: 'phone', label: $t('common.phone') },
            { key: 'user_role', label: $t('staff.role') },
            { key: 'department', label: $t('common.department') },
            { key: 'position', label: $t('staff.position') },
            { key: 'last_login', label: $t('staff.lastLogin') },
            { key: 'is_active', label: $t('staff.status') },
          ]"
        />
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Role/department/search/status filters; each change reloads the list -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('staff.role') }}</label>
          <SearchableSelect
            v-model="filters.role"
            :options="ROLES"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('common.department') }}</label>
          <SearchableSelect
            v-model="filters.department"
            :options="departmentOptions"
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
            :placeholder="$t('staff.searchPlaceholder')"
            @input="triggerSearch"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('staff.status') }}</label>
          <SearchableSelect
            v-model="filters.is_active"
            :options="staffStatusOptions"
            :empty-label="$t('common.all')"
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

    <div v-if="loading" class="alert alert-info">{{ $t('staff.loading') }}</div>

    <!-- Staff table; row actions respect the role hierarchy via canEdit/isSelf -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('staff.tableStaff') }}</th>
            <th scope="col">{{ $t('staff.contact') }}</th>
            <th scope="col">{{ $t('staff.role') }}</th>
            <th scope="col">{{ $t('common.department') }}</th>
            <th scope="col">{{ $t('staff.position') }}</th>
            <th scope="col">{{ $t('staff.lastLogin') }}</th>
            <th scope="col">{{ $t('staff.online') }}</th>
            <th scope="col">{{ $t('staff.status') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.user_id">
            <td>
              <div class="staff-cell">
                <span class="avatar-wrap">
                  <img v-if="u.profile_picture" :src="u.profile_picture" class="avatar" alt="" />
                  <span v-else class="avatar avatar-icon"><i class="fas fa-user"></i></span>
                  <span
                    v-if="isOnline(u.user_id)"
                    class="online-dot"
                    :title="$t('staff.online')"
                  ></span>
                </span>
                <div>
                  <strong>
                    {{ u.full_name }}
                    <span v-if="isOnline(u.user_id)" class="online-chip">{{
                      $t('staff.online')
                    }}</span>
                  </strong>
                  <div class="muted">{{ u.registration_number || '-' }}</div>
                </div>
              </div>
            </td>
            <td>
              <div>{{ u.email }}</div>
              <div class="muted">{{ u.phone || '-' }}</div>
            </td>
            <td>
              <span class="badge" :class="roleBadge(u.user_role)">{{
                roleLabel(u.user_role)
              }}</span>
            </td>
            <td class="capitalize">{{ $t(`common.departments.${u.department}`) }}</td>
            <td class="capitalize">{{ u.position || '-' }}</td>
            <td>{{ formatDate(u.last_login) }}</td>
            <td>
              <span v-if="isOnline(u.user_id)" class="badge badge-green">
                <i class="fas fa-circle online-bullet"></i> {{ $t('staff.online') }}
              </span>
              <span v-else class="badge badge-gray">{{ $t('staff.offline') }}</span>
            </td>
            <td>
              <span class="badge" :class="u.is_active ? 'badge-green' : 'badge-red'">{{
                u.is_active ? $t('staff.active') : $t('staff.inactive')
              }}</span>
            </td>
            <td>
              <div class="actions">
                <button v-if="canEdit(u)" class="btn btn-sm btn-secondary" @click="openEdit(u)">
                  <i class="fas fa-pen"></i> {{ $t('common.edit') }}
                </button>
                <button
                  v-if="u.is_active && !isSelf(u) && canEdit(u)"
                  class="btn btn-sm btn-secondary"
                  @click="invite(u)"
                >
                  {{ $t('staff.invite') }}
                </button>
                <button
                  v-if="u.is_active && !isSelf(u) && canEdit(u)"
                  class="btn btn-sm btn-secondary"
                  @click="openPinModal(u)"
                >
                  <i class="fas fa-calculator"></i> {{ $t('staff.setPin') }}
                </button>
                <button
                  v-if="u.is_active && !isSelf(u) && canEdit(u)"
                  class="btn btn-sm btn-danger"
                  @click="deactivate(u)"
                >
                  {{ $t('staff.deactivate') }}
                </button>
                <button
                  v-if="!u.is_active && canEdit(u)"
                  class="btn btn-sm btn-success"
                  @click="activate(u)"
                >
                  {{ $t('staff.activate') }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!users.length && !loading">
            <td colspan="9" class="muted">{{ $t('staff.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination controls, only shown when there is more than one page -->
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

    <!-- Create/edit staff modal, including attachments while editing -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-user-tie"></i>
            {{ editing ? $t('staff.editStaff') : $t('staff.newStaff') }}
          </h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="branch" class="branch-info">
          <i class="fas fa-hotel"></i>
          <span>{{ $t('staff.branch') }}:</span>
          <strong>{{ branch.hotel_name }}</strong>
          <span class="muted">· {{ branch.subdomain }}.mrkhotels.test</span>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <div v-if="invitation" class="alert alert-success">
          <strong>{{ $t('staff.accountReady') }}</strong> {{ $t('staff.defaultPassword') }}
          <code>{{ invitation.default_password }}</code>
          <div class="muted">
            {{ $t('staff.resetToFullName') }}. {{ $t('staff.shareWithStaff') }}
          </div>
        </div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('staff.firstNameRequired') }}</label>
              <input v-model="form.first_name" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('staff.lastNameRequired') }}</label>
              <input v-model="form.last_name" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('staff.emailRequired') }}</label>
              <input v-model="form.email" type="email" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('staff.phone') }}</label>
              <PhoneInput v-model="form.phone" v-model:countryCode="form.country_code" />
            </div>
            <div class="form-group">
              <label>{{ $t('staff.roleRequired') }}</label>
              <SearchableSelect
                v-model="form.user_role"
                :options="assignableRoles"
                :required="true"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('staff.departmentRequired') }}</label>
              <SearchableSelect
                v-model="form.department"
                :options="departmentOptions"
                :required="true"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('staff.position') }}</label>
              <SearchableSelect
                v-model="form.position"
                :options="positionOptions"
                :empty-label="$t('common.none')"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('staff.idTypeOptional') }}</label>
              <SearchableSelect
                v-model="form.id_type"
                :options="idTypeOptions"
                :empty-label="$t('common.none')"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('staff.idNumber') }}</label>
              <input v-model="form.id_number" type="text" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('staff.subManager') }}</label>
              <SearchableSelect v-model="form.is_sub_manager" :options="subManagerOptions" />
            </div>
            <div class="form-group">
              <label>{{ $t('staff.active') }}</label>
              <SearchableSelect v-model="form.is_active" :options="isActiveOptions" />
            </div>

            <div class="form-group">
              <label>{{ $t('staff.profilePicture') }}</label>
              <div class="picture-field">
                <img
                  v-if="form.picture_preview"
                  :src="form.picture_preview"
                  class="picture-preview"
                  alt=""
                />
                <span v-else class="picture-preview picture-placeholder"
                  ><i class="fas fa-user"></i
                ></span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="input"
                  @change="onProfilePicture"
                />
              </div>
            </div>

            <!-- Attachment manager, only relevant for an existing staff member -->
            <div class="form-group form-full" v-if="editing">
              <label>{{ $t('staff.attachments') }}</label>
              <div v-if="attachments.length" class="attachment-list">
                <div
                  v-for="att in attachments"
                  :key="att.staff_attachment_id"
                  class="attachment-item"
                >
                  <a :href="attachmentUrl(att)" target="_blank" rel="noopener">
                    <i class="fas fa-paperclip"></i> {{ att.original_name }}
                  </a>
                  <span class="muted">{{ formatBytes(att.size) }}</span>
                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    @click="removeAttachment(att)"
                  >
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div v-else class="muted">{{ $t('staff.noAttachment') }}</div>
              <div class="attachment-add">
                <input ref="attachmentInput" type="file" class="input" @change="onAttachmentFile" />
                <button
                  type="button"
                  class="btn btn-sm btn-secondary"
                  :disabled="!newAttachmentFile || uploading"
                  @click="uploadAttachment"
                >
                  <i class="fas fa-upload"></i> {{ $t('staff.addAttachment') }}
                </button>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{
                saving
                  ? $t('common.saving')
                  : editing
                    ? $t('staff.updateStaff')
                    : $t('staff.saveStaff')
              }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Set-PIN modal: admin/manager assigns the 4-digit login PIN used by the PIN sign-in mode.
         Auto-generates a PIN by default; the admin can switch to typing one manually. -->
    <div v-if="showPinModal" class="modal-overlay" @click.self="closePinModal">
      <div class="modal modal-pin">
        <div class="modal-head">
          <h2><i class="fas fa-calculator"></i> {{ $t('staff.setPinTitle') }}</h2>
          <button class="modal-close" @click="closePinModal"><i class="fas fa-xmark"></i></button>
        </div>

        <p class="muted pin-subtitle">{{ $t('staff.setPinFor', { name: pinUser?.full_name }) }}</p>

        <div v-if="pinError" class="alert alert-error">{{ pinError }}</div>

        <!-- Mode switch: generate a PIN (default) or type one manually -->
        <div class="pin-mode-switch" role="radiogroup" :aria-label="$t('staff.pinModeLabel')">
          <button
            type="button"
            class="pin-mode-option"
            :class="{ active: pinMode === 'random' }"
            role="radio"
            :aria-checked="pinMode === 'random'"
            @click="switchPinMode('random')"
          >
            <i class="fas fa-dice"></i>
            {{ $t('staff.pinModeRandom') }}
          </button>
          <button
            type="button"
            class="pin-mode-option"
            :class="{ active: pinMode === 'manual' }"
            role="radio"
            :aria-checked="pinMode === 'manual'"
            @click="switchPinMode('manual')"
          >
            <i class="fas fa-keyboard"></i>
            {{ $t('staff.pinModeManual') }}
          </button>
        </div>

        <form @submit.prevent="savePin">
          <!-- Auto-generated PIN shown in the open so it can be shared with the staff member -->
          <div v-if="pinMode === 'random'" class="form-group form-full">
            <label>{{ $t('staff.generatedPin') }}</label>
            <div class="pin-display">
              <span class="pin-display-value">{{ pinForm.pin }}</span>
              <div class="pin-actions">
                <button type="button" class="btn btn-icon" :title="$t('staff.regeneratePin')" @click="regeneratePin">
                  <i class="fas fa-rotate-right"></i>
                </button>
                <button type="button" class="btn btn-icon" :title="$t('staff.copyPin')" @click="copyPin">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>
            <p v-if="pinCopied" class="muted pin-copied-hint"><i class="fas fa-check"></i> {{ $t('staff.pinCopied') }}</p>
            <p class="muted pin-share-hint"><i class="fas fa-share"></i> {{ $t('staff.sharePinNote') }}</p>
          </div>

          <!-- Manual entry; both fields are masked with an eye toggle to reveal them -->
          <div v-else class="form-grid">
            <div class="form-group form-full">
              <label>{{ $t('staff.newPin') }}</label>
              <div class="password-input-wrap">
                <input
                  v-model="pinForm.pin"
                  :type="showPin1 ? 'text' : 'password'"
                  class="input pin-input"
                  inputmode="numeric"
                  maxlength="4"
                  autocomplete="off"
                  :placeholder="$t('staff.pinPlaceholder')"
                />
                <button type="button" class="pw-toggle" :aria-label="$t('staff.togglePinVisibility')" @click="showPin1 = !showPin1">
                  <i :class="showPin1 ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                </button>
              </div>
            </div>
            <div class="form-group form-full">
              <label>{{ $t('staff.confirmPin') }}</label>
              <div class="password-input-wrap">
                <input
                  v-model="pinForm.pin_confirmation"
                  :type="showPin2 ? 'text' : 'password'"
                  class="input pin-input"
                  inputmode="numeric"
                  maxlength="4"
                  autocomplete="off"
                  :placeholder="$t('staff.pinPlaceholder')"
                />
                <button type="button" class="pw-toggle" :aria-label="$t('staff.togglePinVisibility')" @click="showPin2 = !showPin2">
                  <i :class="showPin2 ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                </button>
              </div>
            </div>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closePinModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="pinSaving">
              <i class="fas fa-check"></i>
              {{ pinSaving ? $t('common.saving') : $t('staff.savePin') }}
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
import { userApi } from '@/api'
import PhoneInput from '@/components/PhoneInput.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import { collectAllRows } from '@/utils/export'
import { normalizePhoneNumber } from '@/utils/phone'
import { isOnline } from '@/composables/usePresence'

const { t } = useI18n()

const authStore = useAuthStore()

// Assignable staff roles, translated for the dropdowns.
const ROLES = [
  { value: 'hotel_admin', label: t('common.roles.hotelAdmin') },
  { value: 'manager', label: t('common.roles.manager') },
  { value: 'accountant', label: t('common.roles.accountant') },
  { value: 'receptionist', label: t('common.roles.receptionist') },
  { value: 'procurement_officer', label: t('common.roles.procurementOfficer') },
  { value: 'housekeeping', label: t('common.roles.housekeeping') },
  { value: 'kitchen', label: t('common.roles.kitchen') },
  { value: 'waiter', label: t('common.roles.waiter') },
  { value: 'bartender', label: t('common.roles.bartender') },
  { value: 'staff', label: t('common.roles.staff') },
]

// Department and position vocabularies used by the form dropdowns.
const DEPARTMENTS = ['administration', 'cooking', 'laundry', 'restaurant', 'bar']
const POSITIONS = [
  'manager',
  'supervisor',
  'sub_manager',
  'attendant',
  'waiter',
  'chef',
  'receptionist',
  'accountant',
  'housekeeper',
  'laundry_attendant',
  'gaming_attendant',
  'security',
  'general_staff',
]

// Translated option lists for the department, position, status and flag dropdowns.
const departmentOptions = computed(() =>
  DEPARTMENTS.map((department) => ({
    value: department,
    label: t(`common.departments.${department}`),
  })),
)

const positionOptions = computed(() =>
  POSITIONS.map((position) => ({ value: position, label: position.replace('_', ' ') })),
)

const staffStatusOptions = computed(() => [
  { value: 'true', label: t('staff.active') },
  { value: 'false', label: t('staff.inactive') },
])

const idTypeOptions = computed(() => [
  { value: 'national_id', label: t('common.idTypes.nationalId') },
  { value: 'passport', label: t('common.idTypes.passport') },
])

const subManagerOptions = computed(() => [
  { value: true, label: t('common.yes') },
  { value: false, label: t('common.no') },
])

const isActiveOptions = computed(() => [
  { value: true, label: t('staff.active') },
  { value: false, label: t('staff.inactive') },
])

// List state: staff rows, pagination, filters and feedback flags.
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
const filters = reactive({ role: '', department: '', search: '', is_active: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

// Modal state: create/edit dialog, upload/invitation feedback and attachments.
const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const uploading = ref(false)
const modalError = ref('')
const invitation = ref(null)
const attachments = ref([])
const newAttachmentFile = ref(null)
const attachmentInput = ref(null)

// Set-PIN modal state: the target staff row, the PIN pair and feedback flags.
const showPinModal = ref(false)
const pinUser = ref(null)
const pinSaving = ref(false)
const pinError = ref('')
const pinForm = reactive({ pin: '', pin_confirmation: '' })
// PIN source mode: 'random' (default) auto-generates the PIN, 'manual' lets the
// admin type it. showPin1/2 are the manual fields' eye toggles.
const pinMode = ref('random')
const showPin1 = ref(false)
const showPin2 = ref(false)
const pinCopied = ref(false)

const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  country_code: 'TZ',
  user_role: 'receptionist',
  department: 'administration',
  position: '',
  id_type: '',
  id_number: '',
  is_sub_manager: false,
  is_active: true,
  profile_picture: null,
  picture_preview: '',
})

// The branch (hotel tenant) the new or edited staff member will belong to.
const branch = computed(() => authStore.user?.tenant || null)

/** Resets the staff form, attachments and pending upload to the create defaults. */
function resetForm() {
  form.first_name = ''
  form.last_name = ''
  form.email = ''
  form.phone = ''
  form.country_code = 'TZ'
  form.user_role = 'receptionist'
  form.department = 'administration'
  form.position = ''
  form.id_type = ''
  form.id_number = ''
  form.is_sub_manager = false
  form.is_active = true
  form.profile_picture = null
  form.picture_preview = ''
  attachments.value = []
  newAttachmentFile.value = null
}

/**
 * Returns the translated label for a role code.
 * @param {string} value - The user role code.
 * @returns {string} The role label, or the raw code when unknown.
 */
function roleLabel(value) {
  return ROLES.find((role) => role.value === value)?.label || value
}

/**
 * Maps a role code to the CSS class used for its badge colour.
 * @param {string} value - The user role code.
 * @returns {string} The badge CSS class.
 */
function roleBadge(value) {
  const map = {
    hotel_admin: 'badge-red',
    manager: 'badge-blue',
    accountant: 'badge-blue',
    receptionist: 'badge-green',
    staff: 'badge-gray',
  }
  return map[value] || 'badge-yellow'
}

/**
 * Formats an ISO date-time string for display, truncating to minutes.
 * @param {string} date - The ISO date-time string (e.g. a last-login timestamp).
 * @returns {string} The formatted value, or the 'never' label when absent.
 */
function formatDate(date) {
  return date ? String(date).slice(0, 16).replace('T', ' ') : t('common.never')
}

/**
 * Formats a byte count for display next to an attachment.
 * @param {number} bytes - The file size in bytes.
 * @returns {string} The size in B or KB ('' when the size is unknown).
 */
function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}

/**
 * Builds the public URL for an attachment, stripping the /api suffix off the API base.
 * @param {Object} att - The attachment record (needs its `file_path`).
 * @returns {string} The absolute URL of the stored file.
 */
function attachmentUrl(att) {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '')
  return `${base}/storage/${att.file_path}`
}

/**
 * Returns true when the row is the currently logged-in user.
 * @param {Object} user - The staff row.
 * @returns {boolean} Whether the row represents the current user.
 */
function isSelf(user) {
  return user.user_id === authStore.user?.user_id
}

/** The hotel admin only manages the manager; the manager manages regular staff. */
const assignableRoles = computed(() => {
  if (authStore.isSuperadmin) return ROLES
  if (authStore.isHotelAdmin) return ROLES.filter((role) => role.value === 'manager')
  return ROLES.filter((role) => !['superadmin', 'hotel_admin', 'manager'].includes(role.value))
})

/** A manager can edit or deactivate regular staff but not peers or admins. */
function canEdit(user) {
  if (authStore.isSuperadmin) return true
  if (authStore.isHotelAdmin) return user.user_role === 'manager'
  return !['superadmin', 'hotel_admin', 'manager'].includes(user.user_role)
}

/** Fetches the current page of staff, honouring the active filters. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await userApi.index({
      role: filters.role,
      department: filters.department,
      search: filters.search,
      is_active: filters.is_active || undefined,
      page: page.value,
      per_page: 15,
    })
    users.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('staff.loadError')
  } finally {
    loading.value = false
  }
}

function loadAllStaff() {
  return collectAllRows((page, perPage) =>
    userApi.index({
      role: filters.role,
      department: filters.department,
      search: filters.search,
      is_active: filters.is_active || undefined,
      page,
      per_page: perPage,
    }),
  )
}

/**
 * Moves to the given page and reloads the list.
 * @param {number} page - The 1-based page number.
 */
function goPage(page) {
  page.value = page
  load()
}

/** Resets all filters and reloads from the first page. */
function clearFilters() {
  page.value = 1
  filters.role = ''
  filters.department = ''
  filters.search = ''
  filters.is_active = ''
  load()
}

/** Restarts the search from page one whenever the search text changes. */
function triggerSearch() {
  page.value = 1
  load()
}

/**
 * Stores the picked profile picture and shows a local preview of it.
 * @param {Event} event - The file input change event.
 */
function onProfilePicture(event) {
  const file = event.target.files?.[0]
  form.profile_picture = file || null
  if (file) {
    form.picture_preview = URL.createObjectURL(file)
  }
}

/**
 * Stores the attachment file picked for the next upload.
 * @param {Event} event - The file input change event.
 */
function onAttachmentFile(event) {
  newAttachmentFile.value = event.target.files?.[0] || null
}

/** Opens the staff modal in create mode with a blank form. */
function openCreate() {
  resetForm()
  modalError.value = ''
  invitation.value = null
  editing.value = false
  editingId.value = null
  showModal.value = true
}

/**
 * Opens the staff modal in edit mode, copying the user's data into the form.
 * @param {Object} user - The staff row being edited.
 */
function openEdit(user) {
  resetForm()
  modalError.value = ''
  invitation.value = null
  editing.value = true
  editingId.value = user.user_id
  form.first_name = user.first_name || ''
  form.last_name = user.last_name || ''
  form.email = user.email
  form.phone = user.phone || ''
  form.country_code = user.country_code || 'TZ'
  form.user_role = user.user_role
  form.department = user.department
  form.position = user.position || ''
  form.id_type = user.id_type || ''
  form.id_number = user.id_number || ''
  form.is_sub_manager = !!user.is_sub_manager
  form.is_active = !!user.is_active
  form.picture_preview = user.profile_picture || ''
  attachments.value = user.attachments || []
  showModal.value = true
}

/** Closes the create/edit staff modal. */
function closeModal() {
  showModal.value = false
}

/**
 * Generates a fresh random 4-digit PIN (leading zero allowed) and pre-fills
 * both confirmation fields so the modal is always save-ready in random mode.
 */
function generatePin() {
  let pin = ''
  for (let i = 0; i < 4; i++) pin += Math.floor(Math.random() * 10)
  pinForm.pin = pin
  pinForm.pin_confirmation = pin
  return pin
}

/** Switches between auto-generate and manual PIN entry. */
function switchPinMode(mode) {
  pinMode.value = mode
  if (mode === 'random') generatePin()
  else {
    pinForm.pin = ''
    pinForm.pin_confirmation = ''
  }
}

/** Re-rolls the random PIN. */
function regeneratePin() {
  pinError.value = ''
  pinCopied.value = false
  generatePin()
}

/**
 * Copies the generated PIN to the clipboard (with a legacy fallback) and
 * shows a brief confirmation.
 */
async function copyPin() {
  const pin = pinForm.pin
  try {
    await navigator.clipboard.writeText(pin)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = pin
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
    } finally {
      document.body.removeChild(textarea)
    }
  }
  pinCopied.value = true
  setTimeout(() => {
    pinCopied.value = false
  }, 1500)
}

/**
 * Opens the set-PIN modal for a staff row. Defaults to auto-generating a PIN.
 * @param {Object} user - The staff row whose login PIN is being set.
 */
function openPinModal(user) {
  pinUser.value = user
  pinMode.value = 'random'
  showPin1.value = false
  showPin2.value = false
  pinCopied.value = false
  pinError.value = ''
  generatePin()
  showPinModal.value = true
}

/** Closes the set-PIN modal. */
function closePinModal() {
  showPinModal.value = false
}

/**
 * Validates and saves the staff member's 4-digit login PIN. Both entries must
 * be exactly 4 digits and match; failures surface the backend message or a
 * flattened validation error inside the modal.
 * @returns {Promise<void>}
 */
async function savePin() {
  pinError.value = ''
  if (!/^\d{4}$/.test(pinForm.pin)) {
    pinError.value = t('staff.pinInvalid')
    return
  }
  if (pinForm.pin !== pinForm.pin_confirmation) {
    pinError.value = t('staff.pinMismatch')
    return
  }
  pinSaving.value = true
  try {
    const res = await userApi.setPin(pinUser.value.user_id, {
      pin: pinForm.pin,
      pin_confirmation: pinForm.pin_confirmation,
    })
    success.value =
      pinMode.value === 'random'
        ? t('staff.pinSetWithPin', { name: pinUser.value.full_name, pin: pinForm.pin })
        : (res.data.message || t('staff.pinSet', { name: pinUser.value.full_name }))
    showPinModal.value = false
  } catch (err) {
    pinError.value = flattenError(err)
  } finally {
    pinSaving.value = false
  }
}

/**
 * Builds the multipart form data for create/update, including the optional photo.
 * @returns {FormData} The request body.
 */
function buildPayload() {
  const fd = new FormData()
  fd.append('first_name', form.first_name)
  fd.append('last_name', form.last_name)
  fd.append('email', form.email)
  fd.append('phone', normalizePhoneNumber(form.phone, form.country_code || 'TZ'))
  fd.append('country_code', form.country_code)
  fd.append('user_role', form.user_role)
  fd.append('department', form.department)
  fd.append('position', form.position)
  fd.append('id_type', form.id_type)
  fd.append('id_number', form.id_number)
  fd.append('is_sub_manager', form.is_sub_manager ? '1' : '0')
  fd.append('is_active', form.is_active ? '1' : '0')
  if (form.profile_picture) {
    fd.append('profile_picture', form.profile_picture)
  }
  return fd
}

/** Creates or updates the staff account and surfaces the invitation credentials. */
async function save() {
  modalError.value = ''
  invitation.value = null
  saving.value = true
  try {
    const payload = buildPayload()
    if (editing.value) {
      await userApi.update(editingId.value, payload)
      success.value = t('staff.updated')
    } else {
      const res = await userApi.store(payload)
      invitation.value = res.data.invitation
      success.value = res.data.message || t('staff.created')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Uploads the picked attachment for the staff member being edited. */
async function uploadAttachment() {
  if (!newAttachmentFile.value) return
  modalError.value = ''
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('attachment', newAttachmentFile.value)
    const res = await userApi.attach(editingId.value, fd)
    attachments.value = res.data.attachments || []
    newAttachmentFile.value = null
    if (attachmentInput.value) attachmentInput.value.value = ''
    success.value = t('staff.attachmentUploaded')
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    uploading.value = false
  }
}

/**
 * Deletes an attachment after a confirmation prompt.
 * @param {Object} att - The attachment record to remove.
 */
async function removeAttachment(att) {
  if (!window.confirm(t('common.delete'))) return
  modalError.value = ''
  try {
    await userApi.removeAttachment(editingId.value, att.staff_attachment_id)
    attachments.value = attachments.value.filter(
      (attachment) => attachment.staff_attachment_id !== att.staff_attachment_id,
    )
    success.value = t('staff.attachmentDeleted')
  } catch (err) {
    modalError.value = flattenError(err)
  }
}

/**
 * Runs a staff lifecycle action with an optional confirmation, then reloads.
 * @param {Object} user - The staff row to act on.
 * @param {Function} fn - The userApi action (invite, activate, destroy).
 * @param {string} message - Fallback success message.
 * @param {string} [confirmMsg] - When set, the action requires confirmation first.
 */
async function runAction(user, fn, message, confirmMsg) {
  if (confirmMsg && !window.confirm(confirmMsg)) return
  error.value = ''
  try {
    const res = await fn(user.user_id)
    success.value = res.data.message || message
    if (res.data.invitation) invitation.value = res.data.invitation
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

// Per-row lifecycle actions, all funnelled through the shared runAction helper.
const invite = (user) =>
  runAction(
    user,
    userApi.invite,
    t('staff.invitationSent', { email: user.email, password: user.full_name.toUpperCase() }),
  )
const activate = (user) =>
  runAction(user, userApi.activate, t('staff.activated', { name: user.full_name }))
const deactivate = (user) =>
  runAction(
    user,
    userApi.destroy,
    t('staff.deactivated', { name: user.full_name }),
    t('staff.deactivateConfirm', { name: user.full_name }),
  )

/**
 * Flattens Laravel-style validation errors into a single readable message.
 * @param {Error} err - The thrown request error.
 * @returns {string} A space-joined error message or the generic failure text.
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

.staff-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.avatar-icon {
  background: #eef4fb;
  color: #005eb8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.avatar-wrap {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.online-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #2ecc40;
  border: 2px solid #fff;
}

.online-chip {
  display: inline-block;
  margin-left: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #2ecc40;
  text-transform: uppercase;
  vertical-align: middle;
}

.online-bullet {
  font-size: 8px;
  vertical-align: middle;
}

code {
  background: #fef5f5;
  color: #c0392b;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.branch-info {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f0f7ff;
  border: 1px solid #d6e9ff;
  color: #0b4a86;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 13px;
}

.branch-info i {
  color: #005eb8;
}

.branch-info .muted {
  margin-top: 0;
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
  max-width: 680px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

/* The set-PIN dialog is much narrower than the create/edit staff modal */
.modal-pin {
  max-width: 420px;
}

.pin-subtitle {
  margin-bottom: 16px;
}

/* Masked PIN entries read better centred with wide digit spacing */
.pin-input {
  text-align: center;
  letter-spacing: 6px;
  font-size: 18px;
}

/* Auto-generate vs manual mode switch */
.pin-mode-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.pin-mode-option {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  background: #f5f6f8;
  color: #555;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.15s ease;
}

.pin-mode-option:hover {
  border-color: #a7c3e8;
  color: #333;
}

.pin-mode-option.active {
  background: #1b4f9c;
  border-color: #1b4f9c;
  color: #fff;
}

/* The generated PIN readout with regenerate/copy actions */
.pin-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px dashed #1b4f9c;
  border-radius: 10px;
  background: #f0f5ff;
}

.pin-display-value {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 10px;
  color: #1b4f9c;
}

.pin-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 38px;
  height: 38px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  background: #fff;
  color: #555;
  cursor: pointer;
}

.btn-icon:hover {
  color: #1b4f9c;
  border-color: #1b4f9c;
}

.pin-copied-hint {
  margin-top: 6px;
  color: #1a7f37;
  font-size: 13px;
}

.pin-share-hint {
  margin-top: 8px;
  font-size: 13px;
}

/* Eye toggles for the manual PIN fields */
.password-input-wrap {
  position: relative;
}

.password-input-wrap .input {
  padding-right: 44px;
}

.pw-toggle {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pw-toggle:hover {
  color: #333;
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

.picture-field {
  display: flex;
  align-items: center;
  gap: 10px;
}

.picture-preview {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.picture-placeholder {
  background: #eef4fb;
  color: #005eb8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.picture-field input[type='file'] {
  font-size: 12px;
  padding: 8px;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #f1f1f1;
  border-radius: 6px;
  padding: 6px 10px;
}

.attachment-item a {
  color: #005eb8;
  font-weight: 600;
  text-decoration: none;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-item .muted {
  margin-top: 0;
}

.attachment-add {
  display: flex;
  gap: 8px;
  align-items: center;
}

.attachment-add input[type='file'] {
  flex: 1;
  font-size: 12px;
  padding: 8px;
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

  .attachment-add {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
