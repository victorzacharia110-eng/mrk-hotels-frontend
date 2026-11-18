<template>
  <div class="marketing-crud">
    <div class="crud-head">
      <div>
        <h2>{{ title }}</h2>
        <p v-if="description" class="muted">{{ description }}</p>
      </div>
      <div class="crud-head-actions">
        <button v-if="canCreate" type="button" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> New
        </button>
        <button type="button" class="btn btn-secondary" @click="load" :disabled="loading">
          <i class="fas fa-rotate"></i> Refresh
        </button>
      </div>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div v-if="loading" class="card"><p class="muted">Loading...</p></div>
    <div v-else-if="!items.length" class="card"><p class="muted">No records available.</p></div>
    <div v-else class="table-wrap card">
      <table class="table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key">{{ col.label }}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="itemKey(item)">
            <td v-for="col in columns" :key="col.key">{{ displayCell(item, col) }}</td>
            <td>
              <div class="row-actions">
                <button type="button" class="btn btn-sm btn-secondary" @click="openEdit(item)">Edit</button>
                <button v-if="canDelete" type="button" class="btn btn-sm btn-danger" @click="remove(item)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal">
        <div class="modal-head">
          <h3>{{ editing ? 'Edit' : 'Create' }} {{ itemLabel || title }}</h3>
          <button type="button" class="modal-close" @click="closeForm"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="formError" class="alert alert-error">
          <div>{{ formError }}</div>
          <ul v-if="formErrors.length" class="error-list">
            <li v-for="(msg, idx) in formErrors" :key="idx">{{ msg }}</li>
          </ul>
        </div>

        <form @submit.prevent="save">
          <div class="form-grid">
            <div v-for="field in fields" :key="field.key" class="form-group" :class="{ full: isFullWidth(field) }">
              <label :for="fieldId(field)">{{ field.label }}</label>

              <textarea
                v-if="field.type === 'textarea' || field.type === 'json'"
                :id="fieldId(field)"
                v-model="form[field.key]"
                class="input"
                :rows="field.type === 'json' ? 8 : 4"
                :placeholder="field.placeholder || ''"
              ></textarea>

              <select
                v-else-if="field.type === 'select'"
                :id="fieldId(field)"
                v-model="form[field.key]"
                class="input"
              >
                <option v-if="!field.required" :value="field.nullable ? null : ''">—</option>
                <option v-for="opt in optionsFor(field)" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
              </select>

              <div v-else-if="field.type === 'multiselect'" class="multi-select">
                <label v-for="opt in optionsFor(field)" :key="String(opt.value)" class="multi-option">
                  <input type="checkbox" :value="opt.value" v-model="form[field.key]" />
                  <span>{{ opt.label }}</span>
                </label>
                <div v-if="!optionsFor(field).length" class="muted">No options available.</div>
              </div>

              <input
                v-else-if="field.type === 'checkbox'"
                :id="fieldId(field)"
                v-model="form[field.key]"
                type="checkbox"
                class="checkbox-input"
              />

              <input
                v-else-if="field.type === 'file'"
                :id="fieldId(field)"
                type="file"
                class="input"
                :accept="field.accept || ''"
                @change="onFileChange(field, $event)"
              />

              <input
                v-else
                :id="fieldId(field)"
                v-model="form[field.key]"
                :type="inputType(field)"
                class="input"
                :placeholder="field.placeholder || ''"
                :step="field.step || null"
              />

              <small v-if="field.hint" class="muted">{{ field.hint }}</small>
            </div>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeForm">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  api: { type: Object, required: true },
  listKey: { type: String, required: true },
  fields: { type: Array, default: () => [] },
  columns: { type: Array, default: null },
  itemLabel: { type: String, default: '' },
  idKey: { type: String, default: 'id' },
  createDefaults: { type: Object, default: () => ({}) },
  optionSources: { type: Object, default: () => ({}) },
  canCreate: { type: Boolean, default: true },
  canDelete: { type: Boolean, default: true },
  multipart: { type: Boolean, default: false },
  listParams: { type: Object, default: () => ({}) },
  onBeforeSave: { type: Function, default: null },
})

const items = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const showForm = ref(false)
const editing = ref(null)
const saving = ref(false)
const formError = ref('')
const formErrors = ref([])
const form = reactive({})
const fileState = reactive({})

const columns = computed(() => {
  if (Array.isArray(props.columns) && props.columns.length) return props.columns
  return props.fields.slice(0, 5).map((f) => ({ key: f.key, label: f.label, type: f.type }))
})

function itemKey(item) {
  return item?.[props.idKey] ?? item?.slug ?? item?.key ?? JSON.stringify(item)
}

