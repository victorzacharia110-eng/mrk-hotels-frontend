#!/usr/bin/env python3
"""Build the Inventory panel problems/solutions/status PDF."""
from html import escape
from pathlib import Path

from weasyprint import HTML

HERE = Path(__file__).parent
OUT = HERE / "MRK_Inventory_Panel_Fixes_Status.pdf"
DATE = "10 November 2026"
VERSION = "v1.0.164"
FRONTEND_COMMIT = "a77a722"
BACKEND_COMMIT = "6e2aa54"

SECTIONS = [
    (
        "1. Goods Received (PDF page 5)",
        [
            (
                "The goods received list still showed a Purchase Order column.",
                "Removed the PO column from the GRN list table. The PO reference remains on the GRN detail where it belongs.",
                "Done",
                "Inventory > Goods Received > list | src/pages/store/StoreGoodsReceivedPage.vue",
            ),
        ],
    ),
    (
        "2. Cash Register (PDF page 7)",
        [
            (
                "The calendar was not visible in the working toolbar, so the register could not be reviewed by business date.",
                "Moved the calendar into the main toolbar. The selected date is sent to the register API and controls the KPI summary.",
                "Done",
                "Inventory > Cash Register > toolbar | src/pages/store/StoreCashRegisterPage.vue",
            ),
            (
                "The summary did not change with the selected date; it always described the currently open shift.",
                "Added a date-aware daily summary endpoint. Opening float, floats added, expenses, sales, expected cash and remaining float now describe the selected day.",
                "Done",
                "Inventory > Cash Register > summary | app/Http/Controllers/Api/V1/Store/CashRegisterController.php",
            ),
            (
                "Added floats and cash expenses were not shown together, so FLOAT minus EXPENSES was not transparent.",
                "Replaced the expenses-only list with a combined Cash Movements table. Floats show as positive, expenses as negative, and the footer shows the net movement.",
                "Done",
                "Inventory > Cash Register > Cash Movements | src/pages/store/StoreCashRegisterPage.vue",
            ),
            (
                "Shift history could show old shifts and had no direct route to the full report browser.",
                "Shift history now requests the last 30 days, up to 100 rows, and includes a View Reports link to the store reports page.",
                "Done",
                "Inventory > Cash Register > Shift History | src/pages/store/StoreCashRegisterPage.vue | app/Http/Controllers/Api/V1/Store/CashRegisterController.php",
            ),
        ],
    ),
    (
        "3. Stock Counts (PDF page 12)",
        [
            (
                "The count sheet had no description field at the top.",
                "Added a Description textarea bound to the count sheet notes and saved it with the counted quantities.",
                "Done",
                "Inventory > Stock Counts > count sheet | src/pages/store/StoreStockCountsPage.vue | app/Http/Controllers/Api/V1/Inventory/PhysicalStockTakeController.php",
            ),
            (
                "Saving a count gave no confirmation and no autosave feedback.",
                "Added a save notice, dirty-input tracking and an autosaved time so the user can see that the count was stored.",
                "Done",
                "Inventory > Stock Counts > save feedback | src/pages/store/StoreStockCountsPage.vue",
            ),
            (
                "Count history used the wrong columns and did not open a detail view.",
                "History now shows Reference, Time, Items and Cost Value. Clicking a row opens a detail modal; search filters the history.",
                "Done",
                "Inventory > Stock Counts > History | src/pages/store/StoreStockCountsPage.vue",
            ),
        ],
    ),
    (
        "4. Stock Adjustments (PDF page 14)",
        [
            (
                "Items could not be added with a proper SI unit, so mass quantities were entered as bottles or other base units.",
                "Added SI unit selection per line. Quantities are converted to base units before saving, while the sheet keeps the entered unit and quantity for display.",
                "Done",
                "Inventory > Stock Adjustments > Add Item | src/pages/store/StoreStockAdjustPage.vue",
            ),
            (
                "The quantity removed was not shown in the lines table.",
                "The quantity column now uses Quantity Removed for wastage and consumption, and displays the line's entered unit.",
                "Done",
                "Inventory > Stock Adjustments > lines table | src/pages/store/StoreStockAdjustPage.vue",
            ),
            (
                "The item picker attached stock counts to item labels.",
                "Removed stock counts from the picker. It now lists registered item names, category, SI unit and reference cost only.",
                "Done",
                "Inventory > Stock Adjustments > item picker | src/pages/store/StoreStockAdjustPage.vue",
            ),
            (
                "Unit cost and cost value columns did not calculate correctly.",
                "Each line now calculates unit cost and total cost from the item's reference cost and the selected unit factor.",
                "Done",
                "Inventory > Stock Adjustments > Unit Cost / Cost Value | src/pages/store/StoreStockAdjustPage.vue",
            ),
            (
                "The filter used segmented switch buttons instead of a simple icon toggle.",
                "Replaced the switch buttons with an icon-only void filter toggle.",
                "Done",
                "Inventory > Stock Adjustments > filter icon | src/pages/store/StoreStockAdjustPage.vue",
            ),
            (
                "Saving could fail with a not-enough-stock error that was hard to understand.",
                "The sheet now makes the quantity removed explicit, converts SI units correctly, and shows the backend validation message. Normal save and void flows are covered by tests.",
                "Done",
                "Inventory > Stock Adjustments > Save | src/pages/store/StoreStockAdjustPage.vue | app/Http/Controllers/Api/V1/Inventory/StockAdjustmentController.php",
            ),
        ],
    ),
    (
        "5. Stock Transfers (PDF page 16)",
        [
            (
                "The outlet dropdown was not based on departments, so outlets without a stock shelf could be selected.",
                "Outlets are filtered to those with a stock department. Labels include the department name, and the backend still enforces the source shelf.",
                "Done",
                "Inventory > Stock Transfers > From/To outlet | src/pages/store/StoreTransfersPage.vue | app/Http/Controllers/Api/V1/Inventory/StockTransferController.php",
            ),
            (
                "The status filter only offered DRAFT; SENT was missing.",
                "Added All / DRAFT / SENT status filtering. Completed transfers are labelled SENT in the list.",
                "Done",
                "Inventory > Stock Transfers > Status filter | src/pages/store/StoreTransfersPage.vue",
            ),
            (
                "The new transfer form did not follow the purchase-order layout.",
                "Rebuilt the form with the purchase-order multi-line layout, SI unit selection, computed unit cost and line totals.",
                "Done",
                "Inventory > Stock Transfers > New Transfer | src/pages/store/StoreTransfersPage.vue",
            ),
            (
                "The list table had too many columns and showed row actions outside the detail view.",
                "The list now shows only the clickable S/N reference, Status and Cost Value. Actions live inside the detail modal.",
                "Done",
                "Inventory > Stock Transfers > list | src/pages/store/StoreTransfersPage.vue",
            ),
            (
                "Print, share, send and void actions were not clearly available from the transfer detail.",
                "The detail modal now contains Print, Share, Send and Void actions, with print signatures and a void reason modal.",
                "Done",
                "Inventory > Stock Transfers > detail modal | src/pages/store/StoreTransfersPage.vue",
            ),
        ],
    ),
]

