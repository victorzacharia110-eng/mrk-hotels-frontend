'use strict';

/**
 * Configuration for the MRK printer bridge agent.
 *
 * Values are read, in order of priority:
 *   1. environment variables (handy for a one-off `node src/server.js`)
 *   2. `config.local.json` (handy for the auto-start Windows task / the
 *      single-file .exe, which have no window to type variables into). It sits
 *      next to the executable for the .exe build, or in the package root for a
 *      normal node run, and can be written from the built-in setup page.
 *   3. the baked-in default (single-file .exe build only) and the values below
 *
 * The printer target is mutable at runtime: POST /config (or the setup page at
 * http://localhost:9720/) calls setPrinter(), which writes config.local.json
 * and applies the new address immediately — no restart, no rebuild.
 *
 * Environment variables:
 *
 *   HOST          - interface to bind (default 0.0.0.0 = all interfaces)
 *   PORT          - port to listen on (default 9720)
 *   AUTH_TOKEN    - optional shared secret the web app must send (recommended)
 *   PRINTER_NAME  - Windows printer queue to print to (empty = default). Used
 *                   only in the Windows-spool mode.
 *   PRINTER_HOST  - IP/hostname of a NETWORK thermal printer (e.g. an Ethernet
 *                   printer). When set, the agent talks to the printer over a
 *                   raw TCP socket instead of the Windows spooler — no driver
 *                   needed. This is how you print to an Ethernet printer.
 *   PRINTER_PORT  - TCP port of the network printer (default 9100, the common
 *                   "raw"/JetDirect port thermal printers listen on).
 *   ALLOWED_ORIGIN - CORS origin allowed to call the agent, or '*' for any
 *   PRINT_VERBOSE - log each print job to the console
 */

const fs = require('fs');
const path = require('path');

function boolish(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

// Single-file .exe (Node SEA) detection. `node:sea` exists on Node >= 20.12;
// the try/catch keeps this safe on anything older or if the module is missing.
let isSea = false;
try {
  isSea = require('node:sea').isSea();
} catch {
  isSea = false;
}

const CONFIG_FILENAME = 'config.local.json';

// Where config.local.json lives:
//   - single-file .exe: the folder that holds the executable
//   - normal node run : the package root, one level up from src/
const configDir = isSea ? path.dirname(process.execPath) : path.join(__dirname, '..');
const configFile = path.join(configDir, CONFIG_FILENAME);

/** Reads the on-disk override file, tolerating a missing/malformed file. */
function readLocal() {
  for (const file of [configFile, path.join(__dirname, CONFIG_FILENAME), path.join(__dirname, '..', CONFIG_FILENAME)]) {
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    } catch {
      // Ignore an unreadable/malformed file and keep looking.
    }
  }
  return {};
}

let local = readLocal();

// Baked-in defaults, set only by the single-file .exe build (src/sea-entry.js).
// Priority stays: env var > config.local.json > baked default.
const seaDefaults = globalThis.__MRK_SEA_DEFAULTS || {};

function pick(envKey, fileKey, fallback) {
  if (process.env[envKey] !== undefined && process.env[envKey] !== '') {
    return process.env[envKey];
  }
  if (local[fileKey] !== undefined && local[fileKey] !== null && local[fileKey] !== '') {
    return local[fileKey];
  }
  return fallback;
}

const config = {
  host: pick('HOST', 'host', '0.0.0.0'),
  port: Number(pick('PORT', 'port', 9720)),
  authToken: pick('AUTH_TOKEN', 'authToken', ''), // empty = auth disabled
  printerName: pick('PRINTER_NAME', 'printerName', ''), // empty = Windows default printer
  printerHost: '', // empty = Windows spooler mode (filled below)
  printerPort: 9100,
  allowedOrigin: pick('ALLOWED_ORIGIN', 'allowedOrigin', '*'),
  verbose: boolish(pick('PRINT_VERBOSE', 'verbose', ''), false),
  // Which transport will actually be used, for /health and log messages.
  transport: 'windows',
  // Absolute path of the config.local.json that setPrinter() writes, so the
  // setup page can tell the operator exactly where settings are saved.
  configPath: configFile,
  // True when running as the single-file .exe (Node SEA) — used to auto-open
  // the setup page on first run.
  singleFile: isSea,
  // True when a config.local.json already existed at startup (so we don't nag
  // with the setup page once the printer has been configured).
  hasConfigFile: fs.existsSync(configFile),
};

/** Recomputes printerHost/printerPort from env + file + baked defaults. */
function applyPrinter() {
  config.printerHost = pick('PRINTER_HOST', 'printerHost', seaDefaults.printerHost || '');
  config.printerPort = Number(pick('PRINTER_PORT', 'printerPort', seaDefaults.printerPort || 9100));
  config.transport = config.printerHost ? 'network' : 'windows';
}

applyPrinter();

/**
 * Persists the printer target to config.local.json and applies it immediately.
 * Other keys already in the file (authToken, host, ...) are preserved.
 *
 * Note: a PRINTER_HOST / PRINTER_PORT environment variable still wins over the
 * saved file, matching the documented priority order.
 *
 * @param {string} host  Printer IP or hostname ('' clears it → Windows spooler).
 * @param {number} port  Printer TCP port (defaults to 9100).
 */
function setPrinter(host, port) {
  const next = { ...local };
  next.printerHost = String(host == null ? '' : host).trim();
  next.printerPort = Number(port) || 9100;

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(next, null, 2) + '\n', 'utf8');

  local = next;
  applyPrinter();

  return {
    printerHost: config.printerHost,
    printerPort: config.printerPort,
    transport: config.transport,
    configPath: configFile,
  };
}

/** Re-reads config.local.json from disk (used by POST /config refresh). */
function reload() {
  local = readLocal();
  applyPrinter();
}

config.setPrinter = setPrinter;
config.reload = reload;

module.exports = config;
