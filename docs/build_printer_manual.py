#!/usr/bin/env python3
"""Build the MRK Hotels printer setup guide PDF (CUPS & Windows, all systems).

A standalone, self-contained builder so the dedicated manual styling lives next
to the manual and does not touch the shared documentation pipeline
(build_pdfs.py). The cover, colours and callouts all follow the MRK Hotels brand.

Usage:  python3 docs/build_printer_manual.py
"""
from pathlib import Path

import markdown
import weasyprint

HERE = Path(__file__).parent
SOURCE = HERE / "printer-manual" / "MRK_Printer_Setup_Guide.md"
OUTPUT = HERE / "MRK_Hotels_Printer_Setup_Guide.pdf"

# Read the repo version if present so the chip always matches the build.
try:
    VERSION = "v" + (HERE.parent / "VERSION").read_text(encoding="utf-8").strip()
except OSError:
    VERSION = "v1.0"

EDITION = "Edition 1.0"
DATE = "October 2026"

CSS = """
@page {
  size: A4;
  margin: 20mm 16mm 18mm 16mm;
  @top-left {
    content: "MRK Hotels — Printer Setup Guide";
    font-size: 8pt; color: #005EB8; font-weight: bold;
  }
  @top-right { content: "CUPS & Windows"; font-size: 8pt; color: #94a3b8; }
  @bottom-center {
    content: "Page " counter(page) " of " counter(pages);
    font-size: 8pt; color: #94a3b8;
  }
}
@page cover {
  margin: 0;
  @top-left { content: none; }
  @top-right { content: none; }
  @bottom-center { content: none; }
}
* { box-sizing: border-box; }
html { font-size: 11pt; }
body {
  font-family: 'DejaVu Sans', 'Noto Sans', sans-serif;
  color: #1e293b; line-height: 1.55;
}
h1 {
  font-size: 18pt; color: #ffffff; background: #005EB8;
  padding: 9pt 14pt; border-radius: 9px; margin: 24pt 0 12pt;
  page-break-after: avoid;
}
h1.part { page-break-before: always; }
h2 {
  font-size: 15pt; color: #003F8A;
  border-bottom: 2px solid #005EB8; padding-bottom: 4pt;
  margin: 20pt 0 9pt; page-break-after: avoid;
}
h3 { font-size: 12.5pt; color: #0f172a; margin: 14pt 0 5pt; page-break-after: avoid; }
p { margin: 6pt 0; }
ul, ol { margin: 6pt 0 6pt 16pt; padding: 0; }
li { margin: 3pt 0; }
strong { color: #0f172a; }
a { color: #005EB8; text-decoration: none; }
hr { border: none; border-top: 1px solid #e2e8f0; margin: 16pt 0; }

/* Tables */
table {
  width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 10pt;
  page-break-inside: auto;
}
th {
  background: #005EB8; color: #fff; text-align: left;
  padding: 7pt 9pt; font-weight: 600;
}
td { border: 1px solid #e2e8f0; padding: 6pt 9pt; vertical-align: top; }
tr:nth-child(even) td { background: #f8fafc; }
tr { page-break-inside: avoid; }

code {
  font-family: 'DejaVu Sans Mono', monospace; font-size: 9.5pt;
  background: #eef4fe; color: #003F8A; padding: 1pt 5pt; border-radius: 4px;
}

/* Step cards */
.steps { counter-reset: step; }
.steps ol {
  list-style: none; margin: 0; padding: 0;
}
.steps ol > li {
  counter-increment: step; position: relative;
  padding: 9pt 11pt 9pt 34pt; margin: 7pt 0;
  background: #f5faff; border: 1px solid #d6e9f9; border-radius: 9px;
  page-break-inside: avoid;
}
.steps ol > li::before {
  content: counter(step);
  position: absolute; left: 9pt; top: 9pt;
  width: 17pt; height: 17pt; line-height: 17pt; text-align: center;
  background: #005EB8; color: #ffffff; border-radius: 50%;
  font-size: 9pt; font-weight: bold;
}

/* Quick reference card */
.quickref {
  background: linear-gradient(160deg, #005EB8 0%, #003F8A 100%);
  color: #ffffff; border-radius: 12px; padding: 14pt 16pt; margin: 8pt 0 4pt;
  page-break-inside: avoid;
}
.quickref ol { margin: 6pt 0 0 18pt; }
.quickref li { margin: 4pt 0; }
.quickref strong { color: #ffffff; }

/* Callouts */
.callout {
  border-radius: 9px; padding: 10pt 13pt; margin: 10pt 0;
  page-break-inside: avoid;
}
.callout p:first-child { margin-top: 0; }
.callout p:last-child { margin-bottom: 0; }
.callout-title { font-weight: bold; margin-bottom: 3pt; letter-spacing: 0.3px; }
.tip { background: #ecfdf5; border-left: 4px solid #10b981; }
.tip .callout-title { color: #047857; }
.important { background: #fffbeb; border-left: 4px solid #f59e0b; }
.important .callout-title { color: #b45309; }
.note { background: #eff6ff; border-left: 4px solid #005EB8; }
.note .callout-title { color: #1e40af; }

/* OS headings + badges */
.os-head { margin: 4pt 0 8pt; padding: 9pt 12pt; border-radius: 9px; background: #f8fafc; border-left: 5px solid #005EB8; page-break-after: avoid; page-break-inside: avoid; }
.os-head.win { border-left-color: #0078D4; background: #f2f8fe; }
.os-head.mac { border-left-color: #333333; background: #f5f5f5; }
.os-head.linux { border-left-color: #E95420; background: #fdf4ef; }
.os-head.all { border-left-color: #c9a227; background: #fffaeb; }
.os-head p { margin: 6pt 0 0; }
.badge {
  display: inline-block; padding: 2pt 10pt; border-radius: 12px;
  font-size: 8.5pt; font-weight: bold; color: #ffffff;
}
.badge.win { background: #0078D4; }
.badge.mac { background: #333333; }
.badge.linux { background: #E95420; }
.badge.all { background: #c9a227; }

/* Cover */
.cover {
  page: cover; height: 100vh; text-align: center;
  display: flex; flex-direction: column; justify-content: center;
  background: linear-gradient(160deg, #005EB8 0%, #002e63 100%);
  color: #ffffff; padding: 0 24pt;
}
.cover .logo {
  width: 118px; height: 118px; margin: 0 auto 20pt;
  background: #ffffff; border-radius: 50%; padding: 14px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3);
}
.cover .logo img { width: 100%; height: 100%; display: block; }
.cover .kicker {
  font-size: 11pt; letter-spacing: 4px; text-transform: uppercase; color: #bfdbfe;
}
.cover h1 {
  color: #ffffff; font-size: 32pt; margin: 8pt 0 0; background: none; padding: 0;
}
.cover .subtitle { color: #dbeafe; font-size: 13pt; margin: 10pt 0 0; }
.cover .rule { width: 96px; height: 3px; background: #c9a227; margin: 18pt auto; border-radius: 2px; }
.cover .platforms {
  display: inline-block; margin-top: 4pt; padding: 6pt 16pt;
  border: 1px solid rgba(255, 255, 255, 0.45); border-radius: 20px;
  font-size: 10.5pt; letter-spacing: 1px; color: #ffffff;
}
.cover .edition { margin-top: 10pt; font-size: 9.5pt; color: #bfdbfe; }
"""


def build():
    text = SOURCE.read_text(encoding="utf-8")
    body = markdown.markdown(
        text,
        extensions=["tables", "fenced_code", "attr_list", "md_in_html", "sane_lists"],
    )
    cover = (
        '<section class="cover">'
        '<div class="logo"><img src="MRK_logo.png" alt="MRK Hotels"></div>'
        '<div class="kicker">MRK Hotels</div>'
        "<h1>Printer Setup Guide</h1>"
        '<div class="rule"></div>'
        '<p class="subtitle">The reliable way &mdash; CUPS &amp; Windows, step by step</p>'
        '<div class="platforms">Windows &nbsp;&middot;&nbsp; macOS &nbsp;&middot;&nbsp; Linux</div>'
        f'<p class="edition">{VERSION} &middot; {EDITION} &middot; {DATE}</p>'
        "</section>"
    )
    html = (
        '<html><head><meta charset="utf-8"><style>'
        + CSS
        + "</style></head><body>"
        + cover
        + body
        + "</body></html>"
    )
    weasyprint.HTML(string=html, base_url=str(HERE)).write_pdf(str(OUTPUT))
    print(f"built {OUTPUT}")


if __name__ == "__main__":
    build()
