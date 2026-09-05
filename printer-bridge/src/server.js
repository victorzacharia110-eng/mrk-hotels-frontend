'use strict';

const http = require('http');
const config = require('./config');
const { rawPrint } = require('./windows-print');

const MAX_BODY = 2 * 1024 * 1024; // 2 MB of raw bytes is generous for a receipt

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
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
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, {
      ok: true,
      name: 'mrk-printer-bridge',
      platform: process.platform,
      printer: config.printerName || '(Windows default printer)',
      auth: !!config.authToken,
      version: '1.0.0',
    });
  }
  if (req.method === 'GET' && req.url === '/') {
    return send(res, 200, {
      ok: true,
      name: 'mrk-printer-bridge',
      description: 'MRK Hotels POS local printer bridge. POST raw ESC/POS bytes to /print.',
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
  console.log('Auth token: ' + (config.authToken ? '(set)' : '(disabled)'));
  if (process.platform !== 'win32') {
    console.log('WARNING: not running on Windows; printing will FAIL here. Run this on PC-2.');
  }
});

process.on('uncaughtException', (e) => console.error('Fatal:', e.message));
