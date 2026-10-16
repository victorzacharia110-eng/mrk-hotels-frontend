'use strict';

const log = require('./log');

// Baked defaults so the single-file .exe works with zero configuration.
// A config.local.json next to the exe (written by the setup wizard), or
// PRINTER_HOST / PRINTER_PORT env vars, still override these — priority in
// config.js is env > config.local.json > these baked defaults.
globalThis.__MRK_SEA_DEFAULTS = {
  printerHost: process.env.MRK_DEFAULT_PRINTER_HOST || '192.168.1.100',
  printerPort: Number(process.env.MRK_DEFAULT_PRINTER_PORT || 9100),
};

const ARGS = process.argv.slice(2);
const SERVE_ONLY = ARGS.includes('--serve'); // used by Windows auto-start: no UI

// ---- first-run install (Windows, zero-admin) --------------------------------
// On the very first double-click this copies the exe into %LOCALAPPDATA% and
// registers per-user auto-start, then hands off to the installed copy so the
// running instance always matches what will start with Windows. No-op on every
// later launch, and no-op on non-Windows platforms.
const install = require('./install');

const installResult = install.ensureInstalled();
if (installResult.needsRestart && installResult.target) {
  log.log('First run — installing...');
  install.relaunch(installResult.target, ARGS);
  process.exit(0);
}

// When the bridge HTTP server is listening, show the wizard (unless this is the
// silent auto-start launch or the user opted out). Windows-only: on other
// platforms the agent is started with `node src/server.js` and shows no UI.
globalThis.__MRK_ON_LISTEN = () => {
  if (process.platform !== 'win32') return;
  if (SERVE_ONLY) return;
  if (process.env.MRK_NO_WIZARD === '1') {
    install.openBrowser(`http://localhost:${require('./config').port}/`);
    return;
  }
  if (!install.openWizard()) {
    // PowerShell/wizard unavailable — fall back to the browser setup page.
    install.openBrowser(`http://localhost:${require('./config').port}/`);
  }
};

require('./server.js');
