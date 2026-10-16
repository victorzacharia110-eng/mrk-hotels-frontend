<!--
  CashierPrintSettingsPage — the till printer and "Cloud Print Settings" in
  the cashier panel.

  Mirrors the print-on-event toggles common to POS systems (the client uses
  E-Zee): decide WHEN a receipt or guest check should print. The printer itself
  is reached through QZ Tray, the free cross-platform helper that lets a web
  page drive a thermal printer over USB, Serial or a network socket.
-->

<template>
  <div class="dashboard-page container">
    <div class="page-head">
      <div>
        <h1><i class="fas fa-print"></i> {{ $t('cashier.printSettings.title') }}</h1>
        <p class="muted">{{ $t('cashier.printSettings.subtitle') }}</p>
      </div>
    </div>

    <div v-if="saveMsg" class="alert alert-success">{{ saveMsg }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <!-- Printer connection status -->
    <section class="panel">
      <div class="status-row">
        <span class="status-dot" :class="statusDot"></span>
        <div>
          <strong>{{ statusTitle }}</strong>
          <p class="muted">{{ statusDetail }}</p>
        </div>
      </div>
      <p v-if="printerState.reason" class="notice">
        <i class="fas fa-triangle-exclamation"></i> {{ printerState.reason }}
      </p>
    </section>

    <!-- How the printer is reached: through QZ Tray on this computer. -->
    <section class="panel">
      <h2 class="panel-h"><i class="fas fa-tower-broadcast"></i> {{ $t('cashier.printSettings.transportTitle') }}</h2>
      <div class="transport-grid transport-grid--single">
        <div class="transport-option active">
          <i class="fas fa-plug" aria-hidden="true"></i>
          <div>
            <strong>{{ $t('cashier.printSettings.transportNetwork') }}</strong>
            <small>{{ $t('cashier.printSettings.transportNetworkDetail') }}</small>
          </div>
        </div>
      </div>

      <div class="net-actions">
        <button class="sm-btn sm primary" :disabled="connecting" @click="connect">
          <i class="fas fa-plug"></i> {{ connected ? $t('cashier.printSettings.reconnect') : $t('cashier.printSettings.connect') }}
        </button>
        <button class="sm-btn" :disabled="connecting" @click="refreshPrinters">
          <i class="fas fa-rotate"></i> {{ $t('cashier.printSettings.refresh') }}
        </button>
      </div>

      <div class="network-form">
        <label class="fld-label" for="cashier-printer">{{ $t('cashier.printSettings.printerLabel') }}</label>
        <select id="cashier-printer" class="sm-input" :value="tillPrinterName" @change="setTillPrinter($event.target.value)">
          <option value="">{{ $t('cashier.printSettings.selectPrinter') }}</option>
          <option v-for="name in availablePrinters" :key="name" :value="name">{{ name }}</option>
          <option v-if="tillPrinterName && !availablePrinters.includes(tillPrinterName)" :value="tillPrinterName">
            {{ tillPrinterName }}
          </option>
        </select>
      </div>

      <div class="network-form">
        <label class="fld-label" for="cashier-host">{{ $t('cashier.printSettings.orNetwork') }}</label>
        <input id="cashier-host" v-model.trim="networkHost" class="sm-input" :placeholder="$t('cashier.printSettings.hostLabel')" @change="saveNetwork" />
        <input v-model.trim="networkPort" class="sm-input port" :placeholder="$t('cashier.printSettings.portLabel')" @change="saveNetwork" />
      </div>

      <div class="net-actions">
        <button class="sm-btn sm primary" :disabled="testing" @click="testNetwork">
          <i class="fas fa-file-lines"></i> {{ testing ? $t('common.saving') : $t('cashier.printSettings.testNetwork') }}
        </button>
        <p v-if="endpointHelp" class="muted">{{ endpointHelp }}</p>
      </div>
    </section>

    <!-- Cloud Print Settings -->
    <section class="panel">
      <h2 class="panel-h"><i class="fas fa-cloud-arrow-up"></i> {{ $t('cashier.printSettings.cloudTitle') }}</h2>

      <label class="toggle-row">
        <div>
          <strong>{{ $t('cashier.printSettings.printOnSave') }}</strong>
          <small>{{ $t('cashier.printSettings.printOnSaveDetail') }}</small>
        </div>
        <input type="checkbox" v-model="settingsRef.printOnSave" />
      </label>

      <label class="toggle-row">
        <div>
          <strong>{{ $t('cashier.printSettings.printGuestCheckWhenUnsettled') }}</strong>
          <small>{{ $t('cashier.printSettings.printGuestCheckWhenUnsettledDetail') }}</small>
        </div>
        <input type="checkbox" v-model="settingsRef.printGuestCheckWhenUnsettled" />
      </label>

      <label class="toggle-row">
        <div>
          <strong>{{ $t('cashier.printSettings.printOnSettle') }}</strong>
          <small>{{ $t('cashier.printSettings.printOnSettleDetail') }}</small>
        </div>
        <input type="checkbox" v-model="settingsRef.printOnSettle" />
      </label>

      <label class="toggle-row">
        <div>
          <strong>{{ $t('cashier.printSettings.printOnVoid') }}</strong>
          <small>{{ $t('cashier.printSettings.printOnVoidDetail') }}</small>
        </div>
        <input type="checkbox" v-model="settingsRef.printOnVoid" />
      </label>

      <div class="save-row">
        <button class="btn btn-primary" @click="save"><i class="fas fa-check"></i> {{ $t('common.save') }}</button>
        <button class="btn btn-secondary" @click="doReset">{{ $t('cashier.printSettings.reset') }}</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePrintSettingsStore } from '@/stores/printSettings'
