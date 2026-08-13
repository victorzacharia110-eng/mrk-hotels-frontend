<!--
  Public booking page (route: /booking, name: public-booking).
  Guest-facing flow to check room availability at a hotel, pick exact rooms,
  submit a booking (held pending payment) and pay through the hotel's enabled
  payment methods.
-->
<template>
  <div class="container page-content">
    <h1 class="page-title">{{ $t('bookingPage.title') }}</h1>
    <p class="muted">{{ $t('bookingPage.subtitle') }}</p>

    <!-- Feedback banners for request errors and success messages -->
    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <!-- Search form: booking type, hotel, dates and room type used to check availability -->
    <div class="card">
      <h2 class="card-title">{{ $t('bookingPage.checkAvailability') }}</h2>
      <form @submit.prevent="checkAvailability">
        <div class="form-group booking-type-group">
          <label>{{ $t('bookingPage.bookingType') }}</label>
          <SearchableSelect v-model="booking.booking_type" :options="bookingTypeOptions" />
          <p class="hint muted">
            {{ $t(`bookingPage.${booking.booking_type}Hint`) }}
          </p>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>{{ $t('superadmin.tenant') }}</label>
            <SearchableSelect v-model="search.hotel_id" :options="hotelOptions" :empty-label="$t('bookingPage.selectHotel')" required />
          </div>
          <div class="form-group">
            <label>{{ $t('bookingPage.checkIn') }}</label>
            <input v-model="search.check_in" type="date" class="input" required />
          </div>
          <div class="form-group">
            <label>{{ $t('bookingPage.checkOut') }}</label>
            <input v-model="search.check_out" type="date" class="input" required />
          </div>
          <div class="form-group">
            <label>{{ $t('rooms.roomType') }}</label>
            <SearchableSelect v-model="search.room_type" :options="roomTypeOptions" :empty-label="$t('bookingPage.any')" />
          </div>
          <div class="search-actions">
            <button class="btn btn-primary" :disabled="checking" style="width: 100%">
              <i class="fas fa-magnifying-glass"></i> {{ checking ? $t('bookingPage.checking') : $t('bookingPage.check') }}
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Availability results: clickable room cards the guest can select for this stay -->
    <div v-if="availability" class="card">
      <h2 class="card-title">
        {{ $t('home.roomsAvailable') }}
        <span class="badge badge-green">{{ availability.available_count }} {{ availability.available_count === 1 ? $t('bookingPage.roomOne') : $t('bookingPage.roomMany') }}</span>
      </h2>
      <p v-if="availability.available_rooms?.length" class="hint muted">
        {{ $t('bookingPage.selectRoomsHint') }}
      </p>

      <!-- Search, sort and pagination controls over the available rooms -->
      <div v-if="availability.available_rooms?.length" class="room-browser-bar">
        <div class="form-group room-browser-search">
          <label>{{ $t('bookingPage.searchRooms') }}</label>
          <input v-model="query" type="text" class="input" :placeholder="$t('bookingPage.searchRoomsPlaceholder')" />
        </div>
        <div class="form-group">
          <label>{{ $t('bookingPage.sortBy') }}</label>
          <SearchableSelect v-model="sortKey" :options="sortOptions" />
        </div>
        <div class="form-group">
          <label>&nbsp;</label>
          <button type="button" class="btn btn-secondary room-browser-dir" @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'">
            <i class="fas" :class="sortDir === 'asc' ? 'fa-arrow-up-wide-short' : 'fa-arrow-down-wide-short'"></i>
            {{ sortDir === 'asc' ? $t('bookingPage.sortAsc') : $t('bookingPage.sortDesc') }}
          </button>
        </div>
      </div>
      <p v-if="availability.available_rooms?.length && filteredCount" class="hint muted room-browser-count">
        {{ $t('bookingPage.showingRooms', { from: rangeFrom, to: rangeTo, total: filteredCount }) }}
      </p>

      <div v-if="pagedRooms.length" class="room-grid">
        <article
          v-for="room in pagedRooms"
          :key="room.room_id"
          class="room-card"
          :class="{ selected: isRoomSelected(room.room_id) }"
          @click="toggleRoom(room)"
        >
          <label class="room-check" @click.stop>
            <input type="checkbox" :checked="isRoomSelected(room.room_id)" @change="toggleRoom(room)" />
            <span>{{ $t('bookingPage.bookRoom') }}</span>
          </label>
          <h3>{{ $t('bookingPage.room') }} {{ room.room_number }}</h3>
          <p class="muted">{{ roomTypeLabel(room.room_type) }} &middot; {{ $t('rooms.floor') }} {{ room.floor }} &middot; {{ $t('bookingPage.upTo') }} {{ room.max_occupancy }}</p>
          <p class="room-price">TZS {{ room.price_per_night.toLocaleString() }} {{ $t('home.perNight') }}</p>
        </article>
      </div>
      <p v-else-if="availability.available_rooms?.length" class="muted">{{ $t('common.noResults') }}</p>
      <p v-else class="muted">{{ $t('bookingPage.noRoomsAvailable') }}</p>

      <!-- Pagination over the filtered/sorted available rooms -->
      <div v-if="pageCount > 1" class="pagination">
        <button class="btn btn-sm btn-secondary" :disabled="page <= 1" @click="page--">
          {{ $t('common.previous') }}</button>
        <span class="muted">{{ $t('common.pageXOfY', { current: page, total: pageCount }) }}</span>
        <button class="btn btn-sm btn-secondary" :disabled="page >= pageCount" @click="page++">
          {{ $t('common.next') }}</button>
      </div>

      <p v-if="booking.selected_rooms.length" class="hint muted selected-summary">
        {{ $t('bookingPage.selectedRooms') }}: {{ booking.selected_rooms.length }}
      </p>
    </div>

    <!-- Booking submission form, shown only once rooms are available to book -->
    <div v-if="availability?.available_rooms?.length" class="card">
      <h2 class="card-title">{{ $t('bookingPage.submitBooking') }}</h2>
      <form @submit.prevent="submitBooking">
        <h3 class="section-title">{{ $t('bookingPage.guestInfo') }}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>{{ $t('bookingPage.firstName') }}</label>
            <input v-model="booking.first_name" type="text" class="input" required />
          </div>
          <div class="form-group">
            <label>{{ $t('bookingPage.lastName') }}</label>
            <input v-model="booking.last_name" type="text" class="input" required />
          </div>
          <div class="form-group">
            <label>{{ $t('bookingPage.email') }}</label>
            <input v-model="booking.email" type="email" class="input" required />
          </div>
          <div class="form-group">
            <label>{{ $t('bookingPage.phone') }}</label>
            <PhoneInput
              v-model="booking.phone"
              v-model:countryCode="booking.country_code"
              :required="true"
            />
          </div>
        </div>

        <div class="form-grid">
          <CountryCitySelect
            v-model:countryCode="booking.country_code"
            v-model:country="booking.country"
            v-model:city="booking.city"
            :required="true"
            :city-as-dropdown="true"
          />
        </div>

        <h3 class="section-title">{{ $t('bookingPage.stayDetails') }}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>{{ $t('bookingPage.bookingDate') }}</label>
            <input v-model="search.booking_date" type="date" class="input" :max="search.check_in" />
            <small class="hint muted">{{ $t('bookingPage.bookingDateHint') }}</small>
          </div>
          <!-- Room type picker only needed when the guest did not pick exact rooms above -->
          <div v-if="!selectedRooms.length" class="form-group">
            <label>{{ $t('rooms.roomType') }}</label>
            <SearchableSelect v-model="booking.room_type" :options="roomTypeOptions" :empty-label="$t('bookingPage.selectRoom')" required />
          </div>
          <!-- Adults input is editable for bookings with rooms selected or family/group types; otherwise it is fixed by the booking type -->
          <div class="form-group">
            <label>{{ $t('bookingPage.adults') }}</label>
            <input
              v-if="selectedRooms.length || booking.booking_type === 'family' || booking.booking_type === 'group'"
              v-model.number="booking.adults"
              type="number"
              min="1"
              :max="selectedCapacity || undefined"
              class="input"
              required
            />
            <input v-else :value="booking.booking_type === 'couple' ? 2 : 1" type="number" class="input" disabled />
            <small v-if="selectedRooms.length && booking.adults > selectedCapacity" class="hint error-hint">
              {{ $t('bookingPage.guestsExceedCapacity', { adults: booking.adults, capacity: selectedCapacity }) }}
            </small>
          </div>
          <!-- Extra fields only relevant for family bookings -->
          <div v-if="booking.booking_type === 'family'" class="form-group">
            <label>{{ $t('bookingPage.children') }}</label>
            <input v-model.number="booking.children" type="number" min="0" class="input" />
          </div>
          <!-- Number of rooms requested, only when no exact rooms were chosen -->
          <div v-if="!selectedRooms.length && booking.booking_type === 'family'" class="form-group">
            <label>{{ $t('nav.rooms') }}</label>
            <input v-model.number="booking.rooms" type="number" min="1" class="input" required />
          </div>
        </div>

        <!-- Recap of the exact rooms chosen by the guest -->
        <div v-if="selectedRooms.length" class="selected-rooms-summary">
          <strong>{{ $t('bookingPage.yourRooms') }}</strong>
          <ul>
            <li v-for="r in selectedRooms" :key="r.room_id">
              {{ $t('bookingPage.room') }} {{ r.room_number }} &mdash; {{ roomTypeLabel(r.room_type) }}
            </li>
          </ul>
        </div>

        <!-- For group bookings: list of additional guests, each assigned to one of the selected rooms -->
        <div v-if="booking.booking_type === 'group'" class="group-guests">
          <h3 class="section-title">{{ $t('bookingPage.additionalGuests') }}</h3>
          <p class="hint muted">{{ $t('bookingPage.additionalGuestsHint') }}</p>
          <div v-if="booking.additional_guests.length" class="guest-rows">
            <div v-for="(guest, i) in booking.additional_guests" :key="i" class="guest-row">
              <div class="form-group">
                <label>{{ $t('bookingPage.firstName') }}</label>
                <input v-model="guest.first_name" type="text" class="input" required />
              </div>
              <div class="form-group">
                <label>{{ $t('bookingPage.lastName') }}</label>
                <input v-model="guest.last_name" type="text" class="input" />
              </div>
              <div class="form-group">
                <label>{{ $t('bookingPage.assignRoom') }}</label>
                <SearchableSelect v-model="guest.room_id" :options="selectedRoomOptions" :empty-label="$t('bookingPage.selectRoom')" required />
              </div>
              <button type="button" class="btn btn-danger btn-sm guest-remove" @click="removeGuest(i)">
                <i class="fas fa-trash"></i> {{ $t('bookingPage.removeGuest') }}
              </button>
            </div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" :disabled="!booking.selected_rooms.length" @click="addGuest">
            <i class="fas fa-plus"></i> {{ $t('bookingPage.addGuest') }}
          </button>
        </div>

        <div class="form-group">
          <label>{{ $t('bookingPage.specialRequests') }}</label>
          <textarea v-model="booking.special_requests" class="textarea" rows="3"></textarea>
        </div>
        <button class="btn btn-primary" :disabled="submitting">
          {{ submitting ? $t('bookingPage.submitting') : $t('bookingPage.submitBooking') }}
        </button>
      </form>
    </div>

    <!-- Payment step for held bookings: pick a method and settle the amount due -->
    <div v-if="pendingBooking" class="card">
      <h2 class="card-title">{{ $t('bookingPage.completePayment') }}</h2>
      <p class="hint muted">{{ $t('bookingPage.paymentHeldMessage') }}</p>
      <p class="booking-ref">
        <strong>{{ $t('bookingPage.reference') }}</strong>
        <code>{{ pendingBooking.booking_reference }}</code>
      </p>
      <p class="room-price payment-total">
        {{ $t('bookingPage.totalDue') }}
        <strong>TZS {{ pendingBooking.total_amount.toLocaleString() }}</strong>
      </p>
      <form @submit.prevent="payBooking">
        <PaymentMethodSelect
          v-model:method="payment.method"
          v-model:provider="payment.provider"
          :methods="enabledPaymentMethods"
          :required="true"
        />
        <!-- Mobile money payments require a phone number to bill -->
        <div v-if="payment.method === METHOD_MOBILE_MONEY" class="form-group">
          <label>{{ $t('bookingPage.payFromPhone') }}<span class="req">*</span></label>
          <PhoneInput
            v-model="payment.phone"
            v-model:countryCode="payment.country_code"
            :required="true"
          />
        </div>
        <div v-if="paying" class="alert alert-info">{{ $t('bookingPage.processing') }}</div>
        <div v-if="paymentError" class="alert alert-error">{{ paymentError }}</div>
        <div v-if="paymentSuccess" class="alert alert-success">{{ paymentSuccess }}</div>
        <div v-if="paymentInitiated" class="alert alert-info">{{ $t('bookingPage.paymentSubmitted') }}</div>
        <button v-if="!paymentInitiated" class="btn btn-primary" :disabled="paying || !payment.method">
          {{ paying ? $t('bookingPage.processing') : $t('bookingPage.payNow') }}
        </button>
      </form>
    </div>

    <BookingStatusTracker />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { publicApi } from '@/api'
