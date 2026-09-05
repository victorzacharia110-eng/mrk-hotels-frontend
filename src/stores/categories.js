import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryOpsApi } from '@/api'
import { formatCategory } from '@/utils/format'

/**
 * Backend-truth category vocabularies. The server (config/categories.php)
 * owns these lists — this file only seeds an offline fallback so forms still
 * render before/without a successful fetch; /api/v1/categories overwrites
 * them on load, so the server is the single source of truth.
 */
const FALLBACK = {
  inventory: ['food', 'beverage', 'bar', 'restaurant', 'housekeeping', 'maintenance', 'procurement', 'other'],
  supplier: ['food_beverage', 'housekeeping', 'maintenance', 'office_supplies', 'furniture', 'technology', 'other'],
  expense: ['supplies', 'maintenance', 'utilities', 'marketing', 'other'],
  issue: ['billing', 'reservation', 'housekeeping', 'food_beverage', 'inventory', 'facility', 'it_system', 'other'],
}

/** i18n keys for each category code — labels are defined once, used everywhere. */
const LABEL_KEYS = {
  inventory: {
    food: 'inventory.categoryFood',
    beverage: 'inventory.categoryBeverage',
    bar: 'inventory.categoryBar',
    restaurant: 'inventory.categoryRestaurant',
    housekeeping: 'inventory.categoryHousekeeping',
    maintenance: 'inventory.categoryMaintenance',
    procurement: 'inventory.categoryProcurement',
    other: 'inventory.categoryOther',
  },
  supplier: {
    food_beverage: 'suppliers.categoryFnb',
    housekeeping: 'suppliers.categoryHousekeeping',
    maintenance: 'suppliers.categoryMaintenance',
    office_supplies: 'suppliers.categoryOffice',
    furniture: 'suppliers.categoryFurniture',
    technology: 'suppliers.categoryTechnology',
    other: 'suppliers.categoryOther',
  },
  issue: {
    billing: 'issueReports.categoryBilling',
    reservation: 'issueReports.categoryReservation',
    housekeeping: 'issueReports.categoryHousekeeping',
    food_beverage: 'issueReports.categoryFoodBeverage',
    inventory: 'issueReports.categoryInventory',
    facility: 'issueReports.categoryFacility',
    it_system: 'issueReports.categoryItSystem',
    other: 'issueReports.categoryOther',
  },
}

export const useCategoriesStore = defineStore('categories', () => {
  const { t } = useI18n()

  const inventory = ref([...FALLBACK.inventory])
  const supplier = ref([...FALLBACK.supplier])
  const expense = ref([...FALLBACK.expense])
  const issue = ref([...FALLBACK.issue])
  const loading = ref(false)
  const loaded = ref(false)

  /** Resolves a category code to its shared label, pretty-formatting any unknown code. */
  function localizedLabel(code, keys) {
    const key = keys[code]
    return key ? t(key) : formatCategory(code)
  }

  const inventoryCategoryOptions = computed(() =>
    inventory.value.map((code) => ({ value: code, label: localizedLabel(code, LABEL_KEYS.inventory) })),
  )

  const supplierCategoryOptions = computed(() =>
    supplier.value.map((code) => ({ value: code, label: localizedLabel(code, LABEL_KEYS.supplier) })),
  )

  const expenseCategoryOptions = computed(() =>
    expense.value.map((code) => ({ value: code, label: t(`storeManager.expenses.cats.${code}`) })),
  )

  const issueCategoryOptions = computed(() =>
    issue.value.map((code) => ({ value: code, label: localizedLabel(code, LABEL_KEYS.issue) })),
  )

  /** Fetches the server catalog once; failures keep the seeded fallbacks. */
  async function ensureLoaded() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const { data } = await inventoryOpsApi.categories()
      const catalog = data.data || {}
      if (Array.isArray(catalog.inventory) && catalog.inventory.length) inventory.value = catalog.inventory
      if (Array.isArray(catalog.supplier) && catalog.supplier.length) supplier.value = catalog.supplier
      if (Array.isArray(catalog.expense) && catalog.expense.length) expense.value = catalog.expense
      if (Array.isArray(catalog.issue) && catalog.issue.length) issue.value = catalog.issue
      loaded.value = true
    } catch {
      // Keep the seeded fallbacks so every dropdown still renders.
    } finally {
      loading.value = false
    }
  }

  return {
    inventory,
    supplier,
    expense,
    issue,
    loading,
    loaded,
    inventoryCategoryOptions,
    supplierCategoryOptions,
    expenseCategoryOptions,
    issueCategoryOptions,
    ensureLoaded,
  }
})