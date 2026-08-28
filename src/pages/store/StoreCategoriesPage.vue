<!-- StoreCategoriesPage — manage inventory categories with product counts. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="search" type="text" :placeholder="$t('common.search')" /></div>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openCreate"><i class="fas fa-plus"></i> {{ $t('storeManager.categories.add') }}</button>
    </div>
    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <div v-else class="cat-grid">
        <div v-for="c in filtered" :key="c.id || c.name" class="cat-card">
          <div class="cat-head"><h4>{{ c.name }}</h4><span class="chip">{{ c.items_count ?? 0 }} {{ $t('storeManager.sales.items') }}</span></div>
          <p class="muted">{{ c.description || '—' }}</p>
          <div class="row-actions">
            <button class="sm-btn sm ghost" @click="openEdit(c)"><i class="fas fa-pen"></i></button>
            <button class="sm-btn sm danger" @click="remove(c)"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <p v-if="!filtered.length" class="empty">{{ $t('common.noResults') }}</p>
      </div>
    </section>
    <div v-if="showForm" class="sm-modal-backdrop" @click.self="showForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ editing ? $t('common.edit') : $t('storeManager.categories.add') }}</h3><button class="x" @click="showForm = false">×</button></div>
        <label class="fld"><span>{{ $t('common.name') }}</span><input v-model="form.name" class="sm-input" /></label>
        <label class="fld"><span>{{ $t('common.description') }}</span><textarea v-model="form.description" class="sm-input" rows="3"></textarea></label>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeApi } from '../../api'

const { t } = useI18n()
const cats = ref([])
const search = ref('')
const loading = ref(false)
const saving = ref(false)
const showForm = ref(false)
const editing = ref(null)
const formError = ref('')
const form = reactive({ name: '', description: '' })
const filtered = computed(() => cats.value.filter((c) => !search.value || (c.name || '').toLowerCase().includes(search.value.toLowerCase())))

async function load() {
  loading.value = true
  try { const res = await storeApi.categories(); cats.value = res.data.data || res.data || [] } catch { cats.value = [] } finally { loading.value = false }
}
function openCreate() { editing.value = null; Object.assign(form, { name: '', description: '' }); formError.value = ''; showForm.value = true }
function openEdit(c) { editing.value = c; Object.assign(form, { name: c.name, description: c.description || '' }); formError.value = ''; showForm.value = true }
async function save() {
  saving.value = true; formError.value = ''
  try {
    if (editing.value) await storeApi.updateCategory(editing.value.id, form)
    else await storeApi.storeCategory(form)
    showForm.value = false; await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
async function remove(c) {
  if (!window.confirm(t('storeManager.categories.deleteConfirm', { name: c.name }))) return
  await storeApi.destroyCategory(c.id); await load()
}
onMounted(load)
</script>

<style scoped>
.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.cat-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: #fff; }
.cat-head { display: flex; justify-content: space-between; align-items: center; }
.cat-head h4 { margin: 0; }
</style>
