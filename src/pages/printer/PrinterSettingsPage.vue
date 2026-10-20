<!--
  PrinterSettingsPage — the till printer connection for direct thermal printing.

  Printing goes through QZ Tray, the free cross-platform helper (Windows / macOS
  / Linux) that runs a small websocket on the till the browser talks to over
  HTTPS. That lets the page reach a thermal printer over USB, Serial or a raw
  network socket, which a browser cannot do on its own — and it is why the old
  hand-rolled bridge agent is gone. The hotel installs QZ Tray once, connects,
  picks its printer, and tests it here.
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

    <!--
      The client's installation path: four numbered steps with a live status
      chip each, so a hotel setting the system up for the first time knows
      exactly where they are and what is still missing.
    -->
    <section class="panel setup-guide">
      <h2><i class="fas fa-list-ol"></i> {{ $t('printer.setupTitle') }}</h2>
      <p class="muted">{{ $t('printer.setupSubtitle') }}</p>

      <div class="reqs">
        <p class="reqs-h"><i class="fas fa-circle-info" aria-hidden="true"></i> <strong>{{ $t('printer.reqTitle') }}</strong></p>
        <ul>
          <li>{{ $t('printer.req1') }}</li>
          <li>{{ $t('printer.req2') }}</li>
          <li>{{ $t('printer.req3') }}</li>
        </ul>
      </div>

      <ol class="steps">
        <li v-for="s in setupSteps" :key="s.key" class="step" :class="{ done: s.done }">
          <span class="step-no"><i :class="s.done ? 'fas fa-check' : s.icon" aria-hidden="true"></i></span>
          <div class="step-text">
            <strong>{{ $t(`printer.${s.key}Title`) }}</strong>
            <p class="muted">{{ $t(`printer.${s.key}Hint`) }}</p>
            <button type="button" class="link-btn" @click="goTo(s.target)">
              {{ $t('printer.stepGo') }} <i class="fas fa-arrow-right" aria-hidden="true"></i>
            </button>
          </div>
          <span class="chip" :class="`chip-${s.chip}`">{{ chipLabel(s.chip) }}</span>
        </li>
      </ol>
    </section>

    <!-- QZ Tray is the one thing to install: it is free, open-source and
         cross-platform. The download link is theirs so the operator always
         gets the current, correctly-signed build. -->
    <section id="downloads" class="panel downloads">
      <h2><i class="fas fa-download"></i> {{ $t('printer.downloadsTitle') }}</h2>

      <a class="download-card primary-card" :href="qzDownloadUrl" target="_blank" rel="noopener">
        <i class="fas fa-print dl-kind" aria-hidden="true"></i>
        <span class="download-text">
          <strong>{{ $t('printer.downloadExe') }}</strong>
          <span class="muted block">{{ $t('printer.downloadExeHint') }}</span>
        </span>
        <span class="dl-badge">{{ $t('printer.downloadExeBadge') }}</span>
      </a>

      <p class="download-alt">
        <span class="muted">{{ $t('printer.downloadAltLead') }}</span>
        <a :href="pdfGuideUrl" target="_blank" rel="noopener">{{ $t('printer.downloadPdfGuideLink') }}</a>
        <span class="muted" aria-hidden="true">·</span>
        <a :href="guideUrl">{{ $t('printer.downloadGuideLink') }}</a>
        <span class="muted" aria-hidden="true">·</span>
        <a :href="qzDocsUrl" target="_blank" rel="noopener">{{ $t('printer.downloadHelperLink') }}</a>
      </p>
    </section>

    <section id="connection" class="panel">
      <h2><i class="fas fa-plug"></i> {{ $t('printer.connectionTitle') }}</h2>
      <p class="muted">{{ $t('printer.connectionHint') }}</p>

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

      <div class="actions">
        <button class="btn btn-primary" :disabled="connecting" @click="connect">
          <i class="fas fa-plug"></i> {{ connected ? $t('printer.reconnect') : $t('printer.connect') }}
        </button>
        <button class="btn btn-secondary" :disabled="connecting" @click="refreshPrinters">
          <i class="fas fa-rotate"></i> {{ $t('printer.refresh') }}
        </button>
        <button class="btn btn-secondary" :disabled="testing" @click="test">
          <i class="fas fa-file-lines"></i> {{ testing ? $t('common.saving') : $t('printer.test') }}
        </button>
      </div>

      <!-- The till printer (receipts and guest checks). Pick an installed
           printer QZ Tray can see, or point straight at a network printer. -->
      <div class="network-form">
        <label class="fld-label" for="till-printer">{{ $t('printer.tillPrinterLabel') }}</label>
        <select id="till-printer" class="form-control" :value="tillPrinterName" @change="setTillPrinter($event.target.value)">
          <option value="">{{ $t('printer.selectPrinter') }}</option>
          <option v-for="name in availablePrinters" :key="name" :value="name">{{ name }}</option>
          <!-- Keep the saved printer visible even before QZ Tray reports the list. -->
          <option v-if="tillPrinterName && !availablePrinters.includes(tillPrinterName)" :value="tillPrinterName">
            {{ tillPrinterName }}
          </option>
        </select>
      </div>

      <div class="network-form">
        <label class="fld-label" for="till-host">{{ $t('printer.orNetwork') }}</label>
        <div class="inline-fields">
          <input id="till-host" v-model.trim="networkHost" class="form-control" :placeholder="$t('printer.hostLabel')" @change="saveNetwork" />
          <input v-model.trim="networkPort" class="form-control port" :placeholder="$t('printer.portLabel')" @change="saveNetwork" />
          <button class="btn btn-secondary" @click="saveNetwork">{{ $t('printer.saveNetwork') }}</button>
        </div>
      </div>
    </section>

    <section id="when-to-print" class="panel">
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

    <section id="ticket-printers" class="panel">
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

      <table v-if="ticketPrinters.length" class="route-table">
        <thead>
          <tr>
            <th>{{ $t('printer.passTitle') }}</th>
            <th>{{ $t('printer.ticketPrinter') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="station in STATIONS" :key="station.id">
            <td>{{ $t(station.labelKey) }}</td>
            <td>
              <select
                class="form-control"
                :value="stationRouteFor(station.id)"
                @change="setStationRoute(station.id, $event.target.value)"
              >
                <option value="">{{ $t('printer.followServiceLine') }}</option>
                <option v-for="p in ticketPrinters" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="muted">{{ $t('printer.passHint') }}</p>

      <div class="add-row">
        <input
          v-model="newPrinter.name"
          class="form-control"
          :placeholder="$t('printer.printerName')"
        />
        <select v-model="newPrinter.kind" class="form-control">
          <option value="system">{{ $t('printer.systemPrinter') }}</option>
          <option value="socket">{{ $t('printer.networkPrinter') }}</option>
        </select>
        <select v-if="newPrinter.kind === 'system'" v-model="newPrinter.printer" class="form-control">
          <option value="">{{ $t('printer.selectPrinter') }}</option>
          <option v-for="name in availablePrinters" :key="name" :value="name">{{ name }}</option>
        </select>
        <template v-else>
          <input v-model.trim="newPrinter.host" class="form-control" :placeholder="$t('printer.hostLabel')" />
          <input v-model.trim="newPrinter.port" class="form-control port" :placeholder="$t('printer.portLabel')" />
        </template>
        <button class="btn btn-primary" :disabled="!canAddPrinter" @click="addPrinter">
          <i class="fas fa-plus"></i> {{ $t('common.add') }}
        </button>
      </div>

      <ul v-if="ticketPrinters.length" class="printer-list">
        <li v-for="p in ticketPrinters" :key="p.id">
          <span>
            <strong>{{ p.name }}</strong>
            <span class="muted"> — {{ targetLabel(p) }}</span>
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
import { storeToRefs } from 'pinia'
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
import { usePrintSettingsStore } from '@/stores/printSettings'
import { menuCategoryApi } from '@/api'

const { t } = useI18n()

const printStore = usePrintSettingsStore()
const {
  settings,
  tillPrinter,
  ticketPrinters,
  departmentRouting,
  stationRouting,
  defaultTicketPrinterId,
} = storeToRefs(printStore)
const { saveSettings, addTicketPrinter, removeTicketPrinter } = printStore

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
    const routed = Object.keys(departmentRouting.value || {})
    if (lines.length) serviceLines.value = [...new Set([...lines, ...routed])]
  } catch {
    /* keep the defaults; the page still works with the two original lines */
  }
}
// The physical passes a menu item can be filed under. These are the only two
// values the API accepts for printer_station, so they are written out rather
// than derived: the point is that a pass is a printer, not a service line.
const STATIONS = [
  { id: 'kitchen', labelKey: 'printer.stationKitchen' },
  { id: 'bar', labelKey: 'printer.stationBar' },
]