KNOWN_FAILURES = [
    ("Frontend", "amend-group.spec.js", "4"),
    ("Frontend", "folio-ops.spec.js", "2"),
    ("Frontend", "group-booking-room-picker.spec.js", "2"),
    ("Frontend", "hotel-dashboard-management-band.spec.js", "3"),
    ("Frontend", "room-occupancy.spec.js", "2"),
]


def status_class(status: str) -> str:
    if status.startswith("Done"):
        return "badge badge-done"
    return "badge badge-neutral"


def where_cell(text: str) -> str:
    parts = [p.strip() for p in text.split("|") if p.strip()]
    out = []
    for part in parts:
        safe = escape(part)
        if part.startswith(("src/", "app/", "database/", "bootstrap/", "routes/", "tests/")):
            out.append(f'<span class="path">{safe}</span>')
        else:
            out.append(safe)
    return "<br>".join(out)


def section_html(title: str, rows) -> str:
    body = []
    for problem, solution, status, where in rows:
        body.append(
            "<tr>"
            f"<td>{escape(problem)}</td>"
            f"<td>{escape(solution)}</td>"
            f'<td><span class="{status_class(status)}">{escape(status)}</span></td>'
            f"<td>{where_cell(where)}</td>"
            "</tr>"
        )
    return f"""
    <section class="section">
      <h2>{escape(title)}</h2>
      <table>
        <colgroup>
          <col style="width:26%">
          <col style="width:41%">
          <col style="width:9%">
          <col style="width:24%">
        </colgroup>
        <thead>
          <tr>
            <th>Problem / PDF request</th>
            <th>Solution implemented</th>
            <th>Status</th>
            <th>Where to find it</th>
          </tr>
        </thead>
        <tbody>{''.join(body)}</tbody>
      </table>
    </section>
    """


total_rows = sum(len(rows) for _, rows in SECTIONS)
total_done = sum(1 for _, rows in SECTIONS for row in rows if row[2].startswith("Done"))

