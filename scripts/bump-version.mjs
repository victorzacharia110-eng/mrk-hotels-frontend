/**
 * Bumps the app version stored in src/version.json.
 *
 * Runs automatically before `npm run dev` and `npm run build` (via the
 * predev/prebuild npm hooks) so the version displayed on the login page rises
 * with every build. Patch number increments; major/minor are preserved.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const file = resolve(here, '../src/version.json')

let current = { version: '1.0.0' }
try {
  current = JSON.parse(readFileSync(file, 'utf8'))
} catch {
  /* Fall back to the default when the file is missing or malformed. */
}

const [major, minor, patch] = String(current.version ?? '1.0.0').split('.')
const next = `${major || '1'}.${minor || '0'}.${Number(patch || 0) + 1}`

writeFileSync(file, JSON.stringify({ version: next }, null, 2) + '\n')
console.log(`App version ${current.version ?? '1.0.0'} -> ${next}`)