const error = ref('')
const connecting = ref(false)
const testing = ref(false)
const connected = ref(printerState.connected)
const availablePrinters = ref([])

// True once a test print has actually come back from the printer in this
// session — it is the only honest proof that step 4 is finished.
const testPassed = ref(false)

const newPrinter = ref({ name: '', kind: 'system', printer: '', host: '', port: '9100' })

// QZ Tray's own download and docs so the operator always gets a current,
// correctly-signed build rather than a copy bundled with the app.
const qzDownloadUrl = 'https://qz.io/download/'
const qzDocsUrl = 'https://qz.io/docs'
// Human-readable, printable walkthrough (QZ Tray install, Windows printer,
// app selection, test print). Opens in a new tab so the till keeps this page.
const pdfGuideUrl = `${import.meta.env.BASE_URL}MRK_Hotels_Printer_Setup_Guide.pdf`

// MRK's one-click Windows till setup: installs QZ Tray if missing and trusts
// the MRK root certificate so printing is silent. Built by the API repo's
// till-setup/build-zip.sh — regenerate it if the root CA is ever reissued.
const guideUrl = `${import.meta.env.BASE_URL}mrk-till-setup.zip`

/** The configured till printer, when it is complete enough to print to. */
const tillTarget = computed(() => (targetUsable(tillPrinter.value) ? tillPrinter.value : null))

