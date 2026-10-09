#!/usr/bin/env python3
"""Programme PDFs laid out as a ruled grid: every cell's text, by where it sits.

A conference that publishes its programme as a PDF exported from a spreadsheet
or a word processor (ICISA from Excel, SEEEI from Word) draws it as a table:
thin filled rectangles for the cell borders, and text placed inside them. The
text order inside the file is whatever the exporter wrote, and right-to-left
runs come out reversed, so this module never trusts it. It reads where every
character and every border is, and answers which cell each character falls in:
the nearest border to its left, right, above and below. A merged cell has no
border through it, so its characters all land in the one cell; a hall column's
header and a time column's label are cells like any other, and the festival's
own parser decides what each one means.

Two halves:

  * `extract(pdf_bytes)` reads the file with pdfminer.six, the one fetch-time
    dependency (`pdfminer_modules` installs it into the git-ignored cache when
    the interpreter lacks it), into plain pages: characters with their boxes and
    weight, and the border rules;
  * everything else is pure, on those pages: `cells(page)` groups the
    characters into cells and each cell's characters into lines, in reading
    order, with a right-to-left line put into logical order.

    python3 scraper/festivals/platforms/pdf_grid.py --selftest
"""

import importlib
import io
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

FETCHER_VERSION = 1

# The pdfminer.six release the extraction was checked against.
PDFMINER = "pdfminer.six==20260107"
# A border is a filled rectangle at most this thick (points); a cell's
# background is thicker, and a corner dot is this small both ways.
RULE_MAX = 2.0
# A line this close to its cell's width was wrapped; the next line continues it.
FULL = 0.75
# A gap between lines this many times a line's height starts a new paragraph.
PARAGRAPH_GAP = 0.8
# How far (points) a border may stop short of a character and still bound it:
# exporters draw a cell's borders as separate segments that meet, not overlap.
REACH = 1.5
# A glyph shorter than this (points) is an exporter artifact (SEEEI draws
# stray one-point "1"s beside some names), not text anyone can read.
MIN_GLYPH = 2.0

_RTL = re.compile("[\\u0590-\\u05FF\\u0600-\\u06FF]")


def pdfminer_modules():
    """pdfminer.six's high_level and layout modules, installing it under the
    git-ignored festival cache when this interpreter has none."""
    try:
        return importlib.import_module("pdfminer.high_level"), importlib.import_module("pdfminer.layout")
    except ImportError:
        pass
    import registry
    target = os.path.join(registry.CACHE_ROOT, "pylib")
    if target not in sys.path:
        sys.path.insert(0, target)
    try:
        return importlib.import_module("pdfminer.high_level"), importlib.import_module("pdfminer.layout")
    except ImportError:
        pass
    print("pdf_grid: installing %s into %s" % (PDFMINER, target), file=sys.stderr)
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "--target", target, PDFMINER], check=True)
    importlib.invalidate_caches()
    return importlib.import_module("pdfminer.high_level"), importlib.import_module("pdfminer.layout")


def extract(pdf_bytes):
    """A PDF -> [{width, height, chars: [[c, x0, x1, top, bottom, bold]], rules: [[x0, top, x1, bottom]]}].

    Coordinates are points from the page's top left, rounded to 0.01.
    """
    high_level, layout = pdfminer_modules()
    pages = []
    for page in high_level.extract_pages(io.BytesIO(pdf_bytes), laparams=layout.LAParams()):
        height = page.height
        chars, rules = [], []

        def walk(item):
            if isinstance(item, layout.LTChar):
                text = item.get_text()
                if text.strip() and item.height >= MIN_GLYPH:
                    chars.append([text, round(item.x0, 2), round(item.x1, 2), round(height - item.y1, 2),
                                  round(height - item.y0, 2), "bold" in item.fontname.lower()])
            elif isinstance(item, (layout.LTRect, layout.LTLine)):
                rules.append([round(item.x0, 2), round(height - item.y1, 2), round(item.x1, 2), round(height - item.y0, 2)])
            elif isinstance(item, layout.LTContainer):
                for child in item:
                    walk(child)

        walk(page)
        pages.append({"width": round(page.width, 2), "height": round(height, 2), "chars": chars, "rules": rules})
    return pages