function fieldId(field) {
  return `crud-${props.title}-${field.key}`.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function isFullWidth(field) {
  return field.type === 'textarea' || field.type === 'json' || field.type === 'multiselect' || field.fullWidth
}

function inputType(field) {
  if (field.type === 'number') return 'number'
  if (field.type === 'password') return 'password'
  return 'text'
}

function optionsFor(field) {
  if (Array.isArray(field.options)) return field.options
  if (field.optionsKey && Array.isArray(props.optionSources[field.optionsKey])) return props.optionSources[field.optionsKey]
  return []
}

function displayCell(item, col) {
  const value = item?.[col.key]
  if (col.format === 'bool' || typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? `${value.length} items` : '—'
  if (value && typeof value === 'object') return JSON.stringify(value)
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function resetForm() {
  for (const key of Object.keys(form)) delete form[key]
  for (const key of Object.keys(fileState)) delete fileState[key]
  for (const field of props.fields) {
    if (Object.prototype.hasOwnProperty.call(props.createDefaults, field.key)) {
      form[field.key] = props.createDefaults[field.key]
    } else if (field.type === 'checkbox') {
      form[field.key] = false
    } else if (field.type === 'multiselect') {
      form[field.key] = []
    } else if (field.type === 'json') {
      form[field.key] = field.defaultJson ?? ''
    } else {
      form[field.key] = ''
    }
  }
}

function hydrateForm(item) {
  resetForm()
  for (const field of props.fields) {
    let value = item?.[field.key]
    if (field.type === 'json') {
      if (value && typeof value === 'object') value = JSON.stringify(value, null, 2)
      else if (value === null || value === undefined) value = ''
      else value = String(value)
    } else if (field.type === 'checkbox') {
      value = Boolean(value)
    } else if (field.type === 'multiselect') {
      if (Array.isArray(value)) {
        value = value.map((v) => (v && typeof v === 'object' ? v.id ?? v.value : v)).filter((v) => v !== undefined && v !== null)
      } else {
        value = []
      }
      if (field.key === 'feature_ids' && Array.isArray(item?.features)) {
        value = item.features.map((f) => f.id).filter(Boolean)
      }
    } else if (value === null || value === undefined) {
      value = field.type === 'number' ? '' : ''
    }
    form[field.key] = value
  }
}

function openCreate() {
  editing.value = null
  formError.value = ''
  formErrors.value = []
  resetForm()
  showForm.value = true
}

function openEdit(item) {
  editing.value = item
  formError.value = ''
  formErrors.value = []
  hydrateForm(item)
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value = null
}

function onFileChange(field, event) {
  const file = event.target.files?.[0] || null
  fileState[field.key] = file
}

function parsePayload() {
  const payload = {}
  for (const field of props.fields) {
    if (field.readOnly) continue
    let value = form[field.key]
    if (field.type === 'json') {
      if (value === '' || value === null || value === undefined) {
        value = field.nullable ? null : {}
      } else if (typeof value === 'string') {
        value = JSON.parse(value)
      }
    } else if (field.type === 'number') {
      if (value === '' || value === null || value === undefined) value = field.nullable ? null : undefined
      else value = Number(value)
    } else if (field.type === 'checkbox') {
      value = Boolean(value)
    } else if (field.type === 'multiselect') {
      value = Array.isArray(value) ? value : []
    } else if (field.type === 'file') {
      continue
    } else if (value === '' && field.nullable) {
      value = null
    }
    if (value !== undefined) payload[field.key] = value
  }
  return payload
}

function toFormData(payload) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      value.forEach((v) => fd.append(`${key}[]`, v))
    } else if (typeof value === 'object') {
      fd.append(key, JSON.stringify(value))
    } else if (typeof value === 'boolean') {
      fd.append(key, value ? '1' : '0')
    } else {
      fd.append(key, value)
    }
  }
  for (const field of props.fields) {
    if (field.type === 'file' && fileState[field.key]) {
      fd.append(field.key, fileState[field.key])
    }
  }
  return fd
}

function extractErrors(err) {
  const data = err?.response?.data
  if (data?.errors && typeof data.errors === 'object') {
    return Object.values(data.errors).flat().filter(Boolean).map(String)
  }
  return []
}

async function load() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const res = await props.api.index(props.listParams)
    const data = res?.data || {}
    const list = Array.isArray(data[props.listKey]) ? data[props.listKey] : Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []
    items.value = list
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Failed to load records'
    items.value = []
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  formError.value = ''
  formErrors.value = []
  success.value = ''
  try {
    let payload = parsePayload()
    if (props.onBeforeSave) payload = await props.onBeforeSave(payload, { editing: editing.value, form }) || payload
    const hasFile = props.fields.some((f) => f.type === 'file' && fileState[f.key])
    const body = props.multipart || hasFile ? toFormData(payload) : payload
    if (editing.value) {
      const id = editing.value[props.idKey]
      await props.api.update(id, body)
      success.value = 'Record updated.'
    } else {
      await props.api.store(body)
      success.value = 'Record created.'
    }
    closeForm()
    await load()
  } catch (err) {
    if (err instanceof SyntaxError) {
      formError.value = 'Invalid JSON in one of the fields.'
    } else {
      formError.value = err?.response?.data?.message || err?.message || 'Failed to save record'
      formErrors.value = extractErrors(err)
    }
  } finally {
    saving.value = false
  }
}

async function remove(item) {
  const id = item?.[props.idKey]
  if (!id) return
  if (!window.confirm('Delete this record?')) return
  error.value = ''
  success.value = ''
  try {
    await props.api.destroy(id)
    success.value = 'Record deleted.'
    await load()
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Failed to delete record'
  }
}

watch(() => props.listParams, load, { deep: true })

load()

defineExpose({ load, items })
</script>

<style scoped>
.crud-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.crud-head h2 { margin: 0; font-size: 20px; }
.crud-head-actions { display: flex; gap: 8px; }
.table-wrap { overflow-x: auto; }
.row-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1200;
}
.modal {
  background: #fff;
  border-radius: 12px;
  width: min(900px, 100%);
  max-height: 90vh;
  overflow: auto;
  padding: 20px;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.modal-head h3 { margin: 0; }
.modal-close {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  color: #475569;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.form-group.full { grid-column: 1 / -1; }
.checkbox-input { width: 18px; height: 18px; }
.multi-select {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  max-height: 220px;
  overflow: auto;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.multi-option { display: flex; gap: 8px; align-items: center; font-size: 14px; }
.modal-foot {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.error-list { margin: 8px 0 0; padding-left: 18px; }
@media (max-width: 767px) {
  .form-grid { grid-template-columns: 1fr; }
  .crud-head { flex-direction: column; }
}
</style>
