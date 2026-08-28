<!--
  PortalStaffPage — manage hotel staff (route: /portal/staff).
  Includes search, pagination, and role-based actions.
-->
<template>
  <div class="portal-staff">
    <div class="page-header">
      <h1>Staff</h1>
      <button class="btn btn-primary" @click="showInviteModal = true">
        <i class="fas fa-user-plus"></i> Invite Staff
      </button>
    </div>

    <!-- Search & filters -->
    <div class="filters-bar card">
      <div class="search-input">
        <i class="fas fa-search"></i>
        <input v-model="search" type="text" placeholder="Search by name, email, role..." @input="debouncedSearch" />
        <button v-if="search" class="search-clear" @click="search = ''; fetchStaff()"><i class="fas fa-times"></i></button>
      </div>
      <select v-model="roleFilter" class="filter-select" @change="fetchStaff()">
        <option value="">All Roles</option>
        <option value="hotel_admin">Hotel Admin</option>
        <option value="manager">Manager</option>
        <option value="receptionist">Receptionist</option>
        <option value="accountant">Accountant</option>
        <option value="housekeeping">Housekeeping</option>
        <option value="staff">Staff</option>
      </select>
    </div>

    <div v-if="loading" class="loading-spinner"><div class="spinner"></div></div>

    <template v-else>
      <!-- Staff table -->
      <div class="card table-card">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in staff" :key="user.user_id">
                <td>
                  <div class="user-cell">
                    <div class="user-avatar" :style="{ background: avatarColor(user.full_name) }">{{ initials(user.full_name) }}</div>
                    <span class="user-name">{{ user.full_name }}</span>
                  </div>
                </td>
                <td>{{ user.email }}</td>
                <td><span class="role-badge" :class="`role-badge--${user.user_role}`">{{ user.user_role }}</span></td>
                <td>{{ user.department || '—' }}</td>
                <td><span class="status-pill" :class="user.is_active ? 'status-pill--active' : 'status-pill--inactive'">{{ user.is_active ? 'Active' : 'Inactive' }}</span></td>
                <td>
                  <button class="btn-icon" title="Edit"><i class="fas fa-pen"></i></button>
                </td>
              </tr>
              <tr v-if="!staff.length">
                <td colspan="6" class="empty-cell">No staff found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="btn btn-sm btn-secondary" :disabled="page <= 1" @click="page--; fetchStaff()">
          <i class="fas fa-chevron-left"></i> Previous
        </button>
        <span class="page-info">Page {{ page }} of {{ totalPages }}</span>
        <button class="btn btn-sm btn-secondary" :disabled="page >= totalPages" @click="page++; fetchStaff()">
          Next <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { userApi } from '@/api'

const staff = ref([])
const loading = ref(true)
const search = ref('')
const roleFilter = ref('')
const page = ref(1)
const perPage = 15
const total = ref(0)
const totalPages = ref(0)
const showInviteModal = ref(false)

let searchTimeout = null
function debouncedSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { page.value = 1; fetchStaff() }, 300)
}

async function fetchStaff() {
  loading.value = true
  try {
    const params = { page: page.value, per_page: perPage }
    if (search.value) params.search = search.value
    if (roleFilter.value) params.role = roleFilter.value
    const { data } = await userApi.index(params)
    staff.value = data.data || data.staff || data
    total.value = data.total || staff.value.length
    totalPages.value = data.last_page || Math.ceil(total.value / perPage)
  } catch {
    staff.value = []
  } finally {
    loading.value = false
  }
}

function initials(name) {
  return (name || '?').split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase()
}

function avatarColor(name) {
  const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']
  let hash = 0
  for (const c of (name || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

onMounted(fetchStaff)
</script>

<style scoped>
.portal-staff { max-width: 1100px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h1 { font-size: 24px; font-weight: 800; margin: 0; }

.filters-bar { display: flex; gap: 12px; padding: 12px 16px; margin-bottom: 16px; }
.search-input { display: flex; align-items: center; gap: 8px; flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 12px; }
.search-input i { color: #94a3b8; font-size: 13px; }
.search-input input { flex: 1; border: none; background: transparent; padding: 8px 0; font-size: 13px; outline: none; }
.search-clear { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 12px; }
.filter-select { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; background: #fff; min-width: 140px; }

.table-card { padding: 0; overflow: hidden; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
.data-table thead th { background: #f8fafc; font-weight: 600; color: #334155; }
.data-table tbody tr:hover { background: #f8fafc; }
.empty-cell { text-align: center; color: #94a3b8; padding: 32px 16px !important; }

.user-cell { display: flex; align-items: center; gap: 10px; }
.user-avatar { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0; }
.user-name { font-weight: 500; }

.role-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
.role-badge--hotel_admin { background: #dbeafe; color: #2563eb; }
.role-badge--manager { background: #d1fae5; color: #059669; }
.role-badge--receptionist { background: #fef3c7; color: #d97706; }
.role-badge--accountant { background: #ede9fe; color: #7c3aed; }
.role-badge--housekeeping { background: #fce7f3; color: #db2777; }
.role-badge--staff { background: #f1f5f9; color: #475569; }

.status-pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.status-pill--active { background: #d1fae5; color: #059669; }
.status-pill--inactive { background: #fee2e2; color: #dc2626; }

.btn-icon { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: color 0.15s; }
.btn-icon:hover { color: #3b82f6; background: #eff6ff; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
.page-info { font-size: 13px; color: #64748b; }

.btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s; }
.btn-primary { background: #3b82f6; color: #fff; }
.btn-primary:hover { background: #2563eb; }
.btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.btn-secondary:hover { background: #e2e8f0; }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 6px 12px; font-size: 12px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }

.loading-spinner { display: flex; justify-content: center; padding: 40px 20px; }
.spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
