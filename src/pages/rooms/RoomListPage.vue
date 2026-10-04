<!--
  Rooms page (route: /app/rooms, name: hotel-rooms).
  Hotel room inventory: a filterable paginated list showing the current
  occupant, with create/edit and delete actions (permission-gated) and a
  dedicated room-status change dialog.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('rooms.title') }}</h1>
        <p class="muted">{{ $t('rooms.subtitle') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="load">
          <i class="fas fa-rotate"></i> {{ $t('rooms.refresh') }}
        </button>
        <button
          v-if="canEdit && bulk.selectedCount > 0"
          class="btn btn-danger"
          @click="showBulkDelete = true"
        >
          <i class="fas fa-trash"></i> {{ $t('common.deleteSelected') }} ({{ bulk.selectedCount }})
        </button>
        <button v-if="canEdit" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ $t('rooms.newRoom') }}
        </button>
        <TableExportButton
          filename="rooms"
          :load-all="loadAllRooms"
          :columns="[
            { key: 'room_number', label: $t('rooms.tableRoom') },
            { key: 'room_type', label: $t('rooms.tableType') },
            { key: 'floor', label: $t('rooms.floor') },
            { key: 'price_per_night', label: $t('rooms.tableRate') },
            { key: 'max_occupancy', label: $t('rooms.tableCapacity') },
            { key: 'status', label: $t('rooms.status') },
          ]"
        />
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Status/type/search filters; each change reloads the list -->
    <!-- ROOMS TABS: Inventory (per-type summary cards + the rooms table),
         Rates (bulk per-type pricing) and Stop-sell (date blocks per type).
         Inventory is open to every staff role; Rates and Stop-sell writes are
         manager-gated through canEdit (authStore.can(80)). -->
    <div class="card tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab"
        :class="[`tab-${tab.tone}`, { active: activeTab === tab.key }]"
        :aria-pressed="activeTab === tab.key"
        @click="switchTab(tab.key)"
      >
        <i :class="tab.icon"></i> {{ $t(tab.label) }}
      </button>
    </div>

    <!-- ─── INVENTORY (default) ─────────────────────────────────────────── -->
    <div v-if="activeTab === 'inventory'">
      <div v-if="invLoading" class="alert alert-info">{{ $t('rooms.loading') }}</div>
      <div v-else-if="invSummary.length">
        <div class="summary-grid">
          <div v-for="s in invSummary" :key="s.room_type" class="card summary-card">
            <div class="summary-head">
              <strong>{{ s.room_type }}</strong>
              <span class="badge" :class="s.available_count > 0 ? 'badge-green' : 'badge-red'">
                {{ s.available_count }}/{{ s.room_count }} {{ $t('rooms.tabAvailable') }}
              </span>
            </div>
            <p class="muted">
              {{ $t('rooms.tabMin') }} {{
                s.min_rate != null ? formatRate(s.min_rate) : '—'
              }} ·
              {{ $t('rooms.tabAvg') }} {{
                s.avg_rate != null ? formatRate(s.avg_rate) : '—'
              }}
            </p>
            <p v-if="s.stop_sold_count > 0" class="warning-inline">
              <i class="fas fa-ban"></i>
              {{ $t('rooms.tabStopSoldDays', { count: s.stop_sold_count }) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── RATES (manager only) ────────────────────────────────────────── -->
    <div v-else-if="activeTab === 'rates'">
      <div class="card">
        <div class="filter-grid">
          <div class="form-group">
            <label>{{ $t('rooms.roomType') }}</label>
            <select v-model="rateForm.room_type" class="input">
              <option v-for="type in roomTypeOptions" :key="type.value" :value="type.value">
                {{ type.label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('rooms.pricePerNightTZS', { currency: curCode() }) }}</label>
            <input v-model.number="rateForm.price_per_night" type="number" min="0" class="input" />
          </div>
          <div class="filter-actions">
            <button class="btn btn-primary" :disabled="!canEdit || !rateForm.price_per_night" @click="pushRates">
              <i class="fas fa-tags"></i> {{ $t('rooms.tabPushRates') }}
            </button>
          </div>
        </div>
        <p class="muted">{{ $t('rooms.tabRatesHint') }}</p>
      </div>
    </div>

    <!-- ─── STOP-SELL (manager only) ────────────────────────────────────── -->
    <div v-else-if="activeTab === 'stop-sell'">
      <div class="card">
        <div class="filter-grid">
          <!--
            Manager review: "It is not possible to stop sell a specific room,
            for example room 5", "the color is too similar to the others, I do
            not see which one is highlighted", and "stop sell from 15 to 20 would
            be difficult."

            The target is now a specific room (or several) rather than only a
            type, and the block spans an inclusive range. The calendar below is
            the primary view: a cell is filled only for rooms that are actually
            stopped on that night, so a stopped room is unmistakable.
          -->
          <div class="form-group">
            <label>{{ $t('rooms.stopSellRoom') }}</label>
            <div class="stop-pick">
              <SearchableSelect
                v-model="stopForm.pick"
                :options="roomPickerOptions"
                :placeholder="$t('rooms.stopSellPickRoom')"
              />
              <button
                type="button"
                class="btn btn-secondary"
                :disabled="!canEdit || !stopForm.pick"
                @click="addStopRoom"
              >
                <i class="fas fa-plus"></i>
              </button>
            </div>
            <div v-if="stopForm.room_id.length" class="stop-chips">
              <span v-for="id in stopForm.room_id" :key="id" class="room-chip">
                {{ roomLabel(id) }}
                <button type="button" class="chip-x" :disabled="!canEdit" @click="removeStopRoom(id)">
                  <i class="fas fa-xmark"></i>
                </button>
              </span>
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('rooms.tabStopDate') }}</label>
            <input v-model="stopForm.start_date" type="date" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('rooms.stopSellEndDate') }}</label>
            <input v-model="stopForm.end_date" type="date" class="input" />
          </div>
          <div class="form-group">
            <label>{{ $t('rooms.stopSellReason') }}</label>
            <input v-model="stopForm.reason" type="text" class="input" :placeholder="$t('rooms.stopSellReasonHint')" />
          </div>
          <div class="filter-actions">
            <button
              class="btn btn-primary"
              :disabled="!canEdit || !stopForm.room_id.length || !stopForm.start_date"
              @click="placeStopSell"
            >
              <i class="fas fa-ban"></i> {{ $t('rooms.tabPlaceStopSell') }}
            </button>
          </div>
        </div>
        <p class="muted">{{ $t('rooms.tabStopSellHint') }}</p>
      </div>

      <!-- ─── Stop-sell calendar ──────────────────────────────────────────── -->
      <div class="card">
        <div class="filter-bar">
          <div class="filter-grid">
            <div class="form-group">
              <label>{{ $t('rooms.stopSellFrom') }}</label>
              <input v-model="calFrom" type="date" class="input" @change="loadBlocks" />
            </div>
            <div class="form-group">
              <label>{{ $t('rooms.stopSellTo') }}</label>
              <input v-model="calTo" type="date" class="input" @change="loadBlocks" />
            </div>
          </div>
          <p class="muted">
            <span class="cal-key cal-key-stopped"></span> <strong>Blocked (Stop Sell)</strong> — Click to lift
            <span class="cal-key cal-key-free"></span> Sellable — Click to select
            <span class="cal-key cal-key-picked"></span> <strong>Selected</strong> — Click last night to complete range
          </p>
        </div>

        <!--
          Manager review: "You can set [a] calendar dashboard with rooms in rows
          on the left side like the one in the receptionist dashboard to easily
          set STOP SELL if it covers more than one day."

          So the grid is now the thing you set stop-sell from, not just a
          picture of it: click the first night, click the last, and the range is
          placed. Dragging across the nights works too, because a manager
          pointing at a bar on the calendar does not stop at a cell boundary.

          A click on an already-stopped cell lifts that night instead, which is
          the reversal of the same gesture — no separate "delete" step to
          discover.
        -->
        <div v-if="calPick.roomId" class="cal-pick-bar">
          <div>
            <strong>{{ roomLabel(calPick.roomId) }}</strong>
            <span class="muted">
              {{ formatDayLabel(calPick.start) }} → {{ formatDayLabel(calPick.end) }}
              · {{ $t('rooms.stopSellNightsCount', { count: calPickNights }) }}
            </span>
          </div>
          <div class="cal-pick-actions">
            <input
              v-model="calPickReason"
              type="text"
              class="input"
              :placeholder="$t('rooms.stopSellReasonHint')"
              :aria-label="$t('rooms.stopSellReason')"
            />
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!canEdit || placingPick"
              @click="placePick"
            >
              <i class="fas fa-ban"></i>
              {{ $t('rooms.stopSellSetTheseNights') }}
            </button>
            <button type="button" class="btn btn-secondary" @click="clearPick">
              {{ $t('common.cancel') }}
            </button>
          </div>
        </div>
        <p v-else-if="canEdit" class="muted cal-hint" style="padding:8px 12px;border-left:3px solid var(--brand);background:#f0f7ff;border-radius:4px;">
          <strong>How to use Stop Sell:</strong>
          Click the <strong>first night</strong> on any room, then click the <strong>last night</strong> (or drag across). The blue selection bar will show the range and nights count. Add a reason and click "Set these nights" to block sales. To <strong>lift</strong> a blocked night, just click it again.
        </p>

        <div v-if="blockWarnings.length" class="alert alert-warning">
          <i class="fas fa-triangle-exclamation"></i>
          {{ $t('rooms.stopSellBlockUnreadable', { count: blockWarnings.length }) }}
        </div>

        <div v-if="blocksLoading" class="alert alert-info">{{ $t('rooms.loading') }}</div>
        <p v-if="calRooms.length && canEdit" class="muted" style="font-size:12px;margin-top:-4px;margin-bottom:10px;">
          <i class="fas fa-info-circle"></i> Tip: Click first night → Click last night (or drag). Click blocked cell to lift it. Table scrolls horizontally/vertically if many rooms/days.
        </p>
        <div v-else-if="calRooms.length" class="table-scroll cal-scroll" style="max-height:70vh;overflow:auto;">
          <table class="table stop-sell-calendar">
            <thead>
              <tr>
                <th class="cal-room-col">{{ $t('rooms.stopSellRoom') }}</th>
                <th v-for="d in calDays" :key="d" :class="{ today: d === todayIso }">{{ formatDayLabel(d) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in calRooms" :key="r.room_id">
                <td class="cal-room-col">
                  <strong>{{ r.room_number }}</strong>
                  <span class="muted">{{ r.room_type }}</span>
                </td>
                <td
                  v-for="d in calDays"
                  :key="d"
                  class="cal-cell"
                  :class="cellClass(r.room_id, d)"
                  :title="cellTitle(r.room_id, d)"
                  :role="canEdit ? 'button' : null"
                  :tabindex="canEdit ? 0 : null"
                  @click="onCellClick(r.room_id, d)"
                  @mouseenter="onCellEnter(r.room_id, d)"
                  @mousedown="onCellDown(r.room_id, d)"
                  @mouseup="dragging = false"
                  @mouseleave="dragging = false"
                  @keydown.enter.prevent="onCellClick(r.room_id, d)"
                  @keydown.space.prevent="onCellClick(r.room_id, d)"
                >
                  <i v-if="isStoppedOn(r.room_id, d)" class="fas fa-ban"></i>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="alert alert-info">{{ $t('rooms.stopSellNoRooms') }}</div>
      </div>

      <div v-if="blocks.length" class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>{{ $t('rooms.stopSellRoom') }}</th>
              <th>{{ $t('rooms.tabStopDate') }}</th>
              <th>{{ $t('rooms.stopSellNights') }}</th>
              <th>{{ $t('rooms.stopSellReason') }}</th>
              <th class="bulk-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in blocks" :key="b.stop_sell_id">
              <td>
                <strong>{{ b.room_number || $t('rooms.stopSellWholeType', { type: b.room_type }) }}</strong>
                <span class="muted">{{ b.room_type }}</span>
              </td>
              <td>{{ b.stop_date }}</td>
              <td>
                <!-- A range is shown as "from → to" so a multi-night block is
                     legible at a glance instead of looking like a single night. -->
                <span v-if="b.stop_end_date && b.stop_end_date !== b.stop_date">
                  {{ b.stop_date }} &rarr; {{ b.stop_end_date }}
                </span>
                <span v-else>{{ b.stop_date }}</span>
              </td>
              <td>{{ b.reason || '—' }}</td>
              <td class="bulk-col">
                <button v-if="canEdit" class="btn btn-danger btn-sm" @click="liftStopSell(b.stop_sell_id)">
                  <i class="fas fa-rotate-left"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('rooms.status') }}</label>
          <SearchableSelect
            v-model="filters.status"
            :options="roomStatusOptions"
            :empty-label="$t('common.all')"
            @change="applyFilter"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('rooms.roomType') }}</label>
          <SearchableSelect
            v-model="filters.room_type"
            :options="roomTypeOptions"
            :empty-label="$t('common.all')"
            @change="applyFilter"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input
            v-model="filters.search"
            type="text"
            class="input"
            :placeholder="$t('rooms.searchPlaceholder')"
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

    <div v-if="loading" class="alert alert-info">{{ $t('rooms.loading') }}</div>

    <!-- Room table; shows the current guest under the room number when occupied -->
    <div v-else class="table-scroll is-pinned">
      <table class="table table-pinned">
        <thead>
          <tr>
            <th scope="col" class="bulk-col">
              <input
                v-if="canEdit"
                type="checkbox"
                :checked="bulk.allSelected"
                :indeterminate.prop="bulk.someSelected && !bulk.allSelected"
                :aria-label="$t('common.selectAll')"
                @change="bulk.toggleAll()"
              />
            </th>
            <th scope="col" class="pin-col">{{ $t('rooms.tableRoom') }}</th>
            <th scope="col">{{ $t('rooms.tableType') }}</th>
            <th scope="col">{{ $t('rooms.floor') }}</th>
            <th scope="col">{{ $t('rooms.tableRate') }}</th>
            <th scope="col">{{ $t('rooms.tableCapacity') }}</th>
            <th scope="col">{{ $t('rooms.status') }}</th>
            <th scope="col" class="actions-col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="room in rooms" :key="room.room_id">
            <td class="bulk-col">
              <input
                v-if="canEdit"
                type="checkbox"
                :checked="bulk.isSelected(room.room_id)"
                @change="bulk.toggle(room.room_id)"
              />
            </td>
            <td class="pin-col">
              <strong>{{ room.room_number }}</strong>
              <div v-if="room.current_reservation" class="muted">
                {{ room.current_reservation.guest_name }}
                <span v-if="room.current_reservation.reservation_number"
                  >· {{ room.current_reservation.reservation_number }}</span
                >
              </div>
            </td>
            <td class="capitalize">{{ room.room_type }}</td>
            <td>{{ $t('rooms.floor') }} {{ room.floor ?? '-' }}</td>
            <td>
              <span class="price">{{ curCode() }} {{ Number(room.price_per_night).toLocaleString() }}</span>
            </td>
            <td>{{ room.max_occupancy ?? 1 }}</td>
            <td>
              <span class="badge" :class="statusBadge(room.status)">{{ room.status }}</span>
            </td>
            <td class="actions-col">
              <div class="actions">
                <button
                  v-if="canEdit"
                  class="btn btn-sm btn-secondary"
                  :title="$t('common.edit')"
                  :aria-label="$t('common.edit')"
                  @click="openEdit(room)"
                >
                  <i class="fas fa-pen" aria-hidden="true"></i>
                  <span class="btn-label">{{ $t('common.edit') }}</span>
                </button>
                <button
                  v-if="canEdit && room.status !== 'occupied'"
                  class="btn btn-sm btn-secondary"
                  :title="$t('rooms.status')"
                  :aria-label="$t('rooms.status')"
                  @click="openStatus(room)"
                >
                  <i class="fas fa-arrows-rotate" aria-hidden="true"></i>
                  <span class="btn-label">{{ $t('rooms.status') }}</span>
                </button>
                <button
                  v-if="canEdit"
                  class="btn btn-sm btn-danger"
                  :title="$t('common.delete')"
                  :aria-label="$t('common.delete')"
                  @click="remove(room)"
                >
                  <i class="fas fa-trash" aria-hidden="true"></i>
                  <span class="btn-label">{{ $t('common.delete') }}</span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!rooms.length && !loading">
            <td colspan="8" class="muted">{{ $t('rooms.empty') }}</td>
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

    <!-- Create/edit room modal; amenities are typed as a comma-separated list -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i class="fas fa-bed"></i> {{ editing ? $t('rooms.editRoom') : $t('rooms.newRoom') }}
          </h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ $t('rooms.roomNumber') }} *</label>
              <input v-model="form.room_number" type="text" class="input" required />
            </div>
            <div class="form-group">
              <label>{{ $t('rooms.roomType') }} *</label>
              <SearchableSelect
                v-model="form.room_type"
                :options="roomTypeOptions"
                :required="true"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('rooms.floor') }}</label>
              <input v-model.number="form.floor" type="number" min="0" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('rooms.pricePerNightTZS', { currency: curCode() }) }} *</label>
              <input
                v-model.number="form.price_per_night"
                type="number"
                min="0"
                class="input"
                required
              />
            </div>
            <div class="form-group">
              <label>{{ $t('rooms.maxOccupancy') }}</label>
              <input v-model.number="form.max_occupancy" type="number" min="1" class="input" />
            </div>
            <div class="form-group">
              <label>{{ $t('rooms.status') }}</label>
              <SearchableSelect v-model="form.status" :options="roomStatusOptions" />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('rooms.amenities') }}</label>
              <input
                v-model="amenitiesText"
                type="text"
                class="input"
                :placeholder="$t('rooms.amenitiesPlaceholder')"
              />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('rooms.description') }}</label>
              <textarea v-model="form.description" rows="2" class="textarea"></textarea>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i> {{ saving ? $t('common.saving') : $t('rooms.saveRoom') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Status-change modal (not offered for occupied rooms) -->
    <div v-if="showStatus" class="modal-overlay" @click.self="showStatus = false">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h2><i class="fas fa-arrows-rotate"></i> {{ $t('rooms.changeStatus') }}</h2>
          <button class="modal-close" @click="showStatus = false">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
        <p class="muted">{{ $t('rooms.roomTitle', { number: statusRoom.room_number }) }}</p>
        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>
        <form @submit.prevent="saveStatus">
          <div class="form-group">
            <label>{{ $t('rooms.newStatus') }}</label>
            <SearchableSelect
              v-model="statusForm.status"
              :options="statusChangeOptions"
              :required="true"
            />
          </div>
          <div class="form-group">
            <label>{{ $t('common.notes') }}</label>
            <textarea v-model="statusForm.notes" rows="2" class="textarea"></textarea>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="showStatus = false">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('rooms.updating') : $t('rooms.updateStatus') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Confirmation modal for bulk deletion (type DELETE to confirm) -->
    <DeleteConfirmModal
      v-model="showBulkDelete"
      :count="bulk.selectedCount"
      :busy="deleting"
      @confirm="bulkDelete"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { roomApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'
import TableExportButton from '@/components/TableExportButton.vue'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'
import { useBulkSelection } from '@/composables/useBulkSelection'
import { collectAllRows } from '@/utils/export'

import { useTenantCurrency } from '@/utils/currency'

const { curCode } = useTenantCurrency()

const { t } = useI18n()
const authStore = useAuthStore()
const canEdit = computed(() => authStore.can(80))

// List state: room rows, pagination, filters and feedback flags.
const rooms = ref([])
const page = ref(1)
const meta = ref({
  total: 0,
  per_page: 20,
  current_page: 1,
  last_page: 1,
  prev_page_url: null,
  next_page_url: null,
})
const filters = reactive({ status: '', room_type: '', search: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

const bulk = useBulkSelection(() => rooms.value, { idKey: 'room_id' })
const showBulkDelete = ref(false)
const deleting = ref(false)

// Modal state: create/edit and status-change dialogs plus their form fields.
const showModal = ref(false)
const showStatus = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const statusRoom = ref(null)
const form = reactive({
  room_number: '',
  room_type: 'single',
  floor: null,
  status: 'available',
  price_per_night: null,
  max_occupancy: 2,
  description: '',
  amenities: [],
})
const statusForm = reactive({ status: 'available', notes: '' })
const amenitiesText = ref('')

// Translated option lists for the room type and status dropdowns.
const roomTypeOptions = computed(() => [
  { value: 'single', label: t('common.roomTypes.single') },
  { value: 'double', label: t('common.roomTypes.double') },
  { value: 'suite', label: t('common.roomTypes.suite') },
  { value: 'deluxe', label: t('common.roomTypes.deluxe') },
  { value: 'presidential', label: t('common.roomTypes.presidential') },
])

const roomStatusOptions = computed(() => [
  { value: 'available', label: t('rooms.statusAvailable') },
  { value: 'occupied', label: t('rooms.statusOccupied') },
  { value: 'cleaning', label: t('rooms.statusCleaning') },
  { value: 'maintenance', label: t('rooms.statusMaintenance') },
  { value: 'dirty', label: t('rooms.statusDirty') },
])

const statusChangeOptions = computed(() => [
  { value: 'available', label: t('rooms.statusAvailable') },
  { value: 'cleaning', label: t('rooms.statusCleaning') },
  { value: 'maintenance', label: t('rooms.statusMaintenance') },
  { value: 'dirty', label: t('rooms.statusDirty') },
])

/**
 * Maps a room status to the CSS class used for its badge colour.
 * @param {string} status - The room status (available, occupied, cleaning, maintenance, dirty).
 * @returns {string} The badge CSS class.
 */
function statusBadge(status) {
  const map = {
    available: 'badge-green',
    occupied: 'badge-red',
    cleaning: 'badge-yellow',
    maintenance: 'badge-gray',
    dirty: 'badge-yellow',
  }
  return map[status] || 'badge-gray'
}

/** Fetches the current page of rooms, honouring the active filters. */
async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await roomApi.index({
      status: filters.status,
      room_type: filters.room_type,
      search: filters.search,
      page: page.value,
      per_page: 20,
    })
    rooms.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('rooms.loadError')
  } finally {
    loading.value = false
  }
}

/**
 * Applies a filter change.
 *
 * Manager review: filtering while sitting on page 3 reported "no rooms found"
 * because the request kept the old page number, so the filter was applied to
 * that page's slice of results instead of the whole set. Every filter change
 * now returns to page 1 so the match set is the full filtered collection.
 */
function applyFilter() {
  page.value = 1
  load()
}

function loadAllRooms() {
  return collectAllRows((page, perPage) =>
    roomApi.index({
      status: filters.status,
      room_type: filters.room_type,
      search: filters.search,
      page,
      per_page: perPage,
    }),
  )
}

/**
 * Moves to the given page and reloads the list.
 * @param {number} p - The 1-based page number.
 */
function goPage(p) {
  page.value = p
  load()
}

/** Resets all filters and reloads from the first page. */
function clearFilters() {
  page.value = 1
  filters.status = ''
  filters.room_type = ''
  filters.search = ''
  load()
}

/** Restarts the search from page one whenever the search text changes. */
function triggerSearch() {
  page.value = 1
  load()
}

/** Resets the room form (and its amenities text) to the create defaults. */
function resetForm() {
  editing.value = false
  editingId.value = null
  form.room_number = ''
  form.room_type = 'single'
  form.floor = null
  form.status = 'available'
  form.price_per_night = null
  form.max_occupancy = 2
  form.description = ''
  form.amenities = []
  amenitiesText.value = ''
}

/** Opens the room modal in create mode with a blank form. */
function openCreate() {
  modalError.value = ''
  resetForm()
  showModal.value = true
}

/**
 * Opens the room modal in edit mode, copying the room's data into the form.
 * @param {Object} room - The room row being edited.
 */
function openEdit(room) {
  modalError.value = ''
  editing.value = true
  editingId.value = room.room_id
  form.room_number = room.room_number
  form.room_type = room.room_type
  form.floor = room.floor
  form.status = room.status
  form.price_per_night = room.price_per_night
  form.max_occupancy = room.max_occupancy
  form.description = room.description || ''
  form.amenities = room.amenities || []
  amenitiesText.value = Array.isArray(room.amenities) ? room.amenities.join(', ') : ''
  showModal.value = true
}

/** Closes both the room form and the status-change modal. */
function closeModal() {
  showModal.value = false
  showStatus.value = false
}

/** Creates or updates the room, converting the amenities text into an array. */
async function save() {
  modalError.value = ''
  saving.value = true
  const payload = {
    ...form,
    amenities: amenitiesText.value
      ? amenitiesText.value
          .split(',')
          .map((amenity) => amenity.trim())
          .filter(Boolean)
      : [],
  }
  try {
    if (editing.value) {
      await roomApi.update(editingId.value, payload)
      success.value = t('rooms.updateSuccess')
    } else {
      await roomApi.store(payload)
      success.value = t('rooms.createSuccess')
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/**
 * Opens the status-change modal for a room, defaulting an available room to cleaning.
 * @param {Object} room - The room whose status is being changed.
 */
function openStatus(room) {
  modalError.value = ''
  statusRoom.value = room
  statusForm.status = room.status === 'available' ? 'cleaning' : room.status
  statusForm.notes = ''
  showStatus.value = true
}

/** Persists the new room status (with optional notes) and reloads the list. */
async function saveStatus() {
  modalError.value = ''
  saving.value = true
  try {
    await roomApi.updateStatus(statusRoom.value.room_id, {
      status: statusForm.status,
      notes: statusForm.notes,
    })
    showStatus.value = false
    success.value = t('rooms.statusUpdated', { number: statusRoom.value.room_number })
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/**
 * Deletes a room after a confirmation prompt.
 * @param {Object} room - The room row to delete.
 */
async function remove(room) {
  if (!window.confirm(t('rooms.deleteMessage', { roomNumber: room.room_number }))) return
  error.value = ''
  try {
    await roomApi.destroy(room.room_id)
    success.value = t('rooms.deleteSuccess')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/**
 * Deletes every selected room; the typed-confirmation modal guards the action.
 */
async function bulkDelete() {
  error.value = ''
  deleting.value = true
  try {
    const { tried, failed } = await bulk.removeMany((id) => roomApi.destroy(id))
    if (failed > 0) {
      error.value = t('rooms.bulkDeletePartial', { tried, failed })
    } else if (tried > 0) {
      success.value = t('rooms.bulkDeleteSuccess', { count: tried })
    }
    bulk.clear()
    showBulkDelete.value = false
    await load()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    deleting.value = false
  }
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

// ─── Rooms tab bar: inventory summary (default), bulk rates, stop-sell ───
// The list table above stays the INVENTORY tab; the other two panels read/write
// the same API surface exposed by reservations/rates/stop-sell endpoints.
const tabs = [
  { key: 'inventory', label: 'rooms.tabInventory', icon: 'fas fa-bed', tone: 'brand' },
  { key: 'rates', label: 'rooms.tabRates', icon: 'fas fa-tags', tone: 'success' },
  { key: 'stop-sell', label: 'rooms.tabStopSell', icon: 'fas fa-ban', tone: 'danger' },
]
const activeTab = ref('inventory')

// Inventory summary (per room type): room_count / available / stop-sold days.
const invSummary = ref([])
const invLoading = ref(false)

const loadInventory = async () => {
  invLoading.value = true
  try {
    const res = await roomApi.inventory()
    invSummary.value = res.data?.summaries ?? []
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    invLoading.value = false
  }
}

// RATES: bulk per-room-type update (manager only — canEdit = authStore.can(80)).
const rateForm = reactive({ room_type: 'single', price_per_night: null })
const ratesLoading = ref(false)

const pushRates = async () => {
  if (!rateForm.room_type || !rateForm.price_per_night) return
  ratesLoading.value = true
  try {
    await roomApi.updateRates({
      room_type: rateForm.room_type,
      price_per_night: rateForm.price_per_night,
    })
    rateForm.price_per_night = null
    success.value = t('rooms.ratesUpdated')
    // Manager review: pushing rates only refreshed the inventory summary, so the
    // price still shown against each room stayed stale and looked like the push
    // had not worked until the page was reloaded. Refresh both the summary and
    // the room list.
    await Promise.all([loadInventory(), load()])
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    ratesLoading.value = false
  }
}

// STOP-SELL: blocks per room over a date range; lift by stop_sell_id.
const blocks = ref([])
const blocksLoading = ref(false)
const stopForm = reactive({ pick: '', room_id: [], start_date: '', end_date: '', reason: '' })

/**
 * Blocks the server could not read, so the page can admit them.
 *
 * Empty in normal operation. When it is not, a room that is genuinely blocked
 * would otherwise look sellable on the grid and to the booking check, which is
 * the one mistake this screen must not make.
 */
const blockWarnings = ref([])

// The calendar window. Two weeks is enough to see a range block without the
// grid becoming unreadably wide.
const calFrom = ref(todayIso())
const calTo = ref(todayIso(13))

/** Every room of the hotel, for the picker and as the calendar's rows. */
const calRooms = ref([])

/** Nights shown as calendar columns, inclusive of both ends. */
const calDays = computed(() => {
  const days = []
  const start = new Date(`${calFrom.value}T00:00:00`)
  const end = new Date(`${calTo.value}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return days

  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(toIso(d))
  }

  return days
})

/**
 * Which room is stopped on which night, as `room_id -> Set(isoDate)`.
 *
 * The backend returns an expanded `nights` list per block, so a range block is
 * already one entry per night and needs no client-side date arithmetic.
 */
const stoppedMap = computed(() => {
  const map = new Map()
  for (const b of blocks.value) {
    const roomId = b.room_id
    // A type-level block (no room_id) is resolved through the calendar rows.
    const targets = roomId
      ? [roomId]
      : calRooms.value.filter((r) => r.room_type === b.room_type).map((r) => r.room_id)

    for (const target of targets) {
      if (!map.has(target)) map.set(target, new Set())
      const set = map.get(target)
      for (const night of b.nights ?? [b.stop_date]) set.add(night)
    }
  }

  return map
})

const isStoppedOn = (roomId, isoDate) => Boolean(stoppedMap.value.get(roomId)?.has(isoDate))

/** Rooms offered in the stop-sell picker; already-picked rooms are hidden. */
const roomPickerOptions = computed(() =>
  calRooms.value
    .filter((r) => !stopForm.room_id.includes(r.room_id))
    .map((r) => ({ value: r.room_id, label: `${r.room_number} · ${r.room_type}` })),
)

const roomLabel = (roomId) =>
  calRooms.value.find((r) => r.room_id === roomId)?.room_number ?? roomId

/**
 * Adds the picked room to the pending block.
 *
 * SearchableSelect is single-select, so rooms are added one at a time to a chip
 * list rather than through a multi-select. Re-adding is a no-op.
 */
const addStopRoom = () => {
  if (!stopForm.pick || stopForm.room_id.includes(stopForm.pick)) return
  stopForm.room_id.push(stopForm.pick)
  stopForm.pick = ''
}

const removeStopRoom = (roomId) => {
  stopForm.room_id = stopForm.room_id.filter((id) => id !== roomId)
}

const loadBlocks = async () => {
  blocksLoading.value = true
  try {
    // Ask only for the calendar window: the endpoint returns blocks that overlap
    // it, so a range starting before the window is still drawn.
    const res = await roomApi.stopSell({ from_date: calFrom.value, to_date: calTo.value })
    blocks.value = res.data?.blocks ?? []
    // A block the server could not read is left off the grid. Saying so beats a
    // room quietly reading as sellable when it is actually blocked.
    blockWarnings.value = res.data?.warnings ?? []
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    blocksLoading.value = false
  }
}

/** Loads the room list once for the picker and the calendar's rows. */
const loadCalendarRooms = async () => {
  try {
    const res = await roomApi.index({ per_page: 100 })
    const rows = res.data?.data ?? []
    calRooms.value = rows.map((r) => ({
      room_id: r.room_id,
      room_number: r.room_number,
      room_type: r.room_type,
    }))
  } catch (err) {
    error.value = flattenError(err)
  }
}

const placeStopSell = async () => {
  if (!stopForm.room_id.length || !stopForm.start_date) return
  try {
    await roomApi.storeStopSell({
      room_ids: stopForm.room_id,
      start_date: stopForm.start_date,
      // Omitting end_date blocks a single night; sending it equal to the start
      // would be equivalent, so only send a real range.
      ...(stopForm.end_date && stopForm.end_date !== stopForm.start_date
        ? { end_date: stopForm.end_date }
        : {}),
      reason: stopForm.reason || undefined,
    })
    stopForm.pick = ''
    stopForm.room_id = []
    stopForm.start_date = ''
    stopForm.end_date = ''
    stopForm.reason = ''
    success.value = t('rooms.stopSellPlaced')
    await Promise.all([loadBlocks(), loadInventory()])
  } catch (err) {
    error.value = flattenError(err)
  }
}

// ─── Setting stop-sell from the calendar grid ───────────────────────────────
//
// The range a manager has picked but not yet confirmed, in the same room the
// gesture started in. Dates are ISO so they compare as plain strings, which is
// all a range needs.
const calPick = ref({ roomId: null, start: '', end: '' })
const calPickReason = ref('')
const placingPick = ref(false)

/** True while a drag is in progress, so a click never doubles as a drag start. */
const dragging = ref(false)

/** Nights in the pending range, so the bar can say "3 nights" before saving. */
const calPickNights = computed(() => {
  if (!calPick.value.start || !calPick.value.end) return 0
  return Math.round((Date.parse(`${calPick.value.end}T00:00:00`) - Date.parse(`${calPick.value.start}T00:00:00`)) / 86400000) + 1
})

/** True when `iso` falls inside the pending range for its room. */
const isPicked = (roomId, iso) =>
  Boolean(calPick.value.roomId) &&
  calPick.value.roomId === roomId &&
  iso >= calPick.value.start &&
  iso <= calPick.value.end

/**
 * Cell appearance. Stopped wins over pending so an existing block is never
 * hidden behind a selection, and a pending night is only ever drawn on a cell
 * that is not already stopped.
 */
const cellClass = (roomId, iso) => {
  if (isStoppedOn(roomId, iso)) return 'cal-stopped'
  if (isPicked(roomId, iso)) return 'cal-picked'
  return 'cal-free'
}

const cellTitle = (roomId, iso) => {
  const when = `${roomLabel(roomId)} · ${formatDayLabel(iso)}`
  if (isStoppedOn(roomId, iso)) return `${when} — ${t('rooms.stopSellLiftNight')}`
  if (isPicked(roomId, iso)) return `${when} — ${t('rooms.stopSellPicked')}`
  return `${when} — ${t('rooms.stopSellSetNight')}`
}

/** Drops a pending range, so a stray click never strands a half-made block. */
const clearPick = () => {
  calPick.value = { roomId: null, start: '', end: '' }
  calPickReason.value = ''
}

/**
 * A click either starts a range, closes one, or lifts a stopped night.
 *
 * Tapping a night that is already stopped lifts it: the same gesture undoes
 * the block, so a manager who stops a room by mistake can undo it by pointing
 * at it again rather than hunting for the block in the table below.
 */
const onCellClick = async (roomId, iso) => {
  if (!canEdit.value) return
  if (isStoppedOn(roomId, iso)) {
    await liftNight(roomId, iso)
    return
  }
  const pick = calPick.value
  // A different room, or no range in progress: start again from this night.
  if (pick.roomId !== roomId || !pick.start) {
    calPick.value = { roomId, start: iso, end: iso }
    return
  }
  // Same room, second click: close the range, in whichever order it was clicked.
  calPick.value = { roomId, start: iso < pick.start ? iso : pick.start, end: iso > pick.start ? iso : pick.start }
}

/** Extends a range while dragging, but only within the row the drag began in. */
const onCellEnter = (roomId, iso) => {
  if (!dragging.value || !canEdit.value) return
  const pick = calPick.value
  if (pick.roomId !== roomId || !pick.start || isStoppedOn(roomId, iso)) return
  calPick.value = {
    roomId,
    start: iso < pick.start ? iso : pick.start,
    end: iso > pick.start ? iso : pick.start,
  }
}

/** Pressing a free night both starts a range and arms the drag. */
const onCellDown = (roomId, iso) => {
  if (!canEdit.value) return
  if (isStoppedOn(roomId, iso)) return
  const pick = calPick.value
  if (pick.roomId !== roomId || !pick.start) {
    calPick.value = { roomId, start: iso, end: iso }
    dragging.value = true
  } else if (pick.roomId === roomId && !pick.start) {
    calPick.value = { roomId, start: iso, end: iso }
    dragging.value = true
  }
}

/**
 * Lifts every block covering one night on one room.
 *
 * A night can be covered by a room block or by a whole-type block, so both are
 * lifted — otherwise the cell would stay red and the manager would think the
 * lift had failed.
 */
const liftNight = async (roomId, iso) => {
  const room = calRooms.value.find((r) => r.room_id === roomId)
  const covering = blocks.value.filter(
    (b) =>
      b.nights?.includes(iso) &&
      (b.room_id === roomId || (!b.room_id && room && b.room_type === room.room_type)),
  )
  if (!covering.length) return
  try {
    await Promise.all(covering.map((b) => roomApi.destroyStopSell(b.stop_sell_id)))
    success.value = t('rooms.stopSellLifted')
    await Promise.all([loadBlocks(), loadInventory()])
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Saves the pending range as a single block, then clears it. */
const placePick = async () => {
  const { roomId, start, end } = calPick.value
  if (!roomId || !start) return
  placingPick.value = true
  try {
    await roomApi.storeStopSell({
      room_ids: [roomId],
      start_date: start,
      ...(end && end !== start ? { end_date: end } : {}),
      reason: calPickReason.value || undefined,
    })
    clearPick()
    success.value = t('rooms.stopSellPlaced')
    await Promise.all([loadBlocks(), loadInventory()])
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    placingPick.value = false
  }
}

const liftStopSell = async (id) => {
  try {
    await roomApi.destroyStopSell(id)
    success.value = t('rooms.stopSellLifted')
    await Promise.all([loadBlocks(), loadInventory()])
  } catch (err) {
    error.value = flattenError(err)
  }
}

// Tab switch loads each panel's data lazily once; inventory also drives the
// summary chips pinned above the room table.
function switchTab(key) {
  activeTab.value = key
  if (key === 'inventory' && !invSummary.value.length) loadInventory()
  if (key === 'stop-sell') {
    // The calendar needs both the rooms and the blocks in the window.
    if (!calRooms.value.length) loadCalendarRooms()
    if (!blocks.value.length) loadBlocks()
  }
}

/** ISO date for a Date, in local time (toISOString would shift the day). */
function toIso(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Today, or today shifted by `offsetDays`, as an ISO date. */
function todayIso(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return toIso(d)
}

/** Short weekday + day number, for the calendar header. */
function formatDayLabel(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
}

onMounted(() => {
  load()
  loadInventory()
})

</script>

<style scoped>

/*
  Manager review: "the color is too similar to the others, I do not see which one
  is highlighted" and "how to see a calendar of stop sell".

  The calendar is the fix: a stopped room/night is a solid, high-contrast red
  cell with an icon, while a sellable one is a plain pale cell. A block is either
  fully stopped or not stopped at all, so the two states must be trivially
  distinguishable rather than distinguished by a subtle tint.
*/
.stop-sell-calendar {
  table-layout: fixed;
  /* Same trap as `.table`: clipping to the rounded corners makes the table a
     scroll container, which stops the day header sticking. */
  overflow: visible;
}

.stop-sell-calendar .cal-room-col {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--card, #fff);
  min-width: 110px;
  text-align: left;
}

/* The calendar scrolls in both directions, and the day header has to stay put.
   Without it, reaching room 30 scrolls the dates off the top of the grid and
   every row below becomes unreadable: you can see that a room is stopped, but
   not on which night, which is the only thing that matters here.

   A sticky header needs something to pin to, and `overflow-x: auto` on its own
   makes this wrapper a vertical scroller that never scrolls, so the height is
   set explicitly and the grid scrolls inside its own box. */
.table-scroll.cal-scroll {
  max-height: 62vh;
  overflow-y: auto;
}

.stop-sell-calendar thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f9f9f9;
}

/* The "Room" cell sits on both pinned axes, so it has to out-rank the day
   headers it overlaps. It also joins the header's grey band, otherwise the
   corner reads as a gap in it. */
.stop-sell-calendar thead th.cal-room-col {
  z-index: 3;
  background: #f9f9f9;
}

.stop-sell-calendar .cal-room-col .muted {
  display: block;
  font-size: 11px;
}

.cal-cell {
  text-align: center;
  height: 34px;
  padding: 0 !important;
}

.cal-stopped {
  background: #dc2626 !important;
  color: #fff;
  box-shadow: inset 0 0 0 1px #991b1b;
}

.cal-free {
  background: #f1f5f9;
}

.cal-free:hover {
  background: #e2e8f0;
}

/* Manager review item 6: the calendar has to be clickable. A pending night is
   drawn in the brand colour and outlined, so it reads as "chosen" without
   looking like the danger red of an actual stop-sell. A stopped cell also takes
   the pointer, since clicking it lifts the night. */

.cal-cell {
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}
.cal-cell:hover:not(.cal-stopped) {
  background: #e2e8f0;
}
.cal-cell.cal-stopped:hover {
  background: #b91c1c;
}

.cal-picked {
  background: var(--brand-light);
  box-shadow: inset 0 0 0 2px var(--brand);
}

.stop-sell-calendar .cal-stopped:hover {
  background: #b91c1c !important;
}

.cal-key-picked {
  background: var(--brand-light);
  box-shadow: inset 0 0 0 2px var(--brand);
}

/* The confirmation strip. It sits directly under the grid controls so the
   pending nights and the button that saves them are read together. */
.cal-pick-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0;
  padding: 10px 14px;
  border: 1px solid var(--brand);
  border-left-width: 4px;
  border-radius: 8px;
  background: var(--brand-light);
}

.cal-pick-bar .muted {
  display: block;
  font-size: 12px;
}

.cal-pick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.cal-pick-actions .input {
  min-width: 180px;
}

.cal-hint {
  margin: 12px 0;
}

.stop-sell-calendar th.today {
  box-shadow: inset 0 -3px 0 var(--brand);
}

.cal-key {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  margin: 0 4px 0 12px;
  vertical-align: -1px;
}

.cal-key-stopped {
  background: #dc2626;
  box-shadow: inset 0 0 0 1px #991b1b;
}

.cal-key-free {
  background: #f1f5f9;
  box-shadow: inset 0 0 0 1px #cbd5e1;
}

.stop-pick {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.stop-pick > :first-child {
  flex: 1;
  min-width: 0;
}

.stop-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.stop-chips .room-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chip-x {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0.7;
}

.chip-x:hover {
  opacity: 1;
}

/* Manager review: the rooms a stop-sell block actually covers. */
.stop-sell-rooms {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stop-sell-count {
  font-weight: 600;
  color: var(--danger, #b91c1c);
}

.stop-sell-numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.room-chip {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border: 1px solid var(--border, #d4d4d8);
  border-radius: 999px;
  background: var(--surface-muted, #f4f4f5);
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: nowrap;
}
.dashboard-page {
  padding: 32px 20px;
}

/* Tab bar: spaced pills; the active tab is tinted by its role
   (brand = inventory, success = rates, danger = stop-sell). */
.tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px;
  margin-bottom: 20px;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 1px solid #eee;
  border-radius: 999px;
  background: #f0f2f5;
  color: #757575;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;
}

.tab:hover {
  background: #e4e8ec;
  color: #333;
}

.tab i {
  font-size: 13px;
}

.tab.active {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.tab-brand.active {
  background: #005eb8;
  border-color: #005eb8;
  color: #fff;
}

.tab-success.active {
  background: #1e8449;
  border-color: #1e8449;
  color: #fff;
}

.tab-danger.active {
  background: #c0392b;
  border-color: #c0392b;
  color: #fff;
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
  grid-template-columns: repeat(3, 1fr) auto;
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

.bulk-col {
  width: 40px;
}

.bulk-col input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.price {
  font-weight: 700;
  color: #005eb8;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.form-full {
  grid-column: 1 / -1;
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

.modal-sm {
  max-width: 420px;
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

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
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
