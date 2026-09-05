'use strict';

/**
 * Configuration for the MRK printer bridge agent.
 *
 * All values can be overridden with environment variables so the agent can be
 * run unchanged across machines:
 *
 *   HOST        - interface to bind (default 0.0.0.0 = all interfaces)
 *   PORT        - port to listen on (default 9720)
 *   AUTH_TOKEN  - optional shared secret the web app must send (recommended)
 *   ALLOWED_ORIGIN - CORS origin allowed to call the agent, or '*' for any
 */

function boolish(value, fallback) {
  if (value === undefined) return fallback;
  const v = String(value).toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

module.exports = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 9720),
  authToken: process.env.AUTH_TOKEN || '', // empty = auth disabled
  printerName: process.env.PRINTER_NAME || '', // empty = Windows default printer
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
  verbose: boolish(process.env.PRINT_VERBOSE, false),
};
