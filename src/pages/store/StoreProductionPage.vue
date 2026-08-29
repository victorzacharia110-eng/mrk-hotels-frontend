<!-- StoreProductionPage — BOM recipes and production runs.
     A run consumes the recipe's ingredients and adds the yield to stock. -->
<template>
  <div class="sm-page">
    <div class="sm-toolbar">
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="q" type="text" :placeholder="$t('common.search')" /></div>
      <select v-if="statuses.length" v-model="status" class="sm-select">
        <option value="">{{ $t('common.status') }}</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
      </select>
      <button class="sm-btn ghost" @click="openRecipeForm"><i class="fas fa-flask"></i> {{ $t('storeManager.production.newRecipe') }}</button>
      <span class="spacer"></span>
      <button class="sm-btn" @click="openRunForm"><i class="fas fa-industry"></i> {{ $t('storeManager.production.newRun') }}</button>
    </div>
    <p v-if="toolbarError" class="sm-error">{{ toolbarError }}</p>

    <section class="panel">
      <h3 class="panel-title">{{ $t('storeManager.production.recipes') }}</h3>
      <div class="sm-search"><i class="fas fa-magnifying-glass"></i><input v-model="recipeQ" type="text" :placeholder="$t('common.search')" /></div>
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <div class="table-scroll" v-else-if="recipes.length">
        <table class="sm-table">
        <thead><tr>
          <th>{{ $t('inventory.itemName') }}</th><th>{{ $t('storeManager.production.product') }}</th>
          <th>{{ $t('storeManager.production.yield') }}</th><th>{{ $t('storeManager.sales.items') }}</th>
        </tr></thead>
        <tbody>
          <tr v-for="r in pagedRecipes" :key="r.recipe_id">
            <td><strong>{{ r.name }}</strong></td>
            <td>{{ r.product?.item_name || '—' }}</td>
            <td>{{ r.yield_qty }} {{ r.product?.unit || '' }}</td>
            <td>{{ (r.items || []).map((i) => `${i.item?.item_name} ×${i.quantity}`).join(', ') }}</td>
          </tr>
        </tbody>
      </table>
      <PaginationBar :page="recipePage" :last-page="recipeLastPage" @change="recipePage = $event" />
      </div>
      <p v-else class="empty">{{ $t('storeManager.production.noRecipes') }}</p>
    </section>

    <section class="panel">
      <h3 class="panel-title">{{ $t('storeManager.production.runs') }}</h3>
      <div v-if="loading" class="sm-loading"><i class="fas fa-circle-notch"></i> {{ $t('common.loading') }}</div>
      <div class="table-scroll" v-else-if="runs.length">
        <table class="sm-table">
        <thead><tr>
          <th>{{ $t('common.date') }}</th><th>#</th><th>{{ $t('storeManager.production.recipe') }}</th>
          <th>{{ $t('storeManager.counts.batch') }}</th><th>{{ $t('common.status') }}</th><th></th>
        </tr></thead>
        <tbody>
          <tr v-for="run in pagedRuns" :key="run.run_id">
            <td>{{ fmtDate(run.created_at) }}</td>
            <td>{{ run.run_number }}</td>
            <td>{{ run.recipe?.name || '—' }}</td>
            <td>{{ run.batches }}</td>
            <td><span class="chip" :class="{ danger: run.status === 'voided' }">{{ run.status }}</span></td>
            <td>
              <button v-if="run.status === 'completed'" class="sm-btn ghost slim-btn" @click="askVoid(run)">
                {{ $t('storeManager.common.void') }}
              </button>
              <span v-else-if="run.status === 'voided'" class="void-reason">{{ run.void_reason }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <PaginationBar :page="page" :last-page="lastPage" @change="page = $event" />
      </div>
      <p v-else class="empty">{{ $t('storeManager.production.noRuns') }}</p>
    </section>

    <!-- New run modal -->
    <div v-if="showRunForm" class="sm-modal-backdrop" @click.self="showRunForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.production.newRun') }}</h3><button class="x" @click="showRunForm = false">×</button></div>
        <label class="fld"><span>{{ $t('storeManager.production.recipe') }}</span>
          <select v-model="runForm.recipe_id" class="sm-select">
            <option v-for="r in recipes" :key="r.recipe_id" :value="r.recipe_id">
              {{ r.name }} → {{ r.product?.item_name }}
            </option>
          </select>
        </label>
        <label class="fld"><span>{{ $t('storeManager.counts.batch') }}</span>
          <input v-model.number="runForm.batches" type="number" min="0.5" step="0.5" class="sm-input" />
        </label>
        <p v-if="selectedRecipe" class="hint">
          {{ $t('storeManager.production.consumes') }}:
          {{ selectedRecipe.items.map((i) => `${i.item?.item_name} ×${round(i.quantity * runForm.batches)}`).join(', ') }}
          · {{ $t('storeManager.production.produces') }}:
          {{ round(selectedRecipe.yield_qty * runForm.batches) }} {{ selectedRecipe.product?.unit || '' }}
        </p>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showRunForm = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="saveRun">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </div>

    <!-- New recipe modal -->
    <div v-if="showRecipeForm" class="sm-modal-backdrop" @click.self="showRecipeForm = false">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.production.newRecipe') }}</h3><button class="x" @click="showRecipeForm = false">×</button></div>
        <label class="fld"><span>{{ $t('inventory.itemName') }}</span><input v-model="recipeForm.name" class="sm-input" /></label>
        <label class="fld"><span>{{ $t('storeManager.production.product') }}</span>
          <select v-model="recipeForm.product_item_id" class="sm-select">
            <option v-for="i in items" :key="i.item_id" :value="i.item_id">{{ i.item_name }}</option>
          </select>
        </label>
        <label class="fld"><span>{{ $t('storeManager.production.yield') }}</span>
          <input v-model.number="recipeForm.yield_qty" type="number" min="0.5" step="0.5" class="sm-input" />
        </label>
        <div class="fld">
          <span>{{ $t('storeManager.production.ingredients') }}</span>
          <div v-for="(ing, idx) in recipeForm.ingredients" :key="idx" class="ing-row">
            <select v-model="ing.item_id" class="sm-select">
              <option v-for="i in items" :key="i.item_id" :value="i.item_id">{{ i.item_name }}</option>
            </select>
            <input v-model.number="ing.quantity" type="number" min="0.5" step="0.5" class="sm-input slim" />
            <button class="x" @click="recipeForm.ingredients.splice(idx, 1)">×</button>
          </div>
          <button class="sm-btn ghost slim-btn" @click="recipeForm.ingredients.push({ item_id: items[0]?.item_id, quantity: 1 })">
            + {{ $t('storeManager.production.addIngredient') }}
          </button>
        </div>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="showRecipeForm = false">{{ $t('common.cancel') }}</button>
          <button class="sm-btn" :disabled="saving" @click="saveRecipe">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </div>

    <div v-if="voidTarget" class="sm-modal-backdrop" @click.self="voidTarget = null">
      <div class="sm-modal">
        <div class="sm-modal-head"><h3>{{ $t('storeManager.common.voidTitle') }}</h3><button class="x" @click="voidTarget = null">×</button></div>
        <label class="fld"><span>{{ $t('storeManager.common.reason') }}</span><input v-model="voidReason" class="sm-input" /></label>
        <p v-if="formError" class="sm-error">{{ formError }}</p>
        <div class="sm-modal-foot">
          <button class="sm-btn ghost" @click="voidTarget = null">{{ $t('common.cancel') }}</button>
          <button class="sm-btn danger" :disabled="saving" @click="confirmVoid">{{ saving ? $t('common.saving') : $t('storeManager.common.void') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryApi, inventoryOpsApi } from '../../api'
import PaginationBar from '@/components/store/PaginationBar.vue'
import { useClientTable } from '@/composables/useClientTable.js'

const { t } = useI18n()
const recipes = ref([])
const runs = ref([])
const runTable = useClientTable(runs, { pageSize: 10, searchFields: ['run_number', 'status', (r) => r.recipe?.name] })
const recipeTable = useClientTable(recipes, { pageSize: 10, searchFields: ['name', (r) => r.product?.item_name] })
const { q, status, statuses, page, lastPage, paged: pagedRuns } = runTable
const { q: recipeQ, page: recipePage, lastPage: recipeLastPage, paged: pagedRecipes } = recipeTable
const items = ref([])
const loading = ref(false)
const saving = ref(false)
const formError = ref('')
const showRunForm = ref(false)
const showRecipeForm = ref(false)
const voidTarget = ref(null)
const voidReason = ref('')
const runForm = reactive({ recipe_id: null, batches: 1 })
const recipeForm = reactive({ name: '', product_item_id: null, yield_qty: 1, ingredients: [{ item_id: null, quantity: 1 }] })
const toolbarError = ref('')

const selectedRecipe = computed(() => recipes.value.find((r) => r.recipe_id === runForm.recipe_id))
function fmtDate(v) { return v ? new Date(v).toLocaleDateString() : '-' }
function round(v) { return Math.round(v * 100) / 100 }

async function load() {
  loading.value = true
  try {
    const [rc, rn, it] = await Promise.allSettled([
      inventoryOpsApi.recipes(),
      inventoryOpsApi.productionRuns({ per_page: 50 }),
      inventoryApi.index({ per_page: 100 }),
    ])
    recipes.value = rc.status === 'fulfilled' ? (rc.value.data.recipes || []) : []
    runs.value = rn.status === 'fulfilled' ? (rn.value.data.runs || []) : []
    items.value = it.status === 'fulfilled' ? (it.value.data.data || it.value.data || []) : []
  } finally { loading.value = false }
}
function openRunForm() {
  toolbarError.value = ''
  if (!recipes.value.length) {
    // No recipes yet: surface the reason here, where the user actually is
    // (the modal never opens in this case).
    toolbarError.value = t('storeManager.production.noRecipesHint')
    return
  }
  runForm.recipe_id = recipes.value[0]?.recipe_id || null
  runForm.batches = 1
  formError.value = ''
  showRunForm.value = true
}

function openRecipeForm() {
  Object.assign(recipeForm, {
    name: '',
    product_item_id: items.value[0]?.item_id || null,
    yield_qty: 1,
    ingredients: [{ item_id: items.value[0]?.item_id || null, quantity: 1 }],
  })
  formError.value = ''
  toolbarError.value = ''
  showRecipeForm.value = true
}
async function saveRun() {
  saving.value = true; formError.value = ''
  try {
    await inventoryOpsApi.storeProductionRun({ ...runForm })
    showRunForm.value = false
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
async function saveRecipe() {
  saving.value = true; formError.value = ''
  try {
    await inventoryOpsApi.storeRecipe({
      name: recipeForm.name,
      product_item_id: recipeForm.product_item_id,
      yield_qty: recipeForm.yield_qty,
      items: recipeForm.ingredients.filter((i) => i.item_id && i.quantity > 0),
    })
    showRecipeForm.value = false
    Object.assign(recipeForm, { name: '', product_item_id: items.value[0]?.item_id, yield_qty: 1,
      ingredients: [{ item_id: items.value[0]?.item_id, quantity: 1 }] })
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
function askVoid(run) {
  voidReason.value = ''
  voidTarget.value = run
  formError.value = ''
}
async function confirmVoid() {
  if (!voidReason.value.trim()) { formError.value = t('storeManager.common.reasonRequired'); return }
  saving.value = true
  try {
    await inventoryOpsApi.voidProductionRun(voidTarget.value.run_id, voidReason.value.trim())
    voidTarget.value = null
    await load()
  } catch (e) { formError.value = e.response?.data?.message || t('common.error') } finally { saving.value = false }
}
onMounted(load)
</script>

<style scoped>
.panel-title { margin: 0 0 12px; }
.danger { background: #fde8e8; color: #b91c1c; }
.slim-btn { padding: 4px 10px; font-size: 12px; }
.void-reason { font-size: 12px; color: #64748b; font-style: italic; }
.hint { font-size: 12px; color: #475569; margin: 8px 0; }
.ing-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.ing-row .slim { width: 80px; }
</style>
