#!/usr/bin/env python3
"""
sync_version.py — single-source version stamping for the MRK Hotels docs.

Run from anywhere:
    python3 docs/sync_version.py                  # restamp everything with ../VERSION
    python3 docs/sync_version.py 1.2.0            # bump both VERSION files to 1.2.0 and restamp
    python3 docs/sync_version.py 1.2.0 \
        --date-en "20 September 2026" --date-sw "20 Septemba 2026"

What it updates (in place):
  1. ../VERSION and <API_ROOT>/VERSION  (1.2.0, no "v" prefix)
  2. docs/*.md header lines             (code vX.Y.Z · date)
  3. client action items HTML stamps     (default /tmp/opencode/mrk_client_action_items.html,
                                         override with MRK_CLIENT_HTML=/path/to/file.html)
  4. MRK_Hotels_Database_Schema_ERD.pdf  (patches the baked-in stamp in the content stream)
  5. Rebuilds all markdown PDFs via build_pdfs.py (which itself reads ../VERSION)

It then prints a reminder to add a CHANGELOG entry. No GitHub push is ever made.
"""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
VERSION_FILE = ROOT / "VERSION"
API_ROOT = Path("/home/victor/Documents/Projects/Apis/LaravelApis/mrk-hotels-api")
API_VERSION_FILE = API_ROOT / "VERSION"
ERD_PDF = HERE / "MRK_Hotels_Database_Schema_ERD.pdf"
CLIENT_HTML = Path(os.environ.get("MRK_CLIENT_HTML", "/tmp/opencode/mrk_client_action_items.html"))

# Lines at the top of each manual/doc that carry the code version stamp.
DOC_FILES = [
    HERE / "developer-docs.md",
    HERE / "user-manual-en.md",
    HERE / "user-manual-sw.md",
]
SW_DOC = HERE / "user-manual-sw.md"
DOC_HEADER_LINES = 5

# The ERD stamp text is written by ReportLab as a PDF literal string like
# "(v1\\0561\\0560  \\267  15 August 2026)". pypdf round-trips sometimes keep
# the octal escapes ("\\056") and sometimes normalize them to literal dots,
# so the matcher must accept both forms. ESC_DOT_RE matches an actual escaped
# "\\056" (regex backslash must be doubled); a bare "\056" would be read by
# the regex engine as octal '.'.
ESC_DOT_RE = b"\\\\056"
ERD_STAMP_RE = re.compile(
    rb"v(\d+)(?:\.|" + ESC_DOT_RE + rb")(\d+)(?:\.|" + ESC_DOT_RE + rb")(\d+)"
)
# On write, normalize to literal dots (pypdf preserves those as-is).
ERD_NEW_STAMP = b"v"


def current_version() -> str:
    return VERSION_FILE.read_text(encoding="utf-8").strip()


def write_version_files(version: str) -> None:
    for path in (VERSION_FILE, API_VERSION_FILE):
        path.write_text(version + "\n", encoding="utf-8")
        print(f"wrote {path} -> {version}")


def sync_doc_headers(version: str, date_en: str | None, date_sw: str | None) -> None:
    ver = f"v{version}"
    for path in DOC_FILES:
        date = date_sw if path == SW_DOC else date_en
        lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
        changed = False
        for i in range(min(DOC_HEADER_LINES, len(lines))):
            line = lines[i]
            new_line, n = re.subn(r"v\d+\.\d+\.\d+", ver, line)
            if date:
                # Replace the date that follows the version token, preserving
                # any whitespace before a trailing em-dash.
                new_line, m = re.subn(r"· [^—\n]*?(\s*)(?=—|$)", f"· {date}\\1", new_line)
                n = n + m
            if n:
                lines[i] = new_line
                changed = True
        if changed:
            path.write_text("".join(lines), encoding="utf-8")
            print(f"stamped {path.name} -> {ver}")


def sync_client_html(version: str, date_en: str | None) -> None:
    if not CLIENT_HTML.exists():
        print(f"skip client HTML: {CLIENT_HTML} not found")
        return
    text = CLIENT_HTML.read_text(encoding="utf-8")
    new_text, n = re.subn(r"v\d+\.\d+\.\d+", f"v{version}", text)
    if date_en:
        new_text, m = re.subn(r"· 15 (Agosti|August) 2026", f"· {date_en}", new_text)
        n = n + m
    if n:
        CLIENT_HTML.write_text(new_text, encoding="utf-8")
        print(f"stamped {CLIENT_HTML} -> v{version}")


def sync_erd_pdf(version: str) -> None:
    from pypdf import PdfReader, PdfWriter

    ma, mi, pa = version.split(".")
    reader = PdfReader(ERD_PDF)
    obj = reader.pages[0]["/Contents"].get_object()
    data = obj.get_data()
    new_data, count = ERD_STAMP_RE.subn(
        ERD_NEW_STAMP + ma.encode() + b"." + mi.encode() + b"." + pa.encode(), data
    )
    if count == 0:
        print(f"skip ERD patch: no version stamp found in {ERD_PDF.name}")
        return
    obj._data = new_data
    writer = PdfWriter()
    writer.append(reader)
    with open(ERD_PDF, "wb") as fh:
        writer.write(fh)
    print(f"patched {ERD_PDF.name} stamp -> v{version}")


def rebuild_pdfs() -> None:
    print("rebuilding markdown PDFs...")
    subprocess.run([sys.executable, "build_pdfs.py"], cwd=str(HERE), check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Restamp MRK Hotels docs to a version.")
    parser.add_argument("version", nargs="?", help="target version e.g. 1.2.0 (default: ../VERSION)")
    parser.add_argument("--date-en", help="optional new EN date, e.g. 20 September 2026")
    parser.add_argument("--date-sw", help="optional new SW date, e.g. 20 Septemba 2026")
    args = parser.parse_args()

    version = args.version or current_version()
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        print(f"error: invalid version {version!r} (expected x.y.z)", file=sys.stderr)
        sys.exit(1)

    write_version_files(version)
    sync_doc_headers(version, args.date_en, args.date_sw)
    sync_client_html(version, args.date_en)
    sync_erd_pdf(version)
    rebuild_pdfs()

    print()
    print("done. Reminders:")
    print("  - add a [version] section to CHANGELOG.md in both repos")
    print("  - no GitHub push was made")


if __name__ == "__main__":
    main()
