'use strict';

const http = require('http');
const config = require('./config');
const { rawPrint } = require('./windows-print');
const { renderSetupPage } = require('./setup-page');
const { discoverPrinters } = require('./discover');
const install = require('./install');

const VERSION = '1.2.0';
const MAX_BODY = 2 * 1024 * 1024; // 2 MB of raw bytes is generous for a receipt

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function setCors(res) {
  const origin = config.allowedOrigin;
  res.setHeader('Access-Control-Allow-Origin', origin === '*' ? '*' : origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function authorized(req) {
  if (!config.authToken) return true;
  const header = req.headers['x-auth-token'] || req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  return token === config.authToken;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // ---- health / discovery ----
  const reqPath = req.url.split('?')[0];
  if (req.method === 'GET' && reqPath === '/health') {
    const health = {
      ok: true,
      name: 'mrk-printer-bridge',
      platform: process.platform,
      transport: config.transport,
      printer:
        config.transport === 'network'
          ? `${config.printerHost}:${config.printerPort}`
          : config.printerName || '(Windows default printer)',
      auth: !!config.authToken,
      version: VERSION,
    };
    // For a network printer, probe reachability so the setup page can tell the
    // operator whether they still need the direct-cable connection fix. Only
    // when ?probe=1 (the setup page) — the app's own /health poll stays instant.
    if (config.transport === 'network' && config.printerHost && req.url.includes('probe=1')) {
      health.reachable = await install.canReachPrinter(config.printerHost, config.printerPort);
    }
    return send(res, 200, health);
  }

  // ---- setup page (open http://localhost:9720/ in a browser) ----
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    return sendHtml(res, 200, renderSetupPage({ configPath: config.configPath, version: VERSION }));
  }

  // ---- printer settings (read by the setup page; also handy for the app) ----
  if (req.method === 'GET' && req.url === '/config') {
    return send(res, 200, {
      ok: true,
      printerHost: config.printerHost,
      printerPort: config.printerPort,
      transport: config.transport,
      configPath: config.configPath,
      version: VERSION,
    });
  }
  if (req.method === 'POST' && req.url === '/config') {
    if (!authorized(req)) return send(res, 401, { ok: false, error: 'Unauthorized' });
    let payload;
    try {
      const raw = await readBody(req);
      payload = raw.length ? JSON.parse(raw.toString('utf8')) : {};
    } catch {
      return send(res, 400, { ok: false, error: 'Invalid JSON body' });
    }
    try {
      const saved = config.setPrinter(payload.printerHost, payload.printerPort);
      if (config.verbose) console.log(`[config] printer set to ${saved.printerHost || '(none)'}:${saved.printerPort}`);
      return send(res, 200, {
        ok: true,
        printer: saved.transport === 'network' ? `${saved.printerHost}:${saved.printerPort}` : '(Windows queue)',
        printerHost: saved.printerHost,
        printerPort: saved.printerPort,
        transport: saved.transport,
        configPath: saved.configPath,
      });
    } catch (e) {
      return send(res, 500, { ok: false, error: 'Could not save settings: ' + e.message });
    }
  }

  // ---- discover printers on the local network (used by the setup page) ----
  if (req.method === 'GET' && req.url === '/discover') {
    try {
      const result = await discoverPrinters();
      return send(res, 200, { ok: true, ...result });
    } catch (e) {
      return send(res, 500, { ok: false, error: e.message });
    }
  }

  // ---- direct-cable network fix (elevates via a single UAC prompt) ----
  if (req.method === 'POST' && req.url === '/setup/link') {
    if (!authorized(req)) return send(res, 401, { ok: false, error: 'Unauthorized' });
    let payload = {};
    try {
      const raw = await readBody(req);
      payload = raw.length ? JSON.parse(raw.toString('utf8')) : {};
    } catch {
      payload = {};
    }
    const target = String(payload.printerHost || config.printerHost || '').trim();
    if (!target) return send(res, 400, { ok: false, error: 'No printer address set yet.' });
    const result = install.runElevatedNetworkFix(target);
    return send(res, result.ok ? 200 : 500, {
      ok: result.ok,
      message: result.message,
      printerHost: target,
    });
  }

  // ---- printing ----
  if (req.method === 'POST' && req.url === '/print') {
    if (!authorized(req)) return send(res, 401, { ok: false, error: 'Unauthorized' });
    let bytes;
    try {
      bytes = await readBody(req);
    } catch (e) {
      return send(res, 413, { ok: false, error: e.message });
    }
    if (bytes.length === 0) return send(res, 400, { ok: false, error: 'Empty body' });
    try {
      const used = await rawPrint(bytes);
      if (config.verbose) console.log(`[print] ${bytes.length} bytes -> ${used}`);
      return send(res, 200, { ok: true, bytes: bytes.length, printer: used });
    } catch (e) {
      return send(res, 500, { ok: false, error: e.message });
    }
  }

  return send(res, 404, { ok: false, error: 'Not found' });
});

server.listen(config.port, config.host, () => {
  console.log('MRK printer bridge listening on http://' + config.host + ':' + config.port);
  console.log('Set the printer address here: http://localhost:' + config.port + '/');
  console.log('Auth token: ' + (config.authToken ? '(set)' : '(disabled)'));
  if (config.transport === 'network') {
    console.log('Printer: network ' + config.printerHost + ':' + config.printerPort);
  } else if (process.platform !== 'win32') {
    console.log('WARNING: no PRINTER_HOST set and not running on Windows; printing will FAIL here. Run this on the Windows printer PC, or set PRINTER_HOST.');
  } else {
    console.log('Printer: Windows queue ' + (config.printerName || '(default)'));
  }

  // Single-file .exe, first run, nothing configured yet: open the setup page so
  // a non-technical user can type the printer's address. Opt out with MRK_NO_BROWSER=1.
  if (config.singleFile && process.platform === 'win32' && !config.hasConfigFile && !process.env.MRK_NO_BROWSER) {
    const url = 'http://localhost:' + config.port + '/';
    try {
      require('child_process').exec('start "" "' + url + '"');
    } catch {
      // Non-fatal: the user can open the URL manually.
    }
  }
});

process.on('uncaughtException', (e) => console.error('Fatal:', e.message));
