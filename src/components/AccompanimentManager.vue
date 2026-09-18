<!--
  AccompanimentManager.vue
  Registers a department's "served with" side dishes (wali, ugali, chips…):
  add, rename, hide/show, reorder and delete. Used from Menu Items (admins,
  managers, kitchen — both departments) and from the POS "served with" prompt
  (cashier = restaurant, bartender = bar, pinned to their own department).

  The department is fixed when `lockDepartment` is set; otherwise the caller's
  staff can switch between restaurant and bar. Every mutation refreshes the
  shared prompt cache and emits `changed` so the opening screen reloads.
-->

<template>
  <Teleport to="body">
    <div class="am-overlay" @click.self="emit('close')">
      <div class="am-panel" role="dialog" :aria-label="$t('menu.manageAccompaniments')">
        <header class="am-head">
          <strong><i class="fas fa-utensils"></i> {{ $t('menu.manageAccompaniments') }}</strong>
          <button type="button" class="am-close" :aria-label="$t('common.close')" @click="emit('close')">
            <i class="fas fa-times"></i>
          </button>
        </header>

        <p class="am-hint">{{ $t('menu.accompanimentsHint') }}</p>

        <div v-if="!lockDepartment" class="am-dept" role="group">
          <button
            v-for="d in departments"
            :key="d.value"
            type="button"
            :class="{ active: dept === d.value }"
            @click="switchDepartment(d.value)"
          >
            {{ d.label }}
          </button>
        </div>

        <div v-if="error" class="am-alert am-alert-error">{{ error }}</div>
        <div v-if="notice" class="am-alert am-alert-success">{{ notice }}</div>

        <form class="am-add" @submit.prevent="add">
          <input
            v-model="form.name"
            type="text"
            maxlength="100"
            :placeholder="$t('menu.accompanimentPlaceholder')"
            required
          />
          <button type="submit" class="am-btn primary" :disabled="saving">
            {{ saving ? $t('common.saving') : $t('menu.addAccompaniment') }}
          </button>
        </form>

        <ul v-if="rows.length" class="am-list">
          <li v-for="(a, i) in rows" :key="a.accompaniment_id" class="am-row" :class="{ inactive: !a.is_active }">
            <div class="am-move">
              <button type="button" :disabled="i === 0" :title="$t('menu.moveUp')" @click="move(i, -1)">
                <i class="fas fa-chevron-up"></i>
              </button>
              <button type="button" :disabled="i === rows.length - 1" :title="$t('menu.moveDown')" @click="move(i, 1)">
                <i class="fas fa-chevron-down"></i>
              </button>
            </div>

            <form v-if="editingId === a.accompaniment_id" class="am-rename" @submit.prevent="saveRename(a)">
              <input v-model="editName" type="text" maxlength="100" autofocus />
            </form>
            <div v-else class="am-name">{{ a.name }}</div>

            <div class="am-actions">
              <button
                v-if="editingId !== a.accompaniment_id"
                type="button"
                :title="$t('menu.renameAccompaniment')"
                @click="startRename(a)"
              >
                <i class="fas fa-pen"></i>
              </button>
              <button v-else type="button" :title="$t('common.save')" @click="saveRename(a)">
                <i class="fas fa-check"></i>
              </button>
              <button
                type="button"
                :title="a.is_active ? $t('menu.hideAccompaniment') : $t('menu.showAccompaniment')"
                @click="toggle(a)"
              >
                <i class="fas" :class="a.is_active ? 'fa-eye' : 'fa-eye-slash'"></i>
              </button>
              <button type="button" class="danger" :title="$t('menu.deleteAccompaniment')" @click="remove(a)">
                <i class="fas fa-trash-can"></i>
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="am-empty">{{ $t('menu.accompanimentsEmpty') }}</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { menuAccompanimentApi } from '@/api'
import { loadAccompanimentOptions, normalizeDepartment } from '@/utils/menuAccompaniment'

const props = defineProps({
  department: { type: String, default: 'restaurant' },
  lockDepartment: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'changed'])

const { t } = useI18n()

const departments = [
  { value: 'restaurant', label: t('common.departments.restaurant') },
  { value: 'bar', label: t('common.departments.bar') },
]

const dept = ref(normalizeDepartment(props.department))
const rows = ref([])
const form = ref({ name: '' })
const saving = ref(false)
const error = ref('')
const notice = ref('')
const editingId = ref(null)
const editName = ref('')

/** Flattens Laravel-style validation errors into a single readable message. */
function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
}

/** Pulls the active department's ordered registry (best-effort). */
async function load() {
  try {
    const res = await menuAccompanimentApi.index({ department: dept.value })
    rows.value = res.data.data || res.data || []
    error.value = ''
  } catch {
    rows.value = []
  }
}

