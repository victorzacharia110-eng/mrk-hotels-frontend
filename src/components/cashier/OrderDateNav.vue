<!--
  OrderDateNav — date navigator for the cashier order boards.

  Renders ‹ prev · [date input] · next › plus an optional "Today" shortcut
  that appears whenever the picked date is not the board's working (today)
  date, so older orders stay reachable by date without being dumped on the
  board. Emits `change` after v-model updates so the board can reload.
-->

<template>
  <div class="date-nav">
    <button type="button" class="sm-btn sm ghost nav-btn" :disabled="!modelValue"
      :title="$t('common.previous')" :aria-label="$t('common.previous')" @click="shift(-1)">
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </button>
    <input :id="inputId" v-model="date" type="date" class="sm-input" @change="emitChange" />
    <button type="button" class="sm-btn sm ghost nav-btn" :disabled="!modelValue"
      :title="$t('common.next')" :aria-label="$t('common.next')" @click="shift(1)">
      <i class="fas fa-chevron-right" aria-hidden="true"></i>
    </button>
    <button v-if="today && modelValue && modelValue !== today" type="button"
      class="sm-btn sm ghost today-btn" @click="jump(today)">
      <i class="fas fa-rotate-left" aria-hidden="true"></i> {{ todayLabel }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { addDays } from '@/utils/dates'

const props = defineProps({
  modelValue: { type: String, default: '' },
  /** The board's "today" (F&B open business date); enables the Today shortcut. */
  today: { type: String, default: '' },
  todayLabel: { type: String, default: 'Today' },
  inputId: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'change'])

const date = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

function emitChange() {
  emit('change', props.modelValue)
}

function shift(days) {
  const next = addDays(props.modelValue, days)
  if (!next) return
  emit('update:modelValue', next)
  emit('change', next)
}

function jump(value) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<style scoped>
.date-nav { display: inline-flex; align-items: center; gap: 6px; }
.nav-btn { padding-inline: 8px; }
.today-btn { white-space: nowrap; }
</style>