failures_html = "".join(
    f"<tr><td>{escape(system)}</td><td><span class='path'>{escape(name)}</span></td><td>{escape(count)}</td></tr>"
    for system, name, count in KNOWN_FAILURES
)

sections_html = "".join(section_html(title, rows) for title, rows in SECTIONS)

HTML_DOC = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MRK Hotels — Inventory Panel: Problems, Solutions &amp; Status</title>
<style>
  @page {{
    size: A4 landscape;
    margin: 14mm 10mm 14mm 10mm;
    @top-left {{
      content: "MRK Hotels — Inventory Panel: Problems, Solutions & Status";
      font-size: 7.5pt; color: #64748b;
    }}
    @top-right {{
      content: "{DATE} · {VERSION}";
      font-size: 7.5pt; color: #64748b;
    }}
    @bottom-center {{
      content: "Page " counter(page) " of " counter(pages);
      font-size: 7.5pt; color: #94a3b8;
    }}
  }}
  @page cover {{
    margin: 0;
    @top-left {{ content: none; }}
    @top-right {{ content: none; }}
    @bottom-center {{ content: none; }}
  }}
  * {{ box-sizing: border-box; }}
  html {{ font-size: 8.6pt; }}
  body {{
    font-family: "DejaVu Sans", "Noto Sans", sans-serif;
    color: #1e293b;
    line-height: 1.42;
    margin: 0;
  }}
  .cover {{
    page: cover;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    padding: 0 22mm;
    color: #fff;
    background: linear-gradient(150deg, #005eb8 0%, #003d77 72%, #002b55 100%);
  }}
  .cover .logo {{
    width: 96px; height: 96px; margin: 0 auto 16pt;
    background: #fff; border-radius: 50%; padding: 12px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.24);
  }}
  .cover .logo img {{ width: 100%; height: 100%; display: block; }}
  .cover .kicker {{ font-size: 9pt; letter-spacing: 3px; text-transform: uppercase; color: #bfdbfe; }}
  .cover h1 {{ color: #fff; font-size: 25pt; line-height: 1.18; margin: 10pt 0 8pt; }}
  .cover .subtitle {{ color: #e2e8f0; font-size: 10.5pt; margin: 0 auto; max-width: 190mm; }}
  .cover .rule {{ width: 84px; height: 3px; background: #60a5fa; margin: 14pt auto; border-radius: 2px; }}
  .cover .meta {{ color: #dbeafe; font-size: 9pt; line-height: 1.7; }}
  .cover .meta strong {{ color: #fff; }}
  .summary {{
    display: flex; gap: 8pt; justify-content: center; margin: 14pt auto 0; max-width: 190mm;
  }}
  .summary .box {{
    flex: 1; background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.24); border-radius: 7px;
    padding: 8pt 6pt;
  }}
  .summary .num {{ display: block; font-size: 18pt; font-weight: 700; color: #fff; }}
  .summary .label {{ display: block; font-size: 7.5pt; color: #dbeafe; text-transform: uppercase; letter-spacing: 0.6px; }}
  .section {{ margin-top: 10pt; }}
  h2 {{
    font-size: 13.5pt; color: #005eb8; margin: 0 0 6pt;
    border-bottom: 2px solid #005eb8; padding-bottom: 3pt;
    page-break-after: avoid;
  }}
  table {{
    width: 100%; border-collapse: collapse; margin: 0 0 10pt;
    page-break-inside: auto;
  }}
  thead {{ display: table-header-group; }}
  tr {{ page-break-inside: avoid; }}
  th {{
    background: #005eb8; color: #fff; text-align: left;
    padding: 5pt 6pt; font-size: 7.8pt; font-weight: 700;
  }}
  td {{
    border: 1px solid #dbe3ef; padding: 5pt 6pt;
    vertical-align: top; font-size: 7.8pt;
  }}
  tbody tr:nth-child(even) td {{ background: #f8fafc; }}
  .badge {{
    display: inline-block; padding: 2pt 6pt; border-radius: 999px;
    font-size: 7pt; font-weight: 700; white-space: nowrap;
  }}
  .badge-done {{ background: #dcfce7; color: #166534; }}
  .badge-neutral {{ background: #e2e8f0; color: #334155; }}
  .path {{
    font-family: "DejaVu Sans Mono", monospace;
    font-size: 6.9pt; color: #475569;
  }}
  .note {{
    background: #eff6ff; border-left: 4px solid #005eb8;
    padding: 8pt 10pt; margin: 8pt 0 12pt; border-radius: 0 6px 6px 0;
    color: #1e3a8a; font-size: 8pt;
  }}
  .note strong {{ color: #0f172a; }}
  .small-table th, .small-table td {{ font-size: 8pt; }}
  .footer-note {{ color: #64748b; font-size: 7.5pt; margin-top: 8pt; }}
  .keep {{ break-inside: avoid; page-break-inside: avoid; }}
  h3 {{ font-size: 10.5pt; color: #334155; margin: 12pt 0 5pt; page-break-after: avoid; }}
</style>
</head>
<body>
  <section class="cover">
    <div class="logo"><img src="MRK_logo.png" alt="MRK Hotels"></div>
    <div class="kicker">MRK Hotels</div>
    <h1>Inventory Panel<br>Problems, Solutions &amp; Status</h1>
    <div class="rule"></div>
    <p class="subtitle">Implementation reference for the client review document “MRK Inventory Panel — Problems, Fixes and Where to Find Them”. Each row maps a red PDF note to the change made, its status, and where to find it in the panel.</p>
    <div class="summary">
      <div class="box"><span class="num">{total_rows}</span><span class="label">PDF items covered</span></div>
      <div class="box"><span class="num">{total_done}</span><span class="label">Implemented</span></div>
      <div class="box"><span class="num">0</span><span class="label">Open PDF items</span></div>
      <div class="box"><span class="num">5</span><span class="label">Pages addressed</span></div>
    </div>
    <div class="meta" style="margin-top:14pt;">
      <strong>Prepared:</strong> {DATE} &nbsp;·&nbsp; <strong>Frontend:</strong> {VERSION} ({FRONTEND_COMMIT}) &nbsp;·&nbsp; <strong>Backend:</strong> {BACKEND_COMMIT}
    </div>
  </section>

  <section class="section">
    <h2>How to read this document</h2>
    <div class="note">
      <strong>Status:</strong> “Done” means the requested change is implemented and verified in the current code.
      <br><strong>Where to find it:</strong> the first line is the user-facing panel location; monospace lines are the main code references.
      <br><strong>Scope:</strong> this document covers the confirmed red handwritten notes on PDF pages 5, 7, 12, 14 and 16. The earlier purchase-order calendar/void fix on page 4 is already part of the same inventory workflow.
    </div>
  </section>

  {sections_html}

  <section class="section">
    <h2>Verification</h2>
    <table class="small-table">
      <colgroup><col style="width:22%"><col style="width:56%"><col style="width:22%"></colgroup>
      <thead><tr><th>Area</th><th>Check</th><th>Result</th></tr></thead>
      <tbody>
        <tr><td>Frontend</td><td>Targeted inventory tests (stock adjustments, GRN, purchase orders)</td><td>19 passed</td></tr>
        <tr><td>Frontend</td><td>Full Vitest suite</td><td>803 passed, 13 unrelated failures</td></tr>
        <tr><td>Frontend</td><td>ESLint and Oxlint on changed files</td><td>Passed</td></tr>
        <tr><td>Frontend</td><td>Production build</td><td>Passed</td></tr>
        <tr><td>Backend</td><td>InventoryTransactionsTest and StorePosModuleTest</td><td>24 passed, 172 assertions</td></tr>
        <tr><td>Backend</td><td>Full PHPUnit suite</td><td>1128 passed, 5136 assertions</td></tr>
      </tbody>
    </table>
    <div class="keep">
      <h3>Known unrelated frontend failures</h3>
      <p class="footer-note">These failures predate this inventory review and are outside its scope. They are listed for transparency.</p>
      <table class="small-table">
        <colgroup><col style="width:18%"><col style="width:62%"><col style="width:20%"></colgroup>
        <thead><tr><th>System</th><th>Failing spec</th><th>Count</th></tr></thead>
        <tbody>{failures_html}</tbody>
      </table>
    </div>
  </section>

  <section class="section">
    <h2>Implementation references</h2>
    <table class="small-table">
      <colgroup><col style="width:22%"><col style="width:78%"></colgroup>
      <thead><tr><th>Repository / commit</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td><span class="path">mrk-hotels-frontend</span><br>{FRONTEND_COMMIT}</td><td>Inventory panel: complete PDF review fixes</td></tr>
        <tr><td><span class="path">mrk-hotels-api</span><br>{BACKEND_COMMIT}</td><td>Inventory panel: complete PDF review backend fixes</td></tr>
      </tbody>
    </table>
  </section>
</body>
</html>
"""

if __name__ == "__main__":
    HTML(string=HTML_DOC, base_url=str(HERE)).write_pdf(str(OUT))
    print(f"Wrote {OUT} ({total_rows} items, {total_done} implemented)")
