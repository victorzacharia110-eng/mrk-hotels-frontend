# MRK Hotels — Review Batch 03 · Housekeeping Task Export (Problem & Solution)

**Module:** Housekeeping (Reporting) — **Status: Resolved** — **5 September 2026**

---

## 1. The Problem

Exporting the housekeeping task list to Excel/CSV produced a **spreadsheet that was hard to read and misaligned**: the right columns were missing or empty, and the column order came from somewhere arbitrary.

**What this meant in practice:**

- Managers could not rely on the export for daily housekeeping reports or handover sheets.
- Column headers and values did not line up, so the file needed manual rework before it was usable.
- Nothing told the export which columns to emit, so the generator guessed from the data it found.

## 2. Root Cause

- `HousekeepingPage.vue` called the shared `TableExportButton` **without passing `:columns`**, so the exporter's default behaviour took over.
- The shared exporter (`export.js`) reads values with flat `row[key]` access, but the housekeeping rows were **nested objects** (e.g. `{ room: { room_number, room_type, status } , assigned_to: {...}, ... }`). A flat accessor therefore produced empty or mangled cells for anything nested.
- Column order and naming were derived implicitly from the object keys (`humanizeKey`) instead of being declared, so the result was whatever order the API returned.

## 3. The Solution

### 3.1 Flatten the rows at the source

- `loadAllTasks()` now maps each task into a **flat, export-ready row** with explicit fields:

| Field | Meaning |
| --- | --- |
| `room` | Room number |
| `room_type` | Type of room |
| `pax` | Current guests |
| `house_status` | Housekeeping status (Clean/Dirty/…) |
| `assigned_to` | Assigned staff name |
| `room_status` | Occupancy status |
| `arrival` | Expected arrival |
| `departure` | Expected departure |
| `nights` | Number of nights |
| `status` | Task status |

### 3.2 Declare the columns explicitly

- The export button now receives `:columns="exportColumns"` with the exact, ordered list of column titles shown above.
- `exportColumns` is defined alongside the loader so the header order, title casing and row keys are always in agreement.

### 3.3 Result

- The exporter writes real values for every declared column because the rows it receives are flat and the columns it renders are declared — no guessing, no nesting traps.

## 4. Files Changed

| Area | File | Change |
| --- | --- | --- |
| Frontend | `src/pages/housekeeping/HousekeepingPage.vue` | `loadAllTasks` flattens export rows; `TableExportButton` given `:columns="exportColumns"` |

> Shared helpers (`TableExportButton.vue`, `export.js`) already existed and were reused unchanged.

## 5. Verification Results

- Frontend `vite build` — **clean**.
- Frontend Vitest suite — **107/107 passed**.
- Backend — no API changes; full suite **569 passed / 2305 assertions** (unchanged).

## 6. Result

The housekeeping export now produces a clean, flat spreadsheet with ten well-named columns (room, type, pax, housekeeping status, assigned staff, occupancy, arrival, departure, nights, status), ready for reporting and handover without manual cleanup.