import {
  printerState,
  connectPrinter,
  listPrinters,
  printToPrinter,
  printerSupported,
  targetLabel,
  targetUsable,
} from '@/utils/printer'
import { testPrintLines } from '@/utils/receipts'
import { toast } from '@/utils/toast'

const { t } = useI18n()
const printStore = usePrintSettingsStore()

const error = ref('')
const connecting = ref(false)
const testing = ref(false)
const connected = ref(printerState.connected)
const availablePrinters = ref([])
let saveMsg = ref('')

const settingsRef = reactive({ ...printStore.settings })
const endpointHelp = ref('')

const tillTarget = computed(() => (targetUsable(printStore.tillPrinter) ? printStore.tillPrinter : null))
const tillPrinterName = computed(() =>
  printStore.tillPrinter?.kind === 'system' ? printStore.tillPrinter.printer : '',
)

const networkHost = ref(printStore.tillPrinter?.kind === 'socket' ? printStore.tillPrinter.host : '')
const networkPort = ref(String(printStore.tillPrinter?.kind === 'socket' ? printStore.tillPrinter.port || 9100 : 9100))

const statusDot = computed(() => (connected.value ? 'ok' : 'off'))
const statusTitle = computed(() => {
  if (!tillTarget.value) return t('cashier.printSettings.statusNoNetwork')
  return connected.value ? t('cashier.printSettings.statusNetwork') : t('cashier.printSettings.statusNoNetwork')
})
const statusDetail = computed(() =>
  tillTarget.value
    ? `${t('cashier.printSettings.statusNetworkDetail')} ${targetLabel(tillTarget.value)}`
    : t('cashier.printSettings.statusNoNetworkDetail'),
)

/** Stores the picked system printer as the till printer. */
function setTillPrinter(name) {
  printStore.saveSettings({ tillPrinter: name ? { kind: 'system', printer: name, label: name } : null })
}

/** Stores a raw network printer (host:port) as the till printer. */
function saveNetwork() {
  const host = networkHost.value.trim()
  if (!host) return
  const port = Number(networkPort.value) || 9100
  printStore.saveSettings({ tillPrinter: { kind: 'socket', host, port, label: `${host}:${port}` } })
}

async function connect() {
  error.value = ''
  if (!printerSupported()) {
    error.value = t('cashier.printSettings.unsupported')
    return
  }
  connecting.value = true
  try {
    const ok = await connectPrinter(tillTarget.value)
    connected.value = ok
    if (!ok) error.value = printerState.reason || t('cashier.printSettings.connectFailed')
    else await refreshPrinters()
  } finally {
    connecting.value = false
  }
}

