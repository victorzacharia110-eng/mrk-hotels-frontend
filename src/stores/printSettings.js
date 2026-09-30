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
  // Which printer each PHYSICAL pass (manager review item 4) goes to, by profile
  // id. A menu item's `printer_station` picks the pass; this picks the printer
  // on that pass. Falls back to the service line's route, then the default.
  stationRouting: {},
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
  // Exposed because the settings screen edits the pass routes. Without this the
  // page had no way to read the current mapping, so the pass table rendered
  // blank and saving wrote a fresh map over the top of the old one.
  const stationRouting = computed(() => settings.value.stationRouting || {});
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
  function resolveTicketPrinter(department, station) {
    const printers = settings.value.ticketPrinters;
    const byId = new Map(printers.map((p) => [p.id, p]));
    // The station's own route wins, then the service line's, then the default.
    // A route pointing at a deleted printer is skipped rather than honoured,
    // so a mis-typed ticket still gets in front of somebody.
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
      // The station routes point at the same profiles, so they have to be
      // cleared here too. A dangling entry was survivable -- resolution skips
      // an unknown id and falls back -- but it left the settings screen showing
      // a printer that no longer exists.
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
   *
   * `station` narrows the routing to a physical pass ('kitchen' | 'bar'), which
   * is how a menu item's `printer_station` reaches the right machine when the
   * hotel runs a separate bar printer.
   */
  async function printFoodTicket(lines, department, opts = {}) {
    const { station, ...rest } = opts;
    const profile = resolveTicketPrinter(department, station);
    if (!profile) return print(lines, rest);
    return printToPrinter(lines, { ...rest, transport: profile.transport, endpoint: profile.endpoint });
  }

  /**
   * Sends one order's tickets, split by the printer each line is filed under.
   *
   * A single order routinely holds both food and drinks, so a ticket that is
   * printed in one piece sends drinks to the kitchen pass. This walks the passes
   * that actually have lines and prints one ticket per pass, skipping any pass
   * the manager has switched off, so the kitchen ticket carries only food and
   * the bar ticket only drinks.
   *
   * Returns which passes were tried and which refused the job, so the caller
   * can tell "this order had nothing to cook or pour" apart from "the printer
   * did not take it". The two used to be indistinguishable: every pass that was
   * attempted was reported as printed, so a refused job looked like a success
   * and nothing was ever reported to the manager.
   *
   * One dead printer no longer costs the other pass its ticket. A broken kitchen
   * printer used to throw out of the loop before the bar ticket was built, so
   * drinks on an order with food went missing exactly when the kitchen was
   * already in trouble.
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
      // empty slip in the kitchen reads as a real ticket for nothing. The test
      // is on the ORDER's lines, not the built rows, because a formatted
      // ticket always carries the letterhead and order number and would
      // therefore never look empty.
      if (hasLinesFor && !hasLinesFor(station)) continue;
      const lines = await buildLines(station);
      attempted.push(station);
      try {
        // `printFoodTicket` reports whether the job was actually taken. That
        // answer used to be discarded, which is what made a refused print look
        // like a delivered one.
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
    ticketPrinters,
    departmentRouting,
    stationRouting,
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
    printFoodTicketsByStation,
  };
});
