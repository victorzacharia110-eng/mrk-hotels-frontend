<!--
  Reservations page (route: /app/reservations, name: hotel-reservations).
  Front-desk management of reservations: a tabbed (active / checked-out /
  cancelled) filterable list, walk-in booking creation with live availability
  and deposit capture, check-in/out with balance settlement, no-show/cancel
  actions and a guarded permanent delete.
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
        <button v-if="canOperate" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('reservations.newReservation') }}
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

    <!-- Lifecycle tabs: active (in-house/upcoming), checked-out and cancelled -->
    <div class="tabs">
      <button
        class="tab tab-active"
        :class="{ active: tab === 'active' }"
        @click="switchTab('active')"
      >
        <i class="fas fa-bed"></i> {{ $t('reservations.tabActive') }}
      </button>
      <button
        class="tab tab-checked-out"
        :class="{ active: tab === 'checked_out' }"
        @click="switchTab('checked_out')"
      >
        <i class="fas fa-clock-rotate-left"></i> {{ $t('reservations.tabCheckedOut') }}
      </button>
      <button
        class="tab tab-cancelled"
        :class="{ active: tab === 'cancelled' }"
        @click="switchTab('cancelled')"
      >
        <i class="fas fa-ban"></i> {{ $t('reservations.tabCancelled') }}
      </button>
    </div>

    <!-- Status/type/date-range/search filters; each change reloads the list -->
    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('reservations.status') }}</label>
          <SearchableSelect
            v-model="filters.status"
            :options="reservationStatusOptions"
            :empty-label="$t('common.all')"
            @change="load"
          />
        </div>
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
          <label>{{ $t('common.from') }}</label>
          <input v-model="filters.from" type="date" class="input" @change="load" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.to') }}</label>
          <input v-model="filters.to" type="date" class="input" @change="load" />
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
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('reservations.guest') }}</th>
            <th scope="col">{{ $t('reservations.tableBookingType') }}</th>
            <th scope="col">{{ $t('reservations.room') }}</th>
            <th scope="col">{{ $t('reservations.tableStay') }}</th>
            <th scope="col">{{ $t('reservations.tableTimes') }}</th>
            <th scope="col">{{ $t('reservations.tableTotal') }}</th>
            <th scope="col">{{ $t('reservations.tableBalance') }}</th>
            <th scope="col">{{ $t('reservations.status') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in reservations" :key="r.reservation_id">
            <td>
              <strong>{{ r.guest_name }}</strong>
              <div class="sub">{{ r.guest_phone || r.guest_email || '—' }}</div>
              <div v-if="r.city || r.country" class="sub">
                <i class="fas fa-location-dot"></i>
                {{ [r.city, r.country].filter(Boolean).join(', ') }}
              </div>
            </td>
            <td>
              <span class="badge badge-blue">{{ bookingTypeLabel(r.booking_type) }}</span>
            </td>
            <td>
              <span v-if="r.room">
                {{ $t('reservations.room') }} {{ r.room.room_number }}
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
              <div v-if="r.checked_in_at">
                <i class="fas fa-right-to-bracket"></i> {{ formatDateTime(r.checked_in_at) }}
              </div>
              <div class="sub" v-else>—</div>
              <div v-if="r.checked_out_at">
                <i class="fas fa-right-from-bracket"></i> {{ formatDateTime(r.checked_out_at) }}
              </div>
              <div v-if="r.checkout_reason" class="sub">
                <i class="fas fa-comment"></i> “{{ r.checkout_reason }}”
              </div>
            </td>
            <td>
              <span class="price">TZS {{ Number(r.total_amount).toLocaleString() }}</span>
            </td>
            <td>
              <span :class="{ due: Number(r.balance_due ?? r.balance) > 0 }">
                TZS {{ Number(r.balance_due ?? r.balance).toLocaleString() }}
              </span>
              <div v-if="Number(r.room_charges) > 0" class="sub">
                <i class="fas fa-receipt"></i> {{ $t('reservations.roomCharges') }} TZS
                {{ Number(r.room_charges).toLocaleString() }}
              </div>
            </td>
            <td>
              <span class="badge" :class="statusBadge(r.status)">{{
                r.status.replace('_', ' ')
              }}</span>
            </td>
            <td>
              <div class="actions">
                <button class="btn btn-sm btn-secondary" @click="openDetail(r)">
                  <i class="fas fa-eye"></i> {{ $t('common.view') }}
                </button>
                <button
                  v-if="['pending', 'confirmed'].includes(r.status) && canOperate"
                  class="btn btn-sm btn-success"
                  @click="openCheckin(r)"
                >
                  <i class="fas fa-right-to-bracket"></i> {{ $t('reservations.checkIn') }}
                </button>
                <button
                  v-if="r.status === 'checked_in' && canOperate"
                  class="btn btn-sm btn-primary"
                  @click="openCheckout(r)"
                >
                  <i class="fas fa-right-from-bracket"></i> {{ $t('reservations.checkOut') }}
                </button>
                <button
                  v-if="r.status === 'confirmed' && canOperate"
                  class="btn btn-sm btn-secondary"
                  @click="noShow(r)"
                >
                  {{ $t('reservations.noShow') }}
                </button>
                <button
                  v-if="['pending', 'confirmed'].includes(r.status) && canOperate"
                  class="btn btn-sm btn-danger"
                  @click="cancel(r)"
                >
                  <i class="fas fa-ban"></i> {{ $t('common.cancel') }}
                </button>
                <button
                  v-if="['checked_out', 'cancelled'].includes(r.status) && canOperate"
                  class="btn btn-sm btn-danger"
                  @click="openDelete(r)"
                >
                  <i class="fas fa-trash-can"></i> {{ $t('reservations.deletePermanent') }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!reservations.length && !loading">
            <td colspan="9" class="sub">{{ $t('reservations.empty') }}</td>
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

    <!-- New reservation modal: guest, booking, room picker and payment sections -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal modal-lg">
        <div class="modal-head">
          <h2><i class="fas fa-calendar-check"></i> {{ $t('reservations.newReservation') }}</h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <!-- Guest -->
          <div class="form-section">
            <h3>{{ $t('reservations.guest') }}</h3>
            <div class="form-grid">
              <div class="form-group form-full">
                <label>{{ $t('reservations.existingGuest') }}</label>
                <SearchableSelect
                  v-model="form.guest_id"
                  :options="guestOptions"
                  :empty-label="$t('reservations.walkInNewGuest')"
                  :searching="guestSearching"
                  @change="fillGuest"
                  @search="searchGuests"
                />
                <small v-if="recognizedGuest" class="hint success">
                  <i class="fas fa-user-check"></i>
                  {{
                    $t('reservations.guestRecognized', {
                      name: recognizedGuest.full_name,
                      hotel: recognizedGuest.hotel_name || '',
                    })
                  }}
                </small>
              </div>
              <div class="form-group">
                <label>{{ $t('reservations.firstName') }}<span class="req">*</span></label>
                <input v-model="form.first_name" type="text" class="input" required />
              </div>
              <div class="form-group">
                <label>{{ $t('reservations.lastName') }}<span class="req">*</span></label>
                <input v-model="form.last_name" type="text" class="input" required />
              </div>
              <div class="form-group">
                <label>{{ $t('guests.phone') }}<span class="req">*</span></label>
                <PhoneInput
                  v-model="form.guest_phone"
                  v-model:countryCode="form.country_code"
                  :required="true"
                />
              </div>
              <div class="form-group">
                <label>{{ $t('guests.email') }}</label>
                <input v-model="form.guest_email" type="email" class="input" />
              </div>

              <CountryCitySelect
                v-model:country-code="form.country_code"
                v-model:country="form.country"
                v-model:city="form.city"
              />

              <div class="form-group">
                <label>{{ $t('reservations.idTypeHint') }}</label>
                <SearchableSelect
                  v-model="form.id_type"
                  :options="idTypeOptions"
                  :empty-label="$t('common.none')"
                />
              </div>
              <div class="form-group">
                <label>{{ $t('reservations.idNumber') }}</label>
                <input
                  v-model="form.id_number"
                  type="text"
                  class="input"
                  :required="!!form.id_type"
                />
              </div>
            </div>
          </div>

          <!-- Booking -->
          <div class="form-section">
            <h3>{{ $t('reservations.booking') }}</h3>
            <div class="form-grid">
              <div class="form-group">
                <label>{{ $t('reservations.bookingType') }}<span class="req">*</span></label>
                <SearchableSelect
                  v-model="form.booking_type"
                  :options="bookingTypeOptions"
                  :required="true"
                  @change="applyBookingType"
                />
              </div>
              <div class="form-group">
                <label>{{ $t('reservations.bookingDate') }}</label>
                <input v-model="form.booking_date" type="date" class="input" />
              </div>

              <!-- Narrowing by room type keeps the availability results short. -->
              <div class="form-group">
                <label>{{ $t('reservations.roomType') }}</label>
                <SearchableSelect
                  v-model="form.room_type"
                  :options="roomTypeOptions"
                  :empty-label="$t('reservations.anyRoomType')"
                />
              </div>
              <div class="form-group form-full">
                <button
                  type="button"
                  class="btn btn-outline btn-block"
                  :disabled="checking || !form.check_in_date || !form.check_out_date"
                  @click="checkAvailability"
                >
                  <i class="fas fa-magnifying-glass"></i>
                  {{ checking ? $t('bookingPage.checking') : $t('reservations.checkAvailability') }}
                </button>
                <small v-if="!form.check_in_date || !form.check_out_date" class="hint">
                  {{ $t('reservations.setDatesFirst') }}
                </small>
              </div>

              <StayDates
                v-model:arrival="form.check_in_date"
                v-model:departure="form.check_out_date"
                v-model:days="form.num_days"
                allow-past
              />

              <div class="form-group">
                <label>{{ $t('reservations.bookingSource') }}</label>
                <SearchableSelect v-model="form.booking_source" :options="bookingSourceOptions" />
              </div>
              <div class="form-group">
                <label>{{ $t('reservations.adultsLabel') }}</label>
                <input v-model.number="form.num_adults" type="number" min="1" class="input" />
              </div>
              <div class="form-group">
                <label>{{ $t('reservations.childrenLabel') }}</label>
                <input v-model.number="form.num_children" type="number" min="0" class="input" />
              </div>
              <div class="form-group form-full">
                <label>{{ $t('reservations.specialRequests') }}</label>
                <textarea v-model="form.special_requests" rows="2" class="textarea"></textarea>
              </div>
            </div>
          </div>

          <!-- Rooms (online-style availability picker) -->
          <div v-if="availability" class="form-section">
            <h3>
              <i class="fas fa-bed"></i> {{ $t('reservations.availableRooms') }}
              <span v-if="availability.available_rooms?.length" class="badge badge-green">
                {{ availability.available_rooms.length }}
              </span>
            </h3>
            <p v-if="availability.available_rooms?.length" class="hint">
              {{ $t('reservations.selectRoomsHint') }}
            </p>

            <!-- Search and sort controls -->
            <div v-if="roomsSource.length" class="room-browser-bar">
              <div class="form-group">
                <label>{{ $t('common.search') }}</label>
                <input
                  v-model.trim="query"
                  type="search"
                  class="input"
                  :placeholder="$t('bookingPage.searchRoomsPlaceholder')"
                />
              </div>
              <div class="form-group">
                <label>{{ $t('bookingPage.sortBy') }}</label>
                <SearchableSelect
                  v-model="sortKey"
                  :options="sortOptions"
                  :placeholder="$t('bookingPage.sortBy')"
                  @change="roomPage = 1"
                />
              </div>
              <div class="form-group">
                <label>&nbsp;</label>
                <button
                  type="button"
                  class="btn btn-outline room-browser-dir"
                  @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
                >
                  <i
                    :class="
                      sortDir === 'asc'
                        ? 'fas fa-arrow-up-wide-short'
                        : 'fas fa-arrow-down-wide-short'
                    "
                  ></i>
                  {{ sortDir === 'asc' ? $t('bookingPage.sortAsc') : $t('bookingPage.sortDesc') }}
                </button>
              </div>
            </div>

            <div v-if="availability.available_rooms?.length" class="room-grid">
              <article
                v-for="room in pagedRooms"
                :key="room.room_id"
                class="room-card"
                :class="{ selected: isRoomSelected(room.room_id) }"
                @click="toggleRoom(room)"
              >
                <label class="room-check" @click.stop>
                  <input
                    type="checkbox"
                    :checked="isRoomSelected(room.room_id)"
                    @change="toggleRoom(room)"
                  />
                  <span>{{ $t('bookingPage.bookRoom') }}</span>
                </label>
                <h3>{{ $t('reservations.room') }} {{ room.room_number }}</h3>
                <p class="muted capitalize">
                  {{ roomTypeLabel(room.room_type) }} · {{ $t('rooms.floor') }} {{ room.floor }} ·
                  {{ $t('bookingPage.upTo') }} {{ room.max_occupancy }}
                </p>
                <p class="room-price">
                  TZS {{ Number(room.price_per_night).toLocaleString() }} /
                  {{ $t('home.perNight') }}
                </p>
              </article>
            </div>
            <p v-else class="hint danger">{{ $t('reservations.noRoomsAvailable') }}</p>
            <p v-if="selectedRooms.length" class="hint selected-summary">
              <strong>{{ $t('bookingPage.selectedRooms') }}:</strong> {{ selectedRooms.length }}
            </p>
            <p v-if="roomsSource.length" class="hint room-browser-count">
              {{
                $t('bookingPage.showingRooms', {
                  from: rangeFrom,
                  to: rangeTo,
                  total: filteredCount,
                })
              }}
            </p>

            <!-- Pagination over the available rooms (15 per page) -->
            <div v-if="pageCount > 1" class="pagination">
              <button
                type="button"
                class="btn btn-sm btn-outline"
                :disabled="roomPage <= 1"
                @click="roomPage--"
              >
                <i class="fas fa-chevron-left"></i> {{ $t('common.previous') }}
              </button>
              <span>{{ $t('common.pageXOfY', { current: roomPage, total: pageCount }) }}</span>
              <button
                type="button"
                class="btn btn-sm btn-outline"
                :disabled="roomPage >= pageCount"
                @click="roomPage++"
              >
                {{ $t('common.next') }} <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>

          <!-- Payment -->
          <div class="form-section">
            <h3>{{ $t('reservations.payment') }}</h3>
            <div class="form-grid">
              <div class="form-group">
                <label>{{ $t('reservations.totalAmount') }}</label>
                <input v-model.number="form.total_amount" type="number" min="0" class="input" />
                <small v-if="computedTotal" class="hint">
                  {{ $t('reservations.autoTotal', { amount: computedTotal.toLocaleString() }) }}
                </small>
              </div>
              <div class="form-group">
                <label>{{ $t('reservations.amountPaidNow') }}</label>
                <input
                  v-model.number="form.amount_paid"
                  type="number"
                  min="0"
                  step="0.01"
                  class="input"
                />
                <small class="hint">{{ $t('reservations.amountPaidHint') }}</small>
              </div>

              <!-- Payment details only matter once money is actually taken. -->
              <template v-if="form.amount_paid > 0">
                <PaymentMethodSelect
                  v-model:method="form.payment_method"
                  v-model:provider="form.payment_provider"
                />
                <!-- Cash has no receipt reference; bank and mobile money quote
                     the guest's so the money can be matched later. -->
                <div v-if="requiresProvider(form.payment_method)" class="form-group form-full">
                  <label>{{ $t('reservations.transactionReference') }}</label>
                  <input
                    v-model="form.transaction_reference"
                    type="text"
                    class="input"
                    required
                    :placeholder="$t('reservations.transactionReferencePlaceholder')"
                  />
                </div>
              </template>
            </div>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('reservations.saveReservation') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Check-out modal: reason plus balance settlement when money is still due -->
    <div v-if="showCheckout" class="modal-overlay" @click.self="closeCheckout">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-right-from-bracket"></i> {{ $t('reservations.checkOut') }}</h2>
          <button class="modal-close" @click="closeCheckout"><i class="fas fa-xmark"></i></button>
        </div>
        <p class="muted">
          <strong>{{ checkoutTarget?.guest_name }}</strong> · {{ $t('reservations.room') }}
          {{ checkoutTarget?.room?.room_number }}
        </p>
        <p v-if="isEarlyCheckout" class="hint danger">
          <i class="fas fa-triangle-exclamation"></i> {{ $t('reservations.earlyCheckoutHint') }}
        </p>
        <form @submit.prevent="confirmCheckout">
          <div class="form-group">
            <label>{{ $t('reservations.checkoutReason') }}<span class="req">*</span></label>
            <input v-model="checkoutReason" type="text" class="input" required />
            <small class="hint">{{ $t('reservations.checkoutReasonHint') }}</small>
          </div>

          <div v-if="checkoutBalance > 0" class="balance-box">
            <div class="balance-row">
              <span>{{ $t('reservations.roomRate') }}</span>
              <span>TZS {{ Number(checkoutTarget?.total_amount || 0).toLocaleString() }}</span>
            </div>
            <div class="balance-row">
              <span>{{ $t('reservations.roomCharges') }}</span>
              <span>TZS {{ Number(checkoutTarget?.room_charges || 0).toLocaleString() }}</span>
            </div>
            <div class="balance-row">
              <span>{{ $t('reservations.advancePaid') }}</span>
              <span>- TZS {{ Number(checkoutTarget?.advance_payment || 0).toLocaleString() }}</span>
            </div>
            <div class="balance-row total">
              <span>{{ $t('reservations.balanceDue') }}</span>
              <span>TZS {{ checkoutBalance.toLocaleString() }}</span>
            </div>
            <small class="hint">{{ $t('reservations.settleBeforeCheckout') }}</small>
          </div>

          <div v-if="checkoutBalance > 0" class="form-grid settlement-grid">
            <div class="form-group">
              <label>{{ $t('orders.method') }}<span class="req">*</span></label>
              <SearchableSelect
                v-model="checkoutMethod"
                :options="checkoutMethodOptions"
                required
              />
            </div>
            <div class="form-group">
              <label>{{ $t('reservations.settlementAmount') }}<span class="req">*</span></label>
              <input
                v-model.number="checkoutAmount"
                type="number"
                min="0"
                step="0.01"
                class="input"
                required
              />
            </div>
            <div v-if="checkoutNeedsProvider" class="form-group form-full">
              <label>{{ $t('paymentFields.provider') }}<span class="req">*</span></label>
              <SearchableSelect
                v-model="checkoutProvider"
                :options="checkoutProviderOptions"
                required
              />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('common.notes') }}</label>
              <input v-model="checkoutNotes" type="text" class="input" />
            </div>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeCheckout">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="checkingOut">
              <i class="fas fa-check"></i>
              {{ checkingOut ? $t('common.saving') : $t('reservations.checkOut') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Check-in modal: payment verification and optional override -->
    <div v-if="showCheckin" class="modal-overlay" @click.self="closeCheckin">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-right-to-bracket"></i> {{ $t('reservations.checkIn') }}</h2>
          <button class="modal-close" @click="closeCheckin"><i class="fas fa-xmark"></i></button>
        </div>
        <p class="muted">
          <strong>{{ checkinTarget?.guest_name }}</strong> · {{ $t('reservations.room') }}
          {{ checkinTarget?.room?.room_number || checkinTarget?.room_type }}
        </p>

        <div v-if="checkinBalanceDue > 0" class="alert alert-warning" style="margin-bottom: 12px;">
          <i class="fas fa-triangle-exclamation"></i>
          {{ $t('reservations.unpaidWarning') }}
        </div>

        <!-- Active override badge -->
        <div v-if="hasActiveOverride" class="alert alert-success" style="margin-bottom: 12px;">
          <i class="fas fa-shield-halved"></i>
          <span>
            {{ $t('overrides.overrideFor', { name: activeOverride.guest_name }) }}
            · {{ $t('overrides.remainingTime', { time: activeOverrideCountdown }) }}
          </span>
          <div v-if="activeOverride.notes" class="sub" style="margin-top: 4px;">{{ activeOverride.notes }}</div>
        </div>

        <div class="balance-box">
          <div class="balance-row">
            <span>{{ $t('reservations.tableTotal') }}</span>
            <span>TZS {{ Number(checkinTarget?.total_amount || 0).toLocaleString() }}</span>
          </div>
          <div class="balance-row">
            <span>{{ $t('reservations.advancePaid') || 'Paid' }}</span>
            <span>TZS {{ Number(checkinTarget?.advance_payment || 0).toLocaleString() }}</span>
          </div>
          <div class="balance-row total" v-if="checkinBalanceDue > 0">
            <span>{{ $t('reservations.outstanding') }}</span>
            <span class="danger">TZS {{ Number(checkinBalanceDue).toLocaleString() }}</span>
          </div>
        </div>

        <form @submit.prevent="confirmCheckin">
          <!-- Manual override: only shown to managers when there is NO active override -->
          <div v-if="checkinBalanceDue > 0 && authStore.roleLevel >= 80 && !hasActiveOverride" class="form-group">
            <label class="toggle-label">
              <input type="checkbox" v-model="checkinOverride" />
              {{ $t('reservations.managerOverride') }}
            </label>
          </div>
          <!-- Receptionist sees "manager required" only when there is NO active override -->
          <div v-if="checkinBalanceDue > 0 && authStore.roleLevel < 80 && !hasActiveOverride" class="alert alert-warning" style="margin-bottom: 12px;">
            <i class="fas fa-lock"></i>
            {{ $t('reservations.managerOverrideRequired') }}
          </div>
          <div v-if="checkinOverride && checkinBalanceDue > 0 && !hasActiveOverride" class="form-group">
            <label>{{ $t('reservations.overrideReason') }}<span class="req">*</span></label>
            <input v-model="checkinOverrideReason" type="text" class="input" required />
            <small class="hint">{{ $t('reservations.overrideReasonHint') }}</small>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeCheckin">
              {{ $t('common.cancel') }}
            </button>
            <button
              type="submit"
              class="btn"
              :class="checkinBalanceDue > 0 && !checkinOverride && !hasActiveOverride ? 'btn-danger' : 'btn-success'"
              :disabled="checkingIn"
            >
              <i class="fas fa-check"></i>
              {{
                checkingIn
                  ? $t('common.saving')
                  : checkinBalanceDue > 0 && !checkinOverride && !hasActiveOverride
                    ? $t('reservations.paymentRequired')
                    : $t('reservations.checkIn')
              }}
            </button>
          </div>
        </form>
      </div>
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
        <dl v-if="detail" class="detail-grid">
          <div>
            <dt>{{ $t('reservations.tableBookingType') }}</dt>
            <dd>{{ bookingTypeLabel(detail.booking_type) }}</dd>
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
            <dt>{{ $t('reservations.tableStay') }}</dt>
            <dd>{{ formatDate(detail.arrival_date) }} → {{ formatDate(detail.departure_date) }}</dd>
          </div>
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
            <dd class="price">TZS {{ Number(detail.total_amount).toLocaleString() }}</dd>
          </div>
          <div>
            <dt>{{ $t('reservations.roomCharges') }}</dt>
            <dd>TZS {{ Number(detail.room_charges || 0).toLocaleString() }}</dd>
          </div>
          <div>
            <dt>{{ $t('reservations.tableBalance') }}</dt>
            <dd :class="{ due: Number(detail.balance) > 0 }">
              TZS {{ Number(detail.balance).toLocaleString() }}
            </dd>
          </div>
          <div>
            <dt>{{ $t('reservations.bookingSource') }}</dt>
            <dd class="capitalize">{{ bookingSourceLabel(detail.booking_source) }}</dd>
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
        <div class="modal-foot">
          <button class="btn btn-secondary" :disabled="invoiceLoading" @click="downloadInvoice">
            <i class="fas fa-file-invoice"></i>
            {{ invoiceLoading ? $t('invoices.preparing') : $t('invoices.download') }}
          </button>
          <template v-if="detail?.status === 'checked_in' && canOperate">
            <button class="btn btn-primary" @click="openCheckout(detail)">
              <i class="fas fa-right-from-bracket"></i> {{ $t('reservations.checkOut') }}
            </button>
          </template>
          <template v-else-if="['pending', 'confirmed'].includes(detail?.status) && canOperate">
            <button class="btn btn-success" @click="openCheckin(detail)">
              <i class="fas fa-right-to-bracket"></i> {{ $t('reservations.checkIn') }}
            </button>
            <button
              v-if="detail.status === 'confirmed'"
              class="btn btn-secondary"
              @click="noShow(detail)"
            >
              {{ $t('reservations.noShow') }}
            </button>
            <button class="btn btn-danger" @click="cancel(detail)">
              <i class="fas fa-ban"></i> {{ $t('common.cancel') }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Permanent delete modal, guarded by typing the guest name in caps -->
    <div v-if="showDelete" class="modal-overlay" @click.self="closeDelete">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-trash-can"></i> {{ $t('reservations.deletePermanent') }}</h2>
          <button class="modal-close" @click="closeDelete"><i class="fas fa-xmark"></i></button>
        </div>
        <p>{{ $t('reservations.deleteConfirm', { name: deleteTarget?.guest_name }) }}</p>

        <!-- Deletion impact summary -->
        <div v-if="loadingDeletePreview" class="delete-impact-loading">
          <i class="fas fa-spinner fa-spin"></i> {{ $t('common.loading') }}
        </div>
        <div v-else-if="deletePreview" class="delete-impact">
          <p class="delete-impact-title">{{ $t('reservations.deleteImpactTitle') }}</p>
          <table class="delete-impact-table">
            <tbody>
              <tr v-if="deletePreview.payments_count > 0">
                <td><i class="fas fa-credit-card"></i> {{ $t('reservations.deleteImpactPayments') }}</td>
                <td class="text-right">
                  {{ deletePreview.payments_count }} · TZS {{ Number(deletePreview.payments_total).toLocaleString() }}
                </td>
              </tr>
              <tr v-if="deletePreview.orders_count > 0">
                <td><i class="fas fa-utensils"></i> {{ $t('reservations.deleteImpactOrders') }}</td>
                <td class="text-right">
                  {{ deletePreview.orders_count }} · TZS {{ Number(deletePreview.orders_total).toLocaleString() }}
                </td>
              </tr>
              <tr v-if="deletePreview.laundry_count > 0">
                <td><i class="fas fa-shirt"></i> {{ $t('reservations.deleteImpactLaundry') }}</td>
                <td class="text-right">
                  {{ deletePreview.laundry_count }} · TZS {{ Number(deletePreview.laundry_total).toLocaleString() }}
                </td>
              </tr>
            </tbody>
          </table>
          <p class="delete-impact-warning">{{ $t('reservations.deleteImpactWarning') }}</p>
        </div>
        <div v-else-if="deleteTarget?.status === 'checked_out'" class="delete-impact">
          <p class="delete-impact-warning">{{ $t('reservations.deleteImpactNoData') }}</p>
        </div>

        <div class="form-group">
          <label>{{ $t('reservations.deleteTypeName') }}</label>
          <input
            v-model="deleteName"
            type="text"
            class="input"
            autocomplete="off"
            :placeholder="String(deleteTarget?.guest_name || '').toUpperCase()"
            @keyup.enter="confirmDelete"
          />
        </div>
        <div class="modal-foot">
          <button class="btn btn-secondary" @click="closeDelete">{{ $t('common.cancel') }}</button>
          <button
            class="btn btn-danger"
            :disabled="!deleteNameMatches || deleting"
            @click="confirmDelete"
          >
            <i class="fas fa-trash-can"></i>
            {{ deleting ? $t('common.deleting') : $t('reservations.deletePermanent') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { guestApi, invoiceApi, paymentApi, publicApi, reservationApi, checkinOverrideApi } from '@/api'
import { saveBlob } from '@/utils/download'
import { collectAllRows } from '@/utils/export'
import SearchableSelect from '@/components/SearchableSelect.vue'
import CountryCitySelect from '@/components/CountryCitySelect.vue'
import PaymentMethodSelect from '@/components/PaymentMethodSelect.vue'
import PhoneInput from '@/components/PhoneInput.vue'
import StayDates from '@/components/StayDates.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import { useRoomBrowser } from '@/composables/useRoomBrowser'
import { addDays, todayISO } from '@/utils/dates'
import { normalizePhoneNumber } from '@/utils/phone'
import { METHOD_CASH, PAYMENT_METHODS, requiresProvider, providersFor } from '@/utils/payments'
import { findCountryCode, getCountryName } from '@/utils/locations'

const { t } = useI18n()
const authStore = useAuthStore()
const canOperate = computed(() => authStore.canOperate)

// Booking and room type vocabularies shared by the filters and the form.
const BOOKING_TYPES = ['single', 'couple', 'family', 'group']
const ROOM_TYPES = ['single', 'double', 'suite', 'deluxe', 'presidential']

/** Guests implied by each booking type, mirroring the backend defaults. */
const BOOKING_TYPE_GUESTS = { single: 1, couple: 2, family: 3, group: 4 }

const bookingTypeOptions = computed(() =>
  BOOKING_TYPES.map((type) => ({ value: type, label: t(`common.bookingTypes.${type}`) })),
)

const roomTypeOptions = computed(() =>
  ROOM_TYPES.map((type) => ({ value: type, label: t(`common.roomTypes.${type}`) })),
)

const reservationStatusOptions = computed(() => [
  { value: 'pending', label: t('reservations.statusPending') },
  { value: 'confirmed', label: t('reservations.statusConfirmed') },
  { value: 'checked_in', label: t('reservations.statusCheckedIn') },
  { value: 'checked_out', label: t('reservations.statusCheckedOut') },
  { value: 'cancelled', label: t('reservations.statusCancelled') },
  { value: 'no_show', label: t('reservations.statusNoShow') },
])

const idTypeOptions = computed(() => [
  { value: 'passport', label: t('common.idTypes.passport') },
  { value: 'national_id', label: t('common.idTypes.nationalId') },
  { value: 'driving_license', label: t('common.idTypes.drivingLicense') },
])

const bookingSourceOptions = computed(() => [
  { value: 'walk_in', label: t('reservations.sourceWalkIn') },
  { value: 'phone', label: t('reservations.sourcePhone') },
  { value: 'email', label: t('reservations.sourceEmail') },
  { value: 'website', label: t('reservations.sourceWebsite') },
  { value: 'agent', label: t('reservations.sourceAgent') },
  { value: 'ota', label: t('reservations.sourceOta') },
])

// List state: reservation rows, guest lookup pool, tab, pagination and filters.
const reservations = ref([])
const guests = ref([])
const guestSearching = ref(false)
const recognizedGuest = ref(null)
const tab = ref('active')
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 15,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({ status: '', booking_type: '', from: '', to: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

// Create-modal state: the form itself, availability search and feedback flags.
const showModal = ref(false)
const saving = ref(false)
const modalError = ref('')
const availability = ref(null)
const checking = ref(false)

/** A fresh, empty booking form. */
function blankForm() {
  return {
    guest_id: '',
    first_name: '',
    last_name: '',
    guest_phone: '',
    guest_email: '',
    country: '',
    country_code: '',
    city: '',
    id_type: '',
    id_number: '',
    booking_type: 'single',
    booking_date: todayISO(),
    room_type: '',
    selected_rooms: [],
    booking_source: 'walk_in',
    check_in_date: todayISO(),
    check_out_date: addDays(todayISO(), 1),
    num_days: 1,
    num_adults: 1,
    num_children: 0,
    total_amount: null,
    special_requests: '',
    // Payment taken at the desk alongside the booking.
    amount_paid: 0,
    payment_method: METHOD_CASH,
    payment_provider: '',
    transaction_reference: '',
  }
}

const form = reactive(blankForm())
const computedTotal = ref(null)

const selectedRooms = computed(() => form.selected_rooms)

// Search/sort/paginate the available rooms client-side; selections live in
// form.selected_rooms (keyed by room_id) so they survive paging/sorting.
const roomsSource = computed(() => availability.value?.available_rooms || [])
const {
  query,
  sortKey,
  sortDir,
  page: roomPage,
  pageCount,
  pagedRooms,
  filteredCount,
  rangeFrom,
  rangeTo,
} = useRoomBrowser(roomsSource, { searchRoomsByNumber: true })

// Options for the room-sort dropdown.
const sortOptions = computed(() => [
  { value: 'price_per_night', label: t('bookingPage.sortPrice') },
  { value: 'room_number', label: t('bookingPage.sortRoomNumber') },
  { value: 'max_occupancy', label: t('bookingPage.sortCapacity') },
  { value: 'floor', label: t('bookingPage.sortFloor') },
])

/**
 * Returns true when the given room id is currently in the form's selection.
 * @param {string} roomId - The room id to look up.
 * @returns {boolean} Whether the room is selected.
 */
function isRoomSelected(roomId) {
  return form.selected_rooms.some((room) => room.room_id === roomId)
}

/**
 * Adds or removes a room from the form's selection and refreshes the total.
 * @param {Object} room - The availability room card that was clicked.
 */
function toggleRoom(room) {
  const index = form.selected_rooms.findIndex((room) => room.room_id === room.room_id)
  if (index >= 0) {
    form.selected_rooms.splice(index, 1)
  } else {
    form.selected_rooms.push({
      room_id: room.room_id,
      room_number: room.room_number,
      room_type: room.room_type,
      floor: room.floor,
      price_per_night: Number(room.price_per_night),
      max_occupancy: room.max_occupancy,
    })
  }
  computeTotal()
}

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
 * @returns {string} The date part, or an em dash when absent.
 */
function formatDate(value) {
  return value ? String(value).slice(0, 10) : '—'
}

/**
 * Formats a timestamp as a short localized date-time string.
 * @param {string} value - The ISO date-time string.
 * @returns {string} The formatted value, or an em dash when absent.
 */
function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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

/** Fetches the current page of reservations for the active tab and filters. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await reservationApi.index({
      status:
        filters.status ||
        (tab.value === 'cancelled'
          ? 'cancelled'
          : tab.value === 'checked_out'
            ? 'checked_out'
            : undefined),
      exclude_status: tab.value === 'active' ? ['checked_out', 'cancelled', 'no_show'] : undefined,
      booking_type: filters.booking_type,
      from: filters.from,
      to: filters.to,
      search: filters.search,
      page: page.value,
      per_page: 15,
    })
    reservations.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('reservations.loadError')
  } finally {
    loading.value = false
  }
}

/** Fetches every reservation page for export, honouring the active tab and filters. */
const loadAllReservations = () =>
  collectAllRows((page, perPage) =>
    reservationApi.index({
      status:
        filters.status ||
        (tab.value === 'cancelled'
          ? 'cancelled'
          : tab.value === 'checked_out'
            ? 'checked_out'
            : undefined),
      exclude_status: tab.value === 'active' ? ['checked_out', 'cancelled', 'no_show'] : undefined,
      booking_type: filters.booking_type,
      from: filters.from,
      to: filters.to,
      search: filters.search,
      page,
      per_page: perPage,
    }),
  )

/** Active (default) hides checked-out stays; the checked-out tab is for records. */
function switchTab(next) {
  if (tab.value === next) return
  tab.value = next
  page.value = 1
  filters.status = ''
  load()
}

/** Pre-loads the guest pool used by the guest picker (non-critical on failure). */
async function loadOptions() {
  try {
    const guestRes = await guestApi.index({ per_page: 100 })
    guests.value = guestRes.data.data || []
  } catch {
    // Dropdown data is non-critical; the form still works without it.
  }
}

const guestOptions = computed(() =>
  guests.value.map((guest) => ({
    value: guest.guest_id,
    label:
      guest.full_name +
      (guest.phone ? ` · ${guest.phone}` : '') +
      (guest.hotel_name ? ` · ${guest.hotel_name}` : ''),
  })),
)

// Debounced so typing a name does not fire a request per keystroke.
let guestSearchTimer
/**
 * Searches guests across every hotel as the receptionist types in the picker.
 * @param {string} query - The search text; empty restores the default pool.
 */
function searchGuests(query) {
  clearTimeout(guestSearchTimer)
  const q = String(query || '').trim()
  if (!q) {
    loadOptions()
    return
  }
  guestSearchTimer = setTimeout(async () => {
    guestSearching.value = true
    try {
      // Search across every hotel so a returning guest is found anywhere.
      const res = await guestApi.lookup(q)
      guests.value = res.data.guests || []
    } catch {
      try {
        const res = await guestApi.index({ search: q, per_page: 50 })
        guests.value = res.data.data || []
      } catch {
        // Keep the current list if the search fails.
      }
    } finally {
      guestSearching.value = false
    }
  }, 350)
}

/**
 * When the receptionist keys in a phone number, recognises a returning guest
 * from any hotel and pre-fills their saved details so the form is skipped and
 * the booking can start straight away.
 */
async function recognizeGuest() {
  const digits = String(form.guest_phone || '').replace(/\D/g, '')
  if (digits.length < 9) {
    recognizedGuest.value = null
    return
  }

  const phone = normalizePhoneNumber(form.guest_phone, form.country_code || 'TZ')
  try {
    const res = await guestApi.lookup(phone || digits)
    const matches = res.data.guests || []
    if (matches.length === 1) {
      recognizedGuest.value = matches[0]
      fillGuestFromMatch(matches[0])
    } else {
      recognizedGuest.value = null
    }
  } catch {
    recognizedGuest.value = null
  }
}

/**
 * Pre-fills the form from a recognised guest (found by phone lookup).
 * @param {Object} guest - The matched guest record.
 */
function fillGuestFromMatch(guest) {
  form.guest_id = guest.guest_id
  form.first_name = guest.first_name || ''
  form.last_name = guest.last_name || ''
  form.guest_phone = guest.phone || ''
  form.guest_email = guest.email || ''
  form.country_code = guest.country_code || 'TZ'
  form.city = guest.city || ''
  if (guest.country_code || guest.city) {
    form.country = getCountryName(guest.country_code) || ''
  }
}

// Debounced so typing a phone number does not fire a request per keystroke.
let phoneWatchTimer
watch(
  () => [form.guest_phone, form.country_code],
  () => {
    clearTimeout(phoneWatchTimer)
    phoneWatchTimer = setTimeout(recognizeGuest, 500)
  },
)

// A reference only means something for bank and mobile money; drop it if the
// receptionist switches the method to cash.
watch(
  () => form.payment_method,
  (method) => {
    if (method === METHOD_CASH) form.transaction_reference = ''
  },
)

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

/** Resets all filters and reloads from the first page. */
function clearFilters() {
  page.value = 1
  filters.status = ''
  filters.booking_type = ''
  filters.from = ''
  filters.to = ''
  filters.search = ''
  load()
}

/** Opens the create modal with a blank form and refreshed guest options. */
function openCreate() {
  modalError.value = ''
  computedTotal.value = null
  availability.value = null
  recognizedGuest.value = null
  loadOptions()
  Object.assign(form, blankForm())
  showModal.value = true
}

/** Closes the create modal and clears any recognised-guest hint. */
function closeModal() {
  showModal.value = false
  recognizedGuest.value = null
}

/** Copies the selected guest profile into the form. */
function fillGuest() {
  const guest = guests.value.find((guest) => guest.guest_id === form.guest_id)
  if (!guest) return

  recognizedGuest.value = null
  form.first_name = guest.first_name || ''
  form.last_name = guest.last_name || ''
  form.guest_phone = guest.phone || ''
  form.guest_email = guest.email || ''
  form.country = guest.country || ''
  form.country_code = guest.country_code || findCountryCode(guest.country)
  form.city = guest.city || ''
  form.id_type = guest.id_type || ''
  form.id_number = guest.id_number || ''
}

/** Pre-fills the guest count from the booking type. */
function applyBookingType() {
  form.num_adults = BOOKING_TYPE_GUESTS[form.booking_type] || 1
}

/** Suggests a total from the nightly rates and the length of stay. */
function computeTotal() {
  const nights = Number(form.num_days)

  if (!form.selected_rooms.length || !nights || nights < 1) {
    computedTotal.value = null
    return
  }

  computedTotal.value = form.selected_rooms.reduce(
    (sum, room) => sum + Math.round(nights * room.price_per_night),
    0,
  )
  form.total_amount = computedTotal.value
}

/** Mirrors the online flow: look up rooms free for these dates. */
async function checkAvailability() {
  modalError.value = ''
  if (!form.check_in_date || !form.check_out_date) {
    modalError.value = t('reservations.setDatesFirst')
    return
  }
  const hotelId = authStore.user?.tenant_id
  if (!hotelId) {
    modalError.value = t('reservations.availabilityError')
    return
  }

  checking.value = true
  availability.value = null
  form.selected_rooms = []
  try {
    const res = await publicApi.availability({
      hotel_id: hotelId,
      check_in: form.check_in_date,
      check_out: form.check_out_date,
      room_type: form.room_type || undefined,
      booking_type: form.booking_type,
    })
    availability.value = res.data
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    checking.value = false
  }
}

// StayDates can change the length of stay without touching the room picker, so
// the suggested total is recalculated whenever either input moves.
watch(
  () => [form.selected_rooms.map((room) => room.room_id).join(','), form.num_days],
  computeTotal,
)

// Keep the shown availability in step with the search inputs, like online.
watch(
  () => [form.check_in_date, form.check_out_date, form.booking_type, form.room_type],
  () => {
    if (availability.value) checkAvailability()
  },
)

/**
 * Creates one reservation per selected room, spreading any deposit paid at the
 * desk evenly across them (the remainder lands on the last room).
 */
async function save() {
  modalError.value = ''

  if (requiresProvider(form.payment_method) && form.amount_paid > 0 && !form.payment_provider) {
    modalError.value = t('paymentFields.selectProvider')
    return
  }

  const roomsToBook = form.selected_rooms
  if (!roomsToBook.length) {
    modalError.value = t('reservations.selectAtLeastOneRoom')
    return
  }

  saving.value = true
  const nights = Number(form.num_days)
  // A deposit taken at the desk is spread evenly across the booked rooms.
  const perRoomPay =
    roomsToBook.length > 1 && form.amount_paid > 0
      ? Math.floor(form.amount_paid / roomsToBook.length)
      : form.amount_paid

  try {
    let lastMessage = ''
    for (let i = 0; i < roomsToBook.length; i++) {
      const room = roomsToBook[i]
      const res = await reservationApi.store({
        room_id: room.room_id,
        room_type: room.room_type || undefined,
        guest_id: form.guest_id || undefined,
        first_name: form.first_name,
        last_name: form.last_name,
        guest_phone: normalizePhoneNumber(form.guest_phone, form.country_code || 'TZ'),
        guest_email: form.guest_email || undefined,
        country: form.country || undefined,
        country_code: form.country_code || undefined,
        city: form.city || undefined,
        booking_type: form.booking_type,
        booking_date: form.booking_date || undefined,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date || undefined,
        num_days: form.num_days || undefined,
        num_adults: form.num_adults,
        num_children: form.num_children,
        total_amount: nights > 0 ? Math.round(nights * room.price_per_night) : undefined,
        booking_source: form.booking_source,
        special_requests: form.special_requests || undefined,
        id_type: form.id_type || undefined,
        id_number: form.id_number || undefined,
      })
      lastMessage = res.data.message || ''
      const reservation = res.data.reservation

      if (form.amount_paid > 0) {
        const amount =
          i === roomsToBook.length - 1
            ? form.amount_paid - perRoomPay * (roomsToBook.length - 1)
            : perRoomPay
        if (amount > 0) await recordPayment(reservation, amount)
      }
    }

    success.value =
      roomsToBook.length > 1
        ? t('reservations.createSuccessMany')
        : lastMessage || t('reservations.createSuccess')

    showModal.value = false
    await Promise.all([load(), loadOptions()])
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/**
 * Records the deposit taken with the booking. A failure here must not hide the
 * fact that the booking itself was saved, so it is reported separately.
 */
async function recordPayment(reservation, amount) {
  try {
    const res = await paymentApi.store({
      reservation_id: reservation.reservation_id,
      guest_id: reservation.guest_id || undefined,
      amount,
      payment_method: form.payment_method,
      payment_provider: form.payment_provider || undefined,
      transaction_reference: form.transaction_reference || undefined,
      paid_by: normalizePhoneNumber(form.guest_phone, form.country_code || 'TZ') || undefined,
    })
    success.value = `${success.value} ${res.data.message || t('reservations.paymentRecorded')}`
  } catch (err) {
    error.value = t('reservations.paymentFailed', { error: flattenError(err) })
  }
}

const showDetail = ref(false)
const detail = ref(null)
const invoiceLoading = ref(false)

/** Generates (or refreshes) the folio invoice for the open reservation and downloads the PDF. */
async function downloadInvoice() {
  if (!detail.value) return
  invoiceLoading.value = true
  error.value = ''
  success.value = ''
  try {
    const gen = await invoiceApi.generate(detail.value.reservation_id)
    const invoice = gen.data.invoice
    const res = await invoiceApi.download(invoice.invoice_id)
    saveBlob(res.data, `${invoice.invoice_number}.pdf`)
    success.value = t('invoices.downloaded', { number: invoice.invoice_number })
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    invoiceLoading.value = false
  }
}

// ── Check-in modal state ──────────────────────────────────────────────────
const showCheckin = ref(false)
const checkinTarget = ref(null)
const checkingIn = ref(false)
const checkinOverride = ref(false)
const checkinOverrideReason = ref('')
const activeOverride = ref(null)
const activeOverrideCountdown = ref('')

/** Outstanding balance for the check-in target (total - advance_payment). */
const checkinBalanceDue = computed(() => {
  const t = checkinTarget.value
  if (!t) return 0
  return Math.max(0, Number(t.total_amount || 0) - Number(t.advance_payment || 0))
})

/** Whether the check-in target has an active manager override. */
const hasActiveOverride = computed(() => {
  if (!activeOverride.value) return false
  return new Date(activeOverride.value.expires_at).getTime() > Date.now()
})

/** Opens the check-in modal, pre-filling payment info and fetching any active override. */
async function openCheckin(reservation) {
  checkinTarget.value = reservation
  checkinOverride.value = false
  checkinOverrideReason.value = ''
  checkingIn.value = false
  activeOverride.value = null
  activeOverrideCountdown.value = ''
  showCheckin.value = true

  // Fetch active overrides to check if one already exists for this reservation.
  try {
    const res = await checkinOverrideApi.active()
    const overrides = res.data.data || []
    activeOverride.value = overrides.find((o) => {
      const matchId = o.reservation_id && o.reservation_id === reservation.reservation_id
      const matchName = o.guest_name === reservation.guest_name
      return (matchId || matchName) && new Date(o.expires_at).getTime() > Date.now()
    }) || null
    if (activeOverride.value) updateOverrideCountdown()
  } catch {
    // Non-critical; proceed without override data.
  }
}

/** Updates the countdown string for the active override. */
function updateOverrideCountdown() {
  if (!activeOverride.value) return
  const diff = Math.max(0, new Date(activeOverride.value.expires_at).getTime() - Date.now())
  if (diff <= 0) {
    activeOverrideCountdown.value = t('overrides.expiredLabel')
    activeOverride.value = null
    return
  }
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  if (hours > 0) activeOverrideCountdown.value = `${hours}h ${minutes}m ${seconds}s`
  else if (minutes > 0) activeOverrideCountdown.value = `${minutes}m ${seconds}s`
  else activeOverrideCountdown.value = `${seconds}s`
}

let overrideCountdownInterval = null
watch(showCheckin, (open) => {
  if (open && activeOverride.value) {
    overrideCountdownInterval = setInterval(updateOverrideCountdown, 1000)
  } else if (overrideCountdownInterval) {
    clearInterval(overrideCountdownInterval)
    overrideCountdownInterval = null
  }
})

/** Closes the check-in modal. */
function closeCheckin() {
  showCheckin.value = false
  checkinTarget.value = null
  checkinOverride.value = false
  checkinOverrideReason.value = ''
  activeOverride.value = null
  activeOverrideCountdown.value = ''
  if (overrideCountdownInterval) {
    clearInterval(overrideCountdownInterval)
    overrideCountdownInterval = null
  }
}

/** Executes the check-in, passing override when the balance is unpaid. */
async function confirmCheckin() {
  const target = checkinTarget.value
  if (!target) return
  checkingIn.value = true
  error.value = ''
  try {
    const payload = {}
    // Send override when there is an active pre-approved override or the manager manually checks it.
    const unpaid = checkinBalanceDue.value > 0
    const activeOverrideValid = unpaid && hasActiveOverride.value
    const manualOverride = unpaid && checkinOverride.value && authStore.roleLevel >= 80
    if (activeOverrideValid || manualOverride) {
      payload.override = true
      payload.override_id = activeOverrideValid ? activeOverride.value.id : undefined
      payload.override_reason = activeOverrideValid
        ? activeOverride.value.notes
        : checkinOverrideReason.value
    }
    const res = await reservationApi.checkIn(target.reservation_id, payload)
    success.value = res.data.message || t('reservations.checkedIn')
    closeCheckin()
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    checkingIn.value = false
  }
}

// ── Checkout modal state ──────────────────────────────────────────────────
const showCheckout = ref(false)
const checkoutTarget = ref(null)
const checkoutReason = ref('')
const checkingOut = ref(false)
const checkoutMethod = ref(METHOD_CASH)
const checkoutAmount = ref(0)
const checkoutProvider = ref('')
const checkoutNotes = ref('')

/** How much the guest still owes on the room account at checkout. */
const checkoutBalance = computed(() => Math.max(0, Number(checkoutTarget.value?.balance_due || 0)))

const checkoutMethodOptions = PAYMENT_METHODS.map((method) => ({
  value: method,
  label: t(`paymentFields.methods.${method}`),
}))

const checkoutProviderOptions = computed(() =>
  providersFor(checkoutMethod.value).map((provider) => ({
    value: provider,
    label: t(`paymentFields.providers.${provider}`),
  })),
)

const checkoutNeedsProvider = computed(() => requiresProvider(checkoutMethod.value))

/** Check-out before the scheduled departure date is an early departure. */
const isEarlyCheckout = computed(() => {
  const target = checkoutTarget.value
  if (!target || !target.check_out_date) return false
  return formatDate(target.check_out_date) > todayISO()
})

/**
 * Opens the read-only detail modal for a reservation.
 * @param {Object} reservation - The reservation row to inspect.
 */
function openDetail(reservation) {
  detail.value = reservation
  showDetail.value = true
}

/**
 * Opens the check-out modal, pre-filling the settlement amount with the balance due.
 * @param {Object} reservation - The reservation being checked out.
 */
function openCheckout(reservation) {
  checkoutTarget.value = reservation
  // The receptionist supplies the reason; there is no default.
  checkoutReason.value = ''
  checkoutMethod.value = METHOD_CASH
  checkoutAmount.value = Math.max(0, Number(reservation.balance_due || 0))
  checkoutProvider.value = ''
  checkoutNotes.value = ''
  showCheckout.value = true
}

/** Closes the check-out modal and clears its target. */
function closeCheckout() {
  showCheckout.value = false
  checkoutTarget.value = null
}

/** Checks the guest out, attaching a settlement payment when a balance is due. */
async function confirmCheckout() {
  const target = checkoutTarget.value
  if (!target) return
  if (
    checkoutBalance.value > 0 &&
    requiresProvider(checkoutMethod.value) &&
    !checkoutProvider.value
  ) {
    error.value = t('paymentFields.selectProvider')
    return
  }
  error.value = ''
  checkingOut.value = true
  try {
    const payload = { reason: checkoutReason.value }
    if (checkoutBalance.value > 0) {
      payload.settlement = {
        method: checkoutMethod.value,
        amount: checkoutAmount.value || checkoutBalance.value,
        ...(checkoutProvider.value ? { payment_provider: checkoutProvider.value } : {}),
        ...(checkoutNotes.value ? { notes: checkoutNotes.value } : {}),
      }
    }
    const res = await reservationApi.checkOut(target.reservation_id, payload)
    success.value = res.data.message || t('reservations.checkedOut')
    closeCheckout()
    showDetail.value = false
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    checkingOut.value = false
  }
}

/**
 * Runs a reservation lifecycle action with an optional confirmation, then reloads.
 * @param {Object} reservation - The reservation to act on.
 * @param {Function} action - The reservationApi action (checkIn, cancel, noShow).
 * @param {string} message - Fallback success message.
 * @param {string} [confirmMessage] - When set, the action requires confirmation first.
 */
async function runAction(reservation, action, message, confirmMessage) {
  if (confirmMessage && !window.confirm(confirmMessage)) return
  error.value = ''
  try {
    const res = await action(reservation.reservation_id)
    success.value = res.data.message || message
    showDetail.value = false
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

// Per-row lifecycle actions, all funnelled through the shared runAction helper.
const cancel = (reservation) =>
  runAction(
    reservation,
    reservationApi.cancel,
    t('reservations.cancelled'),
    t('reservations.confirmCancel', { name: reservation.guest_name }),
  )
const noShow = (reservation) =>
  runAction(
    reservation,
    reservationApi.noShow,
    t('reservations.markedNoShow'),
    t('reservations.confirmNoShow', { name: reservation.guest_name }),
  )

const showDelete = ref(false)
const deleteTarget = ref(null)
const deleteName = ref('')
const deleting = ref(false)
const deletePreview = ref(null)
const loadingDeletePreview = ref(false)

/** The guest name must be typed in caps; the match itself is case-insensitive. */
const deleteNameMatches = computed(() => {
  const target = deleteTarget.value
  if (!target) return false
  const expected = String(target.guest_name || '')
    .trim()
    .toUpperCase()
  return expected.length > 0 && deleteName.value.trim().toUpperCase() === expected
})

/**
 * Opens the permanent-delete modal for a checked-out or cancelled reservation
 * and fetches the deletion preview (counts of payments, orders, laundry).
 * @param {Object} reservation - The reservation to delete.
 */
async function openDelete(reservation) {
  deleteTarget.value = reservation
  deleteName.value = ''
  deletePreview.value = null
  loadingDeletePreview.value = true
  showDelete.value = true
  try {
    const res = await reservationApi.deletionPreview(reservation.reservation_id)
    deletePreview.value = res.data.preview
  } catch {
    deletePreview.value = null
  } finally {
    loadingDeletePreview.value = false
  }
}

/** Closes the delete modal and clears the typed confirmation name. */
function closeDelete() {
  showDelete.value = false
  deleteTarget.value = null
  deleteName.value = ''
  deletePreview.value = null
}

/** Permanently deletes the reservation once the typed guest name matches. */
async function confirmDelete() {
  const target = deleteTarget.value
  if (!target || !deleteNameMatches.value) return
  deleting.value = true
  error.value = ''
  try {
    const res = await reservationApi.destroy(target.reservation_id, {
      confirmed_name: deleteName.value.trim(),
    })
    success.value = res.data.message || t('reservations.deleted')
    closeDelete()
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    deleting.value = false
  }
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
