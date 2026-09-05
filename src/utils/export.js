/**
 * Client-side table export helpers (CSV / Excel / PDF).
 *
 * All three take an array of plain row objects plus an optional column map
 * ({ key, label }). When columns are omitted, every enumerable key of the
 * first row becomes a column. Files are produced entirely in the browser and
 * handed to saveBlob() for the actual download.
 */

import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { saveBlob } from './download'

// Keys that add no value to a human-readable export sheet.
const NOISE_KEYS = new Set(['tenant_id', 'created_at', 'updated_at', 'deleted_at'])

// Field names that carry a record's primary display label.
const NAME_KEYS = ['item_name', 'name', 'full_name', 'label', 'title', 'room_number', 'order_number', 'first_name', 'last_name']

/** True for technical identity/audit keys that should stay out of cells. */
function isNoiseKey(key) {
  return NOISE_KEYS.has(key) || key.startsWith('_')
}

/** Picks the primary displayable label from a record, or null. */
function primaryLabel(record) {
  for (const key of NAME_KEYS) {
    const value = record[key]
    if (value !== null && value !== undefined && String(value).trim() !== '') return String(value)
  }
  return null
}

/**
 * Renders a value as plain, human-readable text.
 *
 * The old implementation JSON.stringify'd nested objects and arrays, which put
 * raw braces/quoted keys into every cell and scrambled wide tables. Instead:
 *  - objects render as their primary label, falling back to "Key: Value" pairs;
 *  - arrays render as "Item xQty; Item xQty" (or the pair form for records
 *    without a name);
 *  - technical keys (ids, audit timestamps) are dropped.
 * No JSON ever reaches the sheet, so CSV/Excel/PDF are always readable.
 */
function readableCell(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value.map((item) => (item !== null && typeof item === 'object' ? recordText(item) : readableCell(item))).filter(Boolean).join('; ')
  }
  return recordText(value)
}

/** Describes a nested record, e.g. { item_name, quantity } -> "T Shirt x2". */
function recordText(record) {
  if (record === null || typeof record !== 'object') return readableCell(record)
  const label = primaryLabel(record)
  if (typeof record.quantity === 'number' && record.quantity > 1) {
    return `${label || 'Item'} x${record.quantity}`
  }
  if (label) return label
  const pairs = []
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined || value === '') continue
    if (isNoiseKey(key)) continue
    if (typeof value === 'object') continue
    pairs.push(`${humanizeKey(key)}: ${value}`)
  }
  return pairs.join(', ')
}

/** Reads a cell value out of a row as human-readable text. */
function cellValue(row, key) {
  return readableCell(row[key])
}

/** Turns a raw field key into a readable header ("subscription_plan" -> "Subscription Plan"). */
function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

/** Builds the column list for a set of rows when no explicit map was given. */
function columnsFor(rows, columns) {
  if (columns?.length) return columns
  if (!rows.length) return []
  return Object.keys(rows[0])
    .filter((key) => !['tenant_id', 'deleted_at'].includes(key))
    .map((key) => ({ key, label: humanizeKey(key) }))
}

/**
 * Exports rows as a CSV file (UTF-8 with BOM so Excel renders accents).
 * @param {string} filename - File name without extension.
 * @param {Array<Object>} rows - Row objects to export.
 * @param {Array<{key:string,label:string}>} [columns] - Column order + labels.
 */
export function exportCSV(filename, rows, columns) {
  const cols = columnsFor(rows, columns)
  if (!cols.length) return
  const head = cols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',')
  const body = rows.map((row) =>
    cols.map((c) => `"${cellValue(row, c.key).replace(/"/g, '""')}"`).join(','),
  )
  const blob = new Blob(['\ufeff' + [head, ...body].join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  saveBlob(blob, `${filename}.csv`)
}

/**
 * Exports rows as an Excel workbook (single sheet named `sheetName`).
 * @param {string} filename - File name without extension.
 * @param {Array<Object>} rows - Row objects to export.
 * @param {Array<{key:string,label:string}>} [columns] - Column order + headers.
 * @param {string} [sheetName] - Worksheet name (default "Data").
 */
export function exportExcel(filename, rows, columns, sheetName = 'Data') {
  if (!rows.length) return
  const cols = columnsFor(rows, columns)
  if (!cols.length) return
  const data = rows.map((row) => {
    const rowObj = {}
    for (const col of cols) rowObj[col.label] = cellValue(row, col.key)
    return rowObj
  })
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  const blob = new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveBlob(blob, `${filename}.xlsx`)
}

/**
 * Exports rows as a PDF with an optional title heading. Wide tables (more
 * than a handful of columns) switch to landscape with a smaller font so the
 * content stays readable instead of wrapping character-by-character.
 * @param {string} filename - File name without extension.
 * @param {Array<Object>} rows - Row objects to export.
 * @param {Array<{key:string,label:string}>} [columns] - Column order + labels.
 * @param {string} [title] - Optional heading printed above the table.
 */
export function exportPDF(filename, rows, columns, title) {
  const cols = columnsFor(rows, columns)
  if (!cols.length) return
  const landscape = cols.length > 7
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  let startY = 14
  if (title) {
    doc.setFontSize(12)
    doc.text(title, 14, 12)
    startY = 18
  }
  doc.autoTable({
    head: [cols.map((c) => c.label)],
    body: rows.map((row) =>
      cols.map((c) => {
        const text = cellValue(row, c.key)
        // Cap very long cells so a single giant value cannot warp the layout.
        return text.length > 400 ? `${text.slice(0, 397)}…` : text
      }),
    ),
    startY,
    styles: { fontSize: cols.length > 12 ? 6.5 : cols.length > 8 ? 7.5 : 9, cellPadding: cols.length > 8 ? 1 : 2, overflow: 'linebreak' },
    headStyles: { fillColor: [0, 94, 184] },
    margin: { top: 12, bottom: 12, left: 10, right: 10 },
  })
  doc.save(`${filename}.pdf`)
}

/**
 * Collects every row from a server-paginated endpoint by walking its pages.
 * The provided fetch function receives a page number and returns the axios
 * response (or a { data, meta } object) whose `.data` is the row list.
 * @param {Function} fetchPage - (page) => Promise resolving to response with .data array and .meta/.last_page.
 * @param {number} perPage - Page size to request (default 100; the API caps per_page at 100).
 * @returns {Promise<Array<Object>>} All rows across every page.
 */
export async function collectAllRows(fetchPage, perPage = 100) {
  const all = []
  let page = 1
  // Loop until a response with fewer than perPage rows (or without a last_page).

  while (true) {
    const res = await fetchPage(page, perPage)
    const data = res?.data?.data ?? res?.data ?? []
    const meta = res?.data?.meta
    all.push(...data)
    const lastPage = meta?.last_page ?? res?.data?.last_page
    if (lastPage !== undefined && page >= lastPage) break
    if (data.length < perPage) break
    page++
  }
  return all
}
