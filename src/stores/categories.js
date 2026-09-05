import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { inventoryOpsApi } from '@/api'
import { formatCategory } from '@/utils/format'

/**
 * Backend-truth category vocabularies. The server owns these lists
 * (config/categories.php seeded into each tenant's `categories` table) —
 * this file only seeds an offline fallback so forms still render before a
 * successful fetch. /api/v1/categories returns the tenant's rows under
 * `data.categories` (group/value/label/...) plus the issue vocab, and
 * overrides the seeded values on load, so the server is the single source of
 * truth everywhere.
 */
const FALLBACK = {
  inventory: ['food', 'beverage', 'bar', 'restaurant', 'housekeeping', 'maintenance', 'procurement', 'other'],
  supplier: ['food_beverage', 'housekeeping', 'maintenance', 'office_supplies', 'furniture', 'technology', 'other'],
  expense: ['supplies', 'maintenance', 'utilities', 'marketing', 'other'],
  issue: ['billing', 'reservation', 'housekeeping', 'food_beverage', 'inventory', 'facility', 'it_system', 'other'],
}

/** i18n keys for each built-in category code — labels are defined once, used everywhere. */
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
  expense: {
    supplies: 'storeManager.expenses.cats.supplies',
    maintenance: 'storeManager.expenses.cats.maintenance',
    utilities: 'storeManager.expenses.cats.utilities',
    marketing: 'storeManager.expenses.cats.marketing',
    other: 'storeManager.expenses.cats.other',
  },
}

const DEFAULT_GROUPS = ['inventory', 'supplier', 'expense']

export const useCategoriesStore = defineStore('categories', () => {
  const { t } = useI18n()

  const inventory = ref([...FALLBACK.inventory])
  const supplier = ref([...FALLBACK.supplier])
  const expense = ref([...FALLBACK.expense])
  const issue = ref([...FALLBACK.issue])
  /** Server-provided labels (value -> label) for codes without a translation. */
  const serverLabels = ref({})
  const loading = ref(false)
  const loaded = ref(false)

  /** Applies a group's catalog rows: value order + server labels. */
  function applyRows(group, rows) {
    const values = (rows || []).map((row) => row && row.value ? row.value : row).filter(Boolean)
    if (!values.length) return
    const groupRef = { inventory, supplier, expense }[group]
    if (groupRef) groupRef.value = values
    serverLabels.value[group] = Object.fromEntries((rows || []).map((row) => [row.value, row.label]))
  }

  /**
   * Resolves a category code to its label: the built-in translation wins
   * (server labels are English fallbacks), then the server's stored label,
   * then a pretty-format of the raw code.
   */
  function localizedLabel(code, keys, group) {
    if (keys && keys[code]) return t(keys[code])
    const serverLabel = serverLabels.value[group]?.[code]
    return serverLabel || formatCategory(code)
  }

  const inventoryCategoryOptions = computed(() =>
    inventory.value.map((code) => ({ value: code, label: localizedLabel(code, LABEL_KEYS.inventory, 'inventory') })),
  )

  const supplierCategoryOptions = computed(() =>
    supplier.value.map((code) => ({ value: code, label: localizedLabel(code, LABEL_KEYS.supplier, 'supplier') })),
  )

  const expenseCategoryOptions = computed(() =>
    expense.value.map((code) => ({ value: code, label: localizedLabel(code, LABEL_KEYS.expense, 'expense') })),
  )

  const issueCategoryOptions = computed(() =>
    issue.value.map((code) => ({ value: code, label: localizedLabel(code, LABEL_KEYS.issue, 'issue') })),
  )

  /** Fetches the server catalog once; failures keep the seeded fallbacks. */
  async function ensureLoaded() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const { data } = await inventoryOpsApi.categories()
      const catalog = data.data || {}
      const rows = catalog.categories || []
      if (Array.isArray(rows)) {
        const byGroup = {}
        for (const row of rows) byGroup[row.group] = byGroup[row.group] || []
        for (const row of rows) byGroup[row.group].push(row)
        for (const group of DEFAULT_GROUPS) applyRows(group, byGroup[group] || [])
      }
      if (Array.isArray(catalog.issue) && catalog.issue.length) issue.value = catalog.issue
      loaded.value = true
    } catch {
      // Keep the seeded fallbacks so every dropdown still renders.
    } finally {
      loading.value = false
    }
  }

  /** Force-refetches the catalog (used after a manager edits categories). */
  async function reload() {
    loaded.value = false
    loading.value = false
    await ensureLoaded()
  }

  return {
    inventory,
    supplier,
    expense,
    issue,
    serverLabels,
    loading,
    loaded,
    inventoryCategoryOptions,
    supplierCategoryOptions,
    expenseCategoryOptions,
    issueCategoryOptions,
    ensureLoaded,
    reload,
  }
})