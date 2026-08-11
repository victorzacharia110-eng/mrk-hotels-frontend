<template>
  <div>
    <div class="page-head">
      <h1>{{ title }}</h1>
    </div>
    <div class="card placeholder">
      <i class="fas fa-hammer"></i>
      <p><strong>{{ title }}</strong> {{ $t('placeholder.underConstruction') }}</p>
      <p class="muted">{{ $t('placeholder.builtToMatch', { title }) }}</p>
    </div>
  </div>
</template>

<script setup>
// The module heading shown in the page header and the "under construction" card.
defineProps({
  title: { type: String, required: true },
})
</script>

<style scoped>
.placeholder {
  text-align: center;
  padding: 48px;
}

.placeholder i {
  font-size: 40px;
  color: #005EB8;
  margin-bottom: 12px;
}

.muted {
  color: #64748b;
  margin-top: 4px;
}
</style>
