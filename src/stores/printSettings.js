/**
 * Print settings store — the cashier panel's "Cloud Print Settings".
 *
 * Mirrors the print-on-event toggles common to POS systems (e.g. E-Zee):
 * decide WHEN a receipt or guest check should go to the till printer.
 *
 * The printer may be reached either over Web Serial (a USB printer attached
 * to this machine) or over the network via a local bridge agent exposed on an
 * HTTP endpoint (for printers on another machine / remote printing). The
 * chosen endpoint is stored here so every print call site shares one setting.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { printerState, printToPrinter, printerSupported } from "@/utils/printer";

// localStorage key for the whole settings blob.
const STORAGE_KEY = "mrk_print_settings";

const DEFAULTS = {
  // Print a receipt / guest check as soon as an order is saved (placed).
  printOnSave: true,
  // Print the guest check when an order is left unsettled (open on a table).
  printGuestCheckWhenUnsettled: false,
  // Print the receipt when an order is settled (payment taken).
  printOnSettle: true,
  // Print a receipt when an order is voided / cancelled.
  printOnVoid: false,
  // How the till printer is reached: 'serial' (Web Serial/USB on this machine)
  // or 'network' (a local bridge agent forwarding to the printer).
  transport: "serial",
  // Base URL of the network bridge agent, e.g. http://100.x.y.z:9720
  endpoint: "",
};

function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed && typeof parsed === "object") {
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    /* corrupted storage — fall back to defaults */
  }
  return { ...DEFAULTS };
}

export const usePrintSettingsStore = defineStore("printSettings", () => {
  const settings = ref(loadSaved());

  const printOnSave = computed(() => settings.value.printOnSave);
  const printGuestCheckWhenUnsettled = computed(() => settings.value.printGuestCheckWhenUnsettled);
  const printOnSettle = computed(() => settings.value.printOnSettle);
  const printOnVoid = computed(() => settings.value.printOnVoid);
  const transport = computed(() => settings.value.transport);
  const endpoint = computed(() => settings.value.endpoint);

  function saveSettings(next) {
    settings.value = { ...settings.value, ...next };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value));
    } catch {
      /* storage full / private mode — the settings just won't persist */
    }
  }

  function reset() {
    settings.value = { ...DEFAULTS };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /**
   * Sends receipt lines to the till printer using whichever transport is
   * configured. Returns true when the job was accepted by the printer/agent.
   */
  async function print(lines, opts = {}) {
    const transport = settings.value.transport;
    const endpoint = settings.value.endpoint;
    if (transport === "network" && endpoint) {
      return printToPrinter(lines, { ...opts, transport: "network", endpoint });
    }
    if (!printerSupported()) {
      printerState.reason =
        "This browser cannot talk directly to the printer. Use Chrome/Edge on desktop, or set a network printer endpoint in Print Settings.";
      return false;
    }
    return printToPrinter(lines, { ...opts, transport: "serial" });
  }

  return {
    settings,
    printOnSave,
    printGuestCheckWhenUnsettled,
    printOnSettle,
    printOnVoid,
    transport,
    endpoint,
    saveSettings,
    reset,
    print,
  };
});
