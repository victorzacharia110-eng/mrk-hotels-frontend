<!--
  HotelDashboard.vue
  Reception "Stay View" landing page (route /app/dashboard).
  Renders a tape-chart grid of rooms (grouped by room type) against a
  14-day window (starting 3 days before today), with color-coded booking
  bars (green = confirmed/paid, red = payment pending, blue = checked
  out), per-day availability/rate rows,
  status summary pills and a per-day availability/occupancy footer.
  Data comes from the existing rooms and reservations APIs; the schema
  is unchanged. Operational alerts still surface via the alert modal.
-->

<template>
  <div class="stayview-page">
    <!-- Full-page spinner shown until the first payload arrives -->
    <div v-if="loading && !loaded" class="loading-spinner">
      <div class="spinner"></div>
    </div>

    <template v-else>
      <!-- Toolbar: room/reservation status pills, search and assign-room shortcut -->
      <div class="sv-toolbar">
        <!-- Signed-in session chip: avatar initial + name + role badge -->
        <div class="session-chip">
          <span class="session-avatar">{{ sessionInitial }}</span>
          <span class="session-meta">
            <span class="session-name">{{ authStore.user?.name }}</span>
            <RoleBadge />
          </span>
        </div>
        <div class="sv-pills">
          <span v-for="pill in pills" :key="pill.key" class="sv-pill" :class="pill.key">
            {{ pill.label }} <strong>{{ pill.count }}</strong>
          </span>
        </div>
        <div class="sv-toolbar-right">
          <div class="sv-search">
            <i class="fas fa-search" aria-hidden="true"></i>
            <input v-model="search" type="text" :placeholder="$t('stayview.searchPlaceholder')" />
          </div>
          <button v-if="canSeeFrontDesk" type="button" class="btn btn-primary sv-assign" @click="openNewBooking">
            <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('stayview.newBooking') }}
          </button>
          <button v-if="canSeeFrontDesk" type="button" class="btn sv-tool-btn" @click="openGuestModal">
            <i class="fas fa-user-plus" aria-hidden="true"></i> {{ $t('stayview.guests') }}
          </button>
          <button v-if="canSeeHousekeeping" type="button" class="btn sv-tool-btn" @click="openTasksModal">
            <i class="fas fa-broom" aria-hidden="true"></i> {{ $t('stayview.housekeeping') }}
          </button>
          <button v-if="canSeeLedger" type="button" class="btn sv-tool-btn" @click="openLedgerModal">
            <i class="fas fa-chart-line" aria-hidden="true"></i> {{ $t('stayview.stockLedger') }}
          </button>
        </div>
      </div>

      <!-- Inline error banner for failed loads/refreshes -->
      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <!-- Tape chart -->
      <div v-if="groups.length" class="sv-chart">
        <div class="sv-grid" :style="gridStyle">
          <!-- Header: window navigation + day columns -->
          <div class="sv-corner">
            <button type="button" class="sv-nav-btn" :aria-label="$t('stayview.previous')" @click="shift(-7)">
              <i class="fas fa-chevron-left" aria-hidden="true"></i>
            </button>
            <button type="button" class="sv-today-btn" @click="goToday">{{ $t('stayview.today') }}</button>
            <button type="button" class="sv-nav-btn" :aria-label="$t('stayview.next')" @click="shift(7)">
              <i class="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
          <div
            v-for="d in days"
            :key="d.iso"
            class="sv-day-head"
            :class="{ today: d.isToday, weekend: d.isWeekend }"
          >
            <span class="dow">{{ d.dow }}</span>
            <span class="dom">{{ d.label }}</span>
          </div>

          <template v-for="group in groups" :key="group.type">
            <!-- Rate/availability row for the room type -->
            <div class="sv-type-cell">{{ roomTypeLabel(group.type) }}</div>
            <div
              v-for="d in days"
              :key="d.iso"
              class="sv-rate-cell"
              :class="{ today: d.isToday, weekend: d.isWeekend }"
            >
              <span class="sv-avail-pill" :class="{ zero: group.availability[d.iso] === 0 }">
                {{ group.availability[d.iso] }}
              </span>
              <span class="sv-price">{{ formatPrice(group.price) }}</span>
            </div>

            <!-- One row per physical room, with booking bars spanning its stay dates -->
            <template v-for="room in group.rooms" :key="room.room_id">
              <div
                class="sv-room-cell"
                role="button"
                tabindex="0"
                :title="$t('stayview.roomDetails')"
                @click="openRoomModal(room)"
                @keyup.enter="openRoomModal(room)"
              >
                <span class="sv-room-dot" :class="room.status" :title="room.status"></span>
                <span class="sv-room-number">{{ room.room_number }}</span>
                <i
                  v-if="room.status === 'dirty' || room.status === 'cleaning'"
                  class="fas fa-broom sv-room-flag"
                  :title="room.status"
                  aria-hidden="true"
                ></i>
                <i
                  v-if="room.status === 'maintenance'"
                  class="fas fa-screwdriver-wrench sv-room-flag"
                  :title="room.status"
                  aria-hidden="true"
                ></i>
              </div>
              <div class="sv-room-track">
                <div
                  v-for="d in days"
                  :key="d.iso"
                  class="sv-cell-bg"
                  :class="{ today: d.isToday, weekend: d.isWeekend }"
                ></div>
                <div
                  v-for="bar in barsByRoom[room.room_id] || []"
                  :key="bar.id"
                  class="sv-bar"
                  :class="bar.colorClass"
                  :style="{ gridColumn: `${bar.start} / span ${bar.span}`, animationDelay: `${bar.start * 30}ms` }"
                  role="button"
                  tabindex="0"
                  @click="openBarModal(bar)"
                  @keyup.enter="openBarModal(bar)"
                  @mouseenter="showBarTip($event, bar)"
                  @mousemove="moveBarTip"
                  @mouseleave="hideBarTip"
                >
                  <i class="fas fa-hotel" aria-hidden="true"></i>
                  <span class="sv-bar-label">{{ bar.label }}</span>
                </div>
              </div>
            </template>
          </template>

          <!-- Footer: per-day availability counts (sticky at the bottom) -->
          <div class="sv-footer-cell sv-sticky-avail">{{ $t('stayview.availability') }}</div>
          <div
            v-for="d in days"
            :key="d.iso"
            class="sv-footer-day sv-sticky-avail"
            :class="{ today: d.isToday, weekend: d.isWeekend }"
          >
            <strong>{{ footer[d.iso].available }}</strong>
          </div>

          <!-- Footer: per-day occupancy percentage bars (sticky at the bottom) -->
          <div class="sv-footer-cell sv-sticky-occ">{{ $t('stayview.occupancy') }}</div>
          <div
            v-for="d in days"
            :key="d.iso"
            class="sv-footer-day sv-sticky-occ"
            :class="{ today: d.isToday, weekend: d.isWeekend }"
          >
            <div class="sv-occ">
              <div class="sv-occ-bar"><span :style="{ width: footer[d.iso].occupancy + '%' }"></span></div>
              <strong>{{ footer[d.iso].occupancy }}%</strong>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="card sv-empty">{{ $t('stayview.noRooms') }}</div>
    </template>

    <!-- Hover popover for booking bars (guest, stay status, payment status) -->
    <div
      v-if="barTip"
      class="sv-popover"
      :style="{ left: barTip.x + 'px', top: barTip.y + 'px' }"
      role="tooltip"
    >
      <div class="sv-popover-head">
        <span class="sv-popover-icon"><i class="fas fa-hotel" aria-hidden="true"></i></span>
        <div>
          <div class="sv-popover-name">{{ barTip.label }}</div>
          <span class="sv-popover-badge" :class="barTip.colorClass">{{ barTip.statusLabel }}</span>
        </div>
      </div>
      <div class="sv-popover-row">
        <i class="fas fa-calendar-days" aria-hidden="true"></i>
        <span>{{ barTip.dates }} · {{ barTip.nights }} {{ $t('stayview.nights') }}</span>
      </div>
      <div class="sv-popover-row">
        <i class="fas fa-bed" aria-hidden="true"></i>
        <span>{{ $t('stayview.room') }} {{ barTip.roomNumber }}</span>
      </div>
      <div class="sv-popover-row" :class="barTip.paymentPending ? 'pay-pending' : 'pay-ok'">
        <i class="fas fa-dollar-sign" aria-hidden="true"></i>
        <span>
          {{ barTip.paymentPending ? $t('stayview.paymentPending') : $t('stayview.paymentPaid') }}
          <strong v-if="barTip.paymentPending"> · TZS {{ barTip.balance }}</strong>
        </span>
      </div>
    </div>

    <!-- Click modal: full reservation summary for the selected bar -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="activeBar" class="sv-modal-backdrop" @click.self="closeBarModal">
          <div class="sv-modal" role="dialog" aria-modal="true" :aria-label="activeBar.label">
            <div class="sv-modal-head" :class="activeBar.colorClass">
              <span class="sv-modal-head-icon"><i class="fas fa-hotel" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ activeBar.label }}</h3>
                <span class="sv-modal-status">{{ activeBar.statusLabel }}</span>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="closeBarModal">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <!-- Stay details -->
              <div class="sv-modal-section">{{ $t('stayview.stayDetails') }}</div>
              <div class="sv-modal-row">
                <i class="fas fa-hashtag" aria-hidden="true"></i>
                <span>{{ $t('stayview.reference') }}: <strong>{{ activeBar.reference }}</strong></span>
              </div>
              <div class="sv-modal-row">
                <i class="fas fa-calendar-days" aria-hidden="true"></i>
                <span>{{ activeBar.dates }} · {{ activeBar.nights }} {{ $t('stayview.nights') }}</span>
              </div>
              <div class="sv-modal-row">
                <i class="fas fa-bed" aria-hidden="true"></i>
                <span>{{ $t('stayview.room') }} {{ activeBar.roomNumber }} · {{ activeBar.roomType }}</span>
              </div>
              <div class="sv-modal-row">
                <i class="fas fa-users" aria-hidden="true"></i>
                <span>{{ activeBar.guests }}</span>
              </div>
              <div class="sv-modal-row">
                <i class="fas fa-globe" aria-hidden="true"></i>
                <span class="sv-cap">{{ $t('stayview.source') }}: {{ activeBar.source }}</span>
              </div>
              <div v-if="activeBar.checkedInAt" class="sv-modal-row">
                <i class="fas fa-right-to-bracket" aria-hidden="true"></i>
                <span>{{ $t('stayview.checkedInAt') }}: {{ activeBar.checkedInAt }}</span>
              </div>
              <div v-if="activeBar.checkedOutAt" class="sv-modal-row">
                <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
                <span>{{ $t('stayview.checkedOutAt') }}: {{ activeBar.checkedOutAt }}</span>
              </div>

              <!-- Client contact details -->
              <div class="sv-modal-section">{{ $t('stayview.clientDetails') }}</div>
              <div class="sv-modal-row">
                <i class="fas fa-envelope" aria-hidden="true"></i>
                <span>{{ activeBar.email }}</span>
              </div>
              <div class="sv-modal-row">
                <i class="fas fa-phone" aria-hidden="true"></i>
                <span>{{ activeBar.phone }}</span>
              </div>
              <div class="sv-modal-row">
                <i class="fas fa-location-dot" aria-hidden="true"></i>
                <span>{{ activeBar.location }}</span>
              </div>

              <!-- Payment summary -->
              <div class="sv-modal-section">{{ $t('stayview.paymentDetails') }}</div>
              <div class="sv-modal-row">
                <i class="fas fa-receipt" aria-hidden="true"></i>
                <span>{{ $t('stayview.total') }}: <strong>TZS {{ activeBar.total }}</strong></span>
              </div>
              <div class="sv-modal-row">
                <i class="fas fa-money-bill-wave" aria-hidden="true"></i>
                <span>{{ $t('stayview.advancePaid') }}: TZS {{ activeBar.advance }}</span>
              </div>
              <div class="sv-modal-row" :class="activeBar.paymentPending ? 'pay-pending' : 'pay-ok'">
                <i class="fas fa-dollar-sign" aria-hidden="true"></i>
                <span>
                  {{ activeBar.paymentPending ? $t('stayview.paymentPending') : $t('stayview.paymentPaid') }}
                  <strong v-if="activeBar.paymentPending"> · TZS {{ activeBar.balance }}</strong>
                </span>
              </div>

              <!-- Requests & notes -->
              <template v-if="activeBar.specialRequests || activeBar.notes">
                <div class="sv-modal-section">{{ $t('stayview.requestsNotes') }}</div>
                <div v-if="activeBar.specialRequests" class="sv-modal-row">
                  <i class="fas fa-star" aria-hidden="true"></i>
                  <span>{{ activeBar.specialRequests }}</span>
                </div>
                <div v-if="activeBar.notes" class="sv-modal-row">
                  <i class="fas fa-note-sticky" aria-hidden="true"></i>
                  <span>{{ activeBar.notes }}</span>
                </div>
              </template>
            </div>
            <div v-if="canSeeFrontDesk" class="sv-modal-actions">
              <p v-if="actionError" class="sv-action-error">{{ actionError }}</p>
              <button
                v-if="['pending', 'confirmed'].includes(activeBar.rawStatus)"
                type="button"
                class="btn btn-primary sv-modal-manage"
                :disabled="actionBusy"
                @click="doCheckIn(activeBar)"
              >
                <i class="fas fa-right-to-bracket" aria-hidden="true"></i>
                {{ actionBusy ? $t('common.loading') : $t('stayview.checkIn') }}
              </button>
              <button
                v-if="activeBar.rawStatus === 'checked_in'"
                type="button"
                class="btn btn-primary sv-modal-manage"
                :disabled="actionBusy"
                @click="doCheckOut(activeBar)"
              >
                <i class="fas fa-right-from-bracket" aria-hidden="true"></i>
                {{ actionBusy ? $t('common.loading') : $t('stayview.checkOut') }}
              </button>
              <button
                v-if="['pending', 'confirmed'].includes(activeBar.rawStatus)"
                type="button"
                class="btn sv-modal-danger"
                :disabled="actionBusy"
                @click="doCancel(activeBar)"
              >
                <i class="fas fa-ban" aria-hidden="true"></i> {{ $t('stayview.cancelBooking') }}
              </button>
              <button
                type="button"
                class="btn btn-secondary sv-modal-manage"
                :disabled="invoiceBusy"
                @click="printInvoice(activeBar)"
              >
                <i class="fas fa-print" aria-hidden="true"></i>
                {{ invoiceBusy ? $t('invoices.preparing') : $t('stayview.printInvoice') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- New booking modal: create a reservation without leaving the chart -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="bookingModal" class="sv-modal-backdrop" @click.self="bookingModal = false">
          <div class="sv-modal" role="dialog" aria-modal="true" :aria-label="$t('stayview.newBooking')">
            <div class="sv-modal-head bar-green">
              <span class="sv-modal-head-icon"><i class="fas fa-calendar-plus" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ $t('stayview.newBooking') }}</h3>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="bookingModal = false">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <label class="sv-field">
                <span>{{ $t('stayview.guestName') }}</span>
                <input v-model="bookingForm.guest_name" type="text" class="input" required />
              </label>
              <label class="sv-field">
                <span>{{ $t('stayview.phone') }}</span>
                <input v-model="bookingForm.guest_phone" type="tel" class="input" />
              </label>
              <label class="sv-field">
                <span>{{ $t('stayview.room') }}</span>
                <select v-model="bookingForm.room_id" class="input" required>
                  <option v-for="room in rooms" :key="room.room_id" :value="room.room_id">
                    {{ room.room_number }} · {{ roomTypeLabel(room.room_type) }} · TZS {{ formatPrice(room.price_per_night) }}
                  </option>
                </select>
              </label>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('stayview.arrival') }}</span>
                  <input v-model="bookingForm.check_in_date" type="date" class="input" required />
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.departure') }}</span>
                  <input v-model="bookingForm.check_out_date" type="date" class="input" required />
                </label>
              </div>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('stayview.total') }}</span>
                  <input v-model.number="bookingForm.total_amount" type="number" min="0" class="input" required />
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.advancePaid') }}</span>
                  <input v-model.number="bookingForm.advance_payment" type="number" min="0" class="input" />
                </label>
              </div>
              <p v-if="actionError" class="sv-action-error">{{ actionError }}</p>
            </div>
            <div class="sv-modal-actions">
              <button type="button" class="btn btn-primary sv-modal-manage" :disabled="actionBusy" @click="submitBooking">
                <i class="fas fa-check" aria-hidden="true"></i>
                {{ actionBusy ? $t('common.loading') : $t('stayview.createBooking') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Guest modal: quick guest registration -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="guestModal" class="sv-modal-backdrop" @click.self="guestModal = false">
          <div class="sv-modal" role="dialog" aria-modal="true" :aria-label="$t('stayview.registerGuest')">
            <div class="sv-modal-head bar-blue">
              <span class="sv-modal-head-icon"><i class="fas fa-user-plus" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ $t('stayview.registerGuest') }}</h3>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="guestModal = false">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('stayview.firstName') }}</span>
                  <input v-model="guestForm.first_name" type="text" class="input" required />
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.lastName') }}</span>
                  <input v-model="guestForm.last_name" type="text" class="input" required />
                </label>
              </div>
              <label class="sv-field">
                <span>{{ $t('stayview.phone') }}</span>
                <input v-model="guestForm.phone" type="tel" class="input" required />
              </label>
              <label class="sv-field">
                <span>{{ $t('stayview.email') }}</span>
                <input v-model="guestForm.email" type="email" class="input" />
              </label>
              <p v-if="actionError" class="sv-action-error">{{ actionError }}</p>
            </div>
            <div class="sv-modal-actions">
              <button type="button" class="btn btn-primary sv-modal-manage" :disabled="actionBusy" @click="submitGuest">
                <i class="fas fa-check" aria-hidden="true"></i>
                {{ actionBusy ? $t('common.loading') : $t('stayview.saveGuest') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Housekeeping modal: pending tasks + new task creation -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="tasksModal" class="sv-modal-backdrop" @click.self="tasksModal = false">
          <div class="sv-modal" role="dialog" aria-modal="true" :aria-label="$t('stayview.housekeeping')">
            <div class="sv-modal-head bar-red">
              <span class="sv-modal-head-icon"><i class="fas fa-broom" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ $t('stayview.housekeeping') }}</h3>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="tasksModal = false">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <div class="sv-modal-section">{{ $t('stayview.openTasks') }}</div>
              <p v-if="!tasks.length" class="sv-muted">{{ $t('stayview.noTasks') }}</p>
              <div v-for="task in tasks" :key="task.task_id" class="sv-task-row">
                <span class="sv-task-room">{{ task.room?.room_number || '—' }}</span>
                <span class="sv-task-type sv-cap">{{ (task.task_type || 'cleaning').replace('_', ' ') }}</span>
                <span class="sv-task-status">{{ task.status.replace('_', ' ') }}</span>
              </div>
              <div class="sv-modal-section">{{ $t('stayview.newTask') }}</div>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('stayview.room') }}</span>
                  <select v-model="taskForm.room_id" class="input">
                    <option v-for="room in rooms" :key="room.room_id" :value="room.room_id">
                      {{ room.room_number }}
                    </option>
                  </select>
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.priority') }}</span>
                  <select v-model="taskForm.priority" class="input">
                    <option value="low">{{ $t('stayview.priorityLow') }}</option>
                    <option value="normal">{{ $t('stayview.priorityNormal') }}</option>
                    <option value="high">{{ $t('stayview.priorityHigh') }}</option>
                  </select>
                </label>
              </div>
              <p v-if="actionError" class="sv-action-error">{{ actionError }}</p>
            </div>
            <div class="sv-modal-actions">
              <button type="button" class="btn btn-primary sv-modal-manage" :disabled="actionBusy" @click="submitTask">
                <i class="fas fa-check" aria-hidden="true"></i>
                {{ actionBusy ? $t('common.loading') : $t('stayview.createTask') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Room modal: room details + housekeeping status change -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="roomModal" class="sv-modal-backdrop" @click.self="roomModal = null">
          <div class="sv-modal" role="dialog" aria-modal="true" :aria-label="$t('stayview.roomDetails')">
            <div class="sv-modal-head bar-blue">
              <span class="sv-modal-head-icon"><i class="fas fa-bed" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ $t('stayview.room') }} {{ roomModal.room_number }}</h3>
                <span class="sv-modal-status sv-cap">{{ roomModal.status }}</span>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="roomModal = null">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <div class="sv-modal-row">
                <i class="fas fa-layer-group" aria-hidden="true"></i>
                <span>{{ roomTypeLabel(roomModal.room_type) }} · TZS {{ formatPrice(roomModal.price_per_night) }}</span>
              </div>
              <div class="sv-modal-section">{{ $t('stayview.setStatus') }}</div>
              <div class="sv-status-grid">
                <button
                  v-for="s in roomStatuses"
                  :key="s"
                  type="button"
                  class="sv-status-btn"
                  :class="{ active: roomModal.status === s }"
                  :disabled="actionBusy"
                  @click="setRoomStatus(s)"
                >
                  <span class="sv-room-dot" :class="s" aria-hidden="true"></span>
                  <span class="sv-cap">{{ s }}</span>
                </button>
              </div>
              <p v-if="actionError" class="sv-action-error">{{ actionError }}</p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Stock ledger modal: build and print the ledger report without leaving the chart -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="ledgerModal" class="sv-modal-backdrop" @click.self="ledgerModal = false">
          <div class="sv-modal sv-modal-wide" role="dialog" aria-modal="true" :aria-label="$t('stayview.stockLedger')">
            <div class="sv-modal-head bar-blue">
              <span class="sv-modal-head-icon"><i class="fas fa-chart-line" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ $t('stayview.stockLedger') }}</h3>
                <span class="sv-modal-status">{{ hotelName }}</span>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="ledgerModal = false">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('stayview.reportFrom') }}</span>
                  <input v-model="ledgerForm.from" type="date" class="input" />
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.reportTo') }}</span>
                  <input v-model="ledgerForm.to" type="date" class="input" />
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.category') }}</span>
                  <select v-model="ledgerForm.category" class="input">
                    <option value="">{{ $t('stayview.allCategories') }}</option>
                    <option v-for="c in ledgerCategories" :key="c" :value="c" class="sv-cap">{{ c }}</option>
                  </select>
                </label>
                <label class="sv-field sv-check">
                  <input v-model="ledgerForm.ignoreZero" type="checkbox" />
                  <span>{{ $t('stayview.ignoreZero') }}</span>
                </label>
              </div>
              <p v-if="ledgerError" class="sv-action-error">{{ ledgerError }}</p>

              <!-- Generated report preview -->
              <div v-if="ledger" class="sv-ledger-preview">
                <div class="sv-ledger-head">
                  <strong>{{ hotelName }}</strong>
                  <span>{{ $t('stayview.stockLedger') }}</span>
                  <small>
                    {{ $t('stayview.date') }}: {{ ledgerForm.from }} {{ $t('stayview.reportTo').toLowerCase() }}
                    {{ ledgerForm.to }} · {{ $t('stayview.category') }}:
                    {{ ledgerForm.category || $t('stayview.allCategories') }}
                  </small>
                </div>
                <p v-if="!ledger.groups.length" class="sv-muted">{{ $t('stayview.ledgerEmpty') }}</p>
                <table v-else class="sv-ledger-table">
                  <thead>
                    <tr>
                      <th>{{ $t('stayview.date') }}</th>
                      <th>{{ $t('stayview.tranType') }}</th>
                      <th>{{ $t('stayview.refNo') }}</th>
                      <th class="num">{{ $t('stayview.stockIn') }}</th>
                      <th class="num">{{ $t('stayview.stockOut') }}</th>
                      <th class="num">{{ $t('stayview.costPerUnit') }}</th>
                      <th class="num">{{ $t('stayview.value') }}</th>
                      <th class="num">{{ $t('stayview.stock') }}</th>
                      <th class="num">{{ $t('stayview.stockValue') }}</th>
                    </tr>
                  </thead>
                  <template v-for="group in ledger.groups" :key="group.category">
                    <tbody>
                      <tr class="cat-row"><td colspan="9">{{ group.category.toUpperCase() }}</td></tr>
                      <template v-for="item in group.items" :key="item.item_id">
                        <tr class="item-row"><td colspan="9">{{ item.item_name }}</td></tr>
                        <tr v-for="(row, i) in item.rows" :key="i">
                          <td>{{ row.date }}</td>
                          <td>{{ row.type }}</td>
                          <td>{{ row.ref }}</td>
                          <td class="num">{{ row.stockIn }}</td>
                          <td class="num">{{ row.stockOut }}</td>
                          <td class="num">{{ row.cost }}</td>
                          <td class="num">{{ row.value }}</td>
                          <td class="num">{{ row.stock }}</td>
                          <td class="num">{{ row.stockValue }}</td>
                        </tr>
                      </template>
                    </tbody>
                  </template>
                </table>
              </div>
            </div>
            <div class="sv-modal-actions">
              <button type="button" class="btn btn-primary sv-modal-manage" :disabled="ledgerBusy" @click="generateLedger">
                <i class="fas fa-rotate" aria-hidden="true"></i>
                {{ ledgerBusy ? $t('common.loading') : $t('stayview.generate') }}
              </button>
              <button
                v-if="ledger && ledger.groups.length"
                type="button"
                class="btn btn-secondary sv-modal-manage"
                @click="printLedger"
              >
                <i class="fas fa-print" aria-hidden="true"></i> {{ $t('stayview.print') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationStore } from '@/stores/notifications'
import { roomApi, reservationApi, guestApi, housekeepingApi, invoiceApi, inventoryApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import AlertModal from '@/components/AlertModal.vue'
import RoleBadge from '@/components/RoleBadge.vue'

const { t, te } = useI18n()
const notifStore = useNotificationStore()

// First letter of the signed-in user's name for the session avatar.
const sessionInitial = computed(() => (authStore.user?.name || '?').charAt(0).toUpperCase())

// Number of day columns shown in the tape chart.
const DAYS = 14

// Number of past days shown before today (so checked-out bars stay visible).
const PAST_DAYS = 3

/** Default window start: a few days before today, like a real stay view. */
function defaultWindowStart() {
  return addDays(startOfDay(new Date()), -PAST_DAYS)
}

// Chart state: window start, room list, reservation list and search text.
const windowStart = ref(defaultWindowStart())
const rooms = ref([])
const reservations = ref([])
const search = ref('')
const loading = ref(true)
const loaded = ref(false)
const error = ref('')

// Operational alerts modal state (urgent notifications from the store).
const currentAlert = computed(() => notifStore.alerts[0] || null)
const alertType = computed(() => {
  if (!currentAlert.value) return 'info'
  switch (currentAlert.value.type) {
    case 'payment_awaiting_confirmation':
      return 'payment'
    case 'reservation_new':
      return 'reservation'
    case 'booking_requisition_new':
    case 'purchase_requisition_pending':
    case 'purchase_order_pending':
      return 'approval'
    default:
      return 'info'
  }
})
const alertDetails = computed(() => {
  if (!currentAlert.value?.data) return []
  const d = currentAlert.value.data
  const details = []
  if (d.guest_name) details.push({ label: t('guests.guestName'), value: d.guest_name })
  if (d.amount)
    details.push({ label: t('payments.amount'), value: `TZS ${Number(d.amount).toLocaleString()}` })
  if (d.provider) details.push({ label: t('payments.provider'), value: d.provider })
  return details
})

/** Dismisses the currently displayed alert (marks it as read). */
function dismissCurrentAlert() {
  if (currentAlert.value) notifStore.dismissAlert(currentAlert.value.id)
}

/* ---------------- Date helpers ---------------- */

/** Returns a copy of the date at local midnight. */
function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Returns a new date offset by the given number of days. */
function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Whole days between two dates (b - a). */
function diffDays(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000)
}

/** Parses a YYYY-MM-DD (or datetime) value into a local date, or null. */
function parseDate(value) {
  if (!value) return null
  const d = new Date(String(value).slice(0, 10) + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

/** ISO (YYYY-MM-DD) key for a date, used for per-day lookups. */
function isoKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/* ---------------- Data loading ---------------- */

/** Fetches every page of a paginated list endpoint (tolerates plain arrays too). */
async function fetchAll(apiFn, params = {}) {
  const perPage = 100
  const first = await apiFn({ ...params, page: 1, per_page: perPage })
  const payload = first.data
  const rows = [...(Array.isArray(payload) ? payload : payload?.data || [])]
  const lastPage = payload?.last_page || Math.ceil((payload?.total || rows.length) / perPage) || 1
  for (let page = 2; page <= lastPage; page++) {
    const res = await apiFn({ ...params, page, per_page: perPage })
    const p = res.data
    rows.push(...(Array.isArray(p) ? p : p?.data || []))
  }
  return rows
}

/** Loads rooms and active reservations; silent refreshes keep the chart visible. */
async function load(silent = false) {
  if (!silent) loading.value = true
  error.value = ''
  try {
    const [roomRows, reservationRows] = await Promise.all([
      // Low-level staff (e.g. kitchen, waiter if they land here) cannot read
      // rooms (level 40) or reservations (level 60): render an empty chart
      // instead of flashing the backend's 403 message.
      fetchAll(roomApi.index).catch(() => []),
      // Only the stays overlapping the visible 14-day window — with real
      // booking volume, pulling every reservation ever made would crawl.
      fetchAll(reservationApi.index, {
        exclude_status: ['cancelled', 'no_show'],
        window_start: isoKey(windowStart.value),
        window_end: isoKey(addDays(windowStart.value, DAYS)),
      }).catch(() => []),
    ])
    rooms.value = roomRows
    reservations.value = reservationRows
    loaded.value = true
    notifStore.fetchAlerts()
  } catch (err) {
    error.value = err.response?.data?.message || t('stayview.loadError')
  } finally {
    loading.value = false
  }
}


/* ---------------- Chart computations ---------------- */

/** The 14 day columns of the current window. */
const days = computed(() => {
  const todayIso = isoKey(startOfDay(new Date()))
  return Array.from({ length: DAYS }, (_, i) => {
    const date = addDays(windowStart.value, i)
    const dow = date.toLocaleDateString([], { weekday: 'short' }).toUpperCase()
    const label = date.toLocaleDateString([], { day: 'numeric', month: 'short' })
    const day = date.getDay()
    return {
      date,
      iso: isoKey(date),
      dow,
      label,
      isToday: isoKey(date) === todayIso,
      isWeekend: day === 0 || day === 6,
    }
  })
})

/** Exclusive end date of the visible window. */
const windowEnd = computed(() => addDays(windowStart.value, DAYS))

/** Grid template: fixed room column plus one column per day. */
const gridStyle = computed(() => ({
  gridTemplateColumns: `170px repeat(${DAYS}, minmax(96px, 1fr))`,
}))

/** Normalized room id for a reservation (nested room object or flat field). */
function reservationRoomId(r) {
  return r.room?.room_id ?? r.room_id ?? null
}

/** Arrival/departure pair for a reservation. */
function reservationDates(r) {
  return {
    arrival: parseDate(r.arrival_date || r.check_in_date),
    departure: parseDate(r.departure_date || r.check_out_date),
  }
}

/** Active reservations overlapping the window and matching the search text. */
const visibleReservations = computed(() => {
  const q = search.value.trim().toLowerCase()
  return reservations.value.filter((r) => {
    const { arrival, departure } = reservationDates(r)
    if (!arrival || !departure) return false
    if (departure <= windowStart.value || arrival >= windowEnd.value) return false
    if (!q) return true
    const roomNumber = r.room?.room_number || ''
    return (
      (r.guest_name || '').toLowerCase().includes(q) ||
      String(roomNumber).toLowerCase().includes(q)
    )
  })
})

/** Booking bars keyed by room id, positioned on the 14-column day grid. */
const barsByRoom = computed(() => {
  const map = {}
  for (const r of visibleReservations.value) {
    const roomId = reservationRoomId(r)
    if (!roomId) continue
    const { arrival, departure } = reservationDates(r)
    const startIdx = Math.max(0, diffDays(windowStart.value, arrival))
    const endIdx = Math.min(DAYS, diffDays(windowStart.value, departure))
    if (endIdx <= startIdx) continue
    // Bar colors: blue = checked out, red = payment pending, green = confirmed.
    const balance = Number(r.balance_due ?? r.balance ?? 0)
    const paymentPending = balance > 0
    const colorClass =
      r.status === 'checked_out' ? 'bar-blue' : paymentPending ? 'bar-red' : 'bar-green'
    const fmt = (d) => d.toLocaleDateString([], { day: 'numeric', month: 'short' })
    ;(map[roomId] ||= []).push({
      id: r.reservation_id,
      label: (r.guest_name || '—').toUpperCase(),
      start: startIdx + 1,
      span: endIdx - startIdx,
      colorClass,
      rawStatus: r.status,
      statusLabel: r.status.replace('_', ' '),
      dates: `${fmt(arrival)} → ${fmt(departure)}`,
      nights: diffDays(arrival, departure),
      roomNumber: r.room?.room_number || '—',
      paymentPending,
      balance: balance.toLocaleString(),
      // Full client/stay details so the modal shows everything in one place.
      reference: r.booking_reference || '—',
      email: r.guest_email || '—',
      phone: r.guest_phone || '—',
      location: [r.city, r.country].filter(Boolean).join(', ') || '—',
      guests: `${r.num_adults ?? 1} ${t('stayview.adults')}${r.num_children ? ` · ${r.num_children} ${t('stayview.children')}` : ''}`,
      roomType: roomTypeLabel(r.room_type || r.room?.room_type || ''),
      total: Number(r.total_amount || 0).toLocaleString(),
      advance: Number(r.advance_payment || 0).toLocaleString(),
      source: (r.booking_source || '—').replace('_', ' '),
      specialRequests: r.special_requests || '',
      notes: r.notes || '',
      checkedInAt: r.checked_in_at ? new Date(r.checked_in_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '',
      checkedOutAt: r.checked_out_at ? new Date(r.checked_out_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '',
    })
  }
  return map
})

/** Count of reservations occupying rooms of a set on a given day. */
function occupiedOnDay(roomIds, day) {
  let count = 0
  for (const r of reservations.value) {
    const roomId = reservationRoomId(r)
    if (!roomId || !roomIds.has(roomId)) continue
    const { arrival, departure } = reservationDates(r)
    if (arrival && departure && arrival <= day && departure > day) count++
  }
  return count
}

/** Rooms grouped by type with per-day availability and the type's nightly rate. */
const groups = computed(() => {
  const byType = {}
  for (const room of rooms.value) {
    const type = room.room_type || 'single'
    ;(byType[type] ||= []).push(room)
  }
  return Object.keys(byType)
    .sort()
    .map((type) => {
      const typeRooms = byType[type].sort((a, b) =>
        String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }),
      )
      const ids = new Set(typeRooms.map((r) => r.room_id))
      const price = Math.min(...typeRooms.map((r) => Number(r.price_per_night) || 0))
      const availability = {}
      for (const d of days.value) {
        availability[d.iso] = Math.max(0, typeRooms.length - occupiedOnDay(ids, d.date))
      }
      return { type, rooms: typeRooms, price, availability }
    })
})


/** Per-day totals for the footer: available rooms and occupancy percentage. */
const footer = computed(() => {
  const total = rooms.value.length
  const allIds = new Set(rooms.value.map((r) => r.room_id))
  const result = {}
  for (const d of days.value) {
    const occupied = occupiedOnDay(allIds, d.date)
    result[d.iso] = {
      available: Math.max(0, total - occupied),
      occupancy: total ? Math.round((occupied / total) * 100) : 0,
    }
  }
  return result
})

/** Summary pill counts shown above the chart. */
const pills = computed(() => {
  const today = startOfDay(new Date())
  const tomorrow = addDays(today, 1)
  const count = (statuses) => rooms.value.filter((r) => statuses.includes(r.status)).length
  const reserved = reservations.value.filter((r) => {
    if (!['pending', 'confirmed'].includes(r.status)) return false
    const { arrival } = reservationDates(r)
    return arrival && arrival >= today
  }).length
  const dueOut = reservations.value.filter((r) => {
    if (r.status !== 'checked_in') return false
    const { departure } = reservationDates(r)
    return departure && departure >= today && departure < tomorrow
  }).length
  return [
    { key: 'vacant', label: t('stayview.vacant'), count: count(['available']) },
    { key: 'occupied', label: t('stayview.occupied'), count: count(['occupied']) },
    { key: 'reserved', label: t('stayview.reserved'), count: reserved },
    { key: 'blocked', label: t('stayview.blocked'), count: count(['maintenance']) },
    { key: 'dueout', label: t('stayview.dueOut'), count: dueOut },
    { key: 'dirty', label: t('stayview.dirty'), count: count(['dirty', 'cleaning']) },
  ]
})

/* ---------------- Interactions ---------------- */

/** Shifts the visible window by the given number of days. */
function shift(daysCount) {
  windowStart.value = addDays(windowStart.value, daysCount)
  // The chart only holds the slice it fetched; moving to another week
  // needs a fresh (quiet) pull for that window.
  load(true)
}

/** Resets the window to its default position (a few days before today). */
function goToday() {
  windowStart.value = defaultWindowStart()
  load(true)
}

/* ---------------- Booking-bar hover popover ---------------- */

// Hovered bar payload plus viewport coordinates for the popover card.
const barTip = ref(null)

/** Positions the popover near the cursor, clamped inside the viewport. */
function tipPosition(event) {
  const width = 280
  const height = 190
  const x = Math.min(event.clientX + 14, window.innerWidth - width - 12)
  const y = Math.min(event.clientY + 14, window.innerHeight - height - 12)
  return { x: Math.max(8, x), y: Math.max(8, y) }
}

/** Shows the popover for the hovered booking bar. */
function showBarTip(event, bar) {
  barTip.value = { ...bar, ...tipPosition(event) }
}

/** Keeps the popover glued to the cursor while moving within a bar. */
function moveBarTip(event) {
  if (barTip.value) Object.assign(barTip.value, tipPosition(event))
}

/** Hides the popover when the cursor leaves the bar. */
function hideBarTip() {
  barTip.value = null
}

/* ---------------- Booking-bar click modal ---------------- */

// Bar currently shown in the click modal (null = closed).
const activeBar = ref(null)

/** Opens the reservation summary modal for the clicked bar. */
function openBarModal(bar) {
  hideBarTip()
  activeBar.value = bar
}

/** Closes the reservation summary modal. */
function closeBarModal() {
  activeBar.value = null
}

/* ---------------- In-place front-desk actions (no navigation) ---------------- */

// Shared busy/error state for every modal action on this page.
const actionBusy = ref(false)
const actionError = ref('')

/** Runs a reservation lifecycle action then silently refreshes the chart. */
async function runAction(fn) {
  actionBusy.value = true
  actionError.value = ''
  try {
    await fn()
    closeBarModal()
    await load(true)
  } catch (err) {
    actionError.value = err.response?.data?.message || t('stayview.actionError')
  } finally {
    actionBusy.value = false
  }
}

/** Checks the guest in (pending/confirmed bars). */
function doCheckIn(bar) {
  runAction(() => reservationApi.checkIn(bar.id))
}

/** Checks the guest out (in-house bars). */
function doCheckOut(bar) {
  runAction(() => reservationApi.checkOut(bar.id, {}))
}

/** Cancels the booking (pending/confirmed bars). */
function doCancel(bar) {
  runAction(() => reservationApi.cancel(bar.id))
}

/* ---------------- Invoice printing ---------------- */

const invoiceBusy = ref(false)

/**
 * Generates (or refreshes) the folio invoice for the booking and opens the
 * PDF in a new tab so the receptionist can print it (or save it). Falls back
 * to a direct download when the popup is blocked.
 */
async function printInvoice(bar) {
  invoiceBusy.value = true
  actionError.value = ''
  try {
    const gen = await invoiceApi.generate(bar.id)
    const invoice = gen.data.invoice
    const res = await invoiceApi.download(invoice.invoice_id)
    const url = URL.createObjectURL(
      new Blob([res.data], { type: res.headers['content-type'] || 'application/pdf' }),
    )
    const win = window.open(url, '_blank')
    if (!win) {
      // Popup blocked: fall back to a plain file download.
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoice_number}.pdf`
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (err) {
    actionError.value = err.response?.data?.message || t('stayview.invoiceError')
  } finally {
    invoiceBusy.value = false
  }
}

/* ---------------- Stock ledger report ---------------- */

const authStore = useAuthStore()

// Hotel name and staff identity used in the report header/footer.
const hotelName = computed(() => authStore.user?.tenant?.hotel_name || 'MRK Hotels')
const printedBy = computed(
  () =>
    authStore.user?.full_name ||
    [authStore.user?.first_name, authStore.user?.last_name].filter(Boolean).join(' ') ||
    authStore.user?.email ||
    '',
)

// Inventory categories offered by the backend filter.
const ledgerCategories = ['food', 'beverage', 'housekeeping', 'maintenance', 'procurement', 'other']

// The stock ledger is an inventory/procurement function — receptionists and
// other front-desk roles never see it (matches the inventory module matrix).
const canSeeLedger = computed(() =>
  ['hotel_admin', 'manager', 'procurement_officer'].includes(authStore.user?.user_role),
)

// Front-desk tools (bookings, guest registration) follow the reservations /
// guests module matrix: hotel_admin, manager and receptionist only.
const canSeeFrontDesk = computed(() =>
  ['hotel_admin', 'manager', 'receptionist'].includes(authStore.user?.user_role),
)

// Housekeeping tasks follow the housekeeping module matrix.
const canSeeHousekeeping = computed(() =>
  ['hotel_admin', 'manager', 'housekeeping'].includes(authStore.user?.user_role),
)

const ledgerModal = ref(false)
const ledgerForm = ref({ from: '', to: '', category: '', ignoreZero: false })
const ledgerBusy = ref(false)
const ledgerError = ref('')
const ledger = ref(null)

/** Opens the ledger modal with a default one-week date range. */
function openLedgerModal() {
  const today = startOfDay(new Date())
  ledgerForm.value = {
    from: isoKey(addDays(today, -6)),
    to: isoKey(today),
    category: '',
    ignoreZero: false,
  }
  ledger.value = null
  ledgerError.value = ''
  ledgerModal.value = true
}

/** Signed stock delta of a movement; null when it cannot be derived. */
function movementDelta(m) {
  if (m.movement_type === 'in') return m.quantity
  if (m.movement_type === 'out') return -m.quantity
  return null // adjustment: absolute level, delta unknown without prior stock
}

/** Display label for a movement type, matching classic ledger wording. */
function movementLabel(m) {
  if (m.movement_type === 'in') return t('stayview.stockReceived')
  if (m.movement_type === 'out') return t('stayview.sales')
  return t('stayview.adjustment')
}

/** Quantity cell text, e.g. "3 BTL". */
function qtyText(qty, unit) {
  return `${Number(qty).toLocaleString()} ${unit || ''}`.trim()
}

/** Money cell text with two decimals. */
function moneyText(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Timestamp cell: date for the opening row, datetime for movements. */
function movementDate(m) {
  const d = new Date(m.created_at)
  const date = isoKey(d)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${date} ${time}`
}

/**
 * Builds the stock ledger: opening balance per item, one row per movement in
 * the selected range with running stock and value, grouped by category.
 */
async function generateLedger() {
  ledgerBusy.value = true
  ledgerError.value = ''
  ledger.value = null
  try {
    const params = ledgerForm.value.category ? { category: ledgerForm.value.category } : {}
    const items = await fetchAll(inventoryApi.index, params)
    const from = ledgerForm.value.from
    const to = ledgerForm.value.to
    const groups = {}

    for (const item of items) {
      const movements = await fetchAll((p) => inventoryApi.movements(item.item_id, p))
      movements.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

      // Opening balance at the start of the range: walk backwards from the
      // current stock; crossing an adjustment makes the level unknown.
      const inRange = movements.filter((m) => {
        const day = String(m.created_at).slice(0, 10)
        return day >= from && day <= to
      })
      let opening = Number(item.quantity_in_stock) || 0
      let openingKnown = true
      for (let i = movements.length - 1; i >= 0; i--) {
        const m = movements[i]
        const day = String(m.created_at).slice(0, 10)
        if (day < from) break
        const delta = movementDelta(m)
        if (delta === null) {
          openingKnown = false
          break
        }
        opening -= delta
      }

      if (ledgerForm.value.ignoreZero && !opening && !inRange.length) continue

      const unit = item.unit || ''
      const cost = Number(item.unit_cost) || 0
      const rows = [
        {
          date: from,
          type: t('stayview.opening'),
          ref: '',
          stockIn: openingKnown ? qtyText(opening, unit) : '—',
          stockOut: '',
          cost: '',
          value: '',
          stock: openingKnown ? qtyText(opening, unit) : '—',
          stockValue: openingKnown ? moneyText(opening * cost) : '—',
        },
      ]
      let stock = openingKnown ? opening : null
      for (const m of inRange) {
        const delta = movementDelta(m)
        if (m.movement_type === 'adjustment') stock = m.quantity
        else if (stock !== null && delta !== null) stock += delta
        rows.push({
          date: movementDate(m),
          type: movementLabel(m),
          ref: m.reference_id || '',
          stockIn: m.movement_type !== 'out' ? qtyText(m.quantity, unit) : '',
          stockOut: m.movement_type === 'out' ? qtyText(m.quantity, unit) : '',
          cost: moneyText(cost),
          value: moneyText(m.quantity * cost),
          stock: stock === null ? '—' : qtyText(stock, unit),
          stockValue: stock === null ? '—' : moneyText(stock * cost),
        })
      }

      const category = item.category || 'other'
      ;(groups[category] ||= []).push({ item_id: item.item_id, item_name: item.item_name, rows })
    }

    ledger.value = {
      groups: Object.keys(groups)
        .sort()
        .map((category) => ({
          category,
          items: groups[category].sort((a, b) => a.item_name.localeCompare(b.item_name)),
        })),
    }
  } catch (err) {
    ledgerError.value = err.response?.data?.message || t('stayview.ledgerError')
  } finally {
    ledgerBusy.value = false
  }
}

/** Escapes a value for safe interpolation into the printable HTML. */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Prints the generated ledger in a clean A4 landscape document that mirrors
 * the classic layout: hotel header, filter line, grouped item rows and a
 * "Printed By" footer.
 */
function printLedger() {
  if (!ledger.value) return
  const now = new Date()
  const stamp = `${isoKey(now)} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
  const head = `
    <div class="rpt-hotel">${esc(hotelName.value)}</div>
    <div class="rpt-title">${esc(t('stayview.stockLedger'))}</div>
    <div class="rpt-meta">
      ${esc(t('stayview.date'))}: ${esc(ledgerForm.value.from)} To ${esc(ledgerForm.value.to)};
      ${esc(t('stayview.category'))}: ${esc(ledgerForm.value.category || t('stayview.allCategories'))};
      ${esc(t('stayview.ignoreZero'))}: ${ledgerForm.value.ignoreZero ? 'True' : 'False'}
    </div>`
  const cols = [
    t('stayview.date'),
    t('stayview.tranType'),
    t('stayview.refNo'),
    t('stayview.stockIn'),
    t('stayview.stockOut'),
    t('stayview.costPerUnit'),
    t('stayview.value'),
    t('stayview.stock'),
    t('stayview.stockValue'),
  ]
  const body = ledger.value.groups
    .map((group) => {
      const items = group.items
        .map((item) => {
          const rows = item.rows
            .map(
              (r) => `<tr>
                <td>${esc(r.date)}</td><td>${esc(r.type)}</td><td>${esc(r.ref)}</td>
                <td class="num">${esc(r.stockIn)}</td><td class="num">${esc(r.stockOut)}</td>
                <td class="num">${esc(r.cost)}</td><td class="num">${esc(r.value)}</td>
                <td class="num">${esc(r.stock)}</td><td class="num">${esc(r.stockValue)}</td>
              </tr>`,
            )
            .join('')
          return `<tr class="item"><td colspan="9">${esc(item.item_name)}</td></tr>${rows}`
        })
        .join('')
      return `<tr class="cat"><td colspan="9">${esc(group.category.toUpperCase())}</td></tr>${items}`
    })
    .join('')
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(t('stayview.stockLedger'))}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 0; }
  .rpt-hotel { text-align: center; font-size: 16px; font-weight: 700; }
  .rpt-title { text-align: center; font-size: 13px; font-weight: 700; margin-top: 2px; }
  .rpt-meta { text-align: center; font-size: 10px; color: #444; margin: 4px 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 3px 6px; text-align: left; }
  th { background: #eee; font-size: 10px; text-transform: uppercase; }
  td.num, th.num { text-align: right; }
  tr.cat td { background: #e8e8e8; font-weight: 700; letter-spacing: .05em; }
  tr.item td { font-weight: 700; border-bottom: none; }
  .rpt-foot { margin-top: 12px; font-size: 10px; color: #444; }
</style></head><body>
${head}
<table>
  <thead><tr>${cols.map((c, i) => `<th class="${i >= 3 ? 'num' : ''}">${esc(c)}</th>`).join('')}</tr></thead>
  <tbody>${body}</tbody>
</table>
<div class="rpt-foot">${esc(t('stayview.printedBy'))} : ${esc(printedBy.value)} at ${esc(stamp)}</div>
 <script>window.onload = function () { window.print() }</${'script'}>
 </body></html>`
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

/* ---------------- New booking modal ---------------- */

const bookingModal = ref(false)
const bookingForm = ref({})

/** Opens the booking form with sensible defaults (today → tomorrow). */
function openNewBooking() {
  const today = isoKey(startOfDay(new Date()))
  const tomorrow = isoKey(addDays(startOfDay(new Date()), 1))
  bookingForm.value = {
    guest_name: '',
    guest_phone: '',
    room_id: rooms.value[0]?.room_id || null,
    check_in_date: today,
    check_out_date: tomorrow,
    total_amount: null,
    advance_payment: 0,
  }
  actionError.value = ''
  bookingModal.value = true
}

/** Creates the reservation and refreshes the chart. */
async function submitBooking() {
  if (!bookingForm.value.guest_name || !bookingForm.value.room_id) return
  await runAction(async () => {
    await reservationApi.store({ ...bookingForm.value, status: 'confirmed' })
  })
  if (!actionError.value) bookingModal.value = false
}

/* ---------------- Guest registration modal ---------------- */

const guestModal = ref(false)
const guestForm = ref({})

/** Opens the guest registration form. */
function openGuestModal() {
  guestForm.value = { first_name: '', last_name: '', phone: '', email: '' }
  actionError.value = ''
  guestModal.value = true
}

/** Saves the guest record. */
async function submitGuest() {
  if (!guestForm.value.first_name || !guestForm.value.phone) return
  await runAction(() => guestApi.store({ ...guestForm.value }))
  if (!actionError.value) guestModal.value = false
}

/* ---------------- Housekeeping modal ---------------- */

const tasksModal = ref(false)
const tasks = ref([])
const taskForm = ref({})

/** Opens the housekeeping panel and loads open tasks. */
async function openTasksModal() {
  taskForm.value = { room_id: rooms.value[0]?.room_id || null, priority: 'normal' }
  actionError.value = ''
  tasksModal.value = true
  try {
    const res = await housekeepingApi.index({ status: 'pending', per_page: 50 })
    const p = res.data
    tasks.value = Array.isArray(p) ? p : p?.data || []
  } catch {
    tasks.value = []
  }
}

/** Creates a cleaning task for the selected room. */
async function submitTask() {
  if (!taskForm.value.room_id) return
  await runAction(() =>
    housekeepingApi.store({ ...taskForm.value, task_type: 'cleaning' }),
  )
  await openTasksModal()
}

/* ---------------- Room status modal ---------------- */

const roomModal = ref(null)
const roomStatuses = ['available', 'occupied', 'dirty', 'cleaning', 'maintenance']

/** Opens the room details / status panel for the clicked room cell. */
function openRoomModal(room) {
  actionError.value = ''
  roomModal.value = room
}

/** Changes the room's housekeeping status. */
async function setRoomStatus(status) {
  if (!roomModal.value || roomModal.value.status === status) return
  await runAction(() => roomApi.updateStatus(roomModal.value.room_id, { status }))
  if (!actionError.value) roomModal.value = null
}

/** Translates a room type with a graceful fallback to the raw value. */
function roomTypeLabel(type) {
  const key = `common.roomTypes.${type}`
  return te(key) ? t(key) : type
}

/** Formats a nightly rate with thousands separators. */
function formatPrice(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Background refresh keeps the stay view current without a spinner flash.
let refreshTimer = null

onMounted(() => {
  load()
  refreshTimer = setInterval(() => load(true), 30000)
})

onUnmounted(() => clearInterval(refreshTimer))
</script>


<style scoped>
.stayview-page {
  padding: 16px 20px 32px;
  max-width: 100%;
}

/* Toolbar: status pills + search + assign-room */
.sv-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.session-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px 6px 6px;
  border-radius: 999px;
  background: #0b1f33;
  color: #fff;
}

.session-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #ffb400;
  color: #0b1f33;
  font-weight: 800;
  font-size: 15px;
}

.session-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
}

.session-name {
  font-size: 12px;
  font-weight: 600;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sv-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sv-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  background: #f1f3f5;
  color: #333;
}

.sv-pill strong {
  font-weight: 700;
}

.sv-pill.vacant { background: #e7f6ec; color: #1e7e34; }
.sv-pill.occupied { background: #fde8e8; color: #c0392b; }
.sv-pill.reserved { background: #fff3cd; color: #856404; }
.sv-pill.blocked { background: #e2e3e5; color: #383d41; }
.sv-pill.dueout { background: #d1ecf1; color: #0c5460; }
.sv-pill.dirty { background: #f8d7da; color: #721c24; }

.sv-toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sv-search {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 8px 12px;
  background: #fff;
  min-width: 260px;
  color: #757575;
}

.sv-search input {
  border: none;
  outline: none;
  flex: 1;
  font-size: 14px;
  background: transparent;
}

.sv-assign {
  white-space: nowrap;
}

/* Tape chart: center content scrolls both ways; footer rows stay pinned */
.sv-chart {
  overflow: auto;
  max-height: calc(100vh - 220px);
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}

.sv-grid {
  display: grid;
  min-width: 100%;
}

.sv-corner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid #e5e7eb;
  border-right: 1px solid #e5e7eb;
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 3;
}

.sv-nav-btn,
.sv-today-btn {
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: #333;
}

.sv-nav-btn:hover,
.sv-today-btn:hover {
  border-color: #005eb8;
  color: #005eb8;
}

.sv-day-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border-bottom: 1px solid #e5e7eb;
  border-right: 1px solid #f0f0f0;
  font-size: 12px;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 2;
}

.sv-day-head .dow {
  font-size: 11px;
  letter-spacing: 0.05em;
  color: #757575;
}

.sv-day-head .dom {
  font-weight: 600;
}

.sv-day-head.today {
  background: #eaf3fb;
  z-index: 2;
  color: #005eb8;
}

.sv-day-head.weekend:not(.today) {
  background: #fafafa;
}


/* Room-type rate row */
.sv-type-cell {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-weight: 600;
  font-size: 13px;
  text-transform: capitalize;
  border-bottom: 1px solid #f0f0f0;
  border-right: 1px solid #e5e7eb;
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 2;
}

.sv-rate-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  border-bottom: 1px solid #f0f0f0;
  border-right: 1px solid #f5f5f5;
  font-size: 12px;
}

.sv-rate-cell.today,
.sv-cell-bg.today,
.sv-footer-day.today {
  background: #f4f9fd;
}

.sv-rate-cell.weekend:not(.today),
.sv-cell-bg.weekend:not(.today),
.sv-footer-day.weekend:not(.today) {
  background: #fbfbfb;
}

.sv-avail-pill {
  min-width: 22px;
  text-align: center;
  padding: 1px 6px;
  border-radius: 999px;
  background: #fff3cd;
  color: #856404;
  font-weight: 600;
  font-size: 11px;
}

.sv-avail-pill.zero {
  background: #f8d7da;
  color: #721c24;
}

.sv-price {
  color: #555;
  font-variant-numeric: tabular-nums;
}

/* Room rows */
.sv-room-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid #f0f0f0;
  border-right: 1px solid #e5e7eb;
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 2;
  min-height: 40px;
}

.sv-room-number {
  font-weight: 600;
  font-size: 13px;
}

.sv-room-flag {
  color: #9e9e9e;
  font-size: 12px;
}

.sv-room-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sv-room-dot.available { background: #28a745; }
.sv-room-dot.occupied { background: #dc3545; }
.sv-room-dot.cleaning { background: #005eb8; }
.sv-room-dot.dirty { background: #e0a800; }
.sv-room-dot.maintenance { background: #7f8c8d; }

.sv-room-track {
  grid-column: 2 / -1;
  display: grid;
  grid-template-columns: repeat(14, 1fr);
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  min-height: 40px;
  position: relative;
}

.sv-cell-bg {
  height: 100%;
  border-right: 1px solid #f5f5f5;
  grid-row: 1;
}

/* Explicit placement so backgrounds and bars share row 1 of the track */
.sv-cell-bg:nth-child(1) { grid-column: 1; }
.sv-cell-bg:nth-child(2) { grid-column: 2; }
.sv-cell-bg:nth-child(3) { grid-column: 3; }
.sv-cell-bg:nth-child(4) { grid-column: 4; }
.sv-cell-bg:nth-child(5) { grid-column: 5; }
.sv-cell-bg:nth-child(6) { grid-column: 6; }
.sv-cell-bg:nth-child(7) { grid-column: 7; }
.sv-cell-bg:nth-child(8) { grid-column: 8; }
.sv-cell-bg:nth-child(9) { grid-column: 9; }
.sv-cell-bg:nth-child(10) { grid-column: 10; }
.sv-cell-bg:nth-child(11) { grid-column: 11; }
.sv-cell-bg:nth-child(12) { grid-column: 12; }
.sv-cell-bg:nth-child(13) { grid-column: 13; }
.sv-cell-bg:nth-child(14) { grid-column: 14; }

/* Booking bars */
.sv-bar {
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 2px;
  padding: 4px 10px;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  z-index: 1;
  animation: sv-bar-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
}

.sv-bar:hover {
  transform: translateY(-1px) scale(1.015);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.22);
  filter: brightness(1.06);
  z-index: 2;
}

/* Bars slide in with a gentle staggered pop when the chart renders. */
@keyframes sv-bar-in {
  from {
    opacity: 0;
    transform: translateX(-10px) scaleX(0.85);
  }
  to {
    opacity: 1;
    transform: translateX(0) scaleX(1);
  }
}

.sv-bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-bar.bar-green { background: #28c76f; }
.sv-bar.bar-red { background: #ff6b6b; }
.sv-bar.bar-blue { background: #3b82f6; }

.sv-bar:hover {
  filter: brightness(0.92);
}

/* Footer rows */
.sv-footer-cell {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #555;
  border-top: 1px solid #e5e7eb;
  border-right: 1px solid #e5e7eb;
  position: sticky;
  left: 0;
  background: #fafafa;
  z-index: 2;
}

.sv-footer-day {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  font-size: 13px;
  border-top: 1px solid #e5e7eb;
  border-right: 1px solid #f5f5f5;
  background: #fafafa;
}

.sv-occ {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 0 6px;
}

.sv-occ-bar {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
}

.sv-occ-bar span {
  display: block;
  height: 100%;
  background: #28c76f;
  border-radius: 999px;
}

/* Sticky footer rows: availability sits above the occupancy row */
.sv-sticky-avail {
  position: sticky;
  bottom: 37px;
  z-index: 2;
}

.sv-sticky-occ {
  position: sticky;
  bottom: 0;
  z-index: 2;
}

.sv-footer-cell.sv-sticky-avail,
.sv-footer-cell.sv-sticky-occ {
  z-index: 3;
}

/* Booking-bar hover popover */
.sv-popover {
  position: fixed;
  z-index: 1000;
  width: 280px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.16);
  padding: 14px;
  pointer-events: none;
  font-size: 13px;
  color: #333;
}

.sv-popover-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.sv-popover-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #eef4fb;
  color: #005eb8;
  font-size: 18px;
  flex-shrink: 0;
}

.sv-popover-name {
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.02em;
}

.sv-popover-badge {
  display: inline-block;
  margin-top: 3px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  text-transform: capitalize;
}

.sv-popover-badge.bar-green { background: #28c76f; }
.sv-popover-badge.bar-red { background: #ff6b6b; }
.sv-popover-badge.bar-blue { background: #3b82f6; }

.sv-popover-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-top: 1px solid #f3f4f6;
  color: #555;
}

.sv-popover-row i {
  width: 16px;
  text-align: center;
  color: #9ca3af;
}

.sv-popover-row.pay-pending { color: #c0392b; }
.sv-popover-row.pay-pending i { color: #c0392b; }
.sv-popover-row.pay-ok { color: #1e7e34; }
.sv-popover-row.pay-ok i { color: #1e7e34; }

/* Reservation click modal */
.sv-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  padding: 20px;
}

.sv-modal {
  width: 400px;
  max-width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
}

.sv-modal-body {
  overflow-y: auto;
}

/* Wide variant for the stock ledger report */
.sv-modal-wide {
  width: 900px;
}

.sv-check {
  flex-direction: row !important;
  align-items: center;
  gap: 8px;
  align-self: end;
  padding-bottom: 8px;
}

.sv-ledger-preview {
  margin-top: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: auto;
  max-height: 50vh;
}

.sv-ledger-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}

.sv-ledger-head strong {
  font-size: 15px;
}

.sv-ledger-head small {
  color: #6b7280;
}

.sv-ledger-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.sv-ledger-table th,
.sv-ledger-table td {
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  text-align: left;
  white-space: nowrap;
}

.sv-ledger-table th {
  background: #f3f4f6;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  position: sticky;
  top: 0;
}

.sv-ledger-table .num {
  text-align: right;
}

.sv-ledger-table .cat-row td {
  background: #eef2f7;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.sv-ledger-table .item-row td {
  font-weight: 700;
  border-bottom: none;
}

.sv-modal-section {
  margin: 12px 0 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #005eb8;
}

.sv-modal-section:first-child {
  margin-top: 0;
}

.sv-cap {
  text-transform: capitalize;
}

.sv-modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  color: #fff;
}

.sv-modal-head.bar-green { background: linear-gradient(135deg, #28c76f, #1e9e57); }
.sv-modal-head.bar-red { background: linear-gradient(135deg, #ff6b6b, #e04b4b); }
.sv-modal-head.bar-blue { background: linear-gradient(135deg, #3b82f6, #2563eb); }

.sv-modal-head-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 20px;
  flex-shrink: 0;
}

.sv-modal-head-text {
  flex: 1;
  min-width: 0;
}

.sv-modal-head-text h3 {
  margin: 0;
  font-size: 16px;
  letter-spacing: 0.02em;
}

.sv-modal-status {
  font-size: 12px;
  opacity: 0.9;
  text-transform: capitalize;
}

.sv-modal-close {
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
}

.sv-modal-close:hover {
  background: rgba(255, 255, 255, 0.35);
}

.sv-modal-body {
  padding: 14px 16px;
}

.sv-modal-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  font-size: 14px;
  color: #444;
  border-bottom: 1px solid #f3f4f6;
}

.sv-modal-row:last-child {
  border-bottom: none;
}

.sv-modal-row i {
  width: 18px;
  text-align: center;
  color: #9ca3af;
}

.sv-modal-row.pay-pending { color: #c0392b; }
.sv-modal-row.pay-pending i { color: #c0392b; }
.sv-modal-row.pay-ok { color: #1e7e34; }
.sv-modal-row.pay-ok i { color: #1e7e34; }

.sv-modal-actions {
  padding: 0 16px 16px;
}

.sv-modal-manage {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* Toolbar secondary action buttons */
.sv-tool-btn {
  white-space: nowrap;
  background: #fff;
  border: 1px solid #d1d5db;
  color: #374151;
}

.sv-tool-btn:hover {
  border-color: #005eb8;
  color: #005eb8;
}

/* Clickable room cells */
.sv-room-cell {
  cursor: pointer;
}

.sv-room-cell:hover {
  background: #f0f6fc;
}

/* Lifecycle action buttons inside the reservation modal */
.sv-modal-danger {
  width: 100%;
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #f3c2c2;
  color: #c0392b;
}

.sv-modal-danger:hover {
  background: #fde8e8;
  border-color: #c0392b;
}

.sv-action-error {
  margin: 0 0 8px;
  font-size: 13px;
  color: #c0392b;
}

/* Form fields used by the booking/guest/task modals */
.sv-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  flex: 1;
  font-size: 13px;
  color: #444;
}

.sv-field > span {
  font-weight: 600;
}

.sv-field-row {
  display: flex;
  gap: 10px;
}

/* Housekeeping task list rows */
.sv-task-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
}

.sv-task-room {
  font-weight: 700;
  min-width: 48px;
}

.sv-task-type {
  flex: 1;
  color: #555;
}

.sv-task-status {
  font-size: 12px;
  color: #856404;
  background: #fff3cd;
  padding: 2px 10px;
  border-radius: 999px;
}

.sv-muted {
  color: #9ca3af;
  font-size: 13px;
  margin: 4px 0 10px;
}

/* Room status picker grid */
.sv-status-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.sv-status-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
  color: #374151;
}

.sv-status-btn:hover {
  border-color: #005eb8;
}

.sv-status-btn.active {
  border-color: #005eb8;
  background: #eaf3fb;
  font-weight: 600;
}

/* Modal open/close transition */
.sv-modal-enter-active,
.sv-modal-leave-active {
  transition: opacity 0.2s ease;
}

.sv-modal-enter-active .sv-modal,
.sv-modal-leave-active .sv-modal {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
}

.sv-modal-enter-from,
.sv-modal-leave-to {
  opacity: 0;
}

.sv-modal-enter-from .sv-modal,
.sv-modal-leave-to .sv-modal {
  transform: translateY(14px) scale(0.96);
  opacity: 0;
}

.sv-empty {
  padding: 40px;
  text-align: center;
  color: #757575;
}

@media (max-width: 768px) {
  .stayview-page {
    padding: 12px;
  }

  .sv-search {
    min-width: 0;
    flex: 1;
  }

  .sv-toolbar-right {
    width: 100%;
  }
}
</style>

