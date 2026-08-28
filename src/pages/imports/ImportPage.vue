<!--
  Import Data page (route: /app/import, admins only — level:90).

  Walks through three steps: pick an entity importer (rooms, guests,
  reservations, payments or distribution channels), upload a CSV whose
  headers are matched generously (case/separator-insensitive aliases), then
  dry-run it to see a per-row report before committing. The dry run never
  writes; committing skips problem rows and upserts idempotently on natural
  keys so the same file can be re-imported safely.
-->
<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1>{{ $t('import.title') }}</h1>
        <p class="muted">{{ $t('import.subtitle') }}</p>
      </div>
    </div>

    <div v-if="!canImport" class="alert alert-error">{{ $t('import.noPermission') }}</div>

    <template v-else>
      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <!-- Step 1: importer picker -->
      <div class="card">
        <div class="card-title">{{ $t('import.chooseImporter') }}</div>
        <div v-if="loadingImporters" class="alert alert-info">{{ $t('common.loading') }}</div>
        <div v-else class="importer-grid">
          <button
            v-for="imp in importers"
            :key="imp.key"
            type="button"
            class="importer-card"
            :class="{ 'importer-card--active': active.key === imp.key }"
            :disabled="busy"
            @click="selectImporter(imp)"
          >
            <div class="importer-name">
              <i class="fas fa-file-csv"></i> {{ imp.label }}
            </div>
            <div class="importer-meta">
              <span class="badge badge--soft">{{ $t('import.targetTable') }}: {{ imp.target_table }}</span>
              <span class="badge badge--outline">{{ $t('import.updatesBy') }}: {{ imp.unique_keys.join(' + ') }}</span>
            </div>
          </button>
        </div>

        <div v-if="active.fields && active.fields.length" class="columns-table">
          <table class="table">
            <thead>
              <tr>
                <th>{{ $t('import.columns') }}</th>
                <th>{{ active.required }}</th>
                <th>{{ $t('import.aliases') }}</th>
                <th>{{ $t('import.allowedValues') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="field in active.fields" :key="field.name">
                <td>
                  <code>{{ field.name }}</code>
                  <span v-if="field.required" class="badge badge--required">{{ $t('import.required') }}</span>
                  <span v-else class="badge badge--soft">{{ $t('import.optional') }}</span>
                </td>
                <td>{{ field.type }}</td>
                <td class="muted">{{ field.aliases.join(', ') }}</td>
                <td>
                  <span v-if="field.allowed.length">{{ field.allowed.join(' | ') }}</span>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Step 2: file upload -->
      <div class="card">
        <div class="card-title">{{ $t('import.chooseFile') }}</div>
        <p class="muted">{{ $t('import.fileHint') }}</p>
        <div class="upload-row">
          <label class="file-picker">
            <input type="file" accept=".csv,text/csv" :disabled="busy" @change="onFile" />
            <span class="btn btn-secondary">
              <i class="fas fa-upload"></i> {{ fileName || $t('import.browse') }}
            </span>
          </label>
          <button class="btn btn-primary" :disabled="busy || !file" @click="validate">
            <i v-if="validating" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-flask"></i> {{ $t('import.validate') }}
          </button>
          <button class="btn btn-success" :disabled="busy || !report" @click="run">
            <i v-if="running" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fas fa-check-double"></i> {{ $t('import.run') }}
          </button>
          <button v-if="report" class="btn btn-ghost" :disabled="busy" @click="reset">
            <i class="fas fa-rotate-left"></i> {{ $t('import.reset') }}
          </button>
        </div>
        <p v-if="running" class="muted">{{ $t('import.commitHint') }}</p>
      </div>

      <!-- Step 3: report -->
      <div v-if="report" class="card">
        <div class="card-title">
          {{ $t('import.reportTitle') }}
          <span v-if="report.dry_run" class="badge badge--info">{{ $t('import.dryRunNotice') }}</span>
        </div>

        <div v-if="abortMessages" class="alert alert-error">
          {{ $t('import.aborted') }}
          <p class="muted">{{ abortMessages }}</p>
        </div>
        <div v-else-if="report.has_errors" class="alert alert-warning">
          {{ $t('import.rowsValid') }}: {{ report.rows_valid }} / {{ report.rows_read }}
        </div>
        <div v-else class="alert alert-success">{{ $t('import.allGood') }}</div>

        <div class="report-stats">
          <div class="stat">
            <div class="stat-value">{{ report.rows_read }}</div>
            <div class="stat-label">{{ $t('import.rowsRead') }}</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ report.rows_valid }}</div>
            <div class="stat-label">{{ $t('import.rowsValid') }}</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ report.rows_inserted }}</div>
            <div class="stat-label">{{ $t('import.rowsInserted') }}</div>
          </div>
          <div class="stat">
            <div class="stat-value">{{ Object.keys(report.row_errors || {}).length }}</div>
            <div class="stat-label">{{ $t('import.rowErrors') }}</div>
          </div>
        </div>

        <div v-if="report.unmatched_headers && report.unmatched_headers.length" class="unmatched">
          <span class="badge badge--warning">{{ $t('import.unmatchedHeaders') }}:</span>
          <code v-for="h in report.unmatched_headers" :key="h" class="chip">{{ h }}</code>
        </div>

        <div v-if="report.row_errors && Object.keys(report.row_errors).length">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ $t('import.problems') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(messages, index) in report.row_errors" :key="index">
                <td class="row-index">{{ num(index) }}</td>
                <td>
                  <ul class="problem-list">
                    <li v-for="(msg, i) in messages" :key="i">{{ msg }}</li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!report.dry_run" class="commit-ok">
          <i class="fas fa-circle-check"></i> {{ $t('import.success') }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { importApi } from '@/api'

const { t } = useI18n()
const authStore = useAuthStore()

const canImport = computed(() => authStore.can(90))

const importers = ref([])
const loadingImporters = ref(false)
const active = ref({})
const file = ref(null)
const fileName = ref('')
const report = ref(null)
const busy = ref(false)
const validating = ref(false)
const running = ref(false)
const error = ref('')

/** A run that aborted reports its failure under row index -1. */
const abortMessages = computed(() => {
  const wrong = report.value?.row_errors?.['-1']
  return wrong && wrong.length ? wrong.join(' ') : null
})

/** Show the -1 abort row (a numeric index) as a plain label. */
function num(index) {
  return index === '-1' ? '—' : String(Number(index) + 1)
}

function selectImporter(imp) {
  active.value = imp
  report.value = null
  
}

function onFile(event) {
  file.value = event.target.files?.[0] || null
  fileName.value = file.value ? file.value.name : ''
  report.value = null
  
}

function reset() {
  file.value = null
  fileName.value = ''
  report.value = null
  
  error.value = ''
}

async function validate() {
  if (!active.value.key) {
    error.value = t('import.importerFirst')
    return
  }
  if (!file.value) {
    error.value = t('import.fileRequired')
    return
  }
  busy.value = true
  validating.value = true
  error.value = ''
  
  report.value = null
  try {
    const res = await importApi.validate(active.value.key, file.value)
    report.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || err.response?.data?.errors?.file?.[0] || t('import.failed')
  } finally {
    busy.value = false
    validating.value = false
  }
}

async function run() {
  if (!report.value || abortMessages.value) return
  busy.value = true
  running.value = true
  error.value = ''
  try {
    const res = await importApi.run(active.value.key, file.value)
    report.value = { ...res.data, dry_run: false }
  } catch (err) {
    error.value = err.response?.data?.message || t('import.failed')
  } finally {
    busy.value = false
    running.value = false
  }
}

onMounted(async () => {
  loadingImporters.value = true
  try {
    const res = await importApi.importers()
    importers.value = res.data.importers || []
  } catch {
    error.value = t('import.loadError')
  } finally {
    loadingImporters.value = false
  }
})
</script>

<style scoped>
.dashboard-page { padding: 32px 20px; }
.page-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
.page-head h1 { font-size: 28px; font-weight: 800; }
.muted { color: #757575; font-size: 12px; margin-top: 2px; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
.card-title { font-size: 15px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.importer-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.importer-card {
  text-align: left;
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fafbfc;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.importer-card:hover:not(:disabled) { border-color: #005EB8; }
.importer-card:disabled { cursor: not-allowed; opacity: 0.6; }
.importer-card--active { border-color: #005EB8; box-shadow: 0 0 0 3px rgba(0, 94, 184, 0.12); background: #eef4ff; }
.importer-name { font-weight: 700; color: #1e293b; margin-bottom: 6px; font-size: 15px; }
.importer-meta { display: flex; flex-wrap: wrap; gap: 6px; }
.badge { display: inline-flex; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.badge--soft { background: #eef2f7; color: #475569; }
.badge--outline { background: #fff; color: #64748b; border: 1px solid #dbe2ea; }
.badge--required { background: #fdeaea; color: #b91c1c; margin-left: 6px; }
.badge--info { background: #eef4ff; color: #005EB8; }
.badge--warning { background: #fff4e5; color: #b45309; }
.columns-table { margin-top: 16px; overflow-x: auto; }
.columns-table code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-size: 12px; }
.upload-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
.file-picker { display: inline-flex; }
.file-picker input[type='file'] { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
.report-stats { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
.stat { flex: 1; min-width: 110px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; text-align: center; }
.stat-value { font-size: 22px; font-weight: 800; color: #005EB8; }
.stat-label { font-size: 11px; color: #64748b; margin-top: 2px; }
.unmatched { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 8px 0 16px; }
.chip { background: #fff4e5; color: #b45309; padding: 2px 8px; border-radius: 999px; font-size: 11px; }
.row-index { font-weight: 700; color: #64748b; }
.problem-list { margin: 0; padding-left: 18px; color: #b91c1c; font-size: 13px; }
.commit-ok { display: flex; align-items: center; gap: 8px; color: #177a3b; font-weight: 700; margin-top: 16px; }
@media (max-width: 768px) {
  .dashboard-page { padding: 20px 16px; }
  .page-head { flex-direction: column; align-items: flex-start; }
  .upload-row { flex-direction: column; align-items: stretch; }
}
</style>