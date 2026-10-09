#!/usr/bin/env python3
"""Pure parsing of the Israel Neurological Association conference's programme page (no network, no files).

israelneurocongress.com's "תכנית הכנס" page is server-rendered WordPress: per
conference day an `<h1>` heading ("Monday, 21 December 2026") and below it a
table. The table's first row names its columns ("Time", "Hall A3", "Hall A4"
…); every later row starts with its time ("08:30 – 09:40") or a blank time
cell, and spreads its cells over the halls with `colspan` (a session every
hall shares) and `rowspan` (a session that runs through several rows). A row
with a blank time belongs to the timed row above it: an "Oral Session" pair
under a "Parallel Scientific Sessions" banner, a plenary's "Topic: …".

This parser lays each table out as a grid and returns every non-empty cell
with its day, the halls it covers, and the time rows it runs through, in the
page's own words; what is a session is the adapter's call.

    python3 scraper/festivals/israel_neurology/sources/congress-site/parse.py --selftest
"""

import html
import html.parser
import os
import re
import sys

SAMPLES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples")

_DAY = re.compile(r"^(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$")
_SLOT = re.compile(r"^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})$")
_MONTHS = {m: n for n, m in enumerate(("january", "february", "march", "april", "may", "june", "july", "august",
                                        "september", "october", "november", "december"), 1)}


class _Tables(html.parser.HTMLParser):
    """The page's h1 headings and tables, in order: [("h1", text) | ("table", [[(text, colspan, rowspan)]])]."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items, self._text, self._cell, self._row, self._in_h1 = [], [], None, None, False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "h1":
            self._in_h1, self._text = True, []
        elif tag == "table":
            self.items.append(("table", []))
        elif tag == "tr" and self.items and self.items[-1][0] == "table":
            self._row = []
            self.items[-1][1].append(self._row)
        elif tag == "td" and self._row is not None:
            self._cell = {"text": [], "colspan": int(attrs.get("colspan") or 1), "rowspan": int(attrs.get("rowspan") or 1)}

    def handle_endtag(self, tag):
        if tag == "h1" and self._in_h1:
            self._in_h1 = False
            self.items.append(("h1", re.sub(r"\s+", " ", "".join(self._text)).strip()))
        elif tag == "td" and self._cell is not None:
            text = re.sub(r"\s+", " ", "".join(self._cell["text"])).strip()
            self._row.append((text, self._cell["colspan"], self._cell["rowspan"]))
            self._cell = None
        elif tag == "table":
            self._row = None

    def handle_data(self, data):
        if self._in_h1:
            self._text.append(data)
        if self._cell is not None:
            self._cell["text"].append(data)


def _grid(rows):
    """Table rows -> [(row, column, colspan, rowspan, text)], with rowspans pushing later cells right."""
    taken, cells = set(), []
    for r, row in enumerate(rows):
        c = 0
        for text, colspan, rowspan in row:
            while (r, c) in taken:
                c += 1
            for dr in range(rowspan):
                for dc in range(colspan):
                    taken.add((r + dr, c + dc))
            cells.append((r, c, colspan, rowspan, text))
            c += colspan
    return cells


def _hhmm(hours, minutes):
    return "%02d:%s" % (int(hours), minutes)


def cells(page):
    """The programme page -> [{date, start, end, rows, halls, text}], each non-empty cell outside the time column.

    `rows` are the times of the rows the cell runs through, as printed (a blank
    time row counts as its timed row above); `start` is the first's start and
    `end` the last's end.
    """
    parser = _Tables()
    parser.feed(page)
    out, day = [], None
    for kind, value in parser.items:
        if kind == "h1":
            m = _DAY.match(html.unescape(value))
            if m:
                day = "%s-%02d-%02d" % (m.group(3), _MONTHS[m.group(2).lower()], int(m.group(1)))
            continue
        rows = [row for row in value if row]
        if not rows or day is None:
            continue
        grid = _grid(rows)
        header = {c: text for r, c, span, _, text in grid if r == 0 for c in range(c, c + span)}
        if header.get(0) != "Time":
            raise ValueError("a programme table on %s does not open with a Time column" % day)
        times, current = {}, None
        for r, c, _, _, text in grid:
            if c == 0 and r > 0:
                if text:
                    if not _SLOT.match(text):
                        raise ValueError("unreadable time %r on %s" % (text, day))
                    current = text
                times[r] = current
        for r, c, colspan, rowspan, text in grid:
            if r == 0 or c == 0 or not text:
                continue
            spanned = [times[i] for i in range(r, r + rowspan) if i in times]
            if not spanned or spanned[0] is None:
                raise ValueError("cell %r on %s has no time row" % (text, day))
            first, last = _SLOT.match(spanned[0]), _SLOT.match(spanned[-1])
            out.append({
                "date": day,
                "start": _hhmm(first.group(1), first.group(2)),
                "end": _hhmm(last.group(3), last.group(4)),
                "rows": list(dict.fromkeys(spanned)),
                "halls": [header[i] for i in range(c, c + colspan)],
                "text": text,
            })
    return out


def selftest():
    with open(os.path.join(SAMPLES, "programme.html"), encoding="utf-8") as handle:
        page = handle.read()
    rows = cells(page)
    assert len(rows) == 26, len(rows)
    assert sorted({r["date"] for r in rows}) == ["2026-12-21", "2026-12-22"]
    assert rows[0] == {"date": "2026-12-21", "start": "07:30", "end": "08:30", "rows": ["07:30 – 08:30"],
                       "halls": ["Hall A3", "Hall A4"],
                       "text": "Gathering and Registration, Visit the Exhibition & ePoster Viewing"}, rows[0]
    oral2 = next(r for r in rows if r["text"].startswith("Oral Session 2"))
    assert (oral2["start"], oral2["end"], oral2["halls"]) == ("08:30", "09:40", ["Hall A4"]), oral2
    # A blank time cell belongs to the timed row above it.
    oral3 = next(r for r in rows if r["text"].startswith("Oral Session 3"))
    assert (oral3["start"], oral3["end"], oral3["halls"]) == ("15:30", "16:30", ["Hall A3"]), oral3
    topic = next(r for r in rows if r["text"] == "Topic: Neuro-oncology")
    assert (topic["start"], topic["halls"]) == ("11:30", ["Hall A3", "Hall A4"]), topic
    # The nurses' symposium runs down Hall A5 through six rows, and pushes the
    # later rows' cells into the halls beside it.
    nurses = next(r for r in rows if r["text"] == "Nurses Symposium")
    assert (nurses["date"], nurses["start"], nurses["end"], nurses["halls"]) == (
        "2026-12-22", "08:30", "14:00", ["Hall A5"]), nurses
    oral6 = next(r for r in rows if r["text"].startswith("Oral Session 6"))
    assert (oral6["start"], oral6["halls"]) == ("08:30", ["Hall A4"]), oral6
    meeting = rows[-1]
    assert (meeting["text"], meeting["start"], meeting["end"]) == ("Israel Neurological Association Meeting", "16:30", "17:30")
    print("israel neurology congress-site parse selftest: ok (%d cells)" % len(rows))


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
