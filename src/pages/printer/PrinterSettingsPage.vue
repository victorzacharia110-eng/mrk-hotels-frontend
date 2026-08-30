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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { printerState, printerSupported, connectPrinter, disconnectPrinter, restorePrinter, printToPrinter } from '@/utils/printer'
import { testPrintLines } from '@/utils/receipts'

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

onMounted(restorePrinter)
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
</style>