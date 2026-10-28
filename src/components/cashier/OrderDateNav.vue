<!--
  OrderDateNav — simplified date picker for cashier order boards.
-->
<template>
  <input :id="inputId" v-model="date" type="date" class="sm-input date-nav-input" @change="emitChange" />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
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
</script>

<style scoped>
.date-nav-input { min-width: 150px; }
</style>
