<!--
  Auto Stopsell drawer (slides in from the right).

  Configures the channel stop-sell grid: for the selected channel (source),
  each weekday can be switched to stop-selling, optionally with the time of
  day the stop-sell kicks in. Saving mirrors every actual change into the
  channel log, visible both here under "Audit Trail" and on the Channel Logs
  page. The open state is shared through useDistribution() so the staff-drawer
  accordion and the Channel Logs toolbar open the same drawer.

  Managers (role level >= 80) also get a "Manage Channels" panel to add,
  rename, reorder, hide or delete the hotel's own channel list; each hotel's
  list is independent (per-tenant distribution_sources).
-->
<template>
  <Teleport to="body">
    <Transition name="drawer-slide">
      <div v-if="stopsellOpen" class="ds-backdrop" @click.self="closeStopsell">
        <aside class="ds-drawer" role="dialog" aria-modal="true" :aria-label="$t('distribution.autoStopsell')">
          <header class="ds-head">
            <h3>
              <i :class="manageOpen ? 'fas fa-tower-broadcast' : 'fas fa-hand'" aria-hidden="true"></i>
              {{ manageOpen ? $t('distribution.manageSources') : $t('distribution.autoStopsell') }}
            </h3>
            <button type="button" class="ds-x" :aria-label="$t('common.close')" @click="closeStopsell">×</button>
          </header>

          <div v-if="error" class="alert alert-error">{{ error }}</div>
          <div v-if="notice" class="alert alert-success">{{ notice }}</div>

          <div v-if="loading" class="ds-loading">{{ $t('common.loading') }}</div>

          <!-- Manage channels panel (managers only) -->
          <div v-else-if="manageOpen" class="ds-body">
            <p class="muted">{{ $t('distribution.manageSourcesHint') }}</p>

            <form class="src-add" @submit.prevent="addSource">
              <input
                v-model="newSourceName"
                type="text"
                class="input"
                maxlength="60"
                :placeholder="t('distribution.channelNamePlaceholder')"
                required
              />
              <button type="submit" class="btn btn-primary" :disabled="savingSource">
                {{ savingSource ? $t('common.saving') : $t('distribution.addChannel') }}
              </button>
            </form>

            <ul v-if="managedSources.length" class="src-list">
              <li
                v-for="(s, i) in managedSources"
                :key="s.source_id"
                class="src-row"
                :class="{ 'src-inactive': !s.is_active }"
              >
                <div class="src-move">
                  <button
                    type="button"
                    class="icon-btn"
                    :disabled="i === 0 || savingSource"
                    :title="$t('distribution.moveUp')"
                    @click="moveSource(i, -1)"
                  >
                    <i class="fas fa-chevron-up"></i>
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    :disabled="i === managedSources.length - 1 || savingSource"
                    :title="$t('distribution.moveDown')"
                    @click="moveSource(i, 1)"
                  >
                    <i class="fas fa-chevron-down"></i>
                  </button>
                </div>

                <form v-if="editingSourceId === s.source_id" class="src-edit-name" @submit.prevent="saveSourceRename(s)">
                  <input v-model="sourceEditName" type="text" class="input" maxlength="60" autofocus />
                </form>
                <div v-else class="src-name">
                  <strong>{{ s.name }}</strong>
                  <span class="muted">· {{ s.key }}</span>
                </div>

                <div class="src-actions">
                  <button
                    v-if="editingSourceId !== s.source_id"
                    type="button"
                    class="icon-btn"
                    :title="$t('distribution.renameChannel')"
                    @click="startSourceRename(s)"
                  >
                    <i class="fas fa-pen"></i>
                  </button>
                  <button
                    v-else
                    type="button"
                    class="icon-btn"
                    :title="$t('common.save')"
                    @click="saveSourceRename(s)"
                  >
                    <i class="fas fa-check"></i>
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    :title="s.is_active ? $t('distribution.hideChannel') : $t('distribution.showChannel')"
                    @click="toggleSource(s)"
                  >
                    <i class="fas" :class="s.is_active ? 'fa-eye' : 'fa-eye-slash'"></i>
                  </button>
                  <button
                    type="button"
                    class="icon-btn danger"
                    :title="$t('distribution.deleteChannel')"
                    @click="removeSource(s)"
                  >
                    <i class="fas fa-trash-can"></i>
                  </button>
                </div>
              </li>
            </ul>
            <p v-else class="muted">{{ $t('distribution.noChannels') }}</p>
          </div>

          <!-- Stop-sell grid -->
          <div v-else class="ds-body">
            <div class="form-group">
              <label>{{ $t('distribution.source') }}</label>
              <select v-model="source" class="input" :disabled="saving">
                <option v-for="s in sources" :key="s.key" :value="s.key">{{ s.name }}</option>
              </select>
            </div>

            <table class="table ds-grid">
              <thead>
                <tr>
                  <th>{{ $t('distribution.days') }}</th>
                  <th>{{ $t('distribution.updateStopsellTime') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.day_of_week">
                  <td>{{ dayLabel(row.day_of_week) }}</td>
                  <td class="ds-time">
                    <input v-model="row.enabled" type="checkbox" class="ds-check" :aria-label="dayLabel(row.day_of_week) + ' — ' + $t('distribution.updateStopsellTime')" />
                    <input v-model="row.stop_sell_time" type="time" class="input ds-time-input" :disabled="!row.enabled" />
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-if="auditOpen" class="ds-audit">
              <h4>{{ $t('distribution.auditTrail') }}</h4>
              <div v-if="auditLoading" class="muted">{{ $t('common.loading') }}</div>
              <div v-else-if="!audit.length" class="muted">{{ $t('distribution.noLogsYet') }}</div>
              <ul v-else class="ds-audit-list">
                <li v-for="log in audit" :key="log.log_id">
                  <span class="ds-audit-what">{{ log.updated_value }}</span>
                  <span class="ds-audit-meta">{{ sourceName(log.source) }} · {{ fmtEAT(log.requested_at) }} · {{ log.user_name || '—' }}</span>
                </li>
              </ul>
            </div>
          </div>

          <footer class="ds-foot">
            <div class="ds-foot-left">
              <button
                v-if="manageOpen"
                type="button"
                class="btn btn-secondary"
                :disabled="loading || savingSource"
                @click="manageOpen = false"
              >
                <i class="fas fa-hand" aria-hidden="true"></i> {{ $t('distribution.autoStopsell') }}
              </button>
              <button
                v-else-if="canManage"
                type="button"
                class="btn btn-secondary"
                :disabled="loading || saving"
                @click="openManage"
              >
                <i class="fas fa-tower-broadcast" aria-hidden="true"></i> {{ $t('distribution.manageSources') }}
              </button>
              <button type="button" class="btn btn-secondary" :disabled="loading || saving || manageOpen" @click="auditOpen = !auditOpen">
                <i class="fas fa-clock-rotate-left" aria-hidden="true"></i> {{ $t('distribution.auditTrail') }}
              </button>
            </div>
            <button v-if="!manageOpen" type="button" class="btn btn-primary" :disabled="loading || saving" @click="save">
              <i class="fas fa-floppy-disk" aria-hidden="true"></i> {{ $t('distribution.updateStopsell') }}
            </button>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { distributionApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useDistribution } from '@/composables/useDistribution'

const { t } = useI18n()
const auth = useAuthStore()

const { stopsellOpen, closeStopsell } = useDistribution()

// Managers (>= level 80) own the hotel's channel list.
const canManage = computed(() => auth.can(80))

const sources = ref([])
const dayKeys = ref([])
const source = ref('')
const rows = ref([])
const schedules = ref({})
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const audit = ref([])
const auditLoading = ref(false)
const auditOpen = ref(false)
const manageOpen = ref(false)
const managedSources = ref([])
const newSourceName = ref('')
const savingSource = ref(false)
const editingSourceId = ref(null)
const sourceEditName = ref('')

// Live key -> display name lookup from the grid payload.
const sourceNames = computed(() => {
  const map = {}
  for (const s of sources.value) map[s.key] = s.name
  for (const s of managedSources.value) map[s.key] = s.name
  return map
})

const fmtEAT = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Africa/Dar_es_Salaam',
  })
}

