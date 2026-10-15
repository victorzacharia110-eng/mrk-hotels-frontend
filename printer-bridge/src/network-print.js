'use strict';

const net = require('net');
const config = require('./config');

/**
 * Streams raw ESC/POS bytes straight to a network thermal printer.
 *
 * Nearly every Ethernet receipt printer listens on TCP port 9100 (the "raw" or
 * HP JetDirect port) and prints whatever bytes arrive on it, exactly like the
 * spooler would in RAW mode. That makes this the cleanest path for an Ethernet
 * printer: we open a socket to the printer and write the same byte buffer we
 * would otherwise hand to the Windows queue — no driver in the middle, and the
 * agent can run on any computer that can reach the printer.
 *
 * @param {Buffer} bytes  Raw ESC/POS bytes to print.
 * @param {{host?: string, port?: number}} [target]  Override the configured printer.
 * @returns {Promise<string>} "host:port" on success.
 */
function printRawToNetwork(bytes, target = {}) {
  const host = target.host || config.printerHost;
  const port = Number(target.port || config.printerPort || 9100);
  const label = `${host}:${port}`;

  return new Promise((resolve, reject) => {
    if (!host) return reject(new Error('No network printer host configured (set PRINTER_HOST).'));

    let settled = false;
    let hardTimer = null;
    let graceTimer = null;

    const socket = new net.Socket();
    const finish = (err) => {
      if (settled) return;
      settled = true;
      if (hardTimer) clearTimeout(hardTimer);
      if (graceTimer) clearTimeout(graceTimer);
      if (err) {
        socket.destroy();
        reject(err);
      } else {
        resolve(label);
      }
    };

    // A printer that is off, on the wrong IP, or firewalled must not hang the
    // print request forever — fail within a few seconds with a clear message.
    hardTimer = setTimeout(
      () => finish(new Error(`Timed out talking to the printer at ${label}. Is it on and reachable?`)),
      8000
    );

    socket.once('error', (e) =>
      finish(new Error(`Could not reach the printer at ${label} (${e.message}).`))
    );

    socket.connect(port, host, () => {
      socket.write(bytes, (err) => {
        if (err) return finish(new Error(`Could not send data to the printer at ${label} (${err.message}).`));
        // Half-close so the printer sees end-of-job. Some printers never send a
        // FIN back, so we resolve once the socket closes OR after a short grace
        // window, whichever comes first — instead of waiting on the printer.
        socket.end();
        graceTimer = setTimeout(() => finish(null), 1500);
        socket.once('close', () => finish(null));
      });
    });
  });
}

module.exports = { printRawToNetwork };
