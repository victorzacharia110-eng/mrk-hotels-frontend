<!-- StoreUnitsPage — the SI-unit registry shared by items, POs and GRNs. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search">
        <i class="fas fa-magnifying-glass"></i>
        <input v-model="search" type="text" :placeholder="$t('common.search')" />
      </div>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate">
        <i class="fas fa-plus"></i> {{ $t('storeManager.units.add') }}
      </button>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <section class="panel">
      <div v-if="loading" class="sm-loading">
        <i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}
      </div>
      <template v-else>
        <div class="table-scroll">
          <table class="sm-table" v-if="filtered.length">
            <thead>
              <tr>
                <th>{{ $t('storeManager.units.unit') }}</th>
                <th>{{ $t('storeManager.units.group') }}</th>
                <th>{{ $t('common.status') }}</th>
                <th>{{ $t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="unit in filtered" :key="unit.unit_id">
                <td><strong>{{ unit.unit }}</strong></td>
                <td><span class="chip">{{ unit.category || '—' }}</span></td>
                <td>
                  <span class="chip" :class="{ danger: unit.status !== 'active' }">
                    {{ unit.status === 'active' ? $t('common.active') : $t('common.inactive') }}
                  </span>
                </td>
                <td class="row-actions">
                  <button class="sm-btn sm ghost" @click="openEdit(unit)">
                    <i class="fas fa-pen"></i>
                  </button>
                  <button class="sm-btn sm danger" @click="remove(unit)">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty">{{ $t('storeManager.units.empty') }}</p>
        </div>
      </template>
    </section>

    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ editing ? $t('common.edit') : $t('storeManager.units.add') }}</h3>
          <button class="x" @click="showForm = false">×</button>
        </div>
        <label class="fld">
          <span>{{ $t('storeManager.units.unit') }}</span>
          <input v-model="form.unit" class="sm-input" :placeholder="$t('storeManager.inventory.unitPlaceholder')" />
        </label>
        <label class="fld">
          <span>{{ $t('storeManager.units.group') }}</span>
          <input v-model="form.category" class="sm-input" :placeholder="$t('storeManager.units.groupPlaceholder')" />
        </label>
        <label class="fld">
          <span>{{ $t('common.status') }}</span>
          <select v-model="form.status" class="sm-select">
            <option value="active">{{ $t('common.active') }}</option>
            <option value="inactive">{{ $t('common.inactive') }}</option>
          </select>
        </label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="save">
            {{ saving ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { unitsApi } from '@/api'
import '@/pages/store/store-shared.css'

const { t } = useI18n()
const units = ref([])
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const editing = ref(null)
const formError = ref('')
const success = ref('')
const error = ref('')
const form = reactive({ unit: '', category: '', status: 'active' })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return units.value
  return units.value.filter((u) =>
    (u.unit || '').toLowerCase().includes(q) || (u.category || '').toLowerCase().includes(q),
  )
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await unitsApi.index()
    units.value = res.data.units || []
  } catch (e) {
    error.value = e.response?.data?.message || t('common.error')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { unit: '', category: '', status: 'active' })
  formError.value = ''
  showForm.value = true
}

function openEdit(unit) {
  editing.value = unit
  Object.assign(form, {
    unit: unit.unit,
    category: unit.category || '',
    status: unit.status || 'active',
  })
  formError.value = ''
  showForm.value = true
}

async function save() {
  if (!form.unit.trim()) {
    formError.value = t('storeManager.units.unit') + ' is required.'
    return
  }
  saving.value = true
  formError.value = ''
  try {
    const payload = {
      unit: form.unit.trim(),
      category: form.category.trim() || null,
      status: form.status,
    }
    if (editing.value) await unitsApi.update(editing.value.unit_id, payload)
    else await unitsApi.store(payload)
    showForm.value = false
    success.value = t(editing.value ? 'storeManager.units.updated' : 'storeManager.units.created')
    await load()
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

async function remove(unit) {
  if (!window.confirm(t('storeManager.units.deleteConfirm', { unit: unit.unit }))) return
  error.value = ''
  try {
    await unitsApi.destroy(unit.unit_id)
    await load()
  } catch (e) {
    error.value = e.response?.data?.message || t('common.error')
  }
}

onMounted(load)
</script>