/** Friendly name for a channel key (globals, then this hotel's list, then the key). */
function sourceName(key) {
  if (sourceNames.value[key]) return sourceNames.value[key]
  const localized = t(`distribution.sources.${key}`)
  return localized === `distribution.sources.${key}` ? key : localized
}

const dayLabel = (d) => t(`distribution.dayNames.${dayKeys.value.find((k) => k.value === d)?.key || 'monday'}`)

function hydrateRows() {
  const grid = schedules.value[source.value] || {}
  rows.value = (dayKeys.value || []).map((d) => ({
    day_of_week: d.value,
    enabled: !!grid[d.value]?.enabled,
    stop_sell_time: grid[d.value]?.stop_sell_time ? grid[d.value].stop_sell_time.slice(0, 5) : null,
  }))
}

const fallbackSources = [
  { key: 'booking_com', name: 'Booking.com' },
  { key: 'expedia', name: 'Expedia' },
  { key: 'agoda', name: 'Agoda' },
  { key: 'staah', name: 'STAAH' },
]

async function loadSchedules() {
  loading.value = true
  error.value = ''
  try {
    const res = await distributionApi.getStopSellSchedules()
    sources.value = res.data.sources?.length ? res.data.sources : fallbackSources
    dayKeys.value = res.data.days || [
      { value: 1, key: 'monday' }, { value: 2, key: 'tuesday' }, { value: 3, key: 'wednesday' },
      { value: 4, key: 'thursday' }, { value: 5, key: 'friday' }, { value: 6, key: 'saturday' },
      { value: 7, key: 'sunday' },
    ]
    schedules.value = res.data.schedules || {}
    if (!sources.value.some((s) => s.key === source.value)) source.value = sources.value[0]?.key || ''
    hydrateRows()
  } catch (err) {
    error.value = err.response?.data?.message || t('distribution.loadError')
  } finally {
    loading.value = false
  }
}

