#!/usr/bin/env python3
"""Convert YKP_Hermez_Migration_Blueprint.md -> .docx.

Parses markdown line-by-line:
  - ATX headings (#..######)
  - Bullet lists (-, *, +) and ordered lists (N.)
  - Pipe tables (with optional alignment from separator row)
  - Fenced code blocks (``` ... ```)
  - Horizontal rules (---) -> page break / separator paragraph
  - Blockquotes (> ...)
  - Task list checkboxes ([ ] / [x]) preserved as literal text
  - Inline **bold** / *italic* / `code` rendered via runs

Usage:
    python build_blueprint_docx.py
Output:
    blueprint/YKP_Hermez_Migration_Blueprint.docx
"""

from __future__ import annotations

import os
import re
import sys

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Pt, RGBColor

SRC = r"D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER/blueprint/YKP_Hermez_Migration_Blueprint.md"
DST = r"D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER/blueprint/YKP_Hermez_Migration_Blueprint.docx"

# ---------------------------------------------------------------------------
# Inline markdown parsing
# ---------------------------------------------------------------------------

# Order matters: code spans first (protect content), then bold, then italic.
_INLINE_PATTERNS = [
    (re.compile(r"`([^`]+)`"), "code"),
    (re.compile(r"\*\*([^*]+)\*\*"), "bold"),
    (re.compile(r"__([^_]+)__"), "bold"),
    (re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)"), "italic"),
    (re.compile(r"(?<!_)_([^_]+)_(?!_)"), "italic"),
]


def _add_inline_runs(paragraph, text: str) -> None:
    """Split `text` into runs honoring `code`, **bold**, *italic*."""
    if not text:
        return
    # Tokenize: find earliest match among all patterns, repeat.
    remaining = text
    while remaining:
        earliest = None
        earliest_match = None
        earliest_kind = None
        for pat, kind in _INLINE_PATTERNS:
            m = pat.search(remaining)
            if m and (earliest is None or m.start() < earliest):
                earliest = m.start()
                earliest_match = m
                earliest_kind = kind
        if earliest_match is None:
            paragraph.add_run(remaining)
            break
        # text before match
        if earliest_match.start() > 0:
            paragraph.add_run(remaining[: earliest_match.start()])
        inner = earliest_match.group(1)
        run = paragraph.add_run(inner)
        if earliest_kind == "code":
            run.font.name = "Consolas"
            run.font.size = Pt(9)
            # light gray background via shading element
            _shade_run(run, "F2F2F2")
        elif earliest_kind == "bold":
            run.bold = True
        elif earliest_kind == "italic":
            run.italic = True
        remaining = remaining[earliest_match.end():]


def _shade_run(run, hex_fill: str) -> None:
    """Add a background shading element to a run."""
    rpr = run._element.get_or_add_rPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    rpr.append(shd)


# ---------------------------------------------------------------------------
# Heading / list detection
# ---------------------------------------------------------------------------

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
_HR_RE = re.compile(r"^(-{3,}|\*{3,}|_{3,})$")
_FENCE_RE = re.compile(r"^```\s*(\S*)?\s*$")
_BULLET_RE = re.compile(r"^\s*([-*+])\s+(.*)$")
_ORDERED_RE = re.compile(r"^\s*(\d+)[.)]\s+(.*)$")
_BLOCKQUOTE_RE = re.compile(r"^\s*>\s?(.*)$")
_TABLE_SEP_RE = re.compile(r"^\s*\|?\s*(:?-{2,}:?)\s*(\|\s*(:?-{2,}:?)\s*)*\|?\s*$")
_TASK_RE = re.compile(r"^\s*([-*+])\s+\[([ xX])\]\s+(.*)$")


def _is_table_sep(line: str) -> bool:
    """A table separator row like |---|:---:|---:|"""
    stripped = line.strip()
    if "|" not in stripped:
        return False
    # Must be only dashes, colons, pipes, spaces
    body = stripped.replace("|", "").replace(" ", "")
    if not body:
        return False
    return all(c in "-:" for c in body) and "-" in body


