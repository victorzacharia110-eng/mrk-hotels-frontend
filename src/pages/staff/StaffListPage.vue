<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('staff.title') }}</h1>
        <p class="muted">{{ $t('staff.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load"><i class="fas fa-rotate"></i> {{ $t('staff.refresh') }}</button>
        <button class="btn btn-primary" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('staff.newStaff')
          }}</button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

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
          <input v-model="filters.search" type="text" class="input" :placeholder="$t('staff.searchPlaceholder')"
            @input="triggerSearch" />
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
          <button class="btn btn-secondary btn-sm" @click="clearFilters"><i class="fas fa-filter-circle-xmark"></i> {{
            $t('common.clear') }}</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('staff.loading') }}</div>

    <div v-else class="table-scroll">
      <table class="table">
      <thead>
        <tr>
          <th>{{ $t('staff.tableStaff') }}</th>
          <th>{{ $t('staff.contact') }}</th>
          <th>{{ $t('staff.role') }}</th>
          <th>{{ $t('common.department') }}</th>
          <th>{{ $t('staff.position') }}</th>
          <th>{{ $t('staff.lastLogin') }}</th>
          <th>{{ $t('staff.status') }}</th>
          <th>{{ $t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.user_id">
          <td>
            <div class="staff-cell">
              <img v-if="u.profile_picture" :src="u.profile_picture" class="avatar" alt="" />
              <span v-else class="avatar avatar-icon"><i class="fas fa-user"></i></span>
              <div>
                <strong>{{ u.full_name }}</strong>
                <div class="muted">{{ u.registration_number || '-' }}</div>
              </div>
            </div>
          </td>
          <td>
            <div>{{ u.email }}</div>
            <div class="muted">{{ u.phone || '-' }}</div>
          </td>
          <td>
            <span class="badge" :class="roleBadge(u.user_role)">{{ roleLabel(u.user_role) }}</span>
          </td>
          <td class="capitalize">{{ $t(`common.departments.${u.department}`) }}</td>
          <td class="capitalize">{{ u.position || '-' }}</td>
          <td>{{ formatDate(u.last_login) }}</td>
          <td><span class="badge" :class="u.is_active ? 'badge-green' : 'badge-red'">{{ u.is_active ? $t('staff.active')
            : $t('staff.inactive') }}</span></td>
          <td>
            <div class="actions">
              <button v-if="canEdit(u)" class="btn btn-sm btn-secondary" @click="openEdit(u)"><i class="fas fa-pen"></i> {{
                $t('common.edit') }}</button>
              <button v-if="u.is_active && !isSelf(u) && canEdit(u)" class="btn btn-sm btn-secondary" @click="invite(u)">{{
                $t('staff.invite') }}</button>
              <button v-if="u.is_active && !isSelf(u) && canEdit(u)" class="btn btn-sm btn-danger" @click="deactivate(u)">{{
                $t('staff.deactivate') }}</button>
              <button v-if="!u.is_active && canEdit(u)" class="btn btn-sm btn-success" @click="activate(u)">{{ $t('staff.activate')
                }}</button>
            </div>
          </td>
        </tr>
        <tr v-if="!users.length && !loading">
          <td colspan="8" class="muted">{{ $t('staff.empty') }}</td>
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
          <h2><i class="fas fa-user-tie"></i> {{ editing ? $t('staff.editStaff') : $t('staff.newStaff') }}</h2>
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
          <div class="muted">{{ $t('staff.resetToFullName') }}. {{ $t('staff.shareWithStaff') }}</div>
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
              <SearchableSelect v-model="form.user_role" :options="assignableRoles" :required="true" />
            </div>
            <div class="form-group">
              <label>{{ $t('staff.departmentRequired') }}</label>
              <SearchableSelect v-model="form.department" :options="departmentOptions" :required="true" />
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
                <img v-if="form.picture_preview" :src="form.picture_preview" class="picture-preview" alt="" />
                <span v-else class="picture-preview picture-placeholder"><i class="fas fa-user"></i></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" class="input" @change="onProfilePicture" />
              </div>
            </div>

            <div class="form-group form-full" v-if="editing">
              <label>{{ $t('staff.attachments') }}</label>
              <div v-if="attachments.length" class="attachment-list">
                <div v-for="att in attachments" :key="att.staff_attachment_id" class="attachment-item">
                  <a :href="attachmentUrl(att)" target="_blank" rel="noopener">
                    <i class="fas fa-paperclip"></i> {{ att.original_name }}
                  </a>
                  <span class="muted">{{ formatBytes(att.size) }}</span>
                  <button type="button" class="btn btn-sm btn-danger" @click="removeAttachment(att)">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              <div v-else class="muted">{{ $t('staff.noAttachment') }}</div>
              <div class="attachment-add">
                <input ref="attachmentInput" type="file" class="input" @change="onAttachmentFile" />
                <button type="button" class="btn btn-sm btn-secondary" :disabled="!newAttachmentFile || uploading"
                  @click="uploadAttachment">
                  <i class="fas fa-upload"></i> {{ $t('staff.addAttachment') }}
                </button>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i> {{ saving ? $t('common.saving') : (editing ? $t('staff.updateStaff') :
                $t('staff.saveStaff')) }}
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
import { normalizePhoneNumber } from '@/utils/phone'

const { t } = useI18n()

const authStore = useAuthStore()

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

const departmentOptions = computed(() =>
  DEPARTMENTS.map((d) => ({ value: d, label: t(`common.departments.${d}`) })),
)

const positionOptions = computed(() =>
  POSITIONS.map((p) => ({ value: p, label: p.replace('_', ' ') })),
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

const users = ref([])
const page = ref(1)
const meta = ref({ total: 0, per_page: 15, current_page: 1, last_page: 1, prev_page_url: null, next_page_url: null })
const filters = reactive({ role: '', department: '', search: '', is_active: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

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

const branch = computed(() => authStore.user?.tenant || null)

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

function roleLabel(v) {
  return ROLES.find((r) => r.value === v)?.label || v
}

function roleBadge(v) {
  const map = { hotel_admin: 'badge-red', manager: 'badge-blue', accountant: 'badge-blue', receptionist: 'badge-green', staff: 'badge-gray' }
  return map[v] || 'badge-yellow'
}

function formatDate(d) {
  return d ? String(d).slice(0, 16).replace('T', ' ') : t('common.never')
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}

function attachmentUrl(att) {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '')
  return `${base}/storage/${att.file_path}`
}

function isSelf(u) {
  return u.user_id === authStore.user?.user_id
}

/** The hotel admin only manages the manager; the manager manages regular staff. */
const assignableRoles = computed(() => {
  if (authStore.isSuperadmin) return ROLES
  if (authStore.isHotelAdmin) return ROLES.filter((r) => r.value === 'manager')
  return ROLES.filter((r) => !['superadmin', 'hotel_admin', 'manager'].includes(r.value))
})

/** A manager can edit or deactivate regular staff but not peers or admins. */
function canEdit(u) {
  if (authStore.isSuperadmin) return true
  if (authStore.isHotelAdmin) return u.user_role === 'manager'
  return !['superadmin', 'hotel_admin', 'manager'].includes(u.user_role)
}

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

function goPage(p) {
  page.value = p
  load()
}

function clearFilters() {
  page.value = 1
  filters.role = ''
  filters.department = ''
  filters.search = ''
  filters.is_active = ''
  load()
}

function triggerSearch() {
  page.value = 1
  load()
}

function onProfilePicture(e) {
  const file = e.target.files?.[0]
  form.profile_picture = file || null
  if (file) {
    form.picture_preview = URL.createObjectURL(file)
  }
}

function onAttachmentFile(e) {
  newAttachmentFile.value = e.target.files?.[0] || null
}

function openCreate() {
  resetForm()
  modalError.value = ''
  invitation.value = null
  editing.value = false
  editingId.value = null
  showModal.value = true
}

function openEdit(u) {
  resetForm()
  modalError.value = ''
  invitation.value = null
  editing.value = true
  editingId.value = u.user_id
  form.first_name = u.first_name || ''
  form.last_name = u.last_name || ''
  form.email = u.email
  form.phone = u.phone || ''
  form.country_code = u.country_code || 'TZ'
  form.user_role = u.user_role
  form.department = u.department
  form.position = u.position || ''
  form.id_type = u.id_type || ''
  form.id_number = u.id_number || ''
  form.is_sub_manager = !!u.is_sub_manager
  form.is_active = !!u.is_active
  form.picture_preview = u.profile_picture || ''
  attachments.value = u.attachments || []
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

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

async function removeAttachment(att) {
  if (!window.confirm(t('common.delete'))) return
  modalError.value = ''
  try {
    await userApi.removeAttachment(editingId.value, att.staff_attachment_id)
    attachments.value = attachments.value.filter((a) => a.staff_attachment_id !== att.staff_attachment_id)
    success.value = t('staff.attachmentDeleted')
  } catch (err) {
    modalError.value = flattenError(err)
  }
}

async function runAction(u, fn, message, confirmMsg) {
  if (confirmMsg && !window.confirm(confirmMsg)) return
  error.value = ''
  try {
    const res = await fn(u.user_id)
    success.value = res.data.message || message
    if (res.data.invitation) invitation.value = res.data.invitation
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

const invite = (u) => runAction(u, userApi.invite, t('staff.invitationSent', { email: u.email, password: u.full_name.toUpperCase() }))
const activate = (u) => runAction(u, userApi.activate, t('staff.activated', { name: u.full_name }))
const deactivate = (u) => runAction(u, userApi.destroy, t('staff.deactivated', { name: u.full_name }), t('staff.deactivateConfirm', { name: u.full_name }))

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
  color: #005EB8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
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
  color: #005EB8;
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
  color: #005EB8;
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
  color: #005EB8;
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