import { normalizePhoneNumber } from '@/utils/phone'
import { getCountryName } from '@/utils/locations'
import { METHOD_MOBILE_MONEY } from '@/utils/payments'
import { todayISO } from '@/utils/dates'
import CountryCitySelect from '@/components/CountryCitySelect.vue'
import PaymentMethodSelect from '@/components/PaymentMethodSelect.vue'
import BookingStatusTracker from '@/components/BookingStatusTracker.vue'
import PhoneInput from '@/components/PhoneInput.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useRoomBrowser } from '@/composables/useRoomBrowser'

const route = useRoute()
const { t } = useI18n()
const hotels = ref([])
const checking = ref(false)
const submitting = ref(false)
const error = ref('')
const success = ref('')
const availability = ref(null)

// Lookup values that drive the search and booking type dropdowns
const roomTypes = ['single', 'double', 'suite', 'deluxe', 'presidential']
const bookingTypes = ['single', 'couple', 'family', 'group']

/**
 * Translates a room type key into its localised label.
 * @param {string} type - The room type key (single, double, suite, ...).
 * @returns {string} The translated label.
 */
function roomTypeLabel(type) {
  return t(`common.roomTypes.${type}`)
}

// Dropdown options built from the static type lists and the fetched hotels
const bookingTypeOptions = computed(() =>
  bookingTypes.map((bt) => ({ value: bt, label: t(`common.bookingTypes.${bt}`) })),
)

