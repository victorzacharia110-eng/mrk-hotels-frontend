<!--
  PanelReviewPage.vue — the readable record of the manager panel review
  (route /app/panel-review, name panel-review).

  Manager review asked a lot of questions across the whole panel. This page
  answers them back in the same plain terms: what the problem was, what was
  changed, and where on screen the result can be seen.

  Two things this page deliberately is not. It does not list file paths or
  route names — the audience is a hotel manager, not a developer, and a route
  name in a help page rots the moment a page moves. And it does not quietly
  drop the unfinished items: anything still open is listed as open, because a
  review answered in full but honestly is more useful than one that looks
  complete.

  The content lives in src/data/panelReview.js so the wording of a point is
  edited in one place rather than hunted for in a template.
-->
<template>
  <div class="dashboard-page container review-page">
    <div class="page-head">
      <div>
        <h1>{{ $t('panelReview.title') }}</h1>
        <p class="muted">{{ $t('panelReview.intro') }}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="printPage">
          <i class="fas fa-print"></i> {{ $t('common.print') }}
        </button>
      </div>
    </div>

    <!-- ─── Where things stand ─────────────────────────────────────── -->
    <div class="card counts">
      <div class="count">
        <strong>{{ counts.total }}</strong>
        <span class="muted">{{ $t('panelReview.countTotal') }}</span>
      </div>
      <div class="count">
        <strong class="ok">{{ counts.done }}</strong>
        <span class="muted">{{ $t('panelReview.countDone') }}</span>
      </div>
      <div v-if="counts.partial" class="count">
        <strong class="warn">{{ counts.partial }}</strong>
        <span class="muted">{{ $t('panelReview.countPartial') }}</span>
      </div>
      <div v-if="counts.open" class="count">
        <strong class="open">{{ counts.open }}</strong>
        <span class="muted">{{ $t('panelReview.countOpen') }}</span>
      </div>
    </div>

    <p class="hint">{{ $t('panelReview.howToRead') }}</p>

    <!-- ─── Find a point ───────────────────────────────────────────── -->
    <div class="card">
      <div class="filters">
        <div class="field">
          <label for="pr-search">{{ $t('panelReview.searchLabel') }}</label>
          <input
            id="pr-search"
            v-model.trim="search"
            type="search"
            class="input"
            :placeholder="$t('panelReview.searchPlaceholder')"
          />
        </div>
        <div class="field">
          <label for="pr-status">{{ $t('panelReview.statusLabel') }}</label>
          <select id="pr-status" v-model="status" class="input">
            <option value="all">{{ $t('panelReview.statusAll') }}</option>
            <option value="done">{{ $t('panelReview.statusDone') }}</option>
            <option v-if="counts.partial" value="partial">{{ $t('panelReview.statusPartial') }}</option>
            <option v-if="counts.open" value="open">{{ $t('panelReview.statusOpen') }}</option>
          </select>
        </div>
      </div>
      <p v-if="search && !matchingCount" class="muted">{{ $t('panelReview.noMatches') }}</p>
    </div>

    <!-- ─── The points, by area ────────────────────────────────────── -->
    <section v-for="group in visibleGroups" :key="group.id" class="group">
      <h2 class="group-title">{{ group.title }}</h2>
      <p v-if="group.blurb" class="muted group-blurb">{{ group.blurb }}</p>

      <article v-for="item in group.items" :key="`${group.id}-${item.ref}-${item.ask}`" class="item card">
        <header class="item-head">
          <span class="ref">{{ item.ref }}</span>
          <span class="badge" :class="item.status">{{ statusLabel(item.status) }}</span>
        </header>

        <dl class="item-body">
          <div>
            <dt>{{ $t('panelReview.asked') }}</dt>
            <dd>{{ item.ask }}</dd>
          </div>
          <div>
            <dt>{{ $t('panelReview.problem') }}</dt>
            <dd>{{ item.problem }}</dd>
          </div>
          <div>
            <dt>{{ $t('panelReview.change') }}</dt>
            <dd>{{ item.solution }}</dd>
          </div>
          <div>
            <dt>{{ $t('panelReview.where') }}</dt>
            <dd>{{ item.where }}</dd>
          </div>
        </dl>
      </article>
    </section>
  </div>
</template>

<script setup>
/**
 * Renders the panel-review record. Deliberately no data fetching: the content
 * is the record itself, not a live reading, so this page works offline and
 * cannot fail to load on a slow connection.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { REVIEW_GROUPS, reviewCounts } from '@/data/panelReview'

const { t } = useI18n()

const counts = reviewCounts()

const search = ref('')
const status = ref('all')

/** Whether one point passes the search box and the status dropdown. */
function matches(item) {
  if (status.value !== 'all' && item.status !== status.value) return false
  if (!search.value) return true

  const needle = search.value.toLowerCase()

  return [item.ask, item.problem, item.solution, item.where, item.ref]
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

const visibleGroups = computed(() =>
  REVIEW_GROUPS.map((group) => ({ ...group, items: group.items.filter(matches) })).filter(
    (group) => group.items.length,
  ),
)

const matchingCount = computed(() => visibleGroups.value.reduce((n, g) => n + g.items.length, 0))

const statusLabel = (value) => t(`panelReview.status_${value}`)

function printPage() {
  window.print()
}
</script>

<style scoped>
.review-page {
  padding: 32px 20px;
  max-width: 980px;
}

.counts {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  align-items: flex-end;
}

.count {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.count strong {
  font-size: 28px;
}

.count strong.ok {
  color: #15803d;
}

.count strong.warn {
  color: #b45309;
}

.count strong.open {
  color: #b91c1c;
}

.count span {
  font-size: 13px;
}

.hint {
  font-size: 12.5px;
  color: #64748b;
  margin: 10px 0 0;
}

.filters {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 14px;
}

.group {
  margin-top: 28px;
}

.group-title {
  font-size: 19px;
  margin: 0 0 4px;
}

.group-blurb {
  margin: 0 0 12px;
}

.item {
  margin-bottom: 12px;
  border-left: 3px solid #cbd5e1;
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.ref {
  font-weight: 700;
  font-size: 14px;
}

.badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
}

.badge.done {
  background: #dcfce7;
  color: #15803d;
}

.badge.partial {
  background: #fef3c7;
  color: #b45309;
}

.badge.open {
  background: #fee2e2;
  color: #b91c1c;
}

.item-body {
  display: grid;
  gap: 10px;
  margin: 0;
}

.item-body dt {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.item-body dd {
  margin: 2px 0 0;
}

@media print {
  .head-actions,
  .filters {
    display: none;
  }

  .item {
    break-inside: avoid;
  }
}
</style>
