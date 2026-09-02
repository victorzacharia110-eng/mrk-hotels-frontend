<!--
  CashierPrintSettingsPage — the till printer and "Cloud Print Settings" in
  the cashier panel.

  Mirrors the print-on-event toggles common to POS systems (the client uses
  E-Zee): decide WHEN a receipt or guest check should print. Also lets the
  cashier choose how the printer is reached:
    - Web Serial: a USB printer attached to THIS machine.
    - Network:    a local bridge agent (on the printer machine, reached over
                  LAN/tunnel) that forwards prints to a printer elsewhere —
                  required when the till printer is on another PC or remote.
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
      <p v-if="!supported && transportRef === 'serial'" class="notice">
        <i class="fas fa-circle-info"></i> {{ $t('cashier.printSettings.serialUnsupported') }}
      </p>
      <p v-else-if="printerState.reason" class="notice">
        <i class="fas fa-triangle-exclamation"></i> {{ printerState.reason }}
      </p>
    </section>

    <!-- Transport / how the printer is reached -->
    <section class="panel">
      <h2 class="panel-h"><i class="fas fa-tower-broadcast"></i> {{ $t('cashier.printSettings.transportTitle') }}</h2>
      <div class="transport-grid">
        <label class="transport-option" :class="{ active: transportRef === 'serial' }">
          <input type="radio" v-model="transportRef" value="serial" />
          <i class="fas fa-plug" aria-hidden="true"></i>
          <div>
            <strong>{{ $t('cashier.printSettings.transportSerial') }}</strong>
            <small>{{ $t('cashier.printSettings.transportSerialDetail') }}</small>
          </div>
        </label>
        <label class="transport-option" :class="{ active: transportRef === 'network' }">
          <input type="radio" v-model="transportRef" value="network" />
          <i class="fas fa-network-wired" aria-hidden="true"></i>
          <div>
            <strong>{{ $t('cashier.printSettings.transportNetwork') }}</strong>
            <small>{{ $t('cashier.printSettings.transportNetworkDetail') }}</small>
          </div>
        </label>
      </div>

      <div v-if="transportRef === 'network'" class="network-form">
        <label class="fld-label" for="net-endpoint">{{ $t('cashier.printSettings.endpointLabel') }}</label>
        <input id="net-endpoint" v-model.trim="endpointRef" type="url" class="sm-input"
          :placeholder="$t('cashier.printSettings.endpointPlaceholder')" />
        <div class="net-actions">
          <button class="sm-btn sm primary" :disabled="testing" @click="testNetwork">
            <i class="fas fa-file-lines"></i> {{ testing ? $t('common.saving') : $t('cashier.printSettings.testNetwork') }}
          </button>
          <p v-if="endpointHelp" class="muted">{{ endpointHelp }}</p>
        </div>
      </div>

      <div class="connect-actions" v-if="transportRef === 'serial'">
        <template v-if="!printerState.connected">
          <button class="btn btn-primary" @click="connect"><i class="fas fa-plug"></i> {{ $t('printer.connect') }}</button>
        </template>
        <template v-else>
          <button class="btn btn-secondary" :disabled="testing" @click="testSerial">
            <i class="fas fa-file-lines"></i> {{ testing ? $t('common.saving') : $t('printer.test') }}
          </button>
          <button class="btn btn-danger" @click="disconnect"><i class="fas fa-plug-circle-xmark"></i> {{ $t('printer.disconnect') }}</button>
        </template>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePrintSettingsStore } from '@/stores/printSettings'
import { printerState, printerSupported, connectPrinter, disconnectPrinter, restorePrinter, printToPrinter } from '@/utils/printer'
import { testPrintLines } from '@/utils/receipts'
import { toast } from '@/utils/toast'

const { t } = useI18n()
const printStore = usePrintSettingsStore()

const supported = computed(() => printerSupported())
const error = ref('')
const testing = ref(false)
let saveMsg = ref('')

const settingsRef = reactive({ ...printStore.settings })
const transportRef = ref(printStore.transport)
const endpointRef = ref(printStore.endpoint)
const endpointHelp = ref('')

const statusDot = computed(() => {
  if (transportRef.value === 'network') return endpointRef.value ? 'ok' : 'off'
  if (!supported.value) return 'na'
  return printerState.connected ? 'ok' : 'off'
})

const statusTitle = computed(() => {
  if (transportRef.value === 'network') {
    return endpointRef.value ? t('cashier.printSettings.statusNetwork') : t('cashier.printSettings.statusNoNetwork')
  }
  if (!supported.value) return t('printer.statusUnsupported')
  return printerState.connected ? t('printer.statusConnected') : t('printer.statusNotConnected')
})

const statusDetail = computed(() => {
  if (transportRef.value === 'network') {
    return endpointRef.value ? `${t('cashier.printSettings.statusNetworkDetail')} ${endpointRef.value}` : t('cashier.printSettings.statusNoNetworkDetail')
  }
  if (!supported.value) return t('printer.statusUnsupportedDetail')
  return printerState.connected ? printerState.info || t('printer.statusConnectedDetail') : t('printer.statusNotConnectedDetail')
})

function save() {
  const saved = {
    ...settingsRef,
    transport: transportRef.value,
    endpoint: endpointRef.value || '',
  }
  printStore.saveSettings(saved)
  saveMsg.value = t('cashier.printSettings.saved')
  toast(t('cashier.printSettings.saved'), 'success')
  setTimeout(() => (saveMsg.value = ''), 3000)
}

function doReset() {
  printStore.reset()
  Object.assign(settingsRef, printStore.settings)
  transportRef.value = printStore.transport
  endpointRef.value = printStore.endpoint
  toast(t('cashier.printSettings.reset'), 'success')
}

async function connect() {
  error.value = ''
  const ok = await connectPrinter()
  if (!ok && !printerState.connected) error.value = printerState.reason || t('printer.connectFailed')
  else error.value = printerState.reason || t('printer.readyToTest')
}

async function disconnect() {
  await disconnectPrinter()
  error.value = ''
}

async function testSerial() {
  error.value = ''
  testing.value = true
  try {
    const sent = await printToPrinter(testPrintLines(), { transport: 'serial' })
    if (!sent) error.value = printerState.reason || t('printer.testFailed')
    else toast(t('cashier.printSettings.testOk'), 'success')
  } finally {
    testing.value = false
  }
}

async function testNetwork() {
  error.value = ''
  if (!endpointRef.value) {
    endpointHelp.value = t('cashier.printSettings.endpointRequired')
    return
  }
  testing.value = true
  endpointHelp.value = ''
  try {
    const sent = await printToPrinter(testPrintLines(), { transport: 'network', endpoint: endpointRef.value })
    if (!sent) { error.value = printerState.reason || t('printer.testFailed') }
    else { toast(t('cashier.printSettings.testOk'), 'success') }
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  restorePrinter()
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
.net-actions { display: flex; align-items: center; gap: 12px; }
.connect-actions { display: flex; gap: 10px; margin-top: 4px; }
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
