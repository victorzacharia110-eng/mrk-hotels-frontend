#!/usr/bin/env python3
"""Build PDFs for the MRK Hotels documentation using Markdown + WeasyPrint."""
import markdown
import weasyprint
from pathlib import Path

HERE = Path(__file__).parent

CSS = """
@page {
  size: A4;
  margin: 20mm 16mm 18mm 16mm;
  @top-center {
    content: "MRK Hotels — Documentation";
    font-size: 8pt; color: #94a3b8;
  }
  @bottom-center {
    content: "Page " counter(page) " of " counter(pages);
    font-size: 8pt; color: #94a3b8;
  }
}
@page cover {
  margin: 0;
  @top-center { content: none; }
  @bottom-center { content: none; }
}
* { box-sizing: border-box; }
html { font-size: 10pt; }
body {
  font-family: 'DejaVu Sans', 'Noto Sans', sans-serif;
  color: #1e293b;
  line-height: 1.55;
}
h1 { font-size: 20pt; color: #005EB8; margin: 0 0 4pt; }
h1.doc-title { font-size: 26pt; }
h2 {
  font-size: 15pt; color: #005EB8;
  border-bottom: 2px solid #005EB8; padding-bottom: 4pt;
  margin: 22pt 0 10pt; page-break-after: avoid;
}
h3 { font-size: 12pt; color: #0f172a; margin: 16pt 0 6pt; page-break-after: avoid; }
h4 { font-size: 10.5pt; margin: 10pt 0 4pt; page-break-after: avoid; }
p { margin: 6pt 0; }
ul, ol { margin: 6pt 0 6pt 18pt; padding: 0; }
li { margin: 2pt 0; }
strong { color: #0f172a; }
a { color: #005EB8; text-decoration: none; }
hr { border: none; border-top: 1px solid #e2e8f0; margin: 18pt 0; }

table {
  width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 9pt;
  page-break-inside: auto;
}
th {
  background: #005EB8; color: #fff; text-align: left;
  padding: 6pt 8pt; font-weight: 600;
}
td { border: 1px solid #e2e8f0; padding: 5pt 8pt; vertical-align: top; }
tr:nth-child(even) td { background: #f8fafc; }
tr { page-break-inside: avoid; }

pre {
  background: #0f172a; color: #e2e8f0; padding: 10pt 12pt;
  border-radius: 6px; font-family: 'DejaVu Sans Mono', monospace;
  font-size: 8.5pt; line-height: 1.45; white-space: pre-wrap;
  page-break-inside: avoid;
}
code {
  font-family: 'DejaVu Sans Mono', monospace; font-size: 8.5pt;
  background: #f1f5f9; padding: 1pt 4pt; border-radius: 3px; color: #0f172a;
}
pre code { background: none; padding: 0; color: inherit; }

figure { margin: 12pt 0; page-break-inside: avoid; }
img {
  max-width: 100%; height: auto;
  border: 1px solid #e2e8f0; border-radius: 6px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}
figcaption {
  text-align: center; font-size: 8.5pt; color: #64748b;
  margin-top: 4pt;
}

blockquote {
  margin: 8pt 0; padding: 8pt 12pt; background: #eff6ff;
  border-left: 4px solid #005EB8; color: #1e40af; border-radius: 0 6px 6px 0;
}

.cover {
  page: cover; height: 100vh; text-align: center;
  display: flex; flex-direction: column; justify-content: center;
  background: linear-gradient(160deg, #005EB8 0%, #003d77 100%); color: #fff;
}
.cover .logo {
  width: 112px; height: 112px; margin: 0 auto 22pt;
  background: #ffffff; border-radius: 50%;
  padding: 14px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
}
.cover .logo img { width: 100%; height: 100%; display: block; }
.cover .kicker { font-size: 11pt; letter-spacing: 3px; text-transform: uppercase; color: #bfdbfe; }
.cover h1 { color: #fff; font-size: 30pt; margin: 10pt 0; }
.cover p { color: #e2e8f0; font-size: 11pt; }
.cover .rule { width: 90px; height: 3px; background: #60a5fa; margin: 18pt auto; border-radius: 2px; }
"""


def build(md_path, out_name, title):
    text = Path(md_path).read_text(encoding="utf-8")
    html_body = markdown.markdown(
        text, extensions=["tables", "fenced_code", "toc"]
    )
    cover = (
        '<section class="cover">'
        '<div class="logo"><img src="MRK_logo.png" alt="MRK Hotels"></div>'
        f'<div class="kicker">MRK Hotels</div>'
        f'<h1>{title}</h1>'
        '<div class="rule"></div>'
        "<p>Multi-tenant hotel management system</p>"
        "</section>"
    )
    html = (
        '<html><head><meta charset="utf-8"><style>'
        + CSS
        + "</style></head><body>"
        + cover
        + '<div class="content">'
        + html_body
        + "</div></body></html>"
    )
    weasyprint.HTML(string=html, base_url=str(HERE)).write_pdf(
        str(HERE / out_name)
    )
    print(f"built {out_name}")


build(HERE / "user-manual-en.md", "MRK_Hotels_User_Manual_EN.pdf", "User Manual")
build(HERE / "user-manual-sw.md", "MRK_Hotels_User_Manual_SW.pdf", "Mwongozo wa Mtumiaji")
build(HERE / "developer-docs.md", "MRK_Hotels_Developer_Documentation.pdf", "Developer Documentation")
print("All PDFs generated.")
