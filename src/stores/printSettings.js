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
  // Print a food ticket when an order is placed. Separate from the receipt
  // because the kitchen/bar needs it the moment the order lands, while the
  // guest may not settle for hours.
  printFoodTicketOnOrder: true,
  // Print a food ticket when a single item is added to an order that was
  // already placed. Off by default: most kitchens reprint the whole ticket.
  printFoodTicketOnItemAdded: false,
  // Named printer profiles a food ticket can be routed to. Each is either the
  // USB printer attached to this machine ('serial', at most one at a time) or a
  // bridge agent on another machine ('network'). Ids are stable so a route
  // pointing at a deleted printer degrades to the till printer instead of
  // silently dropping the ticket.
  ticketPrinters: [],
  // Which printer each service line's tickets go to, by profile id.
  departmentRouting: {},
  // Profile used when a service line has no route of its own, or its route
  // points at a printer that has since been deleted.
  defaultTicketPrinterId: "",
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
  const printFoodTicketOnOrder = computed(() => settings.value.printFoodTicketOnOrder);
  const printFoodTicketOnItemAdded = computed(() => settings.value.printFoodTicketOnItemAdded);
  const ticketPrinters = computed(() => settings.value.ticketPrinters);
  const departmentRouting = computed(() => settings.value.departmentRouting);
  const defaultTicketPrinterId = computed(() => settings.value.defaultTicketPrinterId);
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

  /**
   * The printer a service line's food tickets should go to.
   *
   * A route whose printer has been deleted falls back to the default profile
   * rather than to nothing: a mis-typed ticket still gets in front of the
   * kitchen, which beats it vanishing into a drawer.
   */
  function resolveTicketPrinter(department) {
    const printers = settings.value.ticketPrinters;
    const byId = new Map(printers.map((p) => [p.id, p]));
    const routed = settings.value.departmentRouting?.[department];
    return (
      byId.get(routed) ||
      byId.get(settings.value.defaultTicketPrinterId) ||
      null
    );
  }

  /**
   * Adds a named printer profile and returns its id.
   *
   * The id is generated here rather than by the caller so a profile can be
   * created from the settings form without it having to think about
   * collisions with ids already stored.
   */
  function addTicketPrinter(printer) {
    const id = `tp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    saveSettings({ ticketPrinters: [...settings.value.ticketPrinters, { id, ...printer }] });
    return id;
  }

  /**
   * Removes a profile and clears any route that pointed at it, so the routing
   * map never references a printer that no longer exists.
   */
  function removeTicketPrinter(id) {
    saveSettings({
      ticketPrinters: settings.value.ticketPrinters.filter((p) => p.id !== id),
      departmentRouting: Object.fromEntries(
        Object.entries(settings.value.departmentRouting || {}).filter(
          ([, printerId]) => printerId !== id,
        ),
      ),
      defaultTicketPrinterId:
        settings.value.defaultTicketPrinterId === id
          ? ""
          : settings.value.defaultTicketPrinterId,
    });
  }

  /**
   * Sends a food ticket to the printer routed for a service line.
   *
   * With no profile configured for the line, the ticket goes to the till
   * printer: that is the one printer known to exist, and a single till printing
   * a kitchen ticket is still better than a dropped order.
   */
  async function printFoodTicket(lines, department, opts = {}) {
    const profile = resolveTicketPrinter(department);
    if (!profile) return print(lines, opts);
    return printToPrinter(lines, { ...opts, transport: profile.transport, endpoint: profile.endpoint });
  }

  return {
    settings,
    printOnSave,
    printGuestCheckWhenUnsettled,
    printOnSettle,
    printOnVoid,
    printFoodTicketOnOrder,
    printFoodTicketOnItemAdded,
    ticketPrinters,
    departmentRouting,
    defaultTicketPrinterId,
    transport,
    endpoint,
    saveSettings,
    reset,
    print,
    resolveTicketPrinter,
    addTicketPrinter,
    removeTicketPrinter,
    printFoodTicket,
  };
});