async function loadAudit() {
  auditLoading.value = true
  try {
    const res = await distributionApi.getLogs({ per_page: 8, source: source.value || undefined })
    audit.value = res.data.logs || []
  } catch {
    audit.value = []
  } finally {
    auditLoading.value = false
  }
}

watch(source, hydrateRows)
watch(stopsellOpen, (open) => {
  if (open) {
    notice.value = ''
    manageOpen.value = false
    loadSchedules()
    loadAudit()
  }
})

async function save() {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await distributionApi.updateStopSellSchedules(
      rows.value.map((r) => ({
        source: source.value,
        day_of_week: r.day_of_week,
        enabled: r.enabled,
        stop_sell_time: r.enabled && r.stop_sell_time ? r.stop_sell_time : null,
      })),
    )
    notice.value = t('distribution.saved')
    await loadSchedules()
    await loadAudit()
  } catch (err) {
    error.value = err.response?.data?.message || t('distribution.saveError')
  } finally {
    saving.value = false
  }
}

// ---- Managed channels (per-hotel distribution_sources) -----------------------

function openManage() {
  error.value = ''
  notice.value = ''
  auditOpen.value = false
  manageOpen.value = true
  loadManagedSources()
}

async function loadManagedSources() {
  savingSource.value = true
  try {
    const res = await distributionApi.getSources()
    managedSources.value = res.data.sources || []
  } catch (err) {
    error.value = err.response?.data?.message || t('distribution.loadError')
    managedSources.value = []
  } finally {
    savingSource.value = false
  }
}

async function addSource() {
  const name = newSourceName.value.trim()
  if (!name) return
  savingSource.value = true
  error.value = ''
  notice.value = ''
  try {
    await distributionApi.createSource({ name })
    newSourceName.value = ''
    notice.value = t('distribution.channelAdded')
    await loadManagedSources()
    await loadSchedules()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    savingSource.value = false
  }
}

function startSourceRename(s) {
  editingSourceId.value = s.source_id
  sourceEditName.value = s.name
}

async function saveSourceRename(s) {
  const name = sourceEditName.value.trim()
  if (!name || name === s.name) {
    editingSourceId.value = null
    return
  }
  savingSource.value = true
  error.value = ''
  notice.value = ''
  try {
    await distributionApi.updateSource(s.source_id, { name, is_active: s.is_active })
    editingSourceId.value = null
    notice.value = t('distribution.channelRenamed')
    await loadManagedSources()
    await loadSchedules()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    savingSource.value = false
  }
}

