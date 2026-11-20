<!--
  Reservations page (route: /app/reservations, name: hotel-reservations).
  Management view of reservations: tabbed business-date lists, guest detail
  modal and invoice opening. Operational actions stay on the front-desk panel.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('reservations.title') }}</h1>
        <p class="muted">{{ $t('reservations.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('reservations.refresh') }}
        </button>
        <TableExportButton
          filename="reservations"
          :load-all="loadAllReservations"
          :columns="[
            { key: 'guest_name', label: $t('reservations.guest') },
            { key: 'guest_phone', label: $t('common.phone') },
            { key: 'booking_type', label: $t('reservations.tableBookingType') },
            { key: 'room_type', label: $t('reservations.room') },
            { key: 'check_in_date', label: $t('reservations.tableStay') },
            { key: 'check_out_date', label: $t('common.checkout') },
            { key: 'total_amount', label: $t('reservations.tableTotal') },
            { key: 'advance_payment', label: $t('reservations.tableBalance') },
            { key: 'status', label: $t('reservations.status') },
          ]"
        />
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Lifecycle tabs by current business date (management view) -->
    <div class="tabs">
      <button class="tab tab-reserved" :class="{ active: tab === 'reserved' }" @click="switchTab('reserved')">
        <i class="fas fa-calendar-day"></i> {{ $t('reservations.tabReserved', 'Reserved') }}
      </button>
      <button class="tab tab-active" :class="{ active: tab === 'active' }" @click="switchTab('active')">
        <i class="fas fa-bed"></i> {{ $t('reservations.tabActive') }}
      </button>
      <button class="tab tab-checked-out" :class="{ active: tab === 'checked_out' }" @click="switchTab('checked_out')">
        <i class="fas fa-clock-rotate-left"></i> {{ $t('reservations.tabCheckedOut') }}
      </button>
      <button class="tab tab-cancelled" :class="{ active: tab === 'cancelled' }" @click="switchTab('cancelled')">
        <i class="fas fa-ban"></i> {{ $t('reservations.tabCancelled') }}
      </button>
    </div>

    <!-- Management filters (business-date tabs drive date context) -->
    <div class="card filter-bar">
      <div class="filter-grid filter-grid-simple">
        <div class="form-group">
          <label>{{ $t('reservations.bookingType') }}</label>
          <SearchableSelect
            v-model="filters.booking_type"
            :options="bookingTypeOptions"
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
            :placeholder="$t('reservations.searchPlaceholder')"
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

    <div v-if="loading" class="alert alert-info">{{ $t('reservations.loading') }}</div>

    <!-- Reservation table; row actions depend on the reservation lifecycle status -->
    <div v-else class="table-scroll is-pinned">
      <table class="table table-pinned">
        <thead>
          <tr>
            <th scope="col" class="pin-col">{{ $t('reservations.guest') }}</th>
            <th scope="col">{{ $t('reservations.tableBookingType') }}</th>
            <th scope="col">{{ $t('reservations.room') }}</th>
            <th scope="col">{{ $t('reservations.tableStay') }}</th>
            <th scope="col">{{ $t('reservations.tableTotal') }}</th>
            <th scope="col">{{ $t('reservations.status') }}</th>
            <th scope="col">{{ $t('reservations.tableBalance') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in reservations" :key="r.reservation_id">
            <td class="pin-col">
              <button type="button" class="link-btn guest-link" @click="openDetail(r)">
                <strong>{{ r.guest_name }}</strong>
              </button>
            </td>
            <td>
              <span class="badge badge-blue">{{ bookingTypeLabel(r.booking_type) }}</span>
            </td>
            <td>
              <span v-if="r.room">
                {{ $t('reservations.room') }} {{ r.room.room_number }}
                <span v-if="r.is_primary" class="badge badge-yellow">{{ $t('reservations.primaryRoom') }}</span>
                <div class="sub capitalize">
                  {{ roomTypeLabel(r.room_type || r.room.room_type) }}
                </div>
              </span>
              <span v-else class="sub">—</span>
            </td>
            <td>
              <div>{{ formatDate(r.arrival_date) }} → {{ formatDate(r.departure_date) }}</div>
              <div class="sub">
                {{ r.num_days || r.nights }} {{ $t('reservations.nights') }} · {{ r.num_adults }}
                {{ $t('reservations.adults')
                }}{{ r.num_children ? `, ${r.num_children} ${$t('reservations.children')}` : '' }}
              </div>
            </td>
            <td>
              <span class="price">{{ curCode() }} {{ Number(r.total_amount).toLocaleString() }}</span>
            </td>
            <td>
              <span class="badge" :class="statusBadge(r.status)">{{
                r.status.replace('_', ' ')
              }}</span>
            </td>
            <td>
              <span :class="{ due: Number(r.balance_due ?? r.balance) > 0 }">
                {{ curCode() }} {{ Number(r.balance_due ?? r.balance).toLocaleString() }}
              </span>
              <div v-if="Number(r.room_charges) > 0" class="sub">
                <i class="fas fa-receipt"></i> {{ $t('reservations.roomCharges') }} {{ curCode() }} {{ Number(r.room_charges).toLocaleString() }}
              </div>
            </td>

          </tr>
          <tr v-if="!reservations.length && !loading">
            <td colspan="7" class="sub">{{ $t('reservations.empty') }}</td>
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
      <span class="sub">
        {{ $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page }) }}
      </span>
      <button
        class="btn btn-sm btn-secondary"
        :disabled="!meta.next_page_url"
        @click="goPage(meta.current_page + 1)"
      >
        {{ $t('common.next') }}
      </button>
    </div>

    <!-- Read-only reservation detail modal with invoice download -->
    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = false">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h2>
            <i class="fas fa-calendar-check"></i> {{ detail?.guest_name }}
            <span v-if="detail" class="badge" :class="statusBadge(detail.status)">
              {{ detail.status.replace('_', ' ') }}
            </span>
          </h2>
          <button class="modal-close" @click="showDetail = false">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <!--
          Manager review: "VIEW tab is very confusing, it should show guest
          information and booking details." The modal only ever listed booking
          and money fields, so a receptionist opening a reservation could not
          confirm who the guest was without leaving the screen. GET
          /reservations/{id} already returns the full guest record, so this is
          purely a presentation fix: the same payload is now grouped into guest,
          booking, stay and money sections.
        -->
        <div v-if="detail" class="detail-body">
          <h3 class="detail-section">{{ $t('reservations.sectionGuestInformation') }}</h3>
          <dl class="detail-grid">
            <div>
              <dt>{{ $t('guests.fullName') }}</dt>
              <dd>{{ detail.guest_name || detail.guest?.full_name || '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('guests.phone') }}</dt>
              <dd>{{ detail.guest?.phone || detail.guest_phone || '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('guests.email') }}</dt>
              <dd>{{ detail.guest?.email || detail.guest_email || '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('guests.idType') }}</dt>
              <dd>{{ (detail.guest?.id_type || '—').replace(/_/g, ' ') }}</dd>
            </div>
            <div>
              <dt>{{ $t('guests.idNumber') }}</dt>
              <dd>{{ detail.guest?.id_number || '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('guests.nationality') }}</dt>
              <dd>{{ detail.guest?.nationality || '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('hotelSettings.country') }}</dt>
              <dd>{{ detail.guest?.country || detail.country || '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('hotelSettings.city') }}</dt>
              <dd>{{ detail.guest?.city || detail.city || '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('guests.dateOfBirth') }}</dt>
              <dd>{{ formatDate(detail.guest?.date_of_birth) || '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('guests.vipStatus') }}</dt>
              <dd>
                <span v-if="detail.guest?.vip_status" class="badge badge-warning">
                  {{ detail.guest.vip_status }}
                </span>
                <span v-else>—</span>
              </dd>
            </div>
          </dl>

          <h3 class="detail-section">{{ $t('reservations.sectionBookingDetails') }}</h3>
          <dl class="detail-grid">
            <div>
              <dt>{{ $t('reservations.bookingReference') }}</dt>
              <dd>{{ displayBookingReference(detail.booking_code || detail.booking_reference || detail.folio_code) || '—' }}</dd>
            </div>
            <div v-if="detail.external_ref">
              <dt>{{ $t('reservations.channelReference') }}</dt>
              <dd>{{ detail.channel ? `${detail.channel}: ` : '' }}{{ detail.external_ref }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.tableBookingType') }}</dt>
              <dd>{{ bookingTypeLabel(detail.booking_type) }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.bookingSource') }}</dt>
              <dd class="capitalize">{{ bookingSourceLabel(detail.booking_source) }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.tableStay') }}</dt>
              <dd>{{ formatDate(detail.arrival_date) }} → {{ formatDate(detail.departure_date) }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.tableNights') }}</dt>
              <dd>{{ detail.nights ?? detail.num_days ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.occupancy') }}</dt>
              <dd>
                {{ detail.num_adults }} {{ $t('reservations.adults') }} ·
                {{ detail.num_children }} {{ $t('reservations.children') }}
              </dd>
            </div>
            <div>
              <dt>{{ $t('reservations.room') }}</dt>
              <dd v-if="detail.room">
                {{ $t('reservations.room') }} {{ detail.room.room_number }} ·
                {{ roomTypeLabel(detail.room_type || detail.room.room_type) }}
              </dd>
              <dd v-else>—</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.nightlyRate') }}</dt>
              <dd>{{ curCode() }} {{ Number(detail.rate || 0).toLocaleString() }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.bookingDate') }}</dt>
              <dd>{{ formatDate(detail.booking_date) || '—' }}</dd>
            </div>
          </dl>

          <!-- The other rooms travelling with this booking, when it is a party. -->
          <template v-if="detail.group?.rooms?.length > 1">
            <h3 class="detail-section">
              <i class="fas fa-people-group"></i>
              {{ $t('reservations.groupBadge', { count: detail.group.rooms.length }) }}
            </h3>
            <ul class="group-room-list">
              <li v-for="room in detail.group.rooms" :key="room.reservation_id">
                <span>
                  {{ $t('reservations.room') }} {{ room.room_number }}
                  <span v-if="room.is_primary" class="badge badge-yellow">{{ $t('reservations.primaryRoom') }}</span>
                </span>
                <span class="muted">{{ room.guest_name }} · {{ room.status.replace('_', ' ') }}</span>
              </li>
            </ul>
          </template>

          <h3 class="detail-section">{{ $t('reservations.sectionStayAndCharges') }}</h3>
          <dl class="detail-grid">
            <div>
              <dt>{{ $t('reservations.checkedInAt') }}</dt>
              <dd>{{ formatDateTime(detail.checked_in_at) }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.checkedOutAt') }}</dt>
              <dd>{{ formatDateTime(detail.checked_out_at) }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.checkoutReason') }}</dt>
              <dd>{{ detail.checkout_reason || '—' }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.tableTotal') }}</dt>
              <dd class="price">{{ curCode() }} {{ Number(detail.total_amount).toLocaleString() }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.roomCharges') }}</dt>
              <dd>{{ curCode() }} {{ Number(detail.room_charges || 0).toLocaleString() }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.advancePayment', { currency: curCode() }) }}</dt>
              <dd>{{ curCode() }} {{ Number(detail.advance_payment || 0).toLocaleString() }}</dd>
            </div>
            <div>
              <dt>{{ $t('reservations.tableBalance') }}</dt>
              <dd :class="{ due: Number(detail.balance) > 0 }">
                {{ curCode() }} {{ Number(detail.balance).toLocaleString() }}
              </dd>
            </div>
            <div>
              <dt>{{ $t('reservations.paymentsCount') }}</dt>
              <dd>{{ (detail.payments || []).length }}</dd>
            </div>
            <div v-if="detail.special_requests" class="form-full">
              <dt>{{ $t('reservations.specialRequests') }}</dt>
              <dd>{{ detail.special_requests }}</dd>
            </div>
            <div v-if="detail.notes" class="form-full">
              <dt>{{ $t('common.notes') }}</dt>
              <dd>{{ detail.notes }}</dd>
            </div>
          </dl>
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" :disabled="invoiceLoading" @click="openInvoice">
            <i class="fas fa-file-invoice"></i>
            {{ invoiceLoading ? $t('invoices.preparing') : $t('reservations.invoice', 'Invoice') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBusinessDateStore } from '@/stores/businessDate'
import { invoiceApi, reservationApi } from '@/api'
import { displayBookingReference } from '@/utils/bookingReference'
import { collectAllRows } from '@/utils/export'
import { todayISO } from '@/utils/dates'
import { useTenantCurrency } from '@/utils/currency'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'

const { curCode } = useTenantCurrency()

const { t } = useI18n()
const businessDateStore = useBusinessDateStore()

const BOOKING_TYPES = ['single', 'couple', 'family', 'group']

const bookingTypeOptions = computed(() =>
  BOOKING_TYPES.map((type) => ({ value: type, label: t(`common.bookingTypes.${type}`) })),
)

// List state: reservation rows, tab, pagination and filters.
const reservations = ref([])
const tab = ref('reserved')
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
// Manager review: the FROM/TO filters open on the business date the night audit
// has left the hotel on, not the browser's wall-clock date, so management
// immediately sees the current day's reservation status.
const filters = reactive({ booking_type: '', search: '' })

/** Current hotel business date (YYYY-MM-DD). */
function businessDay() {
  return businessDateStore.current || todayISO()
}
const loading = ref(false)
const error = ref('')
const success = ref('')

/**
 * Translates a booking type code into its localised label.
 * @param {string} type - The booking type (single, couple, family, group).
 * @returns {string} The translated label, or an em dash when absent.
 */
function bookingTypeLabel(type) {
  return type ? t(`common.bookingTypes.${type}`) : '—'
}

/**
 * Translates a room type code into its localised label.
 * @param {string} type - The room type (single, double, suite, ...).
 * @returns {string} The translated label, or an em dash when absent.
 */
function roomTypeLabel(type) {
  return type ? t(`common.roomTypes.${type}`) : '—'
}

/**
 * Maps a reservation status to the CSS class used for its badge colour.
 * @param {string} status - The reservation lifecycle status.
 * @returns {string} The badge CSS class.
 */
function statusBadge(status) {
  return (
    {
      pending: 'badge-yellow',
      confirmed: 'badge-blue',
      checked_in: 'badge-green',
      checked_out: 'badge-gray',
      cancelled: 'badge-red',
      no_show: 'badge-gray',
    }[status] || 'badge-gray'
  )
}

/**
 * Formats an ISO date string for display, keeping only the date part.
 * @param {string} value - The ISO date string.
 * @returns {string} The date as DD/MM/YYYY, or an em dash when absent.
 */
function formatDate(value) {
  if (!value) return '—'
  const d = new Date(String(value).slice(0, 10) + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

/**
 * Formats a timestamp as DD/MM/YYYY HH:MM (front-desk convention).
 * @param {string} value - The ISO date-time string.
 * @returns {string} The formatted value, or an em dash when absent.
 */
function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${date.getFullYear()} ${hh}:${min}`
}

// Translation key suffix for each booking source code.
const bookingSourceLabels = {
  walk_in: 'sourceWalkIn',
  phone: 'sourcePhone',
  email: 'sourceEmail',
  website: 'sourceWebsite',
  agent: 'sourceAgent',
  ota: 'sourceOta',
}

/**
 * Translates a booking source code into its localised label.
 * @param {string} source - The booking source (walk_in, phone, email, ...).
 * @returns {string} The translated label, or an em dash when unknown.
 */
function bookingSourceLabel(source) {
  const key = bookingSourceLabels[source]
  return key ? t(`reservations.${key}`) : '—'
}

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

/** Fetches reservations for the active business-date tab (management view). */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const day = businessDay()
    const params = {
      booking_type: filters.booking_type || undefined,
      search: filters.search || undefined,
      page: page.value,
      per_page: 15,
    }
    if (tab.value === 'reserved') {
      // Arrivals on current business date.
      params.from = day
      params.window_end = day
      params.exclude_status = ['cancelled', 'no_show', 'checked_out']
    } else if (tab.value === 'active') {
      // In-house on current business date.
      params.status = 'checked_in'
      params.window_start = day
      params.window_end = day
    } else if (tab.value === 'checked_out') {
      // Departures/checked out on current business date.
      params.status = 'checked_out'
      params.window_start = day
      params.to = day
    } else if (tab.value === 'cancelled') {
      // Cancelled or no-show (best-effort on business date context).
      params.status = 'cancelled,no_show'
      params.window_start = day
      params.window_end = day
    }
    const res = await reservationApi.index(params)
    let rows = res.data.data || []
    // Enforce strict business-date semantics client-side where needed.
    if (tab.value === 'reserved') {
      rows = rows.filter((r) => String(r.check_in_date || r.arrival_date || '').slice(0, 10) === day)
    } else if (tab.value === 'checked_out') {
      rows = rows.filter((r) => String(r.check_out_date || r.departure_date || '').slice(0, 10) === day)
    }
    reservations.value = rows
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('reservations.loadError')
  } finally {
    loading.value = false
  }
}

/** Fetches every reservation page for export, honouring active business-date tab. */
const loadAllReservations = async () => {
  const day = businessDay()
  const base = { booking_type: filters.booking_type || undefined, search: filters.search || undefined }
  if (tab.value === 'reserved') { base.from = day; base.window_end = day; base.exclude_status = ['cancelled','no_show','checked_out'] }
  else if (tab.value === 'active') { base.status = 'checked_in'; base.window_start = day; base.window_end = day }
  else if (tab.value === 'checked_out') { base.status = 'checked_out'; base.window_start = day; base.to = day }
  else if (tab.value === 'cancelled') { base.status = 'cancelled,no_show'; base.window_start = day; base.window_end = day }
  const rows = await collectAllRows((page, perPage) => reservationApi.index({ ...base, page, per_page: perPage }))
  if (tab.value === 'reserved') return rows.filter((r) => String(r.check_in_date || r.arrival_date || '').slice(0,10) === day)
  if (tab.value === 'checked_out') return rows.filter((r) => String(r.check_out_date || r.departure_date || '').slice(0,10) === day)
  return rows
}

/** Switch business-date tab. */
function switchTab(next) {
  if (tab.value === next) return
  tab.value = next
  page.value = 1
  load()
}

// Debounced so typing a name does not fire a request per keystroke.
let searchTimer
/** Restarts the list search from page one (debounced from the search input). */
function triggerSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 350)
}

/**
 * Moves to the given page and reloads the list.
 * @param {number} target - The 1-based page number.
 */
function goPage(target) {
  page.value = target
  load()
}

/** Resets filters and reloads current business-date tab. */
function clearFilters() {
  page.value = 1
  filters.booking_type = ''
  filters.search = ''
  load()
}


const showDetail = ref(false)
const detail = ref(null)
const invoiceLoading = ref(false)

/** Generates (or refreshes) the folio invoice and opens it in a new tab. */
async function openInvoice() {
  if (!detail.value) return
  invoiceLoading.value = true
  error.value = ''
  success.value = ''
  try {
    const gen = await invoiceApi.generate(detail.value.reservation_id)
    const invoice = gen.data.invoice
    const res = await invoiceApi.download(invoice.invoice_id)
    const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    invoiceLoading.value = false
  }
}

/**
 * Opens the read-only VIEW modal.
 *
 * The list row is only a summary — the guest relation is not eager-loaded, so
 * showing it directly would render the guest section blank. Fetch the full
 * record (GET /reservations/{id} returns guest, room and payments) and fall back
 * to the row if the fetch fails so the modal still opens.
 * @param {Object} reservation - The reservation row to open.
 */
let detailRequestId = 0

async function openDetail(reservation) {
  const requestId = ++detailRequestId
  detail.value = reservation
  showDetail.value = true
  try {
    const res = await reservationApi.show(reservation.reservation_id)
    if (showDetail.value && requestId === detailRequestId) detail.value = res.data.reservation
  } catch (err) {
    // Keep the summary row rather than leaving the modal empty.
    if (!detail.value) error.value = flattenError(err)
  }
}


onMounted(async () => {
  await businessDateStore.ensureLoaded()
  load()
})
</script>

<style scoped>
.dashboard-page {
  padding: 32px 20px;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.tab {
  padding: 12px 22px;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.tab i {
  font-size: 16px;
}

.tab-active {
  color: #005eb8;
  border-color: #cfe3f5;
  background: #eaf4ff;
}

.tab-active.active {
  background: #005eb8;
  border-color: #005eb8;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 94, 184, 0.25);
}

.tab-checked-out {
  color: #b45309;
  border-color: #fde3c2;
  background: #fff7ec;
}

.tab-checked-out.active {
  background: #b45309;
  border-color: #b45309;
  color: #fff;
  box-shadow: 0 2px 8px rgba(180, 83, 9, 0.25);
}

.tab-cancelled {
  color: #b91c1c;
  border-color: #f5c9c9;
  background: #fef2f2;
}

.tab-cancelled.active {
  background: #b91c1c;
  border-color: #b91c1c;
  color: #fff;
  box-shadow: 0 2px 8px rgba(185, 28, 28, 0.25);
}

.tab-reserved {
  color: #6d28d9;
  border-color: #ddd6fe;
  background: #f5f3ff;
}

.tab-reserved.active {
  background: #6d28d9;
  border-color: #6d28d9;
  color: #fff;
  box-shadow: 0 2px 8px rgba(109, 40, 217, 0.25);
}

.guest-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--brand, #005eb8);
  cursor: pointer;
  text-align: left;
}

.guest-link:hover {
  text-decoration: underline;
}

.filter-grid-simple {
  grid-template-columns: minmax(180px, 260px) minmax(220px, 1fr) auto;
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
  grid-template-columns: repeat(5, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.filter-actions {
  display: flex;
  gap: 8px;
  padding-bottom: 1px;
}

.sub {
  color: var(--muted);
  font-size: 12px;
  margin-top: 2px;
}

.capitalize {
  text-transform: capitalize;
}

/*
  The read-only reservation modal had no styling for its definition list at
  all — `.detail-grid` was never defined in any stylesheet — so the VIEW tab
  rendered as an unlabelled browser-default <dl> and read as confusing noise.
  These rules give the guest / booking / stay sections a real grid, and keep
  full-width rows (special requests, notes) spanning the columns.
*/
.detail-body {
  max-height: 60vh;
  overflow-y: auto;
  padding: 0 4px;
}

.detail-section {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--brand);
  margin: 18px 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line, #e2e8f0);
}

.detail-section:first-child {
  margin-top: 4px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px 16px;
  margin: 0;
}

.detail-grid > div {
  min-width: 0;
}

.detail-grid dt {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted, #64748b);
  margin-bottom: 2px;
}

.detail-grid dd {
  margin: 0;
  color: var(--ink, #0f172a);
  word-break: break-word;
}

.detail-grid .form-full {
  grid-column: 1 / -1;
}

@media (max-width: 640px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

.price {
  font-weight: 700;
  color: var(--brand);
}

.due {
  color: var(--danger);
  font-weight: 600;
}

.req {
  color: var(--danger);
  margin-left: 2px;
}

/* Per-field client-side validation: red border + inline message. */
.input-error {
  border-color: var(--danger) !important;
}

.msg-error {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.35;
  color: var(--danger);
}

.hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}

.hint.danger {
  color: var(--danger);
}

.muted {
  color: var(--muted);
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.room-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.room-card.selected {
  border-color: var(--brand);
  background: #f0f7ff;
}

.room-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--brand);
  cursor: pointer;
}

.room-check input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--brand);
  cursor: pointer;
}

.room-price {
  margin-top: auto;
  font-weight: 700;
  color: var(--brand);
}

.selected-summary {
  margin-top: 12px;
}

/* Search/sort controls bar above the room grid */
.room-browser-bar {
  display: grid;
  grid-template-columns: minmax(220px, 2fr) minmax(160px, 1fr) auto;
  gap: 12px;
  align-items: end;
  margin: 12px 0 4px;
}

.room-browser-bar .form-group {
  margin-bottom: 0;
}

.room-browser-dir {
  white-space: nowrap;
}

.room-browser-count {
  margin-top: 8px;
}

@media (max-width: 640px) {
  .room-browser-bar {
    grid-template-columns: 1fr;
  }
}

.btn-block {
  width: 100%;
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

.modal-lg {
  max-width: 760px;
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
  color: var(--brand);
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

.form-section {
  margin-top: 18px;
}

.form-section h3 {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--brand);
  border-bottom: 1px solid #f1f1f1;
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-full {
  grid-column: 1 / -1;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.balance-box {
  border: 1px solid #ffd6a5;
  background: #fff7ec;
  border-radius: 8px;
  padding: 12px 14px;
  margin-top: 14px;
}

.balance-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  padding: 3px 0;
}

.balance-row.total {
  font-weight: 800;
  font-size: 15px;
  color: #b45309;
  border-top: 1px solid #ffe1b3;
  margin-top: 6px;
  padding-top: 8px;
}

.settlement-grid {
  margin-top: 12px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  cursor: pointer;
}

.danger {
  color: #dc2626;
}

.alert-warning {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  color: #92400e;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.alert-warning i {
  color: #d97706;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
  border: none;
}

.btn-danger:hover {
  background: #b91c1c;
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

/* Tablets: 768px is the classic iPad portrait width, so the phone
   treatment below starts at 767px. Without this band a tablet drops
   straight from the full form to a single column. */
@media (min-width: 768px) and (max-width: 1024px) {
  .filter-grid,
  .form-grid {
    grid-template-columns: 1fr 1fr;
  }

  .page-head {
    flex-direction: row;
  }
}

@media (max-width: 767px) {
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
