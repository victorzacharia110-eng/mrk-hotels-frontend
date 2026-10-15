'use strict';

/**
 * Finds network printers on the local subnet(s).
 *
 * Most receipt/thermal printers listen on TCP port 9100 (the raw/JetDirect
 * port) and print whatever bytes arrive — so a host that accepts a connection
 * on 9100 is almost certainly the printer we want. We probe every host in the
 * /24 around each of the machine's own IPv4 addresses, concurrently, with a
 * short timeout, then read the OS ARP cache to attach MAC addresses (so an
 * installer can match the sticker on the printer).
 *
 * Zero dependencies — built on net/os only, so it bundles into the single-file
 * .exe unchanged.
 */

const net = require('net');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

const DEFAULT_PORTS = [9100];
const DEFAULT_TIMEOUT = 400; // ms per host
const DEFAULT_CONCURRENCY = 64;
const MAX_HOSTS = 1024; // safety cap (a /24 is 254 hosts)

/**
 * The machine's own non-internal IPv4 addresses and the /24 network of each.
 * A /24 is derived from the address itself, which covers the normal LAN case
 * (and the direct-cable /32 + host-route case too).
 */
function localSubnets() {
  const addresses = [];
  const bases = new Set();
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family !== 'IPv4' || info.internal) continue;
      addresses.push(info.address);
      const parts = info.address.split('.');
      if (parts.length === 4 && parts[0] !== '169' /* skip APIPA 169.254.x.x */) {
        bases.add(parts.slice(0, 3).join('.'));
      }
    }
  }
  return { addresses, subnets: [...bases] };
}

/** Resolves true if a TCP connection to ip:port succeeds within `timeout` ms. */
function checkPort(ip, port, timeout) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    try {
      socket.connect(port, ip);
    } catch {
      finish(false);
    }
  });
}

/** Runs `worker` over `items` with a bounded number in flight at once. */
async function runPool(items, worker, concurrency) {
  let next = 0;
  const runners = [];
  const size = Math.min(Math.max(1, concurrency), items.length);
  for (let k = 0; k < size; k++) {
    runners.push(
      (async () => {
        while (next < items.length) {
          const item = items[next++];
          await worker(item);
        }
      })()
    );
  }
  await Promise.all(runners);
}

/** Best-effort IP -> MAC map from the operating system's ARP cache. */
function readArpMap() {
  const map = {};
  try {
    if (process.platform === 'win32') {
      const out = execSync('arp -a', { timeout: 3000, windowsHide: true }).toString();
      const re = /(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-fA-F]{2}(?:-[0-9a-fA-F]{2}){5})/g;
      let m;
      while ((m = re.exec(out))) map[m[1]] = m[2].toLowerCase().replace(/-/g, ':');
    } else if (fs.existsSync('/proc/net/arp')) {
      const lines = fs.readFileSync('/proc/net/arp', 'utf8').split('\n').slice(1);
      for (const line of lines) {
        const c = line.trim().split(/\s+/);
        if (c.length >= 4 && /^\d/.test(c[0]) && c[3] !== '00:00:00:00:00:00') {
          map[c[0]] = c[3].toLowerCase();
        }
      }
    } else {
      const out = execSync('arp -an', { timeout: 3000 }).toString();
      const re = /\((\d{1,3}(?:\.\d{1,3}){3})\)\s+at\s+([0-9a-f:]{11,17})/g;
      let m;
      while ((m = re.exec(out))) map[m[1]] = m[2].toLowerCase();
    }
  } catch {
    // ARP data is a nicety, not a requirement.
  }
  return map;
}

function ipToLong(ip) {
  return ip.split('.').reduce((n, o) => (n << 8) + (Number(o) & 255), 0) >>> 0;
}

/**
 * Scans the local subnet(s) for printers.
 *
 * @param {{ports?: number[], timeout?: number, concurrency?: number}} [options]
 * @returns {Promise<{localAddresses: string[], subnets: string[], scanned: number, printers: {ip:string, ports:number[], mac:string|null}[]}>}
 */
async function discoverPrinters(options = {}) {
  const ports = options.ports && options.ports.length ? options.ports : DEFAULT_PORTS;
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const concurrency = options.concurrency || DEFAULT_CONCURRENCY;

  const { addresses, subnets } = localSubnets();
  const hostSet = new Set();
  for (const base of subnets) {
    for (let i = 1; i <= 254; i++) hostSet.add(`${base}.${i}`);
  }
  const targets = [...hostSet].slice(0, MAX_HOSTS);

  const found = [];
  await runPool(
    targets,
    async (ip) => {
      for (const port of ports) {
        if (await checkPort(ip, port, timeout)) {
          found.push({ ip, port });
          return;
        }
      }
    },
    concurrency
  );

  const arp = readArpMap();
  const byIp = new Map();
  for (const f of found) {
    if (!byIp.has(f.ip)) byIp.set(f.ip, { ip: f.ip, ports: [], mac: arp[f.ip] || null });
    byIp.get(f.ip).ports.push(f.port);
  }
  const printers = [...byIp.values()].sort((a, b) => ipToLong(a.ip) - ipToLong(b.ip));

  return { localAddresses: addresses, subnets, scanned: targets.length, printers };
}

module.exports = { discoverPrinters, localSubnets, DEFAULT_PORTS };
