'use strict';

/**
 * Configuration for the MRK printer bridge agent.
 *
 * Values are read, in order of priority:
 *   1. environment variables (handy for a one-off `node src/server.js`)
 *   2. an optional `config.local.json` next to package.json (handy for the
 *      auto-start Windows task, which has no window to type variables into)
 *   3. the defaults below
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

/**
 * Loads the optional on-disk override file. Kept tiny and dependency-free so a
 * non-technical user can create it with the set-network-printer.bat helper.
 */
function loadLocal() {
  try {
    const file = path.join(__dirname, '..', 'config.local.json');
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
}

const local = loadLocal();

function pick(envKey, fileKey, fallback) {
  if (process.env[envKey] !== undefined && process.env[envKey] !== '') {
    return process.env[envKey];
  }
  if (local[fileKey] !== undefined && local[fileKey] !== null && local[fileKey] !== '') {
    return local[fileKey];
  }
  return fallback;
}

const printerHost = pick('PRINTER_HOST', 'printerHost', '');

module.exports = {
  host: pick('HOST', 'host', '0.0.0.0'),
  port: Number(pick('PORT', 'port', 9720)),
  authToken: pick('AUTH_TOKEN', 'authToken', ''), // empty = auth disabled
  printerName: pick('PRINTER_NAME', 'printerName', ''), // empty = Windows default printer
  printerHost, // empty = Windows spooler mode
  printerPort: Number(pick('PRINTER_PORT', 'printerPort', 9100)),
  allowedOrigin: pick('ALLOWED_ORIGIN', 'allowedOrigin', '*'),
  verbose: boolish(pick('PRINT_VERBOSE', 'verbose', ''), false),
  // Which transport will actually be used, for /health and log messages.
  transport: printerHost ? 'network' : 'windows',
};
