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
        </div>
        <div class="tree-body">
          <input v-model="menuSearch" type="search" class="sm-input full-width"
            :placeholder="$t('cashier.lookup.searchCategory')" />
          <SkeletonLoader v-if="loadingMenu" variant="tree" :count="9" />
          <div v-else class="cat-tree">
            <div v-for="cat in groupedMenuItems" :key="cat.name" class="cat-group">
              <button class="cat-toggle" @click="toggleCat(cat)">
                <i :class="isCatOpen(cat) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'" aria-hidden="true"></i>
                {{ cat.name }}
                <span class="cat-count">{{ cat.count }}</span>
              </button>
              <div class="cat-kids" :class="{ open: isCatOpen(cat) }">
                <div class="cat-kids-inner">
                  <div v-for="sub in cat.subcategories" :key="subKey(cat, sub)" class="sub-group">
                    <button class="sub-toggle" @click="toggleSub(cat, sub)">
                      <i :class="isSubOpen(cat, sub) ? 'fas fa-chevron-down' : 'fas fa-chevron-right'"
                        aria-hidden="true"></i>
                      {{ sub.name }}
                      <span class="cat-count">{{ sub.items.length }}</span>
                    </button>
                    <div class="cat-kids sub-kids" :class="{ open: isSubOpen(cat, sub) }">
                      <div class="cat-kids-inner sub-kids-inner">
                        <button v-for="item in sub.items" :key="item.menu_item_id" class="cat-leaf"
                          :class="{ active: activeItemId === item.menu_item_id }" @click="selectItem(item)">
                          {{ item.item_name }}
                          <span v-if="item._ingredientCount > 0" class="ing-badge">{{ item._ingredientCount }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
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
                <input type="number" class="sm-input sm inline-edit" :value="Number(ing.quantity).toFixed(2)" min="0.01" step="0.01"
                  @change="e => updateQty(ing, e.target.value)" />
              </td>
              <td>{{ ing.unit || ing.item?.unit || '—' }}</td>
              <td>
                <span :class="stockClass(ing)">{{ ing.item?.quantity_in_stock ?? '—' }} {{ ing.item?.unit || '' }}</span>
              </td>
              <td>{{ money((ing.item?.unit_cost || 0) * ing.quantity) }}</td>
              <td>
                <button class="sm-btn ghost xs danger" :title="$t('common.delete')"
                  @click="askRemove(ing)"><i class="fas fa-trash"></i></button>
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
            <SearchableSelect v-model="newIng.itemId" :options="inventoryOptions"
              :placeholder="$t('cashier.ingredients.pickInventory')" :force-search="true"
              @change="onInventoryPick" />
            <label>{{ $t('cashier.ingredients.qtyPerUnit') }}</label>
            <input v-model.number="newIng.quantity" type="number" class="sm-input full-width" min="0.01" step="0.01" />
            <label>{{ $t('cashier.ingredients.siUnit') }}</label>
            <input v-model="newIng.unit" type="text" class="sm-input full-width" readonly
              :placeholder="$t('cashier.ingredients.siUnitHint')" />
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

    <ConfirmModal :show="showRemoveConfirm" :title="$t('cashier.ingredients.removeConfirmTitle')"
      :body="$t('cashier.ingredients.removeConfirmMessage', {
        name: removeTarget?.item?.item_name || '—',
        item: activeItem?.item_name || '—',
      })" :error="removeError" danger :busy="removing" :confirm-label="$t('common.delete')"
      @confirm="confirmRemove" @cancel="showRemoveConfirm = false" />
  </div>
</template>

<script setup>

import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { menuItemApi, cashierApi, menuItemIngredientApi } from '@/api/index.js'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import SearchableSelect from '@/components/SearchableSelect.vue'
import { useTenantCurrency } from '@/utils/currency'

const { curCode } = useTenantCurrency()

const { t } = useI18n()
const money = (v) =>
  `${curCode()} ${new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(Number(v) || 0)}`

/* ── Menu items ────────────────────────────────────────── */
const menuItems = ref([])
const loadingMenu = ref(true)
const menuSearch = ref('')
const openCat = ref('')
const openSub = ref('')
const activeItem = ref(null)

