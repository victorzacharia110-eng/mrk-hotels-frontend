<!--
  AdminOverviewPage.vue
  Hotel admin/owner overview (route /app/overview). Combines KPI stat cards,
  an interactive staff directory with role/status filters, pagination and
  activate/deactivate actions, an in-house guest list with balances and
  check-out shortcuts, upcoming arrivals, and a housekeeping task list with
  assign/confirm/verify/complete actions. Each section's filters reload the
  overview API with debouncing. Authenticated back-office route.
-->

<template>
  <div class="dashboard-page container">
    <!-- Loading indicator shown until the first overview payload arrives -->
    <div v-if="loading" class="alert alert-info">{{ $t('overview.loading') }}</div>

    <template v-else-if="data">
      <!-- Header: page title and hotel name badge -->
      <div class="dash-header">
        <div>
          <h1>{{ $t('overview.title') }}</h1>
          <p>{{ $t('overview.subtitle') }}</p>
        </div>
        <span class="role-badge"><i class="fas fa-user-shield"></i> {{ hotelName }}</span>
      </div>

      <!-- Inline feedback banners (e.g. after toggling a staff account) -->
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div v-if="success" class="alert alert-success">{{ success }}</div>

      <!-- KPI stat cards: every metric rendered as a value plus a proportional bar.
           Blue = occupancy & stay pipeline, green = today's flow & staffing, red = attention items. -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon"><i class="fas fa-users"></i></div>
          <div class="stat-body">
            <span class="stat-value">{{ data.stats.guests_in_house }}</span
            ><span class="stat-label">{{ $t('overview.inHouse') }}</span>
            <div class="stat-bar">
              <div
                class="stat-fill fill-blue"
                :style="{ width: pctOfRooms(data.stats.guests_in_house) + '%' }"
              ></div>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon checkin"><i class="fas fa-right-to-bracket"></i></div>
          <div class="stat-body">
            <span class="stat-value">{{ data.stats.arrivals_today }}</span
            ><span class="stat-label">{{ $t('overview.arrivalsToday') }}</span>
            <div class="stat-bar">
              <div
                class="stat-fill fill-green"
                :style="{ width: pctOfFlow(data.stats.arrivals_today) + '%' }"
              ></div>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon checkout"><i class="fas fa-right-from-bracket"></i></div>
          <div class="stat-body">
            <span class="stat-value">{{ data.stats.departures_today }}</span
            ><span class="stat-label">{{ $t('overview.departuresToday') }}</span>
            <div class="stat-bar">
              <div
                class="stat-fill fill-green"
                :style="{ width: pctOfFlow(data.stats.departures_today) + '%' }" 
              ></div>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon bookings"><i class="fas fa-calendar-check"></i></div>
          <div class="stat-body">
            <span class="stat-value">{{ data.stats.upcoming_arrivals }}</span
            ><span class="stat-label">{{ $t('overview.upcomingArrivals') }}</span>
            <div class="stat-bar">
              <div
                class="stat-fill fill-blue"
                :style="{ width: pctOfRooms(data.stats.upcoming_arrivals) + '%' }"
              ></div>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon staff"><i class="fas fa-user-tie"></i></div>
          <div class="stat-body">
            <span class="stat-value"
              >{{ data.stats.staff_active }}/{{ data.stats.staff_total }}</span
            ><span class="stat-label">{{ $t('overview.staffActive') }}</span>
            <div class="stat-bar">
              <div
                class="stat-fill fill-green"
                :style="{ width: ratioPct(data.stats.staff_active, data.stats.staff_total) + '%' }"
              ></div>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon cleaning"><i class="fas fa-broom"></i></div>
          <div class="stat-body">
            <span class="stat-value">{{ data.stats.pending_housekeeping }}</span
            ><span class="stat-label">{{ $t('overview.pendingHousekeeping') }}</span>
            <div class="stat-bar">
              <div
                class="stat-fill fill-red"
                :style="{ width: pctOfRooms(data.stats.pending_housekeeping) + '%' }"
              ></div>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon rooms"><i class="fas fa-bed"></i></div>
          <div class="stat-body">
            <span class="stat-value">{{ data.stats.occupied_rooms }}</span
            ><span class="stat-label">{{ $t('overview.occupiedRooms') }}</span>
            <div class="stat-bar">
              <div
                class="stat-fill fill-blue"
                :style="{ width: pctOfRooms(data.stats.occupied_rooms) + '%' }"
              ></div>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon occupancy"><i class="fas fa-percent"></i></div>
          <div class="stat-body">
            <span class="stat-value">{{ data.stats.occupancy_rate }}%</span
            ><span class="stat-label">{{ $t('overview.occupancyRate') }}</span>
            <div class="stat-bar">
              <div
                class="stat-fill fill-blue"
                :style="{ width: Math.min(100, Number(data.stats.occupancy_rate) || 0) + '%' }"
              ></div>
            </div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon issues"><i class="fas fa-flag"></i></div>
          <div class="stat-body">
            <span class="stat-value">{{ data.stats.open_issues }}</span
            ><span class="stat-label">{{ $t('overview.openIssues') }}</span>
            <div class="stat-bar">
              <div
                class="stat-fill fill-red"
                :style="{ width: pctOfRooms(data.stats.open_issues) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Housekeeping summary: room status at a glance (clean / dirty / under maintenance) -->
      <div class="card dash-section">
        <div class="section-header-row">
          <h2><i class="fas fa-broom"></i> {{ $t('overview.housekeepingSummary') }}</h2>
          <router-link to="/app/housekeeping" class="view-all-link"
            >{{ $t('overview.viewAllHousekeeping') }} <i class="fas fa-arrow-right"></i
          ></router-link>
        </div>
        <div class="house-strip">
          <div class="house-chip house-clean">
            <div class="house-num">{{ roomStatus.clean }}</div>
            <div class="house-label">{{ $t('overview.roomsClean') }}</div>
            <div class="house-fill" :style="{ width: roomPct(roomStatus.clean) + '%' }"></div>
          </div>
          <div class="house-chip house-dirty">
            <div class="house-num">{{ roomStatus.dirty }}</div>
            <div class="house-label">{{ $t('overview.roomsDirty') }}</div>
            <div class="house-fill" :style="{ width: roomPct(roomStatus.dirty) + '%' }"></div>
          </div>
          <div class="house-chip house-blocked">
            <div class="house-num">{{ roomStatus.blocked }}</div>
            <div class="house-label">{{ $t('overview.roomsBlocked') }}</div>
            <div class="house-fill" :style="{ width: roomPct(roomStatus.blocked) + '%' }"></div>
          </div>
        </div>
      </div>

      <!-- Staff section: filterable/paginated staff table with activate/deactivate actions -->
      <div class="card dash-section">
        <div class="section-header-row">
          <h2><i class="fas fa-user-tie"></i> {{ $t('overview.staffSection') }}</h2>
          <router-link to="/app/staff" class="view-all-link"
            >{{ $t('overview.viewAllStaff') }} <i class="fas fa-arrow-right"></i
          ></router-link>
          <TableExportButton
            filename="staff"
            :title="$t('overview.staffSection')"
            :load-all="loadAllStaff"
          />
        </div>
        <div class="filter-row">
          <input
            v-model="staff.search"
            type="text"
            class="input"
            :placeholder="$t('overview.searchStaff')"
            @input="onStaffFilter"
          />
          <select v-model="staff.role" class="input select-input" @change="onStaffFilter">
            <option value="">{{ $t('overview.allRoles') }}</option>
            <option v-for="r in ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
          <select v-model="staff.status" class="input select-input" @change="onStaffFilter">
            <option value="">{{ $t('overview.allStatuses') }}</option>
            <option value="active">{{ $t('overview.active') }}</option>
            <option value="inactive">{{ $t('overview.inactive') }}</option>
          </select>
        </div>
        <div v-if="!data.staff.data.length" class="empty-mini">{{ $t('overview.staffEmpty') }}</div>
        <div v-else class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">{{ $t('staff.tableStaff') }}</th>
                <th scope="col">{{ $t('overview.role') }}</th>
                <th scope="col">{{ $t('overview.department') }}</th>
                <th scope="col">{{ $t('overview.lastLogin') }}</th>
                <th scope="col">{{ $t('overview.status') }}</th>
                <th scope="col">{{ $t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in data.staff.data" :key="u.user_id">
                <td>
                  <strong>{{ u.full_name }}</strong>
                  <div class="sub">{{ u.email }}</div>
                  <div v-if="u.registration_number" class="sub">{{ u.registration_number }}</div>
                </td>
                <td>
                  <span class="badge" :class="roleBadge(u.user_role)">{{
                    roleLabel(u.user_role)
                  }}</span>
                </td>
                <td class="capitalize">{{ u.department || '—' }}</td>
                <td>{{ formatDate(u.last_login) }}</td>
                <td>
                  <span class="badge" :class="u.is_active ? 'badge-green' : 'badge-gray'">{{
                    u.is_active ? $t('overview.active') : $t('overview.inactive')
                  }}</span>
                </td>
                <td>
                  <div class="actions">
                    <button v-if="!u.is_active" class="btn btn-sm btn-success" @click="activate(u)">
                      <i class="fas fa-user-check"></i> {{ $t('overview.activate') }}
                    </button>
                    <button
                      v-else-if="!isSelf(u)"
                      class="btn btn-sm btn-danger"
                      @click="deactivate(u)"
                    >
                      <i class="fas fa-user-slash"></i> {{ $t('overview.deactivate') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-if="data.staff.meta && data.staff.meta.total > data.staff.meta.per_page"
          class="pagination"
        >
          <button
            class="btn btn-sm btn-secondary"
            :disabled="data.staff.meta.current_page <= 1"
            @click="goPage(staff, staff.page - 1)"
          >
            {{ $t('common.previous') }}
          </button>
          <span class="muted">{{
            $t('common.pageXOfY', {
              current: data.staff.meta.current_page,
              total: data.staff.meta.last_page,
            })
          }}</span>
          <button
            class="btn btn-sm btn-secondary"
            :disabled="data.staff.meta.current_page >= data.staff.meta.last_page"
            @click="goPage(staff, staff.page + 1)"
          >
            {{ $t('common.next') }}
          </button>
        </div>
      </div>

      <!-- In-house section: currently checked-in guests with quick check-out action -->
      <div class="dash-grid">
        <div class="card dash-section">
          <div class="section-header-row">
            <h2><i class="fas fa-bed"></i> {{ $t('overview.inHouseSection') }}</h2>
            <router-link to="/app/reservations" class="view-all-link"
              >{{ $t('overview.viewAllReservations') }} <i class="fas fa-arrow-right"></i
            ></router-link>
          </div>
          <div class="filter-row">
            <input
              v-model="inHouse.search"
              type="text"
              class="input"
              :placeholder="$t('overview.searchInHouse')"
              @input="onInHouseFilter"
            />
          </div>
          <div v-if="!data.in_house.data.length" class="empty-mini">
            {{ $t('overview.inHouseEmpty') }}
          </div>
          <div v-else class="table-scroll">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">{{ $t('overview.guest') }}</th>
                  <th scope="col">{{ $t('overview.room') }}</th>
                  <th scope="col">{{ $t('overview.stay') }}</th>
                  <th scope="col">{{ $t('overview.balance') }}</th>
                  <th scope="col">{{ $t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in data.in_house.data" :key="r.reservation_id">
                  <td>
                    <strong>{{ r.guest_name }}</strong>
                    <div v-if="r.guest_phone" class="sub">{{ r.guest_phone }}</div>
                  </td>
                  <td>
                    <span v-if="r.room">
                      {{ $t('reservations.room') }} {{ r.room.room_number }}
                      <div class="sub capitalize">{{ r.room_type || r.room.room_type }}</div>
                    </span>
                    <span v-else class="sub">—</span>
                  </td>
                  <td>
                    <div>{{ formatDate(r.arrival_date) }} → {{ formatDate(r.departure_date) }}</div>
                    <div class="sub">
                      {{ r.num_days || r.nights }} {{ $t('reservations.nights') }}
                    </div>
                  </td>
                  <td>
                    <span :class="{ due: Number(r.balance) > 0 }"
                      >TZS {{ Number(r.balance).toLocaleString() }}</span
                    >
                  </td>
                  <td>
                    <div class="actions">
                      <button class="btn btn-sm btn-primary" @click="checkOut(r)">
                        <i class="fas fa-right-from-bracket"></i> {{ $t('overview.checkOut') }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-if="data.in_house.meta && data.in_house.meta.total > data.in_house.meta.per_page"
            class="pagination"
          >
            <button
              class="btn btn-sm btn-secondary"
              :disabled="data.in_house.meta.current_page <= 1"
              @click="goPage(inHouse, inHouse.page - 1)"
            >
              {{ $t('common.previous') }}
            </button>
            <span class="muted">{{
              $t('common.pageXOfY', {
                current: data.in_house.meta.current_page,
                total: data.in_house.meta.last_page,
              })
            }}</span>
            <button
              class="btn btn-sm btn-secondary"
              :disabled="data.in_house.meta.current_page >= data.in_house.meta.last_page"
              @click="goPage(inHouse, inHouse.page + 1)"
            >
              {{ $t('common.next') }}
            </button>
          </div>
        </div>

        <div>
          <!-- Upcoming arrivals list -->
          <div class="card dash-section">
            <div class="section-header-row">
              <h2><i class="fas fa-calendar-check"></i> {{ $t('overview.upcomingSection') }}</h2>
            </div>
            <div class="filter-row">
              <input
                v-model="upcoming.search"
                type="text"
                class="input"
                :placeholder="$t('overview.searchUpcoming')"
                @input="onUpcomingFilter"
              />
            </div>
            <div v-if="!data.upcoming.data.length" class="empty-mini">
              {{ $t('overview.upcomingEmpty') }}
            </div>
            <div v-for="r in data.upcoming.data" :key="r.reservation_id" class="list-item">
              <i class="fas fa-user"></i>
              <div>
                <strong>{{ r.guest_name }}</strong>
                <div class="sub">
                  {{ $t('reservations.room') }} {{ r.room?.room_number || '—' }} ·
                  {{ formatDate(r.arrival_date) }} · {{ r.num_days || r.nights }}
                  {{ $t('reservations.nights') }}
                </div>
              </div>
              <span class="badge badge-yellow">{{ r.status.replace('_', ' ') }}</span>
            </div>
            <div
              v-if="data.upcoming.meta && data.upcoming.meta.total > data.upcoming.meta.per_page"
              class="pagination"
            >
              <button
                class="btn btn-sm btn-secondary"
                :disabled="data.upcoming.meta.current_page <= 1"
                @click="goPage(upcoming, upcoming.page - 1)"
              >
                {{ $t('common.previous') }}
              </button>
              <span class="muted">{{
                $t('common.pageXOfY', {
                  current: data.upcoming.meta.current_page,
                  total: data.upcoming.meta.last_page,
                })
              }}</span>
              <button
                class="btn btn-sm btn-secondary"
                :disabled="data.upcoming.meta.current_page >= data.upcoming.meta.last_page"
                @click="goPage(upcoming, upcoming.page + 1)"
              >
                {{ $t('common.next') }}
              </button>
            </div>
          </div>

          <!-- Housekeeping section: task list with assign/confirm/verify/complete actions -->
          <div class="card dash-section">
            <div class="section-header-row">
              <h2><i class="fas fa-broom"></i> {{ $t('overview.housekeepingSection') }}</h2>
              <router-link to="/app/housekeeping" class="view-all-link"
                >{{ $t('overview.viewAllHousekeeping') }} <i class="fas fa-arrow-right"></i
              ></router-link>
            </div>
            <div class="filter-row">
              <select
                v-model="housekeeping.status"
                class="input select-input"
                @change="onHousekeepingFilter"
              >
                <option value="">{{ $t('overview.allStatuses') }}</option>
                <option v-for="(label, value) in HOUSE_STATUSES" :key="value" :value="value">
                  {{ label }}
                </option>
              </select>
            </div>
            <div v-if="!data.housekeeping.data.length" class="empty-mini">
              {{ $t('overview.housekeepingEmpty') }}
            </div>
            <div v-for="t in data.housekeeping.data" :key="t.task_id" class="list-item">
              <i class="fas fa-broom"></i>
              <div>
                <strong>{{ $t('reservations.room') }} {{ t.room?.room_number || '—' }}</strong>
                <div class="sub">{{ houseStatusLabel(t.status) }}</div>
              </div>
              <span class="badge" :class="houseBadge(t.status)">{{
                houseStatusLabel(t.status)
              }}</span>
              <div class="actions">
                <button
                  v-if="t.status === 'dirty'"
                  class="btn btn-sm btn-secondary"
                  @click="openAssign(t)"
                >
                  <i class="fas fa-user-plus"></i> {{ $t('housekeeping.assign') }}
                </button>
                <button
                  v-if="t.status === 'in_progress' && canConfirm"
                  class="btn btn-sm btn-secondary"
                  @click="confirmTask(t)"
                >
                  {{ $t('overview.confirm') }}
                </button>
                <button
                  v-if="t.status === 'confirmed' && canVerify"
                  class="btn btn-sm btn-secondary"
                  @click="verifyTask(t)"
                >
                  {{ $t('overview.verify') }}
                </button>
                <button
                  v-if="t.status === 'verified'"
                  class="btn btn-sm btn-success"
                  @click="completeTask(t)"
                >
                  {{ $t('overview.complete') }}
                </button>
              </div>
            </div>
            <div
              v-if="
                data.housekeeping.meta &&
                data.housekeeping.meta.total > data.housekeeping.meta.per_page
              "
              class="pagination"
            >
              <button
                class="btn btn-sm btn-secondary"
                :disabled="data.housekeeping.meta.current_page <= 1"
                @click="goPage(housekeeping, housekeeping.page - 1)"
              >
                {{ $t('common.previous') }}
              </button>
              <span class="muted">{{
                $t('common.pageXOfY', {
                  current: data.housekeeping.meta.current_page,
                  total: data.housekeeping.meta.last_page,
                })
              }}</span>
              <button
                class="btn btn-sm btn-secondary"
                :disabled="data.housekeeping.meta.current_page >= data.housekeeping.meta.last_page"
                @click="goPage(housekeeping, housekeeping.page + 1)"
              >
                {{ $t('common.next') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Assign housekeeping task modal -->
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
              :options="housekeeperOptions"
              :empty-label="$t('overview.unassigned')"
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

    <!-- Dashboard alert modal for urgent notifications -->
    <AlertModal
      v-if="currentAlert"
      :show="true"
      :title="currentAlert.title"
      :body="currentAlert.body"
      :details="alertDetails"
      :timestamp="currentAlert.created_at"
      :type="alertType"
      @dismiss="dismissCurrentAlert"
    />

    <div v-else-if="error" class="alert alert-error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { reportApi, userApi, reservationApi, housekeepingApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import AlertModal from '@/components/AlertModal.vue'

const authStore = useAuthStore()
const notifStore = useNotificationStore()
const { t } = useI18n()
// Root dashboard data, loading/feedback state, and the housekeeping assign modal state.
const data = ref(null)
const loading = ref(false)
const error = ref('')
const success = ref('')
const showAssign = ref(false)
const assignTaskId = ref('')
const assignUserId = ref('')
const modalError = ref('')
const saving = ref(false)

// Filter/page controls for the four dashboard sections (staff, in-house, upcoming, housekeeping).
const staff = reactive({ search: '', role: '', status: '', page: 1 })
const inHouse = reactive({ search: '', page: 1 })
const upcoming = reactive({ search: '', page: 1 })
const housekeeping = reactive({ status: '', page: 1 })
// Debounce timer handle for filter-triggered reloads.
let reloadTimer = null

// Derived values: hotel name, action permissions and housekeeper options for the assign modal.
const hotelName = computed(() => authStore.user?.tenant?.hotel_name || 'MRK Hotels')
const canConfirm = computed(() => authStore.can(80) && authStore.canOperate)
const canVerify = computed(
  () => authStore.canOperate && (!!authStore.user?.is_sub_manager || authStore.can(80)),
)
const housekeepers = computed(() =>
  (data.value?.staff?.data || []).filter(
    (user) =>
      user.is_active && (user.user_role === 'housekeeping' || user.department === 'housekeeping'),
  ),
)
const housekeeperOptions = computed(() =>
  housekeepers.value.map((user) => ({ value: user.user_id, label: user.full_name })),
)

// Housekeeping room-status summary: clean (available), dirty and under
// maintenance/cleaning buckets derived from the backend room status counts.
const roomStatus = computed(() => {
  const rs = data.value?.stats?.room_status || {}
  return {
    clean: Number(rs.available) || 0,
    dirty: Number(rs.dirty) || 0,
    blocked: (Number(rs.maintenance) || 0) + (Number(rs.cleaning) || 0),
  }
})

/** Share of the room stock a housekeeping bucket represents, for its bar. */
function roomPct(value) {
  const total = Number(data.value?.stats?.room_status?.total) || 0
  if (total <= 0) return 0
  return Math.min(100, ((Number(value) || 0) / total) * 100)
}

/**
 * Share of total room stock a metric represents, for the KPI bars.
 * Falls back to normalising against the busiest flow number when the
 * payload predates rooms_total, so bars never render empty.
 */
function pctOfRooms(value) {
  const rooms = Number(data.value?.stats?.rooms_total) || 0
  if (rooms > 0) return Math.min(100, ((Number(value) || 0) / rooms) * 100)
  const flowMax = Math.max(
    Number(data.value?.stats?.arrivals_today) || 0,
    Number(data.value?.stats?.departures_today) || 0,
    Number(value) || 0,
    1,
  )
  return Math.min(100, ((Number(value) || 0) / flowMax) * 100)
}

/** Normalises today's arrivals/departures against the busier of the two. */
function pctOfFlow(value) {
  const peak = Math.max(
    Number(data.value?.stats?.arrivals_today) || 0,
    Number(data.value?.stats?.departures_today) || 0,
    1,
  )
  return Math.min(100, ((Number(value) || 0) / peak) * 100)
}

/** Safe percentage of a part over its whole (e.g. active staff over all staff). */
function ratioPct(part, whole) {
  const w = Number(whole) || 0
  if (w <= 0) return 0
  return Math.min(100, ((Number(part) || 0) / w) * 100)
}

// Staff role options for the staff-section filter dropdown.
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

// Housekeeping task statuses used by the housekeeping filter dropdown.
const HOUSE_STATUSES = {
  dirty: t('housekeeping.statusDirty'),
  in_progress: t('housekeeping.statusInProgress'),
  confirmed: t('housekeeping.statusConfirmed'),
  verified: t('housekeeping.statusVerified'),
  completed: t('housekeeping.statusCompleted'),
}

/** Resolves a role key to its translated display label. */
function roleLabel(value) {
  return ROLES.find((role) => role.value === value)?.label || value
}

/** Returns the CSS badge class for a user role. */
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

/** Resolves a housekeeping status key to its translated display label. */
function houseStatusLabel(value) {
  return HOUSE_STATUSES[value] || value
}

/** Returns the CSS badge class for a housekeeping status. */
function houseBadge(value) {
  const map = {
    dirty: 'badge-red',
    in_progress: 'badge-yellow',
    confirmed: 'badge-blue',
    verified: 'badge-blue',
    completed: 'badge-green',
  }
  return map[value] || 'badge-gray'
}

/** Formats an ISO datetime string for display, or the "never" translation when absent. */
function formatDate(date) {
  return date ? String(date).slice(0, 16).replace('T', ' ') : t('common.never')
}

/** Returns true when the given user row is the currently logged-in user. */
function isSelf(user) {
  return user.user_id === authStore.user?.user_id
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

/**
 * Builds the query params for the overview endpoint from every section's filters.
 * Empty filters and page 1 are omitted so the backend keeps its defaults.
 * @returns {object} The request query parameters.
 */
function buildParams() {
  const params = {}
  if (staff.search) params.staff_search = staff.search
  if (staff.role) params.staff_role = staff.role
  if (staff.status) params.staff_status = staff.status
  if (staff.page > 1) params.staff_page = staff.page
  if (inHouse.search) params.in_house_search = inHouse.search
  if (inHouse.page > 1) params.in_house_page = inHouse.page
  if (upcoming.search) params.upcoming_search = upcoming.search
  if (upcoming.page > 1) params.upcoming_page = upcoming.page
  if (housekeeping.status) params.housekeeping_status = housekeeping.status
  if (housekeeping.page > 1) params.housekeeping_page = housekeeping.page
  return params
}

/** Fetches the whole overview payload and stores it, showing errors via the error banner. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await reportApi.overview(buildParams())
    data.value = res.data
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    loading.value = false
  }
}

async function loadAllStaff() {
  const all = []
  let page = 1
  while (true) {
    const res = await reportApi.overview({ ...buildParams(), staff_page: page })
    const rows = res.data.staff?.data || []
    const meta = res.data.staff?.meta
    all.push(...rows)
    if (!meta || page >= meta.last_page) break
    page++
  }
  return all
}

/** Debounces reloads triggered by section filter changes (400ms). */
function scheduleReload() {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(load, 400)
}

/** Resets the staff section to page 1 and schedules a reload. */
function onStaffFilter() {
  staff.page = 1
  scheduleReload()
}

/** Resets the in-house section to page 1 and schedules a reload. */
function onInHouseFilter() {
  inHouse.page = 1
  scheduleReload()
}

/** Resets the upcoming section to page 1 and schedules a reload. */
function onUpcomingFilter() {
  upcoming.page = 1
  scheduleReload()
}

/** Resets the housekeeping section to page 1 and schedules a reload. */
function onHousekeepingFilter() {
  housekeeping.page = 1
  scheduleReload()
}

/** Navigates one section to the given page (ignoring pages below 1) and reloads immediately. */
function goPage(section, page) {
  if (page < 1) return
  section.page = page
  load()
}

/**
 * Runs an action against the API with an optional confirmation prompt,
 * then shows its success message and reloads the overview.
 * @param {Function} fn - The API call to perform.
 * @param {string} message - Default success message.
 * @param {string} [confirmMsg] - Optional confirm dialog text; skipped when absent.
 */
async function runAction(fn, message, confirmMsg) {
  if (confirmMsg && !window.confirm(confirmMsg)) return
  error.value = ''
  success.value = ''
  try {
    const res = await fn()
    success.value = res.data.message || message
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

// One-liner wrappers binding staff, reservation and housekeeping actions to runAction.
const activate = (user) =>
  runAction(() => userApi.activate(user.user_id), t('overview.activated', { name: user.full_name }))
const deactivate = (user) =>
  runAction(
    () => userApi.destroy(user.user_id),
    t('overview.deactivated', { name: user.full_name }),
    t('overview.deactivateConfirm', { name: user.full_name }),
  )
const checkOut = (reservation) =>
  runAction(
    () => reservationApi.checkOut(reservation.reservation_id),
    t('overview.checkedOut', { name: reservation.guest_name }),
    t('overview.confirmCheckOut', { name: reservation.guest_name }),
  )
const confirmTask = (task) =>
  runAction(() => housekeepingApi.confirm(task.task_id), t('overview.confirmed'))
const verifyTask = (task) =>
  runAction(() => housekeepingApi.verify(task.task_id), t('overview.verified'))
const completeTask = (task) =>
  runAction(() => housekeepingApi.complete(task.task_id), t('overview.completed'))

/** Opens the assign modal for the given housekeeping task. */
function openAssign(task) {
  modalError.value = ''
  assignTaskId.value = task.task_id
  assignUserId.value = ''
  showAssign.value = true
}

/** Assigns the selected housekeeper to the task and reloads the overview on success. */
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

onMounted(() => {
  load()
  notifStore.fetchAlerts()
})

/** Alert modal logic. */
const currentAlert = computed(() => notifStore.alerts[0] || null)
const alertType = computed(() => {
  if (!currentAlert.value) return 'info'
  switch (currentAlert.value.type) {
    case 'payment_awaiting_confirmation': return 'payment'
    case 'reservation_new': return 'reservation'
    case 'booking_requisition_new': return 'approval'
    case 'purchase_requisition_pending': return 'approval'
    case 'purchase_order_pending': return 'approval'
    default: return 'info'
  }
})
const alertDetails = computed(() => {
  if (!currentAlert.value?.data) return []
  const d = currentAlert.value.data
  const details = []
  if (d.guest_name) details.push({ label: t('guests.guestName'), value: d.guest_name })
  if (d.amount) details.push({ label: t('payments.amount'), value: `TZS ${Number(d.amount).toLocaleString()}` })
  if (d.provider) details.push({ label: t('payments.provider'), value: d.provider })
  if (d.requested_by) details.push({ label: 'Requested by', value: d.requested_by })
  if (d.ordered_by) details.push({ label: 'Ordered by', value: d.ordered_by })
  if (d.requisition_number) details.push({ label: t('bookingRequisitions.requisitionNumber'), value: d.requisition_number })
  return details
})
function dismissCurrentAlert() {
  if (currentAlert.value) notifStore.dismissAlert(currentAlert.value.id)
}
</script>

<style scoped>
.dashboard-page {
  padding: 32px 20px;
}

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.dash-header h1 {
  font-size: 28px;
  font-weight: 800;
}

.dash-header p {
  color: #6f6f6f;
  font-size: 15px;
  margin-top: 4px;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fef5f5;
  color: #005eb8;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: #fef5f5;
  color: #005eb8;
  flex-shrink: 0;
}

.stat-icon.checkin,
.stat-icon.rooms {
  background: #eaf4ff;
  color: #1f6ea8;
}

.stat-icon.checkout,
.stat-icon.staff {
  background: #fef9e7;
  color: #d4ac0d;
}

.stat-icon.bookings {
  background: #eafaf1;
  color: #1e8449;
}

.stat-icon.cleaning {
  background: #fdf2e9;
  color: #e67e22;
}

.stat-icon.occupancy {
  background: #f5eefb;
  color: #8e44ad;
}

.stat-icon.issues {
  background: #fdecea;
  color: #c0392b;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.stat-label {
  font-size: 12px;
  color: #757575;
}

/* Proportional KPI bars under each stat value. */
.stat-body {
  min-width: 0;
  flex: 1;
}

.stat-bar {
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
}

.stat-fill {
  height: 100%;
  border-radius: 3px;
  min-width: 2px;
  transition: width 0.4s ease;
}

/* Housekeeping summary: three colored room-status buckets with bars. */
.house-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.house-chip {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
}
.house-num {
  font-size: 22px;
  font-weight: 700;
  color: #333;
}
.house-label {
  font-size: 12px;
  color: #757575;
}
.house-fill {
  height: 6px;
  border-radius: 3px;
  margin-top: 4px;
  overflow: hidden;
}
.house-clean { border-top: 3px solid #1e8449; }
.house-clean .house-fill { background: #1e8449; }
.house-dirty { border-top: 3px solid #c0392b; }
.house-dirty .house-fill { background: #c0392b; }
.house-blocked { border-top: 3px solid #f1c40f; }
.house-blocked .house-fill { background: #f1c40f; }

@media (max-width: 768px) {
  .house-strip {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}

.fill-blue {
  background: #1f6ea8;
}

.fill-green {
  background: #1e8449;
}

.fill-red {
  background: #c0392b;
}

.dash-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.dash-section {
  padding: 24px;
  margin-bottom: 24px;
}

.dash-section h2 {
  font-size: 17px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dash-section h2 i {
  color: #005eb8;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.view-all-link {
  font-size: 13px;
  color: #005eb8;
  text-decoration: none;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.2s;
}

.view-all-link:hover {
  opacity: 0.8;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item > i {
  color: #005eb8;
  width: 16px;
  text-align: center;
}

.list-item .badge {
  flex-shrink: 0;
}

.list-item .actions {
  flex-shrink: 0;
}

.empty-mini {
  color: #757575;
  font-size: 14px;
  padding: 12px 0;
}

.sub {
  color: #757575;
  font-size: 12px;
  margin-top: 2px;
}

.capitalize {
  text-transform: capitalize;
}

.due {
  color: #c0392b;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-row .input {
  flex: 1;
  min-width: 160px;
  max-width: 320px;
}

.filter-row .select-input {
  flex: 0 0 auto;
  min-width: 0;
  max-width: 200px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .dashboard-page {
    padding: 20px 16px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 14px;
  }

  .stat-card > div {
    min-width: 0;
  }

  .stat-bar {
    width: 100%;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  .stat-value {
    font-size: 20px;
  }

  .stat-label {
    font-size: 11px;
  }

  .dash-grid {
    grid-template-columns: 1fr;
  }
}
</style>
