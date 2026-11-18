<!--
  CashierDriversPage — the delivery driver roster.
  The Delivery Manager picks from this list instead of typing a free-text
  name, so the same driver is spelled the same way on every ticket.
-->

<template>
  <div class="sm-page">
    <section class="panel">
      <div class="panel-head">
        <div class="status-tabs" role="tablist">
          <button type="button" class="status-tab" :class="{ active: filter === 'all' }"
            role="tab" :aria-selected="filter === 'all'" @click="filter = 'all'">
            {{ $t('cashier.drivers.all') }}
          </button>
          <button type="button" class="status-tab" :class="{ active: filter === 'active' }"
            role="tab" :aria-selected="filter === 'active'" @click="filter = 'active'">
            {{ $t('cashier.drivers.active') }}
          </button>
          <button type="button" class="status-tab" :class="{ active: filter === 'inactive' }"
            role="tab" :aria-selected="filter === 'inactive'" @click="filter = 'inactive'">
            {{ $t('cashier.drivers.inactive') }}
          </button>
        </div>
        <div class="panel-head-actions">
          <div class="sm-search">
            <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
            <input v-model="search" type="search" :placeholder="$t('cashier.drivers.search')" />
          </div>
          <button type="button" class="btn btn-brand" @click="openNew">
            <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('cashier.drivers.addDriver') }}
          </button>
        </div>
      </div>

      <div class="table-scroll">
        <SkeletonLoader v-if="loading" variant="table" :count="6" :cols="4" />
        <table v-else class="sm-table">
          <thead>
            <tr>
              <th>{{ $t('cashier.drivers.name') }}</th>
              <th>{{ $t('cashier.drivers.phone') }}</th>
              <th>{{ $t('common.status') }}</th>
              <th>{{ $t('cashier.drivers.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="driver in filteredDrivers" :key="driver.driver_id">
              <td><strong>{{ driver.full_name }}</strong></td>
              <td>{{ driver.phone || '—' }}</td>
              <td>
                <span class="driver-badge" :class="driver.is_active ? 'is-active' : 'is-inactive'">
                  {{ driver.is_active ? $t('cashier.drivers.active') : $t('cashier.drivers.inactive') }}
                </span>
              </td>
              <td class="driver-actions">
                <button type="button" class="icon-btn" :aria-label="$t('common.edit')" @click="openEdit(driver)">
                  <i class="fas fa-pen" aria-hidden="true"></i>
                </button>
                <button type="button" class="icon-btn danger" :aria-label="$t('common.delete')" @click="removeDriver(driver)">
                  <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
              </td>
            </tr>
            <tr v-if="!filteredDrivers.length">
              <td colspan="4" class="empty">
                <i class="fas fa-circle-info" aria-hidden="true"></i> {{ $t('cashier.drivers.none') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="modalOpen" class="sm-modal-backdrop" @click.self="closeModal">
      <div class="sm-modal" role="dialog" aria-modal="true">
        <div class="sm-modal-head">
          <h3>
            <i class="fas fa-id-card" aria-hidden="true"></i>
            {{ editing ? $t('cashier.drivers.editDriver') : $t('cashier.drivers.addDriver') }}
          </h3>
          <button type="button" class="sm-modal-close" :aria-label="$t('common.close')" @click="closeModal">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        <form class="driver-form" @submit.prevent="saveDriver">
          <label class="field">
            <span>{{ $t('cashier.drivers.name') }} *</span>
            <input v-model.trim="form.full_name" type="text" required maxlength="100" />
          </label>
          <label class="field">
            <span>{{ $t('cashier.drivers.phone') }}</span>
            <input v-model.trim="form.phone" type="tel" maxlength="30" />
          </label>
          <label class="field field--check">
            <input v-model="form.is_active" type="checkbox" />
            <span>{{ $t('cashier.drivers.active') }}</span>
          </label>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="sm-modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t('common.cancel') }}</button>
            <button type="submit" class="btn btn-brand" :disabled="saving">
              <i v-if="saving" class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              {{ $t('common.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { deliveryDriverApi } from '@/api'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { toast } from '@/utils/toast'

const { t } = useI18n()

const drivers = ref([])
const loading = ref(true)
const filter = ref('all')
const search = ref('')
const modalOpen = ref(false)
const editing = ref(null)
const saving = ref(false)
const formError = ref('')

const form = reactive({
  full_name: '',
  phone: '',
  is_active: true,
})

const filteredDrivers = computed(() => {
  const term = search.value.trim().toLowerCase()
  return drivers.value.filter((driver) => {
    if (filter.value === 'active' && !driver.is_active) return false
    if (filter.value === 'inactive' && driver.is_active) return false
    if (!term) return true
    return `${driver.full_name || ''} ${driver.phone || ''}`.toLowerCase().includes(term)
  })
})

async function load() {
  loading.value = true
  try {
    const { data } = await deliveryDriverApi.index()
    drivers.value = data.drivers || []
  } catch (err) {
    drivers.value = []
    toast(err.response?.data?.message || err.message, 'error')
  } finally {
    loading.value = false
  }
}

function openNew() {
  editing.value = null
  Object.assign(form, { full_name: '', phone: '', is_active: true })
  formError.value = ''
  modalOpen.value = true
}

function openEdit(driver) {
  editing.value = driver
  Object.assign(form, {
    full_name: driver.full_name || '',
    phone: driver.phone || '',
    is_active: driver.is_active !== false,
  })
  formError.value = ''
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  editing.value = null
  formError.value = ''
}

async function saveDriver() {
  saving.value = true
  formError.value = ''
  try {
    const payload = {
      full_name: form.full_name,
      phone: form.phone || null,
      is_active: form.is_active,
    }
    if (editing.value) {
      await deliveryDriverApi.update(editing.value.driver_id, payload)
    } else {
      await deliveryDriverApi.store(payload)
    }
    closeModal()
    await load()
  } catch (err) {
    formError.value = err.response?.data?.message || err.message
  } finally {
    saving.value = false
  }
}

async function removeDriver(driver) {
  if (!window.confirm(t('cashier.drivers.confirmDelete', { name: driver.full_name }))) return
  try {
    await deliveryDriverApi.destroy(driver.driver_id)
    await load()
  } catch (err) {
    toast(err.response?.data?.message || err.message, 'error')
  }
}

onMounted(load)
</script>

<style scoped>
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.panel-head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.driver-actions { display: flex; gap: 6px; }
.driver-badge { display: inline-block; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 3px 9px; }
.driver-badge.is-active { background: #dcfce7; color: #166534; }
.driver-badge.is-inactive { background: #f1f5f9; color: #64748b; }
.driver-form { display: grid; gap: 14px; padding: 18px; }
.field { display: flex; flex-direction: column; gap: 5px; font-size: 13px; font-weight: 600; color: #475569; }
.field input[type='text'],
.field input[type='tel'] { border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 14px; padding: 9px 10px; }
.field--check { flex-direction: row; align-items: center; gap: 8px; }
</style>
