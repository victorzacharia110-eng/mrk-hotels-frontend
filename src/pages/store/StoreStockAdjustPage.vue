<!--
  StoreStockAdjustPage — stock adjustment workbench: searchable item list
  with an adjust (in/out) action per row. Part of the client's Inventory menu
  group. Adjustments record a type, quantity and note via the adjust API.
-->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search">
        <i class="fas fa-magnifying-glass"></i>
        <input v-model="search" type="text" :placeholder="$t('common.search')" @input="debouncedLoad" />
      </div>
      <SearchableSelect
        v-model="category"
        :options="categoryOptions"
        :empty-label="$t('inventory.allCategories')"
        force-search
        @change="load"
      />
    </div>

    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <section class="panel">
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <template v-else>
        <div class="table-scroll">
        <table class="sm-table" v-if="items.length">
          <thead>
            <tr>
              <th>{{ $t('inventory.itemName') }}</th>
              <th>{{ $t('inventory.category') }}</th>
              <th>{{ $t('inventory.inStock') }}</th>
              <th>{{ $t('inventory.reorderLevel') }}</th>
              <th>{{ $t('common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.item_id">
              <td><strong>{{ item.item_name }}</strong><br /><small class="muted">{{ item.unit }}</small></td>
              <td><span class="chip">{{ formatCategory(item.category) }}</span></td>
              <td><span :class="isLow(item) ? 'stock-low' : 'stock-ok'">{{ item.quantity_in_stock }} {{ item.unit }}</span></td>
              <td>{{ item.reorder_level }}</td>
              <td>
                <button class="sm-btn sm" @click="openAdjust(item)" :title="$t('inventory.adjustStock')"><i class="fas fa-arrow-trend-up"></i> {{ $t('inventory.adjustStock') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">{{ $t('inventory.empty') }}</p>
      </div>
        <div class="sm-pagination" v-if="meta.last_page > 1">
          <button :disabled="meta.current_page <= 1" @click="go(meta.current_page - 1)">&laquo;</button>
          <span>{{ meta.current_page }} / {{ meta.last_page }}</span>
          <button :disabled="meta.current_page >= meta.last_page" @click="go(meta.current_page + 1)">&raquo;</button>
        </div>
      </template>
    </section>

    <!-- Stock adjustment modal -->
    <div v-if="adjusting" class="sm-modal-backdrop" @click.self="adjusting = null">
      <div class="sm-modal">
        <div class="sm-modal-head">
          <h3>{{ $t('inventory.adjustStock') }} — {{ adjusting.item_name }}</h3>
          <button class="sm-modal-close" @click="adjusting = null"><i class="fas fa-xmark"></i></button>
        </div>
        <form class="sm-modal-body" @submit.prevent="saveAdjustment">
          <div class="form-grid">
            <div class="form-field">
              <label>{{ $t('inventory.adjustmentType') }}</label>
              <select v-model="adjustForm.type" class="sm-select" style="width:100%">
                <option value="in">{{ $t('inventory.stockIn') }}</option>
                <option value="out">{{ $t('inventory.stockOut') }}</option>
              </select>
            </div>
            <div class="form-field"><label>{{ $t('inventory.quantity') }}</label><input v-model.number="adjustForm.quantity" type="number" min="1" class="sm-input" required /></div>
            <div class="form-field full"><label>{{ $t('inventory.reason') }}</label><input v-model="adjustForm.reason" class="sm-input" required /></div>
          </div>
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <div class="sm-modal-foot">
            <button type="button" class="sm-btn ghost" @click="adjusting = null">{{ $t('common.cancel') }}</button>
            <button type="submit" class="sm-btn" :disabled="saving">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryApi } from '@/api'
import { INVENTORY_CATEGORIES, formatCategory } from '@/utils/format'
import SearchableSelect from '@/components/SearchableSelect.vue'

const { t } = useI18n()

const items = ref([])
const meta = ref({ current_page: 1, last_page: 1 })
const loading = ref(false)
const saving = ref(false)
const search = ref('')
const category = ref('')
const adjusting = ref(null)
const adjustForm = reactive({ type: 'in', quantity: 1, reason: '' })
const formError = ref('')
const success = ref('')
const error = ref('')

const categoryOptions = computed(() =>
  INVENTORY_CATEGORIES.map((c) => ({ value: c, label: formatCategory(c) })),
)

function isLow(item) {
  return Number(item.quantity_in_stock) <= Number(item.reorder_level || 0)
}

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
    if (category.value) params.category = category.value
    const res = await inventoryApi.index(params)
    items.value = res.data.data || res.data || []
    meta.value = res.data.meta || { current_page: 1, last_page: 1 }
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

function go(page) { load(page) }

function openAdjust(item) {
  adjusting.value = item
  Object.assign(adjustForm, { type: 'in', quantity: 1, reason: '' })
  formError.value = ''
}

async function saveAdjustment() {
  saving.value = true
  formError.value = ''
  try {
    await inventoryApi.adjust(adjusting.value.item_id, {
      type: adjustForm.type,
      quantity: Math.abs(adjustForm.quantity),
      notes: adjustForm.reason,
    })
    adjusting.value = null
    success.value = t('inventory.adjusted')
    setTimeout(() => (success.value = ''), 3000)
    await load()
  } catch (e) {
    formError.value = e.response?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

onMounted(() => load(1))
</script>