const roomTypeOptions = computed(() =>
  roomTypes.map((rt) => ({ value: rt, label: roomTypeLabel(rt) })),
)

const hotelOptions = computed(() =>
  hotels.value.map((h) => ({ value: h.tenant_id, label: h.hotel_name })),
)

const selectedRoomOptions = computed(() =>
  booking.value.selected_rooms.map((room) => ({ value: room.room_id, label: `${t('bookingPage.room')} ${room.room_number}` })),
)

// Search/sort/paginate the available rooms client-side; selections live in
// booking.selected_rooms (keyed by room_id) so they survive paging/sorting.
const roomsSource = computed(() => availability.value?.available_rooms || [])
const { query, sortKey, sortDir, page, pageCount, pagedRooms, filteredCount, rangeFrom, rangeTo } =
  useRoomBrowser(roomsSource)

// Options for the room-sort dropdown.
const sortOptions = computed(() => [
  { value: 'price_per_night', label: t('bookingPage.sortPrice') },
  { value: 'room_number', label: t('bookingPage.sortRoomNumber') },
  { value: 'max_occupancy', label: t('bookingPage.sortCapacity') },
  { value: 'floor', label: t('bookingPage.sortFloor') },
])

// Search criteria collected from the availability form; hotel id is seeded from the route query
const search = ref({
  hotel_id: route.query.hotel_id || '',
  check_in: '',
  check_out: '',
  booking_date: todayISO(),
  room_type: '',
})

