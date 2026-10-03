<!--
  CancelReservationModal — Cancellation dialog for a reservation or a whole
  multi-room booking party.

  A standalone booking shows a plain confirmation. A grouped booking lists
  every room with a checkbox plus a mode radio:

    * "Cancel whole group" ticks every room checkbox.
    * Unticking any room flips the radio to "Cancel selected rooms".
    * Ticking every room back flips it to "Cancel whole group".
    * Choosing "Cancel selected rooms" clears the boxes so the radio and the
      checkboxes never disagree.

  Props:
    show        — Boolean controlling visibility.
    reservation — The reservation (with a `group.rooms[]` payload when grouped).
    busy        — Disables the confirm button while the request runs.
  Events:
    confirm     — { mode: 'single' | 'group' | 'selected', reservationIds[] }.
    cancel      — Emitted when dismissed without confirming.
-->
<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="cancel-modal-overlay" @click.self="onCancel">
        <div class="cancel-modal" role="dialog" aria-modal="true">
          <div class="cancel-modal-head">
            <span class="cancel-modal-icon" aria-hidden="true"><i class="fas fa-ban"></i></span>
            <h2 class="cancel-modal-title">{{ $t('reservations.cancelTitle') }}</h2>
            <button class="cancel-modal-close" @click="onCancel" :aria-label="$t('common.cancel')">
              <i class="fas fa-xmark"></i>
            </button>
          </div>

          <div class="cancel-modal-body">
            <p class="cancel-modal-lead">
              <strong>{{ reservation?.guest_name }}</strong>
              <span v-if="reservation?.room?.room_number">
                · {{ $t('reservations.room') }} {{ reservation.room.room_number }}
              </span>
            </p>

            <!-- Standalone booking: a plain yes/no confirmation. -->
            <p v-if="!isGroup" class="cancel-modal-message">
              {{ $t('reservations.confirmCancel', { name: reservation?.guest_name }) }}
            </p>

            <!-- Grouped booking: pick the rooms to cancel. -->
            <template v-else>
              <p class="cancel-modal-message">
                {{ $t('reservations.cancelGroupHint', { count: rooms.length }) }}
              </p>

              <div class="cancel-modes">
                <label class="cancel-mode">
                  <input type="radio" value="group" v-model="mode" @change="onModeChange" />
                  <span>{{ $t('reservations.cancelWholeGroup') }}</span>
                </label>
                <label class="cancel-mode">
                  <input type="radio" value="selected" v-model="mode" @change="onModeChange" />
                  <span>{{ $t('reservations.cancelSelectedRooms') }}</span>
                </label>
              </div>

              <ul class="cancel-room-list">
                <li v-for="room in rooms" :key="room.reservation_id">
                  <label class="cancel-room">
                    <input
                      type="checkbox"
                      :value="room.reservation_id"
                      v-model="selectedIds"
                      @change="syncMode"
                    />
                    <span class="cancel-room-label">
                      {{ $t('reservations.room') }} {{ room.room_number }}
                      <em v-if="room.guest_name">{{ room.guest_name }}</em>
                    </span>
                    <span v-if="room.is_primary" class="cancel-primary-tag">
                      {{ $t('reservations.primaryRoom') }}
                    </span>
                  </label>
                </li>
              </ul>
            </template>
          </div>

          <div class="cancel-modal-foot">
            <button type="button" class="btn btn-secondary" @click="onCancel" :disabled="busy">
              {{ $t('common.cancel') }}
            </button>
            <button
              type="button"
              class="btn btn-danger"
              :disabled="busy || (isGroup && !selectedIds.length)"
              @click="onConfirm"
            >
              <i v-if="busy" class="fas fa-spinner fa-spin"></i>
              <i v-else class="fas fa-ban"></i>
              {{ $t('reservations.confirmCancellation') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  reservation: { type: Object, default: null },
  busy: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

// Every room in the party (empty for a standalone booking).
const rooms = computed(() => props.reservation?.group?.rooms || [])
// A party is anything with more than one room; a lone room stays a plain confirm.
const isGroup = computed(() => rooms.value.length > 1)

const mode = ref('group')
const selectedIds = ref([])

// Reset to the safe default each time a reservation is loaded: every room
// selected, cancelling the whole group.
watch(
  () => props.reservation,
  (reservation) => {
    if (!reservation) return
    selectedIds.value = (reservation.group?.rooms || []).map((room) => room.reservation_id)
    mode.value = 'group'
  },
  { immediate: true },
)

/** The mode radio changed: keep the checkboxes in step with it. */
function onModeChange() {
  selectedIds.value =
    mode.value === 'group' ? rooms.value.map((room) => room.reservation_id) : []
}

/** A checkbox changed: whole group only when every box is ticked. */
function syncMode() {
  mode.value =
    rooms.value.length > 0 && selectedIds.value.length === rooms.value.length
      ? 'group'
      : 'selected'
}

function onCancel() {
  if (props.busy) return
  emit('cancel')
}

function onConfirm() {
  if (props.busy) return

  if (!isGroup.value) {
    emit('confirm', { mode: 'single', reservationIds: [props.reservation.reservation_id] })
    return
  }

  emit('confirm', {
    mode: mode.value,
    reservationIds: [...selectedIds.value],
  })
}
</script>

<style scoped>
.cancel-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
}

.cancel-modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 460px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.cancel-modal-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #fee2e2, #fca5a5);
}

.cancel-modal-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #fff;
  background: #dc2626;
  flex-shrink: 0;
}

.cancel-modal-title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.cancel-modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.cancel-modal-close:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #1e293b;
}

.cancel-modal-body {
  padding: 20px;
}

.cancel-modal-lead {
  margin: 0 0 8px;
  font-size: 14px;
  color: #334155;
}

.cancel-modal-message {
  margin: 0;
  font-size: 14px;
  color: #334155;
  line-height: 1.5;
}

.cancel-modes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 16px 0;
}

.cancel-mode {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #1e293b;
  cursor: pointer;
}

.cancel-room-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.cancel-room-list li + li {
  border-top: 1px solid #e2e8f0;
}

.cancel-room {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  font-size: 14px;
  color: #1e293b;
  cursor: pointer;
}

.cancel-room:hover {
  background: #f8fafc;
}

.cancel-room-label {
  display: flex;
  flex-direction: column;
}

.cancel-room-label em {
  font-style: normal;
  font-size: 12px;
  color: #64748b;
}

.cancel-primary-tag {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #b45309;
  background: #fef3c7;
  border-radius: 999px;
  padding: 2px 8px;
}

.cancel-modal-foot {
  padding: 12px 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-modal-foot .btn {
  min-width: 96px;
}

/* Transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-active .cancel-modal,
.modal-fade-leave-active .cancel-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .cancel-modal {
  transform: scale(0.95) translateY(10px);
}

.modal-fade-leave-to .cancel-modal {
  transform: scale(0.95) translateY(-10px);
}
</style>