// Menu items are grouped CATEGORY -> SUB CATEGORY -> items. The sub-category is
// the registered second level, so the tree never jumps straight from a service
// line to a long list of dishes. Older rows without a sub-category fall back to
// an "Uncategorized" group instead of being hidden.
const groupedMenuItems = computed(() => {
  const q = menuSearch.value.trim().toLowerCase()
  const list = q ? menuItems.value.filter(i => i.item_name.toLowerCase().includes(q)) : menuItems.value
  const categories = new Map()
  for (const item of list) {
    const catName = item.category || 'Uncategorized'
    const subName = item.sub_category || 'Uncategorized'
    // Group by the registered IDs, not just names: the same category name can
    // exist on the restaurant and bar menus, and those must stay separate.
    const catId = item.category_id || catName
    const subId = item.sub_category_id || subName
    if (!categories.has(catId)) {
      categories.set(catId, {
        id: catId,
        name: catName,
        order: Number(item.category_order || 0),
        subcategories: new Map(),
      })
    }
    const cat = categories.get(catId)
    if (!cat.subcategories.has(subId)) {
      cat.subcategories.set(subId, {
        id: subId,
        name: subName,
        order: Number(item.sub_category_order || 0),
        items: [],
      })
    }
    cat.subcategories.get(subId).items.push(item)
  }
  return [...categories.values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((cat) => {
      const subcategories = [...cat.subcategories.values()]
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
        .map((sub) => ({
          ...sub,
          items: sub.items.sort((a, b) => a.item_name.localeCompare(b.item_name)),
        }))
      return {
        ...cat,
        subcategories,
        count: subcategories.reduce((total, sub) => total + sub.items.length, 0),
      }
    })
})

const subKey = (cat, sub) => `${cat.id}::${sub.id}`

const isCatOpen = (cat) => Boolean(menuSearch.value.trim()) || openCat.value === cat.id
const isSubOpen = (cat, sub) => Boolean(menuSearch.value.trim()) || openSub.value === subKey(cat, sub)

// Categories are exclusive: opening one smoothly closes the others and opens
// its first sub-category, so the tree reads top-to-bottom without an extra tap.
function toggleCat(cat) {
  const opening = openCat.value !== cat.id
  openCat.value = opening ? cat.id : ''
  openSub.value = opening && cat.subcategories.length ? subKey(cat, cat.subcategories[0]) : ''
}

// Sub-categories are exclusive too; the open one is the group whose items show.
function toggleSub(cat, sub) {
  const key = subKey(cat, sub)
  openSub.value = openSub.value === key ? '' : key
}

async function loadMenuItems() {
  loadingMenu.value = true
  try {
    // The API caps a page at 100 rows, so walk every page instead of asking for
    // a size it rejects. The tree must contain the whole menu, not just page 1.
    const { data } = await menuItemApi.index({ per_page: 100 })
    const rows = [...(data.data || data)]
    const lastPage = Number(data.meta?.last_page || 1)
    if (lastPage > 1) {
      const pages = await Promise.all(
        Array.from({ length: lastPage - 1 }, (_, index) =>
          menuItemApi.index({ per_page: 100, page: index + 2 }).then((response) => response.data.data || response.data),
        ),
      )
      pages.forEach((pageRows) => rows.push(...pageRows))
    }
    // Backend ships the ingredient line count per item, so the tree renders
    // badges without one extra request per menu item.
    menuItems.value = rows.map(i => ({ ...i, _ingredientCount: i.ingredient_count ?? 0 }))
    // Default to the first category and its first sub-category open.
    if (!openCat.value) {
      const first = groupedMenuItems.value[0]
      if (first) {
        openCat.value = first.id
        openSub.value = first.subcategories.length ? subKey(first, first.subcategories[0]) : ''
      }
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

// The add-ingredient picker lists the whole inventory (searchable), not just
// the items that have not been linked yet.
const inventoryOptions = computed(() =>
  inventoryItems.value.map((inv) => ({
    value: inv.item_id,
    label: inv.item_name,
  })),
)

function onInventoryPick(option) {
  const inv = inventoryItems.value.find((i) => String(i.item_id) === String(option?.value ?? newIng.value.itemId))
  newIng.value.unit = inv?.si_unit || inv?.unit || ''
}

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

const showRemoveConfirm = ref(false)
const removeTarget = ref(null)
const removing = ref(false)
const removeError = ref('')

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

function askRemove(ing) {
  removeError.value = ''
  removeTarget.value = ing
  showRemoveConfirm.value = true
}

async function confirmRemove() {
  const ing = removeTarget.value
  if (!ing || !activeItem.value) return
  removing.value = true
  removeError.value = ''
  try {
    await menuItemIngredientApi.destroy(activeItem.value.menu_item_id, ing.menu_item_ingredient_id)
    showRemoveConfirm.value = false
    removeTarget.value = null
    await selectItem(activeItem.value)
    activeItem.value._ingredientCount = ingredients.value.length
  } catch (err) {
    removeError.value = err.response?.data?.message || t('common.actionFailed')
  } finally {
    removing.value = false
  }
}

onMounted(() => {
  loadMenuItems()
  loadInventory()
})
</script>

<style scoped>
.lookup-layout {
  height: calc(100vh - 112px);
  align-items: stretch;
}
.panel { display: flex; flex-direction: column; min-height: 0; }
.tree-body {
  flex: 1 1 auto; min-height: 0;
  padding: 12px;
  display: flex; flex-direction: column; gap: 10px;
  overflow-y: auto;
}
.table-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.cost-summary { flex-shrink: 0; }
@media (max-width: 1000px) {
  .lookup-layout { height: auto; }
  .tree-body, .table-scroll { overflow-y: visible; }
}
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

/* ── Add ingredient modal shell (mirrors the dine-in modal) ──── */
.din-backdrop {
  position: fixed;
  inset: 0;
  z-index: 88;
  background: rgba(33, 33, 33, 0.35);
}
.din-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 90;
  width: min(560px, 92vw);
  max-height: 80vh;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 14px 44px rgba(6, 42, 82, 0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.din-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #e5e7eb;
}
.din-modal-head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  color: #1e293b;
}
.din-modal-body { padding: 14px 18px 18px; overflow-y: auto; }
.din-pop-enter-active, .din-pop-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.din-pop-enter-from, .din-pop-leave-to { opacity: 0; transform: translateY(12px); }
</style>
