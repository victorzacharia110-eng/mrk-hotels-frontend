<!--
  MenuActivityPage: the menu-wide answer to "who changed what?"

  Every create, update and delete the menu controllers have made, newest first,
  filterable by record type, action, who did it and date range. A row expands to
  show the before -> after of that single change.

  Behind the same gate as the menu itself (level 30 + menu.manage), so anyone who
  can change the menu can see who changed it, and a waiter sees nothing.

  Diffing is shared with MenuHistoryDrawer via diffFields() rather than
  duplicated: a price change must read identically in both places.
-->
<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{{ $t('menuAudit.title') }}</h1>
        <p class="muted">{{ $t('menuAudit.subtitle') }}</p>
      </div>
      <router-link to="/app/menu" class="btn btn-secondary">
        <i class="fas fa-arrow-left"></i> {{ $t('menu.title') }}
      </router-link>
    </div>

    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('reports.auditEntity') }}</label>
          <select v-model="filters.entity_type" class="input" @change="reload()">
            <option value="">{{ $t('menuAudit.allRecordTypes') }}</option>
            <option v-for="type in ENTITY_TYPES" :key="type" :value="type">
              {{ $t(`menuAudit.entities.${type}`) }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('reports.auditAction') }}</label>
          <select v-model="filters.action" class="input" @change="reload()">
            <option value="">{{ $t('reports.auditAllActions') }}</option>
            <option v-for="action in ACTIONS" :key="action" :value="action" class="capitalize">
              {{ $t(`menuAudit.${action}`) }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>{{ $t('common.from') }}</label>
          <CalendarInput v-model="filters.from" @change="reload" />
        </div>
        <div class="form-group">
          <label>{{ $t('common.to') }}</label>
          <CalendarInput v-model="filters.to" @change="reload" />
        </div>
        <div class="filter-actions">
          <button class="btn btn-secondary btn-sm" @click="reload()">
            <i class="fas fa-magnifying-glass"></i> {{ $t('common.search') }}
          </button>
          <button class="btn btn-secondary btn-sm" @click="clearFilters">
            <i class="fas fa-filter-circle-xmark"></i> {{ $t('common.clear') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <div class="card">
      <div v-if="loading" class="alert alert-info">{{ $t('common.loading') }}</div>

      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{{ $t('reports.auditTime') }}</th>
              <th scope="col">{{ $t('reports.auditUser') }}</th>
              <th scope="col">{{ $t('reports.auditAction') }}</th>
              <th scope="col">{{ $t('reports.auditEntity') }}</th>
              <th scope="col">{{ $t('menuAudit.changed') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="log in logs" :key="log.log_id">
              <!-- Clickable row, so it needs a keyboard route too: without
                   tabindex/role a keyboard or screen-reader user cannot open the
                   diff at all. -->
              <tr
                class="ma-row"
                tabindex="0"
                role="button"
                :aria-expanded="openId === log.log_id"
                @click="toggle(log.log_id)"
                @keydown.enter.prevent="toggle(log.log_id)"
                @keydown.space.prevent="toggle(log.log_id)"
              >
              <td class="muted nowrap">{{ formatDateTime(log.created_at) }}</td>
              <td>{{ log.user?.full_name || $t('menuAudit.formerStaff') }}</td>
              <td>
                <span class="badge" :class="actionBadge(log.action)">{{ $t(`menuAudit.${log.action}`) }}</span>
              </td>
              <td>
                <span class="capitalize">{{ entityLabel(log.entity_type) }}</span>
                <span v-if="log.entity_id" class="muted mono">· {{ log.entity_id.slice(0, 8) }}</span>
              </td>
              <td>
                <div v-if="fieldsFor(log).length" class="ma-changed">
                  <span v-for="field in fieldsFor(log).slice(0, 3)" :key="field.field" class="ma-pill">
                    {{ field.label }}
                  </span>
                  <span v-if="fieldsFor(log).length > 3" class="muted">
                    +{{ fieldsFor(log).length - 3 }}
                  </span>
                </div>
                <span v-else class="muted">—</span>
              </td>
            </tr>
              <tr v-if="openId === log.log_id" class="ma-diff-row">
                <td colspan="5">
                  <dl class="ma-diff">
                    <div v-for="field in fieldsFor(log)" :key="field.field" class="ma-change">
                      <dt>{{ field.label }}</dt>
                      <dd>
                        <span class="ma-from">{{ field.before ?? $t('menuAudit.empty') }}</span>
                        <i class="fas fa-arrow-right ma-arrow"></i>
                        <span class="ma-to">{{ field.after ?? $t('menuAudit.empty') }}</span>
                      </dd>
                    </div>
                  </dl>
                </td>
              </tr>
            </template>
            <tr v-if="!logs.length">
              <td colspan="5" class="muted">{{ $t('menuAudit.noActivity') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!loading && meta.total > meta.per_page" class="pagination">
        <button class="btn btn-sm btn-secondary" :disabled="!meta.prev_page_url" @click="load(meta.current_page - 1)">
          {{ $t('common.previous') }}
        </button>
        <span class="muted">
          {{ $t('common.pageXOfY', { current: meta.current_page, total: meta.last_page }) }}
        </span>
        <button class="btn btn-sm btn-secondary" :disabled="!meta.next_page_url" @click="load(meta.current_page + 1)">
          {{ $t('common.next') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { menuAuditApi } from '@/api'
import CalendarInput from '@/components/CalendarInput.vue'
import { formatDateTime } from '@/utils/dates'
import { diffFields } from '@/utils/auditDiff'

const { t } = useI18n()

const ENTITY_TYPES = ['menu_item', 'menu_category', 'menu_sub_category', 'menu_accompaniment']
const ACTIONS = ['create', 'update', 'delete']

const logs = ref([])
const loading = ref(false)
const error = ref('')
const meta = ref({ total: 0, per_page: 25, current_page: 1, last_page: 1 })
const openId = ref(null)
const filters = reactive({ entity_type: '', action: '', from: '', to: '' })

function fieldsFor(log) {
  return diffFields(log, t)
}

/**
 * Record type label, falling back to the raw value.
 *
 * vue-i18n's second t() argument is a plural count, not a fallback message, so a
 * missing key has to be detected rather than defaulted. The backend only ever
 * returns the four known types; this keeps an unexpected one readable instead of
 * rendering the raw key path.
 */
function entityLabel(entityType) {
  const key = `menuAudit.entities.${entityType}`
  return t(key) === key ? entityType : t(key)
}

function actionBadge(action) {
  return { create: 'badge-green', update: 'badge-yellow', delete: 'badge-red' }[action] || 'badge-blue'
}

function toggle(id) {
  openId.value = openId.value === id ? null : id
}

function clearFilters() {
  filters.entity_type = ''
  filters.action = ''
  filters.from = ''
  filters.to = ''
  reload()
}

async function load(page = 1) {
  loading.value = true
  error.value = ''
  openId.value = null
  try {
    const res = await menuAuditApi.index({
      entity_type: filters.entity_type || undefined,
      action: filters.action || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page,
    })
    logs.value = res.data.data || []
    meta.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || t('menuAudit.loadError')
    logs.value = []
  } finally {
    loading.value = false
  }
}

function reload() {
  load(1)
}

onMounted(() => load(1))
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.page-head h1 {
  font-size: 22px;
  font-weight: 800;
  margin: 0;
}

.page-head p {
  margin: 4px 0 0;
  font-size: 13px;
}

.ma-row {
  cursor: pointer;
}

.ma-row:focus-visible {
  outline: 2px solid #1d6fb8;
  outline-offset: -2px;
}

.ma-changed {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.ma-pill {
  background: #eef2f6;
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 11px;
  color: #424242;
}

.ma-diff-row td {
  background: #fafbfc;
}

.ma-diff {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ma-change {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ma-change dt {
  font-size: 12px;
  color: #757575;
  font-weight: 600;
}

.ma-change dd {
  margin: 0;
  font-size: 13px;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  word-break: break-word;
}

.ma-from {
  color: #b3261e;
  text-decoration: line-through;
}

.ma-to {
  color: #1b5e20;
  font-weight: 600;
}

.ma-arrow {
  font-size: 10px;
  color: #9e9e9e;
}

.nowrap {
  white-space: nowrap;
}
</style>