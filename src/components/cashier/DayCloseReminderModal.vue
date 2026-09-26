<script setup>
/**
 * The Day Close reminder from review item 18, in one place.
 *
 * It used to be written out three times — once in CashierLayout, once in
 * StoreManagerLayout and once inside OrderTakerDashboard — each with its own
 * sessionStorage key. A cashier on the order pad therefore got the layout
 * modal and the page banner stacked on the same screen, and a waiter (whose
 * panel is the page) never saw the layout's copy at all. The visibility now
 * lives in the workingDate store, so mounting this in every panel shell always
 * yields exactly one modal, and the dismissal is remembered once per session.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWorkingDateStore } from '@/stores/workingDate'

const props = defineProps({
  /** Route name of the panel's Day Close page. */
  proceedRoute: { type: String, required: true },
  /** Roles allowed to walk straight into Day Close from the reminder. */
  canProceedRoles: { type: Array, default: () => [] },
  /** The signed-in user's role, checked against canProceedRoles. */
  role: { type: String, default: '' },
})

const { t, d } = useI18n()
const route = useRoute()
const router = useRouter()
const workingDateStore = useWorkingDateStore()

// On the Day Close page itself the reminder is noise — the panel is already
// open, showing the very business date the popup is complaining about.
const onDayClosePage = computed(() => route.path.endsWith('/day-close'))

const visible = computed(
  () => workingDateStore.dayCloseReminderVisible && !onDayClosePage.value,
)

// The popup states the date new orders are filed under: the OPEN business
// date, which is still the working date until Day Close is run.
const openLabel = computed(() => {
  if (!workingDateStore.openDate) return ''
  return d(new Date(`${workingDateStore.openDate}T12:00:00`), 'long')
})

const canProceed = computed(() => props.canProceedRoles.includes(props.role))

function confirm() {
  workingDateStore.dismissDayCloseReminder()
}

function proceed() {
  workingDateStore.dismissDayCloseReminder()
  router.push({ name: props.proceedRoute })
}
</script>

<template>
  <div v-if="visible" class="dc-reminder-backdrop">
    <div class="dc-reminder-modal" role="dialog" aria-modal="true">
      <div class="dc-reminder-head">
        <h3>
          <i class="fas fa-calendar-check" aria-hidden="true"></i>
          {{ t('cashier.dayClose.reminderTitle') }}
        </h3>
      </div>
      <p class="dc-reminder-text">
        {{ t('cashier.dayClose.reminderText', { today: openLabel }) }}
      </p>
      <div class="dc-reminder-foot">
        <button v-if="canProceed" type="button" class="dc-btn ok" @click="proceed">
          <i class="fas fa-calendar-check" aria-hidden="true"></i>
          {{ t('cashier.dayClose.proceed') }}
        </button>
        <button type="button" class="dc-btn" @click="confirm">
          <i class="fas fa-check" aria-hidden="true"></i>
          {{ t('cashier.dayClose.confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dc-reminder-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.55);
}

.dc-reminder-modal {
  width: min(30rem, 100%);
  background: #fff;
  border-radius: 0.75rem;
  box-shadow: 0 1.5rem 3rem rgba(15, 23, 42, 0.3);
  overflow: hidden;
}

.dc-reminder-head {
  padding: 1rem 1.25rem 0.5rem;
}

.dc-reminder-head h3 {
  margin: 0;
  font-size: 1.05rem;
}

.dc-reminder-text {
  margin: 0;
  padding: 0 1.25rem 1rem;
  color: #475569;
  font-size: 0.95rem;
}

.dc-reminder-foot {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.75rem 1.25rem 1rem;
  border-top: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.dc-btn {
  padding: 0.5rem 0.9rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  background: #f8fafc;
  color: #0f172a;
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}

.dc-btn.ok {
  background: #0f766e;
  border-color: #0f766e;
  color: #fff;
}
</style>
