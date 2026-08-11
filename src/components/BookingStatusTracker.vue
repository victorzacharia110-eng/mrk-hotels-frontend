<template>
  <div class="card tracker">
    <h2 class="card-title"><i class="fas fa-magnifying-glass-location"></i> {{ $t('bookingRequisitions.trackTitle') }}</h2>
    <p class="muted">{{ $t('bookingRequisitions.trackSubtitle') }}</p>

    <form class="tracker-form" @submit.prevent="lookup">
      <input
        v-model.trim="number"
        type="text"
        class="input"
        :placeholder="$t('bookingRequisitions.trackPlaceholder')"
        required
      />
      <button class="btn btn-primary" :disabled="searching">
        {{ searching ? $t('bookingRequisitions.tracking') : $t('bookingRequisitions.trackButton') }}
      </button>
    </form>

    <div v-if="searchError" class="alert alert-error">{{ searchError }}</div>

    <!-- Result panel shown once a requisition has been found. -->
    <div v-if="result" class="tracker-result">
      <p class="tracker-ref">
        <strong>{{ $t('bookingRequisitions.reference') }}</strong>
        <code>{{ result.requisition_number }}</code>
        <span class="badge" :class="statusBadge(result.status)">{{ statusLabel(result.status) }}</span>
      </p>
      <div v-if="result.quoted_amount !== null" class="tracker-line">
        <span>{{ $t('bookingRequisitions.quotedAmount') }}</span>
        <strong>TZS {{ Number(result.quoted_amount).toLocaleString() }}</strong>
      </div>
      <div v-if="result.hotel_notes" class="tracker-line">
        <span>{{ $t('bookingRequisitions.hotelNotes') }}</span>
        <p>{{ result.hotel_notes }}</p>
      </div>
      <div class="tracker-line">
        <span>{{ $t('bookingRequisitions.stay') }}</span>
        <p>
          {{ result.check_in_date }} → {{ result.check_out_date }}
          <span class="muted">({{ result.num_days }} {{ $t('bookingRequisitions.nightSuffix') }})</span>
        </p>
      </div>
      <p v-if="result.responded_at" class="muted">
        {{ $t('bookingRequisitions.respondedAt') }} {{ formatDate(result.responded_at) }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { publicApi } from '@/api'

const { t } = useI18n()

// Tracker form state: the reference being searched, the fetched result, and
// the searching/error flags that drive the button label and alert.
const number = ref('')
const result = ref(null)
const searching = ref(false)
const searchError = ref('')

/**
 * Maps a requisition status to the CSS modifier class used by the status badge.
 *
 * @param {string} s - Raw status key returned by the API (e.g. "pending").
 * @returns {string} Badge CSS class; falls back to the gray style for unknown keys.
 */
function statusBadge(s) {
  const map = {
    pending: 'badge-yellow',
    reviewing: 'badge-blue',
    quoted: 'badge-purple',
    confirmed: 'badge-green',
    rejected: 'badge-red',
    cancelled: 'badge-gray',
  }
  return map[s] || 'badge-gray'
}

/**
 * Translates a requisition status key into a localised label.
 *
 * @param {string} s - Raw status key returned by the API.
 * @returns {string} Translated status label, or the raw key if unknown.
 */
function statusLabel(s) {
  const key = {
    pending: 'bookingRequisitions.statusPending',
    reviewing: 'bookingRequisitions.statusReviewing',
    quoted: 'bookingRequisitions.statusQuoted',
    confirmed: 'bookingRequisitions.statusConfirmed',
    rejected: 'bookingRequisitions.statusRejected',
    cancelled: 'bookingRequisitions.statusCancelled',
  }[s]
  return key ? t(key) : s
}

/**
 * Formats an ISO timestamp into a compact "YYYY-MM-DD HH:mm" string.
 *
 * @param {string} d - ISO date string from the API.
 * @returns {string} Formatted date, or "-" when the value is empty.
 */
function formatDate(d) {
  return d ? String(d).slice(0, 16).replace('T', ' ') : '-'
}

/**
 * Looks up a booking requisition by its reference number and renders the
 * result. Resets prior errors, toggles the searching flag, and maps the
 * response (or the 404 "not found" case) into the result/error state.
 *
 * @returns {Promise<void>}
 */
async function lookup() {
  if (!number.value) return
  searchError.value = ''
  searching.value = true
  try {
    const res = await publicApi.bookingStatus({ requisition_number: number.value })
    result.value = res.data.requisition
  } catch (err) {
    result.value = null
    searchError.value = err.response?.status === 404
      ? t('bookingRequisitions.notFound')
      : err.response?.data?.message || t('bookingRequisitions.lookupError')
  } finally {
    searching.value = false
  }
}
</script>

<style scoped>
.tracker {
  margin-top: 24px;
  padding: 20px 24px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
}

.tracker-form {
  display: flex;
  gap: 10px;
  margin: 12px 0;
  max-width: 480px;
}

.tracker-form .input {
  flex: 1;
}

.tracker-result {
  margin-top: 8px;
  border-top: 1px solid #eee;
  padding-top: 14px;
}

.tracker-ref {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.tracker-ref code {
  font-size: 14px;
}

.tracker-line {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 12px;
  padding: 6px 0;
  font-size: 14px;
}

.tracker-line span {
  color: #888;
}

.tracker-line p {
  margin: 0;
}

@media (max-width: 768px) {
  .tracker-form {
    flex-direction: column;
  }

  .tracker-line {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