/** Refreshes the shared POS cache and tells the opener to reload its options. */
async function notifyChanged() {
  await loadAccompanimentOptions(dept.value, { force: true })
  emit('changed', dept.value)
}

/** Switches the managed department (only when not locked to one side). */
function switchDepartment(value) {
  if (props.lockDepartment || dept.value === value) return
  dept.value = value
  editingId.value = null
  form.value.name = ''
  error.value = ''
  notice.value = ''
  load()
}

/** Registers a new accompaniment for the active department. */
async function add() {
  const name = form.value.name.trim()
  if (!name) return
  saving.value = true
  error.value = ''
  try {
    await menuAccompanimentApi.store({ department: dept.value, name })
    form.value.name = ''
    notice.value = t('menu.accompanimentCreated')
    await load()
    notifyChanged()
  } catch (err) {
    error.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

/** Opens the inline rename input for an accompaniment. */
function startRename(a) {
  editingId.value = a.accompaniment_id
  editName.value = a.name
}

/** Persists an inline rename (existing order lines keep the old name). */
async function saveRename(a) {
  const name = editName.value.trim()
  if (!name || name === a.name) {
    editingId.value = null
    return
  }
  error.value = ''
  try {
    await menuAccompanimentApi.update(a.accompaniment_id, { name })
    editingId.value = null
    notice.value = t('menu.accompanimentRenamed')
    await load()
    notifyChanged()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Shows/hides an accompaniment (hidden sides stop appearing on the POS). */
async function toggle(a) {
  error.value = ''
  try {
    await menuAccompanimentApi.update(a.accompaniment_id, { is_active: !a.is_active })
    await load()
    notifyChanged()
  } catch (err) {
    error.value = flattenError(err)
  }
}

/** Swaps two accompaniments and persists the new order. */
async function move(index, direction) {
  const target = index + direction
  if (target < 0 || target >= rows.value.length) return
  const moved = [...rows.value]
  ;[moved[index], moved[target]] = [moved[target], moved[index]]
  rows.value = moved
  try {
    await menuAccompanimentApi.reorder(dept.value, rows.value.map((a) => a.accompaniment_id))
    notifyChanged()
  } catch (err) {
    error.value = flattenError(err)
    await load()
  }
}

/** Deletes an accompaniment (blocked by the server once it has been ordered). */
async function remove(a) {
  if (!window.confirm(t('menu.deleteAccompanimentMessage', { name: a.name }))) return
  error.value = ''
  try {
    await menuAccompanimentApi.destroy(a.accompaniment_id)
    notice.value = t('menu.accompanimentDeleted')
    await load()
    notifyChanged()
  } catch (err) {
    error.value = flattenError(err)
  }
}

onMounted(load)
</script>

<style scoped>
.am-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}
.am-panel {
  width: min(560px, 100%);
  max-height: 88vh;
  overflow-y: auto;
  background: #fff;
  color: #1f2937;
  border-radius: 14px;
  padding: 20px 22px 24px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.3);
}
.am-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 1.05rem;
}
.am-close {
  border: 0;
  background: transparent;
  color: #64748b;
  font-size: 1.1rem;
  cursor: pointer;
}
.am-hint {
  margin: 8px 0 14px;
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.45;
}
.am-dept {
  display: inline-flex;
  gap: 6px;
  margin-bottom: 14px;
  background: #f1f5f9;
  border-radius: 10px;
  padding: 4px;
}
.am-dept button {
  border: 0;
  background: transparent;
  padding: 7px 16px;
  border-radius: 8px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
}
.am-dept button.active {
  background: #2563eb;
  color: #fff;
}
.am-alert {
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 0.85rem;
}
.am-alert-error {
  background: #fef2f2;
  color: #b91c1c;
}
.am-alert-success {
  background: #ecfdf5;
  color: #047857;
}
.am-add {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.am-add input,
.am-rename input {
  flex: 1;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 0.9rem;
}
.am-btn {
  border: 0;
  border-radius: 8px;
  padding: 9px 18px;
  font-weight: 600;
  cursor: pointer;
}
.am-btn.primary {
  background: #2563eb;
  color: #fff;
}
.am-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.am-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.am-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}
.am-row.inactive {
  opacity: 0.55;
}
.am-move {
  display: flex;
  flex-direction: column;
}
.am-move button,
.am-actions button {
  border: 0;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 6px;
}
.am-move button:disabled {
  opacity: 0.3;
  cursor: default;
}
.am-name {
  flex: 1;
  font-weight: 600;
}
.am-rename {
  flex: 1;
  display: flex;
}
.am-actions {
  display: flex;
  gap: 2px;
}
.am-actions button:hover {
  background: #f1f5f9;
}
.am-actions button.danger {
  color: #dc2626;
}
.am-empty {
  color: #64748b;
  font-size: 0.85rem;
}
</style>