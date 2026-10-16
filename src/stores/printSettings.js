/**
 * Print settings store — the cashier panel's "Cloud Print Settings".
 *
 * Mirrors the print-on-event toggles common to POS systems (e.g. E-Zee):
 * decide WHEN a receipt or guest check should go to the till printer.
 *
 * Every printer is described to QZ Tray as a "target" (see @/utils/printer):
 *   { kind: 'system', printer: 'ZyWell Zy-Q822', label: 'Front desk' }
 *   { kind: 'socket', host: '192.168.1.100', port: 9100, label: 'Kitchen' }
 * The till printer (receipts) and every ticket printer share that shape, so a
 * USB printer on this machine and an Ethernet printer in the kitchen are
 * configured the same way.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { printerState, printToPrinter, targetUsable, targetLabel, listPrinters, connectReason } from "@/utils/printer";

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
  // The till printer (receipts, guest checks, reports): a QZ target or null.
  tillPrinter: null,
  // Named printer profiles a food ticket can be routed to. Ids are stable so a
  // route pointing at a deleted printer degrades to the till printer instead
  // of silently dropping the ticket.
  ticketPrinters: [],
  // Which printer each service line's tickets go to, by profile id.
  departmentRouting: {},
  // Which printer each PHYSICAL pass goes to, by profile id. A menu item's
  // `printer_station` picks the pass; this picks the printer on that pass.
  stationRouting: {},
  // Profile used when a service line has no route of its own, or its route
  // points at a printer that has since been deleted.
  defaultTicketPrinterId: "",
};

/**
 * Best-effort conversion of a legacy bridge endpoint (http://HOST:PORT) into a
 * QZ raw-socket target. The old bridge lived on the printer's own machine, so
 * its host was the printer's address; the raw ESC/POS port is 9100. A loopback
 * endpoint cannot be mapped (the bridge hid the real address), so it returns
 * null and the operator re-selects the printer once.
 *
 * @param {unknown} endpoint  The old bridge base URL.
 * @param {string} label  Human label for the converted target.
 * @returns {object|null} A QZ target, or null when it cannot be derived.
 */
function endpointToTarget(endpoint, label) {
  if (typeof endpoint !== "string") return null;
  const match = endpoint.match(/^https?:\/\/([^/:]+)(?::(\d+))?/i);
  if (!match) return null;
  const host = match[1];
  if (["localhost", "127.0.0.1", "::1"].includes(host.toLowerCase())) return null;
  return { kind: "socket", host, port: 9100, label };
}

/**
 * Brings a saved blob forward onto the QZ-target shape. Old blobs carried a
 * `transport`/`endpoint` pair (and per-printer `endpoint`s) from the retired
 * bridge agent; those are converted where the printer can be located and
 * dropped otherwise, along with any route that pointed at a dropped printer.
 *
 * @param {object} saved  The parsed localStorage blob.
 * @returns {object} A settings object on the current shape.
 */
function migrate(saved) {
  const next = { ...DEFAULTS, ...saved };
  delete next.transport;
  delete next.endpoint;

  if (!targetUsable(next.tillPrinter) && saved.endpoint) {
    next.tillPrinter = endpointToTarget(saved.endpoint, "Till printer");
  }

  if (Array.isArray(next.ticketPrinters)) {
    next.ticketPrinters = next.ticketPrinters
      .map((p) => {
        // Already a QZ target — leave it untouched.
        if (p && (p.kind || p.printer || p.host)) return p;
        const target = endpointToTarget(p?.endpoint, p?.name || "Printer");
        if (!target || !p?.id) return null;
        return { id: p.id, ...target };
      })
      .filter(Boolean);
  }

  const kept = new Set(next.ticketPrinters.map((p) => p.id));
  const prune = (map) =>
    Object.fromEntries(Object.entries(map || {}).filter(([, id]) => kept.has(id)));
  next.departmentRouting = prune(next.departmentRouting);
  next.stationRouting = prune(next.stationRouting);
  if (next.defaultTicketPrinterId && !kept.has(next.defaultTicketPrinterId)) {
    next.defaultTicketPrinterId = "";
  }
  return next;
}

