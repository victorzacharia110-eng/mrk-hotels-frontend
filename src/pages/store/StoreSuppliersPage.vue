<!--
  StoreSuppliersPage — supplier directory with create/edit modal.
-->

<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search">
        <i class="fas fa-magnifying-glass"></i>
        <input v-model="search" type="text" :placeholder="$t('common.search')" @input="debouncedLoad" />
      </div>
      <span class="spacer"></span>
      <button v-if="bulk.selectedCount > 0" class="sm-btn danger" @click="showBulkDelete = true"><i class="fas fa-trash"></i> {{ $t('common.deleteSelected') }} ({{ bulk.selectedCount }})</button>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.dashboard.newSupplier') }}</button>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="suppliers.length">
          <thead>
            <tr>
              <th class="bulk-col"><input type="checkbox" :checked="bulk.allSelected" :indeterminate.prop="bulk.someSelected && !bulk.allSelected" :aria-label="$t('common.selectAll')" @change="bulk.toggleAll()" /></th>
              <th>{{ $t('suppliers.name') }}</th>
              <th>{{ $t('suppliers.contactPerson') }}</th>
              <th>{{ $t('suppliers.phone') }}</th>
              <th>{{ $t('suppliers.email') }}</th>
              <th>{{ $t('suppliers.category') }}</th>
              <th>{{ $t('common.status') }}</th>
              <th>{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in suppliers" :key="s.supplier_id">
              <td class="bulk-col"><input type="checkbox" :checked="bulk.isSelected(s.supplier_id)" @change="bulk.toggle(s.supplier_id)" /></td>
              <td><strong>{{ s.supplier_name }}</strong></td>
              <td>{{ s.contact_person || '-' }}</td>
              <td>{{ s.phone || '-' }}</td>
              <td>{{ s.email || '-' }}</td>
              <td><span class="chip">{{ s.category }}</span></td>
              <td><span class="chip" :class="s.status === 'active' ? 'passed' : 'pending'">{{ s.status }}</span></td>
              <td>
                <div class="row-actions">
                  <button class="sm-btn sm ghost" @click="openEdit(s)"><i class="fas fa-pen"></i></button>
                  <button class="sm-btn sm danger" @click="remove(s)"><i class="fas fa-trash"></i></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('suppliers.empty') }}</p>
      </div>
        <div class="sm-pagination" v-if="meta.last_page > 1">
          <button :disabled="meta.current_page <= 1" @click="go(meta.current_page - 1)">&laquo;</button>
          <span>{{ meta.current_page }} / {{ meta.last_page }}</span>
          <button :disabled="meta.current_page >= meta.last_page" @click="go(meta.current_page + 1)">&raquo;</button>
        </div>
      </template>
    </section>

    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ editing ? $t('suppliers.editSupplier') : $t('suppliers.addSupplier') }}</h3>
          <button class="sm-modal-close" @click="showForm = false"><i class="fas fa-xmark"></i></button>
        </div>
        <form class="sm-modal-body" @submit.prevent="save">
          <div class="form-grid">
            <div class="form-field full"><label>{{ $t('suppliers.name') }}</label><input v-model="form.supplier_name" class="sm-input" required /></div>
            <div class="form-field"><label>{{ $t('suppliers.contactPerson') }}</label><input v-model="form.contact_person" class="sm-input" /></div>
            <div class="form-field"><label>{{ $t('suppliers.phone') }}</label><input v-model="form.phone" class="sm-input" /></div>
            <div class="form-field"><label>{{ $t('suppliers.email') }}</label><input v-model="form.email" type="email" class="sm-input" /></div>
            <div class="form-field">
              <label>{{ $t('suppliers.category') }}</label>
              <SearchableSelect v-model="form.category" :options="categoryOptions" force-search required />
            </div>
            <div class="form-field">
              <label>{{ $t('common.status') }}</label>
              <select v-model="form.status" class="sm-select" style="width:100%">
                <option value="active">{{ $t('common.active') }}</option>
                <option value="inactive">{{ $t('common.inactive') }}</option>
              </select>
            </div>
            <div class="form-field"><label>{{ $t('suppliers.paymentTerms') }}</label><input v-model="form.payment_terms" class="sm-input" placeholder="Net 30" /></div>
            <div class="form-field full"><label>{{ $t('suppliers.address') }}</label><input v-model="form.address" class="sm-input" /></div>
            <div class="form-field full"><label>{{ $t('common.notes') }}</label><textarea v-model="form.notes" rows="2" class="sm-textarea"></textarea></div>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="sm-modal-foot">
            <button type="button" class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
            <button type="submit" class="sm-btn" :disabled="saving">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
          </div>
        </form>
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
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supplierApi } from '@/api'
import DeleteConfirmModal from '@/components/DeleteConfirmModal.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useCategoriesStore } from '@/stores/categories'
import { useBulkSelection } from '@/composables/useBulkSelection'

const route = useRoute()
const { t } = useI18n()

const suppliers = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const loading = ref(false)
const saving = ref(false)
const search = ref('')
const showForm = ref(false)
const editing = ref(null)
const formError = ref('')
const success = ref('')
const error = ref('')

const bulk = useBulkSelection(() => suppliers.value, { idKey: 'supplier_id' })
const showBulkDelete = ref(false)
const deleting = ref(false)

const categoriesStore = useCategoriesStore()
const categoryOptions = categoriesStore.supplierCategoryOptions

const form = reactive({
  supplier_name: '', contact_person: '', phone: '', email: '',
  category: 'other', status: 'active', payment_terms: '', address: '', notes: '',
})

let debounce
function debouncedLoad() {
  clearTimeout(debounce)
  debounce = setTimeout(() => load(1), 300)
}

async function load(page = meta.value.current_page) {
  loading.value = true
  try {
    const params = { page, per_page: 20 }
    if (search.value) params.search = search.value
    const res = await supplierApi.index(params)
    suppliers.value = res.data.data || res.data || []
    meta.value = res.data.meta || { current_page: 1, last_page: 1 }
  } finally {
    loading.value = false
  }
}

function go(page) { load(page) }

function openCreate() {
  editing.value = null
  Object.assign(form, { supplier_name: '', contact_person: '', phone: '', email: '', category: 'other', status: 'active', payment_terms: '', address: '', notes: '' })
  formError.value = ''
  showForm.value = true
}

function openEdit(s) {
  editing.value = s
  Object.assign(form, {
    supplier_name: s.supplier_name, contact_person: s.contact_person || '', phone: s.phone || '',
    email: s.email || '', category: s.category || 'general', status: s.status || 'active',
    payment_terms: s.payment_terms || '', address: s.address || '', notes: s.notes || '',
  })
  formError.value = ''
  showForm.value = true
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    if (editing.value) await supplierApi.update(editing.value.supplier_id, { ...form })
    else await supplierApi.store({ ...form })
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

async function remove(s) {
  if (!window.confirm(t('suppliers.deleteConfirm', { name: s.supplier_name }))) return
  await supplierApi.destroy(s.supplier_id)
  await load()
}

async function bulkDelete() {
  error.value = ''
  deleting.value = true
  try {
    const { tried, failed } = await bulk.removeMany((id) => supplierApi.destroy(id))
    if (failed > 0) error.value = t('suppliers.bulkDeletePartial', { tried, failed })
    else if (tried > 0) success.value = t('suppliers.bulkDeleteSuccess', { count: tried })
    bulk.clear()
    showBulkDelete.value = false
    await load()
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error')
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  await load(1)
  if (route.query.create === '1') openCreate()
})
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