async function toggleSource(s) {
  savingSource.value = true
  error.value = ''
  notice.value = ''
  try {
    await distributionApi.updateSource(s.source_id, { name: s.name, is_active: !s.is_active })
    notice.value = s.is_active ? t('distribution.channelHidden') : t('distribution.channelShown')
    await loadManagedSources()
    await loadSchedules()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    savingSource.value = false
  }
}

async function moveSource(index, direction) {
  const target = index + direction
  if (target < 0 || target >= managedSources.value.length) return
  const moved = [...managedSources.value]
  ;[moved[index], moved[target]] = [moved[target], moved[index]]
  managedSources.value = moved
  try {
    await distributionApi.reorderSources(managedSources.value.map((s) => s.source_id))
  } catch (err) {
    error.value = flattenError(err)
    await loadManagedSources()
  }
}

async function removeSource(s) {
  if (!window.confirm(t('distribution.deleteChannelMessage', { name: s.name }))) return
  savingSource.value = true
  error.value = ''
  notice.value = ''
  try {
    await distributionApi.deleteSource(s.source_id)
    notice.value = t('distribution.channelDeleted')
    await loadManagedSources()
    await loadSchedules()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    savingSource.value = false
  }
}

/** Flattens Laravel-style validation errors into a single readable message. */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('distribution.saveError')
}
</script>

<style scoped>
.ds-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(3, 18, 35, 0.45);
  z-index: 1050;
  display: flex;
  justify-content: flex-end;
}

.ds-drawer {
  width: 560px;
  max-width: 96vw;
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  box-shadow: -12px 0 32px rgba(3, 18, 35, 0.25);
}

.ds-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid #e6edf3;
  background: #f8fafc;
}

.ds-head h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #0f2b46;
  display: flex;
  align-items: center;
  gap: 9px;
}

.ds-x {
  background: none;
  border: none;
  font-size: 26px;
  line-height: 1;
  color: #64748b;
  cursor: pointer;
  padding: 0 4px;
}

.ds-loading {
  padding: 40px;
  text-align: center;
  color: #64748b;
}

.ds-body {
  padding: 20px 22px;
  overflow-y: auto;
  flex: 1;
}

.ds-grid {
  margin-top: 18px;
}

.ds-time {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ds-check {
  width: 18px;
  height: 18px;
  accent-color: #005EB8;
  cursor: pointer;
}

.ds-time-input {
  width: 130px;
}

.ds-audit {
  margin-top: 22px;
  border-top: 1px dashed #e6edf3;
  padding-top: 14px;
}

.ds-audit h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: #0f2b46;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ds-audit-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
}

.ds-audit-list li {
  padding: 9px 0;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ds-audit-list li:last-child { border-bottom: none; }

.ds-audit-what { font-size: 13px; font-weight: 600; color: #0f2b46; }

.ds-audit-meta { font-size: 11px; color: #64748b; }

.ds-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 22px;
  border-top: 1px solid #e6edf3;
  background: #f8fafc;
}

.ds-foot-left {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.muted { color: #757575; font-size: 12px; }

.src-add {
  display: flex;
  gap: 8px;
  margin: 14px 0 18px;
}

.src-add .input { flex: 1; }

.src-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.src-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  background: #fafafa;
}

.src-row.src-inactive { opacity: 0.55; }

.src-move {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.src-name,
.src-edit-name {
  flex: 1;
  margin: 0;
  min-width: 0;
}

.src-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.src-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 6px;
  color: #555;
  cursor: pointer;
  font-size: 13px;
}

.icon-btn:hover:not(:disabled) {
  background: #eef3f8;
  border-color: #d8e3ee;
}

.icon-btn.danger:hover {
  background: #fdecea;
  border-color: #f5c6c0;
  color: #c0392b;
}

.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: opacity 0.22s ease;
}

.drawer-slide-enter-active .ds-drawer,
.drawer-slide-leave-active .ds-drawer {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  opacity: 0;
}

.drawer-slide-enter-from .ds-drawer {
  transform: translateX(100%);
}

.drawer-slide-leave-to .ds-drawer {
  transform: translateX(100%);
}

@media (max-width: 560px) {
  .ds-drawer { max-width: 100vw; }
}
</style>