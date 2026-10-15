'use strict';

// Baked defaults so the single-file .exe works with zero configuration.
// A config.local.json next to the exe (written by set-network-printer.bat), or
// PRINTER_HOST / PRINTER_PORT env vars, still override these — priority in
// config.js is env > config.local.json > these baked defaults.
globalThis.__MRK_SEA_DEFAULTS = {
  printerHost: process.env.MRK_DEFAULT_PRINTER_HOST || '192.168.1.100',
  printerPort: Number(process.env.MRK_DEFAULT_PRINTER_PORT || 9100),
};

require('./server.js');
