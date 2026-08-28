<!--
  ReportBrowserLayout — the classic PMS report browser shell.

  Mirrors the reference layout (see ~/Pictures/Screenshots/*.png):
  a collapsible category tree on the left (Reservation / Front Office /
  Back Office / Audit / Statistical / Graphs), a filter toolbar across the
  top of the content, and a printable report body with a help-guide panel.

  Props:
    categories   - [{ key, label, icon, reports: [{ key, label, icon? }] }]
    active       - key of the currently selected report
    title        - page title shown in the header
    subtitle     - optional muted subtitle
    exporting    - when true shows a busy state in the export row

  Emits:
    select    - (reportKey) when a report in the tree is clicked
    print     - when the toolbar Print button is clicked
    export    - when the toolbar Export button is clicked
    search    - (term) debounced on the global search box
-->
<template>
  <div class="rb-root">
    <div class="rb-header">
      <button v-if="showBack" class="rb-back" type="button" :title="$t('reportBrowser.back')" @click="$emit('back')">
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>
      <div class="rb-head-title">
        <h1>{{ title }}</h1>
        <p v-if="subtitle" class="rb-subtitle muted">{{ subtitle }}</p>
      </div>
      <div class="rb-search">
        <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
        <input
          type="search"
          v-model="searchTerm"
          :placeholder="$t('reportBrowser.search')"
          :aria-label="$t('reportBrowser.search')"
        />
      </div>
      <div class="rb-tools">
        <select class="rb-quick" :value="active" :aria-label="$t('reportBrowser.jumpTo')" @change="$emit('select', $event.target.value)">
          <option value="" disabled>{{ $t('reportBrowser.jumpTo') }}</option>
          <optgroup v-for="cat in categories" :key="cat.key" :label="$t(cat.label)">
            <option v-for="r in cat.reports" :key="r.key" :value="r.key">{{ $t(r.label) }}</option>
          </optgroup>
        </select>
        <button type="button" class="rb-tool-btn" :title="$t('reportBrowser.print')" @click="$emit('print')">
          <i class="fas fa-print" aria-hidden="true"></i>
        </button>
        <button type="button" class="rb-tool-btn" :disabled="exporting" :title="$t('reportBrowser.export')" @click="$emit('export')">
          <i v-if="exporting" class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <i v-else class="fas fa-download" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <div class="rb-body">
      <!-- ── Left: collapsible report category tree ─────────── -->
      <aside class="rb-tree">
        <div
          v-for="cat in categories"
          :key="cat.key"
          class="rb-cat"
          :class="{ open: expanded[cat.key] }"
        >
          <button type="button" class="rb-cat-head" @click="toggleCat(cat.key)">
            <i
              class="fas"
              :class="expanded[cat.key] ? 'fa-chevron-down' : 'fa-chevron-right'"
              aria-hidden="true"
            ></i>
            <i :class="cat.icon || 'fas fa-folder'" class="rb-cat-icon" aria-hidden="true"></i>
            <span>{{ $t(cat.label) }}</span>
            <span class="rb-cat-count">{{ cat.reports.length }}</span>
          </button>
          <div v-show="expanded[cat.key]" class="rb-cat-reports">
            <button
              v-for="r in cat.reports"
              :key="r.key"
              type="button"
              class="rb-report"
              :class="{ active: active === r.key }"
              @click="$emit('select', r.key)"
            >
              <i :class="r.icon || 'fas fa-file-lines'" aria-hidden="true"></i>
              <span>{{ $t(r.label) }}</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- ── Right: active report (toolbar + body via slots) ── -->
      <main class="rb-content">
        <slot name="toolbar"></slot>
        <div class="rb-paper">
          <slot></slot>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  categories: { type: Array, required: true },
  active: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  exporting: { type: Boolean, default: false },
  showBack: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'print', 'export', 'search', 'back'])

const searchTerm = ref('')
const expanded = ref({})

watch(
  () => props.categories,
  (cats) => {
    const state = {}
    for (const cat of cats) {
      // Default to open so the tree reads like the reference on first load.
      state[cat.key] = true
    }
    expanded.value = state
  },
  { immediate: true },
)

let timer = null
watch(searchTerm, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => emit('search', value.trim()), 300)
})

function toggleCat(key) {
  expanded.value[key] = !expanded.value[key]
}
</script>

<style scoped>
.rb-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  /* Fill the viewport below the fixed app header so the sidebar and the
     report content scroll internally instead of growing the whole page. */
  height: calc(100vh - 128px);
  background: #f4f6fa;
}

/* ── Header ─────────────────────────────────────────────── */
.rb-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--mrk-dark, #062a52);
  color: #fff;
  flex-wrap: wrap;
}

.rb-back {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 6px;
  background: transparent;
  color: #fff;
  cursor: pointer;
}

.rb-head-title h1 {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.rb-subtitle {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.rb-search {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 6px 12px;
  min-width: 200px;
}

.rb-search i {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

.rb-search input {
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 13px;
  width: 100%;
}

.rb-search input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.rb-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rb-quick {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  max-width: 220px;
}

.rb-quick option,
.rb-quick optgroup {
  color: #062a52;
  background: #fff;
}

.rb-tool-btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 6px;
  background: transparent;
  color: #fff;
  cursor: pointer;
}

.rb-tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rb-tool-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

/* ── Body ───────────────────────────────────────────────── */
.rb-body {
  display: flex;
  flex: 1;
  min-height: 0;
  align-items: stretch;
}

/* ── Category tree (left sidebar) ───────────────────────── */
.rb-tree {
  width: 260px;
  min-width: 260px;
  background: #fff;
  border-right: 1px solid #e2e6ee;
  overflow-y: auto;
  padding: 10px;
}

.rb-cat {
  margin-bottom: 4px;
  border-radius: 8px;
}

.rb-cat.open {
  background: #f2f6fb;
}

.rb-cat-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  text-align: left;
  border-radius: 8px;
}

.rb-cat-head:hover {
  background: #e6eef8;
}

.rb-cat-head .fa-chevron-right,
.rb-cat-head .fa-chevron-down {
  font-size: 11px;
  color: #7c8db0;
}

.rb-cat-icon {
  color: var(--mrk-blue, #005eb8);
}

.rb-cat-count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  color: var(--mrk-blue, #005eb8);
  background: var(--mrk-pale, #e8f1fa);
  border-radius: 999px;
  padding: 1px 8px;
}

.rb-cat-reports {
  padding: 2px 0 6px;
}

.rb-report {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px 7px 30px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12.5px;
  color: #475569;
  text-align: left;
  border-radius: 6px;
}

.rb-report i {
  font-size: 12px;
  color: #94a3b8;
}

.rb-report:hover {
  background: #e6eef8;
}

.rb-report.active {
  background: var(--mrk-blue, #005eb8);
  color: #fff;
}

.rb-report.active i {
  color: #fff;
}

/* ── Content (paper) ────────────────────────────────────── */
.rb-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 14px;
  overflow-y: auto;
  background: #eef1f6;
}

.rb-paper {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(16, 42, 67, 0.12);
  padding: 24px 28px;
  flex: 1;
}

@media (max-width: 900px) {
  .rb-tree {
    width: 210px;
    min-width: 210px;
  }
  .rb-search {
    order: 5;
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 720px) {
  .rb-header {
    align-items: flex-start;
  }
  .rb-body {
    flex-direction: column;
  }
  .rb-tree {
    width: 100%;
    min-width: 0;
    max-height: 180px;
    border-right: none;
    border-bottom: 1px solid #e2e6ee;
  }
}
</style>