def _parse_table_row(line: str) -> list[str]:
    """Split a pipe-table row into cells. Strips outer pipes."""
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|") and not stripped.endswith(r"\|"):
        stripped = stripped[:-1]
    # Split on unescaped pipes
    parts = re.split(r"(?<!\\)\|", stripped)
    return [p.strip() for p in parts]


def _alignment_from_sep(sep_line: str) -> list[int]:
    """Return WD_ALIGN_PARAGRAPH constants per column from a separator row."""
    cells = _parse_table_row(sep_line)
    aligns = []
    for c in cells:
        c = c.strip()
        left = c.startswith(":")
        right = c.endswith(":")
        if left and right:
            aligns.append(WD_ALIGN_PARAGRAPH.CENTER)
        elif right:
            aligns.append(WD_ALIGN_PARAGRAPH.RIGHT)
        elif left:
            aligns.append(WD_ALIGN_PARAGRAPH.LEFT)
        else:
            aligns.append(WD_ALIGN_PARAGRAPH.LEFT)  # default left
    return aligns


# ---------------------------------------------------------------------------
# Document builder
# ---------------------------------------------------------------------------


def build_document(src_path: str, dst_path: str) -> tuple[int, int]:
    """Read markdown, write docx. Returns (paragraphs_added, tables_added)."""
    with open(src_path, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()

    doc = Document()

    # Base style: readable body font
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10.5)

    p_count = 0
    t_count = 0
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]

        # --- Fenced code block ---
        fence_match = _FENCE_RE.match(line)
        if fence_match:
            lang = (fence_match.group(1) or "").strip()
            code_lines = []
            i += 1
            while i < n and not _FENCE_RE.match(lines[i]):
                code_lines.append(lines[i])
                i += 1
            # i now at closing fence (or EOF)
            if i < n and _FENCE_RE.match(lines[i]):
                i += 1
            _add_code_block(doc, code_lines, lang)
            p_count += 1
            continue

        # --- Heading ---
        h = _HEADING_RE.match(line)
        if h:
            level = len(h.group(1))
            text = h.group(2)
            heading_style = f"Heading {min(level, 9)}"
            para = doc.add_heading(level=min(level, 9))
            _add_inline_runs(para, text)
            para.style = doc.styles[heading_style]
            p_count += 1
            i += 1
            continue

        # --- Horizontal rule ---
        if _HR_RE.match(line.strip()):
            # Insert a page break-ish separator (thin paragraph with bottom border)
            para = doc.add_paragraph()
            _add_bottom_border(para)
            p_count += 1
            i += 1
            continue

        # --- Table ---
        # A table starts when a line has a pipe and the next non-empty line is a table separator.
        if "|" in line and i + 1 < n and _is_table_sep(lines[i + 1]):
            table_lines = [line, lines[i + 1]]
            j = i + 2
            while j < n and "|" in lines[j] and lines[j].strip():
                table_lines.append(lines[j])
                j += 1
            aligns = _alignment_from_sep(lines[i + 1])
            header_cells = _parse_table_row(line)
            body_rows = []
            for row_line in table_lines[2:]:
                body_rows.append(_parse_table_row(row_line))
            _add_table(doc, header_cells, body_rows, aligns)
            t_count += 1
            i = j
            continue

        # --- Task list item ---
        task = _TASK_RE.match(line)
        if task:
            marker = task.group(1)
            checked = task.group(2).lower() == "x"
            text = task.group(3)
            para = doc.add_paragraph(style="List Bullet")
            prefix = "[x] " if checked else "[ ] "
            run = para.add_run(prefix)
            run.font.name = "Consolas"
            _add_inline_runs(para, text)
            p_count += 1
            i += 1
            continue

        # --- Bullet list ---
        b = _BULLET_RE.match(line)
        if b:
            text = b.group(2)
            # Indentation level from leading spaces
            lead = len(line) - len(line.lstrip())
            level = lead // 2
            para = doc.add_paragraph(style="List Bullet")
            _add_inline_runs(para, text)
            p_count += 1
            i += 1
            continue

        # --- Ordered list ---
        o = _ORDERED_RE.match(line)
        if o:
            text = o.group(2)
            para = doc.add_paragraph(style="List Number")
            _add_inline_runs(para, text)
            p_count += 1
            i += 1
            continue

        # --- Blockquote ---
        q = _BLOCKQUOTE_RE.match(line)
        if q:
            text = q.group(1)
            para = doc.add_paragraph()
            para.paragraph_format.left_indent = Pt(18)
            _add_left_border(para)
            _add_inline_runs(para, text)
            para.runs[0].italic = True if para.runs else False
            # re-apply inline (italic already set on first run if any)
            p_count += 1
            i += 1
            continue

        # --- Blank line ---
        if not line.strip():
            i += 1
            continue

        # --- Normal paragraph (accumulate consecutive non-empty, non-special lines) ---
        buf = [line]
        j = i + 1
        while j < n:
            nxt = lines[j]
            if (
                not nxt.strip()
                or _HEADING_RE.match(nxt)
                or _FENCE_RE.match(nxt)
                or _HR_RE.match(nxt.strip())
                or _BULLET_RE.match(nxt)
                or _ORDERED_RE.match(nxt)
                or _BLOCKQUOTE_RE.match(nxt)
                or _TASK_RE.match(nxt)
            ):
                break
            # table start?
            if "|" in nxt and j + 1 < n and _is_table_sep(lines[j + 1]):
                break
            buf.append(nxt)
            j += 1
        para = doc.add_paragraph()
        _add_inline_runs(para, " ".join(buf).strip())
        p_count += 1
        i = j

    doc.save(dst_path)
    return p_count, t_count


