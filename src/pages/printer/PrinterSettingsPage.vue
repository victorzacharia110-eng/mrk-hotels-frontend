<!--
  PrinterSettingsPage — the till printer connection for direct thermal printing.

  Uses the Web Serial API: the hotel picks the USB/serial ESC/POS printer once
  per device, the app keeps the connection and writes receipts straight to it
  (no drivers, no server). When the browser can't reach the printer directly
  (e.g. Safari/Firefox or a phone), the receipt falls back to the browser print
  dialog, so this page also lets staff test the connection.
-->

<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1><i class="fas fa-print"></i> {{ $t('printer.title') }}</h1>
        <p class="muted">{{ $t('printer.subtitle') }}</p>
      </div>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <section class="panel">
      <div class="status-row">
        <span class="status-dot" :class="supported && printerState.connected ? 'ok' : (supported ? 'off' : 'na')"></span>
        <div>
          <strong>{{ statusTitle }}</strong>
          <p class="muted">{{ statusDetail }}</p>
        </div>
      </div>

      <p v-if="!supported" class="notice">
        <i class="fas fa-circle-info"></i> {{ $t('printer.unsupported') }}
      </p>
      <p v-else-if="printerState.reason" class="notice">
        <i class="fas fa-triangle-exclamation"></i> {{ printerState.reason }}
      </p>

      <div class="actions">
        <button v-if="!printerState.connected" class="btn btn-primary" @click="connect">
          <i class="fas fa-plug"></i> {{ $t('printer.connect') }}
        </button>
        <template v-else>
          <button class="btn btn-secondary" :disabled="testing" @click="test">
            <i class="fas fa-file-lines"></i> {{ testing ? $t('common.saving') : $t('printer.test') }}
          </button>
          <button class="btn btn-danger" @click="disconnect">
            <i class="fas fa-plug-circle-xmark"></i> {{ $t('printer.disconnect') }}
          </button>
        </template>
      </div>

      <div class="hints">
        <p><strong>{{ $t('printer.howTitle') }}</strong></p>
        <ol>
          <li>{{ $t('printer.how1') }}</li>
          <li>{{ $t('printer.how2') }}</li>
          <li>{{ $t('printer.how3') }}</li>
        </ol>
        <p class="muted">{{ $t('printer.how4') }}</p>
      </div>
    </section>

    <section class="panel">
      <h2>{{ $t('printer.whenTitle') }}</h2>
      <p class="muted">{{ $t('printer.whenHint') }}</p>

      <label v-for="toggle in toggles" :key="toggle.key" class="toggle">
        <input
          type="checkbox"
          :checked="settings[toggle.key]"
          @change="setFlag(toggle.key, $event.target.checked)"
        />
        <span>
          <strong>{{ $t(toggle.label) }}</strong>
          <span class="muted block">{{ $t(toggle.hint) }}</span>
        </span>
      </label>
    </section>

    <section class="panel">
      <h2>{{ $t('printer.ticketTitle') }}</h2>
      <p class="muted">{{ $t('printer.ticketHint') }}</p>

      <div v-if="!ticketPrinters.length" class="notice">
        <i class="fas fa-circle-info"></i> {{ $t('printer.noTicketPrinters') }}
      </div>

      <table v-else class="route-table">
        <thead>
          <tr>
            <th>{{ $t('printer.serviceLine') }}</th>
            <th>{{ $t('printer.ticketPrinter') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in serviceLines" :key="line">
            <td>{{ line }}</td>
            <td>
              <select
                class="form-control"
                :value="routingFor(line)"
                @change="setRoute(line, $event.target.value)"
              >
                <option value="">{{ $t('printer.useDefault') }}</option>
                <option v-for="p in ticketPrinters" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="add-row">
        <input
          v-model="newPrinter.name"
          class="form-control"
          :placeholder="$t('printer.printerName')"
        />
        <select v-model="newPrinter.transport" class="form-control">
          <option value="serial">{{ $t('printer.thisMachine') }}</option>
          <option value="network">{{ $t('printer.networkBridge') }}</option>
        </select>
        <input
          v-if="newPrinter.transport === 'network'"
          v-model="newPrinter.endpoint"
          class="form-control"
          placeholder="http://100.x.y.z:9720"
        />
        <button class="btn btn-primary" :disabled="!newPrinter.name" @click="addPrinter">
          <i class="fas fa-plus"></i> {{ $t('common.add') }}
        </button>
      </div>

      <ul v-if="ticketPrinters.length" class="printer-list">
        <li v-for="p in ticketPrinters" :key="p.id">
          <span>
            <strong>{{ p.name }}</strong>
            <span class="muted"> — {{ p.transport === 'network' ? p.endpoint : $t('printer.thisMachine') }}</span>
          </span>
          <button class="btn btn-danger btn-sm" @click="removeTicketPrinter(p.id)">
            <i class="fas fa-trash"></i>
          </button>
        </li>
      </ul>

      <label class="toggle default-row">
        <span>
          <strong>{{ $t('printer.defaultTicketPrinter') }}</strong>
          <span class="muted block">{{ $t('printer.defaultTicketPrinterHint') }}</span>
        </span>
        <select
          class="form-control"
          :value="defaultTicketPrinterId"
          @change="setDefault($event.target.value)"
        >
          <option value="">{{ $t('printer.tillPrinter') }}</option>
          <option v-for="p in ticketPrinters" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { printerState, printerSupported, connectPrinter, disconnectPrinter, restorePrinter, printToPrinter } from '@/utils/printer'
import { testPrintLines } from '@/utils/receipts'
import { usePrintSettingsStore } from '@/stores/printSettings'
import { menuCategoryApi } from '@/api'

const {
  settings,
  ticketPrinters,
  departmentRouting,
  defaultTicketPrinterId,
  saveSettings,
  addTicketPrinter,
  removeTicketPrinter,
} = usePrintSettingsStore()

// Service lines used to be a fixed restaurant/bar pair; `department` is now
// free text, so the list is read from the service lines the hotel's own menu
// categories are filed under. These are exactly the values an order carries,
// which is what the routing keys are matched against.
const serviceLines = ref(['restaurant', 'bar'])
async function loadServiceLines() {
  try {
    const res = await menuCategoryApi.index()
    const categories = res.data?.data || []
    const lines = [...new Set(categories.map((c) => String(c.department || '').trim()).filter(Boolean))]
    // A line already routed to a printer stays listed even if its last category
    // was removed, so a configured route cannot vanish out of the UI.
    const routed = Object.keys(departmentRouting || {})
    if (lines.length) serviceLines.value = [...new Set([...lines, ...routed])]
  } catch {
    /* keep the defaults; the page still works with the two original lines */
  }
}
const newPrinter = ref({ name: '', transport: 'serial', endpoint: '' })

const toggles = [
  { key: 'printOnSave', label: 'printer.printOnSave', hint: 'printer.printOnSaveHint' },
  { key: 'printGuestCheckWhenUnsettled', label: 'printer.printGuestCheckWhenUnsettled', hint: 'printer.printGuestCheckWhenUnsettledHint' },
  { key: 'printOnSettle', label: 'printer.printOnSettle', hint: 'printer.printOnSettleHint' },
  { key: 'printOnVoid', label: 'printer.printOnVoid', hint: 'printer.printOnVoidHint' },
  { key: 'printFoodTicketOnOrder', label: 'printer.printFoodTicketOnOrder', hint: 'printer.printFoodTicketOnOrderHint' },
  { key: 'printFoodTicketOnItemAdded', label: 'printer.printFoodTicketOnItemAdded', hint: 'printer.printFoodTicketOnItemAddedHint' },
]

function setFlag(key, value) {
  saveSettings({ [key]: value })
}

function routingFor(line) {
  return departmentRouting[line] || ''
}

function setRoute(line, printerId) {
  saveSettings({ departmentRouting: { ...departmentRouting, [line]: printerId } })
}

function setDefault(printerId) {
  saveSettings({ defaultTicketPrinterId: printerId })
}

function addPrinter() {
  addTicketPrinter({
    name: newPrinter.value.name.trim(),
    transport: newPrinter.value.transport,
    endpoint: newPrinter.value.transport === 'network' ? newPrinter.value.endpoint.trim() : '',
  })
  newPrinter.value = { name: '', transport: 'serial', endpoint: '' }
}

const { t } = useI18n()

const supported = computed(() => printerSupported())
const error = ref('')
const testing = ref(false)

const statusTitle = computed(() => {
  if (!supported.value) return t('printer.statusUnsupported')
  if (printerState.connected) return t('printer.statusConnected')
  return t('printer.statusNotConnected')
})

const statusDetail = computed(() => {
  if (!supported.value) return t('printer.statusUnsupportedDetail')
  if (printerState.connected) return printerState.info || t('printer.statusConnectedDetail')
  return t('printer.statusNotConnectedDetail')
})

async function connect() {
  error.value = ''
  const ok = await connectPrinter()
  if (!ok && !printerState.connected) {
    error.value = printerState.reason || t('printer.connectFailed')
  } else {
    error.value = printerState.reason || t('printer.readyToTest')
  }
}

async function disconnect() {
  await disconnectPrinter()
  error.value = ''
}

async function test() {
  error.value = ''
  testing.value = true
  try {
    const sent = await printToPrinter(testPrintLines())
    if (!sent) error.value = printerState.reason || t('printer.testFailed')
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  restorePrinter()
  loadServiceLines()
})
</script>

<style scoped>
.dashboard-page { padding: 32px 20px; }

.page-head h1 { font-size: 26px; font-weight: 800; display: flex; align-items: center; gap: 10px; margin: 0; }
.page-head h1 i { color: #005eb8; }
.muted { color: #757575; font-size: 13px; margin-top: 2px; }

.status-row { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.status-dot { width: 14px; height: 14px; border-radius: 50%; flex: none; }
.status-dot.ok { background: #22c55e; box-shadow: 0 0 0 4px rgba(34,197,94,.15); }
.status-dot.off { background: #f59e0b; box-shadow: 0 0 0 4px rgba(245,158,11,.15); }
.status-dot.na { background: #9ca3af; box-shadow: 0 0 0 4px rgba(156,163,175,.15); }

.notice { display: flex; align-items: center; gap: 8px; background: #fff8e1; color: #8a6d1a; padding: 10px 14px; border-radius: 6px; margin: 8px 0 16px; }

.actions { display: flex; gap: 10px; margin: 8px 0 20px; }

.hints { border-top: 1px solid #ececec; padding-top: 14px; }
.hints ol { margin: 8px 0 10px; padding-left: 20px; line-height: 1.7; font-size: 14px; }

.panel { margin-top: 20px; }
.panel h2 { font-size: 17px; font-weight: 700; margin: 0 0 4px; }
.block { display: block; }

.toggle { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; cursor: pointer; }
.toggle:last-child { border-bottom: 0; }
.default-row { justify-content: space-between; align-items: center; margin-top: 14px; }
.default-row .form-control { max-width: 260px; }

.route-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
.route-table th, .route-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }

.add-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.add-row .form-control { flex: 1 1 160px; }

.printer-list { list-style: none; padding: 0; margin: 14px 0 0; }
.printer-list li { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
</style>