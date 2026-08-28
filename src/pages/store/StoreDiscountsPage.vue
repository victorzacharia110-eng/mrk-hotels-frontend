<!-- StoreDiscountsPage — discount codes management. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select"><option value="">{{ $t('common.status') }}</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.discounts.add') }}</button>
    </div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="discounts.length">
          <thead><tr>
            <th>{{ $t('storeManager.discounts.code') }}</th><th>{{ $t('storeManager.discounts.type') }}</th>
            <th>{{ $t('storeManager.discounts.value') }}</th><th>{{ $t('storeManager.discounts.expires') }}</th>
            <th>{{ $t('common.status') }}</th><th>{{ $t('common.actions') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="d in paged" :key="d.id">
              <td><strong>{{ d.code }}</strong></td>
              <td><span class="chip">{{ d.percentage != null ? '%' : 'TZS' }}</span></td>
              <td>{{ d.percentage != null ? d.percentage + '%' : Number(d.amount || 0).toLocaleString() }}</td>
              <td>{{ d.expires_at ? new Date(d.expires_at).toLocaleDateString() : '—' }}</td>
              <td><span class="chip" :class="d.active ? 'chip-green' : 'chip-red'">{{ d.active ? $t('common.active') : $t('common.inactive') }}</span></td>
              <td><div class="row-actions">
                <button class="sm-btn sm ghost" @click="toggle(d)"><i class="fas" :class="d.active ? 'fa-ban' : 'fa-check'"></i></button>
                <button class="sm-btn sm danger" @click="remove(d)"><i class="fas fa-trash"></i></button>
              </div></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('storeManager.discounts.empty') }}</p>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
      </div>
      </template>
    </section>
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.discounts.add') }}</h3><button class="x" @click="showForm = false">×</button></div>
        <label class="fld"><span>{{ $t('storeManager.discounts.code') }}</span><input v-model="form.code" class="sm-input" /></label>
        <label class="fld"><span>{{ $t('storeManager.discounts.type') }}</span>
          <select v-model="form.kind" class="sm-select"><option value="percentage">%</option><option value="amount">TZS</option></select>
        </label>
        <label class="fld"><span>{{ $t('storeManager.discounts.value') }}</span><input v-model.number="form.value" type="number" min="0" class="sm-input" /></label>
        <label class="fld"><span>{{ $t('storeManager.discounts.expires') }}</span><input v-model="form.expires_at" type="date" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showForm = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="save">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeApi } from '../../api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import { useClientTable } from '@/composables/useClientTable.js'

const { t } = useI18n()
const discounts = ref([])
const { q, status, statuses, page, lastPage, paged } = useClientTable(discounts, { pageSize: 15, searchFields: ['code', 'status'] })
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const formError = ref('')
const form = reactive({ code: '', kind: 'percentage', value: 0, expires_at: '' })

async function load() {
  loading.value = true
  try { const res = await storeApi.discounts({ per_page: 50 }); discounts.value = res.data.data || res.data || [] }
  catch { discounts.value = [] } finally { loading.value = false }
}
function openCreate() { Object.assign(form, { code: '', kind: 'percentage', value: 0, expires_at: '' }); formError.value = ''; showForm.value = true }
async function save() {
  saving.value = true; formError.value = ''
  try {
    const payload = { code: form.code, expires_at: form.expires_at || undefined }
    if (form.kind === 'percentage') payload.percentage = form.value; else payload.amount = form.value
    await storeApi.storeDiscount(payload); showForm.value = false; await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
async function toggle(d) { await storeApi.updateDiscount(d.id, { active: !d.active }); await load() }
async function remove(d) {
  if (!window.confirm(t('storeManager.discounts.deleteConfirm', { code: d.code }))) return
  await storeApi.destroyDiscount(d.id); await load()
}
onMounted(load)
</script>
