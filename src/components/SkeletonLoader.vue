<!--
  SkeletonLoader — shimmer placeholder shown while page data is being fetched.

  Variants:
    table - rows of width-varied bars (for data tables / lists)
    cards - card placeholders (for card grids)
    kpi   - tall blocks for KPI/stat cards
    list  - simple single-column list placeholders
    tree  - indented lines for category trees

  Props: variant (default "table"), count (number of placeholder items),
         cols (columns per row, table variant only).
-->
<template>
  <div
    class="sk-block"
    :class="`sk-block--${variant}`"
    role="status"
    aria-label="Loading…"
  >
    <template v-if="variant === 'table'">
      <div v-for="n in count" :key="n" class="sk-row">
        <div
          v-for="c in cols"
          :key="c"
          class="sk sk-bar"
          :style="{ width: widths[(c - 1) % widths.length] }"
        ></div>
      </div>
    </template>

    <template v-else-if="variant === 'cards'">
      <div v-for="n in count" :key="n" class="sk-card">
        <div class="sk sk-line" v-for="c in cols" :key="c" :style="{ width: widths[(c - 1) % widths.length] }"></div>
        <div class="sk sk-line sk-chip" style="width: 45%"></div>
      </div>
    </template>

    <template v-else-if="variant === 'kpi'">
      <div v-for="n in count" :key="n" class="sk sk-kpi"></div>
    </template>

    <template v-else-if="variant === 'list'">
      <div v-for="n in count" :key="n" class="sk sk-li"></div>
    </template>

    <template v-else-if="variant === 'tree'">
      <div
        v-for="n in count"
        :key="n"
        class="sk sk-ti"
        :style="{ width: widths[n % widths.length], marginLeft: n % 3 ? 14 : 0 }"
      ></div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'table' },
  count: { type: Number, default: 6 },
  cols: { type: Number, default: 5 },
})

const widths = ['72%', '45%', '55%', '30%', '62%', '38%']
</script>