// State for a held booking awaiting payment, and for the payment attempt itself
const pendingBooking = ref(null)
const payment = ref({
  method: '',
  provider: '',
  phone: '',
  country_code: 'TZ',
})
const paying = ref(false)
const paymentError = ref('')
const paymentSuccess = ref('')
const paymentInitiated = ref(false)

/** The methods this hotel accepts on the public page, if it has any. */
const enabledPaymentMethods = computed(() => availability.value?.payment_methods || [])

// The whole booking being built: guest details, chosen rooms and any additional guests
const booking = ref({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  country_code: 'TZ',
  country: '',
  city: '',
  booking_type: 'single',
  adults: 1,
  children: 0,
  rooms: 1,
  room_type: '',
  special_requests: '',
  selected_rooms: [],
  additional_guests: [],
})

/**
 * Resets the booking to sensible defaults whenever the guest changes the booking
 * type, and re-runs the current availability search since the type affects
 * which rooms are offered.
 */
function onBookingTypeChange() {
  const type = booking.value.booking_type
  booking.value.selected_rooms = []
  booking.value.additional_guests = []
  if (type === 'single') {
    booking.value.adults = 1
    booking.value.children = 0
    booking.value.rooms = 1
  } else if (type === 'couple') {
    booking.value.adults = 2
    booking.value.children = 0
    booking.value.rooms = 1
  } else if (type === 'family') {
    booking.value.adults = 2
    booking.value.children = 1
    booking.value.rooms = 1
  } else {
    booking.value.adults = 4
    booking.value.children = 0
    booking.value.rooms = 1
  }
  // The booking type decides which rooms are fetched, so re-search whenever a
  // previous search is on screen to keep the results in line with the type.
  if (availability.value) checkAvailability()
}