async function refreshPrinters() {
  error.value = ''
  try {
    availablePrinters.value = [...new Set(await listPrinters())].sort()
    connected.value = true
  } catch (err) {
    connected.value = false
    error.value = printerState.reason || err?.message || t('cashier.printSettings.connectFailed')
  }
}

function save() {
  printStore.saveSettings({ ...settingsRef })
  saveMsg.value = t('cashier.printSettings.saved')
  toast(t('cashier.printSettings.saved'), 'success')
  setTimeout(() => (saveMsg.value = ''), 3000)
}

function doReset() {
  printStore.reset()
  Object.assign(settingsRef, printStore.settings)
  toast(t('cashier.printSettings.reset'), 'success')
}

async function testNetwork() {
  error.value = ''
  if (!tillTarget.value) {
    endpointHelp.value = t('cashier.printSettings.endpointRequired')
    return
  }
  testing.value = true
  endpointHelp.value = ''
  try {
    const sent = await printToPrinter(testPrintLines(), { printer: tillTarget.value })
    if (!sent) { error.value = printerState.reason || t('printer.testFailed') }
    else { toast(t('cashier.printSettings.testOk'), 'success') }
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  if (printerState.connected) refreshPrinters()
})
</script>

<style scoped>
.dashboard-page { padding: 20px; }
.page-head h1 { font-size: 22px; font-weight: 800; display: flex; align-items: center; gap: 8px; margin: 0; }
.page-head h1 i { color: #005eb8; }
.muted { color: #757575; font-size: 13px; margin-top: 2px; }

.status-row { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
.status-dot { width: 14px; height: 14px; border-radius: 50%; flex: none; }
.status-dot.ok { background: #22c55e; box-shadow: 0 0 0 4px rgba(34,197,94,.15); }
.status-dot.off { background: #f59e0b; box-shadow: 0 0 0 4px rgba(245,158,11,.15); }
.status-dot.na { background: #9ca3af; box-shadow: 0 0 0 4px rgba(156,163,175,.15); }

.notice { display: flex; align-items: center; gap: 8px; background: #fff8e1; color: #8a6d1a; padding: 10px 14px; border-radius: 6px; margin: 8px 0 12px; font-size: 13px; }
.panel { margin-bottom: 16px; }
.panel-h { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin: 0 0 14px; }
.panel-h i { color: #005eb8; }

.transport-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
.transport-grid--single { grid-template-columns: 1fr; }
@media (max-width: 700px) { .transport-grid { grid-template-columns: 1fr; } }
.transport-option {
  display: flex; gap: 10px; align-items: flex-start;
  border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; cursor: pointer;
  background: #fff;
}
.transport-option i { font-size: 18px; color: #94a3b8; margin-top: 2px; }
.transport-option.active { border-color: #005eb8; background: #e8f1fa; }
.transport-option.active i { color: #005eb8; }
.transport-option strong { display: block; font-size: 14px; color: #1e293b; }
.transport-option small { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }
.transport-option input { margin-top: 3px; }

.network-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.net-actions { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
.connect-actions { display: flex; gap: 10px; margin-top: 4px; }
.sm-input.port { max-width: 110px; }

.quick-steps { border-top: 1px solid #ececec; margin-top: 14px; padding-top: 12px; font-size: 13px; }
.qs-h { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
.qs-h i { color: #005eb8; }
.quick-steps ol { margin: 0; padding-left: 20px; line-height: 1.7; color: #444; }
.fld-label { font-size: 12px; font-weight: 600; color: #475569; }

.toggle-row {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 12px 4px; border-bottom: 1px solid #f1f5f9; cursor: pointer;
}
.toggle-row strong { display: block; font-size: 14px; color: #1e293b; }
.toggle-row small { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }
.toggle-row input { width: 20px; height: 20px; accent-color: #005eb8; flex: none; }

.save-row { display: flex; gap: 10px; margin-top: 16px; }
</style>
