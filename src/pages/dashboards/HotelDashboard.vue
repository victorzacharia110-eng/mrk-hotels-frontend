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
                @click="openRoomModal(room, $event)"
                @keyup.enter="openRoomModal(room, $event)"
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
                <button
                  v-if="(hkByRoom[room.room_id] || []).length"
                  type="button"
                  class="sv-hk-badge"
                  :class="{ active: hkTip && hkTip.room.room_id === room.room_id }"
                  :aria-label="hkByRoom[room.room_id].length + ' ' + $t('housekeeping.title').toLowerCase()"
                  title=""
                  @click.stop="toggleHkTip($event, room)"
                  @mouseenter="showHkTip($event, room)"
                  @mousemove="moveHkTip"
                  @mouseleave="hideHkTip"
                >
                  <i class="fas fa-broom" aria-hidden="true"></i>
                  <b>{{ hkByRoom[room.room_id].length }}</b>
                </button>
                <button
                  v-if="(laundryByRoom[room.room_number] || []).length && !(hkByRoom[room.room_id] || []).length"
                  type="button"
                  class="sv-hk-badge sv-hk-badge-laundry"
                  :class="{ active: hkTip && hkTip.room.room_id === room.room_id }"
                  :aria-label="(laundryByRoom[room.room_number] || []).length + ' ' + $t('laundry.title').toLowerCase()"
                  title=""
                  @click.stop="toggleHkTip($event, room)"
                  @mouseenter="showHkTip($event, room)"
                  @mousemove="moveHkTip"
                  @mouseleave="hideHkTip"
                >
                  <i class="fas fa-jug-detergent" aria-hidden="true"></i>
                  <b>{{ (laundryByRoom[room.room_number] || []).length }}</b>
                </button>
              </div>
              <div class="sv-room-track">
                <div
                  v-for="d in days"
                  :key="d.iso"
                  class="sv-cell-bg"
                  :class="{ today: d.isToday, weekend: d.isWeekend, vacant: isVacantCell(room, d.iso) }"
                  role="button"
                  tabindex="0"
                  :title="isVacantCell(room, d.iso) ? $t('stayview.vacant') : ''"
                  @click="onCellTap($event, room, d.iso)"
                  @keyup.enter="onCellTap($event, room, d.iso)"
                ></div>
                <div
                  v-for="bar in barsByRoom[room.room_id] || []"
                  :key="bar.id"
                  class="sv-bar"
                  :class="bar.colorClass"
                  :style="{ gridColumn: `${bar.start} / span ${bar.span}`, animationDelay: `${bar.start * 30}ms` }"
                  role="button"
                  tabindex="0"
                  @click="onBarTap($event, bar)"
                  @keyup.enter="onBarTap($event, bar)"
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
      <div class="sv-popover-row" :class="barTip.rawStatus === 'checked_in' ? 'pay-ok' : (barTip.paymentPending ? 'pay-pending' : 'pay-ok')">
        <i class="fas fa-dollar-sign" aria-hidden="true"></i>
        <span>
          <template v-if="barTip.rawStatus === 'checked_in'">{{ $t('stayview.balanceDue') }}</template>
          <template v-else>{{ barTip.paymentPending ? $t('stayview.paymentPending') : $t('stayview.paymentPaid') }}</template>
          <strong v-if="barTip.paymentPending"> · TZS {{ barTip.balance }}</strong>
        </span>
      </div>
    </div>

    <!-- Floating housekeeping card: the assigned work on a room (tap/pin or hover) -->
    <div
      v-if="hkTip"
      class="sv-hk-card"
      :class="{ pinned: hkTip.pinned }"
      :style="{ left: hkTip.left + 'px', top: hkTip.top + 'px' }"
      role="dialog"
      :aria-label="$t('housekeeping.title')"
      @mouseenter="pinHkTip"
      @mouseleave="hideHkTip"
    >
      <header class="sv-hk-card-head">
        <div class="sv-hk-card-room">
          <span class="sv-room-dot" :class="hkTip.room.status" aria-hidden="true"></span>
          <strong>{{ hkTip.room.room_number }}</strong>
          <span class="sv-hk-card-guest">
            {{ hkRoomGuest(hkTip.room.room_id) || roomTypeLabel(hkTip.room.room_type) }}
          </span>
        </div>
        <button type="button" class="sv-hk-card-close" :aria-label="$t('common.close')" @click="hkTip = null">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </header>
      <ul v-if="hkTip.tasks.length" class="sv-hk-list">
        <li v-for="task in hkTip.tasks" :key="task.task_id" class="sv-hk-item" :class="task.priority">
          <div class="sv-hk-item-top">
            <span class="sv-hk-task-type"><i class="fas fa-broom" aria-hidden="true"></i> {{ hkLabel(task, 'task_type') }}</span>
            <span class="sv-hk-status" :class="task.status">{{ hkLabel(task, 'status') }}</span>
          </div>
          <div class="sv-hk-item-meta">
            <span><i class="fas fa-flag" aria-hidden="true"></i> {{ hkLabel(task, 'priority') }}</span>
            <span>
              <i class="fas fa-user" aria-hidden="true"></i>
              {{ task.assigned_user?.full_name || $t('housekeeping.unassigned') }}
            </span>
          </div>
          <p v-if="task.notes" class="sv-hk-notes">{{ task.notes }}</p>
          <div v-if="isHousekeepingStaff" class="sv-hk-actions">
            <button
              v-if="task.status === 'dirty'"
              type="button"
              class="sv-hk-btn sv-hk-btn-primary"
              :disabled="actionBusy"
              @click.stop="hkTaskAction(task, 'start')"
            >
              <i class="fas fa-play" aria-hidden="true"></i> {{ $t('housekeeping.start') }}
            </button>
            <button
              v-if="task.status === 'in_progress' && hkCanConfirm"
              type="button"
              class="sv-hk-btn"
              :disabled="actionBusy"
              @click.stop="hkTaskAction(task, 'confirm')"
            >
              <i class="fas fa-check-double" aria-hidden="true"></i> {{ $t('housekeeping.confirm') }}
            </button>
            <button
              v-if="task.status === 'confirmed' && hkCanVerify"
              type="button"
              class="sv-hk-btn"
              :disabled="actionBusy"
              @click.stop="hkTaskAction(task, 'verify')"
            >
              <i class="fas fa-clipboard-check" aria-hidden="true"></i> {{ $t('housekeeping.verify') }}
            </button>
            <button
              v-if="task.status === 'verified'"
              type="button"
              class="sv-hk-btn sv-hk-btn-success"
              :disabled="actionBusy"
              @click.stop="hkTaskAction(task, 'complete')"
            >
              <i class="fas fa-check" aria-hidden="true"></i> {{ $t('housekeeping.complete') }}
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="sv-hk-empty">{{ $t('stayview.noTasks') }}</p>

      <!-- Laundry is housekeeping work too: open orders run on the same bars -->
      <template v-if="hkTip.laundry.length">
        <div class="sv-hk-section">
          <span class="sv-hk-section-title"><i class="fas fa-jug-detergent" aria-hidden="true"></i> {{ $t('laundry.title') }}</span>
          <span v-if="hkTip.laundry.length" class="sv-hk-section-count">{{ hkTip.laundry.length }}</span>
        </div>
        <ul class="sv-hk-list">
          <li v-for="order in hkTip.laundry" :key="order.laundry_order_id" class="sv-hk-item" :class="order.status">
            <div class="sv-hk-item-top">
              <span class="sv-hk-task-type"><i class="fas fa-shirt" aria-hidden="true"></i> {{ hkLaundryLabel(order, 'service') }}</span>
              <span class="sv-hk-status" :class="order.status">{{ hkLaundryLabel(order, 'status') }}</span>
            </div>
            <div class="sv-hk-item-meta">
              <span>{{ $t('laundry.orderNumber') }} {{ order.order_number }}</span>
              <span><i class="fas fa-user" aria-hidden="true"></i> {{ order.guest_name || '—' }}</span>
            </div>
            <div class="sv-hk-item-meta">
              <span><i class="fas fa-layer-group" aria-hidden="true"></i> {{ order.items_count ?? 0 }} {{ $t('laundry.items') }}</span>
              <span><i class="fas fa-coins" aria-hidden="true"></i> TZS {{ fmtNum(order.total_charge) }}</span>
              <span v-if="order.attendant?.full_name"><i class="fas fa-user-gear" aria-hidden="true"></i> {{ order.attendant.full_name }}</span>
            </div>
            <div v-if="isHousekeepingStaff && hkLaundryNext(order).length" class="sv-hk-actions">
              <button
                v-for="next in hkLaundryNext(order)"
                :key="next"
                type="button"
                class="sv-hk-btn"
                :class="{ 'sv-hk-btn-success': next === 'delivered' || next === 'ready', 'sv-hk-btn-danger': next === 'cancelled' }"
                :disabled="actionBusy"
                @click.stop="hkLaundryAction(order, next)"
              >
                <i :class="next === 'delivered' ? 'fas fa-truck' : next === 'cancelled' ? 'fas fa-ban' : 'fas fa-check-double'" aria-hidden="true"></i>
                {{ hkLaundryLabel({ status: next }, 'status') }}
              </button>
            </div>
          </li>
        </ul>
      </template>
    </div>

    <!-- Click modal: full reservation summary for the selected bar -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="activeBar" class="sv-modal-backdrop" @click.self="closeBarModal">
          <div class="sv-modal sv-modal-tabs" role="dialog" aria-modal="true" :aria-label="activeBar.label">
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
              <!-- Stay summary strip (matches the reference panel header) -->
              <div class="sv-stay-strip">
                <div v-for="s in stayStrip" :key="s.key" class="sv-stay-item">
                  <span>{{ s.label }}</span>
                  <strong>{{ s.value }}</strong>
                </div>
              </div>

              <!-- Stay-view tabs -->
              <div class="sv-tabs" role="tablist">
                <button
                  v-for="tab in stayTabs"
                  :key="tab.key"
                  type="button"
                  class="sv-tab"
                  :class="{ active: stayTab === tab.key }"
                  role="tab"
                  :aria-selected="stayTab === tab.key"
                  @click="setStayTab(tab.key)"
                >
                  <i :class="tab.icon" aria-hidden="true"></i>
                  <span>{{ tab.label }}</span>
                </button>
              </div>

              <!-- Folio Operations -->
              <div v-if="stayTab === 'folio'" class="sv-tab-panel" role="tabpanel">
                <div class="sv-panel-cards">
                  <div class="sv-panel-card">
                    <span>{{ $t('stayview.totalRoomCharges') }}</span>
                    <strong>TZS {{ fmtNum((folio?.folio?.total_amount ?? 0) + (folio?.folio?.room_charges ?? 0), 2) }}</strong>
                  </div>
                  <div class="sv-panel-card">
                    <span>{{ $t('stayview.totalPaid') }}</span>
                    <strong>TZS {{ fmtNum(folio?.reservation?.advance_payment ?? activeBar.advance ?? 0, 2) }}</strong>
                  </div>
                  <div class="sv-panel-card" :class="activeBar.paymentPending ? 'pay-pending' : 'pay-ok'">
                    <span>{{ $t('stayview.balance') }}</span>
                    <strong>TZS {{ fmtNum(folio?.folio?.balance_due ?? activeBar.balance ?? 0, 2) }}</strong>
                  </div>
                </div>

                <div v-if="folioLoading" class="sv-modal-row muted">
                  <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                  <span>{{ $t('common.loading') }}</span>
                </div>
                <template v-else-if="folio">
                  <div class="sv-table-wrap sv-folio-table">
                    <table class="sv-table">
                      <thead>
                        <tr>
                          <th>{{ $t('folio.date') }}</th>
                          <th>{{ $t('folio.particular') }}</th>
                          <th>{{ $t('folio.description') }}</th>
                          <th>{{ $t('folio.user') }}</th>
                          <th class="num">{{ $t('folio.amount') }}</th>
                          <th class="sv-cell-actions">{{ $t('folio.actions') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="e in folioEntries"
                          :key="e.key"
                          :class="[e.credit ? 'row-credit' : 'row-charge', { 'row-muted': e.muted }]"
                        >
                          <td>{{ formatDateDMY(e.date) }}</td>
                          <td class="sv-particular">{{ e.particular }}</td>
                          <td>
                            {{ e.description }}<span v-if="e.detail" class="sv-cap"> · {{ e.detail }}</span>
                          </td>
                          <td>{{ e.user }}</td>
                          <td class="num">{{ e.credit ? '−' : '' }}TZS {{ fmtNum(e.amount, 2) }}</td>
                          <td class="sv-cell-actions">
                            <button
                              v-if="e.editable"
                              type="button"
                              class="sv-icon-link"
                              :title="$t('folio.edit')"
                              :disabled="actionBusy"
                              @click="openEditEntry(e)"
                            >
                              <i class="fas fa-pen" aria-hidden="true"></i>
                            </button>
                            <a
                              v-if="e.entryUrl"
                              :href="e.entryUrl"
                              target="_blank"
                              rel="noopener"
                              class="sv-icon-link"
                              :title="$t('folio.download')"
                            >
                              <i class="fas fa-download" aria-hidden="true"></i>
                            </a>
                            <button
                              v-if="e.entryId"
                              type="button"
                              class="sv-icon-link"
                              :title="e.entryUrl ? $t('folio.remove') : $t('folio.void')"
                              :disabled="actionBusy"
                              @click="e.entryUrl ? removeFolioAttachment(e) : voidFolioEntry(e)"
                            >
                              <i class="fas fa-trash-can" aria-hidden="true"></i>
                            </button>
                            <span v-if="!e.entryId && !e.editable" class="sv-muted-cell">—</span>
                          </td>
                        </tr>
                        <tr v-if="!folioEntries.length">
                          <td colspan="6" class="sv-muted-cell">{{ $t('folio.empty') }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>

                <template v-if="activeBar.specialRequests || activeBar.notes">
                  <div class="sv-tab-section">{{ $t('stayview.requestsNotes') }}</div>
                  <div v-if="activeBar.specialRequests" class="sv-modal-row">
                    <i class="fas fa-star" aria-hidden="true"></i>
                    <span>{{ activeBar.specialRequests }}</span>
                  </div>
                  <div v-if="activeBar.notes" class="sv-modal-row">
                    <i class="fas fa-note-sticky" aria-hidden="true"></i>
                    <span>{{ activeBar.notes }}</span>
                  </div>
                </template>

                <div v-if="canSeeFrontDesk" class="sv-panel-actions">
                  <button type="button" class="btn btn-secondary" :disabled="actionBusy" @click="openPaymentModal">
                    <i class="fas fa-money-bill-wave" aria-hidden="true"></i> {{ $t('stayview.addPayment') }}
                  </button>
                  <button type="button" class="btn btn-secondary" :disabled="actionBusy" @click="openChargeModal">
                    <i class="fas fa-receipt" aria-hidden="true"></i> {{ $t('stayview.addCharges') }}
                  </button>
                </div>
              </div>

              <!-- Booking Details -->
              <div v-else-if="stayTab === 'booking'" class="sv-tab-panel" role="tabpanel">
                <div class="sv-tab-section">{{ $t('stayview.tabs.booking') }}</div>
                <div class="sv-grid">
                  <div v-for="(g, i) in bookingGrid" :key="'b' + i" class="sv-grid-item">
                    <span>{{ g.label }}</span>
                    <strong>{{ g.value }}</strong>
                  </div>
                </div>
              </div>

              <!-- Guest Details -->
              <div v-else-if="stayTab === 'guest'" class="sv-tab-panel" role="tabpanel">
                <div class="sv-tab-section">{{ $t('stayview.tabs.guest') }}</div>
                <div class="sv-grid">
                  <div v-for="(g, i) in guestGrid" :key="'g' + i" class="sv-grid-item">
                    <span>{{ g.label }}</span>
                    <strong>{{ g.value }}</strong>
                  </div>
                </div>
              </div>

              <!-- Room Charges -->
              <div v-else-if="stayTab === 'charges'" class="sv-tab-panel" role="tabpanel">
                <div class="sv-panel-cards">
                  <div class="sv-panel-card">
                    <span>{{ $t('stayview.totalRoomCharges') }}</span>
                    <strong>TZS {{ fmtNum((folio?.folio?.total_amount ?? 0) + (folio?.folio?.room_charges ?? 0), 2) }}</strong>
                  </div>
                  <div class="sv-panel-card">
                    <span>{{ $t('stayview.totalPaid') }}</span>
                    <strong>TZS {{ fmtNum(folio?.reservation?.advance_payment ?? 0, 2) }}</strong>
                  </div>
                  <div class="sv-panel-card">
                    <span>{{ $t('folio.balance') }}</span>
                    <strong>TZS {{ fmtNum(folio?.folio?.balance_due ?? activeBar.balance ?? 0, 2) }}</strong>
                  </div>
                </div>
                <div v-if="chargeNights.length" class="sv-table-wrap">
                  <table class="sv-table">
                    <thead>
                      <tr>
                        <th>{{ $t('stayview.date') }}</th>
                        <th>{{ $t('stayview.day') }}</th>
                        <th class="num">{{ $t('stayview.rate') }}</th>
                        <th class="num">{{ $t('stayview.value') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(n, i) in chargeNights" :key="i">
                        <td>{{ n.date }}</td>
                        <td>{{ n.day }}</td>
                        <td class="num">TZS {{ fmtNum(n.rate, 2) }}</td>
                        <td class="num">TZS {{ fmtNum(n.rate, 2) }}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colspan="3">{{ $t('stayview.nightTotal') }}</td>
                        <td class="num"><strong>TZS {{ fmtNum(nightTotal, 2) }}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                  <p class="sv-cap sv-note">{{ $t('stayview.rateHint') }}</p>
                </div>
                <div v-else class="sv-modal-row muted">
                  <i class="fas fa-bed" aria-hidden="true"></i>
                  <span>{{ $t('stayview.noCharges') }}</span>
                </div>
              </div>

              <!-- Credit Card -->
              <div v-else-if="stayTab === 'card'" class="sv-tab-panel" role="tabpanel">
                <div class="sv-empty-state">
                  <i class="fas fa-credit-card" aria-hidden="true"></i>
                  <p>{{ $t('stayview.cardEmpty') }}</p>
                </div>
              </div>

              <!-- Tasks -->
              <div v-else-if="stayTab === 'tasks'" class="sv-tab-panel" role="tabpanel">
                <div class="sv-tab-head">
                  <span class="sv-tab-section">{{ $t('stayview.tasksForRoom') }}</span>
                  <button v-if="canSeeFrontDesk" type="button" class="btn btn-secondary btn-sm" :disabled="actionBusy" @click="openTasksModal(activeBar.roomId)">
                    <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('stayview.taskAdd') }}
                  </button>
                </div>
                <div v-if="roomTasksLoading" class="sv-modal-row muted">
                  <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                  <span>{{ $t('common.loading') }}</span>
                </div>
                <template v-else>
                  <div v-for="(tk, i) in roomTasks" :key="'t' + i" class="sv-task-row">
                    <span class="sv-task-icon"><i class="fas fa-broom" aria-hidden="true"></i></span>
                    <div class="sv-task-main">
                      <strong>{{ tk.task_type }}</strong>
                      <span class="sv-cap">{{ tk.priority }} · {{ fmtDate(tk.created_at) }}</span>
                    </div>
                    <span class="sv-task-status">{{ tk.status }}</span>
                  </div>
                  <div v-if="!roomTasks.length" class="sv-modal-row muted">
                    <i class="fas fa-circle-check" aria-hidden="true"></i>
                    <span>{{ $t('stayview.tasksEmpty') }}</span>
                  </div>
                </template>
              </div>

              <!-- Audit Trail -->
              <div v-else class="sv-tab-panel" role="tabpanel">
                <div class="sv-tab-section">{{ $t('stayview.tabs.audit') }}</div>
                <div v-if="folio?.audit_trail?.length" class="sv-table-wrap">
                  <table class="sv-table">
                    <thead>
                      <tr>
                        <th>{{ $t('stayview.date') }}</th>
                        <th>{{ $t('stayview.action') }}</th>
                        <th>{{ $t('stayview.user') }}</th>
                        <th>IP</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(a, i) in folio.audit_trail" :key="'a' + i">
                        <td>{{ fmtDate(a.created_at) }}</td>
                        <td>{{ a.action }}</td>
                        <td>{{ a.actor }}</td>
                        <td>{{ a.ip_address || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="sv-modal-row muted">
                  <i class="fas fa-magnifying-glass-chart" aria-hidden="true"></i>
                  <span>{{ $t('stayview.auditEmpty') }}</span>
                </div>
              </div>
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
              <div class="sv-dropdown">
                <button
                  type="button"
                  class="btn btn-secondary sv-modal-manage"
                  :disabled="actionBusy"
                  @click="moreOpen = !moreOpen"
                >
                  <i class="fas fa-ellipsis" aria-hidden="true"></i> {{ $t('stayview.more') }}
                </button>
                <Transition name="sv-pop">
                  <ul v-if="moreOpen" class="sv-dropdown-menu">
                    <li v-if="['pending', 'confirmed', 'checked_in'].includes(activeBar.rawStatus)">
                      <button type="button" @click="openPaymentModal">
                        <i class="fas fa-money-bill-wave" aria-hidden="true"></i> {{ $t('stayview.addPayment') }}
                      </button>
                    </li>
                    <li v-if="['pending', 'confirmed', 'checked_in'].includes(activeBar.rawStatus)">
                      <button type="button" @click="openAmendModal(false)">
                        <i class="fas fa-calendar-check" aria-hidden="true"></i> {{ $t('stayview.amendStay') }}
                      </button>
                    </li>
                    <li v-if="['pending', 'confirmed', 'checked_in'].includes(activeBar.rawStatus)">
                      <button type="button" @click="openAmendModal(true)">
                        <i class="fas fa-arrows-left-right" aria-hidden="true"></i> {{ $t('stayview.roomMove') }}
                      </button>
                    </li>
                    <li v-if="['pending', 'confirmed', 'checked_in'].includes(activeBar.rawStatus)">
                      <button type="button" @click="openChargeModal">
                        <i class="fas fa-receipt" aria-hidden="true"></i> {{ $t('stayview.addCharges') }}
                      </button>
                    </li>
                    <li v-if="['pending', 'confirmed', 'checked_in'].includes(activeBar.rawStatus)">
                      <button type="button" @click="openFolioOp('discount')">
                        <i class="fas fa-percent" aria-hidden="true"></i> {{ $t('stayview.applyDiscount') }}
                      </button>
                    </li>
                    <li v-if="['pending', 'confirmed', 'checked_in'].includes(activeBar.rawStatus)">
                      <button type="button" @click="openFolioOp('adjustment')">
                        <i class="fas fa-scale-balanced" aria-hidden="true"></i> {{ $t('stayview.folioAdjustment') }}
                      </button>
                    </li>
                    <li v-if="['pending', 'confirmed', 'checked_in'].includes(activeBar.rawStatus)">
                      <button type="button" @click="openFolioOp('inclusion')">
                        <i class="fas fa-gift" aria-hidden="true"></i> {{ $t('stayview.folioInclusion') }}
                      </button>
                    </li>
                    <li v-if="['pending', 'confirmed', 'checked_in'].includes(activeBar.rawStatus)">
                      <button type="button" @click="openFolioOp('move')">
                        <i class="fas fa-repeat" aria-hidden="true"></i> {{ $t('stayview.transferFolio') }}
                      </button>
                    </li>
                    <li v-if="['pending', 'confirmed', 'checked_in'].includes(activeBar.rawStatus)">
                      <button type="button" @click="openFolioOp('move', 'split')">
                        <i class="fas fa-code-branch" aria-hidden="true"></i> {{ $t('stayview.splitFolio') }}
                      </button>
                    </li>
                    <li v-if="['pending', 'confirmed', 'checked_in'].includes(activeBar.rawStatus)">
                      <button type="button" @click="openFolioOp('move', 'cut')">
                        <i class="fas fa-scissors" aria-hidden="true"></i> {{ $t('stayview.cutFolio') }}
                      </button>
                    </li>
                    <li v-if="['pending', 'confirmed', 'checked_in'].includes(activeBar.rawStatus)">
                      <button type="button" @click="openFolioOp('upload')">
                        <i class="fas fa-paperclip" aria-hidden="true"></i> {{ $t('stayview.uploadFiles') }}
                      </button>
                    </li>
                    <li v-if="canVoidReservation">
                      <button type="button" class="danger" @click="openVoid">
                        <i class="fas fa-trash-can" aria-hidden="true"></i> {{ $t('stayview.voidReservation') }}
                      </button>
                    </li>
                  </ul>
                </Transition>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Add payment modal for the active stay -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="paymentModal" class="sv-modal-backdrop" @click.self="paymentModal = false">
          <div class="sv-modal sv-modal-sm" role="dialog" aria-modal="true" :aria-label="$t('stayview.addPayment')">
            <div class="sv-modal-head bar-green">
              <span class="sv-modal-head-icon"><i class="fas fa-money-bill-wave" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ $t('stayview.paymentTitle') }}</h3>
                <span class="sv-modal-status">{{ activeBar?.label }}</span>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="paymentModal = false">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <label class="sv-field">
                <span>{{ $t('stayview.paymentAmount') }}</span>
                <input v-model.number="paymentForm.amount" type="number" min="0" step="0.01" class="input" data-field="amount" :class="{ 'sv-input-error': paymentErrors.amount }" required />
                <span v-if="paymentErrors.amount" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ paymentErrors.amount }}</span>
              </label>
              <div class="sv-field">
                <PaymentMethodSelect
                  v-model:method="paymentForm.payment_method"
                  v-model:provider="paymentForm.payment_provider"
                />
                <span v-if="paymentErrors.payment_method || paymentErrors.payment_provider" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ paymentErrors.payment_method || paymentErrors.payment_provider }}</span>
              </div>
              <label class="sv-field">
                <span>{{ $t('stayview.paymentRef') }}</span>
                <input v-model="paymentForm.transaction_reference" type="text" class="input" />
              </label>
              <p v-if="actionError" class="sv-action-error">{{ actionError }}</p>
            </div>
            <div class="sv-modal-actions">
              <button type="button" class="btn btn-secondary" :disabled="actionBusy" @click="paymentModal = false">
                {{ $t('common.close') }}
              </button>
              <button type="button" class="btn btn-primary" :disabled="actionBusy || !(paymentForm.amount > 0)" @click="submitPayment">
                <i class="fas fa-check" aria-hidden="true"></i>
                {{ actionBusy ? $t('common.loading') : $t('stayview.savePayment') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Amend stay / room move modal -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="amendModal" class="sv-modal-backdrop" @click.self="amendModal = false">
          <div class="sv-modal sv-modal-sm" role="dialog" aria-modal="true" :aria-label="$t('stayview.amendStay')">
            <div class="sv-modal-head bar-blue">
              <span class="sv-modal-head-icon"><i class="fas fa-calendar-check" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ amendIsRoomMove ? $t('stayview.roomMove') : $t('stayview.amendStay') }}</h3>
                <span class="sv-modal-status">{{ activeBar?.label }}</span>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="amendModal = false">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <div class="sv-tab-section">{{ $t('stayview.guestName') }}</div>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('reservations.firstName') }}</span>
                  <input v-model="amendForm.first_name" type="text" class="input" data-field="first_name" :class="{ 'sv-input-error': amendErrors.first_name }" required />
                  <span v-if="amendErrors.first_name" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ amendErrors.first_name }}</span>
                </label>
                <label class="sv-field">
                  <span>{{ $t('reservations.lastName') }}</span>
                  <input v-model="amendForm.last_name" type="text" class="input" data-field="last_name" :class="{ 'sv-input-error': amendErrors.last_name }" required />
                  <span v-if="amendErrors.last_name" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ amendErrors.last_name }}</span>
                </label>
              </div>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('stayview.phone') }}</span>
                  <PhoneInput v-model="amendForm.guest_phone" v-model:countryCode="amendForm.country_code" :error="amendErrors.guest_phone" />
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.email') }}</span>
                  <input v-model="amendForm.guest_email" type="email" class="input" data-field="guest_email" :class="{ 'sv-input-error': amendErrors.guest_email }" />
                  <span v-if="amendErrors.guest_email" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ amendErrors.guest_email }}</span>
                </label>
              </div>
              <div class="sv-tab-section">{{ $t('stayview.room') }}</div>
              <label class="sv-field">
                <span>{{ $t('stayview.room') }}</span>
                <SearchableSelect
                  v-model="amendForm.room_id"
                  :options="roomMoveOptions"
                  :search-placeholder="$t('stayview.searchRoom')"
                  force-search
                />
                <span v-if="amendErrors.room_id" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ amendErrors.room_id }}</span>
              </label>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('stayview.arrival') }}</span>
                  <input v-model="amendForm.check_in_date" type="date" class="input" data-field="check_in_date" :class="{ 'sv-input-error': amendErrors.check_in_date }" required />
                  <span v-if="amendErrors.check_in_date" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ amendErrors.check_in_date }}</span>
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.departure') }}</span>
                  <input v-model="amendForm.check_out_date" type="date" class="input" data-field="check_out_date" :class="{ 'sv-input-error': amendErrors.check_out_date }" required />
                  <span v-if="amendErrors.check_out_date" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ amendErrors.check_out_date }}</span>
                </label>
              </div>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('reservations.adultsLabel') }}</span>
                  <input v-model.number="amendForm.num_adults" type="number" min="1" class="input" data-field="num_adults" :class="{ 'sv-input-error': amendErrors.num_adults }" required />
                  <span v-if="amendErrors.num_adults" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ amendErrors.num_adults }}</span>
                </label>
                <label class="sv-field">
                  <span>{{ $t('reservations.childrenLabel') }}</span>
                  <input v-model.number="amendForm.num_children" type="number" min="0" class="input" data-field="num_children" :class="{ 'sv-input-error': amendErrors.num_children }" />
                  <span v-if="amendErrors.num_children" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ amendErrors.num_children }}</span>
                </label>
              </div>
              <p v-if="actionError" class="sv-action-error">{{ actionError }}</p>
            </div>
            <div class="sv-modal-actions">
              <button type="button" class="btn btn-secondary" :disabled="actionBusy" @click="amendModal = false">
                {{ $t('common.close') }}
              </button>
              <button type="button" class="btn btn-primary" :disabled="actionBusy" @click="submitAmend">
                <i class="fas fa-check" aria-hidden="true"></i>
                {{ actionBusy ? $t('common.loading') : $t('stayview.saveAmend') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Add charges modal for the active stay -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="chargeModal" class="sv-modal-backdrop" @click.self="chargeModal = false">
          <div class="sv-modal sv-modal-sm" role="dialog" aria-modal="true" :aria-label="$t('stayview.addCharges')">
            <div class="sv-modal-head bar-blue">
              <span class="sv-modal-head-icon"><i class="fas fa-receipt" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ $t('stayview.chargeTitle') }}</h3>
                <span class="sv-modal-status">{{ activeBar?.label }}</span>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="chargeModal = false">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <label class="sv-field">
                <span>{{ $t('stayview.chargeDescription') }}</span>
                <input v-model="chargeForm.description" type="text" class="input" data-field="description" :class="{ 'sv-input-error': chargeErrors.description }" required maxlength="255" />
                <span v-if="chargeErrors.description" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ chargeErrors.description }}</span>
              </label>
              <label class="sv-field">
                <span>{{ $t('stayview.paymentAmount') }}</span>
                <input v-model.number="chargeForm.amount" type="number" min="0" step="0.01" class="input" data-field="amount" :class="{ 'sv-input-error': chargeErrors.amount }" required />
                <span v-if="chargeErrors.amount" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ chargeErrors.amount }}</span>
              </label>
              <p v-if="actionError" class="sv-action-error">{{ actionError }}</p>
            </div>
            <div class="sv-modal-actions">
              <button type="button" class="btn btn-secondary" :disabled="actionBusy" @click="chargeModal = false">
                {{ $t('common.close') }}
              </button>
              <button type="button" class="btn btn-primary" :disabled="actionBusy || !chargeForm.description || !(chargeForm.amount > 0)" @click="submitCharge">
                <i class="fas fa-check" aria-hidden="true"></i>
                {{ actionBusy ? $t('common.loading') : $t('stayview.saveCharge') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Folio operations modal (discount / adjustment / inclusion / move / upload) -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="folioOp" class="sv-modal-backdrop" @click.self="folioOp = null">
          <div class="sv-modal sv-modal-sm" role="dialog" aria-modal="true" :aria-label="folioOpTitle">
            <div class="sv-modal-head bar-blue">
              <span class="sv-modal-head-icon"><i class="fas fa-folder-open" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ folioOpTitle }}</h3>
                <span class="sv-modal-status">{{ activeBar?.label }}</span>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="folioOp = null">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <template v-if="folioOp === 'discount'">
                <label class="sv-field">
                  <span>{{ $t('stayview.discountAmount') }}</span>
                  <input v-model.number="folioOpForm.amount" type="number" min="0" step="0.01" class="input" data-field="amount" required />
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.folioNote') }}</span>
                  <input v-model="folioOpForm.description" type="text" class="input" data-field="description" maxlength="255" />
                </label>
              </template>
              <template v-else-if="folioOp === 'adjustment'">
                <label class="sv-field">
                  <span>{{ $t('stayview.adjustmentAmount') }}</span>
                  <input v-model.number="folioOpForm.amount" type="number" step="0.01" class="input" data-field="amount" placeholder="+… / −…" required />
                </label>
                <p class="sv-cap sv-note">{{ $t('stayview.adjustmentHint') }}</p>
                <label class="sv-field">
                  <span>{{ $t('stayview.folioNote') }}</span>
                  <input v-model="folioOpForm.description" type="text" class="input" data-field="description" maxlength="255" />
                </label>
              </template>
              <template v-else-if="folioOp === 'inclusion'">
                <label class="sv-field">
                  <span>{{ $t('stayview.chargeDescription') }}</span>
                  <input v-model="folioOpForm.description" type="text" class="input" data-field="description" required maxlength="255" />
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.adjustmentAmount') }}</span>
                  <input v-model.number="folioOpForm.amount" type="number" min="0" step="0.01" class="input" data-field="amount" :placeholder="$t('stayview.inclusionAmountHint')" />
                </label>
                <p class="sv-cap sv-note">{{ $t('stayview.inclusionHint') }}</p>
              </template>
              <template v-else-if="folioOp === 'move'">
                <div class="sv-status-grid">
                  <button
                    v-for="m in moveModes"
                    :key="m.key"
                    type="button"
                    class="sv-status-btn"
                    :class="{ active: folioMoveMode === m.key }"
                    :disabled="actionBusy"
                    @click="folioMoveMode = m.key"
                  >
                    <span class="sv-cap">{{ m.label }}</span>
                  </button>
                </div>
                <label class="sv-field">
                  <span>{{ $t('stayview.moveAmount') }}</span>
                  <input v-model.number="folioOpForm.amount" type="number" min="0" step="0.01" class="input" data-field="amount" required />
                </label>
                <label v-if="folioMoveMode !== 'newfolio'" class="sv-field">
                  <span>{{ $t('stayview.targetFolio') }}</span>
                  <select v-model="folioOpForm.target_reservation_id" class="input" data-field="target_reservation_id" required>
                    <option value="" disabled>{{ $t('stayview.selectTarget') }}</option>
                    <option v-for="opt in folioTargetOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </label>
                <label v-else class="sv-field">
                  <span>{{ $t('stayview.newFolioRoom') }}<em class="sv-auto"> · {{ $t('stayview.optional') }}</em></span>
                  <SearchableSelect
                    v-model="folioOpForm.new_room_id"
                    :options="roomMoveOptions"
                    :search-placeholder="$t('stayview.searchRoom')"
                    force-search
                  />
                </label>
                <p class="sv-cap sv-note">
                  {{ folioMoveMode === 'newfolio' ? $t('stayview.newFolioHint') : $t('stayview.moveHint') }}
                </p>
                <label class="sv-field">
                  <span>{{ $t('stayview.folioNote') }}</span>
                  <input v-model="folioOpForm.description" type="text" class="input" data-field="description" maxlength="255" />
                </label>
              </template>
              <template v-else>
                <label class="sv-field">
                  <span>{{ $t('stayview.chooseFiles') }}</span>
                  <input
                    type="file"
                    class="input"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    multiple
                    @change="onFolioFilesPick"
                  />
                </label>
                <ul v-if="folioOpForm.files.length" class="sv-file-list">
                  <li v-for="(f, i) in folioOpForm.files" :key="i">
                    <span>{{ f.name }}</span>
                    <span class="sv-muted-cell sv-cap">{{ (f.size / 1024).toFixed(0) }} KB</span>
                  </li>
                </ul>
                <p v-else class="sv-cap sv-note">{{ $t('stayview.noFiles') }}</p>
              </template>
              <p v-if="actionError" class="sv-action-error">{{ actionError }}</p>
            </div>
            <div class="sv-modal-actions">
              <button type="button" class="btn btn-secondary" :disabled="actionBusy" @click="folioOp = null">
                {{ $t('common.close') }}
              </button>
              <button type="button" class="btn btn-primary" :disabled="actionBusy || !folioOpCanPost" @click="submitFolioOp">
                <i class="fas fa-check" aria-hidden="true"></i>
                {{ actionBusy ? $t('common.loading') : folioOpPostLabel }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Edit folio entry modal: reword the note or fix the posted amount -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="folioEdit" class="sv-modal-backdrop" @click.self="folioEdit = null">
          <div class="sv-modal sv-modal-sm" role="dialog" aria-modal="true" :aria-label="$t('folio.edit')">
            <div class="sv-modal-head bar-blue">
              <span class="sv-modal-head-icon"><i class="fas fa-pen" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ $t('folio.editTitle') }}</h3>
                <span class="sv-modal-status">{{ activeBar?.label }}</span>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="folioEdit = null">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <label class="sv-field">
                <span>{{ $t('folio.description') }}</span>
                <input v-model="folioEditForm.description" type="text" class="input" data-field="description" :class="{ 'sv-input-error': folioEditErrors.description }" required maxlength="255" />
                <span v-if="folioEditErrors.description" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ folioEditErrors.description }}</span>
              </label>
              <label class="sv-field">
                <span>{{ $t('folio.amount') }}</span>
                <input v-model.number="folioEditForm.amount" type="number" min="0" step="0.01" class="input" data-field="amount" :class="{ 'sv-input-error': folioEditErrors.amount }" required />
                <span v-if="folioEditErrors.amount" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ folioEditErrors.amount }}</span>
              </label>
              <p v-if="actionError" class="sv-action-error">{{ actionError }}</p>
            </div>
            <div class="sv-modal-actions">
              <button type="button" class="btn btn-secondary" :disabled="actionBusy" @click="folioEdit = null">
                {{ $t('common.close') }}
              </button>
              <button
                type="button"
                class="btn btn-primary"
                :disabled="actionBusy || !folioEditForm.description?.trim() || !(folioEditForm.amount > 0)"
                @click="submitEditEntry"
              >
                <i class="fas fa-check" aria-hidden="true"></i>
                {{ actionBusy ? $t('common.loading') : $t('folio.save') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Void reservation modal -->
    <Teleport to="body">
      <Transition name="sv-modal">
        <div v-if="voidOpen" class="sv-modal-backdrop" @click.self="voidOpen = false">
          <div class="sv-modal sv-modal-sm" role="dialog" aria-modal="true" :aria-label="$t('stayview.voidReservation')">
            <div class="sv-modal-head bar-red">
              <span class="sv-modal-head-icon"><i class="fas fa-trash-can" aria-hidden="true"></i></span>
              <div class="sv-modal-head-text">
                <h3>{{ $t('stayview.voidTitle') }}</h3>
                <span class="sv-modal-status">{{ activeBar?.label }}</span>
              </div>
              <button type="button" class="sv-modal-close" :aria-label="$t('common.close')" @click="voidOpen = false">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div class="sv-modal-body">
              <p class="sv-void-hint">{{ $t('stayview.voidHint') }}</p>
              <label class="sv-field">
                <span>{{ $t('stayview.guestName') }}</span>
                <input v-model="voidName" type="text" class="input" required :placeholder="activeBar?.label || ''" />
              </label>
              <p v-if="actionError" class="sv-action-error">{{ actionError }}</p>
            </div>
            <div class="sv-modal-actions">
              <button type="button" class="btn btn-secondary" :disabled="actionBusy" @click="voidOpen = false">
                {{ $t('common.close') }}
              </button>
              <button type="button" class="btn sv-modal-danger" :disabled="actionBusy || !voidName.trim()" @click="confirmVoid">
                {{ actionBusy ? $t('common.loading') : $t('stayview.confirmVoid') }}
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
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('reservations.firstName') }}</span>
                  <input v-model="bookingForm.first_name" type="text" class="input" data-field="first_name" :class="{ 'sv-input-error': bookingErrors.first_name }" required />
                  <span v-if="bookingErrors.first_name" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ bookingErrors.first_name }}</span>
                </label>
                <label class="sv-field">
                  <span>{{ $t('reservations.lastName') }}</span>
                  <input v-model="bookingForm.last_name" type="text" class="input" data-field="last_name" :class="{ 'sv-input-error': bookingErrors.last_name }" required />
                  <span v-if="bookingErrors.last_name" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ bookingErrors.last_name }}</span>
                </label>
              </div>
              <label class="sv-field">
                <span>{{ $t('reservations.guestPhone') }}</span>
                <PhoneInput v-model="bookingForm.guest_phone" v-model:countryCode="bookingForm.country_code" :error="bookingErrors.guest_phone" required />
              </label>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('stayview.company') }}</span>
                  <input v-model="bookingForm.company_name" type="text" class="input" data-field="company_name" maxlength="191" :placeholder="$t('stayview.optional')" />
                </label>
                <label class="sv-field">
                  <span>{{ $t('reservations.businessSource') }}</span>
                  <select v-model="bookingForm.business_source" class="input">
                    <option value=""></option>
                    <option v-for="src in bookingSourceOptions" :key="src.value" :value="src.value">{{ src.label }}</option>
                  </select>
                </label>
              </div>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('reservations.bookingType') }}</span>
                  <select v-model="bookingForm.booking_type" class="input" data-field="booking_type" :class="{ 'sv-input-error': bookingErrors.booking_type }" required>
                    <option value="single">{{ $t('common.bookingTypes.single') }}</option>
                    <option value="couple">{{ $t('common.bookingTypes.couple') }}</option>
                    <option value="family">{{ $t('common.bookingTypes.family') }}</option>
                    <option value="group">{{ $t('common.bookingTypes.group') }}</option>
                  </select>
                  <span v-if="bookingErrors.booking_type" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ bookingErrors.booking_type }}</span>
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.room') }}</span>
                  <SearchableSelect
                    v-model="bookingForm.room_id"
                    :options="roomMoveOptions"
                    :search-placeholder="$t('stayview.searchRoom')"
                    force-search
                  />
                  <span v-if="bookingErrors.room_id" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ bookingErrors.room_id }}</span>
                </label>
              </div>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('stayview.arrival') }}</span>
                  <input v-model="bookingForm.check_in_date" type="date" class="input" data-field="check_in_date" :class="{ 'sv-input-error': bookingErrors.check_in_date }" required />
                  <span v-if="bookingErrors.check_in_date" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ bookingErrors.check_in_date }}</span>
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.departure') }}</span>
                  <input v-model="bookingForm.check_out_date" type="date" class="input" data-field="check_out_date" :class="{ 'sv-input-error': bookingErrors.check_out_date }" required />
                  <span v-if="bookingErrors.check_out_date" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ bookingErrors.check_out_date }}</span>
                </label>
              </div>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('stayview.total') }}<em class="sv-auto"> · {{ $t('reservations.autoTotal', { amount: bookingNights && bookingNights > 0 ? formatPrice(bookingNights * bookingRate) : 0 }) }}</em></span>
                  <input
                    :value="bookingTotal"
                    @input="bookingForm.total_amount = Number($event.target.value) || 0"
                    type="number" min="0" class="input" required />
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.advancePaid') }}</span>
                  <input v-model.number="bookingForm.advance_payment" type="number" min="0" class="input" data-field="advance_payment" :class="{ 'sv-input-error': bookingErrors.advance_payment }" />
                  <span v-if="bookingErrors.advance_payment" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ bookingErrors.advance_payment }}</span>
                </label>
              </div>
              <div class="sv-field-row">
                <label class="sv-field">
                  <span>{{ $t('stayview.advanceAccount') }}</span>
                  <select v-model="bookingForm.advance_payment_method" class="input">
                    <option value="">—</option>
                    <option value="cash">{{ $t('paymentFields.methods.cash') }}</option>
                    <option value="mobile_money">{{ $t('paymentFields.methods.mobile_money') }}</option>
                    <option value="bank">{{ $t('common.paymentMethods.bankTransfer') }}</option>
                    <option value="card">{{ $t('paymentFields.methods.card') }}</option>
                  </select>
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.advanceDate') }}</span>
                  <input v-model="bookingForm.advance_payment_date" type="date" class="input" />
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
                  <input v-model="guestForm.first_name" type="text" class="input" data-field="first_name" :class="{ 'sv-input-error': guestErrors.first_name }" required />
                  <span v-if="guestErrors.first_name" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ guestErrors.first_name }}</span>
                </label>
                <label class="sv-field">
                  <span>{{ $t('stayview.lastName') }}</span>
                  <input v-model="guestForm.last_name" type="text" class="input" data-field="last_name" :class="{ 'sv-input-error': guestErrors.last_name }" required />
                  <span v-if="guestErrors.last_name" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ guestErrors.last_name }}</span>
                </label>
              </div>
              <label class="sv-field">
                <span>{{ $t('stayview.phone') }}</span>
                <PhoneInput v-model="guestForm.phone" v-model:countryCode="guestForm.country_code" :error="guestErrors.phone" required />
              </label>
              <label class="sv-field">
                <span>{{ $t('stayview.email') }}</span>
                <input v-model="guestForm.email" type="email" class="input" data-field="email" :class="{ 'sv-input-error': guestErrors.email }" />
                <span v-if="guestErrors.email" class="sv-field-msg" role="alert"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> {{ guestErrors.email }}</span>
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
                  <SearchableSelect
                    v-model="ledgerForm.category"
                    :options="ledgerCategoryOptions"
                    :empty-label="$t('stayview.allCategories')"
                    force-search
                  />
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
                <div v-else class="table-scroll">
                <table class="sv-ledger-table">
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotificationStore } from '@/stores/notifications'
import { roomApi, reservationApi, guestApi, housekeepingApi, laundryApi, invoiceApi, inventoryApi, paymentApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import AlertModal from '@/components/AlertModal.vue'
import RoleBadge from '@/components/RoleBadge.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import PaymentMethodSelect from '@/components/PaymentMethodSelect.vue'
import PhoneInput from '@/components/PhoneInput.vue'
import { requiresProvider } from '@/utils/payments'
import { formatDateDMY } from '@/utils/dates'
import { formatPhoneGaps, formatPhoneNational, validatePhoneNumber } from '@/utils/phone'
import {
  after,
  bindBlurValidation,
  collectErrors,
  email,
  minInteger,
  nonNegative,
  phone,
  positive,
  required,
} from '@/utils/formValidation'
import { useCategoriesStore } from '@/stores/categories'

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
    // Housekeeping staff (and admins/managers viewing the HK landing) get the
    // whole tape from the board: rooms, guest stays and open tasks through a
    // level:40 endpoint the housekeeping role is allowed to read. Everyone
    // else keeps the front-office feed (reservations are level:60).
    const windowParams = {
      window_start: isoKey(windowStart.value),
      window_end: isoKey(addDays(windowStart.value, DAYS)),
      search: search.value.trim() || undefined,
    }

    let roomRows = []
    let reservationRows = []
    if (canSeeHousekeeping.value) {
      const board = await housekeepingApi.board(windowParams).then((res) => res.data).catch(() => null)
      if (board) {
        roomRows = board.rooms ?? []
        reservationRows = board.stays ?? []
        hkTasks.value = board.tasks ?? []
        hkLaundry.value = board.laundry_orders ?? []
      }
    } else {
      const [rooms, stays] = await Promise.all([
        // Low-level staff (e.g. kitchen, waiter if they land here) cannot read
        // rooms (level 40) or reservations (level 60): render an empty chart
        // instead of flashing the backend's 403 message.
        fetchAll(roomApi.index).catch(() => []),
        // Only the stays overlapping the visible 14-day window — with real
        // booking volume, pulling every reservation ever made would crawl.
        fetchAll(reservationApi.index, {
          exclude_status: ['cancelled', 'no_show'],
          ...windowParams,
        }).catch(() => []),
      ])
      roomRows = rooms
      reservationRows = stays
    }
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
    // Bar colors: blue = checked out, red = payment pending, green = in-house
    // or fully paid. An in-house guest shows green even when a balance remains
    // to be settled at check-out — the stay has started, so there is nothing
    // to be "waiting for".
    const balance = Number(r.balance_due ?? r.balance ?? 0)
    const paymentPending = balance > 0
    const colorClass =
      r.status === 'checked_out' ? 'bar-blue'
      : r.status === 'checked_in' ? 'bar-green'
      : paymentPending ? 'bar-red' : 'bar-green'
    const fmt = (d) => `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`
    ;(map[roomId] ||= []).push({
      id: r.reservation_id,
      roomId,
      arrivalIso: isoKey(arrival),
      departureIso: isoKey(departure),
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
      checkedInAt: r.checked_in_at ? fmtDate(r.checked_in_at) : '',
      checkedOutAt: r.checked_out_at ? fmtDate(r.checked_out_at) : '',
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
  if (isHousekeepingStaff.value) {
    const room = rooms.value.find((r) => r.room_id === bar.roomId)
    if (room) showHkTip(event, room)
    return
  }
  barTip.value = { ...bar, ...tipPosition(event) }
}

/** Keeps the popover glued to the cursor while moving within a bar. */
function moveBarTip(event) {
  if (barTip.value) Object.assign(barTip.value, tipPosition(event))
  if (isHousekeepingStaff.value) moveHkTip(event)
}

/** Hides the popover when the cursor leaves the bar. Housekeeping keeps the
 * floating card open a beat longer so the cursor can hop onto it and pin it. */
function hideBarTip() {
  barTip.value = null
  if (isHousekeepingStaff.value) scheduleHideHkTip()
  else hideHkTip()
}

/* ---------------- Booking-bar click modal ---------------- */

// Bar currently shown in the click modal (null = closed).
const activeBar = ref(null)

// Folio loaded from reservationApi.folio() for the active bar.
const folio = ref(null)
const folioLoading = ref(false)

/**
 * Opens the reservation summary modal for the clicked bar and, when the stay
 * has a reservation reference, fetches its full folio (postings + audit trail).
 */
function openBarModal(bar) {
  hideBarTip()
  activeBar.value = bar
  folio.value = null
  stayTab.value = 'folio'
  moreOpen.value = false
  roomTasks.value = []
  roomTasksLoaded.value = false
  if (bar?.id) loadFolio(bar.id)
  else folioLoading.value = false
}

/**
 * Entry point for every bar click on the tape.
 *
 * Housekeeping staff get the stay-view layout but only housekeeping activities:
 * tapping a bar pins the assigned-work card for that room — never the front-desk
 * folio, payments or room charges. Front-desk roles keep the full reservation
 * modal.
 */
function onBarTap(event, bar) {
  if (isHousekeepingStaff.value) {
    const room = rooms.value.find((r) => r.room_id === bar.roomId)
    if (room) showHkTip(event, room, true)
    return
  }
  openBarModal(bar)
}

/**
 * Entry point for clicks on the empty day cells of a room row.
 *
 * Housekeeping staff cannot book rooms: a vacant cell tap just shows the room
 * details (housekeeping status panel). Front-desk roles keep the booking flow.
 */
function onCellTap(event, room, iso) {
  if (!isVacantCell(room, iso)) return
  if (isHousekeepingStaff.value) {
    openRoomModal(room, event)
    return
  }
  bookVacantDay(room, iso)
}

/** Closes the reservation summary modal. */
function closeBarModal() {
  activeBar.value = null
  folio.value = null
  folioLoading.value = false
  stayTab.value = 'folio'
  moreOpen.value = false
  roomTasks.value = []
  roomTasksLoaded.value = false
}

/**
 * Formats a numeric amount with thousands separators. Pass decimals > 0 for
 * money that must read like a till slip (e.g. TZS 540,000.00).
 */
function fmtNum(n, decimals = 0) {
  const value = Number(n || 0)
  return decimals > 0 ? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : value.toLocaleString()
}

/** Human-readable label for a payment method (falls back to the raw value). */
function paymentMethodLabel(method) {
  if (!method) return '—'
  const key = `paymentFields.methods.${method}`
  return te(key) ? t(key) : String(method).replace(/_/g, ' ')
}

/**
 * Loads the reservation folio (payments, restaurant/bar orders, laundry and
 * audit trail) shown in the stay-view modal. Non-fatal on error.
 */
async function loadFolio(id) {
  folioLoading.value = true
  try {
    const res = await reservationApi.folio(id)
    folio.value = res.data
  } catch {
    folio.value = null
  } finally {
    folioLoading.value = false
  }
}

/* ---------------- Stay-view tabs & panels ---------------- */

// Active tab in the stay-view modal; "More" dropdown open state.
const stayTab = ref('folio')
const moreOpen = ref(false)

// The reference panel's tab strip: Folio Operations, Booking Details, Guest
// Details, Room Charges, Credit Card, Tasks and Audit Trail.
const stayTabs = computed(() => [
  { key: 'folio', icon: 'fas fa-receipt', label: t('stayview.tabs.folio') },
  { key: 'booking', icon: 'fas fa-calendar-days', label: t('stayview.tabs.booking') },
  { key: 'guest', icon: 'fas fa-user', label: t('stayview.tabs.guest') },
  { key: 'charges', icon: 'fas fa-bed', label: t('stayview.tabs.charges') },
  { key: 'card', icon: 'fas fa-credit-card', label: t('stayview.tabs.card') },
  { key: 'tasks', icon: 'fas fa-broom', label: t('stayview.tabs.tasks') },
  { key: 'audit', icon: 'fas fa-magnifying-glass-chart', label: t('stayview.tabs.audit') },
])

/** Compact header strip under the modal title (arrival/departure/nights/room/no). */
const stayStrip = computed(() => {
  const bar = activeBar.value
  if (!bar) return []
  const parts = String(bar.dates || '').split('→').map((s) => s.trim())
  return [
    { key: 'arrival', label: t('stayview.arrival'), value: bar.checkedInAt || parts[0] || '—' },
    { key: 'departure', label: t('stayview.departure'), value: parts[1] || '—' },
    { key: 'nights', label: t('stayview.nights'), value: String(bar.nights ?? '—') },
    {
      key: 'room',
      label: t('stayview.room'),
      value: [bar.roomNumber, bar.roomType].filter((v) => v && v !== '—').join(' · ') || '—',
    },
    { key: 'resno', label: t('stayview.resNo'), value: bar.reference || '—' },
    {
      key: 'balance',
      label: t('stayview.balance'),
      value: folio.value?.folio ? `TZS ${fmtNum(folio.value.folio.balance_due ?? 0, 2)}` : '—',
      fresh: true,
    },
  ]
})

/** Formats an ISO date/time string for the audit trail and task rows. */
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`
}

/** Label/value rows for the Booking Details tab (folio-aware with bar fallback). */
const bookingGrid = computed(() => {
  const res = folio.value?.reservation || null
  const src = res || activeBar.value || {}
  const show = (v) => (v === undefined || v === null || v === '' ? '—' : String(v))
  const fmtDay = (v) => (v ? formatDateDMY(v) : '')
  const roomName = res?.room
    ? `${res.room.room_number || ''}${res.room.room_type ? ' · ' + res.room.room_type : ''}`.trim()
    : ''
  return [
    { label: t('reservations.guestName'), value: show(src.guest_name || src.label) },
    { label: t('common.status'), value: show(String(src.status || '').replace('_', ' ')) },
    { label: t('reservations.bookingType'), value: show(String(src.booking_type || '').replace('_', ' ')) },
    { label: t('reservations.bookingSource'), value: show(String(src.booking_source || src.source || '').replace('_', ' ')) },
    { label: t('reservations.bookingDate'), value: show(fmtDay(src.booking_date)) },
    { label: t('stayview.reference'), value: show(src.booking_reference || src.reference) },
    { label: t('stayview.company'), value: show(src.company_name) },
    { label: t('reservations.businessSource'), value: show(String(src.business_source || '').replace('_', ' ')) },
    { label: t('stayview.rate'), value: `TZS ${fmtNum(src.rate ?? src.room?.price_per_night ?? 0, 2)}` },
    { label: t('stayview.room'), value: show(roomName || src.roomNumber) },
    {
      label: t('stayview.arrival'),
      value: show(fmtDay(src.check_in_date || src.arrival_date) || (src.arrivalIso ? formatDateDMY(src.arrivalIso) : '')),
    },
    {
      label: t('stayview.departure'),
      value: show(fmtDay(src.check_out_date || src.departure_date) || (src.departureIso ? formatDateDMY(src.departureIso) : '')),
    },
    { label: t('reservations.nights'), value: show(src.nights ?? src.num_days ?? '') },
    { label: t('reservations.adultsLabel'), value: show(src.num_adults ?? '') },
    { label: t('reservations.childrenLabel'), value: show(src.num_children ?? '') },
    { label: t('stayview.total'), value: `TZS ${fmtNum(src.total_amount ?? src.total ?? 0, 2)}` },
    { label: t('stayview.advancePaid'), value: `TZS ${fmtNum(src.advance_payment ?? src.advance ?? 0, 2)}` },
    { label: t('stayview.balance'), value: `TZS ${fmtNum(src.balance_due ?? src.balance ?? 0, 2)}` },
  ]
})

/** Label/value rows for the Guest Details tab. */
const guestGrid = computed(() => {
  const res = folio.value?.reservation
  const g = res?.guest || res || activeBar.value || {}
  const show = (v) => (v === undefined || v === null || v === '' ? '—' : String(v))
  return [
    { label: t('stayview.guestName'), value: show(g.full_name || g.guest_name || g.label) },
    { label: t('stayview.phone'), value: show(formatPhoneGaps(g.phone || g.guest_phone)) },
    { label: t('stayview.email'), value: show(g.email || g.guest_email) },
    { label: t('guests.nationality'), value: show(g.nationality || g.country) },
    { label: t('guests.idType'), value: show(g.id_type) },
    { label: t('guests.idNumber'), value: show(g.id_number) },
    { label: t('guests.vipStatus'), value: show(g.vip_status ? t('guests.typeVip') : t('guests.typeRegular')) },
  ]
})

/** Per-night room charge rows derived from the stay dates and room rate. */
const chargeNights = computed(() => {
  const res = folio.value?.reservation || activeBar.value || {}
  const cIn = res.check_in_date || res.arrival_date || res.arrivalIso
  const cOut = res.check_out_date || res.departure_date || res.departureIso
  if (!cIn || !cOut) return []
  const rate = Number(res.room?.price_per_night || 0)
  if (!(rate > 0)) return []
  const nights = []
  for (let d = parseDate(cIn); d < parseDate(cOut); d = addDays(d, 1)) {
    nights.push({ date: formatDateDMY(d), day: d.toLocaleDateString([], { weekday: 'short' }), rate })
  }
  return nights
})
const nightTotal = computed(() => chargeNights.value.reduce((s, n) => s + n.rate, 0))

/**
 * Flattened folio transactions for the DATE | PARTICULAR | DESCRIPTION |
 * USER | AMOUNT ledger. Only room-billed orders/laundry count towards the
 * balance; the manual extra-charge remainder and every payment make up the
 * rest, so the column totals always add up to balance_due.
 */
const folioEntries = computed(() => {
  const f = folio.value || null
  if (!f) return []
  const fol = f.folio || {}
  const entries = []
  for (const o of f.orders || []) {
    if (o.payment_status !== 'billed_to_room') continue
    entries.push({
      key: `o${o.order_id ?? o.order_number}`,
      date: o.date,
      particular: t('folio.roomPosting'),
      description: o.reference || o.order_number || t('folio.order'),
      detail: o.order_type || '',
      user: o.user || '—',
      amount: Number(o.total_amount ?? o.total ?? 0),
      credit: false,
    })
  }
  for (const l of f.laundry || []) {
    if (l.payment_status !== 'billed_to_room') continue
    entries.push({
      key: `l${l.laundry_order_id ?? l.order_number}`,
      date: l.date,
      particular: t('folio.laundry'),
      description: l.order_number || t('folio.laundry'),
      detail: l.service || '',
      user: l.user || '—',
      amount: Number(l.total_charge ?? l.total_amount ?? l.total ?? 0),
      credit: false,
      entryId: null,
    })
  }
  // Persisted front-desk postings (add folio, discount, adjustment,
  // inclusion, transfers/splits/cuts and attachments) render line by line
  // with their own poster and date, and can be voided or downloaded.
  for (const e of f.folio_entries || []) {
    const amount = Number(e.amount ?? 0)
    entries.push({
      key: `e${e.folio_entry_id}`,
      date: e.date,
      time: e.posted_at || e.date || '',
      type: e.type,
      particular: folioEntryLabel(e.type),
      description: e.description || folioEntryLabel(e.type),
      detail: e.reference || '',
      user: e.user || '—',
      amount: Math.abs(amount),
      credit: amount <= 0 && e.type !== 'inclusion',
      muted: e.type === 'attachment' || amount === 0,
      entryId: e.folio_entry_id,
      entryUrl: e.attachment_url ? reservationApi.folioAttachmentUrl(e.folio_entry_id) : '',
      editable: ['room_charge', 'extra_charge', 'adjustment', 'discount', 'inclusion'].includes(e.type) && e.folio_entry_id != null,
    })
  }
  // Legacy manual extra charges (posted before the ledger existed) still show
  // as one aggregate line only when nothing newer accounts for them.
  const legacy = Number(fol.legacy_extra_charges ?? fol.extra_charges ?? 0)
  if (legacy > 0) {
    entries.push({
      key: 'extra',
      date: fol.room_charges_date,
      particular: t('folio.extraCharges'),
      description: t('folio.manualCharge'),
      detail: '',
      user: fol.room_charge_user || '—',
      amount: legacy,
      credit: false,
      entryId: null,
    })
  }
  for (const p of f.payments || []) {
    entries.push({
      key: `p${p.payment_id ?? p.transaction_reference}`,
      date: p.date,
      particular: t('folio.payment'),
      description: paymentMethodLabel(p.payment_method),
      detail: p.transaction_reference || '',
      user: p.user || '—',
      amount: Number(p.amount ?? 0),
      credit: true,
    })
  }
  entries.sort((a, b) => `${a.time || a.date || ''}|${a.key}`.localeCompare(`${b.time || b.date || ''}|${b.key}`))
  return entries
})

// Housekeeping tasks for the active stay's room (Tasks tab).
const roomTasks = ref([])
const roomTasksLoading = ref(false)
const roomTasksLoaded = ref(false)

/** Loads open tasks filtered to the active stay's room. Non-fatal on error. */
async function loadRoomTasks() {
  const room = activeBar.value?.roomId
  roomTasksLoading.value = true
  try {
    if (!room) {
      roomTasks.value = []
      return
    }
    const p = (await housekeepingApi.index({ room_id: room, per_page: 50 })).data
    roomTasks.value = Array.isArray(p) ? p : p?.data || []
  } catch {
    roomTasks.value = []
  } finally {
    roomTasksLoading.value = false
    roomTasksLoaded.value = true
  }
}

/** Switches the stay-view tab, lazily loading the room's tasks when needed. */
function setStayTab(key) {
  stayTab.value = key
  moreOpen.value = false
  if (key === 'tasks' && !roomTasksLoaded.value) loadRoomTasks()
}

/* ---------------- In-place front-desk actions (no navigation) ---------------- */

// Shared busy/error state for every modal action on this page.
const actionBusy = ref(false)
const actionError = ref('')

/** Reads the most specific error a backend call returned: the first field
 * validation error, then the API message, then a locale fallback — so the
 * reception desk sees the real reason instead of a generic sentence.
 */
function apiErrorMsg(err, fallback) {
  const data = err.response?.data
  const first = data?.errors ? Object.values(data.errors)[0] : null
  return (Array.isArray(first) ? first[0] : first) || data?.message || fallback
}

/** Runs a reservation lifecycle action then silently refreshes the chart. */
async function runAction(fn) {
  actionBusy.value = true
  actionError.value = ''
  try {
    await fn()
    closeBarModal()
    await load(true)
  } catch (err) {
    actionError.value = apiErrorMsg(err, t('stayview.actionError'))
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

/* ---------------- Stay-view sub-actions (keep the modal open) ---------------- */

/** Runs a stay-view action, keeps the modal open and refreshes folio + chart. */
async function runStayAction(fn) {
  actionBusy.value = true
  actionError.value = ''
  try {
    await fn()
    if (activeBar.value?.id) await loadFolio(activeBar.value.id)
    await load(true)
  } catch (err) {
    actionError.value = apiErrorMsg(err, t('stayview.actionError'))
  } finally {
    actionBusy.value = false
  }
}

/* ----- Add Payment ----- */
const paymentModal = ref(false)
const paymentForm = ref({})
const paymentErrors = ref({})
const paymentTouched = ref(false)
const paymentSnapshot = ref({})
function openPaymentModal() {
  moreOpen.value = false
  paymentForm.value = { amount: null, payment_method: 'cash', payment_provider: '', transaction_reference: '' }
  paymentErrors.value = {}
  paymentTouched.value = false
  paymentSnapshot.value = { ...paymentForm.value }
  actionError.value = ''
  paymentModal.value = true
}
function paymentRules() {
  return [
    { field: 'amount', check: positive(t) },
    { field: 'payment_method', check: required(t) },
    {
      field: 'payment_provider',
      check: (v, f) => (requiresProvider(f.payment_method) && !v ? t('validations.fieldRequired') : ''),
    },
  ]
}
async function submitPayment() {
  const f = paymentForm.value
  paymentTouched.value = true
  const errors = collectErrors(f, paymentRules())
  if (Object.keys(errors).length) {
    paymentErrors.value = errors
    return
  }
  if (!activeBar.value?.id) return
  const payload = {
    reservation_id: activeBar.value.id,
    amount: f.amount,
    payment_method: f.payment_method,
    payment_provider: f.payment_provider || null,
    transaction_reference: f.transaction_reference || null,
  }
  paymentModal.value = false
  await runStayAction(() => paymentApi.store(payload))
  if (actionError.value) paymentModal.value = true
}
bindBlurValidation(watch, () => paymentForm.value, paymentSnapshot, paymentTouched, paymentErrors, paymentRules)

/* ----- Add Charges ----- */
const chargeModal = ref(false)
const chargeForm = ref({})
const chargeErrors = ref({})
const chargeTouched = ref(false)
const chargeSnapshot = ref({})
function openChargeModal() {
  moreOpen.value = false
  chargeForm.value = { description: '', amount: null }
  chargeErrors.value = {}
  chargeTouched.value = false
  chargeSnapshot.value = { ...chargeForm.value }
  actionError.value = ''
  chargeModal.value = true
}
function chargeRules() {
  return [
    { field: 'description', check: required(t) },
    { field: 'amount', check: positive(t) },
  ]
}
async function submitCharge() {
  const f = chargeForm.value
  chargeTouched.value = true
  const errors = collectErrors(f, chargeRules())
  if (Object.keys(errors).length) {
    chargeErrors.value = errors
    return
  }
  if (!activeBar.value?.id) return
  chargeModal.value = false
  await runStayAction(() =>
    reservationApi.postRoomCharge(activeBar.value.id, { description: f.description, amount: f.amount }),
  )
  if (actionError.value) chargeModal.value = true
}
bindBlurValidation(watch, () => chargeForm.value, chargeSnapshot, chargeTouched, chargeErrors, chargeRules)

/* ----- Folio operations (discount / adjustment / inclusion / move / upload) ----- */

// Active folio-op modal (null = closed). move keeps transfer/split/cut in one
// modal with a mode switch so the ledger pairs stay readable.
const folioOp = ref(null)
const folioOpForm = ref({})
const folioMoveMode = ref('transfer')

/** Human-readable ledger label for a persisted folio entry type. */
function folioEntryLabel(type) {
  const raw = String(type || '')
  const snake = `folio.${raw}`
  if (te(snake)) return t(snake)
  const camel = `folio.${raw.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`
  if (te(camel)) return t(camel)
  return raw.replace(/_/g, ' ')
}

/** Transfer/split/cut/new-folio mode buttons for the move modal. */
const moveModes = computed(() => [
  { key: 'transfer', label: t('stayview.modeTransfer') },
  { key: 'split', label: t('stayview.modeSplit') },
  { key: 'cut', label: t('stayview.modeCut') },
  { key: 'newfolio', label: t('stayview.modeNewFolio') },
])

/** Other active folios to move money onto. */
const folioTargetOptions = computed(() =>
  reservations.value
    .filter((r) => r.status === 'confirmed' || r.status === 'checked_in')
    .map((r) => ({
      value: r.reservation_id,
      label: `${r.guest_name || '—'} · ${r.room?.room_number || '—'} (${r.status.replace('_', ' ')})`,
    })),
)

const folioOpTitle = computed(() => {
  if (folioOp.value === 'discount') return t('stayview.folioDiscountTitle')
  if (folioOp.value === 'adjustment') return t('stayview.folioAdjustmentTitle')
  if (folioOp.value === 'inclusion') return t('stayview.folioInclusionTitle')
  if (folioOp.value === 'move') return t('stayview.folioMoveTitle')
  return t('stayview.folioUploadTitle')
})

const folioOpPostLabel = computed(() => {
  if (folioOp.value === 'discount') return t('stayview.postDiscount')
  if (folioOp.value === 'adjustment') return t('stayview.postAdjustment')
  if (folioOp.value === 'inclusion') return t('stayview.postInclusion')
  if (folioOp.value === 'move') return t('stayview.postMove')
  return t('stayview.postUpload')
})

const folioOpCanPost = computed(() => {
  const f = folioOpForm.value
  if (folioOp.value === 'discount') return Number(f.amount) > 0
  if (folioOp.value === 'adjustment') return f.amount !== '' && Number(f.amount) !== 0
  if (folioOp.value === 'inclusion') return !!(f.description && f.description.trim()) && Number(f.amount) >= 0
  if (folioOp.value === 'move') {
    if (Number(f.amount) <= 0) return false
    return folioMoveMode.value === 'newfolio' ? true : !!f.target_reservation_id
  }
  return f.files && f.files.length > 0
})

function openFolioOp(op, mode = 'transfer') {
  moreOpen.value = false
  folioOp.value = op
  folioMoveMode.value = mode
  folioOpForm.value = { amount: null, description: '', target_reservation_id: '', new_room_id: '', files: [] }
  actionError.value = ''
}

function onFolioFilesPick(event) {
  folioOpForm.value.files = Array.from(event.target.files || [])
}

async function submitFolioOp() {
  const bar = activeBar.value
  const f = folioOpForm.value
  if (!bar?.id || !folioOpCanPost.value) return
  const op = folioOp.value
  let payload = null
  if (op === 'discount') {
    payload = { amount: f.amount, description: f.description || null }
  } else if (op === 'adjustment') {
    payload = { amount: f.amount, description: f.description || null }
  } else if (op === 'inclusion') {
    payload = {
      description: f.description,
      amount: Number.isFinite(Number(f.amount)) && Number(f.amount) > 0 ? Number(f.amount) : 0,
    }
  } else if (op === 'move') {
    payload = {
      mode: folioMoveMode.value,
      target_reservation_id: folioMoveMode.value === 'newfolio' ? undefined : f.target_reservation_id,
      new_folio: folioMoveMode.value === 'newfolio',
      new_room_id: folioMoveMode.value === 'newfolio' && f.new_room_id ? f.new_room_id : undefined,
      amount: f.amount,
      description: f.description || null,
    }
  }
  folioOp.value = null
  await runStayAction(() => {
    if (op === 'discount') return reservationApi.folioDiscount(bar.id, payload)
    if (op === 'adjustment') return reservationApi.folioAdjustment(bar.id, payload)
    if (op === 'inclusion') return reservationApi.folioInclusion(bar.id, payload)
    if (op === 'move') return reservationApi.folioTransfer(bar.id, payload)
    return reservationApi.folioAttachments(bar.id, f.files)
  })
  if (actionError.value) folioOp.value = op
}

/** Voids a persisted ledger entry (reverses its effect on the balance). */
async function voidFolioEntry(e) {
  if (!e?.entryId || actionBusy.value) return
  if (!window.confirm(`${t('folio.void')} · ${e.description} — TZS ${fmtNum(e.amount)}?`)) return
  await runStayAction(() => reservationApi.folioEntryVoid(e.entryId))
}

/** Removes an uploaded folio attachment (file + its ledger row). */
async function removeFolioAttachment(e) {
  if (!e?.entryId || actionBusy.value) return
  await runStayAction(() => reservationApi.folioEntryDeleteAttachment(e.entryId))
}

/* ----- Edit folio entry (reword the note or fix the posted amount) ----- */
const folioEdit = ref(null)
const folioEditForm = ref({})
const folioEditErrors = ref({})

/** Opens the edit form pre-filled from an editable ledger row. */
function openEditEntry(e) {
  if (!e?.entryId) return
  moreOpen.value = false
  folioEdit.value = e
  folioEditForm.value = { description: e.description || '', amount: Math.abs(e.amount || 0) }
  folioEditErrors.value = {}
  actionError.value = ''
}

/** Persists the edited row via PUT folio/entries/{id}, then reloads the folio. */
async function submitEditEntry() {
  const f = folioEditForm.value
  const errs = {}
  if (!f.description?.trim()) errs.description = t('validations.fieldRequired')
  if (!(Number(f.amount) > 0)) errs.amount = t('validations.positiveAmount')
  folioEditErrors.value = errs
  if (Object.keys(errs).length || !folioEdit.value?.entryId) return
  const entryId = folioEdit.value.entryId
  folioEdit.value = null
  await runStayAction(() =>
    reservationApi.folioEntryUpdate(entryId, { description: f.description.trim(), amount: Math.abs(Number(f.amount)) }),
  )
}

/* ----- Amend stay / room move ----- */
const amendModal = ref(false)
const amendIsRoomMove = ref(false)
const amendForm = ref({})
const amendErrors = ref({})
const amendTouched = ref(false)
const amendSnapshot = ref({})

/** Rooms as searchable options for the amend/room-move picker. */
const roomMoveOptions = computed(() =>
  rooms.value.map((room) => ({
    value: room.room_id,
    label: `${room.room_number} · ${roomTypeLabel(room.room_type)} · TZS ${formatPrice(room.price_per_night)}`,
  })),
)

function openAmendModal(roomMove = false) {
  moreOpen.value = false
  const res = folio.value?.reservation || activeBar.value || {}
  amendIsRoomMove.value = roomMove
  amendForm.value = {
    room_id: res.room_id || res.room?.room_id || null,
    check_in_date: res.check_in_date || res.arrivalIso || '',
    check_out_date: res.check_out_date || res.departureIso || '',
    num_adults: res.num_adults ?? 1,
    num_children: res.num_children ?? 0,
    first_name: res.first_name || '',
    last_name: res.last_name || '',
    guest_phone: formatPhoneNational(res.guest_phone),
    country_code: res.country_code || 'TZ',
    guest_email: res.guest_email || '',
  }
  amendErrors.value = {}
  amendTouched.value = false
  amendSnapshot.value = { ...amendForm.value }
  actionError.value = ''
  amendModal.value = true
}
function amendRules() {
  return [
    { field: 'first_name', check: required(t) },
    { field: 'last_name', check: required(t) },
    { field: 'guest_email', check: email(t) },
    { field: 'guest_phone', check: phone(t) },
    { field: 'check_in_date', check: required(t) },
    { field: 'check_out_date', check: required(t) },
    { field: 'check_out_date', check: after(t, 'check_in_date') },
    { field: 'num_adults', check: minInteger(t, 1) },
    { field: 'num_children', check: minInteger(t, 0) },
  ]
}
async function submitAmend() {
  const f = amendForm.value
  amendTouched.value = true
  const errors = collectErrors(f, amendRules())
  if (Object.keys(errors).length) {
    amendErrors.value = errors
    return
  }
  if (!activeBar.value?.id) return
  // Only send a field when it actually changed, so a room move never wipes
  // guest details (and vice versa).
  const payload = {
    room_id: f.room_id,
    check_in_date: f.check_in_date,
    check_out_date: f.check_out_date,
    num_adults: Number(f.num_adults) || 1,
    num_children: Number(f.num_children) || 0,
  }
  const res = folio.value?.reservation || {}
  if (f.first_name !== (res.first_name ?? '') && f.first_name) payload.first_name = f.first_name
  if (f.last_name !== (res.last_name ?? '') && f.last_name) payload.last_name = f.last_name
  if (f.guest_phone) {
    const phoneCheck = validatePhoneNumber(f.guest_phone, f.country_code || 'TZ')
    if (String(phoneCheck.number || '').replace(/\D/g, '') !== String(res.guest_phone || '').replace(/\D/g, '')) {
      payload.guest_phone = phoneCheck.number
      if (f.country_code && f.country_code !== (res.country_code || '')) payload.country_code = f.country_code
    }
  }
  if (f.guest_email !== (res.guest_email ?? '') && f.guest_email) payload.guest_email = f.guest_email
  amendModal.value = false
  await runStayAction(() => reservationApi.update(activeBar.value.id, payload))
  if (actionError.value) amendModal.value = true
}
bindBlurValidation(watch, () => amendForm.value, amendSnapshot, amendTouched, amendErrors, amendRules)

/* ----- Void reservation ----- */
const voidOpen = ref(false)
const voidName = ref('')
function openVoid() {
  moreOpen.value = false
  voidName.value = ''
  actionError.value = ''
  voidOpen.value = true
}
async function confirmVoid() {
  const bar = activeBar.value
  if (!bar?.id || !voidName.value.trim()) return
  actionBusy.value = true
  actionError.value = ''
  try {
    await reservationApi.destroy(bar.id, { confirmed_name: voidName.value.trim() })
    voidOpen.value = false
    closeBarModal()
    await load(true)
  } catch (err) {
    actionError.value = err.response?.data?.message || t('stayview.actionError')
  } finally {
    actionBusy.value = false
  }
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

// Inventory categories come from the shared catalog (single source of truth).
const categoriesStore = useCategoriesStore()
const ledgerCategoryOptions = categoriesStore.inventoryCategoryOptions

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

// Voiding a booking is open to any front-desk staff before the guest checks
// in; an in-house stay additionally requires a manager or accountant (the
// backend enforces the same rule inside ReservationService::destroy).
const canVoidReservation = computed(() => {
  const mgmtOnly = ['manager', 'accountant', 'hotel_admin', 'owner', 'superadmin']
  if (activeBar.value?.rawStatus !== 'checked_in') return true
  return mgmtOnly.includes(authStore.user?.user_role)
})

// Housekeeping tasks follow the housekeeping module matrix.
const canSeeHousekeeping = computed(() =>
  ['hotel_admin', 'manager', 'housekeeping'].includes(authStore.user?.user_role),
)

// Pure housekeeping staff: the tape is their whole surface, and they may only
// perform housekeeping work on it — never book, open folios, take payment or
// touch room charges. Front-desk roles (admin/manager/receptionist) keep the
// full stay-view tools.
const isHousekeepingStaff = computed(() => authStore.user?.user_role === 'housekeeping')

// Housekeeping workflow rights for the room-level floating card: attendants can
// start their work; confirming and verifying are supervisory steps.
const hkCanConfirm = computed(() => authStore.can(40) && authStore.canOperate)
const hkCanVerify = computed(() => authStore.can(40) && authStore.canOperate)

/* ---- Housekeeping task chips & floating cards on the room bars ---- */

// Open tasks shown on the tape (only loaded for housekeeping-visible roles).
const hkTasks = ref([])

// Open tasks grouped by room id, so a room bar can show its work at a glance.
const hkByRoom = computed(() => {
  const map = {}
  for (const task of hkTasks.value) {
    const roomId = task.room_id
    if (!(roomId in map)) map[roomId] = []
    map[roomId].push(task)
  }
  return map
})

// Laundry is housekeeping work too: open laundry orders loaded with the board.
const hkLaundry = ref([])

// Open laundry orders grouped by room number, shown on the same room bars.
const laundryByRoom = computed(() => {
  const map = {}
  for (const order of hkLaundry.value) {
    const key = String(order.room_number || '')
    if (!key) continue
    if (!(key in map)) map[key] = []
    map[key].push(order)
  }
  return map
})

// Floating card state: pinned (tap/click) or hovered (mouse) over the bar.
const hkTip = ref(null)

const HK_TASK_TYPE_LABELS = {
  cleaning: 'housekeeping.typeCleaning',
  maintenance: 'housekeeping.typeMaintenance',
  inspection: 'housekeeping.typeInspection',
  turndown: 'housekeeping.typeTurndown',
  deep_clean: 'housekeeping.typeDeepClean',
}

const HK_PRIORITY_LABELS = {
  urgent: 'housekeeping.priorityUrgent',
  high: 'housekeeping.priorityHigh',
  normal: 'housekeeping.priorityNormal',
  low: 'housekeeping.priorityLow',
}

const HK_STATUS_LABELS = {
  dirty: 'housekeeping.statusDirty',
  in_progress: 'housekeeping.statusInProgress',
  confirmed: 'housekeeping.statusConfirmed',
  verified: 'housekeeping.statusVerified',
  completed: 'housekeeping.statusCompleted',
}

/** Localized label for a task field (type/priority/status) with a raw fallback. */
function hkLabel(task, field) {
  const source = field === 'task_type' ? HK_TASK_TYPE_LABELS : field === 'priority' ? HK_PRIORITY_LABELS : HK_STATUS_LABELS
  const key = source[task?.[field]]
  return key && te(key) ? t(key) : String(task?.[field] ?? '—')
}

/** Clamps a floating-card anchor inside the viewport (keeps the card tappable while walking). */
function hkTipPos(event) {
  const width = 300
  const height = 260
  const pad = 10
  const left = Math.min(Math.max(pad, event.clientX - width / 2), window.innerWidth - width - pad)
  const top = Math.min(Math.max(pad, event.clientY + 14), window.innerHeight - height - pad)
  return { left, top }
}

function showHkTip(event, room, force = false) {
  clearHkHideTimer()
  const tasks = (hkByRoom.value[room.room_id] || []).slice()
  const laundry = hkLaundryFor(room)
  if (!force && !tasks.length && !laundry.length) return
  hkTip.value = { room, tasks, laundry, pinned: force, ...hkTipPos(event) }
}

// The card may disappear in the same tick the user's cursor is moving onto it:
// leaving a bar fires mouseleave (which nulls the tip) before the card fires
// mouseenter. Never null-pin a vanished card — guard it.
function pinHkTip() {
  if (hkTip.value) hkTip.value.pinned = true
}

const hkHideTimer = { id: 0 }
function clearHkHideTimer() {
  if (hkHideTimer.id) {
    clearTimeout(hkHideTimer.id)
    hkHideTimer.id = 0
  }
}

/**
 * Hides the floating card shortly after the cursor leaves its source bar. The
 * short delay lets the cursor land on the card: when it does, the card pins
 * itself before the timer runs and stays open (a pinned card is never hidden).
 */
function scheduleHideHkTip() {
  clearHkHideTimer()
  hkHideTimer.id = setTimeout(() => {
    hkHideTimer.id = 0
    if (hkTip.value && !hkTip.value.pinned) hkTip.value = null
  }, 110)
}

function moveHkTip(event) {
  if (!hkTip.value || hkTip.value.pinned) return
  Object.assign(hkTip.value, hkTipPos(event))
}

function hideHkTip() {
  clearHkHideTimer()
  if (hkTip.value && !hkTip.value.pinned) hkTip.value = null
}

function toggleHkTip(event, room) {
  clearHkHideTimer()
  const tasks = (hkByRoom.value[room.room_id] || []).slice()
  const laundry = hkLaundryFor(room)
  if (!tasks.length && !laundry.length && !isHousekeepingStaff.value) return
  const open = hkTip.value?.room?.room_id === room.room_id
  // A tap on an already-pinned card closes it; a tap on a hover-open card pins it.
  if (open && hkTip.value?.pinned) {
    hkTip.value = null
    return
  }
  hkTip.value = { room, tasks, laundry, pinned: true, ...hkTipPos(event) }
}

/** Guest name of the current stay in a room (from the visible window stays). */
function hkRoomGuest(roomId) {
  const today = startOfDay(new Date())
  const stay = (reservations.value || []).find((r) => {
    if (reservationRoomId(r) !== roomId) return false
    const { arrival, departure } = reservationDates(r)
    return arrival && departure && arrival <= today && departure > today
  })
  return stay?.guest_name || ''
}

const LAUNDRY_SERVICE_LABELS = {
  wash: 'laundry.serviceWash',
  iron: 'laundry.serviceIron',
  dry_clean: 'laundry.serviceDryClean',
}

const LAUNDRY_STATUS_LABELS = {
  pending: 'laundry.statusPending',
  ready: 'laundry.statusReady',
  delivered: 'laundry.statusDelivered',
  cancelled: 'laundry.statusCancelled',
}

/** Localized laundry service/status label with a raw fallback. */
function hkLaundryLabel(order, field) {
  const source = field === 'service' ? LAUNDRY_SERVICE_LABELS : LAUNDRY_STATUS_LABELS
  const key = source[order?.[field]]
  return key && te(key) ? t(key) : String(order?.[field] ?? '—')
}

/** Open laundry orders for a room (matched by the room's number). */
function hkLaundryFor(room) {
  return (laundryByRoom.value[String(room?.room_number || '')] || []).slice()
}

/** Laundry workflow steps allowed from a room bar, by current status. */
function hkLaundryNext(order) {
  if (order.status === 'pending') return ['ready', 'cancelled']
  if (order.status === 'ready') return ['delivered']
  return []
}

/** Runs a laundry workflow step from the room card, then refreshes the tape. */
async function hkLaundryAction(order, status) {
  actionBusy.value = true
  actionError.value = ''
  try {
    clearHkHideTimer()
    await laundryApi.update(order.laundry_order_id, { status })
    await load(true)
    const room = rooms.value.find((r) => String(r.room_number) === String(order.room_number))
    if (room) {
      hkTip.value = {
        room,
        tasks: (hkByRoom.value[room.room_id] || []).slice(),
        laundry: hkLaundryFor(room),
        pinned: true,
        left: 12,
        top: 12,
      }
    }
  } catch (err) {
    actionError.value = apiErrorMsg(err, t('stayview.actionError'))
  } finally {
    actionBusy.value = false
  }
}

/** Runs a housekeeping workflow step from the room card, then refreshes the tape. */
async function hkTaskAction(task, verb) {
  actionBusy.value = true
  actionError.value = ''
  try {
    clearHkHideTimer()
    await housekeepingApi[verb](task.task_id)
    await load(true)
    const room = rooms.value.find((r) => r.room_id === task.room_id)
    if (room) {
      hkTip.value = {
        room,
        tasks: (hkByRoom.value[room.room_id] || []).slice(),
        laundry: hkLaundryFor(room),
        pinned: true,
        left: 12,
        top: 12,
      }
    }
  } catch (err) {
    actionError.value = apiErrorMsg(err, t('stayview.actionError'))
  } finally {
    actionBusy.value = false
  }
}

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
const bookingErrors = ref({})
const bookingTouched = ref(false)
const bookingSnapshot = ref({})

/** User-edited booking fields (the suggested total auto-updates separately). */
function bookingSnapshotKeys(form) {
  return ['first_name', 'last_name', 'guest_phone', 'country_code', 'booking_type', 'room_id', 'check_in_date', 'check_out_date', 'advance_payment', 'advance_payment_method', 'company_name', 'business_source'].map(
    (key) => form[key],
  )
}

/** Booking-source dropdown mirroring the backend enum (walk_in … ota). */
const bookingSourceOptions = computed(() => [
  { value: 'walk_in', label: t('reservations.sourceWalkIn') },
  { value: 'phone', label: t('reservations.sourcePhone') },
  { value: 'email', label: t('reservations.sourceEmail') },
  { value: 'website', label: t('reservations.sourceWebsite') },
  { value: 'agent', label: t('reservations.sourceAgent') },
  { value: 'ota', label: t('reservations.sourceOta') },
])

/** Implements a fresh booking form with today → tomorrow defaults. */
function resetBookingForm() {
  const today = isoKey(startOfDay(new Date()))
  const tomorrow = isoKey(addDays(startOfDay(new Date()), 1))
  bookingForm.value = {
    first_name: '',
    last_name: '',
    guest_phone: '',
    country_code: 'TZ',
    booking_type: 'single',
    room_id: rooms.value[0]?.room_id || null,
    check_in_date: today,
    check_out_date: tomorrow,
    total_amount: null,
    advance_payment: 0,
    advance_payment_method: '',
    advance_payment_date: today,
    company_name: '',
    business_source: 'walk_in',
  }
  bookingErrors.value = {}
  bookingTouched.value = false
  bookingSnapshot.value = { ...bookingForm.value }
}

/** Nights between the selected arrival and departure dates. */
const bookingNights = computed(() => {
  const f = bookingForm.value
  if (!f.check_in_date || !f.check_out_date) return 0
  const days = diffDays(parseDate(f.check_in_date), parseDate(f.check_out_date))
  return Number.isFinite(days) && days > 0 ? days : 0
})

/** Nightly rate of the selected room (0 when none selected). */
const bookingRate = computed(() => {
  const room = rooms.value.find((r) => r.room_id === bookingForm.value.room_id)
  return Number(room?.price_per_night) || 0
})

/** Suggested total based on nights × rate. */
const bookingTotal = computed(() => bookingNights.value * bookingRate.value)

/** Keep the total in step with the dates and room, so it is automatic. */
watch(
  [() => bookingForm.value.room_id, () => bookingForm.value.check_in_date, () => bookingForm.value.check_out_date],
  () => {
    if (bookingModal.value) bookingForm.value.total_amount = bookingTotal.value
  },
)

/** Whether a room has no booking bar covering the given day column. */
function isVacantCell(room, iso) {
  const idx = days.value.findIndex((d) => d.iso === iso)
  if (idx < 0) return false
  const col = idx + 1
  const bars = barsByRoom.value[room.room_id] || []
  return !bars.some((b) => col >= b.start && col < b.start + b.span)
}

/** Clicking a vacant day opens the booking form with that arrival date. */
function bookVacantDay(room, iso) {
  const arrival = parseDate(iso)
  const today = startOfDay(new Date())
  if (arrival < today) return
  bookingForm.value = {
    ...bookingForm.value,
    room_id: room.room_id,
    check_in_date: iso,
    check_out_date: isoKey(addDays(arrival, 1)),
    total_amount: null,
  }
  bookingErrors.value = {}
  bookingTouched.value = false
  bookingSnapshot.value = { ...bookingForm.value }
  actionError.value = ''
  bookingModal.value = true
}

/** Opens the booking form with sensible defaults (today → tomorrow). */
function openNewBooking() {
  resetBookingForm()
  actionError.value = ''
  bookingModal.value = true
}

/** Creates the reservation and refreshes the chart. */
function bookingRules() {
  return [
    { field: 'first_name', check: required(t) },
    { field: 'last_name', check: required(t) },
    { field: 'guest_phone', check: required(t) },
    { field: 'guest_phone', check: phone(t) },
    { field: 'booking_type', check: required(t) },
    { field: 'room_id', check: required(t) },
    { field: 'check_in_date', check: required(t) },
    { field: 'check_out_date', check: required(t) },
    { field: 'check_out_date', check: after(t, 'check_in_date') },
    { field: 'advance_payment', check: nonNegative(t) },
  ]
}
async function submitBooking() {
  const f = bookingForm.value
  bookingTouched.value = true
  const errors = collectErrors(f, bookingRules())
  if (Object.keys(errors).length) {
    bookingErrors.value = errors
    return
  }
  const phoneCheck = validatePhoneNumber(f.guest_phone, f.country_code || 'TZ')
  await runAction(async () => {
    const payload = { ...f }
    if (!payload.advance_payment_method) {
      delete payload.advance_payment_method
      delete payload.advance_payment_date
    }
    payload.guest_phone = phoneCheck.number
    await reservationApi.store({ ...payload, status: 'confirmed' })
  })
  if (!actionError.value) {
    bookingModal.value = false
    // Start the next booking from a clean slate — the previous guest's name
    // and phone must never leak into a fresh reservation.
    resetBookingForm()
  }
}
bindBlurValidation(
  watch,
  () => bookingForm.value,
  bookingSnapshot,
  bookingTouched,
  bookingErrors,
  bookingRules,
  bookingSnapshotKeys,
)

/* ---------------- Guest registration modal ---------------- */

const guestModal = ref(false)
const guestForm = ref({})
const guestErrors = ref({})
const guestTouched = ref(false)
const guestSnapshot = ref({})

/** Opens the guest registration form. */
function openGuestModal() {
  guestForm.value = { first_name: '', last_name: '', phone: '', country_code: 'TZ', email: '' }
  guestErrors.value = {}
  guestTouched.value = false
  guestSnapshot.value = { ...guestForm.value }
  actionError.value = ''
  guestModal.value = true
}
function guestRules() {
  return [
    { field: 'first_name', check: required(t) },
    { field: 'last_name', check: required(t) },
    { field: 'phone', check: required(t) },
    { field: 'phone', check: phone(t) },
    { field: 'email', check: email(t) },
  ]
}
/** Saves the guest record. */
async function submitGuest() {
  guestTouched.value = true
  const errors = collectErrors(guestForm.value, guestRules())
  if (Object.keys(errors).length) {
    guestErrors.value = errors
    return
  }
  const phoneCheck = validatePhoneNumber(guestForm.value.phone, guestForm.value.country_code || 'TZ')
  await runAction(() =>
    guestApi.store({ ...guestForm.value, phone: phoneCheck.number, country_code: guestForm.value.country_code }),
  )
  if (!actionError.value) guestModal.value = false
}
bindBlurValidation(watch, () => guestForm.value, guestSnapshot, guestTouched, guestErrors, guestRules)

/* ---------------- Housekeeping modal ---------------- */

const tasksModal = ref(false)
const tasks = ref([])
const taskForm = ref({})

/** Opens the housekeeping panel and loads open tasks. */
async function openTasksModal(roomId = null) {
  taskForm.value = { room_id: roomId || rooms.value[0]?.room_id || null, priority: 'normal' }
  actionError.value = ''
  tasksModal.value = true
  try {
    const res = await housekeepingApi.index({
      per_page: 50,
      ...(roomId ? { room_id: roomId } : {}),
    })
    const p = res.data
    tasks.value = (Array.isArray(p) ? p : p?.data || []).filter((task) => task.status !== 'completed')
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
function openRoomModal(room, event = null) {
  if (isHousekeepingStaff.value) {
    if (event) showHkTip(event, room, true)
    else {
      clearHkHideTimer()
      hkTip.value = {
        room,
        tasks: (hkByRoom.value[room.room_id] || []).slice(),
        laundry: hkLaundryFor(room),
        pinned: true,
        left: 12,
        top: 12,
      }
    }
    return
  }
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

/* Housekeeping task badge on the room cell (opens the floating card). */
.sv-hk-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  padding: 1px 7px;
  border: none;
  border-radius: 999px;
  background: #005eb8;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  line-height: 18px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  transition: transform 0.12s ease, background 0.12s ease;
}
.sv-hk-badge i { font-size: 10px; }
.sv-hk-badge:hover { background: #004d97; transform: translateY(-1px); }
.sv-hk-badge.active { background: #dc3545; }

/* Laundry orders get their own badge color so laundry-only rooms stand out. */
.sv-hk-badge-laundry {
  background: #0e9434;
}
.sv-hk-badge-laundry:hover { background: #0b7a2b; }
.sv-hk-badge-laundry.active { background: #dc3545; }

/* Floating housekeeping task card (pinned or hover) near the room bar. */
.sv-hk-card {
  position: fixed;
  z-index: 1001;
  width: 300px;
  max-height: 70vh;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #dbe2ea;
  border-top: 3px solid #005eb8;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  padding: 12px;
}
.sv-hk-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.sv-hk-card-room {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.sv-hk-card-room strong { font-size: 16px; color: #0b1f33; }
.sv-hk-card-guest {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sv-hk-card-close {
  flex: none;
  border: none;
  background: none;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  padding: 2px 4px;
}
.sv-hk-card-close:hover { color: #dc3545; }
.sv-hk-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.sv-hk-item {
  border: 1px solid #e8edf3;
  border-left: 3px solid #94a3b8;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fbfdff;
}
.sv-hk-item.urgent { border-left-color: #dc3545; }
.sv-hk-item.high { border-left-color: #fd7e14; }
.sv-hk-item.normal { border-left-color: #0d6efd; }
.sv-hk-item.low { border-left-color: #adb5bd; }
.sv-hk-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 5px;
}
.sv-hk-task-type { font-size: 12px; font-weight: 800; color: #0b1f33; }
.sv-hk-status {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-radius: 999px;
  padding: 2px 8px;
  background: #e2e8f0;
  color: #334155;
  white-space: nowrap;
}
.sv-hk-status.dirty, .sv-hk-status.confirmed { background: #fde2e2; color: #b91c1c; }
.sv-hk-status.in_progress { background: #fff3cd; color: #92400e; }
.sv-hk-status.verified, .sv-hk-status.completed { background: #dcfce7; color: #166534; }
.sv-hk-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 11px;
  color: #64748b;
}
.sv-hk-notes { margin: 6px 0 0; font-size: 11px; color: #475569; font-style: italic; }
.sv-hk-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
}
.sv-hk-btn {
  flex: 1;
  min-width: 96px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid #dbe2ea;
  border-radius: 7px;
  background: #f8fafc;
  color: #0b1f33;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s ease, transform 0.12s ease;
}
.sv-hk-btn:hover { background: #eef2f7; transform: translateY(-1px); }
.sv-hk-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.sv-hk-btn svg,
.sv-hk-btn i { font-size: 12px; }
.sv-hk-btn-primary { border-color: #005eb8; background: #005eb8; color: #fff; }
.sv-hk-btn-primary:hover { background: #004d97; }
.sv-hk-btn-success { border-color: #198754; background: #198754; color: #fff; }
.sv-hk-btn-success:hover { background: #157347; }
.sv-hk-btn-danger { border-color: #b02a37; background: #b02a37; color: #fff; }
.sv-hk-btn-danger:hover { background: #981f2c; }
.sv-hk-section {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}
.sv-hk-section-title {
  font-size: 12px;
  font-weight: 700;
  color: #0b1f33;
  letter-spacing: 0.02em;
}
.sv-hk-section-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #005eb8;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.sv-hk-empty {
  margin: 4px 0 2px;
  padding: 14px 10px;
  border: 1px dashed #dbe2ea;
  border-radius: 8px;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
}

@media (max-width: 640px) {
  .sv-hk-card {
    left: 10px !important;
    right: 10px;
    width: auto;
    max-height: 46vh;
    top: auto !important;
    bottom: 10px;
  }
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

.sv-cell-bg.vacant {
  cursor: pointer;
}

.sv-cell-bg.vacant:hover {
  background: #f2f8ff;
  box-shadow: inset 0 0 0 1px #cfe2ff;
  z-index: 1;
}

.sv-auto {
  color: #1e7e34;
  font-style: normal;
  font-weight: 400;
  opacity: 0.85;
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
  min-width: 860px;
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

.sv-modal-row .sv-row-line {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sv-modal-row strong {
  white-space: nowrap;
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 16px 16px;
}

.sv-modal-actions .sv-modal-manage {
  margin-left: auto;
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

/* Per-field client-side validation: red border + inline message. */
.sv-input-error {
  border-color: #dc2626 !important;
}

.sv-field-msg {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 11.5px;
  line-height: 1.35;
  color: #dc2626;
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

/* ---- Stay-view tabs (reference panel layout) ---- */

/* The stay-view modal is wider than the small action modals. */
.sv-modal-tabs {
  width: 640px;
}

/* Small sub-modals (add payment / amend / void). */
.sv-modal-sm {
  width: 420px;
}

/* Compact header strip under the modal title. */
.sv-stay-strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  padding: 10px;
  margin: 0 0 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.sv-stay-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sv-stay-item span {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #9ca3af;
}

.sv-stay-item strong {
  font-size: 13px;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Tab strip. */
.sv-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-bottom: 10px;
  margin-bottom: 6px;
  border-bottom: 1px solid #f0f2f5;
}

.sv-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  font-size: 12.5px;
  color: #6b7280;
  cursor: pointer;
  white-space: nowrap;
}

.sv-tab:hover {
  background: #f3f6f9;
  color: #005eb8;
}

.sv-tab.active {
  background: #eaf3fb;
  border-color: #005eb8;
  color: #005eb8;
  font-weight: 600;
}

.sv-tab i {
  font-size: 12px;
}

/* Panel + section primitives. */
.sv-tab-panel {
  min-height: 120px;
}

.sv-tab-section {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #9ca3af;
  margin: 12px 0 6px;
}

.sv-tab-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.sv-tab-head .sv-tab-section {
  margin: 0;
}

/* Summary cards used by the Folio Operations and Room Charges tabs. */
.sv-panel-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.sv-panel-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #eef0f3;
  border-radius: 10px;
}

.sv-panel-card span {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #9ca3af;
}

.sv-panel-card strong {
  font-size: 15px;
  color: #1f2937;
  white-space: nowrap;
}

.sv-panel-card.pay-pending strong { color: #c0392b; }
.sv-panel-card.pay-ok strong { color: #1e7e34; }

/* Label/value grid used by Booking and Guest details tabs. */
.sv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.sv-grid-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: #f8fafc;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  min-width: 0;
}

.sv-grid-item span {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #9ca3af;
}

.sv-grid-item strong {
  font-size: 13px;
  color: #374151;
  word-break: break-word;
}

/* Compact tables (room charges, audit trail). */
.sv-table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.sv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.sv-table th,
.sv-table td {
  padding: 7px 10px;
  border-bottom: 1px solid #f0f2f5;
  text-align: left;
}

.sv-table th {
  background: #f8fafc;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #6b7280;
}

.sv-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.sv-table tfoot td {
  border-bottom: none;
  font-weight: 600;
  background: #f8fafc;
}

/* Folio ledger: credit rows (payments) read as accepted money, charge rows as
   amounts owed. The balance footer is emphasized as the settled figure. */
.sv-folio-table .sv-particular {
  font-weight: 600;
  white-space: nowrap;
}

.sv-folio-table .row-charge td {
  color: #1f2937;
}

.sv-folio-table .row-credit td {
  color: #1e7e34;
}

.sv-folio-table .row-muted td {
  color: #9ca3af;
}

.sv-folio-table .sv-muted-cell {
  text-align: center;
  color: #9ca3af;
  padding: 14px 10px;
}

.sv-folio-table .sv-folio-balance td {
  background: #f0fdf4;
  color: #1e7e34;
  border-top: 1px solid #e5e7eb;
}

/* Ledger actions column: download / void / remove, always inline and quiet. */
.sv-folio-table .sv-cell-actions {
  width: 64px;
  text-align: center;
  white-space: nowrap;
}

.sv-folio-table .sv-icon-link {
  display: inline-block;
  padding: 2px 5px;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  font-size: 12px;
}

.sv-folio-table .sv-icon-link:hover {
  color: #b91c1c;
}

.sv-folio-table .sv-icon-link:disabled {
  color: #d1d5db;
  cursor: default;
}

/* Uploaded files list inside the folio-op modal. */
.sv-file-list {
  margin: 6px 2px 0;
  padding: 0;
  list-style: none;
}

.sv-file-list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  color: #374151;
  padding: 4px 0;
  border-bottom: 1px dashed #e5e7eb;
}

/* Fits the folio ledger into the stay-view modal without a horizontal scroll. */
@media (max-width: 720px) {
  .sv-folio-table table {
    min-width: 520px;
  }
}

.sv-note {
  margin: 8px 2px 0;
  font-size: 12px;
}

/* Folio tab action buttons under the postings. */
.sv-panel-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.sv-panel-actions .btn {
  flex: 1;
}

/* Empty state (credit card tab). */
.sv-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 34px 16px;
  text-align: center;
  color: #9ca3af;
}

.sv-empty-state i {
  font-size: 28px;
  color: #cbd5e1;
}

.sv-empty-state p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  max-width: 320px;
}

/* Task icon + main block in the Tasks tab. */
.sv-task-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: #f0f6fc;
  color: #005eb8;
  font-size: 13px;
  flex-shrink: 0;
}

.sv-task-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sv-task-status {
  text-transform: capitalize;
}

/* More actions dropdown. */
.sv-dropdown {
  position: relative;
}

.sv-dropdown-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 30;
  min-width: 220px;
  padding: 6px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.14);
  list-style: none;
}

.sv-dropdown-menu li {
  margin: 0;
  padding: 0;
}

.sv-dropdown-menu li button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  background: transparent;
  border-radius: 7px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  text-align: left;
}

.sv-dropdown-menu li button i {
  width: 16px;
  text-align: center;
  color: #6b7280;
}

.sv-dropdown-menu li button:hover {
  background: #f0f6fc;
  color: #005eb8;
}

.sv-dropdown-menu li button.danger {
  color: #c0392b;
}

.sv-dropdown-menu li button.danger:hover {
  background: #fdecec;
  color: #c0392b;
}

.sv-dropdown-menu li button.danger i {
  color: #c0392b;
}

/* Pop transition for the More dropdown. */
.sv-pop-enter-active,
.sv-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.sv-pop-enter-from,
.sv-pop-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* Void confirmation hint. */
.sv-void-hint {
  margin: 0 0 10px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}

/* Small buttons used inside tabs. */
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}
</style>