def _add_code_block(doc: Document, code_lines: list[str], lang: str) -> None:
    """Render a code block as a single-shaded paragraph in monospace."""
    text = "\n".join(code_lines)
    para = doc.add_paragraph()
    para.paragraph_format.left_indent = Pt(6)
    run = para.add_run(text)
    run.font.name = "Consolas"
    run.font.size = Pt(9)
    _shade_paragraph(para, "F4F4F4")


def _add_table(
    doc: Document,
    header: list[str],
    rows: list[list[str]],
    aligns: list[int],
) -> None:
    """Add a table with a header row and body rows. Apply alignment per column."""
    n_cols = max(len(header), max((len(r) for r in rows), default=0))
    # Pad
    header = header + [""] * (n_cols - len(header))
    rows = [r + [""] * (n_cols - len(r)) for r in rows]

    table = doc.add_table(rows=1 + len(rows), cols=n_cols)
    table.style = "Light Grid Accent 1"
    table.alignment = WD_TABLE_ALIGNMENT.LEFT

    # Header
    hdr_cells = table.rows[0].cells
    for c_idx, cell_text in enumerate(header):
        cell = hdr_cells[c_idx]
        cell.text = ""
        para = cell.paragraphs[0]
        _add_inline_runs(para, cell_text)
        for run in para.runs:
            run.bold = True
        # shading
        _shade_cell(cell, "D9E2F3")
        # alignment
        if c_idx < len(aligns):
            para.alignment = aligns[c_idx]

    # Body
    for r_idx, row in enumerate(rows):
        cells = table.rows[r_idx + 1].cells
        for c_idx, cell_text in enumerate(row):
            cell = cells[c_idx]
            cell.text = ""
            para = cell.paragraphs[0]
            _add_inline_runs(para, cell_text)
            if c_idx < len(aligns):
                para.alignment = aligns[c_idx]


def _shade_cell(cell, hex_fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tc_pr.append(shd)


def _shade_paragraph(para, hex_fill: str) -> None:
    ppr = para._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    ppr.append(shd)


def _add_bottom_border(para) -> None:
    ppr = para._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "BFBFBF")
    pbdr.append(bottom)
    ppr.append(pbdr)


def _add_left_border(para) -> None:
    ppr = para._p.get_or_add_pPr()
    pbdr = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), "12")
    left.set(qn("w:space"), "4")
    left.set(qn("w:color"), "BFBFBF")
    pbdr.append(left)
    ppr.append(pbdr)


def main() -> int:
    if not os.path.isfile(SRC):
        print(f"ERROR: source not found: {SRC}", file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    p, t = build_document(SRC, DST)
    size = os.path.getsize(DST) if os.path.isfile(DST) else 0
    print(f"OK -> {DST}")
    print(f"paragraphs={p}  tables={t}  bytes={size}")
    return 0 if size > 0 else 2


if __name__ == "__main__":
    sys.exit(main())