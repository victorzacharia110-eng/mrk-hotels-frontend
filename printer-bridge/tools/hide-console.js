'use strict';

/**
 * Flips a Windows PE executable's subsystem field to GUI (2) so it runs with NO
 * console window — it looks like a normal desktop app. The MRK bridge shows its
 * UI via the native setup wizard instead of a console.
 *
 * Usage: node hide-console.js path\to\app.exe
 *
 * PE layout: DOS header has an e_lfanew pointer at 0x3C to the PE signature,
 * then the COFF header (20 bytes), then the optional header. The Subsystem
 * field lives at offset 68 in the optional header for both PE32 and PE32+.
 */

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('usage: node hide-console.js <exe>');
  process.exit(1);
}

const buf = fs.readFileSync(file);

if (buf.readUInt16LE(0) !== 0x5a4d) {
  console.error('not a PE file (missing MZ)');
  process.exit(1);
}
const peOff = buf.readUInt32LE(0x3c);
if (buf.readUInt32LE(peOff) !== 0x00004550) {
  console.error('not a PE file (missing PE\\0\\0)');
  process.exit(1);
}

const subsystemOff = peOff + 24 + 68;
const before = buf.readUInt16LE(subsystemOff);
buf.writeUInt16LE(2, subsystemOff); // 2 = IMAGE_SUBSYSTEM_WINDOWS_GUI
fs.writeFileSync(file, buf);

console.log(`  5/5 PE subsystem ${before} -> 2 (GUI, no console window)`);
