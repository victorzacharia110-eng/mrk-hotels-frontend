'use strict';

// Baked defaults so the single-file .exe works with zero configuration.
// A config.local.json next to the exe (written by the setup page or the
// set-network-printer.bat helper), or PRINTER_HOST / PRINTER_PORT env vars,
// still override these — priority in config.js is env > config.local.json >
// these baked defaults.
globalThis.__MRK_SEA_DEFAULTS = {
  printerHost: process.env.MRK_DEFAULT_PRINTER_HOST || '192.168.1.100',
  printerPort: Number(process.env.MRK_DEFAULT_PRINTER_PORT || 9100),
};

// ---- first-run install (Windows, zero-admin) --------------------------------
// On the very first double-click this copies the exe into %LOCALAPPDATA% and
// registers per-user auto-start, then hands off to the installed copy so the
// running instance always matches what will start with Windows. No-op on every
// later launch, and no-op on non-Windows platforms.
const install = require('./install');

const installResult = install.ensureInstalled();
if (installResult.needsRestart && installResult.target) {
  console.log('MRK Printer Bridge — first run: installing, one moment...');
  install.relaunch(installResult.target);
  process.exit(0);
}

// Normal path: run the bridge agent.
require('./server.js');