/** The name shown in the printer picker (system printers only). */
const tillPrinterName = computed(() => (tillPrinter.value?.kind === 'system' ? tillPrinter.value.printer : ''))

const networkHost = ref(tillPrinter.value?.kind === 'socket' ? tillPrinter.value.host : '')
const networkPort = ref(String(tillPrinter.value?.kind === 'socket' ? tillPrinter.value.port || 9100 : 9100))

const canAddPrinter = computed(() => {
  if (!newPrinter.value.name.trim()) return false
  return newPrinter.value.kind === 'socket' ? Boolean(newPrinter.value.host.trim()) : true
})

/**
 * The four setup steps with a live status chip each. `chip` drives both the
 * colour and the label: done / todo / optional (skip freely) / notNeeded
 * (meaningless without ticket printers).
 */
const setupSteps = computed(() => [
  {
    key: 'step1',
    icon: 'fas fa-download',
    done: connected.value,
    chip: connected.value ? 'done' : 'todo',
    target: 'downloads',
  },
  {
    key: 'step2',
    icon: 'fas fa-plug',
    done: connected.value,
    chip: connected.value ? 'done' : 'todo',
    target: 'connection',
  },
  {
    key: 'step3',
    icon: 'fas fa-print',
    done: Boolean(tillTarget.value),
    chip: tillTarget.value ? 'done' : 'todo',
    target: 'connection',
  },
  {
    key: 'step4',
    icon: 'fas fa-file-lines',
    done: testPassed.value,
    chip: testPassed.value ? 'done' : 'todo',
    target: 'connection',
  },
])

const CHIP_LABELS = {
  done: 'printer.statusDone',
  todo: 'printer.statusTodo',
  optional: 'printer.statusOptional',
  notNeeded: 'printer.statusNotNeeded',
}

function chipLabel(chip) {
  return t(CHIP_LABELS[chip])
}