def borders(page):
    """The page's cell borders as ([(x, top, bottom)] vertical, [(y, x0, x1)] horizontal).

    A border meets other borders at both its ends; a thin rule that floats
    inside a cell (an underline under a heading) is no border and is dropped.
    """
    vertical, horizontal = [], []
    for x0, top, x1, bottom in page["rules"]:
        width, height = x1 - x0, bottom - top
        if width <= RULE_MAX and height > RULE_MAX:
            vertical.append(((x0 + x1) / 2, top, bottom))
        elif height <= RULE_MAX and width > RULE_MAX:
            horizontal.append(((top + bottom) / 2, x0, x1))

    def meets_vertical(x, y):
        return any(abs(vx - x) <= REACH + 1 and top - REACH <= y <= bottom + REACH for vx, top, bottom in vertical)

    def meets_horizontal(x, y):
        return any(abs(hy - y) <= REACH + 1 and x0 - REACH <= x <= x1 + REACH for hy, x0, x1 in horizontal)

    return ([v for v in vertical if meets_horizontal(v[0], v[1]) and meets_horizontal(v[0], v[2])],
            [h for h in horizontal if meets_vertical(h[1], h[0]) and meets_vertical(h[2], h[0])])


def _bounds(cx, cy, vertical, horizontal):
    left = max((x for x, top, bottom in vertical if x <= cx and top - REACH <= cy <= bottom + REACH), default=None)
    right = min((x for x, top, bottom in vertical if x >= cx and top - REACH <= cy <= bottom + REACH), default=None)
    top = max((y for y, x0, x1 in horizontal if y <= cy and x0 - REACH <= cx <= x1 + REACH), default=None)
    bottom = min((y for y, x0, x1 in horizontal if y >= cy and x0 - REACH <= cx <= x1 + REACH), default=None)
    if None in (left, right, top, bottom):
        return None
    return (round(left, 1), round(top, 1), round(right, 1), round(bottom, 1))


def logical(text):
    """A line drawn left to right -> its logical order, when it holds right-to-left script.

    The line is read as a right-to-left paragraph: its characters reversed, then
    each run of left-to-right characters (Latin, digits and the punctuation
    between them) turned back. Brackets need no mirroring: the exporter already
    maps a mirrored glyph to the character it means.
    """
    if not _RTL.search(text):
        return text
    return re.sub(r"[A-Za-z0-9][A-Za-z0-9 .,:;/&'’\-–]*[A-Za-z0-9]|[A-Za-z0-9]",
                  lambda m: m.group(0)[::-1], text[::-1])


def _lines(chars):
    """One cell's characters -> its lines, top to bottom, each {text, bold, x0, x1, top, bottom}."""
    rows = []
    for char in sorted(chars, key=lambda c: ((c[3] + c[4]) / 2, c[1])):
        middle, size = (char[3] + char[4]) / 2, char[4] - char[3]
        if rows and abs(rows[-1]["middle"] - middle) <= max(size, rows[-1]["size"]) * 0.45:
            rows[-1]["chars"].append(char)
        else:
            rows.append({"middle": middle, "size": size, "chars": [char]})
    out = []
    for row in rows:
        row_chars = sorted(row["chars"], key=lambda c: c[1])
        text, previous = "", None
        for char in row_chars:
            if previous is not None and char[1] - previous[2] > (char[4] - char[3]) * 0.2 and not text.endswith(" "):
                text += " "
            text += char[0]
            previous = char
        out.append({
            "text": re.sub(r"\s+", " ", logical(text)).strip(),
            "bold": all(c[5] for c in row_chars),
            "x0": round(min(c[1] for c in row_chars), 1),
            "x1": round(max(c[2] for c in row_chars), 1),
            "top": round(min(c[3] for c in row_chars), 1),
            "bottom": round(max(c[4] for c in row_chars), 1),
        })
    return out


def cells(page):
    """A page -> its cells, each {box: [x0, top, x1, bottom], lines}, top to bottom then left to right.

    Characters no four borders enclose (a footer, a caption outside the grid)
    form one more cell with `box` None, last.
    """
    vertical, horizontal = borders(page)
    grouped, loose = {}, []
    for char in page["chars"]:
        box = _bounds((char[1] + char[2]) / 2, (char[3] + char[4]) / 2, vertical, horizontal)
        if box is None:
            loose.append(char)
        else:
            grouped.setdefault(box, []).append(char)
    out = [{"box": list(box), "lines": _lines(chars)} for box, chars in sorted(grouped.items(), key=lambda kv: (kv[0][1], kv[0][0]))]
    if loose:
        out.append({"box": None, "lines": _lines(loose)})
    return out


