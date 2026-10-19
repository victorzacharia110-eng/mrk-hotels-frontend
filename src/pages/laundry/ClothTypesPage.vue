<!--
  ClothTypesPage.vue
  Laundry registry with two tabs per the resolution:
    - "Cloth Types" register a composition — the material a garment is made of
      (e.g. Denim, Cotton) plus a short description of what it is composed of.
    - "Cloth Items" register the priced garment/linen (e.g. jeans trousers,
      cadet suits) with wash / iron / dry-clean prices, each optionally
      belonging to a cloth type. These feed the New Laundry Order item picker
      so unit prices auto-fill instead of being typed each time.
  A back button returns to the laundry orders. Management gated by module 40.
-->

<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div class="head-left">
        <button
          type="button"
          class="btn btn-secondary btn-back"
          :title="$t('common.back')"
          @click="$router.push('/app/laundry')"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
        </button>
        <div>
          <h1>{{ $t('clothTypes.title') }}</h1>
          <p class="muted">{{ $t('clothTypes.subtitle') }}</p>
        </div>
      </div>
      <div class="head-actions">
        <button class="btn btn-secondary" @click="reloadActiveTab">
          <i class="fas fa-rotate"></i> {{ $t('laundry.refresh') }}
        </button>
        <button v-if="canManage" class="btn btn-primary" @click="openCreate">
          <i class="fas fa-plus"></i> {{ activeTab === 'types' ? $t('clothTypes.newComposition') : $t('clothTypes.new') }}
        </button>
      </div>
    </div>

    <!-- Two registry tabs: cloth type (composition) vs cloth item (priced) -->
    <div class="reg-tabs" role="tablist" :aria-label="$t('clothTypes.title')">
      <button
        type="button"
        role="tab"
        class="reg-tab"
        :class="{ active: activeTab === 'types' }"
        :aria-selected="activeTab === 'types'"
        @click="switchTab('types')"
      >
        <i class="fas fa-layer-group" aria-hidden="true"></i> {{ $t('clothTypes.tabTypes') }}
      </button>
      <button
        type="button"
        role="tab"
        class="reg-tab"
        :class="{ active: activeTab === 'items' }"
        :aria-selected="activeTab === 'items'"
        @click="switchTab('items')"
      >
        <i class="fas fa-shirt" aria-hidden="true"></i> {{ $t('clothTypes.tabItems') }}
      </button>
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="card filter-bar">
      <div class="filter-grid">
        <div class="form-group">
          <label>{{ $t('common.search') }}</label>
          <input
            v-model="search"
            type="text"
            class="input"
            :placeholder="$t('clothTypes.searchPlaceholder')"
            @input="triggerSearch"
          />
        </div>
      </div>
    </div>

    <div v-if="loading" class="alert alert-info">{{ $t('laundry.loading') }}</div>

    <!-- CLOTH TYPES: compositions (name + what it is composed of) -->
    <div v-else-if="activeTab === 'types'" class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('clothTypes.name') }}</th>
            <th scope="col">{{ $t('clothTypes.description') }}</th>
            <th scope="col">{{ $t('clothTypes.itemsCount') }}</th>
            <th scope="col">{{ $t('common.status') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="comp in compositions" :key="comp.cloth_composition_id">
            <td><strong>{{ comp.name }}</strong></td>
            <td>{{ comp.description || '—' }}</td>
            <td>{{ comp.cloth_types_count ?? 0 }}</td>
            <td>
              <span class="badge" :class="comp.is_active ? 'badge-green' : 'badge-gray'">{{
                comp.is_active ? $t('clothTypes.active') : $t('clothTypes.inactive')
              }}</span>
            </td>
            <td>
              <div class="actions" v-if="canManage">
                <button class="btn btn-sm btn-secondary" @click="openEdit(comp)">
                  <i class="fas fa-pen"></i> {{ $t('common.edit') }}
                </button>
                <button class="btn btn-sm btn-danger" @click="removeComposition(comp)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
              <span v-else class="muted">—</span>
            </td>
          </tr>
          <tr v-if="!compositions.length && !loading">
            <td colspan="5" class="muted">{{ $t('clothTypes.emptyCompositions') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- CLOTH ITEMS: priced garments/linens, each linked to a cloth type -->
    <div v-else class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ $t('clothTypes.name') }}</th>
            <th scope="col">{{ $t('clothTypes.composition') }}</th>
            <th scope="col">{{ $t('clothTypes.washPrice') }}</th>
            <th scope="col">{{ $t('clothTypes.ironPrice') }}</th>
            <th scope="col">{{ $t('clothTypes.dryCleanPrice') }}</th>
            <th scope="col">{{ $t('common.status') }}</th>
            <th scope="col">{{ $t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cloth in clothTypes" :key="cloth.cloth_type_id">
            <td><strong>{{ cloth.name }}</strong></td>
            <td>{{ cloth.composition?.name || '—' }}</td>
            <td><span class="price">{{ curCode() }} {{ Number(cloth.wash_price).toLocaleString() }}</span></td>
            <td><span class="price">{{ curCode() }} {{ Number(cloth.iron_price).toLocaleString() }}</span></td>
            <td>
              <span class="price">{{ curCode() }} {{ Number(cloth.dry_clean_price).toLocaleString() }}</span>
            </td>
            <td>
              <span class="badge" :class="cloth.is_active ? 'badge-green' : 'badge-gray'">{{
                cloth.is_active ? $t('clothTypes.active') : $t('clothTypes.inactive')
              }}</span>
            </td>
            <td>
              <div class="actions" v-if="canManage">
                <button class="btn btn-sm btn-secondary" @click="openEdit(cloth)">
                  <i class="fas fa-pen"></i> {{ $t('common.edit') }}
                </button>
                <button class="btn btn-sm btn-danger" @click="removeItem(cloth)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
              <span v-else class="muted">—</span>
            </td>
          </tr>
          <tr v-if="!clothTypes.length && !loading">
            <td colspan="7" class="muted">{{ $t('clothTypes.empty') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/edit modal: fields differ per active tab -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-head">
          <h2>
            <i :class="activeTab === 'types' ? 'fas fa-layer-group' : 'fas fa-shirt'"></i>
            {{ modalTitle }}
          </h2>
          <button class="modal-close" @click="closeModal"><i class="fas fa-xmark"></i></button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <!-- Cloth type (composition) form -->
        <form v-if="activeTab === 'types'" @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>{{ $t('clothTypes.name') }} *</label>
              <input v-model="form.name" type="text" class="input" required />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('clothTypes.description') }}</label>
              <input
                v-model="form.description"
                type="text"
                class="input"
                :placeholder="$t('clothTypes.descriptionPlaceholder')"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('common.status') }}</label>
              <SearchableSelect
                v-model="form.is_active"
                :options="[
                  { value: true, label: t('clothTypes.active') },
                  { value: false, label: t('clothTypes.inactive') },
                ]"
              />
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('clothTypes.save') }}
            </button>
          </div>
        </form>

        <!-- Cloth item (priced garment) form -->
        <form v-else @submit.prevent="save">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>{{ $t('clothTypes.name') }} *</label>
              <input v-model="form.name" type="text" class="input" required />
            </div>
            <div class="form-group form-full">
              <label>{{ $t('clothTypes.composition') }}</label>
              <SearchableSelect
                v-model="form.cloth_composition_id"
                :options="compositionOptions"
                :empty-label="$t('common.none')"
              />
            </div>
            <div class="form-group">
              <label>{{ $t('clothTypes.washPrice') }} *</label>
              <input
                v-model.number="form.wash_price"
                type="number"
                min="0"
                step="0.01"
                class="input"
                required
              />
            </div>
            <div class="form-group">
              <label>{{ $t('clothTypes.ironPrice') }} *</label>
              <input
                v-model.number="form.iron_price"
                type="number"
                min="0"
                step="0.01"
                class="input"
                required
              />
            </div>
            <div class="form-group">
              <label>{{ $t('clothTypes.dryCleanPrice') }} *</label>
              <input
                v-model.number="form.dry_clean_price"
                type="number"
                min="0"
                step="0.01"
                class="input"
                required
              />
            </div>
            <div class="form-group">
              <label>{{ $t('common.status') }}</label>
              <SearchableSelect
                v-model="form.is_active"
                :options="[
                  { value: true, label: t('clothTypes.active') },
                  { value: false, label: t('clothTypes.inactive') },
                ]"
              />
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="btn btn-secondary" @click="closeModal">
              {{ $t('common.cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fas fa-check"></i>
              {{ saving ? $t('common.saving') : $t('clothTypes.save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { clothTypeApi, clothCompositionApi } from '@/api'
import SearchableSelect from '@/components/SearchableSelect.vue'

import { useTenantCurrency } from '@/utils/currency'

const { curCode } = useTenantCurrency()

const { t } = useI18n()
const authStore = useAuthStore()
const canManage = computed(() => authStore.can(40) && authStore.canOperate)

// Which registry is shown: "types" (compositions) or "items" (priced garments).
const activeTab = ref('items')

const clothTypes = ref([])
const compositions = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const search = ref('')

const showModal = ref(false)
const editing = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const form = reactive({
  name: '',
  description: '',
  cloth_composition_id: '',
  wash_price: 0,
  iron_price: 0,
  dry_clean_price: 0,
  is_active: true,
})

const modalTitle = computed(() => {
  if (activeTab.value === 'types') {
    return editing.value ? t('clothTypes.editComposition') : t('clothTypes.newComposition')
  }
  return editing.value ? t('clothTypes.edit') : t('clothTypes.new')
})

/** Composition options for the item form's "belongs to" picker. */
const compositionOptions = computed(() =>
  compositions.value.map((c) => ({ value: c.cloth_composition_id, label: c.name })),
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    if (activeTab.value === 'types') {
      const res = await clothCompositionApi.index({ search: search.value, per_page: 100 })
      compositions.value = res.data.cloth_compositions?.data || res.data.data?.data || []
    } else {
      const res = await clothTypeApi.index({ search: search.value, per_page: 100 })
      clothTypes.value = res.data.cloth_types?.data || res.data.data?.data || []
    }
  } catch (err) {
    error.value = err.response?.data?.message || t('clothTypes.loadError')
  } finally {
    loading.value = false
  }
}

/** Loads both registries so the item form's composition picker is populated. */
async function loadCompositions() {
  try {
    const res = await clothCompositionApi.index({ per_page: 100 })
    compositions.value = res.data.cloth_compositions?.data || res.data.data?.data || []
  } catch {
    // ignore
  }
}

function reloadActiveTab() {
  if (activeTab.value === 'items') loadCompositions()
  load()
}

function switchTab(tab) {
  activeTab.value = tab
  search.value = ''
  load()
}

function triggerSearch() {
  load()
}

function resetForm() {
  form.name = ''
  form.description = ''
  form.cloth_composition_id = ''
  form.wash_price = 0
  form.iron_price = 0
  form.dry_clean_price = 0
  form.is_active = true
}

function openCreate() {
  resetForm()
  modalError.value = ''
  editing.value = false
  editingId.value = null
  showModal.value = true
}

function openEdit(row) {
  modalError.value = ''
  editing.value = true
  showModal.value = true
  if (activeTab.value === 'types') {
    editingId.value = row.cloth_composition_id
    form.name = row.name
    form.description = row.description || ''
    form.is_active = Boolean(row.is_active)
  } else {
    editingId.value = row.cloth_type_id
    form.name = row.name
    form.cloth_composition_id = row.cloth_composition_id || ''
    form.wash_price = Number(row.wash_price)
    form.iron_price = Number(row.iron_price)
    form.dry_clean_price = Number(row.dry_clean_price)
    form.is_active = Boolean(row.is_active)
  }
}

function closeModal() {
  showModal.value = false
}

async function save() {
  modalError.value = ''
  saving.value = true
  try {
    if (activeTab.value === 'types') {
      const payload = { name: form.name, description: form.description, is_active: form.is_active }
      if (editing.value) {
        await clothCompositionApi.update(editingId.value, payload)
        success.value = t('clothTypes.updated')
      } else {
        await clothCompositionApi.store(payload)
        success.value = t('clothTypes.created')
      }
    } else {
      const payload = {
        name: form.name,
        cloth_composition_id: form.cloth_composition_id || null,
        wash_price: form.wash_price,
        iron_price: form.iron_price,
        dry_clean_price: form.dry_clean_price,
        is_active: form.is_active,
      }
      if (editing.value) {
        await clothTypeApi.update(editingId.value, payload)
        success.value = t('clothTypes.updated')
      } else {
        await clothTypeApi.store(payload)
        success.value = t('clothTypes.created')
      }
    }
    showModal.value = false
    await load()
  } catch (err) {
    modalError.value = flattenError(err)
  } finally {
    saving.value = false
  }
}

async function removeComposition(comp) {
  if (!window.confirm(t('common.delete'))) return
  error.value = ''
  try {
    await clothCompositionApi.destroy(comp.cloth_composition_id)
    success.value = t('clothTypes.deleted')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

async function removeItem(cloth) {
  if (!window.confirm(t('common.delete'))) return
  error.value = ''
  try {
    await clothTypeApi.destroy(cloth.cloth_type_id)
    success.value = t('clothTypes.deleted')
    await load()
  } catch (err) {
    error.value = flattenError(err)
  }
}

function flattenError(err) {
  const messages = err.response?.data?.errors
  return messages
    ? Object.values(messages).flat().join(' ')
    : err.response?.data?.message || t('common.actionFailed')
}

onMounted(() => {
  load()
  loadCompositions()
})
</script>

<style scoped>
.dashboard-page {
  padding: 32px 20px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.page-head h1 {
  font-size: 28px;
  font-weight: 800;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.btn-back {
  padding: 10px 12px;
}

.head-actions {
  display: flex;
  gap: 10px;
}

/* Two registry tabs: cloth type (composition) vs cloth item (priced). */
.reg-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 16px;
  background: #f0f0f0;
  border-radius: 10px;
}

.reg-tab {
  border: none;
  background: transparent;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  color: #555;
}

.reg-tab.active {
  background: #fff;
  color: #005eb8;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.filter-bar {
  margin-bottom: 16px;
  padding: 16px 20px;
  max-width: 420px;
}

.muted {
  color: #757575;
  font-size: 12px;
  margin-top: 2px;
}

.price {
  font-weight: 700;
  color: #005eb8;
}

.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: #fff;
  border-radius: 8px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.modal-head h2 {
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-head h2 i {
  color: #005eb8;
}

.modal-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #757575;
  cursor: pointer;
  padding: 4px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.form-full {
  grid-column: 1 / -1;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
</style>
