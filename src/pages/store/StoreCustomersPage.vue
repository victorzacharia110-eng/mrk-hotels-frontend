<!-- StoreCustomersPage — customer database with stats and CRUD. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="search" type="text" :placeholder="$t('common.search')" @input="debounced" /></div>
      <span class="spacer"></span>
      <button v-if="bulk.selectedCount > 0" class="sm-btn danger" @click="showBulkDelete = true"><i class="fas fa-trash"></i> {{ $t('common.deleteSelected') }} ({{ bulk.selectedCount }})</button>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.customers.add') }}</button>
    </div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="customers.length">
          <thead><tr>
            <th class="bulk-col"><input type="checkbox" :checked="bulk.allSelected" :indeterminate.prop="bulk.someSelected && !bulk.allSelected" :aria-label="$t('common.selectAll')" @change="bulk.toggleAll()" /></th>
            <th>{{ $t('common.name') }}</th><th>{{ $t('common.phone') }}</th><th>{{ $t('common.email') }}</th>
            <th>{{ $t('storeManager.customers.purchases') }}</th><th>{{ $t('storeManager.customers.totalSpent') }}</th><th>{{ $t('common.actions') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="c in customers" :key="c.id">
              <td class="bulk-col"><input type="checkbox" :checked="bulk.isSelected(c.id)" @change="bulk.toggle(c.id)" /></td>
              <td><strong>{{ c.name }}</strong></td><td>{{ c.phone || '-' }}</td><td>{{ c.email || '-' }}</td>
              <td>{{ c.purchases_count ?? 0 }}</td>
              <td>TZS {{ Number(c.total_spent || 0).toLocaleString() }}</td>
              <td><div class="row-actions">
                <button class="sm-btn sm ghost" @click="openEdit(c)"><i class="fas fa-pen"></i></button>
                <button class="sm-btn sm danger" @click="remove(c)"><i class="fas fa-trash"></i></button>
              </div></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.customers.empty') }}</p>
      </div>
      <PaginationBar :page="meta.current_page" :last-page="meta.last_page" @change="load($event)" />
      </template>
    </section>
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ editing ? $t('common.edit') : $t('storeManager.customers.add') }}</h3><button class="x" @click="showForm = false">×</button></div>
        <label class="fld"><span>{{ $t('common.name') }}</span><input v-model="form.name" class="sm-input" /></label>
        <label class="fld"><span>{{ $t('common.phone') }}</span><input v-model="form.phone" class="sm-input" /></label>
        <label class="fld"><span>{{ $t('common.email') }}</span><input v-model="form.email" type="email" class="sm-input" /></label>
        <label class="fld"><span>{{ $t('common.address') }}</span><input v-model="form.address" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="save">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </div>

    <!-- Confirmation modal for bulk deletion (type DELETE to confirm) -->
    <DeleteConfirmModal
      v-model="showBulkDelete"
      :count="bulk.selectedCount"
      :busy="deleting"
      @confirm="bulkDelete"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeApi } from '../../api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'
import { useBulkSelection } from '@/composables/useBulkSelection'

const { t } = useI18n()
const customers = ref([])
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const editing = ref(null)
const formError = ref('')
const success = ref('')
const error = ref('')
const meta = ref({ current_page: 1, last_page: 1 })
const form = reactive({ name: '', phone: '', email: '', address: '' })

const bulk = useBulkSelection(() => customers.value, { idKey: 'id' })
const showBulkDelete = ref(false)
const deleting = ref(false)
let debounce
function debounced() { clearTimeout(debounce); debounce = setTimeout(() => load(1), 300) }

async function load(page = 1) {
  loading.value = true
  try {
    const res = await storeApi.customers({ search: search.value || undefined, per_page: 20, page })
    const d = res.data
    customers.value = d.data || d || []
    meta.value = d.meta || { current_page: d.current_page ?? 1, last_page: d.last_page ?? 1 }
  } catch { customers.value = [] } finally { loading.value = false }
}
function openCreate() { editing.value = null; Object.assign(form, { name: '', phone: '', email: '', address: '' }); formError.value = ''; showForm.value = true }
function openEdit(c) { editing.value = c; Object.assign(form, { name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '' }); formError.value = ''; showForm.value = true }
async function save() {
  saving.value = true; formError.value = ''
  try {
    if (editing.value) await storeApi.updateCustomer(editing.value.id, form)
    else await storeApi.storeCustomer(form)
    showForm.value = false; await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
async function remove(c) {
  if (!window.confirm(t('storeManager.customers.deleteConfirm', { name: c.name }))) return
  await storeApi.destroyCustomer(c.id); await load()
}
async function bulkDelete() {
  error.value = ''
  deleting.value = true
  try {
    const { tried, failed } = await bulk.removeMany((id) => storeApi.destroyCustomer(id))
    if (failed > 0) error.value = t('storeManager.customers.bulkDeletePartial', { tried, failed })
    else if (tried > 0) success.value = t('storeManager.customers.bulkDeleteSuccess', { count: tried })
    bulk.clear()
    showBulkDelete.value = false
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  } finally {
    deleting.value = false
  }
}
onMounted(load)
</script>

<style scoped>
.bulk-col {
  width: 40px;
}

.bulk-col input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
</style>
