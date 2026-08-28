<script setup>
defineProps({
  page: { type: Number, required: true },
  lastPage: { type: Number, required: true },
})
const emit = defineEmits(['change'])
</script>

<template>
  <div class="sm-pagination" v-if="lastPage > 1">
    <button type="button" class="sm-btn sm-btn-sm" :disabled="page <= 1" @click="emit('change', page - 1)">‹</button>
    <span>{{ page }} / {{ lastPage }}</span>
    <button type="button" class="sm-btn sm-btn-sm" :disabled="page >= lastPage" @click="emit('change', page + 1)">›</button>
  </div>
</template>