/**
 * Returns true when the given room id is currently in the guest's selection.
 * @param {string} roomId - The room id to look up.
 * @returns {boolean} Whether the room is selected.
 */
function isRoomSelected(roomId) {
  return booking.value.selected_rooms.some((r) => r.room_id === roomId)
}

/**
 * Adds or removes a room from the selection and keeps the requested room count in sync.
 * @param {Object} room - The availability room card that was clicked.
 */
function toggleRoom(room) {
  const index = booking.value.selected_rooms.findIndex((r) => r.room_id === room.room_id)
  if (index >= 0) {
    booking.value.selected_rooms.splice(index, 1)
  } else {
    booking.value.selected_rooms.push({
      room_id: room.room_id,
      room_number: room.room_number,
      room_type: room.room_type,
      max_occupancy: room.max_occupancy,
    })
  }
  booking.value.rooms = Math.max(1, booking.value.selected_rooms.length)
}

// Derived values over the chosen rooms: the selection itself and its total guest capacity
const selectedRooms = computed(() => booking.value.selected_rooms)
const selectedCapacity = computed(() =>
  selectedRooms.value.reduce((sum, r) => sum + (r.max_occupancy || 1), 0),
)

/** Appends a blank additional-guest row, pre-assigned to the first selected room. */
function addGuest() {
  booking.value.additional_guests.push({
    first_name: '',
    last_name: '',
    room_id: booking.value.selected_rooms[0]?.room_id || '',
  })
}

/**
 * Removes the additional-guest row at the given index.
 * @param {number} index - Position of the guest row in `booking.additional_guests`.
 */
function removeGuest(index) {
  booking.value.additional_guests.splice(index, 1)
}

/** Loads the list of hotels shown in the search form. */
async function loadHotels() {
  try {
    const res = await publicApi.hotels()
    hotels.value = res.data.hotels || []
  } catch {
    hotels.value = []
  }
}

/** Queries the API for available rooms and resets the previous booking selection. */
async function checkAvailability() {
  error.value = ''
  success.value = ''
  availability.value = null
  booking.value.selected_rooms = []
  booking.value.additional_guests = []
  checking.value = true
  try {
    const params = { ...search.value, booking_type: booking.value.booking_type }
    const res = await publicApi.availability(params)
    availability.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('bookingPage.checkAvailabilityError')
  } finally {
    checking.value = false
  }
}

/**
 * Validates the booking, then either holds exact rooms for payment or files a
 * booking request (requisition) that the hotel responds to.
 */
