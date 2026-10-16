'use strict';

/**
 * Console-safe logger.
 *
 * The packaged Windows .exe is built as a GUI-subsystem binary so it shows NO
 * console window (it looks like a normal desktop app). In that mode there is no
 * stdout, so writing to it can fail. This routes every message either to a real
 * console (when one exists — running `node src/server.js` during development) or
 * to a log file next to the system temp dir, and never throws.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const LOG_FILE = path.join(os.tmpdir(), 'mrk-printer-bridge.log');
let fileStream;

function toFile(line) {
  try {
    if (!fileStream) fileStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
    fileStream.write(line + '\n');
  } catch {
    // Logging must never crash the bridge.
  }
}

function toConsole(line) {
  try {
    if (process.stdout && process.stdout.isTTY) process.stdout.write(line + '\n');
  } catch {
    // No console (GUI subsystem build) — ignore.
  }
}

function fmt(args) {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.message;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

function line(level, args) {
  const text = `${new Date().toISOString()} ${level} ${fmt(args)}`;
  toConsole(text);
  toFile(text);
}

module.exports = {
  log: (...a) => line('INFO', a),
  error: (...a) => line('ERROR', a),
  LOG_FILE,
};
