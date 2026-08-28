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

/** Reads a cell value out of a row; objects are JSON-stringified. */
function cellValue(row, key) {
  const value = row[key]
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
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
  return Object.keys(rows[0]).map((key) => ({ key, label: humanizeKey(key) }))
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
    body: rows.map((row) => cols.map((c) => cellValue(row, c.key))),
    startY,
    styles: { fontSize: cols.length > 12 ? 6.5 : cols.length > 8 ? 7.5 : 9, cellPadding: cols.length > 8 ? 1 : 2 },
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
