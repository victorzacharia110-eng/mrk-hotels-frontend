<!--
  CashierIngredientsPage — recipe / ingredient editor.
  Left: menu item tree grouped by category. Right: ingredient lines for the
  selected item (inventory item, quantity per unit, unit).  Add / edit / delete
  ingredient links so the F&B inventory tracker deducts stock on every sale.
-->

<template>
  <div class="sm-page">
    <div class="lookup-layout">
      <!-- ── Left: menu item tree ─────────────────────── -->
      <section class="panel">
        <div class="panel-head">
          <h2><i class="fas fa-layer-group" aria-hidden="true"></i> {{ $t('cashier.ingredients.menuItems') }}</h2>
          <select v-model="department" class="sm-select sm" @change="loadMenuItems">
            <option value="">{{ $t('cashier.lookup.allMenus') }}</option>
            <option value="restaurant">{{ $t('cashier.lookup.kitchenMenu') }}</option>
            <option value="bar">{{ $t('cashier.lookup.barMenu') }}</option>
          </select>
        </div>
        <div class="tree-body">
          <input v-model="menuSearch" type="search" class="sm-input full-width"
            :placeholder="$t('cashier.lookup.searchCategory')" />
          <SkeletonLoader v-if="loadingMenu" variant="tree" :count="9" />
          <div v-else class="cat-tree">
            <div v-for="(itemsInCat, cat) in groupedMenuItems" :key="cat" class="cat-group">
              <button class="cat-toggle" @click="toggleCat(cat)">
                <i :class="collapsed.has(cat) ? 'fas fa-chevron-right' : 'fas fa-chevron-down'" aria-hidden="true"></i>
                {{ cat }}
                <span class="cat-count">{{ itemsInCat.length }}</span>
              </button>
              <div v-show="!collapsed.has(cat)" class="cat-kids">
                <button v-for="item in itemsInCat" :key="item.menu_item_id" class="cat-leaf"
                  :class="{ active: activeItemId === item.menu_item_id }" @click="selectItem(item)">
                  {{ item.item_name }}
                  <span v-if="item._ingredientCount > 0" class="ing-badge">{{ item._ingredientCount }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Right: ingredient editor ─────────────────── -->
      <section class="panel">
        <div class="panel-head">
          <h2>
            <i class="fas fa-flask" aria-hidden="true"></i>
            {{ activeItem ? activeItem.item_name : $t('cashier.ingredients.selectItem') }}
          </h2>
          <button v-if="activeItem" class="sm-btn sm" @click="openAdd">
            <i class="fas fa-plus" aria-hidden="true"></i> {{ $t('cashier.ingredients.add') }}
          </button>
        </div>

        <div v-if="!activeItem" class="empty-wrap">
          <i class="fas fa-hand-pointer empty-icon"></i>
          <p class="empty">{{ $t('cashier.ingredients.pickItem') }}</p>
        </div>

        <div v-else-if="loadingIngredients" class="empty-wrap">
          <i class="fas fa-spinner fa-spin"></i>
        </div>

        <div v-else-if="ingredients.length" class="table-scroll">
        <table class="sm-table">
          <thead>
            <tr>
              <th>{{ $t('cashier.ingredients.inventoryItem') }}</th>
              <th>{{ $t('cashier.ingredients.qtyPerUnit') }}</th>
              <th>{{ $t('cashier.ingredients.unit') }}</th>
              <th>{{ $t('cashier.ingredients.stock') }}</th>
              <th>{{ $t('cashier.ingredients.lineCost') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ing in ingredients" :key="ing.menu_item_ingredient_id">
              <td><strong>{{ ing.item?.item_name || '—' }}</strong></td>
              <td>
                <input type="number" class="sm-input sm inline-edit" :value="ing.quantity" min="0.0001" step="0.1"
                  @change="e => updateQty(ing, e.target.value)" />
              </td>
              <td>{{ ing.unit || ing.item?.unit || '—' }}</td>
              <td>
                <span :class="stockClass(ing)">{{ ing.item?.quantity_in_stock ?? '—' }} {{ ing.item?.unit || '' }}</span>
              </td>
              <td>{{ money((ing.item?.unit_cost || 0) * ing.quantity) }}</td>
              <td>
                <button class="sm-btn ghost xs danger" :title="$t('common.delete')"
                  @click="remove(ing)"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>

        <p v-else class="empty">
          <i class="fas fa-flask" aria-hidden="true"></i>
          {{ $t('cashier.ingredients.noIngredients') }}
        </p>

        <!-- Auto-cost summary -->
        <div v-if="activeItem && ingredients.length" class="cost-summary">
          <strong>{{ $t('cashier.ingredients.costPerUnit') }}:</strong>
          <span class="cost-total">{{ money(autoCost) }}</span>
          <span class="cost-vs">{{ $t('cashier.ingredients.vsPrice') }} {{ money(activeItem.price) }}</span>
        </div>
      </section>
    </div>

    <!-- ═══ Add ingredient modal ═══ -->
    <teleport to="body">
      <transition name="din-pop">
        <div v-if="addModal" class="din-backdrop" @click="addModal = false"></div>
      </transition>
      <transition name="din-pop">
        <div v-if="addModal" class="din-modal">
          <div class="din-modal-head">
            <h3><i class="fas fa-flask"></i> {{ $t('cashier.ingredients.addIngredient') }}</h3>
            <button class="sm-btn ghost sm" @click="addModal = false"><i class="fas fa-xmark"></i></button>
          </div>
          <div class="din-modal-body add-form">
            <label>{{ $t('cashier.ingredients.inventoryItem') }}</label>
            <select v-model="newIng.itemId" class="sm-select full-width">
              <option value="" disabled>{{ $t('cashier.ingredients.pickInventory') }}</option>
              <option v-for="inv in availableInventory" :key="inv.item_id" :value="inv.item_id">
                {{ inv.item_name }} ({{ inv.quantity_in_stock }} {{ inv.unit || 'units' }})
              </option>
            </select>
            <label>{{ $t('cashier.ingredients.qtyPerUnit') }}</label>
            <input v-model.number="newIng.quantity" type="number" class="sm-input full-width" min="0.0001" step="0.1" />
            <label>{{ $t('cashier.ingredients.unit') }} <small>({{ $t('common.optional') }})</small></label>
            <input v-model="newIng.unit" type="text" class="sm-input full-width" :placeholder="$t('cashier.ingredients.unitHint')" />
            <div class="form-actions">
              <button class="sm-btn ghost" @click="addModal = false">{{ $t('common.cancel') }}</button>
              <button class="sm-btn" :disabled="!newIng.itemId || !newIng.quantity || saving" @click="saveAdd">
                <i v-if="saving" class="fas fa-spinner fa-spin"></i> {{ $t('common.save') }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { menuItemApi, cashierApi, menuItemIngredientApi } from '@/api/index.js'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const { t } = useI18n()
const money = (v) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'TZS' }).format(v || 0)

/* ── Menu items ────────────────────────────────────────── */
const menuItems = ref([])
const loadingMenu = ref(true)
const department = ref('')
const menuSearch = ref('')
const collapsed = ref(new Set())
const activeItem = ref(null)

const groupedMenuItems = computed(() => {
  const q = menuSearch.value.trim().toLowerCase()
  const list = q ? menuItems.value.filter(i => i.item_name.toLowerCase().includes(q)) : menuItems.value
  const groups = {}
  for (const item of list) {
    const cat = item.category || 'Uncategorized'
    ;(groups[cat] ||= []).push(item)
  }
  return groups
})

function toggleCat(cat) {
  if (collapsed.value.has(cat)) {
    collapsed.value.delete(cat)
  } else {
    collapsed.value.add(cat)
  }
}

async function loadMenuItems() {
  loadingMenu.value = true
  try {
    const params = { per_page: 100 }
    if (department.value) params.department = department.value
    const { data } = await menuItemApi.index(params)
    menuItems.value = (data.data || data).map(i => ({ ...i, _ingredientCount: 0 }))
    // Load ingredient counts in batch
    for (const item of menuItems.value) {
      try {
        const res = await menuItemIngredientApi.index(item.menu_item_id)
        item._ingredientCount = (res.data.ingredients || []).length
      } catch { /* skip */ }
    }
  } finally {
    loadingMenu.value = false
  }
}

/* ── Ingredients for selected item ─────────────────────── */
const ingredients = ref([])
const loadingIngredients = ref(false)
const inventoryItems = ref([])

async function selectItem(item) {
  activeItem.value = item
  loadingIngredients.value = true
  try {
    const { data } = await menuItemIngredientApi.index(item.menu_item_id)
    ingredients.value = data.ingredients || []
  } catch { ingredients.value = [] }
  loadingIngredients.value = false
}

async function loadInventory() {
  const { data } = await cashierApi.inventoryItems()
  inventoryItems.value = data.items || []
}

const availableInventory = computed(() => {
  const usedIds = new Set(ingredients.value.map(i => i.item_id))
  return inventoryItems.value.filter(i => !usedIds.has(i.item_id))
})

const autoCost = computed(() =>
  ingredients.value.reduce((sum, i) => sum + (i.item?.unit_cost || 0) * i.quantity, 0)
)

function stockClass(ing) {
  const stock = ing.item?.quantity_in_stock ?? 0
  if (stock <= 0) return 'stock-out'
  if (stock <= (ing.item?.reorder_level || 0)) return 'stock-low'
  return 'stock-ok'
}

/* ── Mutations ─────────────────────────────────────────── */
const addModal = ref(false)
const newIng = ref({ itemId: '', quantity: 1, unit: '' })
const saving = ref(false)

function openAdd() {
  newIng.value = { itemId: '', quantity: 1, unit: '' }
  addModal.value = true
}

async function saveAdd() {
  if (!activeItem.value || !newIng.value.itemId || !newIng.value.quantity) return
  saving.value = true
  try {
    await menuItemIngredientApi.store(activeItem.value.menu_item_id, {
      item_id: newIng.value.itemId,
      quantity: newIng.value.quantity,
      unit: newIng.value.unit || null,
    })
    addModal.value = false
    await selectItem(activeItem.value)
    activeItem.value._ingredientCount = ingredients.value.length
  } finally { saving.value = false }
}

async function updateQty(ing, val) {
  const qty = parseFloat(val)
  if (!qty || qty <= 0) return
  await menuItemIngredientApi.update(activeItem.value.menu_item_id, ing.menu_item_ingredient_id, { quantity: qty })
  await selectItem(activeItem.value)
}

async function remove(ing) {
  if (!confirm(t('common.confirmDelete'))) return
  await menuItemIngredientApi.destroy(activeItem.value.menu_item_id, ing.menu_item_ingredient_id)
  await selectItem(activeItem.value)
  activeItem.value._ingredientCount = ingredients.value.length
}

onMounted(() => {
  loadMenuItems()
  loadInventory()
})
</script>

<style scoped>
.ing-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; border-radius: 999px;
  background: var(--mrk-blue); color: #fff;
  font-size: 10px; font-weight: 700; margin-left: 4px; padding: 0 4px;
}
.inline-edit { width: 70px; text-align: center; }
.stock-out { color: #dc2626; font-weight: 700; }
.stock-low { color: #d97706; font-weight: 600; }
.stock-ok { color: #16a34a; }
.cost-summary {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; margin-top: 8px;
  background: var(--mrk-blue-pale); border-radius: 10px;
  font-size: 14px;
}
.cost-total { font-weight: 700; color: var(--mrk-blue); font-size: 18px; }
.cost-vs { color: #64748b; font-size: 12px; margin-left: auto; }
.empty-wrap { display: flex; flex-direction: column; align-items: center; padding: 40px; gap: 12px; color: #94a3b8; }
.empty-icon { font-size: 32px; }
.add-form { display: flex; flex-direction: column; gap: 10px; }
.add-form label { font-weight: 600; font-size: 13px; color: var(--mrk-charcoal); }
.add-form small { font-weight: 400; color: #94a3b8; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
</style>