def paragraphs(cell):
    """A cell's lines -> [[{text, bold, full}]], split where the gap between lines widens.

    `full` marks a line that fills the cell's width: the exporter wrapped it,
    and the next line continues it.
    """
    x0, _, x1, _ = cell["box"]
    out, previous = [], None
    for line in cell["lines"]:
        height = line["bottom"] - line["top"]
        if previous is None or line["top"] - previous["bottom"] > height * PARAGRAPH_GAP:
            out.append([])
        out[-1].append({"text": line["text"], "bold": line["bold"],
                        "full": (line["x1"] - line["x0"]) >= FULL * (x1 - x0)})
        previous = line
    return out


def overlap(a0, a1, b0, b1):
    """How much of the span a0..a1 the span b0..b1 covers, as a fraction of the shorter."""
    shorter = min(a1 - a0, b1 - b0)
    return max(0.0, min(a1, b1) - max(a0, b0)) / shorter if shorter > 0 else 0.0


def _char(c, x0, top, bold=False, width=5.0, size=8.0):
    return [c, x0, x0 + width, top, top + size, bold]


def _word(text, x0, top, bold=False, width=5.0):
    return [_char(c, x0 + width * i, top, bold, width * 0.9) for i, c in enumerate(text) if c != " "]


def selftest():
    # A 3x3 grid: a header row with two halls, a time column, and a hall-A cell
    # merged across the two time rows (no border between its rows).
    rules = []
    for x in (0, 50, 150, 250):
        rules.append([x - 0.25, 0, x + 0.25, 120])
    rules.append([-0.25, -0.25, 250.25, 0.25])
    rules.append([-0.25, 19.75, 250.25, 20.25])
    rules.append([-0.25, 69.75, 50.25, 70.25])      # the time column's row border
    rules.append([149.75, 69.75, 250.25, 70.25])    # hall B's row border; hall A merged
    rules.append([-0.25, 119.75, 250.25, 120.25])
    rules.append([10, 30, 40, 60])                  # a background fill, not a border
    rules.append([60, 60, 60.4, 60.4])              # a corner dot
    chars = (_word("HALL A", 60, 5, True) + _word("HALL B", 160, 5, True)
             + _word("08:30-09:30", 1, 30, True, 4) + _word("09:30-10:30", 1, 80, True, 4)
             + _word("Symposium", 60, 30, True) + _word("Talk one", 60, 45)
             + _word("Session", 160, 30, True) + _word("Late", 160, 80)
             + _word("page 1", 100, 130))
    # Characters arrive out of order, as an exporter writes them.
    page = {"width": 300, "height": 200, "chars": list(reversed(chars)), "rules": rules}
    vertical, horizontal = borders(page)
    assert len(vertical) == 4 and len(horizontal) == 5, (vertical, horizontal)
    got = cells(page)
    texts = [(c["box"], [line["text"] for line in c["lines"]]) for c in got]
    assert [t for _, t in texts] == [["HALL A"], ["HALL B"], ["08:30-09:30"], ["Symposium", "Talk one"],
                                     ["Session"], ["09:30-10:30"], ["Late"], ["page 1"]], texts
    by_text = {" / ".join(t): box for box, t in texts}
    assert by_text["HALL A"] == [50.0, 0.0, 150.0, 20.0], by_text
    assert by_text["Symposium / Talk one"] == [50.0, 20.0, 150.0, 120.0], by_text
    assert by_text["Session"] == [150.0, 20.0, 250.0, 70.0], by_text
    assert by_text["Late"] == [150.0, 70.0, 250.0, 120.0], by_text
    assert by_text["08:30-09:30"] == [0.0, 20.0, 50.0, 70.0], by_text
    assert got[-1]["box"] is None and got[-1]["lines"][0]["text"] == "page 1"
    symposium = next(c for c in got if c["lines"] and c["lines"][0]["text"] == "Symposium")
    assert [line["bold"] for line in symposium["lines"]] == [True, False]
    # A line's height apart is a new paragraph; "Symposium" fills less than its cell.
    assert paragraphs(symposium) == [[{"text": "Symposium", "bold": True, "full": False}],
                                     [{"text": "Talk one", "bold": False, "full": False}]]

    # Right-to-left lines read back in logical order; left-to-right lines untouched.
    assert logical("ABC 12:00") == "ABC 12:00"
    assert logical("ןושאר םוי") == "יום ראשון"
    # As SEEEI's programme draws them (the Word exporter's mirrored brackets).
    assert logical(")AI( תיתוכאלמ הניב") == "בינה מלאכותית (AI)"
    assert logical(":ףסונבו םיצרמה תופתתשהב ןויד") == "דיון בהשתתפות המרצים ובנוסף:"
    assert overlap(0, 10, 5, 20) == 0.5 and overlap(0, 10, 20, 30) == 0.0
    print("pdf_grid selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: pdf_grid.py --selftest")
    selftest()
