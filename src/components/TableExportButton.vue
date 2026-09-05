<!--
  TableExportButton — dropdown button that exports table data as CSV, Excel
  or PDF entirely client-side.

  Props:
    filename  - base file name (without extension) for the downloaded file.
    columns   - [{ key, label }] column map controlling order + headers.
    rows      - the current rows (already loaded). For server-paginated lists
                leave this empty and pass `load-all` to fetch every page.
    load-all  - async () => rows, used to pull the full dataset for
                server-paginated tables before exporting.
    title     - optional heading printed on the PDF.

  Emits: `exported` after a successful download.
-->
<template>
  <div class="export-wrap">
    <button
      ref="trigger"
      type="button"
      class="btn btn-secondary btn-sm"
      :disabled="busy"
      :aria-expanded="open"
      aria-haspopup="menu"
      aria-controls="export-menu"
      @click="toggleMenu"
    >
      <i class="fas fa-file-export" aria-hidden="true" />
      <span v-if="busy"
        ><i class="fas fa-spinner fa-spin" aria-hidden="true" /> {{ busyLabel }}</span
      >
      <span v-else>{{ $t('common.export') }}</span>
    </button>

    <div
      v-if="open"
      id="export-menu"
      class="export-menu"
      role="menu"
      :aria-label="$t('common.export')"
      @keydown.esc="open = false; trigger?.focus()"
      @keydown.down.prevent="moveFocus(1)"
      @keydown.up.prevent="moveFocus(-1)"
    >
      <button type="button" role="menuitem" :disabled="busy" @click="doExport('csv')">
        <i class="fas fa-file-csv" aria-hidden="true" /> CSV
      </button>
      <button type="button" role="menuitem" :disabled="busy" @click="doExport('xlsx')">
        <i class="fas fa-file-excel" aria-hidden="true" /> Excel
      </button>
      <button type="button" role="menuitem" :disabled="busy" @click="doExport('pdf')">
        <i class="fas fa-file-pdf" aria-hidden="true" /> PDF
      </button>
    </div>

    <div v-if="error" class="export-error" role="alert">{{ error }}</div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { hotelSettingsApi } from '@/api'
import { exportCSV, exportExcel, exportPDF } from '@/utils/export'

const props = defineProps({
  filename: { type: String, required: true },
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  loadAll: { type: Function, default: null },
  title: { type: String, default: '' },
})

const emit = defineEmits(['exported'])

const { t } = useI18n()

// Dropdown + export state.
const open = ref(false)
const busy = ref(false)
const busyLabel = ref('')
const error = ref('')
const trigger = ref(null)

// Official hotel details printed above the exported table (fetched once).
let officialHeader = null
let headerPromise = null
async function getOfficialHeader() {
  if (officialHeader) return officialHeader
  if (headerPromise) return headerPromise
  headerPromise = hotelSettingsApi
    .show()
    .then((res) => {
      const h = res.data?.hotel || res.data?.data || {}
      officialHeader = {
        name: h.hotel_name || '',
        address: h.address || '',
        city: h.city || '',
        country: h.country || '',
        phone: h.phone || '',
        email: h.email || '',
        tin: h.tin || '',
        vrn: h.vrn || '',
      }
      return officialHeader
    })
    .catch(() => {
      officialHeader = {}
      return officialHeader
    })
  return headerPromise
}

/**
 * Toggles the menu and moves focus to the first item on open so keyboard
 * users can operate it with arrow keys.
 */
async function toggleMenu() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    const items = document.querySelectorAll('#export-menu [role="menuitem"]')
    if (items.length) items[0].focus()
  }
}

/**
 * Runs the selected export: resolves the full row set (calling `loadAll`
 * when the page is server-paginated) and hands it to the matching exporter.
 * @param {string} kind - "csv", "xlsx" or "pdf".
 */
async function doExport(kind) {
  open.value = false
  error.value = ''
  busy.value = true
  busyLabel.value = kind.toUpperCase()
  try {
    const data = props.loadAll ? await props.loadAll() : props.rows
    if (!data?.length) {
      error.value = t('common.noData')
      return
    }
    if (kind === 'csv') exportCSV(props.filename, data, props.columns, { header: await getOfficialHeader(), title: props.title })
    else if (kind === 'xlsx') exportExcel(props.filename, data, props.columns, 'Data', { header: await getOfficialHeader(), title: props.title })
    else exportPDF(props.filename, data, props.columns, props.title, { header: await getOfficialHeader() })
    emit('exported', kind)
  } catch (err) {
    error.value = err.response?.data?.message || err.message || t('common.actionFailed')
  } finally {
    busy.value = false
  }
}

/**
 * Moves focus between the menu items with the arrow keys.
 * @param {number} dir - +1 for ArrowDown, -1 for ArrowUp.
 */
function moveFocus(dir) {
  const items = Array.from(
    document.querySelectorAll('#export-menu [role="menuitem"]:not(:disabled)'),
  )
  if (!items.length) return
  const current = items.findIndex((el) => el === document.activeElement)
  const next = current === -1 ? 0 : (current + dir + items.length) % items.length
  items[next].focus()
}

/** Closes the dropdown when a click lands outside the component. */
function onDocumentClick(event) {
  if (open.value && !event.target.closest('.export-wrap')) {
    open.value = false
  }
}

watch(open, (value) => {
  if (value) error.value = ''
})

onMounted(() => document.addEventListener('mousedown', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentClick))
</script>

<style scoped>
.export-wrap {
  position: relative;
  display: inline-block;
}

.export-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 50;
  min-width: 140px;
  padding: 6px;
  background: #fff;
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.export-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: none;
  font: inherit;
  font-size: 14px;
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
}

.export-menu button:hover {
  background: #f2f6fa;
}

.export-menu button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-menu .fa-file-csv {
  color: #2e9e44;
}

.export-menu .fa-file-excel {
  color: #1d6f42;
}

.export-menu .fa-file-pdf {
  color: #d64545;
}

.export-error {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 50;
  padding: 8px 12px;
  background: #fdecea;
  color: #c0392b;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
}
</style>