function goTo(id) {
  document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}

const toggles = [
  { key: 'printOnSave', label: 'printer.printOnSave', hint: 'printer.printOnSaveHint' },
  { key: 'printGuestCheckWhenUnsettled', label: 'printer.printGuestCheckWhenUnsettled', hint: 'printer.printGuestCheckWhenUnsettledHint' },
  { key: 'printOnSettle', label: 'printer.printOnSettle', hint: 'printer.printOnSettleHint' },
  { key: 'printOnVoid', label: 'printer.printOnVoid', hint: 'printer.printOnVoidHint' },
  { key: 'printFoodTicketOnOrder', label: 'printer.printFoodTicketOnOrder', hint: 'printer.printFoodTicketOnOrderHint' },
  { key: 'printFoodTicketOnItemAdded', label: 'printer.printFoodTicketOnItemAdded', hint: 'printer.printFoodTicketOnItemAddedHint' },
]

const statusDot = computed(() => (connected.value ? 'ok' : 'off'))
const statusTitle = computed(() => {
  if (!tillTarget.value) return t('printer.noPrinter')
  return connected.value ? t('printer.statusReady') : t('printer.statusNotReady')
})
const statusDetail = computed(() => (tillTarget.value ? targetLabel(tillTarget.value) : t('printer.noPrinterHint')))

function setFlag(key, value) {
  saveSettings({ [key]: value })
}

function routingFor(line) {
  return departmentRouting.value[line] || ''
}

function setRoute(line, printerId) {
  saveSettings({ departmentRouting: { ...departmentRouting.value, [line]: printerId } })
}

function stationRouteFor(station) {
  return stationRouting.value?.[station] || ''
}

function setStationRoute(station, printerId) {
  // Left blank means "follow the service line's printer", which is why an
  // empty value is written as an absent key rather than as ''.
  const next = { ...stationRouting.value }
  if (printerId) next[station] = printerId
  else delete next[station]
  saveSettings({ stationRouting: next })
}

function setDefault(printerId) {
  saveSettings({ defaultTicketPrinterId: printerId })
}

/** Stores the picked system printer as the till printer. */
function setTillPrinter(name) {
  saveSettings({ tillPrinter: name ? { kind: 'system', printer: name, label: name } : null })
}

/** Stores a raw network printer (host:port) as the till printer. */
function saveNetwork() {
  const host = networkHost.value.trim()
  if (!host) return
  const port = Number(networkPort.value) || 9100
  saveSettings({ tillPrinter: { kind: 'socket', host, port, label: `${host}:${port}` } })
}

function addPrinter() {
  const name = newPrinter.value.name.trim()
  if (!name) return
  const target =
    newPrinter.value.kind === 'socket'
      ? { name, kind: 'socket', host: newPrinter.value.host.trim(), port: Number(newPrinter.value.port) || 9100 }
      : { name, kind: 'system', printer: newPrinter.value.printer || name }
  addTicketPrinter(target)
  newPrinter.value = { name: '', kind: 'system', printer: '', host: '', port: '9100' }
}

/** Connects to QZ Tray and refreshes the list of printers it can see. */
async function connect() {
  error.value = ''
  if (!printerSupported()) {
    error.value = t('printer.unsupported')
    return
  }
  connecting.value = true
  try {
    const ok = await connectPrinter(tillTarget.value)
    connected.value = ok
    if (!ok) error.value = printerState.reason || t('printer.connectFailed')
    else await refreshPrinters()
  } finally {
    connecting.value = false
  }
}

/** Re-reads the installed printers from QZ Tray. */
async function refreshPrinters() {
  error.value = ''
  try {
    const printers = await listPrinters()
    availablePrinters.value = [...new Set(printers)].sort()
    connected.value = true
  } catch (err) {
    connected.value = false
    error.value = printerState.reason || err?.message || t('printer.connectFailed')
  }
}