async function submitBooking() {
  error.value = ''
  success.value = ''

  if (!availability.value) {
    error.value = t('bookingPage.checkAvailabilityFirst')
    return
  }

  if (selectedRooms.value.length && booking.value.adults > selectedCapacity.value) {
    error.value = t('bookingPage.guestsExceedCapacity', {
      adults: booking.value.adults,
      capacity: selectedCapacity.value,
    })
    return
  }

  if (booking.value.booking_type === 'group' && !booking.value.selected_rooms.length) {
    error.value = t('bookingPage.selectAtLeastOneRoom')
    return
  }

  const hasSelection = booking.value.selected_rooms.length > 0

  submitting.value = true
  try {
    const guest = {
      hotel_id: search.value.hotel_id,
      first_name: booking.value.first_name,
      last_name: booking.value.last_name,
      email: booking.value.email,
      phone: normalizePhoneNumber(booking.value.phone, booking.value.country_code),
      country: booking.value.country || getCountryName(booking.value.country_code),
      country_code: booking.value.country_code,
      city: booking.value.city,
      booking_type: booking.value.booking_type,
      booking_date: search.value.booking_date || undefined,
      check_in_date: search.value.check_in,
      check_out_date: search.value.check_out,
      adults: booking.value.adults,
      children: booking.value.children,
      special_requests: booking.value.special_requests,
    }

    let message = ''
    if (hasSelection) {
      // The guest picked exact rooms, so reserve them for real.
      const res = await publicApi.reservations({
        ...guest,
        guest_email: guest.email,
        guest_phone: guest.phone,
        num_adults: guest.adults,
        num_children: guest.children,
        room_selections: booking.value.selected_rooms.map(({ room_id, room_number }) => ({ room_id, room_number })),
      })
      // Rooms are held as pending until the guest pays for them.
      pendingBooking.value = {
        booking_reference: res.data.booking_reference,
        total_amount: res.data.total_amount,
      }
      payment.value.method = enabledPaymentMethods.value[0] || ''
      payment.value.provider = ''
      payment.value.phone = booking.value.phone
      paymentInitiated.value = false
      success.value = res.data.message || t('bookingPage.bookingHeld')
      return
    } else {
      // Otherwise file a booking request the hotel will respond to.
      const payload = { ...guest, room_type: booking.value.room_type, rooms: booking.value.rooms }
      if (booking.value.booking_type === 'group') {
        payload.additional_guests = booking.value.additional_guests.filter((g) => g.first_name?.trim())
      }
      const res = await publicApi.bookingRequisition(payload)
      message = `${res.data.message} ${t('bookingPage.reference')} ${res.data.requisition?.requisition_number}`
    }

    success.value = message
    booking.value = {
      ...booking.value,
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      country: '',
      city: '',
      special_requests: '',
      selected_rooms: [],
      additional_guests: [],
    }
  } catch (err) {
    const messages = err.response?.data?.errors
    error.value = messages ? Object.values(messages).flat().join(' ') : err.response?.data?.message || t('bookingPage.bookingFailed')
  } finally {
    submitting.value = false
  }
}

/**
 * Pays for the held booking. Mobile money sends a ClickPesa prompt, a bank
 * transfer records the reference for the hotel to confirm, and Selcom settles
 * straight away.
 */
async function payBooking() {
  paymentError.value = ''
  paymentSuccess.value = ''
  if (!pendingBooking.value || !payment.value.method) return

  paying.value = true
  try {
    const res = await publicApi.initiatePayment({
      booking_reference: pendingBooking.value.booking_reference,
      amount: pendingBooking.value.total_amount,
      payment_method: payment.value.method,
      payment_provider: payment.value.provider || undefined,
      phone: normalizePhoneNumber(payment.value.phone, payment.value.country_code) || undefined,
    })
    const reference = res.data.payment?.transaction_reference || res.data.payment?.clickpesa_reference
    paymentSuccess.value = `${res.data.message} ${reference ? `${t('bookingPage.reference')} ${reference}` : ''}`
    paymentInitiated.value = true
  } catch (err) {
    paymentError.value = flattenError(err)
  } finally {
    paying.value = false
  }
}

/**
 * Flattens a validation-error object (or fallback message) into a single readable string.
 * @param {Error} err - The thrown request error.
 * @returns {string} A space-joined error message or the generic failure text.
 */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
}

// Keeps the availability results in line with the chosen booking type
watch(
  () => booking.value.booking_type,
  (val, old) => {
    if (val !== old) onBookingTypeChange()
  },
)

onMounted(loadHotels)
</script>

<style scoped>
.page-title {
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 4px;
}

.muted {
  color: #64748b;
}

.hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}

.error-hint {
  color: #c0392b;
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.search-actions {
  display: flex;
  align-items: flex-end;
}

.booking-type-group {
  margin-top: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  margin: 20px 0 12px;
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.room-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.room-card.selected {
  border-color: #005EB8;
  background: #f0f7ff;
}

.room-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #005EB8;
  cursor: pointer;
}

.room-check input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: #005EB8;
  cursor: pointer;
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
  margin: 4px 0 12px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

@media (max-width: 640px) {
  .room-browser-bar {
    grid-template-columns: 1fr;
  }
}

.selected-rooms-summary {
  margin: 12px 0;
  padding: 12px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  border-radius: 8px;
}

.selected-rooms-summary ul {
  margin: 6px 0 0;
  padding-left: 20px;
  display: grid;
  gap: 4px;
}

.room-price {
  margin-top: auto;
  font-weight: 700;
  color: #005EB8;
}

.booking-ref {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0 4px;
}

.booking-ref code {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: #0f172a;
}

.payment-total {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  font-weight: 600;
  color: #475569;
}

.group-guests {
  margin-top: 8px;
}

.guest-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.guest-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 10px;
  align-items: end;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}

.guest-remove {
  white-space: nowrap;
}

.req {
  color: #c0392b;
  margin-left: 2px;
}
</style>
