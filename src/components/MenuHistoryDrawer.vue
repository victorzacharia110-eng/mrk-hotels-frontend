<!--
  MenuHistoryDrawer: "who changed this, and what did they change?"

  Sliding panel over the right of the screen showing one menu record's edit
  history, newest first. Opened from a row's history button, so it has to answer
  the question someone actually asks mid-service: who set this price, and when?

  Shows, per entry:
    - who did it (or "a former staff member" when the account is gone)
    - when, to the minute
    - what they changed, as a before -> after list, and only the fields that
      moved. A create lists what it made; a delete lists what it removed.

  `user` is null once a staff account is deleted, so the name has to degrade
  gracefully rather than render a blank.

  Props:
    modelValue - open/close (v-model)
    entityType - menu_item | menu_category | menu_sub_category | menu_accompaniment
    entityId   - the record's uuid
    title      - heading, usually the record's name

  Emits:
    update:modelValue
-->
<template>
  <div v-if="modelValue" class="mhd-overlay" @click.self="close">
    <aside class="mhd-panel" role="dialog" aria-modal="true" :aria-label="title">
      <header class="mhd-head">
        <div>
          <h2><i class="fas fa-clock-rotate-left"></i> {{ $t('menuAudit.history') }}</h2>
          <p class="muted mhd-subject">{{ title }}</p>
        </div>
        <button type="button" class="mhd-close" :aria-label="$t('common.close')" @click="close">
          <i class="fas fa-xmark"></i>
        </button>
      </header>

      <!-- The one-line answer, before the full list: who touched this last. -->
      <p v-if="lastEdit" class="mhd-last">
        {{ $t('menuAudit.lastEditedBy', { name: actorName(lastEdit) }) }}
        <span class="muted">· {{ formatOrderDateTime(lastEdit.created_at) }}</span>
      </p>

      <div class="mhd-body">
        <p v-if="loading" class="muted">{{ $t('common.loading') }}</p>
        <p v-else-if="error" class="alert alert-danger mhd-error">{{ error }}</p>
        <p v-else-if="!entries.length" class="muted">{{ $t('menuAudit.noHistory') }}</p>

        <ol v-else class="mhd-list">
          <li v-for="entry in entries" :key="entry.log_id" class="mhd-entry">
            <div class="mhd-entry-head">
              <span class="badge" :class="actionBadge(entry.action)">{{ $t(`menuAudit.${entry.action}`) }}</span>
              <span class="mhd-actor">{{ actorName(entry) }}</span>
              <span class="muted mhd-when">{{ formatOrderDateTime(entry.created_at) }}</span>
            </div>

            <dl v-if="changes(entry).length" class="mhd-diff">
              <div v-for="change in changes(entry)" :key="change.field" class="mhd-change">
                <dt>{{ change.label }}</dt>
                <dd>
                  <span class="mhd-from">{{ change.before ?? $t('menuAudit.empty') }}</span>
                  <i class="fas fa-arrow-right mhd-arrow"></i>
                  <span class="mhd-to">{{ change.after ?? $t('menuAudit.empty') }}</span>
                </dd>
              </div>
            </dl>
            <p v-else class="muted mhd-nochange">{{ $t('menuAudit.noFieldDetail') }}</p>
          </li>
        </ol>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { menuAuditApi } from '@/api'
import { formatOrderDateTime } from '@/utils/dates'
import { diffFields } from '@/utils/auditDiff'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  entityType: { type: String, required: true },
  entityId: { type: String, default: '' },
  title: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const entries = ref([])
const loading = ref(false)
const error = ref('')

const lastEdit = computed(() => entries.value[0] || null)

function actorName(entry) {
  return entry.user?.full_name || t('menuAudit.formerStaff')
}

function actionBadge(action) {
  return { create: 'badge-green', update: 'badge-yellow', delete: 'badge-red' }[action] || 'badge-blue'
}

function changes(entry) {
  return diffFields(entry, t)
}

async function load() {
  if (!props.entityId) {
    entries.value = []
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await menuAuditApi.entity(props.entityType, props.entityId)
    entries.value = res.data.data || []
  } catch (err) {
    error.value = err.response?.data?.message || t('menuAudit.loadError')
    entries.value = []
  } finally {
    loading.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}

// Reload on open so the answer is never stale: the price on screen may have
// moved since the panel was last opened. `immediate` covers the case where the
// drawer is mounted already open, which otherwise would render empty forever.
watch(
  () => [props.modelValue, props.entityId],
  ([open]) => {
    if (open) load()
  },
  { immediate: true },
)
</script>

<style scoped>
.mhd-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.mhd-panel {
  background: #fff;
  width: 100%;
  max-width: 480px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: -12px 0 40px rgba(0, 0, 0, 0.18);
}

.mhd-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px 12px;
  border-bottom: 1px solid #e0e0e0;
}

.mhd-head h2 {
  font-size: 17px;
  font-weight: 800;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mhd-subject {
  margin: 4px 0 0;
  font-size: 13px;
}

.mhd-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #757575;
  cursor: pointer;
  padding: 4px;
}

.mhd-last {
  margin: 0;
  padding: 10px 20px;
  background: #f5f7f9;
  border-bottom: 1px solid #e0e0e0;
  font-size: 13px;
}

.mhd-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 24px;
}

.mhd-error {
  margin: 0;
}

.mhd-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mhd-entry {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px 14px;
}

.mhd-entry-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
}

.mhd-actor {
  font-weight: 600;
}

.mhd-when {
  margin-left: auto;
  font-size: 12px;
}

.mhd-diff {
  margin: 10px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mhd-change {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mhd-change dt {
  font-size: 12px;
  color: #757575;
  font-weight: 600;
}

.mhd-change dd {
  margin: 0;
  font-size: 13px;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  word-break: break-word;
}

.mhd-from {
  color: #b3261e;
  text-decoration: line-through;
}

.mhd-to {
  color: #1b5e20;
  font-weight: 600;
}

.mhd-arrow {
  font-size: 10px;
  color: #9e9e9e;
}

.mhd-nochange {
  margin: 8px 0 0;
  font-size: 12px;
}
</style>