async function test() {
  error.value = ''
  if (!tillTarget.value) {
    error.value = t('printer.endpointRequired')
    return
  }
  testing.value = true
  try {
    const sent = await printToPrinter(testPrintLines(), { printer: tillTarget.value })
    if (!sent) error.value = printerState.reason || t('printer.testFailed')
    else testPassed.value = true
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  loadServiceLines()
  if (printerState.connected) refreshPrinters()
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

.actions { display: flex; gap: 10px; align-items: center; margin: 8px 0 20px; flex-wrap: wrap; }
.network-form { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 12px; }
.fld-label { font-size: 12px; font-weight: 600; color: #475569; }
.inline-fields { display: flex; gap: 8px; flex-wrap: wrap; }
.inline-fields .port { max-width: 110px; }

.panel { margin-top: 20px; scroll-margin-top: 16px; }
.panel h2 { font-size: 17px; font-weight: 700; margin: 0 0 4px; }
.panel h2 i { color: #005eb8; }
.block { display: block; }

/* Step-by-step setup guide */
.setup-guide h2 { display: flex; align-items: center; gap: 8px; }
.setup-guide h2 i { color: #005eb8; }

.reqs { background: #f5f8fc; border: 1px solid #e3ecf6; border-radius: 8px; padding: 10px 14px; margin: 12px 0; }
.reqs-h { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 13px; }
.reqs-h i { color: #005eb8; }
.reqs ul { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; color: #444; }

.steps { list-style: none; margin: 14px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.step { display: flex; gap: 12px; align-items: flex-start; border: 1px solid #e7e7e7; border-radius: 8px; padding: 12px 14px; background: #fff; }
.step.done { border-color: #bbf7d0; background: #f7fff9; }
.step-no { width: 28px; height: 28px; border-radius: 50%; background: #005eb8; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; flex: none; }
.step.done .step-no { background: #22c55e; }
.step-text { flex: 1; min-width: 0; }
.step-text strong { font-size: 14px; }
.step-text .muted { margin: 2px 0 6px; line-height: 1.5; }
.link-btn { background: none; border: 0; padding: 0; color: #005eb8; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.link-btn:hover { text-decoration: underline; }
.chip { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; flex: none; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.03em; }
.chip-done { background: #dcfce7; color: #15803d; }
.chip-todo { background: #fef3c7; color: #92400e; }
.chip-optional { background: #e0f2fe; color: #0369a1; }
.chip-notNeeded { background: #f1f5f9; color: #64748b; }

.toggle { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; cursor: pointer; }
.toggle:last-child { border-bottom: 0; }
.default-row { justify-content: space-between; align-items: center; margin-top: 14px; }
.default-row .form-control { max-width: 260px; }

.route-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
.route-table th, .route-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }

.add-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.add-row .form-control { flex: 1 1 160px; }
.add-row .port { flex: 0 0 110px; }

.printer-list { list-style: none; padding: 0; margin: 14px 0 0; }
.printer-list li { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.btn-sm { padding: 5px 10px; font-size: 12px; }

/* One obvious download, with quiet fallbacks for docs and the setup guide. */
.downloads h2 { display: flex; align-items: center; gap: 8px; }
.downloads h2 i { color: #005eb8; }
.download-card {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px; border: 1px solid #e3ecf6; border-radius: 10px;
  background: #f5f8fc; color: #1e293b; text-decoration: none;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.download-card:hover { border-color: #005eb8; background: #eef4fe; box-shadow: 0 4px 14px rgba(0,94,184,.12); }
.download-card.primary-card { border-color: #005eb8; }
.download-card .dl-kind { font-size: 30px; color: #005eb8; flex: none; }
.download-card .download-text { flex: 1; min-width: 0; }
.download-card .download-text strong { font-size: 15px; }
.download-card .download-text .muted { margin: 2px 0 0; line-height: 1.5; }
.dl-badge { flex: none; align-self: flex-start; background: #005eb8; color: #fff; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
.download-alt { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 12px 2px 0; font-size: 13px; }
.download-alt a { color: #005eb8; font-weight: 600; text-decoration: none; }
.download-alt a:hover { text-decoration: underline; }
html[data-theme='dark'] .download-alt a { color: #7cc0ff; }
</style>