function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed && typeof parsed === "object") return migrate(parsed);
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
  const tillPrinter = computed(() => settings.value.tillPrinter);
  const ticketPrinters = computed(() => settings.value.ticketPrinters);
  const departmentRouting = computed(() => settings.value.departmentRouting);
  // Exposed because the settings screen edits the pass routes. Without this the
  // page had no way to read the current mapping, so the pass table rendered
  // blank and saving wrote a fresh map over the top of the old one.
  const stationRouting = computed(() => settings.value.stationRouting || {});
  const defaultTicketPrinterId = computed(() => settings.value.defaultTicketPrinterId);

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
   * The printer receipts should go to.
   *
   * The till printer is the primary setting, but a till whose receipts were
   * never pointed at one still prints to the default ticket printer (or any
   * configured printer) rather than dropping the receipt on the floor.
   */
  function resolveTillPrinter() {
    const s = settings.value;
    if (targetUsable(s.tillPrinter)) return s.tillPrinter;
    const printers = s.ticketPrinters || [];
    const preferred = printers.find((p) => p.id === s.defaultTicketPrinterId);
    if (targetUsable(preferred)) return preferred;
    return printers.find((p) => targetUsable(p)) || null;
  }

  /**
   * Sends receipt lines to the till printer through QZ Tray. Returns true when
   * the job was handed to the printer.
   */
  async function print(lines, opts = {}) {
    return printToPrinter(lines, { ...opts, printer: resolveTillPrinter() });
  }

  /**
   * Connects to QZ Tray and confirms the configured printer is present, so the
   * UI can say "ready" without having to print a test slip.
   *
   * @returns {Promise<boolean>} True when QZ Tray answered and the target exists.
   */
  async function probePrinter() {
    const target = resolveTillPrinter();
    try {
      const printers = await listPrinters();
      if (target?.kind === "system" && target.printer && !printers.includes(target.printer)) {
        printerState.connected = false;
        printerState.reason = `“${target.printer}” was not found on this computer. Check the printer is installed and switched on, then re-select it in Printer Settings.`;
        return false;
      }
      printerState.connected = true;
      printerState.reason = "";
      printerState.info = target ? targetLabel(target) : "QZ Tray";
      return true;
    } catch (err) {
      printerState.connected = false;
      printerState.reason = connectReason(err);
      return false;
    }
  }

  /**
   * The printer a service line's food tickets should go to.
   *
   * A route whose printer has been deleted falls back to the default profile
   * rather than to nothing: a mis-typed ticket still gets in front of the
   * kitchen, which beats it vanishing into a drawer.
   */
  function resolveTicketPrinter(department, station) {
    const printers = settings.value.ticketPrinters;
    const byId = new Map(printers.map((p) => [p.id, p]));
    // The station's own route wins, then the service line's, then the default.
    const routed = station
      ? settings.value.stationRouting?.[station]
      : settings.value.departmentRouting?.[department];
    const lineRouted = settings.value.departmentRouting?.[department];
    return (
      byId.get(routed) || byId.get(lineRouted) ||
      byId.get(settings.value.defaultTicketPrinterId) ||
      null
    );
  }

  /**
   * Adds a named printer profile and returns its id.
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
      stationRouting: Object.fromEntries(
        Object.entries(settings.value.stationRouting || {}).filter(
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
    const { station, ...rest } = opts;
    const profile = resolveTicketPrinter(department, station);
    return printToPrinter(lines, { ...rest, printer: profile || resolveTillPrinter() });
  }

  /**
   * Sends one order's tickets, split by the printer each line is filed under.
   *
   * A single order routinely holds both food and drinks, so a ticket that is
   * printed in one piece sends drinks to the kitchen pass. This walks the passes
   * that actually have lines and prints one ticket per pass, skipping any pass
   * the manager has switched off.
   *
   * @param {(station: string) => Promise<Array>} buildLines  Builds the rows for a pass.
   * @param {string} department  Service line the order was rung in.
   * @param {object} [opts]  Passed through to the print call, plus an optional
   *   `hasLinesFor(station)` predicate deciding whether a pass has anything to
   *   print at all.
   * @returns {Promise<{attempted: string[], failed: string[]}>} Passes tried, and
   *   those that failed to print.
   */
  async function printFoodTicketsByStation(buildLines, department, opts = {}) {
    const { hasLinesFor, ...rest } = opts;
    const attempted = [];
    const failed = [];
    for (const station of ['kitchen', 'bar']) {
      // A pass with no lines for this order must not send a blank ticket: an
      // empty slip in the kitchen reads as a real ticket for nothing.
      if (hasLinesFor && !hasLinesFor(station)) continue;
      const lines = await buildLines(station);
      attempted.push(station);
      try {
        const ok = await printFoodTicket(lines, department, { ...rest, station });
        if (!ok) failed.push(station);
      } catch {
        // Keep going: the other pass still has a ticket that must go out.
        failed.push(station);
      }
    }
    return { attempted, failed };
  }

  return {
    settings,
    printOnSave,
    printGuestCheckWhenUnsettled,
    printOnSettle,
    printOnVoid,
    printFoodTicketOnOrder,
    printFoodTicketOnItemAdded,
    tillPrinter,
    ticketPrinters,
    departmentRouting,
    stationRouting,
    defaultTicketPrinterId,
    saveSettings,
    reset,
    resolveTillPrinter,
    print,
    probePrinter,
    resolveTicketPrinter,
    addTicketPrinter,
    removeTicketPrinter,
    printFoodTicket,
    printFoodTicketsByStation,
  };
});
